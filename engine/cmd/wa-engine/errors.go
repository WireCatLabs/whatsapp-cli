package main

import (
	"context"
	"errors"

	"go.mau.fi/whatsmeow"
)

// writes are the requests that change something on WhatsApp; WRITES in src/engine/go-engine.ts is the same list.
var writes = map[string]bool{
	"send": true, "sendMedia": true, "sendAlbum": true, "forward": true, "edit": true, "revoke": true, "react": true,
	"read": true, "createPoll": true, "vote": true, "pin": true, "unpin": true, "createGroup": true, "join": true,
	"leave": true, "updateGroup": true, "resetLink": true, "setGroupPhoto": true, "participants": true,
	"answerRequest": true, "block": true, "setPrivacy": true, "logout": true, "mute": true,
	"updateProfile": true,
}

var cutWrite = &refusal{failure: failure{"outcome_unknown",
	"the connection to WhatsApp broke before it confirmed the change; it may have gone through — check first"}}

// refusalFor answers a request cut off by WhatsApp ending the connection with why it ended: "not connected" would
// send an agent to retry into a login another process now holds, or into a ban. A write cut off on its way may have
// reached WhatsApp already, so that comes first: a retry could send it twice.
func (e *engine) refusalFor(op string, err error) *refusal {
	if writes[op] && cutOff(err) {
		return cutWrite
	}
	refused := classify(err)
	if ended := e.endedBy(); ended != nil && refused.Code == "network_error" {
		return ended
	}
	return refused
}

// cutOff says the request may have left before the connection or the engine stopped. whatsmeow sends a frame again
// after a reconnect and gives up with DisconnectedError, or ErrNotConnected when the socket is gone by then; a group
// write is an info query, which WhatsApp may have applied when its answer timed out. The engine's own refusals
// (*failure, *refusal) all come before anything is sent.
func cutOff(err error) bool {
	var disconnected *whatsmeow.DisconnectedError
	return errors.As(err, &disconnected) || errors.Is(err, whatsmeow.ErrNotConnected) ||
		errors.Is(err, whatsmeow.ErrIQTimedOut) || errors.Is(err, context.Canceled) ||
		errors.Is(err, context.DeadlineExceeded)
}

// classify puts any error into the contract's closed list, in fixed wording: whatsmeow's own text can carry a JID.
func classify(err error) *refusal {
	var reasoned *refusal
	if errors.As(err, &reasoned) {
		return reasoned
	}
	refused := classifyFailure(err)
	var iq *whatsmeow.IQError
	// WhatsApp's own 429, not the engine's lookup pace (people.go): only WhatsApp's holds the account's writes.
	if errors.As(err, &iq) && iq.Code == 429 {
		return &refusal{failure: *refused, Reason: "account.rate-limited"}
	}
	return &refusal{failure: *refused}
}

func classifyFailure(err error) *failure {
	var known *failure
	var iq *whatsmeow.IQError
	var disconnected *whatsmeow.DisconnectedError
	switch {
	case errors.As(err, &known):
		return known
	case errors.Is(err, whatsmeow.ErrMessageTimedOut):
		return &failure{"outcome_unknown", "WhatsApp did not confirm the message; it may have been sent"}
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, whatsmeow.ErrIQTimedOut):
		return &failure{"timeout", "WhatsApp did not answer in time"}
	case errors.Is(err, whatsmeow.ErrNotLoggedIn):
		return &failure{"authentication_error", "this profile is not linked to WhatsApp"}
	case errors.Is(err, whatsmeow.ErrNotConnected), errors.As(err, &disconnected):
		return &failure{"network_error", "not connected to WhatsApp"}
	case errors.Is(err, whatsmeow.ErrGroupNotFound):
		return &failure{"not_found", "WhatsApp has no such chat"}
	case errors.Is(err, whatsmeow.ErrNotInGroup), errors.Is(err, whatsmeow.ErrNoPermissionInGroup):
		return &failure{"permission_error", "this account may not do that in the chat"}
	case errors.As(err, &iq):
		switch iq.Code {
		case 401:
			return &failure{"authentication_error", "WhatsApp no longer accepts this linked device"}
		case 403:
			return &failure{"permission_error", "WhatsApp refused: not allowed"}
		case 404:
			return &failure{"not_found", "WhatsApp has no such chat"}
		case 429:
			return &failure{"rate_limited", "WhatsApp asks to slow down"}
		}
	}
	return &failure{"provider_error", "WhatsApp refused the request"}
}
