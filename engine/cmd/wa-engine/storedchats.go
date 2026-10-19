package main

import (
	"context"
	"time"

	"go.mau.fi/whatsmeow/types"
)

// lidQueryChunk keeps one query of whatsmeow's LID map well under SQLite's limit on bound parameters.
const lidQueryChunk = 500

type storedChatsFields struct {
	// storedChats: every chat id cli-core's store holds for this account.
	Chats []string `json:"chats,omitempty"`
}

func (e *engine) dispatchStoredChats(req request) (any, bool, error) {
	switch req.Op {
	case "storedChats":
		return nil, true, e.storedChats(req.Chats)
	}
	return nil, false, nil
}

// storedChats takes the chats cli-core stored, once as `serve` or `watch` starts. The engine cannot read that store, so
// a chat it stored in phone form before wa_phone_chats existed reaches the re-keys and the lookups only this way, if
// nothing names it again (§5). A chat whose LID whatsmeow knows re-keys at once; the rest wait for the paced lookups,
// which ask only for chats the account has, as these are. The CLI waits at most 5 s for this at shutdown, and the
// account may hold thousands of chats: one bulk read of the LID map, then one transaction.
func (e *engine) storedChats(chats []string) error {
	if e.phones == nil || !e.linked() {
		return nil
	}
	users := phoneUsers(chats)
	if len(users) == 0 {
		return nil
	}
	known, err := e.knownLIDs(users)
	if err != nil {
		return err
	}
	rekeys, err := e.phones.adopt(e.ctx, users, known, time.Now())
	if err != nil {
		return err
	}
	for _, rekey := range rekeys {
		e.out.rekey(rekey)
	}
	// Lookups otherwise start only after a history push, and a `serve` that reconnects may get none.
	e.lookLater()
	return nil
}

// phoneUsers are the user parts of the one-to-one chats in phone form, once each: not groups, LIDs or channels.
func phoneUsers(chats []string) []string {
	seen := map[string]bool{}
	var users []string
	for _, chat := range chats {
		jid, err := types.ParseJID(chat)
		if err != nil || jid.Server != types.DefaultUserServer || jid.User == "" || seen[jid.User] {
			continue
		}
		seen[jid.User] = true
		users = append(users, jid.User)
	}
	return users
}

func (e *engine) knownLIDs(users []string) (known, error) {
	found := known{}
	for start := 0; start < len(users); start += lidQueryChunk {
		chunk := users[start:min(start+lidQueryChunk, len(users))]
		pns := make([]types.JID, len(chunk))
		for i, user := range chunk {
			pns[i] = types.NewJID(user, types.DefaultUserServer)
		}
		lids, err := e.client.Store.LIDs.GetManyLIDsForPNs(e.ctx, pns)
		if err != nil {
			return nil, err
		}
		for pn, lid := range lids {
			if lid.Server == types.HiddenUserServer && lid.User != "" {
				found[pn.User] = lid.ToNonAD()
			}
		}
	}
	return found, nil
}

// adopt records the stored phone-form chats in one transaction, so the CLI's 5 s wait holds for thousands. A chat with
// a known LID is recorded re-keyed and announced; one re-keyed before is announced again, since the store still holding
// it in phone form means the CLI missed that announcement; the rest are recorded pending, for the lookups. whatsmeow is
// never called inside the transaction: it writes the same file through other connections.
func (p *phoneChats) adopt(ctx context.Context, users []string, lids known, now time.Time) ([]waRekey, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	pending, err := tx.PrepareContext(ctx, `INSERT OR IGNORE INTO wa_phone_chats (pn) VALUES (?)`)
	if err != nil {
		return nil, err
	}
	defer pending.Close()
	rekeyed, err := tx.PrepareContext(ctx, `INSERT INTO wa_phone_chats (pn, lid, rekeyed_at) VALUES (?, ?, ?)
		ON CONFLICT (pn) DO UPDATE SET lid = excluded.lid, rekeyed_at = excluded.rekeyed_at`)
	if err != nil {
		return nil, err
	}
	defer rekeyed.Close()

	var rekeys []waRekey
	added, settled := []string{}, map[string]string{}
	for _, user := range users {
		if lid, ok := p.rekeyed[user]; ok {
			rekeys = append(rekeys, rekeyOf(user, lid))
			continue
		}
		if lid, ok := lids[user]; ok {
			if _, err := rekeyed.ExecContext(ctx, user, lid.User, now.Unix()); err != nil {
				return nil, err
			}
			settled[user] = lid.User
			rekeys = append(rekeys, rekeyOf(user, lid.User))
			continue
		}
		if p.pending[user] {
			continue
		}
		if _, err := pending.ExecContext(ctx, user); err != nil {
			return nil, err
		}
		added = append(added, user)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	for user, lid := range settled {
		delete(p.pending, user)
		p.rekeyed[user] = lid
	}
	for _, user := range added {
		p.pending[user] = true
	}
	return rekeys, nil
}
