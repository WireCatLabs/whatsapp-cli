package main

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types/events"
)

// reachout keeps when WhatsApp's restriction on messaging new contacts ends. WhatsApp announces it once, in a
// notification, and a later send only answers code 463; a one-shot send needs the date from an earlier run.
type reachout struct{ db *sql.DB }

func openReachout(ctx context.Context, db *sql.DB, unlinked bool) (*reachout, error) {
	if _, err := db.ExecContext(ctx,
		`CREATE TABLE IF NOT EXISTS wa_reachout_timelock (id INTEGER PRIMARY KEY CHECK (id = 1), ends_at INTEGER NOT NULL)`); err != nil {
		return nil, err
	}
	if unlinked {
		if _, err := db.ExecContext(ctx, `DELETE FROM wa_reachout_timelock`); err != nil {
			return nil, err
		}
	}
	return &reachout{db: db}, nil
}

func (r *reachout) noticed(ctx context.Context, evt *events.NotifyAccountReachoutTimelock) {
	if r == nil {
		return
	}
	if !evt.IsActive || evt.TimeEnforcementEnds.Time.IsZero() {
		_, _ = r.db.ExecContext(ctx, `DELETE FROM wa_reachout_timelock`)
		return
	}
	_, _ = r.db.ExecContext(ctx, `INSERT INTO wa_reachout_timelock (id, ends_at) VALUES (1, ?)
		ON CONFLICT(id) DO UPDATE SET ends_at = excluded.ends_at`, evt.TimeEnforcementEnds.Time.Unix())
}

func (r *reachout) ends(ctx context.Context, now time.Time) (time.Time, bool) {
	if r == nil {
		return time.Time{}, false
	}
	var at int64
	if r.db.QueryRowContext(ctx, `SELECT ends_at FROM wa_reachout_timelock WHERE id = 1`).Scan(&at) != nil {
		return time.Time{}, false
	}
	ends := time.Unix(at, 0)
	return ends, ends.After(now)
}

var (
	reachoutRestricted = because("account.reachout-restricted", "permission_error",
		"WhatsApp has restricted this account from messaging new contacts")
	messageRejected = because("message.rejected", "provider_error", "WhatsApp rejected the message")
)

// sendErrorCode is the code of a message WhatsApp refused; whatsmeow puts it only in the error text, as
// mautrix-whatsapp's sendErrorCode reads it.
func sendErrorCode(err error) int {
	if !errors.Is(err, whatsmeow.ErrServerReturnedError) {
		return 0
	}
	_, code, _ := strings.Cut(err.Error(), whatsmeow.ErrServerReturnedError.Error()+" ")
	n, _ := strconv.Atoi(code)
	return n
}

func sendRefusal(err error) *refusal {
	switch sendErrorCode(err) {
	case 463:
		return reachoutRestricted
	case 421, 479:
		return messageRejected
	}
	return nil
}
