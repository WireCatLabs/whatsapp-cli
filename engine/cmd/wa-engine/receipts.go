package main

import (
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

type waReceipt struct {
	Chat     string `json:"chat"`
	ID       string `json:"id"`
	Delivery string `json:"delivery"`
	At       string `json:"at"`
}

// receipts are how far the owner's messages in a one-to-one chat got. A group's come one person at a time, which the
// store has no field for; the account's own devices send theirs (sender, read-self) for its own reading, not the
// recipient's; retries and errors say nothing about the person.
func (c *converter) receipts(evt *events.Receipt) []waReceipt {
	if evt.IsFromMe || evt.IsGroup || c.kindOf(evt.Chat.ToNonAD()) != "dm" {
		return nil
	}
	delivery, ok := deliveryOfReceipt(evt.Type)
	if !ok {
		return nil
	}
	chat := c.canonical(evt.Chat, nil).String()
	at := iso(evt.Timestamp)
	out := make([]waReceipt, 0, len(evt.MessageIDs))
	for _, id := range evt.MessageIDs {
		if id != "" {
			out = append(out, waReceipt{Chat: chat, ID: id, Delivery: delivery, At: at})
		}
	}
	return out
}

// A played voice note or view-once file was opened, so it counts as read.
func deliveryOfReceipt(t types.ReceiptType) (string, bool) {
	switch t {
	case types.ReceiptTypeDelivered:
		return "delivered", true
	case types.ReceiptTypeRead, types.ReceiptTypePlayed:
		return "read", true
	}
	return "", false
}

// pushedDelivery is the state the phone kept for its own message in a one-to-one chat; nothing for anything sooner.
func pushedDelivery(status waWeb.WebMessageInfo_Status) *string {
	var delivery string
	switch status {
	case waWeb.WebMessageInfo_DELIVERY_ACK:
		delivery = "delivered"
	case waWeb.WebMessageInfo_READ, waWeb.WebMessageInfo_PLAYED:
		delivery = "read"
	default:
		return nil
	}
	return &delivery
}
