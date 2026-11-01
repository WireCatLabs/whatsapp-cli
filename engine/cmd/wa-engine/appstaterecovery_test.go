package main

import (
	"context"
	"errors"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types/events"
)

func recoveryFor(t *testing.T, path string) (*appStateRecovery, *atomic.Int32, *atomic.Int32) {
	t.Helper()
	r, err := openAppStateRecovery(context.Background(), openTestDB(t, path), false, nil)
	if err != nil {
		t.Fatal(err)
	}
	var fetched, asked atomic.Int32
	r.fetch = func(context.Context, appstate.WAPatchName) error { fetched.Add(1); return nil }
	r.ask = func(context.Context, *waE2E.Message) error { asked.Add(1); return nil }
	return r, &fetched, &asked
}

func eventually(t *testing.T, n *atomic.Int32, want int32) {
	t.Helper()
	for range 100 {
		if n.Load() == want {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("got %d, want %d", n.Load(), want)
}

func TestABrokenSettingsSyncTriesAFullSyncThenAsksThePhoneOnceIn48Hours(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "private.db")
	now := time.Now()
	partial := &events.AppStateSyncError{Name: appstate.WAPatchRegular, Error: errors.New("mac mismatch")}
	full := &events.AppStateSyncError{Name: appstate.WAPatchRegular, Error: errors.New("mac mismatch"), FullSync: true}

	r, fetched, asked := recoveryFor(t, path)
	r.failed(ctx, partial, now)
	r.failed(ctx, partial, now)
	eventually(t, fetched, 1)
	r.failed(ctx, full, now)
	eventually(t, asked, 1)

	next, _, askedAgain := recoveryFor(t, path)
	next.failed(ctx, full, now.Add(47*time.Hour))
	time.Sleep(20 * time.Millisecond)
	if askedAgain.Load() != 0 {
		t.Fatal("asked the phone again within 48 hours of an earlier run")
	}
	next.failed(ctx, full, now.Add(49*time.Hour))
	eventually(t, askedAgain, 1)
}
