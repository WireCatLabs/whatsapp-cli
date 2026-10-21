package main

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func chatStateLine(chat string) string {
	return `{"event":"history","history":{"kind":"other","chats":[` + chat + `],"contacts":[],"messages":[],"votes":[]}}`
}

func TestChatStateChangedOnThePhoneGoesOutAsANoticeWithOnlyThatFlag(t *testing.T) {
	stored[annPN.User] = annLID
	defer delete(stored, annPN.User)
	later := time.Now().Add(time.Hour).UnixMilli()
	cases := []struct {
		event any
		chat  string
	}{
		{&events.Archive{JID: annPN, Action: &waSyncAction.ArchiveChatAction{Archived: proto.Bool(true)}},
			`{"jid":"` + annLID.String() + `","kind":"dm","archived":true}`},
		{&events.Archive{JID: group, Action: &waSyncAction.ArchiveChatAction{Archived: proto.Bool(false)}},
			`{"jid":"` + group.String() + `","kind":"group","archived":false}`},
		{&events.Mute{JID: group, Action: &waSyncAction.MuteAction{Muted: proto.Bool(true), MuteEndTimestamp: proto.Int64(-1)}},
			`{"jid":"` + group.String() + `","kind":"group","muted":true}`},
		{&events.Mute{JID: annLID, Action: &waSyncAction.MuteAction{Muted: proto.Bool(true), MuteEndTimestamp: proto.Int64(later)}},
			`{"jid":"` + annLID.String() + `","kind":"dm","muted":true,"mutedUntil":"` + iso(time.UnixMilli(later)) + `"}`},
		{&events.Mute{JID: annLID, Action: &waSyncAction.MuteAction{Muted: proto.Bool(false)}},
			`{"jid":"` + annLID.String() + `","kind":"dm","muted":false}`},
		{&events.MarkChatAsRead{JID: selfPN, Action: &waSyncAction.MarkChatAsReadAction{Read: proto.Bool(true)}},
			`{"jid":"` + selfLID.String() + `","kind":"self","unread":0,"markedUnread":false}`},
		{&events.MarkChatAsRead{JID: annLID, Action: &waSyncAction.MarkChatAsReadAction{
			Read:         proto.Bool(true),
			MessageRange: &waSyncAction.SyncActionMessageRange{LastMessageTimestamp: proto.Int64(1792670400)},
		}}, `{"jid":"` + annLID.String() + `","kind":"dm","unread":0,"lastMessageAt":"2026-10-22T12:00:00.000Z","markedUnread":false}`},
		{&events.MarkChatAsRead{JID: group, Action: &waSyncAction.MarkChatAsReadAction{Read: proto.Bool(false)}},
			`{"jid":"` + group.String() + `","kind":"group","markedUnread":true}`},
	}
	for _, c := range cases {
		var out bytes.Buffer
		e := &engine{out: newWire(&out), conv: testConverter()}
		e.handle(c.event)
		if got, want := strings.TrimSpace(out.String()), chatStateLine(c.chat); got != want {
			t.Errorf("%+v went out as %s, want %s", c.event, got, want)
		}
	}
}

// App state counts a mute's end in milliseconds; read as seconds, a mute ending in an hour would last 55 000 years.
func TestAMuteThatEndedIsNoMute(t *testing.T) {
	now := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	for end, want := range map[int64]bool{
		-1:                                true,
		now.Add(-time.Minute).UnixMilli(): false,
		now.Add(time.Minute).UnixMilli():  true,
	} {
		action := &waSyncAction.MuteAction{Muted: proto.Bool(true), MuteEndTimestamp: proto.Int64(end)}
		_, chat, _ := testConverter().chatState(&events.Mute{JID: annLID, Action: action}, now)
		if *chat.Muted != want {
			t.Errorf("an end of %d read as muted %v", end, *chat.Muted)
		}
	}
}

func TestAPinOrAChangeWithoutAChatSaysNothing(t *testing.T) {
	archived := &waSyncAction.ArchiveChatAction{Archived: proto.Bool(true)}
	for _, evt := range []any{
		&events.Pin{JID: annLID, Action: &waSyncAction.PinAction{Pinned: proto.Bool(true)}},
		&events.MarkChatAsRead{JID: annLID},
		&events.Archive{JID: annLID},
		&events.Mute{JID: annLID},
		&events.Archive{Action: archived},
		&events.Archive{JID: types.StatusBroadcastJID, Action: archived},
		&events.DeleteChat{JID: annLID},
		&events.ClearChat{JID: annLID},
	} {
		var out bytes.Buffer
		e := &engine{out: newWire(&out), conv: testConverter()}
		e.handle(evt)
		if out.Len() > 0 {
			t.Errorf("%+v went out as %s", evt, out.String())
		}
	}
}
