package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waAdv"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func storedChatsEngine(t *testing.T, linked bool, mappings ...store.LIDMapping) (*engine, *bytes.Buffer) {
	t.Helper()
	ctx := context.Background()
	device, db, refused := openDevice(ctx, filepath.Join(t.TempDir(), "private.db"), true, waLog.Noop)
	if refused != nil {
		t.Fatal(refused)
	}
	t.Cleanup(func() { db.Close() })
	if linked {
		device.ID = &selfPN
		device.Account = &waAdv.ADVSignedDeviceIdentity{
			Details:             []byte{},
			AccountSignature:    make([]byte, 64),
			AccountSignatureKey: make([]byte, 32),
			DeviceSignature:     make([]byte, 64),
		}
		if err := device.Save(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if len(mappings) > 0 {
		if err := device.LIDs.PutManyLIDMappings(ctx, mappings); err != nil {
			t.Fatal(err)
		}
	}
	phones, err := openPhoneChats(ctx, db, false)
	if err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	return &engine{ctx: ctx, client: whatsmeow.NewClient(device, waLog.Noop), phones: phones, out: newWire(&out)}, &out
}

func wireLines(t *testing.T, out *bytes.Buffer) []map[string]any {
	t.Helper()
	var lines []map[string]any
	scanner := bufio.NewScanner(out)
	for scanner.Scan() {
		var line map[string]any
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			t.Fatal(err)
		}
		lines = append(lines, line)
	}
	return lines
}

func storedChatsRequest(chats ...string) request {
	return request{ID: 1, Op: "storedChats", storedChatsFields: storedChatsFields{Chats: chats}}
}

func mapping(pn, lid string) store.LIDMapping {
	return store.LIDMapping{PN: types.NewJID(pn, types.DefaultUserServer), LID: types.NewJID(lid, types.HiddenUserServer)}
}

func TestStoredPhoneChatsAreRecordedAndAKnownLIDRekeysBeforeTheAnswer(t *testing.T) {
	e, out := storedChatsEngine(t, true, mapping("70000000009", "100000000000001"))
	e.answer(storedChatsRequest(
		fakePN, "70000000002@s.whatsapp.net", fakePN, fakeLID, "120363000000000001@g.us",
		"120363000000000001@newsletter", "status@broadcast", "not a jid",
	))

	want := []map[string]any{
		{"event": "rekey", "from": fakePN, "to": fakeLID},
		{"id": float64(1), "ok": nil},
	}
	if got := wireLines(t, out); !reflect.DeepEqual(got, want) {
		t.Errorf("wrote %v", got)
	}
	if got := e.phones.waiting(); !reflect.DeepEqual(got, []string{"70000000002"}) {
		t.Errorf("left %v for the lookups: only the phone-form chat with no LID yet", got)
	}
	if lid, ok := e.phones.lidOf("70000000009"); !ok || lid.String() != fakeLID {
		t.Errorf("the re-key was not kept: %v", lid)
	}
	if got := e.phones.settle(e.ctx, e.lidOf(nil), time.Now()); len(got) != 0 {
		t.Errorf("announced twice: %+v", got)
	}
}

func TestAStoredChatRekeyedLongAgoIsAnnouncedAgain(t *testing.T) {
	e, out := storedChatsEngine(t, true)
	e.phones.note(e.ctx, fakePN)
	e.phones.settle(e.ctx, lidsFrom(map[string]types.JID{"70000000009": types.NewJID("100000000000001", types.HiddenUserServer)}),
		time.Now().Add(-2*rekeyRepeat))

	e.answer(storedChatsRequest(fakePN))
	if got := wireLines(t, out); len(got) != 2 || got[0]["event"] != "rekey" || got[0]["to"] != fakeLID {
		t.Errorf("the store still holds the phone form, so the re-key goes out again; wrote %v", got)
	}
	if got := e.phones.waiting(); len(got) != 0 {
		t.Errorf("a re-keyed chat went back to the lookups: %v", got)
	}
}

func TestStoredChatsWhileLinkingRecordNothing(t *testing.T) {
	e, out := storedChatsEngine(t, false)
	e.answer(storedChatsRequest(fakePN))
	if got := wireLines(t, out); !reflect.DeepEqual(got, []map[string]any{{"id": float64(1), "ok": nil}}) {
		t.Errorf("wrote %v", got)
	}
	if got := e.phones.waiting(); len(got) != 0 {
		t.Errorf("recorded %v before the account was known", got)
	}
}

func TestThousandsOfStoredChatsAreRecordedInOneRequestWellInsideTheCLIsWait(t *testing.T) {
	var chats []string
	var mappings []store.LIDMapping
	for i := range 5000 {
		pn := fmt.Sprintf("7000%07d", i)
		chats = append(chats, pn+"@s.whatsapp.net")
		if i%3 == 0 {
			mappings = append(mappings, mapping(pn, fmt.Sprintf("1000%011d", i)))
		}
	}
	e, out := storedChatsEngine(t, true, mappings...)
	started := time.Now()
	e.answer(storedChatsRequest(chats...))
	took := time.Since(started)

	lines := wireLines(t, out)
	if rekeys := len(lines) - 1; rekeys != len(mappings) {
		t.Errorf("announced %d re-keys for %d known LIDs", rekeys, len(mappings))
	}
	if last := lines[len(lines)-1]; last["id"] != float64(1) || last["error"] != nil {
		t.Errorf("answered %v", last)
	}
	var rows int
	if err := e.phones.db.QueryRow(`SELECT count(*) FROM wa_phone_chats`).Scan(&rows); err != nil || rows != len(chats) {
		t.Errorf("recorded %d rows (%v)", rows, err)
	}
	if got := len(e.phones.waiting()); got != len(chats)-len(mappings) {
		t.Errorf("left %d for the lookups", got)
	}
	if took > 3*time.Second {
		t.Errorf("took %v; the CLI abandons the request after 5 s", took)
	}
}
