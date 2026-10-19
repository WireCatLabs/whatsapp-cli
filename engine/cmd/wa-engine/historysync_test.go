package main

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types/events"
)

func TestCloseWaitsForAHistoryPushStillDownloading(t *testing.T) {
	release := make(chan struct{})
	var handed []*events.HistorySync
	h := newHistoryDownloads(
		func(context.Context, *waE2E.HistorySyncNotification) (*waHistorySync.HistorySync, error) {
			<-release
			return &waHistorySync.HistorySync{}, nil
		},
		func(_ context.Context, evt *events.HistorySync) { handed = append(handed, evt) },
	)
	h.add(&waE2E.HistorySyncNotification{})
	h.add(&waE2E.HistorySyncNotification{})

	if h.settled(10 * time.Millisecond) {
		t.Fatal("settled while a push was still downloading")
	}
	time.AfterFunc(20*time.Millisecond, func() { close(release) })
	if !h.settled(time.Second) {
		t.Fatal("did not settle once the downloads finished")
	}
	if len(handed) != 2 {
		t.Fatalf("handed on %d pushes, want 2", len(handed))
	}
}

func TestAFailedHistoryDownloadDoesNotHoldCloseUp(t *testing.T) {
	h := newHistoryDownloads(
		func(context.Context, *waE2E.HistorySyncNotification) (*waHistorySync.HistorySync, error) {
			return nil, errors.New("synthetic download failure")
		},
		func(context.Context, *events.HistorySync) { t.Error("a failed download was handed on") },
	)
	h.add(&waE2E.HistorySyncNotification{})
	if !h.settled(time.Second) {
		t.Fatal("a failed download held close up")
	}
}

func TestOnlyTheAccountsOwnHistoryAnnouncementIsDownloaded(t *testing.T) {
	asked := make(chan struct{}, 2)
	e, _ := followingEngine(&fakeFollows{})
	e.downloads = newHistoryDownloads(
		func(context.Context, *waE2E.HistorySyncNotification) (*waHistorySync.HistorySync, error) {
			asked <- struct{}{}
			return nil, errors.New("synthetic")
		},
		func(context.Context, *events.HistorySync) {},
	)
	announce := func(fromMe bool) *events.Message {
		evt := incoming(selfPN, selfPN, &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{
			HistorySyncNotification: &waE2E.HistorySyncNotification{},
		}})
		evt.Info.IsFromMe = fromMe
		return evt
	}
	e.handle(announce(false))
	e.handle(announce(true))
	if !e.downloads.settled(time.Second) {
		t.Fatal("not settled")
	}
	if len(asked) != 1 {
		t.Fatalf("downloaded %d announcements, want only the account's own", len(asked))
	}
}
