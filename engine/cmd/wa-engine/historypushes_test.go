package main

import (
	"context"
	"errors"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func pushEngine(t *testing.T, path string, listening bool, fetch func() error) (*engine, *atomic.Int32) {
	t.Helper()
	pushes, err := openHistoryPushes(context.Background(), openTestDB(t, path), false)
	if err != nil {
		t.Fatal(err)
	}
	e, _ := followingEngine(&fakeFollows{})
	var delivered atomic.Int32
	e.pushes, e.listening = pushes, listening
	e.downloads = newHistoryDownloads(
		func(context.Context, *waE2E.HistorySyncNotification) (*waHistorySync.HistorySync, error) {
			if err := fetch(); err != nil {
				return nil, err
			}
			return &waHistorySync.HistorySync{}, nil
		},
		func(context.Context, *events.HistorySync) { delivered.Add(1) },
	)
	e.downloads.after = e.pushHanded
	return e, &delivered
}

func fullChunk(order uint32) *waE2E.HistorySyncNotification {
	return &waE2E.HistorySyncNotification{SyncType: waE2E.HistorySyncType_FULL.Enum(), ChunkOrder: proto.Uint32(order),
		Progress: proto.Uint32(40), DirectPath: proto.String("/v/t62/fake")}
}

func pushRow(t *testing.T, e *engine, id string) (handed, failed bool, attempts int) {
	t.Helper()
	var handedAt, failedAt *int64
	if err := e.pushes.db.QueryRow(`SELECT handed_at, failed_at, attempts FROM wa_history_pushes WHERE id = ?`, id).
		Scan(&handedAt, &failedAt, &attempts); err != nil {
		t.Fatal(err)
	}
	return handedAt != nil, failedAt != nil, attempts
}

func TestARunThatIsNotListeningKeepsAPushForServeToHandOn(t *testing.T) {
	path := filepath.Join(t.TempDir(), "private.db")
	oneShot, delivered := pushEngine(t, path, false, func() error { return nil })
	oneShot.historyPush("PUSH1", fullChunk(3))
	if !oneShot.downloads.settled(time.Second) || delivered.Load() != 0 {
		t.Fatal("a run that is not listening downloaded the push")
	}
	if handed, _, _ := pushRow(t, oneShot, "PUSH1"); handed {
		t.Fatal("kept push marked handed")
	}

	serve, served := pushEngine(t, path, true, func() error { return nil })
	serve.replayHistoryPushes()
	if !serve.downloads.settled(time.Second) || served.Load() != 1 {
		t.Fatalf("serve handed on %d kept pushes, want 1", served.Load())
	}
	if handed, _, _ := pushRow(t, serve, "PUSH1"); !handed {
		t.Fatal("the handed push is not marked")
	}
	if len(serve.pushes.waiting(context.Background())) != 0 {
		t.Fatal("a handed push still waits")
	}
}

func TestAnyRunDownloadsTheOnDemandAnswerItAskedFor(t *testing.T) {
	e, delivered := pushEngine(t, filepath.Join(t.TempDir(), "private.db"), false, func() error { return nil })
	e.historyPush("ASK1", &waE2E.HistorySyncNotification{SyncType: waE2E.HistorySyncType_ON_DEMAND.Enum()})
	if !e.downloads.settled(time.Second) || delivered.Load() != 1 {
		t.Fatal("the on-demand answer was not downloaded")
	}
}

func TestAPushAnnouncedAgainIsDownloadedOnce(t *testing.T) {
	e, delivered := pushEngine(t, filepath.Join(t.TempDir(), "private.db"), true, func() error { return nil })
	e.historyPush("PUSH1", fullChunk(1))
	e.historyPush("PUSH1", fullChunk(1))
	e.replayHistoryPushes()
	if !e.downloads.settled(time.Second) || delivered.Load() != 1 {
		t.Fatalf("downloaded %d times, want 1", delivered.Load())
	}
}

func TestAPushWhoseDownloadKeepsFailingIsGivenUp(t *testing.T) {
	e, _ := pushEngine(t, filepath.Join(t.TempDir(), "private.db"), true, func() error { return errors.New("gone") })
	e.historyPush("PUSH1", fullChunk(1))
	for range pushAttempts - 1 {
		e.downloads.settled(time.Second)
		e.replayHistoryPushes()
	}
	e.downloads.settled(time.Second)
	_, failed, attempts := pushRow(t, e, "PUSH1")
	if !failed || attempts != pushAttempts {
		t.Fatalf("failed=%v after %d attempts, want given up after %d", failed, attempts, pushAttempts)
	}
	if len(e.pushes.waiting(context.Background())) != 0 {
		t.Fatal("a given-up push still waits")
	}
}
