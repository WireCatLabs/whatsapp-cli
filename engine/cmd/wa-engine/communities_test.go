package main

import (
	"testing"

	"go.mau.fi/whatsmeow/types"
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
		`"kind":"group","unread":null,"lastMessageAt":null,"participants":3,"community":true}`)
}
