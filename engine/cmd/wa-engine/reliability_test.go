package main

import (
	"bytes"
	"context"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"maps"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
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
		for _, op := range []string{"send", "updateGroup", "setPrivacy", "logout"} {
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

// A new op must be classified in ENGINE_OPS before it ships, or a write cut on its way answers "safe to retry".
func TestEveryDispatchedOpIsClassifiedAndTheWritesMatchTheClients(t *testing.T) {
	source, err := os.ReadFile(filepath.Join("..", "..", "..", "src", "engine", "contract.ts"))
	if err != nil {
		t.Fatal(err)
	}
	table := regexp.MustCompile(`(?s)export const ENGINE_OPS = \{(.*?)\} as const`).FindSubmatch(source)
	if table == nil {
		t.Fatal("contract.ts has no ENGINE_OPS")
	}
	classified, clientWrites := map[string]bool{}, map[string]bool{}
	for _, entry := range regexp.MustCompile(`(?m)^\s*(\w+): "(read|write)",$`).FindAllSubmatch(table[1], -1) {
		classified[string(entry[1])] = true
		if string(entry[2]) == "write" {
			clientWrites[string(entry[1])] = true
		}
	}
	if !maps.Equal(clientWrites, writes) {
		t.Errorf("the client's writes %v and the engine's writes %v differ", slices.Sorted(maps.Keys(clientWrites)),
			slices.Sorted(maps.Keys(writes)))
	}
	dispatched := dispatchedOps(t)
	for op := range dispatched {
		if !classified[op] {
			t.Errorf("the engine answers %q, which ENGINE_OPS does not classify as a read or a write", op)
		}
	}
	for op := range classified {
		if !dispatched[op] {
			t.Errorf("ENGINE_OPS names %q, which the engine does not answer", op)
		}
	}
}

// dispatchedOps reads the ops off the engine's own source: every case of a switch on req.Op, and every req.Op == "…".
func dispatchedOps(t *testing.T) map[string]bool {
	t.Helper()
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	ops := map[string]bool{}
	isOp := func(expr ast.Expr) bool {
		selector, ok := expr.(*ast.SelectorExpr)
		if !ok || selector.Sel.Name != "Op" {
			return false
		}
		receiver, ok := selector.X.(*ast.Ident)
		return ok && receiver.Name == "req"
	}
	literal := func(expr ast.Expr) {
		if lit, ok := expr.(*ast.BasicLit); ok && lit.Kind == token.STRING {
			op, _ := strconv.Unquote(lit.Value)
			ops[op] = true
		}
	}
	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(token.NewFileSet(), name, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		ast.Inspect(file, func(node ast.Node) bool {
			switch n := node.(type) {
			case *ast.SwitchStmt:
				if n.Tag != nil && isOp(n.Tag) {
					for _, clause := range n.Body.List {
						for _, expr := range clause.(*ast.CaseClause).List {
							literal(expr)
						}
					}
				}
			case *ast.BinaryExpr:
				if n.Op == token.EQL && isOp(n.X) {
					literal(n.Y)
				}
			}
			return true
		})
	}
	if len(ops) < len(writes) {
		t.Fatalf("found only %d ops in the engine's source", len(ops))
	}
	return ops
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

	device, _, refused := openDevice(context.Background(), filepath.Join(t.TempDir(), "private.db"), true, waLog.Noop)
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
