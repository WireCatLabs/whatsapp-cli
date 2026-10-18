package main

import (
	"slices"
	"testing"

	"go.mau.fi/whatsmeow/appstate"
	"google.golang.org/protobuf/proto"
)

func TestAnArchiveIsBoundedByTheLastMessageAndUnpinsTheChat(t *testing.T) {
	patch := chatListPatch("archiveChat", group, sentAt, lastInGroup)
	if patch.Type != appstate.WAPatchRegularLow || len(patch.Mutations) != 2 {
		t.Fatalf("got a %s patch of %d mutations, want regular_low with archive and unpin", patch.Type, len(patch.Mutations))
	}
	archive, unpin := patch.Mutations[0], patch.Mutations[1]
	if want := []string{"archive", group.String()}; !slices.Equal(archive.Index, want) || archive.Version != 3 {
		t.Errorf("archive index %v version %d, want %v version 3", archive.Index, archive.Version, want)
	}
	action := archive.Value.GetArchiveChatAction()
	if !action.GetArchived() {
		t.Errorf("the chat is not archived")
	}
	messageRange := action.GetMessageRange()
	if messageRange.GetLastMessageTimestamp() != sentAt.Unix() || !proto.Equal(messageRange.GetMessages()[0].GetKey(), lastInGroup) {
		t.Errorf("range %v, want up to the last message", messageRange)
	}
	if want := []string{"pin_v1", group.String()}; !slices.Equal(unpin.Index, want) || unpin.Value.GetPinAction().GetPinned() {
		t.Errorf("second mutation %v, want the chat unpinned", unpin.Index)
	}
}

func TestAnUnarchiveLeavesThePinAlone(t *testing.T) {
	patch := chatListPatch("unarchiveChat", group, sentAt, lastInGroup)
	if len(patch.Mutations) != 1 || patch.Mutations[0].Value.GetArchiveChatAction().GetArchived() {
		t.Fatalf("got %d mutations, want one that unarchives", len(patch.Mutations))
	}
}

func TestAMarkUnreadIsTheReadPatchWithReadFalse(t *testing.T) {
	patch := chatListPatch("markChatUnread", group, sentAt, lastInGroup)
	if patch.Type != appstate.WAPatchRegularLow || len(patch.Mutations) != 1 {
		t.Fatalf("got a %s patch of %d mutations", patch.Type, len(patch.Mutations))
	}
	mutation := patch.Mutations[0]
	if want := []string{"markChatAsRead", group.String()}; !slices.Equal(mutation.Index, want) {
		t.Errorf("index %v, want %v", mutation.Index, want)
	}
	action := mutation.Value.GetMarkChatAsReadAction()
	if action.Read == nil || action.GetRead() {
		t.Errorf("read %v, want false", action.Read)
	}
	if !proto.Equal(action.GetMessageRange().GetMessages()[0].GetKey(), lastInGroup) {
		t.Errorf("the mark is not bounded by the last message")
	}
}

func TestAMarkReadIsTheReadPatchWithReadTrue(t *testing.T) {
	patch := chatListPatch("markChatRead", group, sentAt, lastInGroup)
	if patch.Type != appstate.WAPatchRegularLow || len(patch.Mutations) != 1 {
		t.Fatalf("got a %s patch of %d mutations", patch.Type, len(patch.Mutations))
	}
	mutation := patch.Mutations[0]
	if want := []string{"markChatAsRead", group.String()}; !slices.Equal(mutation.Index, want) || mutation.Version != 3 {
		t.Errorf("index %v version %d, want %v version 3", mutation.Index, mutation.Version, want)
	}
	action := mutation.Value.GetMarkChatAsReadAction()
	if !action.GetRead() {
		t.Errorf("read %v, want true", action.Read)
	}
	messageRange := action.GetMessageRange()
	if messageRange.GetLastMessageTimestamp() != sentAt.Unix() || !proto.Equal(messageRange.GetMessages()[0].GetKey(), lastInGroup) {
		t.Errorf("range %v, want up to the named message", messageRange)
	}
}

func TestChannelsAreNotArrangedInTheChatList(t *testing.T) {
	e := &engine{}
	for _, jid := range []string{"120363000000000002@newsletter", "status@broadcast", "not a jid"} {
		if err := e.pinChat(request{Op: "pinChat", JID: jid}); !isFailure(err, "validation_error") {
			t.Errorf("pinning %q gave %v, want a validation_error", jid, err)
		}
	}
	archive := request{Op: "archiveChat", Chat: "120363000000000002@newsletter", Message: "3EB0LAST", Timestamp: "2026-09-01T10:00:00Z"}
	if err := e.arrangeChat(archive); !isFailure(err, "validation_error") {
		t.Errorf("archiving a channel gave %v, want a validation_error", err)
	}
	archive.Op = "markChatRead"
	if err := e.arrangeChat(archive); !isFailure(err, "validation_error") {
		t.Errorf("marking a channel read in the chat list gave %v, want a validation_error", err)
	}
}
