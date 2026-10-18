package main

import (
	"fmt"
	"slices"
	"strings"
	"testing"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/types"
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
