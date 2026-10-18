package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

const connectWait = 30 * time.Second

type engine struct {
	ctx    context.Context
	stop   context.CancelFunc
	client *whatsmeow.Client
	out    *wire
	conv   *converter

	mu     sync.Mutex
	chats  map[string]waChat // seen in this process, for resolving a name
	groups []waChat          // fetched once, on the first directory request

	addressing map[types.JID]types.AddressingMode // per group, asked once

	olderOne  sync.Mutex // one request for older history at a time, so its answer is known by its chat
	olderAsks olderWaiter

	// Why WhatsApp ended the connection, until it connects again. Later requests answer with it instead of
	// connecting: after "replaced" that would take the login back from the other process, and after a ban it would
	// knock on WhatsApp's door again.
	ended *refusal
}

func newEngine(ctx context.Context, device *store.Device, out *wire, logger waLog.Logger) *engine {
	ctx, stop := context.WithCancel(ctx)
	e := &engine{ctx: ctx, stop: stop, client: whatsmeow.NewClient(device, logger), out: out, chats: map[string]waChat{},
		addressing: map[types.JID]types.AddressingMode{}}
	e.conv = &converter{lidFor: e.lidFor, nameOf: e.nameOf}
	e.refreshSelf()
	e.client.AddEventHandler(e.handle)
	return e
}

func (e *engine) refreshSelf() {
	device := e.client.Store
	if device.ID != nil {
		e.conv.selfPN = device.ID.ToNonAD()
	}
	if !device.LID.IsEmpty() {
		e.conv.self = device.LID.ToNonAD()
	}
}

func (e *engine) self() *string {
	if e.conv.self.IsEmpty() {
		return nil
	}
	return str(e.conv.self.String())
}

// linked says the device has its stores; a device made for linking has none until the phone confirms.
func (e *engine) linked() bool { return e.client.Store.ID != nil }

func (e *engine) lidFor(pn types.JID) (types.JID, bool) {
	if !e.linked() {
		return types.JID{}, false
	}
	lid, err := e.client.Store.LIDs.GetLIDForPN(e.ctx, pn)
	return lid, err == nil && !lid.IsEmpty()
}

// run answers requests until stdin closes; a parent that died closes it, so the engine never outlives the CLI.
func (e *engine) run(in io.Reader) {
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
	var pending sync.WaitGroup
	for scanner.Scan() {
		var req request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			continue
		}
		if req.Op == "close" {
			e.out.ok(req.ID, nil)
			break
		}
		pending.Add(1)
		go func() {
			defer pending.Done()
			e.answer(req)
		}()
	}
	e.stop()
	e.client.Disconnect()
	pending.Wait()
}

func (e *engine) answer(req request) {
	defer func() {
		if recover() != nil {
			e.out.fail(req.ID, &refusal{failure: failure{"provider_error", "the engine failed on this request"}})
		}
	}()
	value, err := e.dispatch(req)
	if err != nil {
		e.out.fail(req.ID, e.refusalFor(err))
		return
	}
	e.out.ok(req.ID, value)
}

func (e *engine) dispatch(req request) (any, error) {
	switch req.Op {
	case "connect":
		return nil, e.connect()
	case "link":
		return e.link(req.Method, req.Phone)
	case "me":
		return e.me()
	case "directory":
		return e.directory(), nil
	case "chat":
		return e.chat(req.JID)
	case "send":
		return e.send(req)
	case "edit":
		return e.edit(req)
	case "revoke":
		return nil, e.revoke(req)
	case "react":
		return nil, e.react(req)
	case "read":
		return nil, e.markRead(req)
	case "sendMedia":
		return e.sendMedia(req)
	case "download":
		return nil, e.download(req)
	case "forward":
		return e.forward(req)
	case "older":
		return e.older(req)
	case "logout":
		return nil, e.client.Logout(e.ctx)
	}
	if value, handled, err := e.dispatchGroups(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchPolls(req); handled {
		return value, err
	}
	return nil, &failure{"validation_error", "the engine has no such request"}
}

func (e *engine) connect() error {
	if !e.linked() {
		return whatsmeow.ErrNotLoggedIn
	}
	if ended := e.endedBy(); ended != nil {
		return ended
	}
	if !e.client.IsConnected() {
		if err := e.client.Connect(); err != nil && !errors.Is(err, whatsmeow.ErrAlreadyConnected) {
			return err
		}
	}
	// In slices, so a refusal WhatsApp sends while connecting answers at once rather than after the whole wait.
	deadline := time.Now().Add(connectWait)
	for !e.client.WaitForConnection(250 * time.Millisecond) {
		if ended := e.endedBy(); ended != nil {
			return ended
		}
		if time.Now().After(deadline) {
			return &failure{"network_error", "could not connect to WhatsApp in time"}
		}
	}
	return nil
}

func (e *engine) send(req request) (*waMessage, error) {
	to, err := types.ParseJID(req.Chat)
	if err != nil || to.User == "" {
		return nil, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if req.SendID == "" {
		return nil, &failure{"validation_error", "a send needs its message id"}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	content := &waE2E.Message{Conversation: proto.String(req.Text)}
	if reply := e.replyContext(req); reply != nil {
		content = &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
			Text:        proto.String(req.Text),
			ContextInfo: reply,
		}}
	}
	sent, err := e.client.SendMessage(e.ctx, to, content, whatsmeow.SendRequestExtra{ID: req.SendID})
	if err != nil {
		return nil, err
	}
	me, _ := e.me()
	message := &waMessage{
		ID:        sent.ID,
		Chat:      e.conv.canonical(to, nil).String(),
		FromMe:    true,
		Timestamp: iso(sent.Timestamp),
		Text:      req.Text,
		ReplyTo:   str(req.ReplyTo),
	}
	if me != nil {
		message.Sender = &me.JID
		message.SenderName = me.Name
	}
	return message, nil
}
