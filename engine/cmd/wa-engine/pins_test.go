package main

import (
	"errors"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"
)

func TestAPinCarriesTheTargetItsTimeAndHowLongItLasts(t *testing.T) {
	key := &waCommon.MessageKey{RemoteJID: proto.String(group.String()), ID: proto.String("3EB0A1"), FromMe: proto.Bool(false), Participant: proto.String(annLID.String())}
	at := time.UnixMilli(1_790_000_000_000)
	cases := []struct {
		name   string
		pinned bool
		asked  uint32
		kind   waE2E.PinInChatMessage_Type
		lasts  uint32
	}{
		{"a pin without a length", true, 0, waE2E.PinInChatMessage_PIN_FOR_ALL, 604800},
		{"a pin for 24 hours", true, 86400, waE2E.PinInChatMessage_PIN_FOR_ALL, 86400},
		{"a pin for 7 days", true, 604800, waE2E.PinInChatMessage_PIN_FOR_ALL, 604800},
		{"a pin for 30 days", true, 2592000, waE2E.PinInChatMessage_PIN_FOR_ALL, 2592000},
		{"an unpin", false, 0, waE2E.PinInChatMessage_UNPIN_FOR_ALL, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			lasts, err := pinLength(tc.asked, tc.pinned)
			if err != nil {
				t.Fatal(err)
			}
			m := pinMessage(key, tc.pinned, lasts, at)
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

func TestAPinForAnotherLengthIsRefusedBeforeConnecting(t *testing.T) {
	e := &engine{}
	_, handled, err := e.dispatchPins(request{Op: "pin", Chat: group.String(), Message: "3EB0A1", FromMe: true, Duration: 3600})
	var f *failure
	if !handled || !errors.As(err, &f) || f.Code != "validation_error" {
		t.Fatalf("got handled %v, error %v", handled, err)
	}
}

func TestAPinThatArrivesIsNotStoredAsAMessage(t *testing.T) {
	pin := &waE2E.Message{PinInChatMessage: &waE2E.PinInChatMessage{Type: waE2E.PinInChatMessage_PIN_FOR_ALL.Enum()}}
	if _, ok := testConverter().message(incoming(annLID, annLID, pin), nil); ok {
		t.Fatal("a pin was kept as a message")
	}
}
