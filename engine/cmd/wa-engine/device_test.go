package main

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	waLog "go.mau.fi/whatsmeow/util/log"
)

func TestSecondHolderIsRefusedAndToldWhoHoldsIt(t *testing.T) {
	path := filepath.Join(t.TempDir(), "private.db")
	first, refused := holdLock(path, "serve")
	if refused != nil {
		t.Fatal(refused)
	}
	defer first.Close()
	_, refused = holdLock(path, "messages send")
	if refused == nil || refused.Code != "provider_unavailable" || !strings.Contains(refused.Message, "serve (pid") {
		t.Errorf("got %+v", refused)
	}
}

func TestEmptyStoreIsNotLinkedUnlessLinking(t *testing.T) {
	path := filepath.Join(t.TempDir(), "private.db")
	if _, refused := openDevice(context.Background(), path, false, waLog.Noop); refused == nil ||
		refused.Code != "authentication_error" {
		t.Errorf("got %+v", refused)
	}
	device, refused := openDevice(context.Background(), path, true, waLog.Noop)
	if refused != nil || device == nil || device.ID != nil {
		t.Errorf("got %+v %+v", device, refused)
	}
}
