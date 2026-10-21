package main

import (
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// waCall is what a call message carries beside its text. Outcome is absent while the call rings.
type waCall struct {
	Video    bool   `json:"video"`
	Group    bool   `json:"group,omitempty"`
	Outcome  string `json:"outcome,omitempty"` // "missed", "answered", "declined"
	Duration *int64 `json:"duration,omitempty"`
}

// ringing is a call whose offer this process saw. Its end is told only by call id, with no word on the chat or the
// kind of call, so without the offer the end is not recorded.
type ringing struct {
	message    waMessage
	answeredAt time.Time
}

// calls holds the calls this process saw ring, until each ends. A call that never ends here is dropped past the cap.
type calls struct {
	mu   sync.Mutex
	open map[string]*ringing
}

const maxRinging = 64

func (c *calls) start(id string, r *ringing) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.open == nil {
		c.open = map[string]*ringing{}
	}
	if len(c.open) >= maxRinging {
		for old := range c.open {
			delete(c.open, old)
			break
		}
	}
	c.open[id] = r
}

func (c *calls) find(id string) (*ringing, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	r, ok := c.open[id]
	return r, ok
}

func (c *calls) end(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.open, id)
}

// callID is the stored message's id: every event of one call names the same message, as mautrix-whatsapp keys it.
func callID(id string) string { return "call-" + id }

// offer is the message a ringing call becomes, in the caller's one-to-one chat or in the group. The owner's own call
// from the phone names no peer in a one-to-one chat, so it is skipped there.
func (c *converter) offer(meta types.BasicCallMeta, video, group bool, k known) (waMessage, bool) {
	if meta.CallID == "" || meta.CallCreator.IsEmpty() {
		return waMessage{}, false
	}
	k.add(meta.CallCreator, meta.CallCreatorAlt)
	k.add(meta.CallCreatorAlt, meta.CallCreator)
	creator := c.canonical(meta.CallCreator, k)
	fromMe := !c.self.IsEmpty() && creator == c.self
	chat := creator
	if !meta.GroupJID.IsEmpty() {
		chat, group = meta.GroupJID.ToNonAD(), true
	} else if meta.From.Server == types.GroupServer {
		chat, group = meta.From.ToNonAD(), true
	} else if group || fromMe {
		return waMessage{}, false
	}
	at := meta.Timestamp
	if at.IsZero() {
		at = time.Now()
	}
	out := waMessage{
		ID:        callID(meta.CallID),
		Chat:      chat.String(),
		Sender:    str(creator.String()),
		FromMe:    fromMe,
		Timestamp: iso(at),
		Call:      &waCall{Video: video, Group: group},
	}
	if !fromMe {
		out.SenderName = name(c.nameOf(creator))
	}
	out.Text = callText(out)
	return out, true
}

// callText is what a call shows in a chat list or an inbox, in the words WhatsApp's apps use.
func callText(m waMessage) string {
	kind := "voice call"
	if m.Call.Video {
		kind = "video call"
	}
	if m.Call.Group {
		kind = "group " + kind
	}
	switch {
	case m.Call.Outcome == "missed":
		return "Missed " + kind
	case m.Call.Outcome == "declined":
		return "Declined " + kind
	case m.Call.Outcome == "answered", m.FromMe:
		return strings.ToUpper(kind[:1]) + kind[1:]
	}
	return "Incoming " + kind
}

// call records a call as a message: when it rings, and again when it ends with what became of it. A group call's
// end says nothing about the owner, so only its ringing is recorded. Nothing is sent: whatsmeow acknowledges the call
// stanza itself, as every client does, and the call is never rejected from here.
func (e *engine) call(raw any) {
	switch evt := raw.(type) {
	case *events.CallOffer:
		video := false
		if evt.Data != nil {
			_, video = evt.Data.GetOptionalChildByTag("video")
		}
		e.ringing(evt.BasicCallMeta, video, false)
	case *events.CallOfferNotice:
		e.ringing(evt.BasicCallMeta, evt.Media == "video", evt.Type == "group")
	case *events.CallAccept:
		if r, ok := e.calls.find(evt.CallID); ok && !r.message.Call.Group {
			r.answeredAt = orNow(evt.Timestamp)
			e.callEnded(r, "answered")
		}
	case *events.CallReject:
		if r, ok := e.calls.find(evt.CallID); ok && !r.message.Call.Group {
			e.calls.end(evt.CallID)
			e.callEnded(r, "declined")
		}
	case *events.CallTerminate:
		r, ok := e.calls.find(evt.CallID)
		if !ok {
			return
		}
		e.calls.end(evt.CallID)
		if r.message.Call.Group {
			return
		}
		if r.answeredAt.IsZero() {
			e.callEnded(r, "missed")
			return
		}
		seconds := int64(orNow(evt.Timestamp).Sub(r.answeredAt).Seconds())
		r.message.Call.Duration = &seconds
		e.callEnded(r, "answered")
	}
}

func (e *engine) ringing(meta types.BasicCallMeta, video, group bool) {
	k := known{}
	message, ok := e.conv.offer(meta, video, group, k)
	for _, rekey := range e.phones.settle(e.ctx, e.lidOf(k), time.Now()) {
		e.out.rekey(rekey)
	}
	if !ok {
		return
	}
	e.phones.note(e.ctx, message.Chat)
	e.calls.start(meta.CallID, &ringing{message: message})
	e.out.event("message", message)
}

func (e *engine) callEnded(r *ringing, outcome string) {
	message := r.message
	call := *message.Call
	call.Outcome = outcome
	message.Call = &call
	message.Text = callText(message)
	e.out.event("message", message)
}

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
