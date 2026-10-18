package main

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/types"
)

// settingsFields are the request fields of the app-state writes.
type settingsFields struct {
	// mute: "forever", an RFC 3339 time, or null to unmute.
	Until *string `json:"until"`
	// updateProfile: the name everyone sees and the "about" line; either may be left out.
	PushName *string `json:"pushName,omitempty"`
	About    *string `json:"about,omitempty"`
}

var keysMissing = because("settings.keys-missing", "provider_unavailable",
	"WhatsApp has not sent the settings keys yet; keep serve running a few minutes and try again")

// whatsmeow says so in two ways: with no key at all, a plain error (appstate.go, sendAppState); with a key id whose
// data is missing, appstate.ErrKeyNotFound.
const noKeysYet = "no app state keys found"

// The server took the patch, and only reading the collection back failed (appstate.go, sendAppState).
const sentNotReadBack = "failed to fetch app state after sending update"

// The patch left and no answer came: the server may have applied it (WC-LIFE-9).
var unconfirmed = &failure{"outcome_unknown", "WhatsApp did not confirm the change; it may have been made"}

// sendAppState sends one app-state patch: a change to the account's synced settings, which WhatsApp syncs to the
// account's other devices. Every app-state write goes through it.
func (e *engine) sendAppState(patch appstate.PatchInfo) error {
	if err := e.connect(); err != nil {
		return err
	}
	return appStateFailure(e.client.SendAppState(e.ctx, patch))
}

func appStateFailure(err error) error {
	switch {
	case err == nil:
		return nil
	case strings.HasPrefix(err.Error(), sentNotReadBack):
		// Reported as done: a retry of a deletion would act on what the first one left.
		return nil
	case errors.Is(err, appstate.ErrKeyNotFound), strings.HasPrefix(err.Error(), noKeysYet):
		return keysMissing
	case unanswered(err):
		return unconfirmed
	}
	return err
}

// unanswered: the request left and no answer came, so WhatsApp may have acted on it (WC-LIFE-9).
func unanswered(err error) bool {
	var disconnected *whatsmeow.DisconnectedError
	return errors.Is(err, whatsmeow.ErrIQTimedOut) || errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, context.Canceled) || errors.As(err, &disconnected)
}

func (e *engine) dispatchSettings(req request) (any, bool, error) {
	switch req.Op {
	case "mute":
		return nil, true, e.mute(req)
	case "updateProfile":
		value, err := e.updateProfile(req)
		return value, true, err
	case "deleteChat", "clearChat":
		return nil, true, e.deleteChat(req)
	case "deleteForMe":
		return nil, true, e.deleteForMe(req)
	}
	return nil, false, nil
}

func (e *engine) mute(req request) error {
	chat, err := types.ParseJID(req.JID)
	if err != nil || chat.User == "" {
		return &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if chat.Server == types.NewsletterServer || chat.Server == types.BroadcastServer {
		return &failure{"validation_error", "wa mutes chats and groups; mute a channel on the phone"}
	}
	muted, end, err := muteEnd(req.Until, time.Now())
	if err != nil {
		return err
	}
	return e.sendAppState(appstate.BuildMuteAbs(chat, muted, end))
}

// muteEnd reads `until` as whatsmeow's BuildMuteAbs takes it: no end with muted is forever (it writes -1), and an end
// is in milliseconds, as WhatsApp's own clients write it.
func muteEnd(until *string, now time.Time) (bool, *int64, error) {
	if until == nil {
		return false, nil, nil
	}
	if *until == "forever" {
		return true, nil, nil
	}
	at, err := time.Parse(time.RFC3339Nano, *until)
	if err != nil {
		return false, nil, &failure{"validation_error", "a mute ends at a time like 2026-09-25T09:00:00Z, or never"}
	}
	if !at.After(now) {
		return false, nil, &failure{"validation_error", "a mute has to end in the future"}
	}
	ms := at.UnixMilli()
	return true, &ms, nil
}
