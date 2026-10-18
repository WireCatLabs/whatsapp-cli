package main

import (
	"slices"
	"time"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// pinDurations are the lengths WhatsApp's apps offer, in seconds (Baileys lists the same three). cli-core always sends
// one: its pinDefaultDuration fills a pin asked without a length.
var pinDurations = []uint32{86400, 604800, 2592000}

func (e *engine) dispatchPins(req request) (any, bool, error) {
	switch req.Op {
	case "pin":
		return nil, true, e.pin(req, true)
	case "unpin":
		return nil, true, e.pin(req, false)
	}
	return nil, false, nil
}

// pin pins or unpins a message for everyone in the chat: WhatsApp has no pin only the account sees.
func (e *engine) pin(req request, pinned bool) error {
	lasts, err := pinLength(req.Duration, pinned)
	if err != nil {
		return err
	}
	t, err := targetOf(req)
	if err != nil {
		return err
	}
	if t.chat.Server == types.NewsletterServer {
		return &failure{"validation_error", "pins in channels are not supported yet"}
	}
	if err := e.connect(); err != nil {
		return err
	}
	t = e.participantFor(t)
	_, err = e.client.SendMessage(e.ctx, t.chat, pinMessage(e.client.BuildMessageKey(t.chat, t.sender, t.id), pinned, lasts, time.Now()))
	return err
}

// pinLength is checked here as well as in cli-core: the apps offer only these three lengths, and what WhatsApp makes
// of another one is not known.
func pinLength(asked uint32, pinned bool) (uint32, error) {
	if !pinned {
		return 0, nil
	}
	if !slices.Contains(pinDurations, asked) {
		return 0, &failure{"validation_error", "a pin lasts 24 hours, 7 days or 30 days"}
	}
	return asked, nil
}

// pinMessage is a pin as WhatsApp's apps send it, and Baileys after them: the target's key, the sender's time, and how
// long it lasts, zero for an unpin. whatsmeow sends it with the pin edit attribute.
func pinMessage(key *waCommon.MessageKey, pinned bool, lasts uint32, at time.Time) *waE2E.Message {
	kind := waE2E.PinInChatMessage_PIN_FOR_ALL
	if !pinned {
		kind, lasts = waE2E.PinInChatMessage_UNPIN_FOR_ALL, 0
	}
	return &waE2E.Message{
		PinInChatMessage: &waE2E.PinInChatMessage{
			Key:               key,
			Type:              kind.Enum(),
			SenderTimestampMS: proto.Int64(at.UnixMilli()),
		},
		MessageContextInfo: &waE2E.MessageContextInfo{MessageAddOnDurationInSecs: proto.Uint32(lasts)},
	}
}
