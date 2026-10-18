package main

import (
	"testing"

	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

var community = types.NewJID("120363000000000002", types.GroupServer)

func TestAGroupInACommunityNamesItsParent(t *testing.T) {
	info := groupInfo()
	info.LinkedParentJID = community
	assertJSON(t, testConverter().group(info, nil).Chat, `{"jid":"120363000000000001@g.us","name":"Book club",`+
		`"kind":"group","unread":null,"lastMessageAt":null,"participants":3,"parent":"120363000000000002@g.us"}`)
}

func TestACommunityIsMarked(t *testing.T) {
	info := groupInfo()
	info.JID = community
	info.IsParent = true
	assertJSON(t, testConverter().group(info, nil).Chat, `{"jid":"120363000000000002@g.us","name":"Book club",`+
		`"kind":"group","unread":null,"lastMessageAt":null,"participants":3,"parent":null,"community":true}`)
}

func TestALiveReadOfAGroupInNoCommunitySaysItHasNoParent(t *testing.T) {
	assertJSON(t, testConverter().group(groupInfo(), nil).Chat, `{"jid":"120363000000000001@g.us","name":"Book club",`+
		`"kind":"group","unread":null,"lastMessageAt":null,"participants":3,"parent":null}`)
}

func TestAPushedGroupInNoCommunityLeavesTheParentUnsaid(t *testing.T) {
	assertJSON(t, pushedChats(&waHistorySync.Conversation{ID: proto.String(group.String())})[0],
		`{"jid":"120363000000000001@g.us","name":null,"kind":"group","unread":0,`+
			`"lastMessageAt":null,"participants":null,"archived":false,"muted":false}`)
}

func pushedChats(conversations ...*waHistorySync.Conversation) []waChat {
	data := &waHistorySync.HistorySync{Conversations: conversations}
	return testConverter().history(data, func(types.JID, *waWeb.WebMessageInfo) (*events.Message, error) {
		return nil, nil
	}).Chats
}

func TestAPushedGroupNamesItsCommunityAndThePushedCommunityIsMarked(t *testing.T) {
	chats := pushedChats(
		&waHistorySync.Conversation{ID: proto.String(group.String()), ParentGroupID: proto.String(community.String())},
		&waHistorySync.Conversation{ID: proto.String(community.String()), IsParentGroup: proto.Bool(true)},
	)
	assertJSON(t, chats[0], `{"jid":"120363000000000001@g.us","name":null,"kind":"group","unread":0,`+
		`"lastMessageAt":null,"participants":null,"archived":false,"muted":false,"parent":"120363000000000002@g.us"}`)
	assertJSON(t, chats[1], `{"jid":"120363000000000002@g.us","name":null,"kind":"group","unread":0,`+
		`"lastMessageAt":null,"participants":null,"archived":false,"muted":false,"community":true}`)
}

func TestAPushedGroupGivesTheCommunityFieldsALiveReadGives(t *testing.T) {
	info := groupInfo()
	info.LinkedParentJID = community
	live := testConverter().group(info, nil).Chat
	pushed := pushedChats(&waHistorySync.Conversation{ID: proto.String(group.String()),
		ParentGroupID: proto.String(community.String()), IsDefaultSubgroup: proto.Bool(true)})[0]
	if pushed.Parent.IsZero() || pushed.Parent != live.Parent || pushed.Community != live.Community {
		t.Errorf("pushed parent=%v community=%v, live parent=%v community=%v",
			pushed.Parent, pushed.Community, live.Parent, live.Community)
	}
}

func TestOnlyAGroupTakesACommunityAndOnlyAGroupIsOne(t *testing.T) {
	chats := pushedChats(
		&waHistorySync.Conversation{ID: proto.String(annLID.String()), ParentGroupID: proto.String(community.String()),
			IsParentGroup: proto.Bool(true)},
		&waHistorySync.Conversation{ID: proto.String(group.String()), ParentGroupID: proto.String(annLID.String())},
		&waHistorySync.Conversation{ID: proto.String(group.String()), ParentGroupID: proto.String("120363000000000002")},
		&waHistorySync.Conversation{ID: proto.String(group.String())},
	)
	for i, chat := range chats {
		if !chat.Parent.IsZero() || chat.Community {
			t.Errorf("chat %d: parent=%v community=%v", i, chat.Parent, chat.Community)
		}
	}
}
