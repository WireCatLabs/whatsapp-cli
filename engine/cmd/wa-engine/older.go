package main

import (
	"sync"
	"time"

	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
)

// olderMax is what WhatsApp's own clients ask for at once; whatsmeow's BuildHistorySyncRequest recommends it too.
const olderMax = 50

// olderWait bounds how long the phone may take: it answers only while it is online, and may never answer at all.
var olderWait = 30 * time.Second

// olderRounds bounds how often one request asks again when the phone sent only messages the contract skips.
const olderRounds = 3

// olderBatch answers an `older` request. `More` says the phone sent messages of the chat; only an answer with nothing
// in it is the chat's start.
type olderBatch struct {
	Messages []waMessage `json:"messages"`
	More     bool        `json:"more"`

	oldest rawKey
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
}

type olderAsk struct {
	chat   string
	answer chan olderBatch
}

// olderWaiter holds the one request in flight. ON_DEMAND history comes only in answer to this device's own requests,
// and one process asks one at a time, so a batch that names the chat — or names no chat at all — is the answer.
type olderWaiter struct {
	mu      sync.Mutex
	current *olderAsk
}

func (w *olderWaiter) wait(chat string) *olderAsk {
	ask := &olderAsk{chat: chat, answer: make(chan olderBatch, 1)}
	w.mu.Lock()
	w.current = ask
	w.mu.Unlock()
	return ask
}

func (w *olderWaiter) forget(ask *olderAsk) {
	w.mu.Lock()
	if w.current == ask {
		w.current = nil
	}
	w.mu.Unlock()
}

// deliver hands the waiting request its chat's messages and returns the rest of the batch, for the history event:
// the phone may put other chats and push names in the same answer, and those are saved like any history push.
func (w *olderWaiter) deliver(h waHistory) waHistory {
	w.mu.Lock()
	ask := w.current
	w.mu.Unlock()
	if ask == nil || !(len(h.Chats) == 0 || names(h, ask.chat)) {
		return h
	}
	w.forget(ask)
	oldest, more := h.oldest[ask.chat]
	batch := olderBatch{Messages: []waMessage{}, More: more, oldest: oldest}
	rest := waHistory{Kind: h.Kind, Chats: []waChat{}, Contacts: h.Contacts, Messages: []waMessage{}}
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
	return len(h.Chats) == 0 && len(h.Contacts) == 0 && len(h.Messages) == 0
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
	// An empty page tells cli-core the chat's start is held, so a batch of only skipped messages is asked past.
	for range olderRounds {
		batch, err := e.askOlder(chat, info, count)
		if err != nil || len(batch.Messages) > 0 || !batch.More {
			return batch, err
		}
		info = reanchor(info, batch.oldest)
	}
	return nil, &failure{"provider_error", "the phone sent only messages wa does not keep; this stretch of the chat cannot be read"}
}

func reanchor(info types.MessageInfo, oldest rawKey) types.MessageInfo {
	info.ID = oldest.id
	info.IsFromMe = oldest.fromMe
	info.Timestamp = oldest.at
	return info
}

func (e *engine) askOlder(chat string, info types.MessageInfo, count int) (*olderBatch, error) {
	ask := e.olderAsks.wait(chat)
	defer e.olderAsks.forget(ask)
	if _, err := e.client.SendPeerMessage(e.ctx, e.client.BuildHistorySyncRequest(&info, count)); err != nil {
		return nil, err
	}
	select {
	case batch := <-ask.answer:
		return &batch, nil
	case <-time.After(olderWait):
		return nil, &failure{"timeout", "the phone did not send older messages in time; it must be online, with WhatsApp able to connect"}
	case <-e.ctx.Done():
		return nil, &failure{"provider_unavailable", "the engine stopped before the phone answered"}
	}
}
