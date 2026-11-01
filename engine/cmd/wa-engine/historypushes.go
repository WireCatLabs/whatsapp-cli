package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// historyPushes keeps every history push the phone announces until a listening run has handed it to the CLI. The
// phone announces each push once; a run that is not listening (a send, a download) only keeps it, so `serve` or a
// link can download it later. The row outlives the download as the record of what arrived: the sync type, the chunk
// and the phone's progress, which is how a missing stretch of history shows.
type historyPushes struct {
	db *sql.DB
	mu sync.Mutex
}

type keptPush struct {
	id           string
	notification *waE2E.HistorySyncNotification
}

func openHistoryPushes(ctx context.Context, db *sql.DB, unlinked bool) (*historyPushes, error) {
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS wa_history_pushes (
		id TEXT PRIMARY KEY, sync_type TEXT NOT NULL, chunk INTEGER NOT NULL, progress INTEGER NOT NULL,
		oldest_at INTEGER, received_at INTEGER NOT NULL, handed_at INTEGER, failed_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
		notification BLOB)`); err != nil {
		return nil, err
	}
	if unlinked {
		if _, err := db.ExecContext(ctx, `DELETE FROM wa_history_pushes`); err != nil {
			return nil, err
		}
	}
	return &historyPushes{db: db}, nil
}

// keep records a push as announced. It answers false when the push is known already: the phone announces it again
// to a run that never acknowledged it.
func (h *historyPushes) keep(ctx context.Context, id string, n *waE2E.HistorySyncNotification) bool {
	if h == nil {
		return true
	}
	blob, err := proto.Marshal(n)
	if err != nil {
		return true
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	res, err := h.db.ExecContext(ctx, `INSERT OR IGNORE INTO wa_history_pushes
		(id, sync_type, chunk, progress, oldest_at, received_at, notification) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, n.GetSyncType().String(), n.GetChunkOrder(), n.GetProgress(), n.GetOldestMsgInChunkTimestampSec(),
		time.Now().Unix(), blob)
	if err != nil {
		fmt.Fprintln(os.Stderr, "wa-engine: cannot keep a history push in the device store")
		return true
	}
	added, _ := res.RowsAffected()
	return added == 1
}

// waiting is every push kept and not yet handed on or given up on, oldest first.
func (h *historyPushes) waiting(ctx context.Context) []keptPush {
	if h == nil {
		return nil
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	rows, err := h.db.QueryContext(ctx, `SELECT id, notification FROM wa_history_pushes
		WHERE handed_at IS NULL AND failed_at IS NULL AND notification IS NOT NULL ORDER BY received_at, rowid`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []keptPush
	for rows.Next() {
		var id string
		var blob []byte
		if rows.Scan(&id, &blob) != nil {
			continue
		}
		n := &waE2E.HistorySyncNotification{}
		if proto.Unmarshal(blob, n) == nil {
			out = append(out, keptPush{id: id, notification: n})
		}
	}
	return out
}

// handed marks a push as given to the CLI and drops its download keys: only the record stays.
func (h *historyPushes) handed(ctx context.Context, id string) {
	h.finish(ctx, id, "handed_at")
}

// pushAttempts bounds the downloads of one push: a failure may be the network, but a file WhatsApp no longer keeps
// fails at every start.
const pushAttempts = 3

// failed counts a download that did not work, and gives the push up after pushAttempts.
func (h *historyPushes) failed(ctx context.Context, id string) {
	if h == nil || id == "" {
		return
	}
	h.mu.Lock()
	_, _ = h.db.ExecContext(ctx, `UPDATE wa_history_pushes SET attempts = attempts + 1 WHERE id = ?`, id)
	var attempts int
	_ = h.db.QueryRowContext(ctx, `SELECT attempts FROM wa_history_pushes WHERE id = ?`, id).Scan(&attempts)
	h.mu.Unlock()
	if attempts >= pushAttempts {
		h.finish(ctx, id, "failed_at")
	}
}

func (h *historyPushes) finish(ctx context.Context, id, column string) {
	if h == nil || id == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	_, _ = h.db.ExecContext(ctx, `UPDATE wa_history_pushes SET `+column+` = ?, notification = NULL WHERE id = ?`,
		time.Now().Unix(), id)
}

// historyPush keeps a push the phone announced and, in a listening run, queues its download. An on-demand push
// answers `messages sync` in the run that asked, so any run downloads it. Without the table every push is downloaded
// at once, as before it existed.
func (e *engine) historyPush(id string, n *waE2E.HistorySyncNotification) {
	if e.pushes == nil {
		e.queuePush(id, n)
		return
	}
	e.pushes.keep(e.ctx, id, n)
	if e.listening || n.GetSyncType() == waE2E.HistorySyncType_ON_DEMAND {
		e.queuePush(id, n)
	}
}

// replayHistoryPushes queues the pushes an earlier run kept and did not hand on. Downloads need the connection.
func (e *engine) replayHistoryPushes() {
	if !e.listening {
		return
	}
	for _, push := range e.pushes.waiting(e.ctx) {
		e.queuePush(push.id, push.notification)
	}
}

func (e *engine) queuePush(id string, n *waE2E.HistorySyncNotification) {
	if id != "" {
		if _, seen := e.queued.LoadOrStore(id, true); seen {
			return
		}
	}
	e.downloads.addKept(id, n)
}

// pushHanded records how a download ended and, once the push is handed on, acknowledges it: WhatsApp announces an
// unacknowledged push again, which is what a run that dies mid-download relies on.
func (e *engine) pushHanded(ctx context.Context, id string, ok bool) {
	if !ok {
		e.pushes.failed(ctx, id)
		e.queued.Delete(id)
		return
	}
	e.pushes.handed(ctx, id)
	if id != "" {
		if err := e.client.SendProtocolMessageReceipt(ctx, types.MessageID(id), types.ReceiptTypeHistorySync); err != nil {
			fmt.Fprintln(os.Stderr, "wa-engine: a history push was kept but could not be acknowledged")
		}
	}
}
