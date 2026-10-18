package main

import (
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types"
)

// linked says where a group stands in a WhatsApp community: a group in one names it as its parent, and the community
// itself is marked. mautrix-whatsapp reads the same two fields to make a space and its rooms
// (pkg/connector/chatinfo.go, wrapGroupInfo).
func linked(chat waChat, info *types.GroupInfo) waChat {
	return inCommunity(chat, info.LinkedParentJID, info.IsParent)
}

// pushedLinked reads the same two facts from a history push, the only way the store gets a chat. The third one
// there, IsDefaultSubgroup (the community's announcement group), has no place in what a live read gives either.
func pushedLinked(chat waChat, raw types.JID, conv *waHistorySync.Conversation) waChat {
	if raw.Server != types.GroupServer {
		return chat
	}
	var parent types.JID
	if id, err := types.ParseJID(conv.GetParentGroupID()); err == nil && id.Server == types.GroupServer {
		parent = id
	}
	return inCommunity(chat, parent, conv.GetIsParentGroup())
}

func inCommunity(chat waChat, parent types.JID, isParent bool) waChat {
	if !parent.IsEmpty() {
		id := parent.String()
		chat.Parent = &id
	}
	chat.Community = isParent
	return chat
}
