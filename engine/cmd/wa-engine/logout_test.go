package main

import (
	"context"
	"io"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func linkedOffline() *engine {
	id := types.NewJID("100000000000001", types.DefaultUserServer)
	return &engine{ctx: context.Background(), client: whatsmeow.NewClient(&store.Device{ID: &id}, waLog.Noop),
		out: newWire(io.Discard)}
}

func TestALogoutWhatsAppAlreadyDroppedAnswersLoggedOutNotMaybeSent(t *testing.T) {
	for _, dropped := range []any{
		&events.LoggedOut{Reason: events.ConnectFailureLoggedOut},
		&events.ConnectFailure{Reason: events.ConnectFailureLoggedOut},
	} {
		e := linkedOffline()
		e.handle(dropped)
		_, err := e.dispatch(request{Op: "logout"})
		if got := e.refusalFor("logout", err); got.Code != "authentication_error" || got.Reason != "device.logged-out" {
			t.Errorf("a logout after %T became %+v", dropped, got)
		}
	}
}

func TestALogoutOfADeviceNeverLinkedAnswersNotLinked(t *testing.T) {
	e := &engine{ctx: context.Background(), client: &whatsmeow.Client{Store: &store.Device{}}, out: newWire(io.Discard)}
	_, err := e.dispatch(request{Op: "logout"})
	if got := e.refusalFor("logout", err); got.Code != "authentication_error" {
		t.Errorf("a logout with no device became %+v", got)
	}
}
