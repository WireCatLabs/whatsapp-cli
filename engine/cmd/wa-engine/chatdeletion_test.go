package main

import (
	"slices"
	"testing"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"google.golang.org/protobuf/proto"
)

var lastInGroup = &waCommon.MessageKey{
	RemoteJID:   proto.String(group.String()),
	FromMe:      proto.Bool(false),
	ID:          proto.String("3EB0LAST"),
	Participant: proto.String(annLID.String()),
}

func TestAClearIsTheClearChatPatchWhatsAppWebWrites(t *testing.T) {
	patch := chatDeletionPatch("clearChat", group, sentAt, lastInGroup)
	if patch.Type != appstate.WAPatchRegularHigh || len(patch.Mutations) != 1 {
		t.Fatalf("got a %s patch of %d mutations", patch.Type, len(patch.Mutations))
	}
	mutation := patch.Mutations[0]
	if want := []string{"clearChat", group.String(), "1", "0"}; !slices.Equal(mutation.Index, want) {
		t.Errorf("index %v, want %v: every message, starred too, and the phone's saved files kept", mutation.Index, want)
	}
	if mutation.Version != 6 {
		t.Errorf("version %d, want 6", mutation.Version)
	}
	messageRange := mutation.Value.GetClearChatAction().GetMessageRange()
	if messageRange.GetLastMessageTimestamp() != sentAt.Unix() || len(messageRange.GetMessages()) != 1 {
		t.Fatalf("range %v, want up to the last message, in seconds", messageRange)
	}
	if one := messageRange.GetMessages()[0]; !proto.Equal(one.GetKey(), lastInGroup) || one.GetTimestamp() != sentAt.Unix() {
		t.Errorf("range message %v, want the last message's key and time", one)
	}
}

func TestADeleteKeepsThePhonesSavedFiles(t *testing.T) {
	mutation := chatDeletionPatch("deleteChat", group, sentAt, lastInGroup).Mutations[0]
	if want := []string{"deleteChat", group.String(), "0"}; !slices.Equal(mutation.Index, want) {
		t.Errorf("index %v, want %v", mutation.Index, want)
	}
	if !proto.Equal(mutation.Value.GetDeleteChatAction().GetMessageRange().GetMessages()[0].GetKey(), lastInGroup) {
		t.Errorf("the delete is not bounded by the last message")
	}
}

func TestADeletionNeedsTheLastMessageAndAChat(t *testing.T) {
	last := request{Chat: group.String(), Message: "3EB0LAST", Sender: annLID.String(), Timestamp: "2026-09-01T10:00:00Z"}
	if _, at, err := lastOf(last); err != nil || !at.Equal(sentAt) {
		t.Errorf("a full key gave %v, %v", at, err)
	}
	channel, untimed, unaddressed := last, last, last
	channel.Chat = "120363000000000002@newsletter"
	untimed.Timestamp = ""
	unaddressed.Message = ""
	for _, req := range []request{channel, untimed, unaddressed} {
		if _, _, err := lastOf(req); !isFailure(err, "validation_error") {
			t.Errorf("%+v gave %v, want a validation_error", req, err)
		}
	}
}
