package main

import (
	"context"
	"database/sql"
	"slices"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types"
)

// The last step of the LID map (plan, decision 3): asking WhatsApp for the LID of a person whose chat is still in
// phone form. It is the request `contacts profile` makes, which a scraper would send in bulk, and WhatsApp bans
// accounts for that. So it asks only for chats the account already has, a few people at a time, at the pace of a
// number lookup, a bounded number per run, and each person at most once a week.
const (
	lidAskBatch  = 5
	lidAskGap    = lookupGap
	lidAskPerRun = 4
	lidAskAgain  = 7 * 24 * time.Hour
	// History comes in several pushes right after connecting; the lookups wait until they stop.
	lidAskSettle = time.Minute
)

type lidAsker struct {
	db   *sql.DB
	now  func() time.Time
	wait func(time.Duration) bool // false once the engine stops
	ask  func([]types.JID) error

	one   sync.Mutex // one run at a time
	mu    sync.Mutex
	last  time.Time
	timer *time.Timer
}

// openLidAsker empties the table for a device not yet linked, as openPhoneChats does.
func openLidAsker(ctx context.Context, db *sql.DB, unlinked bool, ask func([]types.JID) error) (*lidAsker, error) {
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS wa_lid_asks (pn TEXT PRIMARY KEY, asked_at INTEGER)`); err != nil {
		return nil, err
	}
	if unlinked {
		if _, err := db.ExecContext(ctx, `DELETE FROM wa_lid_asks`); err != nil {
			return nil, err
		}
	}
	wait := func(d time.Duration) bool {
		select {
		case <-time.After(d):
			return true
		case <-ctx.Done():
			return false
		}
	}
	return &lidAsker{db: db, now: time.Now, wait: wait, ask: ask}, nil
}

// run asks for the LIDs of `users`, phone JIDs' user parts, that were not asked for within lidAskAgain.
func (a *lidAsker) run(ctx context.Context, users []string) {
	if !a.one.TryLock() {
		return
	}
	defer a.one.Unlock()
	due := a.due(ctx, users)
	for start := 0; start < len(due) && start < lidAskBatch*lidAskPerRun; start += lidAskBatch {
		a.mu.Lock()
		pause := a.last.Add(lidAskGap).Sub(a.now())
		a.mu.Unlock()
		if !a.last.IsZero() && pause > 0 && !a.wait(pause) {
			return
		}
		batch := due[start:min(start+lidAskBatch, len(due))]
		now := a.now()
		// Recorded before the request: one that fails or never answers is not asked again at once.
		for _, user := range batch {
			_, _ = a.db.ExecContext(ctx, `INSERT INTO wa_lid_asks (pn, asked_at) VALUES (?, ?)
				ON CONFLICT (pn) DO UPDATE SET asked_at = excluded.asked_at`, user, now.Unix())
		}
		a.mu.Lock()
		a.last = now
		a.mu.Unlock()
		jids := make([]types.JID, len(batch))
		for i, user := range batch {
			jids[i] = types.NewJID(user, types.DefaultUserServer)
		}
		if a.ask(jids) != nil {
			return
		}
	}
}

func (a *lidAsker) due(ctx context.Context, users []string) []string {
	since := a.now().Add(-lidAskAgain).Unix()
	var due []string
	for _, user := range users {
		var at int64
		err := a.db.QueryRowContext(ctx, `SELECT asked_at FROM wa_lid_asks WHERE pn = ?`, user).Scan(&at)
		if err == sql.ErrNoRows || (err == nil && at < since) {
			due = append(due, user)
		}
	}
	slices.Sort(due)
	return due
}

// waiting is every phone-form chat not yet re-keyed.
func (p *phoneChats) waiting() []string {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	users := make([]string, 0, len(p.pending))
	for user := range p.pending {
		users = append(users, user)
	}
	return users
}

// lookLater starts the lookups once history has stopped coming; each push puts them off again.
func (e *engine) lookLater() {
	a := e.asks
	if a == nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.timer != nil {
		a.timer.Stop()
	}
	a.timer = time.AfterFunc(lidAskSettle, e.lookUpMissing)
}

func (e *engine) lookUpMissing() {
	if e.ctx.Err() != nil || !e.client.IsConnected() {
		return
	}
	for _, rekey := range e.phones.settle(e.ctx, e.lidOf(nil), time.Now()) {
		e.out.rekey(rekey)
	}
	// whatsmeow stores each LID the answer carries; settle then turns them into re-keys.
	e.asks.run(e.ctx, e.phones.waiting())
	for _, rekey := range e.phones.settle(e.ctx, e.lidOf(nil), time.Now()) {
		e.out.rekey(rekey)
	}
}

func (e *engine) askLIDs(jids []types.JID) error {
	_, err := e.client.GetUserInfo(e.ctx, jids)
	return err
}
