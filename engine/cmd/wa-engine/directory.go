package main

import (
	"go.mau.fi/whatsmeow/types"
)

func (e *engine) contact(user types.JID) types.ContactInfo {
	if !e.linked() {
		return types.ContactInfo{}
	}
	info, err := e.client.Store.Contacts.GetContact(e.ctx, user)
	if (err != nil || !info.Found) && user.Server == types.HiddenUserServer {
		if pn, err := e.client.Store.LIDs.GetPNForLID(e.ctx, user); err == nil && !pn.IsEmpty() {
			info, _ = e.client.Store.Contacts.GetContact(e.ctx, pn)
		}
	}
	return info
}

func (e *engine) nameOf(user types.JID) string {
	info := e.contact(user)
	if shown := name(info.FullName, info.FirstName, info.BusinessName, info.PushName); shown != nil {
		return *shown
	}
	return ""
}

func (e *engine) remember(chats []waChat) {
	e.mu.Lock()
	defer e.mu.Unlock()
	for _, chat := range chats {
		e.chats[chat.JID] = chat
	}
}

// directory is every chat the engine can name without asking the phone: those pushed in this process, the address
// book, and the joined groups (one request, then kept).
func (e *engine) directory() []waChat {
	e.mu.Lock()
	needGroups := e.groups == nil && e.client.IsConnected()
	e.mu.Unlock()
	if needGroups {
		if groups, err := e.client.GetJoinedGroups(e.ctx); err == nil {
			list := make([]waChat, 0, len(groups))
			for _, group := range groups {
				list = append(list, e.groupChat(group))
			}
			e.mu.Lock()
			e.groups = list
			e.mu.Unlock()
		}
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	byID := map[string]waChat{}
	for _, contact := range e.contacts() {
		byID[contact.JID] = waChat{JID: contact.JID, Name: contact.Name, Kind: e.conv.kindOf(mustJID(contact.JID))}
	}
	for _, group := range e.groups {
		byID[group.JID] = group
	}
	// A chat pushed in phone form may have been re-keyed since; its LID form, if pushed too, wins.
	for id, chat := range e.chats {
		chat.JID = e.conv.canonical(mustJID(id), nil).String()
		if _, twin := e.chats[chat.JID]; twin && chat.JID != id {
			continue
		}
		byID[chat.JID] = chat
	}
	list := make([]waChat, 0, len(byID))
	for _, chat := range byID {
		list = append(list, chat)
	}
	return list
}

func mustJID(s string) types.JID {
	jid, _ := types.ParseJID(s)
	return jid
}

func (e *engine) contacts() []waContact {
	if !e.linked() {
		return []waContact{}
	}
	all, err := e.client.Store.Contacts.GetAllContacts(e.ctx)
	if err != nil {
		return []waContact{}
	}
	byID := map[string]waContact{}
	for jid, info := range all {
		shown := name(info.FullName, info.FirstName, info.BusinessName, info.PushName)
		if shown == nil {
			continue
		}
		id := e.conv.canonical(jid, nil).String()
		if _, seen := byID[id]; !seen || info.FullName != "" {
			byID[id] = waContact{JID: id, Name: shown}
		}
	}
	list := make([]waContact, 0, len(byID))
	for _, contact := range byID {
		list = append(list, contact)
	}
	return list
}

func (e *engine) groupChat(group *types.GroupInfo) waChat {
	count := len(group.Participants)
	return linked(waChat{JID: group.JID.String(), Name: name(group.Name), Kind: "group", Participants: &count}, group)
}

func (e *engine) chat(raw string) (*waChatCard, error) {
	jid, err := types.ParseJID(raw)
	if err != nil {
		return nil, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if jid.Server == types.GroupServer {
		group, err := e.client.GetGroupInfo(e.ctx, jid)
		if err != nil {
			return nil, err
		}
		members := make([]waContact, 0, len(group.Participants))
		for _, participant := range group.Participants {
			id := participant.JID
			if !participant.LID.IsEmpty() {
				id = participant.LID
			}
			id = e.conv.canonical(id, nil)
			members = append(members, waContact{JID: id.String(), Name: name(e.nameOf(id))})
		}
		return &waChatCard{Chat: e.groupChat(group), Members: members}, nil
	}
	jid = e.conv.canonical(jid, nil)
	e.mu.Lock()
	chat, seen := e.chats[jid.String()]
	e.mu.Unlock()
	if !seen {
		chat = waChat{JID: jid.String(), Name: name(e.nameOf(jid)), Kind: e.conv.kindOf(jid)}
	}
	return &waChatCard{Chat: chat}, nil
}
