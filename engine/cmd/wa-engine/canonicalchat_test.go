package main

import (
	"bytes"
	"reflect"
	"testing"
)

func canonicalEngine(t *testing.T) (*engine, *bytes.Buffer) {
	t.Helper()
	e, out := storedChatsEngine(t, true, mapping("70000000009", "100000000000003"))
	e.conv = &converter{lidFor: e.lidFor, self: selfLID, selfPN: selfPN}
	return e, out
}

func TestCanonicalChatAnswersTheLIDTheMapKnowsAndOtherwiseTheIdAsTyped(t *testing.T) {
	e, _ := canonicalEngine(t)
	for _, c := range []struct{ name, typed, want string }{
		{"a number the map knows", fakePN, "100000000000003@lid"},
		{"a number the map does not know", "70000000008@s.whatsapp.net", "70000000008@s.whatsapp.net"},
		{"the account's own number", selfPN.String(), selfLID.String()},
		{"a LID", "100000000000004@lid", "100000000000004@lid"},
		{"a group", "120363000000000001@g.us", "120363000000000001@g.us"},
		{"a channel", "120363000000000002@newsletter", "120363000000000002@newsletter"},
		{"a device of a number", "70000000009:3@s.whatsapp.net", "70000000009:3@s.whatsapp.net"},
		{"no JID at all", "not a jid", "not a jid"},
	} {
		if got := e.canonicalChat(c.typed); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestCanonicalChatOnTheWireAnswersAloneAndQueuesNoLookup(t *testing.T) {
	e, out := canonicalEngine(t)
	e.answer(request{ID: 1, Op: "canonicalChat", JID: "70000000008@s.whatsapp.net"})
	e.answer(request{ID: 2, Op: "canonicalChat", JID: fakePN})
	want := []map[string]any{
		{"id": float64(1), "ok": "70000000008@s.whatsapp.net"},
		{"id": float64(2), "ok": "100000000000003@lid"},
	}
	if got := wireLines(t, out); !reflect.DeepEqual(got, want) {
		t.Errorf("wrote %v", got)
	}
	if got := e.phones.waiting(); len(got) != 0 {
		t.Errorf("a typed number went to the lookups: %v", got)
	}
}

func TestCanonicalChatWhileLinkingAnswersTheIdAsTyped(t *testing.T) {
	e, _ := canonicalEngine(t)
	e.client.Store.ID = nil
	if got := e.canonicalChat(fakePN); got != fakePN {
		t.Errorf("got %q before the device was linked", got)
	}
}
