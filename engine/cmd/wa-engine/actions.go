package main

import (
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// target is a message the account already has, addressed the way whatsmeow builds a message key: the chat, the id,
// and who sent it. An empty sender means the account's own message.
type target struct {
	chat   types.JID
	id     string
	sender types.JID
}

// targetOf reads the key the CLI sends. whatsmeow keeps no messages, so whether the message is the account's own
// and who sent it come from the CLI's store; a wrong one makes WhatsApp drop the reaction or deletion silently.
func targetOf(req request) (target, error) {
	chat, err := types.ParseJID(req.Chat)
	if err != nil || chat.User == "" {
		return target{}, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if req.Message == "" {
		return target{}, &failure{"validation_error", "a message id is needed"}
	}
	t := target{chat: chat, id: req.Message}
	if req.FromMe {
		return t, nil
	}
	if req.Sender != "" {
		sender, err := types.ParseJID(req.Sender)
		if err != nil || sender.User == "" {
			return target{}, &failure{"validation_error", "not a WhatsApp sender id"}
		}
		t.sender = sender.ToNonAD()
		return t, nil
	}
	if chat.Server == types.HiddenUserServer || chat.Server == types.DefaultUserServer {
		t.sender = chat
		return t, nil
	}
	return target{}, &failure{"validation_error", "the message's sender is not known"}
}

func (t target) mine() bool { return t.sender.IsEmpty() }

func (t target) inGroup() bool { return t.chat.Server == types.GroupServer }

// participantFor names a group sender in the form the group addresses its members by. The store keeps LIDs; a group
// still in phone addressing expects the phone JID in a message key and a read receipt.
func (e *engine) participantFor(t target) target {
	if !t.inGroup() || t.mine() || t.sender.Server != types.HiddenUserServer || !e.phoneAddressed(t.chat) {
		return t
	}
	if pn, err := e.client.Store.LIDs.GetPNForLID(e.ctx, t.sender); err == nil && !pn.IsEmpty() {
		t.sender = pn.ToNonAD()
	}
	return t
}

func (e *engine) phoneAddressed(group types.JID) bool {
	e.mu.Lock()
	mode, seen := e.addressing[group]
	e.mu.Unlock()
	if !seen {
		info, err := e.client.GetGroupInfo(e.ctx, group)
		if err != nil {
			return false
		}
		mode = info.AddressingMode
		e.mu.Lock()
		e.addressing[group] = mode
		e.mu.Unlock()
	}
	return mode == types.AddressingModePN
}

func (e *engine) edit(req request) (*waMessage, error) {
	t, err := targetOf(req)
	if err != nil {
		return nil, err
	}
	if !t.mine() {
		return nil, &failure{"validation_error", "only your own messages can be edited"}
	}
	if req.Text == "" {
		return nil, &failure{"validation_error", "an edit needs the new text"}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	sent, err := e.client.SendMessage(e.ctx, t.chat, e.client.BuildEdit(t.chat, t.id, &waE2E.Message{Conversation: proto.String(req.Text)}))
	if err != nil {
		return nil, err
	}
	at := iso(sent.Timestamp)
	message := &waMessage{
		ID:        t.id,
		Chat:      e.conv.canonical(t.chat, nil).String(),
		FromMe:    true,
		Timestamp: at,
		EditedAt:  &at,
		Text:      req.Text,
	}
	if me, _ := e.me(); me != nil {
		message.Sender = &me.JID
		message.SenderName = me.Name
	}
	e.phones.note(e.ctx, message.Chat)
	return message, nil
}

func (e *engine) revoke(req request) error {
	t, err := targetOf(req)
	if err != nil {
		return err
	}
	if !t.mine() && !t.inGroup() {
		return &failure{"permission_error", "only your own messages can be deleted for everyone in a one-to-one chat"}
	}
	if err := e.connect(); err != nil {
		return err
	}
	t = e.participantFor(t)
	_, err = e.client.SendMessage(e.ctx, t.chat, e.client.BuildRevoke(t.chat, t.sender, t.id))
	return err
}

func (e *engine) react(req request) error {
	t, err := targetOf(req)
	if err != nil {
		return err
	}
	if t.chat.Server == types.NewsletterServer {
		return &failure{"validation_error", "reactions in channels are not supported yet"}
	}
	emoji := ""
	if req.Emoji != nil {
		emoji = *req.Emoji
	}
	if err := e.connect(); err != nil {
		return err
	}
	t = e.participantFor(t)
	_, err = e.client.SendMessage(e.ctx, t.chat, e.client.BuildReaction(t.chat, t.sender, t.id, emoji))
	return err
}

// markRead sends a read receipt: the sender sees it. Only a command that asked for it reaches this.
func (e *engine) markRead(req request) error {
	t, err := targetOf(req)
	if err != nil {
		return err
	}
	if t.mine() {
		return &failure{"validation_error", "your own message has no read receipt to send"}
	}
	if err := e.connect(); err != nil {
		return err
	}
	t = e.participantFor(t)
	return e.client.MarkRead(e.ctx, []types.MessageID{t.id}, time.Now(), t.chat, t.sender)
}
