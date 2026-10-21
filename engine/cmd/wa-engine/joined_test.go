package main

import (
	"context"
	"errors"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

type fakeJoins struct {
	connected bool
	err       error
	asked     int
}

func (f *fakeJoins) IsConnected() bool { return f.connected }

func (f *fakeJoins) GetJoinedGroups(context.Context) ([]*types.GroupInfo, error) {
	f.asked++
	if f.err != nil {
		return nil, f.err
	}
	return []*types.GroupInfo{{
		JID:          types.NewJID("120363000000000002", types.GroupServer),
		GroupName:    types.GroupName{Name: "Synthetic family"},
		Participants: []types.GroupParticipant{{}, {}, {}},
	}}, nil
}

func joiningEngine(f *fakeJoins) (*engine, lines) {
	out := make(lines, 8)
	return &engine{ctx: context.Background(), client: &whatsmeow.Client{Store: &store.Device{}}, out: newWire(out),
		conv: &converter{}, following: &fakeFollows{}, joining: f, chats: map[string]waChat{}}, out
}

func TestConnectingPushesTheJoinedGroupsOnceAsChats(t *testing.T) {
	f := &fakeJoins{connected: true}
	e, out := joiningEngine(f)
	e.handle(&events.Connected{})
	if got := out.next(t); got != `{"event":"connection","state":"connected"}` {
		t.Fatalf("first line %s", got)
	}
	want := `{"event":"history","history":{"kind":"other","chats":[{"jid":"120363000000000002@g.us",` +
		`"name":"Synthetic family","kind":"group","participants":3}],` +
		`"contacts":[],"messages":[],"votes":[]}}`
	if got := out.next(t); got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
	if got := e.joinedGroups(); len(got) != 1 || f.asked != 1 {
		t.Errorf("asked WhatsApp %d times, kept %d groups", f.asked, len(got))
	}
	if len(out) != 0 {
		t.Errorf("a second ask pushed again: %s", <-out)
	}
}

func TestNoGroupsArePushedOrKeptOffline(t *testing.T) {
	f := &fakeJoins{}
	e, out := joiningEngine(f)
	if got := e.joinedGroups(); got != nil || f.asked != 0 || len(out) != 0 {
		t.Errorf("offline: asked %d times, got %v", f.asked, got)
	}
}

func TestAFailedGroupsAskPushesNothingAndIsAskedAgain(t *testing.T) {
	f := &fakeJoins{connected: true, err: errors.New("synthetic failure")}
	e, out := joiningEngine(f)
	e.joinedGroups()
	e.joinedGroups()
	if f.asked != 2 || len(out) != 0 {
		t.Errorf("asked %d times, pushed %d lines", f.asked, len(out))
	}
}
