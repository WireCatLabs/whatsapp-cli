package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
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
	labels   *labelStore
	snapshot waHistory
	ctx      context.Context
	stop     context.CancelFunc
	client   *whatsmeow.Client
	out      *wire
	conv     *converter

	mu       sync.Mutex
	chats    map[string]waChat // seen in this process, for resolving a name
	groups   []waChat          // the joined groups, fetched once
	channels []waChat          // the followed channels, likewise

	addressing map[types.JID]types.AddressingMode // per group, asked once

	phones *phoneChats // nil when private.db could not hold the table: chats are then never re-keyed
	asks   *lidAsker   // nil while linking, and without the phone-form chats

	olderOne  sync.Mutex // one request for older history at a time, so its answer is known by its chat
	olderAsks olderWaiter

	retries retryWaiter // downloads waiting for the phone to upload a file again

	calls calls

	downloads *historyDownloads
	pushes    *historyPushes // nil when private.db could not hold the table: pushes are then downloaded at once
	listening bool           // this run hands history pushes to the CLI; any other only keeps them
	reachout  *reachout
	queued    sync.Map // push ids queued in this process, so a replay and a repeat are not downloaded twice

	following follows // e.client; a test answers for WhatsApp here
	joining   joins   // likewise

	// Why WhatsApp ended the connection, until it connects again. Later requests answer with it instead of
	// connecting: after "replaced" that would take the login back from the other process, and after a ban it would
	// knock on WhatsApp's door again.
	ended *refusal
}

func newEngine(ctx context.Context, device *store.Device, out *wire, logger waLog.Logger) *engine {
	ctx, stop := context.WithCancel(ctx)
	e := &engine{ctx: ctx, stop: stop, client: whatsmeow.NewClient(device, logger), out: out, chats: map[string]waChat{},
		addressing: map[types.JID]types.AddressingMode{}}
	e.following = e.client
	e.joining = e.client
	e.conv = &converter{lidFor: e.lidFor, nameOf: e.nameOf, decryptComment: e.decryptComment}
	e.refreshSelf()
	e.client.ManualHistorySyncDownload = true
	// mautrix-whatsapp's practice: a message is acknowledged only once every handler returned, and a history push
	// only once it is kept in the device store (handleReporting).
	e.client.SynchronousAck = true
	// A message WhatsApp delivers again after a refused handler cannot be decrypted twice; whatsmeow keeps the
	// plaintext until a handler succeeds, so the second delivery reaches handleReporting.
	e.client.EnableDecryptedEventBuffer = true
	e.client.EmitAppStateEventsOnFullSync = true
	// A recipient whose phone could not decrypt a message asks for it again, often after a one-shot send exited;
	// without the copy in the device file that message stays unreadable for them. whatsmeow drops it after 7 days.
	e.client.UseRetryMessageStore = true
	// WhatsApp Web, Baileys and mautrix-whatsapp put a message secret and a reporting token on each message, and an
	// album's files may need them for the phone to group them; on the wire wa should look like those clients.
	e.client.SendReportingTokens = true
	e.downloads = downloadsFor(e.client, e.handle)
	e.downloads.after = e.pushHanded
	e.client.AddEventHandlerWithSuccessStatus(e.handleReporting)
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

// lidFor also answers for a chat already re-keyed, so it is never emitted in phone form again.
func (e *engine) lidFor(pn types.JID) (types.JID, bool) {
	if lid, ok := e.storedLID(pn); ok {
		return lid, true
	}
	return e.phones.lidOf(pn.User)
}

func (e *engine) storedLID(pn types.JID) (types.JID, bool) {
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
	e.downloads.closing.Store(true)
	if !e.downloads.settled(historyWait) {
		fmt.Fprintln(os.Stderr, "wa-engine: a history push was still downloading at exit; it is not saved")
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
	// A 429 a background lookup met: this write's refusal is what makes the CLI hold the profile's writes
	// (WC-PERM-18), as no request of its own carried the 429.
	if writes[req.Op] && e.asks.owed(e.ctx) {
		e.out.fail(req.ID, rateLimited)
		return
	}
	value, err := e.dispatch(req)
	if err != nil {
		e.out.fail(req.ID, e.refusalFor(req.Op, err))
		return
	}
	e.noteNamed(req)
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
	case "inspect":
		return e.inspect(req.Link)
	case "saveContact":
		return nil, e.saveContact(req)
	case "folders":
		return e.folders()
	case "commentGroup":
		return e.commentGroup(req.JID)
	case "devices":
		return e.devices()
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
	case "sendAlbum":
		return e.sendAlbum(req)
	case "download":
		return e.download(req)
	case "forward":
		return e.forward(req)
	case "older":
		return e.older(req)
	case "logout":
		return nil, e.logout()
	}
	if value, handled, err := e.dispatchGroups(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchPolls(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchPrivacy(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchPins(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchSettings(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchChannels(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchStoredChats(req); handled {
		return value, err
	}
	if value, handled, err := e.dispatchCanonicalChat(req); handled {
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
		// The engine's context, not whatsmeow's background one: whatsmeow hands it on to its reconnect loop, so closing
		// stdin ends a dial or a reconnect that would otherwise hold the device lock past the CLI.
		if err := e.client.ConnectContext(e.ctx); err != nil && !errors.Is(err, whatsmeow.ErrAlreadyConnected) {
			return err
		}
	}
	return e.awaitLogin(e.client.WaitForConnection, waitSlice, connectWait, "could not connect to WhatsApp in time", nil)
}

func (e *engine) send(req request) (*waMessage, error) {
	to, err := types.ParseJID(req.Chat)
	if err != nil || to.User == "" {
		return nil, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if req.SendID == "" {
		return nil, &failure{"validation_error", "a send needs its message id"}
	}
	if to.Server == types.NewsletterServer && req.ReplyTo != "" {
		return nil, &failure{"validation_error", "a channel post cannot be a reply"}
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
	if to.Server == types.NewsletterServer {
		e.asChannelPost(message, to, sent.ServerID)
	}
	e.phones.note(e.ctx, message.Chat)
	return message, nil
}
