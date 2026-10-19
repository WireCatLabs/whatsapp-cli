package main

import (
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// leftGroup is the only membership the engine says. cli-core's null clears any stored state, "archived" too, so a
// rejoin stays unsaid until cli-core has a value that clears "left" alone.
const leftGroup = "left"

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

// groupNotice is the one chat a group notification pushes: its community link and the owner's leave, whichever it
// carries, and nothing else, so the store keeps the group's name, count and activity.
func (c *converter) groupNotice(evt *events.GroupInfo) (waChat, bool) {
	notice, linkChanged := linkNotice(evt)
	if !c.ownLeave(evt) {
		return notice, linkChanged
	}
	if !linkChanged {
		notice = waChat{JID: evt.JID.String(), Kind: "group", notice: true}
	}
	notice.Membership = leftGroup
	return notice, true
}

// joined is the chat WhatsApp's notice that the owner was added to a group, or created one, gives: the group's whole
// info, so the store gets the group in full.
func (c *converter) joined(evt *events.JoinedGroup) (waChat, bool) {
	if evt.JID.Server != types.GroupServer {
		return waChat{}, false
	}
	return c.group(&evt.GroupInfo, nil).Chat, true
}
