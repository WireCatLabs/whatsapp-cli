package main

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// rekeyRepeat is how long a re-key is announced again at each start. The CLI may not have been listening when it
// was first announced — a one-shot command saves no history — and cli-core takes a repeat as a no-op.
const rekeyRepeat = 30 * 24 * time.Hour

// waRekey says that the one-to-one chat the engine emitted as `From` (phone form) is now `To` (its LID).
type waRekey struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// phoneChats are the one-to-one chats the engine has emitted under a phone JID, kept in private.db beside whatsmeow's
// own LID map: that file already holds the account's phone numbers, at mode 0600, and `session end` deletes it. A
// logout from WhatsApp's side leaves the file, so a device not yet linked starts the table empty: another account may
// link next. A chat leaves the pending set once WhatsApp gives its person a LID, and is never emitted in phone form
// again: `rekeyed` answers for it wherever whatsmeow's store does not.
type phoneChats struct {
	db      *sql.DB
	mu      sync.Mutex
	pending map[string]bool   // by the phone JID's user part
	rekeyed map[string]string // phone JID's user part to the LID's
}

func openPhoneChats(ctx context.Context, db *sql.DB, unlinked bool) (*phoneChats, error) {
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS wa_phone_chats (
		pn TEXT PRIMARY KEY, lid TEXT, rekeyed_at INTEGER)`); err != nil {
		return nil, err
	}
	if unlinked {
		if _, err := db.ExecContext(ctx, `DELETE FROM wa_phone_chats`); err != nil {
			return nil, err
		}
	}
	rows, err := db.QueryContext(ctx, `SELECT pn, lid FROM wa_phone_chats`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	p := &phoneChats{db: db, pending: map[string]bool{}, rekeyed: map[string]string{}}
	for rows.Next() {
		var pn string
		var lid sql.NullString
		if err := rows.Scan(&pn, &lid); err != nil {
			return nil, err
		}
		if lid.Valid {
			p.rekeyed[pn] = lid.String
		} else {
			p.pending[pn] = true
		}
	}
	return p, rows.Err()
}

// lidOf is the LID a chat was re-keyed to, if it was.
func (p *phoneChats) lidOf(user string) (types.JID, bool) {
	if p == nil {
		return types.JID{}, false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	lid, ok := p.rekeyed[user]
	return types.NewJID(lid, types.HiddenUserServer), ok
}

// note records a chat id about to leave the engine, if it is in phone form.
func (p *phoneChats) note(ctx context.Context, chat string) {
	jid, err := types.ParseJID(chat)
	if p == nil || err != nil || jid.Server != types.DefaultUserServer || jid.User == "" {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.pending[jid.User] {
		return
	}
	if _, err := p.db.ExecContext(ctx, `INSERT OR IGNORE INTO wa_phone_chats (pn) VALUES (?)`, jid.User); err == nil {
		p.pending[jid.User] = true
	}
}

// settle re-keys each pending chat whose person now has a LID.
func (p *phoneChats) settle(ctx context.Context, lidOf func(user string) (types.JID, bool), now time.Time) []waRekey {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	var rekeys []waRekey
	for user := range p.pending {
		lid, ok := lidOf(user)
		if !ok || lid.Server != types.HiddenUserServer {
			continue
		}
		lid = lid.ToNonAD()
		if _, err := p.db.ExecContext(ctx, `UPDATE wa_phone_chats SET lid = ?, rekeyed_at = ? WHERE pn = ?`,
			lid.User, now.Unix(), user); err != nil {
			continue
		}
		delete(p.pending, user)
		p.rekeyed[user] = lid.User
		rekeys = append(rekeys, rekeyOf(user, lid.User))
	}
	return rekeys
}

// recent is every re-key announced within rekeyRepeat. Older ones are not repeated, but stay, so their chat keeps its
// LID even if whatsmeow's store loses the mapping.
func (p *phoneChats) recent(ctx context.Context, now time.Time) []waRekey {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	since := now.Add(-rekeyRepeat).Unix()
	rows, err := p.db.QueryContext(ctx,
		`SELECT pn, lid FROM wa_phone_chats WHERE lid IS NOT NULL AND rekeyed_at >= ?`, since)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var rekeys []waRekey
	for rows.Next() {
		var pn, lid string
		if rows.Scan(&pn, &lid) == nil {
			rekeys = append(rekeys, rekeyOf(pn, lid))
		}
	}
	return rekeys
}

func rekeyOf(pn, lid string) waRekey {
	return waRekey{
		From: types.NewJID(pn, types.DefaultUserServer).String(),
		To:   types.NewJID(lid, types.HiddenUserServer).String(),
	}
}

// lidOf answers from what a batch or a message says first, then from whatsmeow's store, which keeps every mapping
// WhatsApp sends — in history, in a message's alternate address, in a lookup's answer — before the event reaches us.
func (e *engine) lidOf(k known) func(user string) (types.JID, bool) {
	return func(user string) (types.JID, bool) {
		if lid, ok := k[user]; ok {
			return lid, true
		}
		return e.storedLID(types.NewJID(user, types.DefaultUserServer))
	}
}

// announce, at start, repeats the recent re-keys and makes those whatsmeow learned while no engine ran.
func (e *engine) announce() {
	now := time.Now()
	for _, rekey := range e.phones.recent(e.ctx, now) {
		e.out.rekey(rekey)
	}
	for _, rekey := range e.phones.settle(e.ctx, e.lidOf(nil), now) {
		e.out.rekey(rekey)
	}
}

// liveMessage converts a message; a re-key it reveals goes out before it. The CLI saves the two on separate paths, so
// the message may land first, in a new chat under the LID: the re-key then merges the two.
func (e *engine) liveMessage(evt *events.Message) (change, bool) {
	k := known{}
	changed, ok := e.conv.message(evt, k)
	for _, rekey := range e.phones.settle(e.ctx, e.lidOf(k), time.Now()) {
		e.out.rekey(rekey)
	}
	if ok {
		e.phones.note(e.ctx, changed.message.Chat)
	}
	return changed, ok
}

// historyRekeys settles before noting the push's own chats: those were converted with the push's mappings already.
func (e *engine) historyRekeys(h waHistory) []waRekey {
	rekeys := e.phones.settle(e.ctx, e.lidOf(h.learned), time.Now())
	for _, chat := range h.Chats {
		e.phones.note(e.ctx, chat.JID)
	}
	// An on-demand push answers `messages sync`, a one-shot command: lookups wait for the pushes `serve` gets.
	if h.Kind != "on_demand" {
		e.lookLater()
	}
	return rekeys
}

// namedByChat are the requests whose `chat` is a chat the CLI's store already holds, and namedByJID those whose `jid`
// is. A send, a file, a forward or a poll records its own chat; a chat card, a profile or a block may name a number
// the owner typed, which would widen the lookups past the account's chats.
var (
	namedByChat = map[string]bool{
		"older": true, "read": true, "react": true, "edit": true, "revoke": true, "star": true, "deleteForMe": true,
		"deleteChat": true, "clearChat": true, "archiveChat": true, "unarchiveChat": true, "markChatRead": true,
		"markChatUnread": true, "pin": true, "unpin": true, "vote": true,
	}
	namedByJID = map[string]bool{"mute": true, "pinChat": true, "unpinChat": true}
)

// noteNamed records the chat a request that went through names. The CLI may have stored it in phone form before the
// engine kept the table, and the engine cannot read that store: this is how such a chat reaches the re-keys and the
// lookups, once the owner or the store touches it.
func (e *engine) noteNamed(req request) {
	if namedByChat[req.Op] {
		e.phones.note(e.ctx, req.Chat)
	}
	if namedByJID[req.Op] {
		e.phones.note(e.ctx, req.JID)
	}
}

// appStateChat is the chat of a star or a delete for the owner alone made on another device. The CLI's store holds the
// message, so it holds the chat, perhaps in the phone form WhatsApp names it by: that is the id recorded, so a chat
// stored so before the table existed re-keys even when its LID is known already.
func (e *engine) appStateChat(chat types.JID, id string) (string, bool) {
	named, ok := e.conv.appStateMessage(chat, id)
	if ok {
		e.phones.note(e.ctx, chat.ToNonAD().String())
	}
	return named, ok
}

func (w *wire) rekey(r waRekey) { w.send(map[string]any{"event": "rekey", "from": r.From, "to": r.To}) }
