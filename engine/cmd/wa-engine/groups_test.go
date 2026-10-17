package main

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

var bobLID = types.NewJID("100000000000003", types.HiddenUserServer)

func groupInfo() *types.GroupInfo {
	return &types.GroupInfo{
		JID:                         group,
		GroupName:                   types.GroupName{Name: "Book club"},
		GroupTopic:                  types.GroupTopic{Topic: "synthetic description"},
		GroupAnnounce:               types.GroupAnnounce{IsAnnounce: true},
		GroupMembershipApprovalMode: types.GroupMembershipApprovalMode{IsJoinApprovalRequired: true},
		MemberAddMode:               types.GroupMemberAddModeAdmin,
		Participants: []types.GroupParticipant{
			{JID: selfLID, LID: selfLID, PhoneNumber: selfPN, IsAdmin: true, IsSuperAdmin: true},
			{JID: annPN, PhoneNumber: annPN, LID: annLID, IsAdmin: true},
			{JID: bobPN, PhoneNumber: bobPN},
		},
	}
}

func TestGroupNamesEachMemberByTheStoresIDWithTheirRole(t *testing.T) {
	stored[bobPN.User] = bobLID
	defer delete(stored, bobPN.User)
	got := testConverter().group(groupInfo(), nil)
	want := []waMember{
		{JID: selfLID.String(), Role: "owner"},
		{JID: annLID.String(), Name: str("Ann Lee"), Role: "admin"},
		{JID: bobLID.String(), Role: "member"},
	}
	if len(got.Members) != len(want) {
		t.Fatalf("got %d members, want %d", len(got.Members), len(want))
	}
	for i, member := range got.Members {
		if member.JID != want[i].JID || member.Role != want[i].Role || (member.Name == nil) != (want[i].Name == nil) {
			t.Fatalf("member %d: got %+v, want %+v", i, member, want[i])
		}
	}
	if *got.Chat.Participants != 3 || got.AddMode != "admin_add" || !got.Approval || !got.Announce || got.Locked {
		t.Fatalf("got %+v", got)
	}
}

func TestGroupWireShape(t *testing.T) {
	info := groupInfo()
	info.Participants = info.Participants[:1]
	link := "https://chat.whatsapp.com/AAAAAAAAAAAAAAAAAAAAAA"
	assertJSON(t, testConverter().group(info, &link), `{"chat":{"jid":"120363000000000001@g.us","name":"Book club",`+
		`"kind":"group","unread":null,"lastMessageAt":null,"participants":1},"description":"synthetic description",`+
		`"link":"https://chat.whatsapp.com/AAAAAAAAAAAAAAAAAAAAAA","addMode":"admin_add","approval":true,`+
		`"announce":true,"locked":false,"ephemeral":0,"members":[{"jid":"100000000000001@lid","name":null,"role":"owner"}]}`)
	info.Participants = nil
	assertJSON(t, waJoined{Requested: true}, `{"group":null,"requested":true}`)
	assertJSON(t, waNotAdded{NotAdded: failedOf(nil, nil, testConverter())}, `{"notAdded":[]}`)
}

func TestFailedOfAnswersInTheFormAsked(t *testing.T) {
	answered := []types.GroupParticipant{
		{JID: annPN, PhoneNumber: annPN, LID: annLID, Error: 403},
		{JID: bobPN, PhoneNumber: bobPN},
	}
	got := failedOf([]types.JID{annLID, bobPN}, answered, testConverter())
	if len(got) != 1 || got[0] != annLID.String() {
		t.Fatalf("got %v, want only %v", got, annLID)
	}
}

func TestJoinRequestsWireShape(t *testing.T) {
	at := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	got := testConverter().joinRequests([]types.GroupParticipantRequest{{JID: annLID, RequestedAt: at}, {JID: bobLID}})
	assertJSON(t, got, `[{"jid":"100000000000002@lid","name":"Ann Lee","requestedAt":"2026-09-01T10:00:00.000Z"},`+
		`{"jid":"100000000000003@lid","name":null,"requestedAt":null}]`)
	assertJSON(t, testConverter().joinRequests(nil), `[]`)
}

func TestInviteCodeIsFoundInATypedLink(t *testing.T) {
	for _, link := range []string{"https://chat.whatsapp.com/AbC123", "chat.whatsapp.com/AbC123", "  http://CHAT.whatsapp.com/AbC123?x=1"} {
		found := inviteCode.FindStringSubmatch(link)
		if found == nil || found[1] != "AbC123" {
			t.Fatalf("%q: got %v", link, found)
		}
	}
	for _, link := range []string{
		"https://example.com/AbC123",
		"https://example.com/chat.whatsapp.com/AbC123",
		"https://evilchat.whatsapp.com/AbC123",
		"https://chat.whatsapp.com.evil/AbC123",
		"https://evil@chat.whatsapp.com/AbC123",
		"https://chat.whatsapp.com/AbC123/extra",
		"https://chat.whatsapp.com/AbC123 embedded text",
	} {
		if inviteCode.MatchString(link) {
			t.Fatalf("accepted unrelated or malformed URL %q", link)
		}
	}
}

func TestPersonAndGroupIDsAreChecked(t *testing.T) {
	if _, err := personJID(group.String()); err == nil {
		t.Fatal("a group is not a person")
	}
	if _, err := groupJID(annLID.String()); err == nil {
		t.Fatal("a person is not a group")
	}
	if got, err := personJID("100000000000002:4@lid"); err != nil || got != annLID {
		t.Fatalf("got %v %v", got, err)
	}
}

func assertJSON(t *testing.T, value any, want string) {
	t.Helper()
	got, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
}

func TestGroupFailureNamesARefusalToANonAdmin(t *testing.T) {
	for _, err := range []error{&whatsmeow.IQError{Code: 401}, fmt.Errorf("wrapped: %w", &whatsmeow.IQError{Code: 403})} {
		if f, ok := groupFailure(err).(*failure); !ok || f.Code != "permission_error" {
			t.Fatalf("%v: got %v, want a permission_error", err, groupFailure(err))
		}
	}
	if groupFailure(nil) != nil {
		t.Fatal("no error is no failure")
	}
	if got := classify(groupFailure(whatsmeow.ErrNotInGroup)); got.Code != "permission_error" {
		t.Fatalf("not being in the group: got %v", got)
	}
}
