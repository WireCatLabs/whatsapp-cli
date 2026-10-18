package main

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

type fakeFollows struct {
	connected bool
	err       error
	asked     int
}

func (f *fakeFollows) IsConnected() bool { return f.connected }

func (f *fakeFollows) GetSubscribedNewsletters(context.Context) ([]*types.NewsletterMetadata, error) {
	f.asked++
	return []*types.NewsletterMetadata{channelMeta("")}, f.err
}

type lines chan string

func (l lines) Write(p []byte) (int, error) {
	l <- strings.TrimSpace(string(p))
	return len(p), nil
}

func (l lines) next(t *testing.T) string {
	t.Helper()
	select {
	case line := <-l:
		return line
	case <-time.After(5 * time.Second):
		t.Fatal("the engine wrote nothing")
		return ""
	}
}

func followingEngine(f *fakeFollows) (*engine, lines) {
	out := make(lines, 8)
	return &engine{ctx: context.Background(), client: &whatsmeow.Client{Store: &store.Device{}}, out: newWire(out),
		conv: &converter{}, following: f}, out
}

func TestConnectingPushesTheFollowedChannelsOnceAsChats(t *testing.T) {
	f := &fakeFollows{connected: true}
	e, out := followingEngine(f)
	e.handle(&events.Connected{})
	if got := out.next(t); got != `{"event":"connection","state":"connected"}` {
		t.Fatalf("first line %s", got)
	}
	want := `{"event":"history","history":{"kind":"other","chats":[{"jid":"120363000000000001@newsletter",` +
		`"name":"Synthetic news","kind":"newsletter","unread":null,"lastMessageAt":null,"participants":42}],` +
		`"contacts":[],"messages":[],"votes":[]}}`
	if got := out.next(t); got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
	if got := e.followedChannels(); len(got) != 1 || f.asked != 1 {
		t.Errorf("asked WhatsApp %d times, kept %d channels", f.asked, len(got))
	}
	if len(out) != 0 {
		t.Errorf("a second ask pushed again: %s", <-out)
	}
}

func TestNoChannelsArePushedOrKeptOffline(t *testing.T) {
	f := &fakeFollows{}
	e, out := followingEngine(f)
	if got := e.followedChannels(); got != nil || f.asked != 0 || len(out) != 0 {
		t.Errorf("offline: asked %d times, got %v", f.asked, got)
	}
}

func TestAFailedAskPushesNothingAndIsAskedAgain(t *testing.T) {
	f := &fakeFollows{connected: true, err: errors.New("synthetic failure")}
	e, out := followingEngine(f)
	e.followedChannels()
	e.followedChannels()
	if f.asked != 2 || len(out) != 0 {
		t.Errorf("asked %d times, pushed %d lines", f.asked, len(out))
	}
}
