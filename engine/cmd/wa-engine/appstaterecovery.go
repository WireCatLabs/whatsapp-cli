package main

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types/events"
)

// recoveryGap is mautrix-whatsapp's pace for asking the phone to rebuild a settings collection
// (handleWAAppStateSyncError): the ask makes the phone upload a new snapshot.
const recoveryGap = 48 * time.Hour

// appStateRecovery mends a settings collection whose patches failed: a full sync first, once per run, then, if
// that fails too, a request to the phone at most every 48 hours, kept in the device store across runs.
type appStateRecovery struct {
	db       *sql.DB
	mu       sync.Mutex
	fullSync map[appstate.WAPatchName]bool
	fetch    func(ctx context.Context, name appstate.WAPatchName) error
	ask      func(ctx context.Context, message *waE2E.Message) error
}

func openAppStateRecovery(ctx context.Context, db *sql.DB, unlinked bool, client *whatsmeow.Client) (*appStateRecovery, error) {
	if _, err := db.ExecContext(ctx,
		`CREATE TABLE IF NOT EXISTS wa_appstate_recovery (name TEXT PRIMARY KEY, asked_at INTEGER NOT NULL)`); err != nil {
		return nil, err
	}
	if unlinked {
		if _, err := db.ExecContext(ctx, `DELETE FROM wa_appstate_recovery`); err != nil {
			return nil, err
		}
	}
	return &appStateRecovery{
		db:       db,
		fullSync: map[appstate.WAPatchName]bool{},
		fetch: func(ctx context.Context, name appstate.WAPatchName) error {
			return client.FetchAppState(ctx, name, true, false)
		},
		ask: func(ctx context.Context, message *waE2E.Message) error {
			_, err := client.SendPeerMessage(ctx, message)
			return err
		},
	}, nil
}

func (r *appStateRecovery) failed(ctx context.Context, evt *events.AppStateSyncError, now time.Time) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	var asked int64
	if r.db.QueryRowContext(ctx, `SELECT asked_at FROM wa_appstate_recovery WHERE name = ?`, string(evt.Name)).
		Scan(&asked) == nil && now.Sub(time.Unix(asked, 0)) < recoveryGap {
		return
	}
	if !evt.FullSync {
		if r.fullSync[evt.Name] {
			return
		}
		r.fullSync[evt.Name] = true
		go func() { _ = r.fetch(ctx, evt.Name) }()
		return
	}
	if _, err := r.db.ExecContext(ctx, `INSERT INTO wa_appstate_recovery (name, asked_at) VALUES (?, ?)
		ON CONFLICT(name) DO UPDATE SET asked_at = excluded.asked_at`, string(evt.Name), now.Unix()); err != nil {
		return
	}
	go func() { _ = r.ask(ctx, whatsmeow.BuildAppStateRecoveryRequest(evt.Name)) }()
}
