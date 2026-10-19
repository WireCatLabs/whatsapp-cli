package main

import (
	"context"
	"errors"
	"sync/atomic"
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
	if err := e.awaitLogin(r.wait, time.Millisecond, time.Minute, "late", nil); err != nil {
		t.Fatalf("the restart ended the wait: %v", err)
	}
	if r.calls != 4 {
		t.Errorf("asked %d times, want 4", r.calls)
	}
}

func TestLinkGivesUpAtTheDeadline(t *testing.T) {
	e := &engine{ctx: context.Background()}
	r := &restarting{falses: 1 << 30}
	if err := e.awaitLogin(r.wait, time.Millisecond, 20*time.Millisecond, "late", nil); !isFailure(err, "network_error") {
		t.Fatalf("got %v", err)
	}
	if r.calls > 25 {
		t.Errorf("asked %d times in 20 ms of 1 ms slices: the wait spins", r.calls)
	}
}

func TestLinkStopsAtARefusalWhatsAppSent(t *testing.T) {
	e := &engine{ctx: context.Background(), ended: loggedOut}
	never := (&restarting{falses: 1 << 30}).wait
	if err := e.awaitLogin(never, time.Millisecond, time.Minute, "late", nil); err != loggedOut {
		t.Fatalf("got %v", err)
	}
}

// droppedReconnect is the client after whatsmeow's own reconnect after the 515 failed: down until wa connects.
type droppedReconnect struct {
	up       atomic.Bool
	connects atomic.Int32
}

func (d *droppedReconnect) wait(time.Duration) bool { return d.up.Load() }

func (d *droppedReconnect) retry() *loginRetry {
	return &loginRetry{connected: d.up.Load, after: 5 * time.Millisecond, reconnect: func() error {
		d.connects.Add(1)
		d.up.Store(true)
		return nil
	}}
}

func TestLinkConnectsOnceMoreWhenWhatsmeowsReconnectFailed(t *testing.T) {
	e := &engine{ctx: context.Background()}
	d := &droppedReconnect{}
	if err := e.awaitLogin(d.wait, time.Millisecond, time.Minute, "late", d.retry()); err != nil {
		t.Fatalf("got %v", err)
	}
	if n := d.connects.Load(); n != 1 {
		t.Errorf("connected %d times, want 1", n)
	}
}

func TestLinkConnectsAgainOnlyOnce(t *testing.T) {
	e := &engine{ctx: context.Background()}
	d := &droppedReconnect{}
	retry := d.retry()
	retry.reconnect = func() error {
		d.connects.Add(1)
		return errors.New("dial failed")
	}
	err := e.awaitLogin(d.wait, time.Millisecond, 50*time.Millisecond, "late", retry)
	if !isFailure(err, "network_error") {
		t.Fatalf("got %v", err)
	}
	if n := d.connects.Load(); n != 1 {
		t.Errorf("connected %d times, want 1", n)
	}
}

func TestLinkNeverConnectsBesideALiveConnection(t *testing.T) {
	e := &engine{ctx: context.Background()}
	r := &restarting{falses: 30}
	retry := &loginRetry{connected: func() bool { return true }, after: time.Nanosecond, reconnect: func() error {
		t.Error("connected while a connection was live")
		return nil
	}}
	if err := e.awaitLogin(r.wait, time.Millisecond, time.Minute, "late", retry); err != nil {
		t.Fatalf("got %v", err)
	}
}

func TestLinkStopsWhenTheEngineIsClosed(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	e := &engine{ctx: ctx}
	never := (&restarting{falses: 1 << 30}).wait
	if err := e.awaitLogin(never, time.Hour, time.Hour, "late", nil); err != context.Canceled {
		t.Fatalf("got %v", err)
	}
}
