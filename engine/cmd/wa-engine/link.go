package main

import (
	"errors"
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
			if err := e.awaitLogin(e.client.WaitForConnection, 250*time.Millisecond, 2*connectWait); err != nil {
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

// awaitLogin waits out the stream restart (code 515) WhatsApp sends right after pairing. whatsmeow answers it by
// disconnecting and connecting again on its own, and WaitForConnection returns false at once while that disconnect is
// under way, so only the deadline means the link could not reconnect.
func (e *engine) awaitLogin(wait func(time.Duration) bool, slice, within time.Duration) error {
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
			return &failure{"network_error", "linked, but could not reconnect to WhatsApp in time"}
		}
		select {
		case <-time.After(time.Until(started.Add(slice))):
		case <-e.ctx.Done():
		}
	}
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
