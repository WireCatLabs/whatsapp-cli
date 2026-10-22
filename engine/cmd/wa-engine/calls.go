package main

import (
	"strings"
	"sync"
	"time"

	waBinary "go.mau.fi/whatsmeow/binary"
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
	settled    bool
}

// calls holds the calls this process saw ring, until each ends, and the ends that came before their offer. A call
// that never ends here is dropped past the cap.
type calls struct {
	mu    sync.Mutex
	open  map[string]*ringing
	early map[string]string
}

const maxRinging = 64

func (c *calls) start(id string, r *ringing) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.open = bounded(c.open)
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

func (c *calls) endedEarly(id, reason string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.early = bounded(c.early)
	c.early[id] = reason
}

func (c *calls) takeEarly(id string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	reason, ok := c.early[id]
	delete(c.early, id)
	return reason, ok
}

// unsettled hands out, once each, the one-to-one calls still ringing with no answer seen. They stay open, so an end
// that comes later still says what became of them.
func (c *calls) unsettled() []*ringing {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []*ringing
	for _, r := range c.open {
		if !r.settled && !r.message.Call.Group && r.answeredAt.IsZero() {
			r.settled = true
			out = append(out, r)
		}
	}
	return out
}

func bounded[V any](m map[string]V) map[string]V {
	if m == nil {
		return map[string]V{}
	}
	if len(m) >= maxRinging {
		for old := range m {
			delete(m, old)
			break
		}
	}
	return m
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
	out.Text = callText(out, false)
	return out, true
}

// callText is what a call shows in a chat list or an inbox, in the words WhatsApp's apps use. A call that ended in a
// way this device could not tell is no longer incoming, so it reads as a plain call.
func callText(m waMessage, ended bool) string {
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
	case m.Call.Outcome == "answered", m.FromMe, ended:
		return strings.ToUpper(kind[:1]) + kind[1:]
	}
	return "Incoming " + kind
}

// endOutcome reads a terminate's reason as WhatsApp Web does, per whatsapp-rust's port of it: a phone of the owner's
// that answers or declines is told to linked devices by the caller as "accepted_elsewhere" or "rejected_elsewhere",
// and a call that rang out, or that the caller hung up, ends with "timeout" or no reason, which the callee's apps show
// as missed. Any other reason is unknown.
func endOutcome(reason string) (string, bool) {
	switch reason {
	case "", "timeout", "group_call_ended":
		return "missed", true
	case "accepted_elsewhere":
		return "answered", true
	case "rejected_elsewhere":
		return "declined", true
	}
	return "", false
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
			e.callEnded(r, "answered", "")
		}
	case *events.CallReject:
		// "busy" and "enc" speak for one device that cannot take the call; the owner's other devices go on ringing.
		if reason := attr(evt.Data, "reason"); reason == "busy" || reason == "enc" {
			return
		}
		if r, ok := e.calls.find(evt.CallID); ok && !r.message.Call.Group {
			e.calls.end(evt.CallID)
			e.callEnded(r, "declined", "")
		}
	case *events.CallTerminate:
		r, ok := e.calls.find(evt.CallID)
		if !ok {
			e.calls.endedEarly(evt.CallID, evt.Reason)
			return
		}
		e.calls.end(evt.CallID)
		if !r.message.Call.Group {
			e.terminated(r, evt.Reason, evt.Timestamp)
		}
	}
}

// terminated settles a one-to-one call. An answer this device saw stands, and its length counts only from an end that
// is the call's own: "accepted_elsewhere" comes the moment the phone picks up.
func (e *engine) terminated(r *ringing, reason string, at time.Time) {
	if !r.answeredAt.IsZero() {
		if reason != "accepted_elsewhere" && reason != "rejected_elsewhere" {
			if seconds := int64(orNow(at).Sub(r.answeredAt).Seconds()); seconds > 0 {
				r.message.Call.Duration = &seconds
			}
		}
		e.callEnded(r, "answered", reason)
		return
	}
	e.callEnded(r, "", reason)
}

// offlineReplayed settles the calls that rang while this device was away. Their offers come back on reconnect with
// the server's offline queue, which may hold no end for them; WhatsApp Web shows such a call as missed.
func (e *engine) offlineReplayed() {
	for _, r := range e.calls.unsettled() {
		e.callEnded(r, "missed", "")
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
	r := &ringing{message: message}
	if reason, ended := e.calls.takeEarly(meta.CallID); ended && !message.Call.Group {
		e.terminated(r, reason, time.Time{})
		return
	}
	e.calls.start(meta.CallID, r)
	e.out.event("message", message)
}

// callEnded records what became of a call. With no outcome given, the reason decides it; a reason WhatsApp has not
// been seen to send keeps the call with no outcome, and only the reason, a fixed protocol word, reaches the log.
func (e *engine) callEnded(r *ringing, outcome, reason string) {
	if outcome == "" {
		known := false
		if outcome, known = endOutcome(reason); !known {
			e.warnf("call.unknown-end: a call ended with reason %q; kept with no outcome", protocolWord(reason))
		}
	}
	message := r.message
	call := *message.Call
	call.Outcome = outcome
	message.Call = &call
	message.Text = callText(message, true)
	e.out.event("message", message)
}

func attr(node *waBinary.Node, name string) string {
	if node == nil {
		return ""
	}
	value, _ := node.Attrs[name].(string)
	return value
}

// protocolWord passes a word from WhatsApp's call protocol to the log, and nothing that could carry an id or a number.
func protocolWord(s string) string {
	if len(s) == 0 || len(s) > 40 {
		return "(not a protocol word)"
	}
	for _, r := range s {
		if (r < 'a' || r > 'z') && r != '_' {
			return "(not a protocol word)"
		}
	}
	return s
}

func (e *engine) warnf(format string, args ...any) {
	if e.client != nil && e.client.Log != nil {
		e.client.Log.Warnf(format, args...)
	}
}

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
