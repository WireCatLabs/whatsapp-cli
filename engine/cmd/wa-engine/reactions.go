package main

import (
	"time"

	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// waReaction is one person's reaction change to a message: WhatsApp sends each change on its own, never totals. A nil
// reaction takes theirs back. The account's own reaction carries the account's id exactly as self() has it, the
// way a vote does: cli-core keeps one row per person by that id.
type waReaction struct {
	Chat        string  `json:"chat"`
	Message     string  `json:"message"`
	Reactor     string  `json:"reactor"`
	ReactorName *string `json:"reactorName"`
	Own         bool    `json:"own"`
	Reaction    *string `json:"reaction"`
	ReactedAt   string  `json:"reactedAt"`
}

// reaction is a live reaction. Its sender is the reactor: the participant in a group, the chat in a one-to-one chat,
// and the account when whatsmeow marks it the account's own, sent from the phone.
func (c *converter) reaction(evt *events.Message) (waReaction, bool) {
	info := evt.Info
	message := evt.Message.GetReactionMessage()
	target := message.GetKey().GetID()
	if target == "" || info.Chat == types.StatusBroadcastJID {
		return waReaction{}, false
	}
	k := known{}
	k.add(info.Sender, info.SenderAlt)
	k.add(info.SenderAlt, info.Sender)
	if !info.IsGroup {
		k.add(info.Chat, info.RecipientAlt)
		k.add(info.RecipientAlt, info.Chat)
	}
	reactor, reactorName := c.self, (*string)(nil)
	if !info.IsFromMe {
		reactor = c.canonical(info.Sender, k)
		reactorName = name(info.PushName, c.nameOf(reactor))
	}
	if reactor.IsEmpty() {
		return waReaction{}, false
	}
	at := info.Timestamp
	if ms := message.GetSenderTimestampMS(); ms > 0 {
		at = time.UnixMilli(ms)
	}
	return waReaction{
		Chat:        c.canonical(info.Chat, k).String(),
		Message:     target,
		Reactor:     reactor.String(),
		ReactorName: reactorName,
		Own:         info.IsFromMe,
		Reaction:    str(message.GetText()),
		ReactedAt:   iso(at),
	}, true
}

// historyReactions are the reactions the phone pushes beside the message they are on. A reaction's key is the
// reaction's own: it names the reactor as a vote's key names the voter, and a one-to-one chat's key may name no
// participant, which makes the other person the reactor.
func (c *converter) historyReactions(target waMessage, web *waWeb.WebMessageInfo, k known) []waReaction {
	var reactions []waReaction
	for _, pushed := range web.GetReactions() {
		key := pushed.GetKey()
		reactor := c.self
		if !key.GetFromMe() {
			raw := key.GetParticipant()
			if raw == "" {
				raw = key.GetRemoteJID()
			}
			parsed, err := types.ParseJID(raw)
			if err != nil {
				continue
			}
			reactor = c.canonical(parsed, k)
		}
		if reactor.IsEmpty() || reactor.Server == types.GroupServer {
			continue
		}
		at := target.Timestamp
		if ms := pushed.GetSenderTimestampMS(); ms > 0 {
			at = iso(time.UnixMilli(ms))
		}
		own := reactor == c.self
		var reactorName *string
		if !own {
			reactorName = name(c.nameOf(reactor))
		}
		reactions = append(reactions, waReaction{
			Chat:        target.Chat,
			Message:     target.ID,
			Reactor:     reactor.String(),
			ReactorName: reactorName,
			Own:         own,
			Reaction:    str(pushed.GetText()),
			ReactedAt:   at,
		})
	}
	return reactions
}

func (e *engine) liveReaction(evt *events.Message) {
	if reaction, ok := e.conv.reaction(evt); ok {
		e.phones.note(e.ctx, evt.Info.Chat.ToNonAD().String())
		e.out.event("reaction", reaction)
	}
}
