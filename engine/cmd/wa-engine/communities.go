package main

import (
	"encoding/json"

	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// linked says where a group stands in a WhatsApp community: a group in one names it as its parent, and the community
// itself is marked. mautrix-whatsapp reads the same two fields to make a space and its rooms
// (pkg/connector/chatinfo.go, wrapGroupInfo).
// A live read of one group is the one source that says a group is in no community, so only it sends the parent as
// null.
func linked(chat waChat, info *types.GroupInfo) waChat {
	chat.Parent = parentField{said: true}
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

// listedLinked leaves out a parent the joined-groups list does not name: that list asks WhatsApp for members and
// descriptions only, so its silence is no proof, and mautrix-whatsapp too clears a parent only on an unlink
// notification (pkg/connector/chatinfo.go, wrapGroupInfoChange).
func listedLinked(chat waChat) waChat {
	if chat.Parent.jid == "" {
		chat.Parent = parentField{}
	}
	return chat
}

func inCommunity(chat waChat, parent types.JID, isParent bool) waChat {
	if !parent.IsEmpty() {
		chat.Parent = parentField{said: true, jid: parent.String()}
	}
	chat.Community = isParent
	return chat
}

// parentField is left out when the source did not say, and null when it said the group is in no community: the store
// keeps the parent it holds for the first and clears it for the second.
type parentField struct {
	said bool
	jid  string
}

func (p parentField) IsZero() bool { return !p.said }

// unlinked reads WhatsApp's notice that a group left its community, or that the community was deleted, from the
// group's own notice, as mautrix-whatsapp does (pkg/connector/chatinfo.go, wrapGroupInfoChange). The community's side
// names the group instead; it is left alone, so a member of the community only is not given a chat it is not in.
func unlinked(evt *events.GroupInfo) (waChat, bool) {
	if evt.Unlink == nil || evt.Unlink.Type == types.GroupLinkChangeTypeSub || evt.JID.Server != types.GroupServer {
		return waChat{}, false
	}
	return waChat{JID: evt.JID.String(), Kind: "group", Parent: parentField{said: true}, notice: true}, true
}

// MarshalJSON gives a notice only what it says, so the store keeps the group's name, count and activity.
func (c waChat) MarshalJSON() ([]byte, error) {
	type full waChat
	if !c.notice {
		return json.Marshal(full(c))
	}
	return json.Marshal(struct {
		JID    string      `json:"jid"`
		Kind   string      `json:"kind"`
		Parent parentField `json:"parent"`
	}{c.JID, c.Kind, c.Parent})
}

func (p parentField) MarshalJSON() ([]byte, error) {
	if p.jid == "" {
		return []byte("null"), nil
	}
	return json.Marshal(p.jid)
}
