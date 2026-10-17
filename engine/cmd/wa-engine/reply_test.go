package main

import (
	"testing"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
)

var phoneGroup = types.NewJID("120363000000000002", types.GroupServer)

func replyEngine() *engine {
	return &engine{conv: testConverter(), addressing: map[types.JID]types.AddressingMode{
		group:      types.AddressingModeLID,
		phoneGroup: types.AddressingModePN,
	}}
}

func TestAReplyNamesTheQuotedSenderAndText(t *testing.T) {
	cases := []struct {
		name  string
		chat  types.JID
		quote quote
		want  types.JID
	}{
		{"someone else's message in a group", group, quote{Sender: annLID.String(), Text: "synthetic"}, annLID},
		{"the account's own message in a group", group, quote{FromMe: true, Text: "synthetic"}, selfLID},
		{"the account's own message in a group addressed by phone", phoneGroup, quote{FromMe: true}, selfPN},
		{"the other person in a one-to-one chat", annLID, quote{Text: "synthetic"}, annLID},
		{"the account's own message in a one-to-one chat", annLID, quote{FromMe: true}, selfLID},
		{"the account's own message in a chat kept in phone form", annPN, quote{FromMe: true}, selfPN},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			q := tc.quote
			info := replyEngine().replyContext(request{Chat: tc.chat.String(), ReplyTo: "3EB0A1", Quote: &q})
			if info.GetStanzaID() != "3EB0A1" || info.GetParticipant() != tc.want.String() {
				t.Fatalf("got %q from %q, want 3EB0A1 from %v", info.GetStanzaID(), info.GetParticipant(), tc.want)
			}
			if info.GetQuotedMessage().GetConversation() != q.Text || info.GetQuotedType() != waE2E.ContextInfo_EXPLICIT {
				t.Fatalf("got quoted %v", info.GetQuotedMessage())
			}
		})
	}
}

func TestAReplyToAMessageNotStoredCarriesItsIdAlone(t *testing.T) {
	info := replyEngine().replyContext(request{Chat: group.String(), ReplyTo: "3EB0A1"})
	if info.GetStanzaID() != "3EB0A1" || info.Participant != nil || info.QuotedMessage != nil {
		t.Fatalf("got %v", info)
	}
	if replyEngine().replyContext(request{Chat: group.String()}) != nil {
		t.Fatal("a message that answers nothing has no reply context")
	}
}
