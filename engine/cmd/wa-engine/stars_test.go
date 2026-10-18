package main

import (
	"bytes"
	"fmt"
	"slices"
	"strings"
	"testing"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

// Pinned against WhatsApp Web's WAWebStarMessageSync and constructMsgKeySegmentsFromMsgKey, whatsapp-rust's STAR
// schema and Cobalt's StarActionArgs.
func TestAStarIsThePatchWhatsAppWebWrites(t *testing.T) {
	cases := []struct {
		name        string
		target      target
		fromMe      string
		participant string
	}{
		{"someone else's message in a group names its sender", target{chat: group, id: "3EB0A1", sender: annLID}, "0", annLID.String()},
		{"a device part is not part of the sender", target{chat: group, id: "3EB0A1", sender: types.NewADJID(annPN.User, 0, 7)}, "0", annPN.String()},
		{"the account's own message in a group names nobody", target{chat: group, id: "3EB0A1"}, "1", "0"},
		{"the other person's message in a one-to-one chat names nobody", target{chat: annLID, id: "3EB0A1", sender: annLID}, "0", "0"},
		{"a one-to-one chat under a LID with a phone sender names nobody", target{chat: annLID, id: "3EB0A1", sender: annPN}, "0", "0"},
		{"the account's own message in a one-to-one chat", target{chat: annLID, id: "3EB0A1"}, "1", "0"},
	}
	for _, tc := range cases {
		for _, starred := range []bool{true, false} {
			t.Run(fmt.Sprintf("%s, starred %v", tc.name, starred), func(t *testing.T) {
				patch := buildStar(tc.target, starred)
				if patch.Type != appstate.WAPatchRegularHigh || len(patch.Mutations) != 1 {
					t.Fatalf("got a %s patch of %d mutations", patch.Type, len(patch.Mutations))
				}
				mutation := patch.Mutations[0]
				want := []string{"star", tc.target.chat.String(), "3EB0A1", tc.fromMe, tc.participant}
				if !slices.Equal(mutation.Index, want) {
					t.Errorf("index %v, want %v", mutation.Index, want)
				}
				if mutation.Version != 2 {
					t.Errorf("version %d, want 2", mutation.Version)
				}
				action := mutation.Value.GetStarAction()
				if action.Starred == nil || action.GetStarred() != starred {
					t.Errorf("starred %v, want a %v that is set: WhatsApp Web drops a star action without it", action.Starred, starred)
				}
			})
		}
	}
}

func TestAStarIsRefusedBeforeConnecting(t *testing.T) {
	on := true
	cases := map[string]request{
		"a channel's post":     {Chat: "120363000000000002@newsletter", Message: "3EB0A1", settingsFields: settingsFields{Starred: &on}},
		"a broadcast":          {Chat: "status@broadcast", Message: "3EB0A1", settingsFields: settingsFields{Starred: &on}},
		"no word on which way": {Chat: annLID.String(), Message: "3EB0A1", FromMe: true},
		"no message":           {Chat: annLID.String(), settingsFields: settingsFields{Starred: &on}},
	}
	for name, req := range cases {
		if err := (&engine{}).star(req); !isFailure(err, "validation_error") {
			t.Errorf("%s: got %v, want a validation_error", name, err)
		}
	}
	err := (&engine{}).star(cases["a channel's post"])
	if err == nil || !strings.Contains(err.Error(), "on the phone") {
		t.Errorf("a channel's post: got %v, want the channel refusal, not a missing sender", err)
	}
}

func TestAStarMadeOnAnotherDeviceGoesOutUnderTheStoredChat(t *testing.T) {
	stored[annPN.User] = annLID
	defer delete(stored, annPN.User)
	cases := []struct {
		event any
		want  string
	}{
		{&events.Star{ChatJID: annPN, MessageID: "3EB0S1", Action: &waSyncAction.StarAction{Starred: proto.Bool(true)}},
			`{"chat":"` + annLID.String() + `","event":"star","id":"3EB0S1","starred":true}`},
		{&events.Star{ChatJID: group, SenderJID: annLID, MessageID: "3EB0S2", Action: &waSyncAction.StarAction{Starred: proto.Bool(false)}},
			`{"chat":"` + group.String() + `","event":"star","id":"3EB0S2","starred":false}`},
		{&events.DeleteForMe{ChatJID: annPN, MessageID: "3EB0D1", IsFromMe: true},
			`{"chat":"` + annLID.String() + `","event":"delete","id":"3EB0D1"}`},
	}
	for _, c := range cases {
		var out bytes.Buffer
		e := &engine{out: newWire(&out), conv: testConverter()}
		e.handle(c.event)
		if got := strings.TrimSpace(out.String()); got != c.want {
			t.Errorf("%+v went out as %s, want %s", c.event, got, c.want)
		}
	}
}

func TestAStarWithoutAWholeKeyIsDropped(t *testing.T) {
	starred := &waSyncAction.StarAction{Starred: proto.Bool(true)}
	for _, evt := range []any{
		&events.Star{ChatJID: annLID, MessageID: "3EB0S1"},
		&events.Star{ChatJID: annLID, Action: starred},
		&events.Star{MessageID: "3EB0S1", Action: starred},
		&events.Star{ChatJID: types.StatusBroadcastJID, MessageID: "3EB0S1", Action: starred},
		&events.DeleteForMe{ChatJID: annLID},
	} {
		var out bytes.Buffer
		e := &engine{out: newWire(&out), conv: testConverter()}
		e.handle(evt)
		if out.Len() > 0 {
			t.Errorf("%+v went out as %s", evt, out.String())
		}
	}
}

func TestAPushedMessageCarriesTheStarOnlyWhenStarred(t *testing.T) {
	data := &waHistorySync.HistorySync{
		SyncType: waHistorySync.HistorySync_INITIAL_BOOTSTRAP.Enum(),
		Conversations: []*waHistorySync.Conversation{{
			ID: proto.String(annLID.String()),
			Messages: []*waHistorySync.HistorySyncMsg{
				{Message: &waWeb.WebMessageInfo{Key: &waCommon.MessageKey{ID: proto.String("3EB0H1")}, Starred: proto.Bool(true)}},
				{Message: &waWeb.WebMessageInfo{Key: &waCommon.MessageKey{ID: proto.String("3EB0H2")}, Starred: proto.Bool(false)}},
			},
		}},
	}
	parse := func(chat types.JID, web *waWeb.WebMessageInfo) (*events.Message, error) {
		evt := incoming(chat, chat, text("from history"))
		evt.Info.ID = web.GetKey().GetID()
		return evt, nil
	}
	messages := testConverter().history(data, parse).Messages
	if len(messages) != 2 || messages[0].Starred == nil || !*messages[0].Starred || messages[1].Starred != nil {
		t.Errorf("got %+v", messages)
	}
}
