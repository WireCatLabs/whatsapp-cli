package main

import (
	"slices"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
)

// olderMax is what WhatsApp's own clients ask for at once; whatsmeow's BuildHistorySyncRequest recommends it too.
const olderMax = 50

// olderWait bounds one `older` request, every ask in it together: the phone answers only while it is online, and may
// never answer at all. It stays under cli-core's default 30 s command timeout, so the owner gets this answer, not a
// bare timeout.
var olderWait = 25 * time.Second

// olderRounds bounds how often one request asks the phone: again when it sent fewer messages than asked, or only
// messages the contract skips. Asks go one after another, olderGap apart: WhatsApp bans accounts that ask in bulk.
const olderRounds = 3

var olderGap = time.Second

// olderLate is how many requests that stopped waiting are remembered, so that their late answers are known as late.
const olderLate = 16

// olderBatch answers an `older` request. `More` says the phone sent messages of the chat; only an answer with nothing
// in it is the chat's start.
type olderBatch struct {
	Messages []waMessage `json:"messages"`
	More     bool        `json:"more"`

	oldest rawKey
	sent   int // the chat's messages the phone sent, kept or skipped: what it counts against the ask
}

// rawKey is a message as the phone keyed it, before conversion: enough to count back from it again.
type rawKey struct {
	id     string
	fromMe bool
	at     time.Time
}

func (h *waHistory) noteOldest(chat string, web *waWeb.WebMessageInfo) {
	key := rawKey{id: web.GetKey().GetID(), fromMe: web.GetKey().GetFromMe(), at: fromUnix(web.GetMessageTimestamp())}
	if key.id == "" {
		return
	}
	if seen, ok := h.oldest[chat]; !ok || key.at.Before(seen.at) {
		h.oldest[chat] = key
	}
	if h.sent == nil {
		h.sent = map[string]int{}
	}
	h.sent[chat]++
}

type olderAsk struct {
	id     string
	chat   string
	answer chan olderBatch
}

// olderWaiter holds the one request in flight. ON_DEMAND history comes only in answer to this device's own requests,
// and one process asks one at a time. A notification that names the waiting request's id is its answer, and one that
// names a request no longer waiting is late. Any other — the id the phone puts there is not confirmed to be the
// request's — is the answer when it names the chat, or names no chat at all.
type olderWaiter struct {
	mu      sync.Mutex
	current *olderAsk
	late    []string
}

func (w *olderWaiter) wait(id, chat string) *olderAsk {
	ask := &olderAsk{id: id, chat: chat, answer: make(chan olderBatch, 1)}
	w.mu.Lock()
	w.current = ask
	w.mu.Unlock()
	return ask
}

func (w *olderWaiter) forget(ask *olderAsk) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.current != ask {
		return
	}
	w.current = nil
	if ask.id != "" {
		w.late = append(w.late, ask.id)
		if len(w.late) > olderLate {
			w.late = w.late[1:]
		}
	}
}

// olderMatch is how an ON_DEMAND batch was credited.
type olderMatch string

const (
	matchSession olderMatch = "session"
	matchChat    olderMatch = "chat"
	matchLate    olderMatch = "late"
	matchNone    olderMatch = "none"
)

func (w *olderWaiter) match(h waHistory, session string) (*olderAsk, olderMatch) {
	w.mu.Lock()
	defer w.mu.Unlock()
	ask := w.current
	switch {
	case session != "" && ask != nil && session == ask.id:
		return ask, matchSession
	case session != "" && slices.Contains(w.late, session):
		return nil, matchLate
	case ask != nil && (len(h.Chats) == 0 || names(h, ask.chat)):
		return ask, matchChat
	}
	return nil, matchNone
}

// deliver hands the waiting request its chat's messages and returns the rest of the batch, for the history event:
// the phone may put other chats and push names in the same answer, and those are saved like any history push. The
// votes stay in the history event: cli-core saves a vote whether or not its poll arrives in the same batch.
func (w *olderWaiter) deliver(h waHistory, session string) (waHistory, olderMatch, int) {
	ask, how := w.match(h, session)
	if ask == nil {
		return h, how, 0
	}
	w.forget(ask)
	oldest, more := h.oldest[ask.chat]
	batch := olderBatch{Messages: []waMessage{}, More: more, oldest: oldest, sent: h.sent[ask.chat]}
	rest := waHistory{Kind: h.Kind, Chats: []waChat{}, Contacts: h.Contacts, Messages: []waMessage{}, Votes: h.Votes}
	for _, chat := range h.Chats {
		if chat.JID != ask.chat {
			rest.Chats = append(rest.Chats, chat)
		}
	}
	for _, message := range h.Messages {
		if message.Chat == ask.chat {
			batch.Messages = append(batch.Messages, message)
		} else {
			rest.Messages = append(rest.Messages, message)
		}
	}
	ask.answer <- batch
	return rest, how, len(batch.Messages)
}

func (w *olderWaiter) waitingID() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.current == nil {
		return ""
	}
	return w.current.id
}

// onDemand credits an ON_DEMAND batch. Its log line, in counts and yes/no only, is what the live check reads: how many
// notifications one ask gets, and whether a notification names its request by the request's id.
func (e *engine) onDemand(h waHistory, notification *waE2E.HistorySyncNotification) waHistory {
	waiting := e.olderAsks.waitingID()
	session := notification.GetPeerDataRequestSessionID()
	rest, how, credited := e.olderAsks.deliver(h, session)
	e.client.Log.Warnf(
		"on-demand history: matched by %s, %d messages credited, chunk %d, progress %d, "+
			"session id is the request id: %t, original id is the request id: %t",
		how, credited, notification.GetChunkOrder(), notification.GetProgress(),
		waiting != "" && session == waiting, waiting != "" && notification.GetOriginalMessageID() == waiting,
	)
	return rest
}

func names(h waHistory, chat string) bool {
	for _, one := range h.Chats {
		if one.JID == chat {
			return true
		}
	}
	return false
}

func (h waHistory) empty() bool {
	return len(h.Chats) == 0 && len(h.Contacts) == 0 && len(h.Messages) == 0 && len(h.Votes) == 0
}

// olderAnchor reads the message the phone counts back from. whatsmeow keeps no messages, so it comes from the CLI's
// store; the request carries only the chat, the id, whether it is the account's own, and when it was sent.
func olderAnchor(req request) (types.MessageInfo, int, error) {
	chat, err := types.ParseJID(req.Chat)
	if err != nil || chat.User == "" {
		return types.MessageInfo{}, 0, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if req.Message == "" {
		return types.MessageInfo{}, 0, &failure{"validation_error", "a message id is needed"}
	}
	at, err := time.Parse(time.RFC3339Nano, req.Timestamp)
	if err != nil {
		return types.MessageInfo{}, 0, &failure{"validation_error", "the message's time is not an ISO 8601 time"}
	}
	count := req.Count
	if count <= 0 || count > olderMax {
		count = olderMax
	}
	info := types.MessageInfo{
		MessageSource: types.MessageSource{Chat: chat.ToNonAD(), IsFromMe: req.FromMe},
		ID:            req.Message,
		Timestamp:     at,
	}
	return info, count, nil
}

func (e *engine) older(req request) (*olderBatch, error) {
	info, count, err := olderAnchor(req)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	e.olderOne.Lock()
	defer e.olderOne.Unlock()
	chat := e.conv.canonical(info.Chat, nil).String()
	until := time.Now().Add(olderWait)
	return collectOlder(info, count, func(info types.MessageInfo, count int) (*olderBatch, error) {
		return e.askOlder(chat, info, count, until)
	})
}

type olderAsker func(info types.MessageInfo, count int) (*olderBatch, error)

// collectOlder asks until the phone has sent `count` messages or the chat's start, or the rounds or the deadline run
// out; each ask counts back from the oldest message the last one brought. What arrived before a failure is answered,
// not lost: it was taken out of the history event. An empty page tells cli-core the chat's start is held, so a batch
// of only skipped messages is asked past.
func collectOlder(info types.MessageInfo, count int, ask olderAsker) (*olderBatch, error) {
	out := &olderBatch{Messages: []waMessage{}}
	sent := 0
	for round := range olderRounds {
		if round > 0 {
			time.Sleep(olderGap)
		}
		want := count - sent
		if len(out.Messages) == 0 || want <= 0 {
			want = count
		}
		batch, err := ask(info, want)
		if err != nil {
			if len(out.Messages) > 0 {
				out.More = true
				return out, nil
			}
			return nil, err
		}
		out.Messages = append(out.Messages, batch.Messages...)
		out.More = batch.More
		if !batch.More {
			return out, nil
		}
		sent += batch.sent
		if len(out.Messages) > 0 && sent >= count {
			return out, nil
		}
		info = reanchor(info, batch.oldest)
	}
	if len(out.Messages) > 0 {
		return out, nil
	}
	return nil, &failure{"provider_error", "the phone sent only messages wa does not keep; this stretch of the chat cannot be read"}
}

func reanchor(info types.MessageInfo, oldest rawKey) types.MessageInfo {
	info.ID = oldest.id
	info.IsFromMe = oldest.fromMe
	info.Timestamp = oldest.at
	return info
}

// askOlder is SendPeerMessage under an id chosen first, so that an answer can be known by it, even one that arrives
// before the send returns.
func (e *engine) askOlder(chat string, info types.MessageInfo, count int, until time.Time) (*olderBatch, error) {
	wait := time.Until(until)
	if wait <= 0 {
		return nil, olderTimeout()
	}
	own := e.client.Store.GetJID().ToNonAD()
	id := e.client.GenerateMessageID()
	ask := e.olderAsks.wait(id, chat)
	defer e.olderAsks.forget(ask)
	extra := whatsmeow.SendRequestExtra{ID: id, Peer: true}
	if _, err := e.client.SendMessage(e.ctx, own, e.client.BuildHistorySyncRequest(&info, count), extra); err != nil {
		return nil, err
	}
	select {
	case batch := <-ask.answer:
		return &batch, nil
	case <-time.After(wait):
		return nil, olderTimeout()
	case <-e.ctx.Done():
		return nil, &failure{"provider_unavailable", "the engine stopped before the phone answered"}
	}
}

func olderTimeout() error {
	return &failure{"timeout", "the phone did not send older messages in time; it must be online, with WhatsApp able to connect"}
}
