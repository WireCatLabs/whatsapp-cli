package main

import (
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func TestOlderAsksThePhoneForMessagesBeforeTheAnchor(t *testing.T) {
	info, count, err := olderAnchor(request{
		Chat: group.String(), Message: "3EB0A1", FromMe: true, Timestamp: "2026-09-01T10:00:00.000Z", Count: 500,
	})
	if err != nil {
		t.Fatal(err)
	}
	if count != olderMax {
		t.Errorf("count: got %d, want it capped at %d", count, olderMax)
	}
	// BuildHistorySyncRequest reads nothing from the client.
	msg := (*whatsmeow.Client)(nil).BuildHistorySyncRequest(&info, count)
	op := msg.GetProtocolMessage().GetPeerDataOperationRequestMessage()
	if op.GetPeerDataOperationRequestType() != waE2E.PeerDataOperationRequestType_HISTORY_SYNC_ON_DEMAND {
		t.Fatalf("got %v", op.GetPeerDataOperationRequestType())
	}
	req := op.GetHistorySyncOnDemandRequest()
	if req.GetChatJID() != group.String() || req.GetOldestMsgID() != "3EB0A1" || !req.GetOldestMsgFromMe() {
		t.Errorf("anchor: got %+v", req)
	}
	if req.GetOldestMsgTimestampMS() != sentAt.Unix() || req.GetOnDemandMsgCount() != olderMax {
		t.Errorf("time and count: got %d, %d", req.GetOldestMsgTimestampMS(), req.GetOnDemandMsgCount())
	}
}

func TestOlderRefusesAnAnchorItCannotSend(t *testing.T) {
	for name, req := range map[string]request{
		"no chat":       {Message: "3EB0A1", Timestamp: "2026-09-01T10:00:00Z"},
		"no message id": {Chat: annLID.String(), Timestamp: "2026-09-01T10:00:00Z"},
		"no time":       {Chat: annLID.String(), Message: "3EB0A1"},
	} {
		t.Run(name, func(t *testing.T) {
			_, _, err := olderAnchor(req)
			if f, ok := err.(*failure); !ok || f.Code != "validation_error" {
				t.Fatalf("got %v, want a validation_error", err)
			}
		})
	}
}

func onDemand(conversations ...*waHistorySync.Conversation) *waHistorySync.HistorySync {
	return &waHistorySync.HistorySync{
		SyncType:      waHistorySync.HistorySync_ON_DEMAND.Enum(),
		Conversations: conversations,
		Pushnames:     []*waHistorySync.Pushname{{ID: proto.String(annLID.String()), Pushname: proto.String("Ann")}},
	}
}

func conversation(id types.JID, ids ...string) *waHistorySync.Conversation {
	messages := make([]*waHistorySync.HistorySyncMsg, 0, len(ids))
	for _, one := range ids {
		messages = append(messages, &waHistorySync.HistorySyncMsg{
			Message: &waWeb.WebMessageInfo{Key: &waCommon.MessageKey{ID: proto.String(one)}},
		})
	}
	return &waHistorySync.Conversation{ID: proto.String(id.String()), Messages: messages}
}

func parsedAsText(chat types.JID, web *waWeb.WebMessageInfo) (*events.Message, error) {
	evt := incoming(chat, chat, text("from the phone"))
	evt.Info.ID = web.GetKey().GetID()
	return evt, nil
}

func TestOnDemandAnswerGoesToTheRequestAndTheRestToHistory(t *testing.T) {
	stored[annPN.User] = annLID
	defer delete(stored, annPN.User)
	// The phone may name the chat by phone number; the request waits on the LID the store keeps.
	h := testConverter().history(onDemand(conversation(annPN, "3EB0O1", "3EB0O2"), conversation(group, "3EB0G1")), parsedAsText)

	var w olderWaiter
	ask := w.wait(annLID.String())
	rest := w.deliver(h)

	batch := <-ask.answer
	if len(batch.Messages) != 2 || batch.Messages[0].Chat != annLID.String() || !batch.More {
		t.Errorf("answer: got %+v", batch)
	}
	if len(rest.Chats) != 1 || rest.Chats[0].JID != group.String() || len(rest.Messages) != 1 || len(rest.Contacts) != 1 {
		t.Errorf("rest: got %+v", rest)
	}
	if again := w.deliver(h); len(again.Messages) != 3 {
		t.Errorf("a second batch with nobody waiting must pass whole, got %+v", again)
	}
}

func TestOnDemandForAnotherChatLeavesTheRequestWaiting(t *testing.T) {
	h := testConverter().history(onDemand(conversation(group, "3EB0G1")), parsedAsText)
	var w olderWaiter
	ask := w.wait(annLID.String())
	if rest := w.deliver(h); len(rest.Messages) != 1 {
		t.Errorf("got %+v", rest)
	}
	select {
	case batch := <-ask.answer:
		t.Fatalf("answered with another chat's batch: %+v", batch)
	default:
	}
}

func TestAnEmptyOnDemandAnswerIsTheChatsStart(t *testing.T) {
	var w olderWaiter
	ask := w.wait(annLID.String())
	w.deliver(testConverter().history(onDemand(), parsedAsText))
	if batch := <-ask.answer; batch.More || len(batch.Messages) != 0 {
		t.Errorf("got %+v", batch)
	}
}
