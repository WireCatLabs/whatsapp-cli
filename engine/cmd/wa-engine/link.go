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
			late := "linked, but could not reconnect to WhatsApp in time"
			if err := e.awaitLogin(e.client.WaitForConnection, waitSlice, 2*connectWait, late); err != nil {
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
func (e *engine) awaitLogin(wait func(time.Duration) bool, slice, within time.Duration, late string) error {
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
