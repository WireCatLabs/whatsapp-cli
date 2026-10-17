package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
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

func (e *engine) contact(user types.JID) types.ContactInfo {
	if !e.linked() {
		return types.ContactInfo{}
	}
	info, err := e.client.Store.Contacts.GetContact(e.ctx, user)
	if (err != nil || !info.Found) && user.Server == types.HiddenUserServer {
		if pn, err := e.client.Store.LIDs.GetPNForLID(e.ctx, user); err == nil && !pn.IsEmpty() {
			info, _ = e.client.Store.Contacts.GetContact(e.ctx, pn)
		}
	}
	return info
}

func (e *engine) nameOf(user types.JID) string {
	info := e.contact(user)
	if shown := name(info.FullName, info.FirstName, info.BusinessName, info.PushName); shown != nil {
		return *shown
	}
	return ""
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
			e.out.fail(req.ID, &failure{"provider_error", "the engine failed on this request"})
		}
	}()
	value, err := e.dispatch(req)
	if err != nil {
		e.out.fail(req.ID, classify(err))
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
	if !e.client.IsConnected() {
		if err := e.client.Connect(); err != nil && !errors.Is(err, whatsmeow.ErrAlreadyConnected) {
			return err
		}
	}
	if !e.client.WaitForConnection(connectWait) {
		return &failure{"network_error", "could not connect to WhatsApp in time"}
	}
	return nil
}

func (e *engine) link(method, phone string) (*waAccount, error) {
	if e.linked() {
		return e.me()
	}
	qr, err := e.client.GetQRChannel(e.ctx)
	if err != nil {
		return nil, err
	}
	if err := e.client.Connect(); err != nil {
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
			if !e.client.WaitForConnection(2 * connectWait) {
				return nil, &failure{"network_error", "linked, but could not reconnect to WhatsApp in time"}
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

func (e *engine) remember(chats []waChat) {
	e.mu.Lock()
	defer e.mu.Unlock()
	for _, chat := range chats {
		e.chats[chat.JID] = chat
	}
}

// directory is every chat the engine can name without asking the phone: those pushed in this process, the address
// book, and the joined groups (one request, then kept).
func (e *engine) directory() []waChat {
	e.mu.Lock()
	needGroups := e.groups == nil && e.client.IsConnected()
	e.mu.Unlock()
	if needGroups {
		if groups, err := e.client.GetJoinedGroups(e.ctx); err == nil {
			list := make([]waChat, 0, len(groups))
			for _, group := range groups {
				list = append(list, e.groupChat(group))
			}
			e.mu.Lock()
			e.groups = list
			e.mu.Unlock()
		}
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	byID := map[string]waChat{}
	for _, contact := range e.contacts() {
		byID[contact.JID] = waChat{JID: contact.JID, Name: contact.Name, Kind: e.conv.kindOf(mustJID(contact.JID))}
	}
	for _, group := range e.groups {
		byID[group.JID] = group
	}
	for id, chat := range e.chats {
		byID[id] = chat
	}
	list := make([]waChat, 0, len(byID))
	for _, chat := range byID {
		list = append(list, chat)
	}
	return list
}

func mustJID(s string) types.JID {
	jid, _ := types.ParseJID(s)
	return jid
}

func (e *engine) contacts() []waContact {
	if !e.linked() {
		return []waContact{}
	}
	all, err := e.client.Store.Contacts.GetAllContacts(e.ctx)
	if err != nil {
		return []waContact{}
	}
	byID := map[string]waContact{}
	for jid, info := range all {
		shown := name(info.FullName, info.FirstName, info.BusinessName, info.PushName)
		if shown == nil {
			continue
		}
		id := e.conv.canonical(jid, nil).String()
		if _, seen := byID[id]; !seen || info.FullName != "" {
			byID[id] = waContact{JID: id, Name: shown}
		}
	}
	list := make([]waContact, 0, len(byID))
	for _, contact := range byID {
		list = append(list, contact)
	}
	return list
}

func (e *engine) groupChat(group *types.GroupInfo) waChat {
	count := len(group.Participants)
	return waChat{JID: group.JID.String(), Name: name(group.Name), Kind: "group", Participants: &count}
}

func (e *engine) chat(raw string) (*waChatCard, error) {
	jid, err := types.ParseJID(raw)
	if err != nil {
		return nil, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if jid.Server == types.GroupServer {
		group, err := e.client.GetGroupInfo(e.ctx, jid)
		if err != nil {
			return nil, err
		}
		members := make([]waContact, 0, len(group.Participants))
		for _, participant := range group.Participants {
			id := participant.JID
			if !participant.LID.IsEmpty() {
				id = participant.LID
			}
			id = e.conv.canonical(id, nil)
			members = append(members, waContact{JID: id.String(), Name: name(e.nameOf(id))})
		}
		return &waChatCard{Chat: e.groupChat(group), Members: members}, nil
	}
	jid = e.conv.canonical(jid, nil)
	e.mu.Lock()
	chat, seen := e.chats[jid.String()]
	e.mu.Unlock()
	if !seen {
		chat = waChat{JID: jid.String(), Name: name(e.nameOf(jid)), Kind: e.conv.kindOf(jid)}
	}
	return &waChatCard{Chat: chat}, nil
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
	if req.ReplyTo != "" {
		content = &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
			Text:        proto.String(req.Text),
			ContextInfo: &waE2E.ContextInfo{StanzaID: proto.String(req.ReplyTo)},
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

func (e *engine) handle(raw any) {
	switch evt := raw.(type) {
	case *events.Message:
		if changed, ok := e.conv.message(evt, nil); ok {
			if changed.kind == "delete" {
				e.out.deleted(changed.message.Chat, changed.message.ID)
			} else {
				e.out.event(changed.kind, changed.message)
			}
		}
	case *events.HistorySync:
		history := e.conv.history(evt.Data, e.client.ParseWebMessage)
		e.remember(history.Chats)
		if history.Kind == "on_demand" {
			if history = e.olderAsks.deliver(history); history.empty() {
				return
			}
		}
		e.out.event("history", history)
	case *events.AppStateSyncComplete:
		// The address book arrives in this patch; until then contacts have no names.
		if evt.Name == appstate.WAPatchCriticalUnblockLow {
			e.out.event("history", waHistory{Kind: "other", Chats: []waChat{}, Contacts: e.contacts(), Messages: []waMessage{}})
		}
	case *events.Connected:
		e.refreshSelf()
		e.out.connection("connected")
	case *events.Disconnected, *events.KeepAliveTimeout:
		e.out.connection("disconnected")
	case *events.LoggedOut:
		e.out.connection("logged_out")
	case *events.StreamReplaced:
		e.out.connection("replaced")
	case *events.TemporaryBan:
		e.out.connection("banned")
	case *events.ClientOutdated:
		e.out.connection("outdated")
	case *events.ConnectFailure:
		switch {
		case evt.Reason == events.ConnectFailureTempBanned:
			e.out.connection("banned")
		case evt.Reason.IsLoggedOut():
			e.out.connection("logged_out")
		default:
			e.out.connection("disconnected")
		}
	}
}

// classify puts any error into the contract's closed list, in fixed wording: whatsmeow's own text can carry a JID.
func classify(err error) *failure {
	var known *failure
	var iq *whatsmeow.IQError
	var disconnected *whatsmeow.DisconnectedError
	switch {
	case errors.As(err, &known):
		return known
	case errors.Is(err, whatsmeow.ErrMessageTimedOut):
		return &failure{"outcome_unknown", "WhatsApp did not confirm the message; it may have been sent"}
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, whatsmeow.ErrIQTimedOut):
		return &failure{"timeout", "WhatsApp did not answer in time"}
	case errors.Is(err, whatsmeow.ErrNotLoggedIn):
		return &failure{"authentication_error", "this profile is not linked to WhatsApp"}
	case errors.Is(err, whatsmeow.ErrNotConnected), errors.As(err, &disconnected):
		return &failure{"network_error", "not connected to WhatsApp"}
	case errors.Is(err, whatsmeow.ErrGroupNotFound):
		return &failure{"not_found", "WhatsApp has no such chat"}
	case errors.Is(err, whatsmeow.ErrNotInGroup), errors.Is(err, whatsmeow.ErrNoPermissionInGroup):
		return &failure{"permission_error", "this account may not do that in the chat"}
	case errors.As(err, &iq):
		switch iq.Code {
		case 401:
			return &failure{"authentication_error", "WhatsApp no longer accepts this linked device"}
		case 403:
			return &failure{"permission_error", "WhatsApp refused: not allowed"}
		case 404:
			return &failure{"not_found", "WhatsApp has no such chat"}
		case 429:
			return &failure{"rate_limited", "WhatsApp asks to slow down"}
		}
	}
	return &failure{"provider_error", "WhatsApp refused the request"}
}
