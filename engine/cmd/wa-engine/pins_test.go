package main

import (
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"
)

func TestAPinCarriesTheTargetItsTimeAndSevenDays(t *testing.T) {
	key := &waCommon.MessageKey{RemoteJID: proto.String(group.String()), ID: proto.String("3EB0A1"), FromMe: proto.Bool(false), Participant: proto.String(annLID.String())}
	at := time.UnixMilli(1_790_000_000_000)
	cases := []struct {
		name   string
		pinned bool
		kind   waE2E.PinInChatMessage_Type
		lasts  uint32
	}{
		{"a pin", true, waE2E.PinInChatMessage_PIN_FOR_ALL, 604800},
		{"an unpin", false, waE2E.PinInChatMessage_UNPIN_FOR_ALL, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := pinMessage(key, tc.pinned, at)
			p := m.GetPinInChatMessage()
			if p.GetKey() != key || p.GetType() != tc.kind || p.GetSenderTimestampMS() != at.UnixMilli() {
				t.Fatalf("got %v", p)
			}
			if m.MessageContextInfo.MessageAddOnDurationInSecs == nil || m.GetMessageContextInfo().GetMessageAddOnDurationInSecs() != tc.lasts {
				t.Fatalf("got duration %v, want %d", m.GetMessageContextInfo(), tc.lasts)
			}
		})
	}
}

func TestAPinThatArrivesIsNotStoredAsAMessage(t *testing.T) {
	pin := &waE2E.Message{PinInChatMessage: &waE2E.PinInChatMessage{Type: waE2E.PinInChatMessage_PIN_FOR_ALL.Enum()}}
	if _, ok := testConverter().message(incoming(annLID, annLID, pin), nil); ok {
		t.Fatal("a pin was kept as a message")
	}
}
