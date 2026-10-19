package main

import "go.mau.fi/whatsmeow/types"

func (e *engine) dispatchCanonicalChat(req request) (any, bool, error) {
	switch req.Op {
	case "canonicalChat":
		return e.canonicalChat(req.JID), true, nil
	}
	return nil, false, nil
}

// canonicalChat is the id a typed one-to-one chat in phone form has in the store: the one a send to it answers. It
// reads whatsmeow's LID map and wa_phone_chats only, never WhatsApp (NEED-1441), and records nothing: a typed number
// need not be a chat the account has, so it must not reach the paced lookups.
func (e *engine) canonicalChat(typed string) string {
	jid, err := types.ParseJID(typed)
	if err != nil || jid.Server != types.DefaultUserServer || jid.User == "" || jid.Device != 0 {
		return typed
	}
	return e.conv.canonical(jid, nil).String()
}
