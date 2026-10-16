package main

import (
	"encoding/json"
	"io"
	"sync"
)

// protocol must equal PROTOCOL in src/engine/contract.ts; the adapter refuses any other.
const protocol = 1

type hello struct {
	Protocol int     `json:"protocol"`
	Engine   string  `json:"engine"`
	Version  string  `json:"version"`
	Self     *string `json:"self"`
}

type request struct {
	ID      int    `json:"id"`
	Op      string `json:"op"`
	JID     string `json:"jid,omitempty"`
	Method  string `json:"method,omitempty"`
	Phone   string `json:"phone,omitempty"`
	Chat    string `json:"chat,omitempty"`
	Text    string `json:"text,omitempty"`
	SendID  string `json:"sendId,omitempty"`
	ReplyTo string `json:"replyTo,omitempty"`
}

// failure carries a code from the contract's closed list and fixed wording: never a JID, a name or anything typed.
type failure struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (f *failure) Error() string { return f.Message }

type waChat struct {
	JID           string  `json:"jid"`
	Name          *string `json:"name"`
	Kind          string  `json:"kind"`
	Unread        *int    `json:"unread"`
	LastMessageAt *string `json:"lastMessageAt"`
	Participants  *int    `json:"participants"`
	Archived      *bool   `json:"archived,omitempty"`
	Muted         *bool   `json:"muted,omitempty"`
}

type waContact struct {
	JID  string  `json:"jid"`
	Name *string `json:"name"`
}

type waMessage struct {
	ID         string  `json:"id"`
	Chat       string  `json:"chat"`
	Sender     *string `json:"sender"`
	SenderName *string `json:"senderName"`
	FromMe     bool    `json:"fromMe"`
	Timestamp  string  `json:"timestamp"`
	EditedAt   *string `json:"editedAt"`
	Text       string  `json:"text"`
	ReplyTo    *string `json:"replyTo"`
}

type waHistory struct {
	Kind     string      `json:"kind"`
	Chats    []waChat    `json:"chats"`
	Contacts []waContact `json:"contacts"`
	Messages []waMessage `json:"messages"`
}

type waAccount struct {
	JID  string  `json:"jid"`
	Name *string `json:"name"`
}

type waChatCard struct {
	Chat    waChat      `json:"chat"`
	Members []waContact `json:"members"`
}

// wire writes one JSON value per line to stdout. Every line goes through it, so lines never interleave.
type wire struct {
	mu  sync.Mutex
	enc *json.Encoder
}

func newWire(out io.Writer) *wire { return &wire{enc: json.NewEncoder(out)} }

func (w *wire) send(value any) {
	w.mu.Lock()
	defer w.mu.Unlock()
	_ = w.enc.Encode(value)
}

func (w *wire) hello(h hello)            { w.send(map[string]any{"hello": h}) }
func (w *wire) refuse(f *failure)        { w.send(map[string]any{"refused": f}) }
func (w *wire) ok(id int, value any)     { w.send(map[string]any{"id": id, "ok": value}) }
func (w *wire) fail(id int, f *failure)  { w.send(map[string]any{"id": id, "error": f}) }
func (w *wire) event(name string, f any) { w.send(map[string]any{"event": name, fieldOf(name): f}) }
func (w *wire) connection(state string) {
	w.send(map[string]any{"event": "connection", "state": state})
}
func (w *wire) loginCode(kind, code string) { w.send(map[string]any{"login": kind, "code": code}) }
func (w *wire) deleted(chat, id string) {
	w.send(map[string]any{"event": "delete", "chat": chat, "id": id})
}

func fieldOf(event string) string {
	if event == "history" {
		return "history"
	}
	return "message"
}
