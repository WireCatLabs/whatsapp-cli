package main

import (
	"encoding/json"
	"testing"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

var carolLID = types.NewJID("100000000000004", types.HiddenUserServer)

func stub(kind waWeb.WebMessageInfo_StubType, by string, params ...string) *waWeb.WebMessageInfo {
	web := &waWeb.WebMessageInfo{
		Key:                   &waCommon.MessageKey{ID: proto.String("3EB0S1"), RemoteJID: proto.String(group.String())},
		MessageTimestamp:      proto.Uint64(uint64(sentAt.Unix())),
		MessageStubType:       kind.Enum(),
		MessageStubParameters: params,
	}
	if by != "" {
		web.Participant = proto.String(by)
	}
	return web
}

func TestGroupNotificationBecomesOneEventPerChange(t *testing.T) {
	stored[annPN.User] = annLID
	defer delete(stored, annPN.User)
	c := testConverter()
	cases := []struct {
		name string
		evt  events.GroupInfo
		want string
	}{
		{"someone who came in alone joined", events.GroupInfo{Sender: &carolLID, Join: []types.JID{carolLID}}, "join"},
		{"by an invite link", events.GroupInfo{JoinReason: "invite", Sender: &annLID, Join: []types.JID{carolLID}}, "join"},
		{"someone else's doing added them", events.GroupInfo{Sender: &annLID, Join: []types.JID{carolLID}}, "add"},
		{"someone who went out alone left", events.GroupInfo{Sender: &carolLID, Leave: []types.JID{carolLID}}, "leave"},
		{"no sender is their own doing", events.GroupInfo{Leave: []types.JID{carolLID}}, "leave"},
		{"someone else's doing removed them", events.GroupInfo{Sender: &annLID, Leave: []types.JID{carolLID}}, "remove"},
		{"promoted", events.GroupInfo{Sender: &annLID, Promote: []types.JID{carolLID}}, "promote"},
		{"demoted", events.GroupInfo{Sender: &annLID, Demote: []types.JID{carolLID}}, "demote"},
	}
	for _, tc := range cases {
		tc.evt.JID, tc.evt.Timestamp = group, sentAt
		got := c.groupChanges(&tc.evt)
		if len(got) != 1 || got[0].Event != tc.want || got[0].Chat != group.String() || got[0].People[0].JID != carolLID.String() {
			t.Errorf("%s: got %+v", tc.name, got)
		}
	}

	both := c.groupChanges(&events.GroupInfo{
		JID: group, Timestamp: sentAt, Sender: &annPN,
		Join: []types.JID{bobPN, annPN}, Name: &types.GroupName{Name: "Reading club"},
	})
	if len(both) != 2 || both[0].Event != "add" || both[1].Event != "title" || *both[1].Title != "Reading club" {
		t.Fatalf("got %+v", both)
	}
	added := both[0]
	if *added.By != annLID.String() || *added.ByName != "Ann Lee" || added.Timestamp != "2026-09-01T10:00:00.000Z" {
		t.Errorf("the actor in LID form, with a name: got %+v", added)
	}
	if added.People[0].JID != annLID.String() || added.People[1].JID != bobPN.String() {
		t.Errorf("the people in LID form where one is known, sorted: got %+v", added.People)
	}
}

func TestLiveAndHistoryGiveTheSameEvent(t *testing.T) {
	stored[annPN.User] = annLID
	defer delete(stored, annPN.User)
	c := testConverter()
	cases := []struct {
		name string
		live events.GroupInfo
		web  *waWeb.WebMessageInfo
	}{
		{"an add, the person in phone form on one side", events.GroupInfo{Sender: &selfLID, Join: []types.JID{annLID, bobPN}},
			stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_ADD, selfPN.String(), bobPN.String(), annPN.String())},
		{"a leave", events.GroupInfo{Sender: &annLID, Leave: []types.JID{annLID}},
			stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_LEAVE, annPN.String(), annPN.String())},
		{"a removal", events.GroupInfo{Sender: &selfLID, Leave: []types.JID{carolLID}},
			stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_REMOVE, selfLID.String(), carolLID.String())},
		{"a join by link", events.GroupInfo{JoinReason: "invite", Sender: &carolLID, Join: []types.JID{carolLID}},
			stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_INVITE, carolLID.String(), carolLID.String())},
		{"a promotion", events.GroupInfo{Sender: &selfLID, Promote: []types.JID{annLID}},
			stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_PROMOTE, selfLID.String(), annLID.String())},
		{"a demotion", events.GroupInfo{Sender: &selfLID, Demote: []types.JID{annLID}},
			stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_DEMOTE, selfLID.String(), annLID.String())},
		{"a title", events.GroupInfo{Sender: &annLID, Name: &types.GroupName{Name: "Reading club"}},
			stub(waWeb.WebMessageInfo_GROUP_CHANGE_SUBJECT, annLID.String(), "Reading club")},
	}
	for _, tc := range cases {
		tc.live.JID, tc.live.Timestamp = group, sentAt
		live := c.groupChanges(&tc.live)
		pushed, ok := c.stubEvent(group, tc.web, known{})
		if !ok || len(live) != 1 {
			t.Fatalf("%s: live %+v, pushed %+v", tc.name, live, pushed)
		}
		if one, other := mustJSON(t, live[0]), mustJSON(t, pushed); one != other {
			t.Errorf("%s:\n live   %s\n pushed %s", tc.name, one, other)
		}
	}
}

func TestStubWithoutAnActorStillMaps(t *testing.T) {
	c := testConverter()
	got, ok := c.stubEvent(group, stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_ADD, "", carolLID.String()), known{})
	if !ok || got.Event != "join" || got.By != nil || got.ByName != nil {
		t.Errorf("got %+v", got)
	}
	if got, _ := c.stubEvent(group, stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_REMOVE, "", carolLID.String()), known{}); got.Event != "remove" {
		t.Errorf("a removal with no actor is still a removal: got %+v", got)
	}
}

func TestStubsThatAreNoChangeAreLeftOut(t *testing.T) {
	c := testConverter()
	for name, web := range map[string]*waWeb.WebMessageInfo{
		"another stub":          stub(waWeb.WebMessageInfo_GROUP_CREATE, annLID.String(), "Book club"),
		"no person":             stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_ADD, annLID.String(), "not a jid"),
		"a title with no title": stub(waWeb.WebMessageInfo_GROUP_CHANGE_SUBJECT, annLID.String()),
		"an ordinary message":   {Key: &waCommon.MessageKey{ID: proto.String("3EB0S2")}},
	} {
		if got, ok := c.stubEvent(group, web, known{}); ok {
			t.Errorf("%s: got %+v", name, got)
		}
	}
	if _, ok := c.stubEvent(annLID, stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_ADD, "", carolLID.String()), known{}); ok {
		t.Error("a one-to-one chat has no group events")
	}
}

func TestHistoryCarriesTheGroupsEventsAndNoMessageForThem(t *testing.T) {
	data := &waHistorySync.HistorySync{
		SyncType: waHistorySync.HistorySync_RECENT.Enum(),
		PhoneNumberToLidMappings: []*waHistorySync.PhoneNumberToLIDMapping{
			{PnJID: proto.String(annPN.String()), LidJID: proto.String(annLID.String())},
		},
		Conversations: []*waHistorySync.Conversation{{
			ID: proto.String(group.String()),
			Messages: []*waHistorySync.HistorySyncMsg{
				{Message: stub(waWeb.WebMessageInfo_GROUP_PARTICIPANT_PROMOTE, selfLID.String(), annPN.String())},
			},
		}},
	}
	history := testConverter().history(data, func(types.JID, *waWeb.WebMessageInfo) (*events.Message, error) {
		t.Fatal("a service message is not parsed as a message")
		return nil, nil
	})
	if len(history.Messages) != 0 || len(history.Events) != 1 {
		t.Fatalf("got %+v", history)
	}
	if event := history.Events[0]; event.Event != "promote" || event.People[0].JID != annLID.String() {
		t.Errorf("got %+v", event)
	}
}

func TestChatEventsTravelInTheirOwnField(t *testing.T) {
	if got := fieldOf("chat_event"); got != "change" {
		t.Errorf("got %s", got)
	}
}

func mustJSON(t *testing.T, value any) string {
	t.Helper()
	out, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(out)
}
