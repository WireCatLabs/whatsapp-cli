package main

import (
	"bytes"
	"context"
	"database/sql"
	"path/filepath"
	"reflect"
	"slices"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

const (
	fakePN  = "70000000009@s.whatsapp.net"
	fakeLID = "100000000000001@lid"
)

var fakeRekey = waRekey{From: fakePN, To: fakeLID}

func openTestDB(t *testing.T, path string) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func testPhoneChats(t *testing.T, path string) *phoneChats {
	t.Helper()
	p, err := openPhoneChats(context.Background(), openTestDB(t, path), false)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func lidsFrom(mapped map[string]types.JID) func(string) (types.JID, bool) {
	return func(user string) (types.JID, bool) { lid, ok := mapped[user]; return lid, ok }
}

var nobody = lidsFrom(nil)

func TestAPhoneChatIsRekeyedOnceItsPersonHasALID(t *testing.T) {
	ctx, now := context.Background(), time.Now()
	p := testPhoneChats(t, filepath.Join(t.TempDir(), "private.db"))
	p.note(ctx, fakePN)
	p.note(ctx, fakeLID)
	p.note(ctx, "120363000000000001@g.us")
	if got := p.settle(ctx, nobody, now); len(got) != 0 {
		t.Fatalf("no LID known yet, got %+v", got)
	}
	lid := lidsFrom(map[string]types.JID{"70000000009": types.NewJID("100000000000001", types.HiddenUserServer)})
	if got := p.settle(ctx, lid, now); !reflect.DeepEqual(got, []waRekey{fakeRekey}) {
		t.Errorf("got %+v", got)
	}
	if got := p.settle(ctx, lid, now); len(got) != 0 {
		t.Errorf("announced twice: %+v", got)
	}
}

func TestARekeyedChatNamedInPhoneFormAgainIsNotLookedUpAgain(t *testing.T) {
	ctx := context.Background()
	p := testPhoneChats(t, filepath.Join(t.TempDir(), "private.db"))
	p.note(ctx, fakePN)
	lid := lidsFrom(map[string]types.JID{"70000000009": types.NewJID("100000000000001", types.HiddenUserServer)})
	p.settle(ctx, lid, time.Now())

	p.note(ctx, fakePN)
	if got := p.waiting(); len(got) != 0 {
		t.Errorf("a re-keyed chat went back to the lookups: %v", got)
	}
}

func TestPhoneChatsOutliveTheProcessAndRecentRekeysAreRepeated(t *testing.T) {
	ctx, now := context.Background(), time.Now()
	path := filepath.Join(t.TempDir(), "private.db")
	testPhoneChats(t, path).note(ctx, fakePN)

	again := testPhoneChats(t, path)
	lid := lidsFrom(map[string]types.JID{"70000000009": types.NewJID("100000000000001", types.HiddenUserServer)})
	if got := again.settle(ctx, lid, now); !reflect.DeepEqual(got, []waRekey{fakeRekey}) {
		t.Fatalf("the chat noted before the restart was lost: %+v", got)
	}

	later := testPhoneChats(t, path)
	if got := later.recent(ctx, now.Add(time.Hour)); !reflect.DeepEqual(got, []waRekey{fakeRekey}) {
		t.Errorf("a recent re-key is not repeated: %+v", got)
	}
	if got := later.recent(ctx, now.Add(rekeyRepeat+time.Hour)); len(got) != 0 {
		t.Errorf("an old re-key is still repeated: %+v", got)
	}
	if got := later.settle(ctx, lid, now); len(got) != 0 {
		t.Errorf("a re-keyed chat came back as pending: %+v", got)
	}
}

func TestADeviceNotYetLinkedForgetsThePreviousAccountsChats(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "private.db")
	testPhoneChats(t, path).note(ctx, fakePN)
	fresh, err := openPhoneChats(ctx, openTestDB(t, path), true)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(fresh.pending); got != 0 {
		t.Errorf("kept %d chats of the previous account", got)
	}
}

func TestNoTableMeansNoRekeys(t *testing.T) {
	var p *phoneChats
	p.note(context.Background(), fakePN)
	if p.settle(context.Background(), nobody, time.Now()) != nil || p.recent(context.Background(), time.Now()) != nil {
		t.Error("a missing table must re-key nothing")
	}
}

func TestHistoryKeepsItsOwnMappingsForTheRekey(t *testing.T) {
	data := &waHistorySync.HistorySync{
		SyncType: waHistorySync.HistorySync_RECENT.Enum(),
		PhoneNumberToLidMappings: []*waHistorySync.PhoneNumberToLIDMapping{
			{PnJID: proto.String(fakePN), LidJID: proto.String(fakeLID)},
		},
	}
	out := testConverter().history(data, nil)
	if lid, ok := out.learned["70000000009"]; !ok || lid.String() != fakeLID {
		t.Errorf("got %+v", out.learned)
	}
}

func TestARekeyedChatIsNeverEmittedInPhoneFormAgain(t *testing.T) {
	ctx, now := context.Background(), time.Now()
	path := filepath.Join(t.TempDir(), "private.db")
	p := testPhoneChats(t, path)
	p.note(ctx, fakePN)
	lid := lidsFrom(map[string]types.JID{"70000000009": types.NewJID("100000000000001", types.HiddenUserServer)})
	p.settle(ctx, lid, now)

	// Past the 30 days of repeats, in a later process, with whatsmeow's store no longer answering for the number.
	later := testPhoneChats(t, path)
	later.recent(ctx, now.Add(rekeyRepeat+time.Hour))
	c := testConverter()
	c.lidFor = func(pn types.JID) (types.JID, bool) { return later.lidOf(pn.User) }
	pn := types.NewJID("70000000009", types.DefaultUserServer)
	if got := c.canonical(pn, nil).String(); got != fakeLID {
		t.Errorf("a send or a chat card would name %s", got)
	}
	changed, ok := c.message(incoming(pn, pn, text("synthetic")), known{})
	if !ok || changed.message.Chat != fakeLID {
		t.Errorf("a message in the phone-form chat went to %+v", changed.message)
	}
}

func TestTheChatARequestNamesIsRecordedOnceTheRequestWentThrough(t *testing.T) {
	ctx := context.Background()
	p := testPhoneChats(t, filepath.Join(t.TempDir(), "private.db"))
	e := &engine{ctx: ctx, phones: p}
	e.noteNamed(request{Op: "react", Chat: "70000000001@s.whatsapp.net"})
	e.noteNamed(request{Op: "read", Chat: "70000000002@s.whatsapp.net"})
	e.noteNamed(request{Op: "mute", JID: "70000000007@s.whatsapp.net"})
	e.noteNamed(request{Op: "pinChat", JID: "70000000008@s.whatsapp.net"})
	e.noteNamed(request{Op: "react", Chat: "120363000000000001@g.us"})
	e.noteNamed(request{Op: "chat", JID: "70000000003@s.whatsapp.net"})
	e.noteNamed(request{Op: "profile", JID: "70000000004@s.whatsapp.net"})
	e.noteNamed(request{Op: "block", JID: "70000000005@s.whatsapp.net"})
	got := p.waiting()
	slices.Sort(got)
	if !reflect.DeepEqual(got, []string{"70000000001", "70000000002"}) {
		t.Errorf("recorded %v: only a chat the store holds, never a number the owner typed", got)
	}

	var out bytes.Buffer
	e.out = newWire(&out)
	e.answer(request{ID: 1, Op: "react", Chat: "70000000006@s.whatsapp.net"})
	if slices.Contains(p.waiting(), "70000000006") {
		t.Error("recorded the chat of a request that was refused")
	}
}

func TestTheChatOfAStarOrADeleteFromAnotherDeviceIsRecordedAsWhatsAppNamesIt(t *testing.T) {
	p := testPhoneChats(t, filepath.Join(t.TempDir(), "private.db"))
	lid := types.NewJID("100000000000001", types.HiddenUserServer)
	e := &engine{ctx: context.Background(), phones: p, conv: &converter{lidFor: func(types.JID) (types.JID, bool) {
		return lid, true
	}}}
	chat, ok := e.appStateChat(types.NewJID("70000000009", types.DefaultUserServer), "3EB000000000000000000001")
	if !ok || chat != fakeLID || !reflect.DeepEqual(p.waiting(), []string{"70000000009"}) {
		t.Errorf("chat %q, recorded %v", chat, p.waiting())
	}
}
