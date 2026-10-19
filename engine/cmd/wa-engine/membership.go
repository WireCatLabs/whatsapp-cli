package main

import (
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// The two memberships the engine says, only from WhatsApp's notices. "member" takes a "left" mark off and keeps
// "archived" (cli-core 0.357.0); cli-core's null would clear both, so the engine never sends it.
const (
	leftGroup   = "left"
	memberAgain = "member"
)

// isOwner matches the account in either form a group notification names it by: LID, or phone number in a group
// still addressed by phone numbers.
func (c *converter) isOwner(jid types.JID) bool {
	jid = jid.ToNonAD()
	if !c.self.IsEmpty() && jid == c.self {
		return true
	}
	if jid.Server == types.LegacyUserServer {
		jid.Server = types.DefaultUserServer
	}
	return !c.selfPN.IsEmpty() && jid.Server == types.DefaultUserServer && jid.User == c.selfPN.User
}

// ownLeave reads whether a group notification says the owner is out: the group was deleted, or the owner is among
// those who left or were removed. Anyone else's leave says nothing of the owner.
func (c *converter) ownLeave(evt *events.GroupInfo) bool {
	if evt.JID.Server != types.GroupServer {
		return false
	}
	if evt.Delete != nil {
		return true
	}
	for _, jid := range evt.Leave {
		if c.isOwner(jid) {
			return true
		}
	}
	return false
}

// ownJoin reads whether a group notification says the owner was added back.
func (c *converter) ownJoin(evt *events.GroupInfo) bool {
	if evt.JID.Server != types.GroupServer {
		return false
	}
	for _, jid := range evt.Join {
		if c.isOwner(jid) {
			return true
		}
	}
	return false
}

// groupNotice is the one chat a group notification pushes: its community link and the owner's leave or re-add,
// whichever it carries, and nothing else, so the store keeps the group's name, count and activity. A leave wins over
// a join in the same notice.
func (c *converter) groupNotice(evt *events.GroupInfo) (waChat, bool) {
	notice, linkChanged := linkNotice(evt)
	membership := ""
	if c.ownLeave(evt) {
		membership = leftGroup
	} else if c.ownJoin(evt) {
		membership = memberAgain
	}
	if membership == "" {
		return notice, linkChanged
	}
	if !linkChanged {
		notice = waChat{JID: evt.JID.String(), Kind: "group", notice: true}
	}
	notice.Membership = membership
	return notice, true
}

// joined is the chat WhatsApp's notice that the owner was added to a group, or created one, gives: the group's whole
// info, so the store gets the group in full, and a group the owner had left is a member's again.
func (c *converter) joined(evt *events.JoinedGroup) (waChat, bool) {
	if evt.JID.Server != types.GroupServer {
		return waChat{}, false
	}
	chat := c.group(&evt.GroupInfo, nil).Chat
	chat.Membership = memberAgain
	return chat, true
}
