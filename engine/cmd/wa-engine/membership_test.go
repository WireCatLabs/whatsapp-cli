package main

import (
	"strings"
	"testing"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

const leftNotice = `{"jid":"120363000000000001@g.us","kind":"group","membershipState":"left"}`

func TestTheOwnerLeavingOrRemovedInEitherFormMarksTheGroupLeft(t *testing.T) {
	c := testConverter()
	for _, owner := range []types.JID{selfLID, selfPN, {User: selfLID.User, Server: types.HiddenUserServer, Device: 3}} {
		for _, by := range []*types.JID{nil, &annLID} {
			notice, ok := c.groupNotice(&events.GroupInfo{JID: group, Sender: by, Leave: []types.JID{annPN, owner}})
			if !ok {
				t.Fatalf("%s: no notice", owner)
			}
			assertJSON(t, notice, leftNotice)
		}
	}
}

func TestADeletedGroupIsLeft(t *testing.T) {
	notice, _ := testConverter().groupNotice(&events.GroupInfo{JID: group, Delete: &types.GroupDelete{Deleted: true}})
	assertJSON(t, notice, leftNotice)
}

func TestSomeoneElsesLeaveAndTheOwnersJoinSayNothing(t *testing.T) {
	c := testConverter()
	for _, evt := range []*events.GroupInfo{
		{JID: group, Join: []types.JID{selfLID}},
		{JID: group, Join: []types.JID{selfPN}},
		{JID: group, Leave: []types.JID{annLID, bobPN}},
		{JID: group, Join: []types.JID{annLID}},
		{JID: group, Sender: &selfLID, Leave: []types.JID{annLID}},
	} {
		if notice, ok := c.groupNotice(evt); ok {
			t.Errorf("made a chat: %+v", notice)
		}
	}
}

func TestALinkAndTheOwnersLeaveInOneNoticeMakeOneChat(t *testing.T) {
	notice, _ := testConverter().groupNotice(&events.GroupInfo{JID: group, Leave: []types.JID{selfLID},
		Unlink: &types.GroupLinkChange{Type: types.GroupLinkChangeTypeParent},
	})
	assertJSON(t, notice, `{"jid":"120363000000000001@g.us","kind":"group","parent":null,"membershipState":"left"}`)
}

func TestAFullChatLeavesTheMembershipUnsaid(t *testing.T) {
	count := 3
	assertJSON(t, waChat{JID: group.String(), Kind: "group", Participants: &count},
		`{"jid":"120363000000000001@g.us","name":null,"kind":"group","participants":3}`)
}

func TestTheNoticeThatTheOwnerWasAddedPushesTheWholeGroupWithMembershipUnsaid(t *testing.T) {
	e, out := followingEngine(&fakeFollows{})
	e.conv = testConverter()
	e.handle(&events.JoinedGroup{GroupInfo: *groupInfo()})
	want := `{"event":"history","history":{"kind":"other","chats":[{"jid":"120363000000000001@g.us",` +
		`"name":"Book club","kind":"group","participants":3,"parent":null}],` +
		`"contacts":[],"messages":[],"votes":[]}}`
	if got := out.next(t); got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
}

func TestTheOwnersLeaveIsPushedAsAChatAndNotRemembered(t *testing.T) {
	e, out := followingEngine(&fakeFollows{})
	e.conv = testConverter()
	e.chats = map[string]waChat{}
	e.handle(&events.GroupInfo{JID: group, Leave: []types.JID{selfLID}})
	if got := out.next(t); !strings.HasSuffix(got, `"event":"chat_event"}`) {
		t.Fatalf("first line %s", got)
	}
	want := `{"event":"history","history":{"kind":"other","chats":[` + leftNotice +
		`],"contacts":[],"messages":[],"votes":[]}}`
	if got := out.next(t); got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
	if len(e.chats) != 0 {
		t.Fatal("the notice was remembered as the group's chat")
	}
}
