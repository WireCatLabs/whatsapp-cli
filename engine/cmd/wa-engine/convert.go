package main

import (
	"regexp"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// converter turns whatsmeow's types into the contract's. Every one-to-one chat and person comes out in LID form when
// WhatsApp has a LID for the user: cli-core cannot merge two stored chats, so the id is decided here, once
// (cli-private plans/2026-10-16-whatsapp-foundation.md, decision 3).
type converter struct {
	self   types.JID // the account's LID, no device part
	selfPN types.JID
	lidFor func(pn types.JID) (types.JID, bool)
	nameOf func(user types.JID) string
}

// known maps a phone number's user part to its LID, for what one batch or one message says itself.
type known map[string]types.JID

func (k known) add(pn, lid types.JID) {
	if pn.Server == types.LegacyUserServer {
		pn.Server = types.DefaultUserServer
	}
	if pn.Server == types.DefaultUserServer && lid.Server == types.HiddenUserServer {
		k[pn.User] = lid.ToNonAD()
	}
}

func (c *converter) canonical(jid types.JID, k known) types.JID {
	jid = jid.ToNonAD()
	if jid.Server == types.LegacyUserServer {
		jid.Server = types.DefaultUserServer
	}
	if jid.Server != types.DefaultUserServer {
		return jid
	}
	if !c.selfPN.IsEmpty() && jid.User == c.selfPN.User && !c.self.IsEmpty() {
		return c.self
	}
	if lid, ok := k[jid.User]; ok {
		return lid
	}
	if lid, ok := c.lidFor(jid); ok {
		return lid.ToNonAD()
	}
	return jid
}

func (c *converter) kindOf(jid types.JID) string {
	switch jid.Server {
	case types.GroupServer:
		return "group"
	case types.NewsletterServer:
		return "newsletter"
	case types.BroadcastServer:
		return "broadcast"
	}
	if jid == c.self {
		return "self"
	}
	return "dm"
}

var phoneLike = regexp.MustCompile(`^[+\d\s().\-∙]+$`)

// name keeps a phone number out of every name field: WhatsApp shows one where nobody set a name.
func name(values ...string) *string {
	for _, value := range values {
		if value != "" && !phoneLike.MatchString(value) {
			return &value
		}
	}
	return nil
}

func iso(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

func isoPtr(t time.Time) *string {
	if t.IsZero() {
		return nil
	}
	s := iso(t)
	return &s
}

func str(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// textOf says what a message shows as text, and whether it is a message at all: a reaction, a key exchange or a
// receipt-like protocol message is not.
func textOf(m *waE2E.Message) (string, bool) {
	switch {
	case m == nil:
		return "", false
	case m.Conversation != nil:
		return m.GetConversation(), true
	case m.ExtendedTextMessage != nil:
		return m.GetExtendedTextMessage().GetText(), true
	case m.ImageMessage != nil:
		return m.GetImageMessage().GetCaption(), true
	case m.VideoMessage != nil:
		return m.GetVideoMessage().GetCaption(), true
	case m.DocumentMessage != nil:
		return m.GetDocumentMessage().GetCaption(), true
	case pollCreationOf(m) != nil:
		return pollCreationOf(m).GetName(), true
	case m.AudioMessage != nil, m.PtvMessage != nil, m.StickerMessage != nil, m.LocationMessage != nil, m.LiveLocationMessage != nil,
		m.ContactMessage != nil, m.ContactsArrayMessage != nil:
		return "", true
	}
	return "", false
}

func replyOf(m *waE2E.Message) *string {
	var info *waE2E.ContextInfo
	switch {
	case m.ExtendedTextMessage != nil:
		info = m.GetExtendedTextMessage().GetContextInfo()
	case m.ImageMessage != nil:
		info = m.GetImageMessage().GetContextInfo()
	case m.VideoMessage != nil:
		info = m.GetVideoMessage().GetContextInfo()
	case m.DocumentMessage != nil:
		info = m.GetDocumentMessage().GetContextInfo()
	case m.AudioMessage != nil:
		info = m.GetAudioMessage().GetContextInfo()
	case m.StickerMessage != nil:
		info = m.GetStickerMessage().GetContextInfo()
	}
	return str(info.GetStanzaID())
}

// change is what one whatsmeow message means for the store: a new message, an edit of an older one, or a deletion.
type change struct {
	kind    string // "message", "edit", "delete"
	message waMessage
}

func (c *converter) message(evt *events.Message, k known) (change, bool) {
	info := evt.Info
	if info.Chat == types.StatusBroadcastJID {
		return change{}, false
	}
	if k == nil {
		k = known{}
	}
	k.add(info.Sender, info.SenderAlt)
	k.add(info.SenderAlt, info.Sender)
	if !info.IsGroup {
		k.add(info.Chat, info.RecipientAlt)
		k.add(info.RecipientAlt, info.Chat)
	}
	chat := c.canonical(info.Chat, k).String()

	out := waMessage{
		ID:        info.ID,
		Chat:      chat,
		FromMe:    info.IsFromMe,
		Timestamp: iso(info.Timestamp),
	}
	if info.IsFromMe {
		if !c.self.IsEmpty() {
			out.Sender = str(c.self.String())
		}
	} else {
		sender := c.canonical(info.Sender, k)
		out.Sender = str(sender.String())
		out.SenderName = name(info.PushName, c.nameOf(sender))
	}

	content := evt.Message
	if protocol := content.GetProtocolMessage(); protocol != nil {
		switch protocol.GetType() {
		case waE2E.ProtocolMessage_REVOKE:
			out.ID = protocol.GetKey().GetID()
			return change{"delete", out}, out.ID != ""
		case waE2E.ProtocolMessage_MESSAGE_EDIT:
			text, ok := textOf(protocol.GetEditedMessage())
			if !ok {
				return change{}, false
			}
			out.ID = protocol.GetKey().GetID()
			out.Text = text
			out.EditedAt = str(iso(info.Timestamp))
			return change{"edit", out}, out.ID != ""
		}
		return change{}, false
	}
	text, ok := textOf(content)
	if !ok {
		return change{}, false
	}
	out.Text = text
	out.ReplyTo = replyOf(content)
	out.Attachments = attachmentsOf(content)
	out.Poll = pollOf(pollCreationOf(content))
	if evt.IsViewOnce {
		// WhatsApp's apps neither save nor forward a view-once file; without its keys, wa cannot either.
		for i := range out.Attachments {
			out.Attachments[i].Ref = nil
		}
	}
	return change{"message", out}, true
}

var syncKinds = map[waHistorySync.HistorySync_HistorySyncType]string{
	waHistorySync.HistorySync_INITIAL_BOOTSTRAP: "bootstrap",
	waHistorySync.HistorySync_RECENT:            "recent",
	waHistorySync.HistorySync_FULL:              "full",
	waHistorySync.HistorySync_ON_DEMAND:         "on_demand",
	waHistorySync.HistorySync_PUSH_NAME:         "push_name",
}

type parseWeb func(chat types.JID, message *waWeb.WebMessageInfo) (*events.Message, error)

func (c *converter) history(data *waHistorySync.HistorySync, parse parseWeb) waHistory {
	kind, ok := syncKinds[data.GetSyncType()]
	if !ok {
		kind = "other"
	}
	k := known{}
	out := waHistory{Kind: kind, Chats: []waChat{}, Contacts: []waContact{}, Messages: []waMessage{}, Votes: []waVote{}, oldest: map[string]rawKey{}, learned: k}

	for _, mapping := range data.GetPhoneNumberToLidMappings() {
		pn, err1 := types.ParseJID(mapping.GetPnJID())
		lid, err2 := types.ParseJID(mapping.GetLidJID())
		if err1 == nil && err2 == nil {
			k.add(pn, lid)
		}
	}
	for _, conv := range data.GetConversations() {
		raw, err := types.ParseJID(conv.GetID())
		if err != nil {
			continue
		}
		if lid, err := types.ParseJID(conv.GetLidJID()); err == nil {
			k.add(raw, lid)
		}
		if pn, err := types.ParseJID(conv.GetPnJID()); err == nil {
			k.add(pn, raw)
		}
	}

	now := time.Now()
	for _, conv := range data.GetConversations() {
		raw, err := types.ParseJID(conv.GetID())
		if err != nil || raw == types.StatusBroadcastJID {
			continue
		}
		jid := c.canonical(raw, k)
		chat := waChat{
			JID:           jid.String(),
			Name:          name(conv.GetName(), conv.GetDisplayName(), c.nameOf(jid)),
			Kind:          c.kindOf(jid),
			LastMessageAt: isoPtr(fromUnix(conv.GetConversationTimestamp())),
		}
		unread := int(conv.GetUnreadCount())
		chat.Unread = &unread
		if count := len(conv.GetParticipant()); count > 0 {
			chat.Participants = &count
		}
		archived := conv.GetArchived()
		chat.Archived = &archived
		muted := mutedAt(conv.GetMuteEndTime(), now)
		chat.Muted = &muted
		out.Chats = append(out.Chats, chat)

		for _, item := range conv.GetMessages() {
			out.noteOldest(chat.JID, item.GetMessage())
			if event, ok := c.stubEvent(raw, item.GetMessage(), k); ok {
				out.Events = append(out.Events, event)
				continue
			}
			evt, err := parse(raw, item.GetMessage())
			if err != nil {
				continue
			}
			changed, ok := c.message(evt, k)
			if !ok || changed.kind != "message" {
				continue
			}
			changed.message.Chat = chat.JID
			if item.GetMessage().GetStarred() {
				starred := true
				changed.message.Starred = &starred
			}
			out.Messages = append(out.Messages, changed.message)
			if changed.message.Poll != nil {
				out.Votes = append(out.Votes, c.historyVotes(changed.message, item.GetMessage(), k)...)
			}
		}
	}
	for _, pushName := range data.GetPushnames() {
		raw, err := types.ParseJID(pushName.GetID())
		if err != nil {
			continue
		}
		if shown := name(pushName.GetPushname()); shown != nil {
			out.Contacts = append(out.Contacts, waContact{JID: c.canonical(raw, k).String(), Name: shown})
		}
	}
	return out
}

// muteHorizon is whatsmeow's own "muted forever", the end of year 9999. A mute for good is -1 in app state and this
// history field is unsigned, so it probably arrives as all ones, which the int64 cast in fromUnix turns back into
// -1, a time in 1969.
var muteHorizon = uint64(store.MutedForever.Unix())

func mutedAt(end uint64, now time.Time) bool {
	if end == 0 {
		return false
	}
	return end > muteHorizon || fromUnix(end).After(now)
}

func fromUnix(seconds uint64) time.Time {
	if seconds == 0 {
		return time.Time{}
	}
	return time.Unix(int64(seconds), 0)
}
