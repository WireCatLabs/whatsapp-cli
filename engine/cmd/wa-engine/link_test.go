package main

import (
	"context"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
)

func TestWhatsmeowStopsWaitingAtAnExpectedDisconnect(t *testing.T) {
	client := whatsmeow.NewClient(&store.Device{}, nil)
	client.Disconnect()
	done := make(chan bool, 1)
	go func() { done <- client.WaitForConnection(time.Minute) }()
	select {
	case connected := <-done:
		if connected {
			t.Fatal("WaitForConnection reported a connection that never happened")
		}
	case <-time.After(time.Second):
		t.Fatal("WaitForConnection no longer ends at an expected disconnect; awaitLogin's loop may be unneeded")
	}
}

// restarting answers as WaitForConnection does across the 515 restart: false at once while the old socket is being
// dropped, then true once the new one has logged in.
type restarting struct {
	falses int
	calls  int
}

func (r *restarting) wait(time.Duration) bool {
	r.calls++
	return r.calls > r.falses
}

func TestLinkWaitsOutTheRestartAfterPairing(t *testing.T) {
	e := &engine{ctx: context.Background()}
	r := &restarting{falses: 3}
	if err := e.awaitLogin(r.wait, time.Millisecond, time.Minute, "late"); err != nil {
		t.Fatalf("the restart ended the wait: %v", err)
	}
	if r.calls != 4 {
		t.Errorf("asked %d times, want 4", r.calls)
	}
}

func TestLinkGivesUpAtTheDeadline(t *testing.T) {
	e := &engine{ctx: context.Background()}
	r := &restarting{falses: 1 << 30}
	if err := e.awaitLogin(r.wait, time.Millisecond, 20*time.Millisecond, "late"); !isFailure(err, "network_error") {
		t.Fatalf("got %v", err)
	}
	if r.calls > 25 {
		t.Errorf("asked %d times in 20 ms of 1 ms slices: the wait spins", r.calls)
	}
}

func TestLinkStopsAtARefusalWhatsAppSent(t *testing.T) {
	e := &engine{ctx: context.Background(), ended: loggedOut}
	if err := e.awaitLogin((&restarting{falses: 1 << 30}).wait, time.Millisecond, time.Minute, "late"); err != loggedOut {
		t.Fatalf("got %v", err)
	}
}

func TestLinkStopsWhenTheEngineIsClosed(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	e := &engine{ctx: ctx}
	if err := e.awaitLogin((&restarting{falses: 1 << 30}).wait, time.Hour, time.Hour, "late"); err != context.Canceled {
		t.Fatalf("got %v", err)
	}
}
