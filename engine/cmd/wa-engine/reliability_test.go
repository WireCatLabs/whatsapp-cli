package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"maps"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func TestAWriteCutOffOnItsWayIsOutcomeUnknownAndAReadStaysRetryable(t *testing.T) {
	cut := []error{
		&whatsmeow.DisconnectedError{Action: "message send"},
		fmt.Errorf("retry: %w", whatsmeow.ErrNotConnected),
		whatsmeow.ErrIQTimedOut,
		context.Canceled,
		context.DeadlineExceeded,
	}
	e := &engine{out: newWire(io.Discard)}
	for _, err := range cut {
		for _, op := range []string{"send", "updateGroup", "logout"} {
			if got := e.refusalFor(op, err); got.Code != "outcome_unknown" {
				t.Errorf("%s cut by %v became %+v", op, err, got)
			}
		}
		if got := e.refusalFor("chat", err); got.Code == "outcome_unknown" {
			t.Errorf("a read cut by %v became %+v", err, got)
		}
	}
	if got := e.refusalFor("send", &failure{"network_error", "could not connect to WhatsApp in time"}); got.Code !=
		"network_error" {
		t.Errorf("a send that never connected became %+v", got)
	}

	e.handle(&events.StreamReplaced{})
	if got := e.refusalFor("send", &whatsmeow.DisconnectedError{}); got.Code != "outcome_unknown" {
		t.Errorf("a send cut by the takeover became %+v; it may have gone out", got)
	}
	if got := e.refusalFor("send", replaced); got.Reason != "device.replaced" {
		t.Errorf("a send refused before it left became %+v", got)
	}
}

func TestTheWritesHereAreTheClientsWrites(t *testing.T) {
	source, err := os.ReadFile(filepath.Join("..", "..", "..", "src", "engine", "go-engine.ts"))
	if err != nil {
		t.Fatal(err)
	}
	list := regexp.MustCompile(`(?s)const WRITES = new Set\(\[(.*?)\]\)`).FindSubmatch(source)
	if list == nil {
		t.Fatal("go-engine.ts has no WRITES set")
	}
	client := map[string]bool{}
	for _, op := range regexp.MustCompile(`"(\w+)"`).FindAllSubmatch(list[1], -1) {
		client[string(op[1])] = true
	}
	if !maps.Equal(client, writes) {
		t.Errorf("the client's WRITES %v and the engine's writes %v differ", slices.Sorted(maps.Keys(client)),
			slices.Sorted(maps.Keys(writes)))
	}
}

func TestAKeepaliveThatRecoversSaysConnectedAgain(t *testing.T) {
	var out bytes.Buffer
	e := &engine{out: newWire(&out)}
	e.handle(&events.KeepAliveTimeout{})
	e.handle(&events.KeepAliveRestored{})
	want := `{"event":"connection","state":"disconnected"}` + "\n" + `{"event":"connection","state":"connected"}`
	if got := strings.TrimSpace(out.String()); got != want {
		t.Errorf("went out as %s", got)
	}
}

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// The dial goes to a local listener that never answers, standing in for a network that drops packets: nothing leaves
// this machine. A fresh transport, so no proxy from the environment is used.
func TestClosingStdinEndsTheEngineWhileItIsStillConnecting(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	dialed := make(chan struct{}, 1)
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			dialed <- struct{}{}
			defer conn.Close()
		}
	}()

	device, refused := openDevice(context.Background(), filepath.Join(t.TempDir(), "private.db"), true, waLog.Noop)
	if refused != nil {
		t.Fatal(refused)
	}
	device.ID = &types.JID{User: "100000000000001", Server: types.DefaultUserServer, Device: 1}
	var out lockedBuffer
	e := newEngine(context.Background(), device, newWire(&out), waLog.Noop)
	e.client.SetWebsocketHTTPClient(&http.Client{Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "tcp", listener.Addr().String())
		},
	}})

	stdin, requests := io.Pipe()
	done := make(chan struct{})
	go func() {
		e.run(stdin)
		close(done)
	}()
	if _, err := requests.Write([]byte(`{"id":1,"op":"connect"}` + "\n")); err != nil {
		t.Fatal(err)
	}
	select {
	case <-dialed:
	case <-time.After(5 * time.Second):
		t.Fatal("the engine never dialed")
	}
	requests.Close()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the engine kept connecting after stdin closed")
	}
	if !strings.Contains(out.String(), `"id":1`) {
		t.Errorf("the connect was never answered: %s", out.String())
	}
}
