package main

import (
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

var (
	selfLID  = types.NewJID("100000000000001", types.HiddenUserServer)
	selfPN   = types.NewJID("71234567890", types.DefaultUserServer)
	annLID   = types.NewJID("100000000000002", types.HiddenUserServer)
	annPN    = types.NewJID("71234567891", types.DefaultUserServer)
	bobPN    = types.NewJID("71234567892", types.DefaultUserServer)
	group    = types.NewJID("120363000000000001", types.GroupServer)
	sentAt   = time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	stored   = map[string]types.JID{} // what whatsmeow's LID store would answer
	contacts = map[types.JID]string{annLID: "Ann Lee"}
)

func testConverter() *converter {
	return &converter{
		self:   selfLID,
		selfPN: selfPN,
		lidFor: func(pn types.JID) (types.JID, bool) { lid, ok := stored[pn.User]; return lid, ok },
		nameOf: func(user types.JID) string { return contacts[user] },
	}
}

func text(s string) *waE2E.Message { return &waE2E.Message{Conversation: proto.String(s)} }

func incoming(chat, sender types.JID, content *waE2E.Message) *events.Message {
	return &events.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{Chat: chat, Sender: sender, IsGroup: chat.Server == types.GroupServer},
			ID:            "3EB0000000000000000001",
			Timestamp:     sentAt,
		},
		Message: content,
	}
}

func TestCanonicalPrefersTheLID(t *testing.T) {
	c := testConverter()
	cases := []struct {
		name string
		in   types.JID
		k    known
		want types.JID
	}{
		{"the account's own phone form is its LID", selfPN, nil, selfLID},
		{"a mapping the batch carries", annPN, known{annPN.User: annLID}, annLID},
		{"a device part is dropped", types.JID{User: annLID.User, Server: types.HiddenUserServer, Device: 3}, nil, annLID},
		{"a phone with no LID anywhere stays as it is", bobPN, nil, bobPN},
		{"a group is untouched", group, nil, group},
		{"the legacy c.us server reads as a phone", types.NewJID(bobPN.User, types.LegacyUserServer), nil, bobPN},
	}
	for _, tc := range cases {
		if got := c.canonical(tc.in, tc.k); got != tc.want {
			t.Errorf("%s: got %s, want %s", tc.name, got, tc.want)
		}
	}
	stored[bobPN.User] = types.NewJID("100000000000003", types.HiddenUserServer)
	defer delete(stored, bobPN.User)
	if got := c.canonical(bobPN, nil); got.Server != types.HiddenUserServer {
		t.Errorf("the LID store's answer is used, got %s", got)
	}
}

func TestNameNeverAPhoneNumber(t *testing.T) {
	if got := name("", "+7 905 123-45-67", "Ann"); got == nil || *got != "Ann" {
		t.Errorf("got %v", got)
	}
	if got := name("+1∙∙∙∙∙∙∙∙80"); got != nil {
		t.Errorf("a redacted phone is not a name, got %q", *got)
	}
}

func TestMessageFromAPhoneSenderLandsInTheLIDChat(t *testing.T) {
	evt := incoming(annPN, annPN, text("hi"))
	evt.Info.SenderAlt = annLID
	changed, ok := testConverter().message(evt, nil)
	if !ok || changed.kind != "message" {
		t.Fatalf("got %+v %v", changed, ok)
	}
	m := changed.message
	if m.Chat != annLID.String() || *m.Sender != annLID.String() || m.Text != "hi" {
		t.Errorf("got %+v", m)
	}
	if m.Timestamp != "2026-09-01T10:00:00.000Z" || *m.SenderName != "Ann Lee" {
		t.Errorf("got %+v", m)
	}
}

func TestOwnMessageIsSentByTheAccountLID(t *testing.T) {
	evt := incoming(annLID, selfPN, text("yes"))
	evt.Info.IsFromMe = true
	changed, _ := testConverter().message(evt, nil)
	if !changed.message.FromMe || *changed.message.Sender != selfLID.String() || changed.message.SenderName != nil {
		t.Errorf("got %+v", changed.message)
	}
}

func TestRevokeAndEditBecomeChangesToTheOriginal(t *testing.T) {
	revoke := incoming(group, annLID, &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{
		Type: waE2E.ProtocolMessage_REVOKE.Enum(),
		Key:  &waCommon.MessageKey{ID: proto.String("3EB0ORIGINAL")},
	}})
	changed, ok := testConverter().message(revoke, nil)
	if !ok || changed.kind != "delete" || changed.message.ID != "3EB0ORIGINAL" || changed.message.Chat != group.String() {
		t.Errorf("revoke: got %+v %v", changed, ok)
	}

	edit := incoming(group, annLID, &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{
		Type:          waE2E.ProtocolMessage_MESSAGE_EDIT.Enum(),
		Key:           &waCommon.MessageKey{ID: proto.String("3EB0ORIGINAL")},
		EditedMessage: text("fixed"),
	}})
	changed, ok = testConverter().message(edit, nil)
	if !ok || changed.kind != "edit" || changed.message.Text != "fixed" || changed.message.EditedAt == nil {
		t.Errorf("edit: got %+v %v", changed, ok)
	}
}

func TestWhatIsNotAMessageIsSkipped(t *testing.T) {
	reaction := &waE2E.Message{ReactionMessage: &waE2E.ReactionMessage{Text: proto.String("👍")}}
	for name, evt := range map[string]*events.Message{
		"a status":   incoming(types.StatusBroadcastJID, annLID, text("story")),
		"a reaction": incoming(annLID, annLID, reaction),
	} {
		if _, ok := testConverter().message(evt, nil); ok {
			t.Errorf("%s was kept", name)
		}
	}
}

func TestCaptionAndReplyAreKept(t *testing.T) {
	content := &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
		Caption:     proto.String("look"),
		ContextInfo: &waE2E.ContextInfo{StanzaID: proto.String("3EB0QUOTED")},
	}}
	changed, _ := testConverter().message(incoming(annLID, annLID, content), nil)
	if changed.message.Text != "look" || *changed.message.ReplyTo != "3EB0QUOTED" {
		t.Errorf("got %+v", changed.message)
	}
}

func TestHistoryUsesTheBatchMappingForChatsAndMessages(t *testing.T) {
	data := &waHistorySync.HistorySync{
		SyncType: waHistorySync.HistorySync_INITIAL_BOOTSTRAP.Enum(),
		PhoneNumberToLidMappings: []*waHistorySync.PhoneNumberToLIDMapping{
			{PnJID: proto.String(annPN.String()), LidJID: proto.String(annLID.String())},
		},
		Conversations: []*waHistorySync.Conversation{
			{
				ID:                    proto.String(annPN.String()),
				UnreadCount:           proto.Uint32(2),
				ConversationTimestamp: proto.Uint64(uint64(sentAt.Unix())),
				Messages: []*waHistorySync.HistorySyncMsg{
					{Message: &waWeb.WebMessageInfo{Key: &waCommon.MessageKey{ID: proto.String("3EB0H1")}}},
				},
			},
			{ID: proto.String(types.StatusBroadcastJID.String())},
			{ID: proto.String(group.String()), Name: proto.String("Book club")},
		},
		Pushnames: []*waHistorySync.Pushname{{ID: proto.String(annPN.String()), Pushname: proto.String("Ann")}},
	}
	parse := func(chat types.JID, web *waWeb.WebMessageInfo) (*events.Message, error) {
		evt := incoming(chat, chat, text("from history"))
		evt.Info.ID = web.GetKey().GetID()
		return evt, nil
	}
	history := testConverter().history(data, parse)
	if history.Kind != "bootstrap" || len(history.Chats) != 2 {
		t.Fatalf("got %+v", history)
	}
	ann := history.Chats[0]
	if ann.JID != annLID.String() || ann.Kind != "dm" || *ann.Unread != 2 || *ann.Name != "Ann Lee" {
		t.Errorf("chat: got %+v", ann)
	}
	if *ann.LastMessageAt != "2026-09-01T10:00:00.000Z" {
		t.Errorf("chat time: got %v", *ann.LastMessageAt)
	}
	if history.Chats[1].Kind != "group" || *history.Chats[1].Name != "Book club" {
		t.Errorf("group: got %+v", history.Chats[1])
	}
	if len(history.Messages) != 1 || history.Messages[0].Chat != annLID.String() || *history.Messages[0].Sender != annLID.String() {
		t.Errorf("messages: got %+v", history.Messages)
	}
	if len(history.Contacts) != 1 || history.Contacts[0].JID != annLID.String() {
		t.Errorf("contacts: got %+v", history.Contacts)
	}
}

func TestOwnChatIsSelf(t *testing.T) {
	c := testConverter()
	if c.kindOf(c.canonical(selfPN, nil)) != "self" {
		t.Error("the chat with yourself is not self")
	}
}
