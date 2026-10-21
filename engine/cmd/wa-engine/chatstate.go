package main

import (
	"time"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// chatStateChanged passes on an archive, a mute or a mark-read made on another device. The chat id is recorded as
// appStateChat records a star's, so a chat stored in phone form still re-keys.
func (e *engine) chatStateChanged(raw any) {
	jid, chat, ok := e.conv.chatState(raw, time.Now())
	if !ok {
		return
	}
	e.phones.note(e.ctx, jid.ToNonAD().String())
	e.pushChats([]waChat{chat})
}

// chatState reads the change as a notice that carries only the flag it names, so the store keeps the chat's name,
// count and activity. A pin and a mark-unread are not passed on: cli-core's chat has no field for either.
func (c *converter) chatState(raw any, now time.Time) (types.JID, waChat, bool) {
	var jid types.JID
	notice := waChat{notice: true}
	switch evt := raw.(type) {
	case *events.Archive:
		if evt.Action == nil {
			return jid, notice, false
		}
		archived := evt.Action.GetArchived()
		jid, notice.Archived = evt.JID, &archived
	case *events.Mute:
		if evt.Action == nil {
			return jid, notice, false
		}
		muted := evt.Action.GetMuted() && mutedUntil(evt.Action.GetMuteEndTimestamp(), now)
		jid, notice.Muted = evt.JID, &muted
	case *events.MarkChatAsRead:
		if !evt.Action.GetRead() {
			return jid, notice, false
		}
		none := 0
		jid, notice.Unread = evt.JID, &none
	default:
		return jid, notice, false
	}
	if jid.IsEmpty() || jid.User == "" || jid == types.StatusBroadcastJID {
		return jid, notice, false
	}
	canonical := c.canonical(jid, nil)
	notice.JID, notice.Kind = canonical.String(), c.kindOf(canonical)
	return jid, notice, true
}

// mutedUntil reads app state's end as whatsmeow does (appstate.go, dispatchAppState): milliseconds, and below zero
// for good. The history push's end is in seconds and goes through mutedAt instead.
func mutedUntil(endMs int64, now time.Time) bool {
	return endMs < 0 || time.UnixMilli(endMs).After(now)
}
