package main

import (
	"time"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// pinFor is how long a pin lasts. WhatsApp's pins last 24 hours, 7 days or 30 days (Baileys lists the three and
// falls back to 24 hours); wa sends 7 days because cli-core's command has no duration to choose one.
const pinFor = 7 * 24 * time.Hour

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
	_, err = e.client.SendMessage(e.ctx, t.chat, pinMessage(e.client.BuildMessageKey(t.chat, t.sender, t.id), pinned, time.Now()))
	return err
}

// pinMessage is a pin as WhatsApp's apps send it, and Baileys after them: the target's key, the sender's time, and how
// long it lasts, zero for an unpin. whatsmeow sends it with the pin edit attribute.
func pinMessage(key *waCommon.MessageKey, pinned bool, at time.Time) *waE2E.Message {
	kind, lasts := waE2E.PinInChatMessage_PIN_FOR_ALL, uint32(pinFor.Seconds())
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
