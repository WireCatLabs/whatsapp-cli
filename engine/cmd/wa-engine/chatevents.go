package main

import (
	"crypto/sha256"
	"encoding/hex"
	"slices"
	"strconv"
	"strings"
	"time"

	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// waChatEvent is one change to who is in a group, or to its title. WhatsApp gives a live notification no id, so ID is
// derived from what both the notification and the history push's stub message carry: the store keeps one row per id.
type waChatEvent struct {
	Chat      string      `json:"chat"`
	ID        string      `json:"id"`
	Timestamp string      `json:"timestamp"`
	Event     string      `json:"event"`
	By        *string     `json:"by"`
	ByName    *string     `json:"byName"`
	People    []waContact `json:"people"`
	Title     *string     `json:"title,omitempty"`
}

// The direction of a change; join/add and leave/remove are told apart by who made it, the same way in both paths.
const (
	cameIn   = "in"
	wentOut  = "out"
	promoted = "promote"
	demoted  = "demote"
	retitled = "title"
)

// groupChanges reads a live group notification: one event per change it carries.
func (c *converter) groupChanges(evt *events.GroupInfo) []waChatEvent {
	k := known{}
	if evt.Sender != nil && evt.SenderPN != nil {
		k.add(*evt.SenderPN, *evt.Sender)
	}
	in := cameIn
	if evt.JoinReason == "invite" {
		in = "join"
	}
	var out []waChatEvent
	for _, one := range []struct {
		kind   string
		people []types.JID
	}{{in, evt.Join}, {wentOut, evt.Leave}, {promoted, evt.Promote}, {demoted, evt.Demote}} {
		if len(one.people) > 0 {
			out = append(out, c.chatEvent(evt.JID, evt.Timestamp, one.kind, evt.Sender, one.people, "", k))
		}
	}
	if evt.Name != nil {
		by := evt.Sender
		if !evt.Name.NameSetBy.IsEmpty() {
			by = &evt.Name.NameSetBy
			if !evt.Name.NameSetByPN.IsEmpty() {
				k.add(evt.Name.NameSetByPN, evt.Name.NameSetBy)
			}
		}
		out = append(out, c.chatEvent(evt.JID, evt.Timestamp, retitled, by, nil, evt.Name.Name, k))
	}
	return out
}

var stubKinds = map[waWeb.WebMessageInfo_StubType]string{
	waWeb.WebMessageInfo_GROUP_PARTICIPANT_ADD:               cameIn,
	waWeb.WebMessageInfo_GROUP_PARTICIPANT_INVITE:            "join",
	waWeb.WebMessageInfo_GROUP_PARTICIPANT_LINKED_GROUP_JOIN: "join",
	waWeb.WebMessageInfo_GROUP_PARTICIPANT_REMOVE:            wentOut,
	waWeb.WebMessageInfo_GROUP_PARTICIPANT_LEAVE:             "leave",
	waWeb.WebMessageInfo_GROUP_PARTICIPANT_PROMOTE:           promoted,
	waWeb.WebMessageInfo_GROUP_PARTICIPANT_DEMOTE:            demoted,
	waWeb.WebMessageInfo_GROUP_CHANGE_SUBJECT:                retitled,
}

// stubEvent reads a group's service message in a history push: the people are its stub parameters, the new title
// its first one. It is read before whatsmeow parses the message, which refuses one that names no sender.
func (c *converter) stubEvent(chat types.JID, web *waWeb.WebMessageInfo, k known) (waChatEvent, bool) {
	kind, ok := stubKinds[web.GetMessageStubType()]
	if !ok || chat.Server != types.GroupServer {
		return waChatEvent{}, false
	}
	var by *types.JID
	if web.GetKey().GetFromMe() && !c.self.IsEmpty() {
		by = &c.self
	} else if raw := firstOf(web.GetParticipant(), web.GetKey().GetParticipant()); raw != "" {
		if actor, err := types.ParseJID(raw); err == nil {
			by = &actor
		}
	}
	at := time.Unix(int64(web.GetMessageTimestamp()), 0)
	params := web.GetMessageStubParameters()
	if kind == retitled {
		if len(params) == 0 {
			return waChatEvent{}, false
		}
		return c.chatEvent(chat, at, kind, by, nil, params[0], k), true
	}
	var people []types.JID
	for _, param := range params {
		if person, err := types.ParseJID(param); err == nil && person.User != "" {
			people = append(people, person)
		}
	}
	if len(people) == 0 {
		return waChatEvent{}, false
	}
	return c.chatEvent(chat, at, kind, by, people, "", k), true
}

func firstOf(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func (c *converter) chatEvent(chat types.JID, at time.Time, kind string, by *types.JID, people []types.JID, title string, k known) waChatEvent {
	out := waChatEvent{Chat: c.canonical(chat, k).String(), Timestamp: iso(at), People: []waContact{}}
	var actor string
	if by != nil && !by.IsEmpty() {
		who := c.canonical(*by, k)
		actor = who.String()
		out.By = &actor
		out.ByName = name(c.nameOf(who))
	}
	ids := []string{}
	for _, person := range people {
		if id := c.canonical(person, k).String(); !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	for _, id := range ids {
		person, _ := types.ParseJID(id)
		out.People = append(out.People, waContact{JID: id, Name: name(c.nameOf(person))})
	}
	out.Event = actionOf(kind, actor, ids)
	if kind == retitled {
		out.Title = &title
	}
	out.ID = eventID(out.Chat, at, out.Event, ids)
	return out
}

// actionOf: someone who came in or went out on their own joined or left; anyone else's doing added or removed them.
func actionOf(kind, actor string, people []string) string {
	own := actor == "" || (len(people) == 1 && people[0] == actor)
	switch {
	case kind == cameIn && own:
		return "join"
	case kind == cameIn:
		return "add"
	case kind == wentOut && own:
		return "leave"
	case kind == wentOut:
		return "remove"
	}
	return kind
}

func eventID(chat string, at time.Time, action string, people []string) string {
	sum := sha256.Sum256([]byte(strings.Join(append([]string{chat, strconv.FormatInt(at.Unix(), 10), action}, people...), "\n")))
	return hex.EncodeToString(sum[:16])
}
