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
	// A row of wa_lid_asks no phone number can be: when WhatsApp last asked this account to slow down. No lookup
	// goes out for lidAskAgain after it, across restarts, since WhatsApp's 429 says nothing of how long to wait.
	lidAskHeld = "rate-limited"
	// Another such row: a 429 a background lookup met, owed to the next write (engine.answer). It outlives a restart,
	// which would otherwise let a write through inside the hold the CLI never heard of.
	lidAskOwed = "write-owed"
	// The CLI's hold after a 429, RATE_LIMIT_HOLD_MS in src/adapter/errors.ts: a 429 older than that is owed to nobody.
	writeHold = 15 * time.Minute
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

// run asks for the LIDs of `users`, phone JIDs' user parts, that were not asked for within lidAskAgain. It answers
// whether WhatsApp asked to slow down.
func (a *lidAsker) run(ctx context.Context, users []string) (limited bool) {
	if !a.one.TryLock() {
		return false
	}
	defer a.one.Unlock()
	due := a.due(ctx, users)
	for start := 0; start < len(due) && start < lidAskBatch*lidAskPerRun; start += lidAskBatch {
		a.mu.Lock()
		pause := a.last.Add(lidAskGap).Sub(a.now())
		a.mu.Unlock()
		if !a.last.IsZero() && pause > 0 && !a.wait(pause) {
			return false
		}
		// Before each batch: a 429 another request met during the wait stops the rest.
		if a.recent(ctx, lidAskHeld) {
			return false
		}
		batch := due[start:min(start+lidAskBatch, len(due))]
		now := a.now()
		// Recorded before the request: one that fails or never answers is not asked again at once.
		for _, user := range batch {
			if a.mark(ctx, user, now) != nil {
				return false
			}
		}
		a.mu.Lock()
		a.last = now
		a.mu.Unlock()
		jids := make([]types.JID, len(batch))
		for i, user := range batch {
			jids[i] = types.NewJID(user, types.DefaultUserServer)
		}
		if err := a.ask(jids); err != nil {
			if classify(err).Reason == "account.rate-limited" {
				a.hold(ctx)
				return true
			}
			return false
		}
	}
	return false
}

// hold stops the lookups after WhatsApp's 429, whichever request met it.
func (a *lidAsker) hold(ctx context.Context) {
	if a != nil {
		_ = a.mark(ctx, lidAskHeld, a.now())
	}
}

// owe keeps a background 429 for the next write. Unlike hold's row, it is set only where no command carries the 429.
func (a *lidAsker) owe(ctx context.Context) {
	if a != nil {
		a.mu.Lock()
		defer a.mu.Unlock()
		_ = a.mark(ctx, lidAskOwed, a.now())
	}
}

// owed takes a background 429 for this write, at most once: the refusal makes the CLI hold the rest, and `flood clear`
// must be able to lift that hold.
func (a *lidAsker) owed(ctx context.Context) bool {
	if a == nil {
		return false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	var at int64
	if a.db.QueryRowContext(ctx, `SELECT asked_at FROM wa_lid_asks WHERE pn = ?`, lidAskOwed).Scan(&at) != nil {
		return false
	}
	if _, err := a.db.ExecContext(ctx, `DELETE FROM wa_lid_asks WHERE pn = ?`, lidAskOwed); err != nil {
		return false
	}
	return at >= a.now().Add(-writeHold).Unix()
}

func (a *lidAsker) mark(ctx context.Context, pn string, at time.Time) error {
	_, err := a.db.ExecContext(ctx, `INSERT INTO wa_lid_asks (pn, asked_at) VALUES (?, ?)
		ON CONFLICT (pn) DO UPDATE SET asked_at = excluded.asked_at`, pn, at.Unix())
	return err
}

// recent says `pn` was asked for within lidAskAgain; a store that cannot say counts as yes.
func (a *lidAsker) recent(ctx context.Context, pn string) bool {
	var at int64
	err := a.db.QueryRowContext(ctx, `SELECT asked_at FROM wa_lid_asks WHERE pn = ?`, pn).Scan(&at)
	if err == sql.ErrNoRows {
		return false
	}
	return err != nil || at >= a.now().Add(-lidAskAgain).Unix()
}

func (a *lidAsker) due(ctx context.Context, users []string) []string {
	var due []string
	for _, user := range users {
		if !a.recent(ctx, user) {
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
	if e.asks.run(e.ctx, e.phones.waiting()) {
		e.asks.owe(e.ctx)
	}
	for _, rekey := range e.phones.settle(e.ctx, e.lidOf(nil), time.Now()) {
		e.out.rekey(rekey)
	}
}

func (e *engine) askLIDs(jids []types.JID) error {
	_, err := e.client.GetUserInfo(e.ctx, jids)
	return err
}
