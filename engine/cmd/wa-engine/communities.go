package main

import "go.mau.fi/whatsmeow/types"

// linked says where a group stands in a WhatsApp community: a group in one names it as its parent, and the community
// itself is marked. mautrix-whatsapp reads the same two fields to make a space and its rooms
// (pkg/connector/chatinfo.go, wrapGroupInfo).
func linked(chat waChat, info *types.GroupInfo) waChat {
	if !info.LinkedParentJID.IsEmpty() {
		parent := info.LinkedParentJID.String()
		chat.Parent = &parent
	}
	chat.Community = info.IsParent
	return chat
}
