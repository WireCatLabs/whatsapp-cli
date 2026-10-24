package main

import (
	"context"
	"database/sql"
	"sync"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

type waLabel struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Type  int32    `json:"type"`
	Chats []string `json:"chats"`
}

type labelStore struct {
	db             *sql.DB
	mu             sync.Mutex
	snapshot       []any
	snapshotFailed bool
}

func openLabels(ctx context.Context, db *sql.DB, unlinked bool) (*labelStore, error) {
	for _, query := range []string{
		`CREATE TABLE IF NOT EXISTS wa_labels (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', type INTEGER NOT NULL DEFAULT 0, color INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0)`,
		`CREATE TABLE IF NOT EXISTS wa_label_members (label TEXT NOT NULL, chat TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', PRIMARY KEY(label, chat, message))`,
		`CREATE TABLE IF NOT EXISTS wa_label_state (collection TEXT PRIMARY KEY)`,
	} {
		if _, err := db.ExecContext(ctx, query); err != nil {
			return nil, err
		}
	}
	if unlinked {
		for _, table := range []string{"wa_labels", "wa_label_members", "wa_label_state"} {
			if _, err := db.ExecContext(ctx, "DELETE FROM "+table); err != nil {
				return nil, err
			}
		}
	}
	return &labelStore{db: db}, nil
}

func labelFromSnapshot(raw any) bool {
	switch evt := raw.(type) {
	case *events.LabelEdit:
		return evt.FromFullSync
	case *events.LabelAssociationChat:
		return evt.FromFullSync
	case *events.LabelAssociationMessage:
		return evt.FromFullSync
	}
	return false
}

func (s *labelStore) update(ctx context.Context, raw any) error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if labelFromSnapshot(raw) {
		s.snapshot = append(s.snapshot, raw)
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := applyLabel(ctx, tx, raw); err != nil {
		return err
	}
	return tx.Commit()
}

func applyLabel(ctx context.Context, tx *sql.Tx, raw any) error {
	switch evt := raw.(type) {
	case *events.LabelEdit:
		if evt.Action == nil || evt.LabelID == "" {
			return nil
		}
		action := evt.Action
		if action.GetDeleted() {
			if _, err := tx.ExecContext(ctx, `DELETE FROM wa_label_members WHERE label = ?`, evt.LabelID); err != nil {
				return err
			}
			_, err := tx.ExecContext(ctx, `DELETE FROM wa_labels WHERE id = ?`, evt.LabelID)
			return err
		}
		var kind *int32
		if action.Type != nil {
			value := int32(*action.Type)
			kind = &value
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO wa_labels (id,name,type,color,position) VALUES (?,COALESCE(?,''),COALESCE(?,0),COALESCE(?,0),COALESCE(?,0))
   ON CONFLICT(id) DO UPDATE SET name=COALESCE(?,name), type=COALESCE(?,type), color=COALESCE(?,color), position=COALESCE(?,position)`,
			evt.LabelID, action.Name, kind, action.Color, action.OrderIndex, action.Name, kind, action.Color, action.OrderIndex)
		return err
	case *events.LabelAssociationChat:
		return applyLabelMember(ctx, tx, evt.LabelID, evt.JID.ToNonAD().String(), "", evt.Action)
	case *events.LabelAssociationMessage:
		return applyLabelMember(ctx, tx, evt.LabelID, evt.JID.ToNonAD().String(), evt.MessageID, evt.Action)
	}
	return nil
}

func applyLabelMember(ctx context.Context, tx *sql.Tx, label, chat, message string, action *waSyncAction.LabelAssociationAction) error {
	if action == nil || label == "" || chat == "" {
		return nil
	}
	if action.GetLabeled() {
		_, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO wa_label_members (label,chat,message) VALUES (?,?,?)`, label, chat, message)
		return err
	}
	_, err := tx.ExecContext(ctx, `DELETE FROM wa_label_members WHERE label=? AND chat=? AND message=?`, label, chat, message)
	return err
}

func (s *labelStore) complete(ctx context.Context) error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, table := range []string{"wa_labels", "wa_label_members"} {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+table); err != nil {
			return err
		}
	}
	for _, raw := range s.snapshot {
		if err := applyLabel(ctx, tx, raw); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO wa_label_state (collection) VALUES ('regular')`); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	s.snapshot = nil
	s.snapshotFailed = false
	return nil
}

func (s *labelStore) failed() {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snapshot = nil
	s.snapshotFailed = true
}

func (s *labelStore) ready(ctx context.Context) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM wa_label_state WHERE collection='regular'`).Scan(&count)
	return count > 0 && !s.snapshotFailed, err
}

func (s *labelStore) lists(ctx context.Context) ([]waLabel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows, err := s.db.QueryContext(ctx, `SELECT id,name,type FROM wa_labels WHERE type=? ORDER BY position,id`, int32(waSyncAction.LabelEditAction_CUSTOM))
	if err != nil {
		return nil, err
	}
	result := []waLabel{}
	for rows.Next() {
		label := waLabel{Chats: []string{}}
		if err := rows.Scan(&label.ID, &label.Name, &label.Type); err != nil {
			rows.Close()
			return nil, err
		}
		result = append(result, label)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	for i := range result {
		members, err := s.db.QueryContext(ctx, `SELECT chat FROM wa_label_members WHERE label=? AND message='' ORDER BY chat`, result[i].ID)
		if err != nil {
			return nil, err
		}
		for members.Next() {
			var chat string
			if err := members.Scan(&chat); err != nil {
				members.Close()
				return nil, err
			}
			result[i].Chats = append(result[i].Chats, chat)
		}
		err = members.Err()
		members.Close()
		if err != nil {
			return nil, err
		}
	}
	return result, nil
}

func (e *engine) folders() ([]waLabel, error) {
	if e.labels == nil {
		return nil, &failure{"provider_unavailable", "the device store cannot keep WhatsApp Lists"}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	ready, err := e.labels.ready(e.ctx)
	if err != nil {
		return nil, err
	}
	if !ready {
		if err := e.client.FetchAppState(e.ctx, appstate.WAPatchRegular, true, false); err != nil {
			e.labels.failed()
			return nil, err
		}
		ready, err = e.labels.ready(e.ctx)
		if err != nil {
			return nil, err
		}
		if !ready {
			return nil, keysMissing
		}
	}
	labels, err := e.labels.lists(e.ctx)
	if err != nil {
		return nil, err
	}
	for i := range labels {
		for j, raw := range labels[i].Chats {
			jid, err := types.ParseJID(raw)
			if err == nil {
				labels[i].Chats[j] = e.conv.canonical(jid, nil).String()
			}
		}
	}
	return labels, nil
}
