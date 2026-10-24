package main

import (
	"go.mau.fi/whatsmeow/types/events"
)

type waStar struct {
	Chat    string `json:"chat"`
	Message string `json:"message"`
	Starred bool   `json:"starred"`
}

type waDeletion struct {
	Chat    string `json:"chat"`
	Message string `json:"message"`
}

func (e *engine) snapshotChange(raw any) bool {
	switch evt := raw.(type) {
	case *events.Star:
		if !evt.FromFullSync {
			return false
		}
		if chat, ok := e.appStateChat(evt.ChatJID, evt.MessageID); ok && evt.Action != nil {
			e.mu.Lock()
			e.snapshot.Stars = append(e.snapshot.Stars, waStar{Chat: chat, Message: evt.MessageID, Starred: evt.Action.GetStarred()})
			e.mu.Unlock()
		}
		return true
	case *events.DeleteForMe:
		if !evt.FromFullSync {
			return false
		}
		if chat, ok := e.appStateChat(evt.ChatJID, evt.MessageID); ok && evt.Action != nil {
			e.snapshotDeletion(chat, evt.MessageID)
		}
		return true
	}
	return false
}

func (e *engine) snapshotDeletion(chat, message string) {
	e.mu.Lock()
	e.snapshot.Deletions = append(e.snapshot.Deletions, waDeletion{Chat: chat, Message: message})
	e.mu.Unlock()
}

func (e *engine) flushSnapshot() {
	e.mu.Lock()
	snapshot := e.snapshot
	e.snapshot = waHistory{}
	e.mu.Unlock()
	if len(snapshot.Stars) == 0 && len(snapshot.Deletions) == 0 {
		return
	}
	snapshot.Kind = "other"
	snapshot.Chats = []waChat{}
	snapshot.Contacts = []waContact{}
	snapshot.Messages = []waMessage{}
	snapshot.Votes = []waVote{}
	e.out.event("history", snapshot)
}
