package main

import (
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// quote is the replied-to message as the CLI's store holds it. Without it a reply carries the id alone, and phones
// show the quote as unavailable.
type quote struct {
	FromMe bool   `json:"fromMe"`
	Sender string `json:"sender,omitempty"`
	Text   string `json:"text"`
}

// replyContext builds a reply as mautrix-whatsapp does (msgconv generateContextInfo): the id, the quoted sender and
// the quoted text.
func (e *engine) replyContext(req request) *waE2E.ContextInfo {
	if req.ReplyTo == "" {
		return nil
	}
	if req.Quote == nil {
		return quoting(req.ReplyTo, types.EmptyJID, nil)
	}
	chat, err := types.ParseJID(req.Chat)
	if err != nil {
		return quoting(req.ReplyTo, types.EmptyJID, nil)
	}
	return quoting(req.ReplyTo, e.quotedSender(chat, *req.Quote), req.Quote)
}

// quotedSender names who sent the quoted message in the form the chat addresses people by: WhatsApp's apps match a
// quote by it, the account's own messages included.
func (e *engine) quotedSender(chat types.JID, q quote) types.JID {
	if q.FromMe {
		phoneForm := chat.Server == types.DefaultUserServer || (chat.Server == types.GroupServer && e.phoneAddressed(chat))
		if phoneForm && !e.conv.selfPN.IsEmpty() {
			return e.conv.selfPN
		}
		return e.conv.self
	}
	t, err := targetOf(request{Chat: chat.String(), Message: "quoted", Sender: q.Sender})
	if err != nil {
		return types.EmptyJID
	}
	return e.participantFor(t).sender
}

func quoting(id string, sender types.JID, q *quote) *waE2E.ContextInfo {
	info := &waE2E.ContextInfo{StanzaID: proto.String(id)}
	if q == nil {
		return info
	}
	if !sender.IsEmpty() {
		info.Participant = proto.String(sender.String())
	}
	info.QuotedMessage = &waE2E.Message{Conversation: proto.String(q.Text)}
	info.QuotedType = waE2E.ContextInfo_EXPLICIT.Enum()
	return info
}
