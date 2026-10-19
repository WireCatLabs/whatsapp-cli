package main

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
)

func (e *engine) link(method, phone string) (*waAccount, error) {
	if e.linked() {
		return e.me()
	}
	qr, err := e.client.GetQRChannel(e.ctx)
	if err != nil {
		return nil, err
	}
	if err := e.client.ConnectContext(e.ctx); err != nil {
		return nil, err
	}
	phone = strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)
	requested := false
	for item := range qr {
		switch {
		case item.Event == whatsmeow.QRChannelEventCode && method == "phone":
			if requested {
				continue
			}
			code, err := e.client.PairPhone(e.ctx, phone, true, whatsmeow.PairClientChrome, "Chrome ("+osName()+")")
			if err != nil {
				return nil, pairingFailure(err)
			}
			requested = true
			e.out.loginCode("pair", code)
		case item.Event == whatsmeow.QRChannelEventCode:
			e.out.loginCode("qr", item.Code)
		case item == whatsmeow.QRChannelSuccess:
			late := "linked, but could not reconnect to WhatsApp in time"
			retry := &loginRetry{connected: e.client.IsConnected, after: retryAfter,
				reconnect: func() error { return e.client.ConnectContext(e.ctx) }}
			if err := e.awaitLogin(e.client.WaitForConnection, waitSlice, 2*connectWait, late, retry); err != nil {
				return nil, err
			}
			e.refreshSelf()
			return e.me()
		case item == whatsmeow.QRChannelTimeout:
			return nil, &failure{"timeout", "the login code expired before the phone confirmed it"}
		default:
			return nil, &failure{"authentication_error", "WhatsApp did not accept the link; try again"}
		}
	}
	return nil, &failure{"timeout", "the login ended before the phone confirmed it"}
}

const waitSlice = 250 * time.Millisecond

// awaitLogin waits in slices, so a refusal WhatsApp sends while connecting answers at once rather than after the
// whole wait. WaitForConnection returns false at once while a disconnect whatsmeow expects is under way, as on the
// stream restart (code 515) WhatsApp sends right after pairing, which whatsmeow answers by connecting again on its own.
// A slice that ends early is padded to its length, so the loop does not spin, and only the deadline means it failed.
// A retry, when given, connects once more if the client stays down after the restart (see loginRetry).
func (e *engine) awaitLogin(wait func(time.Duration) bool, slice, within time.Duration, late string,
	retry *loginRetry) error {
	deadline := time.Now().Add(within)
	for {
		started := time.Now()
		if wait(slice) {
			return nil
		}
		if ended := e.endedBy(); ended != nil {
			return ended
		}
		if err := e.ctx.Err(); err != nil {
			return err
		}
		if time.Now().After(deadline) {
			return &failure{"network_error", late}
		}
		retry.poll()
		select {
		case <-time.After(time.Until(started.Add(slice))):
		case <-e.ctx.Done():
		}
	}
}

const retryAfter = 3 * time.Second

// loginRetry covers whatsmeow's reconnect after the 515 restart, which only logs a failure and never tries again
// (connectionevents.go, handleStreamError), so the link would sit out its whole deadline. Once the client has been
// down for `after`, it connects once more, in the background so the deadline still holds. It cannot open a second
// connection: whatsmeow connects under its socket lock and refuses while a socket is live (ErrAlreadyConnected), and
// IsConnected waits on that lock while whatsmeow's own reconnect is under way, so that time does not count as down.
type loginRetry struct {
	connected func() bool
	reconnect func() error
	after     time.Duration
	downSince time.Time
	tried     bool
}

func (r *loginRetry) poll() {
	if r == nil || r.tried {
		return
	}
	if r.connected() {
		r.downSince = time.Time{}
		return
	}
	if r.downSince.IsZero() {
		r.downSince = time.Now()
		return
	}
	if time.Since(r.downSince) < r.after {
		return
	}
	r.tried = true
	go func() {
		if err := r.reconnect(); err != nil && !errors.Is(err, whatsmeow.ErrAlreadyConnected) {
			fmt.Fprintln(os.Stderr, "wa-engine: could not reconnect to WhatsApp after linking")
		}
	}()
}

func pairingFailure(err error) error {
	if errors.Is(err, whatsmeow.ErrPhoneNumberTooShort) || errors.Is(err, whatsmeow.ErrPhoneNumberIsNotInternational) {
		return &failure{"validation_error", "the phone number must be in international format, country code first"}
	}
	return err
}

func (e *engine) me() (*waAccount, error) {
	if !e.linked() {
		return nil, whatsmeow.ErrNotLoggedIn
	}
	e.refreshSelf()
	if e.conv.self.IsEmpty() {
		return nil, &failure{"provider_error", "WhatsApp has not given this account its hidden id (LID) yet"}
	}
	return &waAccount{JID: e.conv.self.String(), Name: name(e.client.Store.PushName)}, nil
}
