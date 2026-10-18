package main

import (
	"errors"
	"slices"
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
	ask := w.wait("3EB0REQ1", annLID.String())
	rest, _, _ := w.deliver(h, "")

	batch := <-ask.answer
	if len(batch.Messages) != 2 || batch.Messages[0].Chat != annLID.String() || !batch.More {
		t.Errorf("answer: got %+v", batch)
	}
	if len(rest.Chats) != 1 || rest.Chats[0].JID != group.String() || len(rest.Messages) != 1 || len(rest.Contacts) != 1 {
		t.Errorf("rest: got %+v", rest)
	}
	if again, _, _ := w.deliver(h, ""); len(again.Messages) != 3 {
		t.Errorf("a second batch with nobody waiting must pass whole, got %+v", again)
	}
}

func TestVotesInTheAnsweredChatStayInTheHistoryEvent(t *testing.T) {
	h := testConverter().history(onDemand(conversation(annLID, "3EB0O1")), parsedAsText)
	h.Votes = []waVote{{Chat: annLID.String(), Message: "3EB0O1", Voter: annLID.String(), Selected: []string{}}}
	var w olderWaiter
	ask := w.wait("3EB0REQ1", annLID.String())
	rest, _, _ := w.deliver(h, "")
	<-ask.answer
	if len(rest.Messages) != 0 || len(rest.Votes) != 1 || rest.empty() {
		t.Errorf("got %+v, want the vote kept for the history event", rest)
	}
}

func TestOnDemandForAnotherChatLeavesTheRequestWaiting(t *testing.T) {
	h := testConverter().history(onDemand(conversation(group, "3EB0G1")), parsedAsText)
	var w olderWaiter
	ask := w.wait("3EB0REQ1", annLID.String())
	if rest, _, _ := w.deliver(h, ""); len(rest.Messages) != 1 {
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
	ask := w.wait("3EB0REQ1", annLID.String())
	w.deliver(testConverter().history(onDemand(), parsedAsText), "")
	if batch := <-ask.answer; batch.More || len(batch.Messages) != 0 {
		t.Errorf("got %+v", batch)
	}
}

func TestABatchOfOnlySkippedMessagesIsAskedPastFromItsOldest(t *testing.T) {
	data := onDemand(conversation(annLID, "3EB0R1", "3EB0R2"))
	for n, item := range data.Conversations[0].Messages {
		item.Message.MessageTimestamp = proto.Uint64(uint64(sentAt.Unix()) - uint64(n)*60)
		item.Message.Key.FromMe = proto.Bool(n == 1)
	}
	skipped := func(types.JID, *waWeb.WebMessageInfo) (*events.Message, error) { return nil, errors.New("skipped") }
	var w olderWaiter
	ask := w.wait("3EB0REQ1", annLID.String())
	w.deliver(testConverter().history(data, skipped), "")

	batch := <-ask.answer
	if len(batch.Messages) != 0 || !batch.More {
		t.Fatalf("got %+v", batch)
	}
	next := reanchor(types.MessageInfo{ID: "3EB0A1"}, batch.oldest)
	if next.ID != "3EB0R2" || !next.IsFromMe || next.Timestamp.Unix() != sentAt.Unix()-60 {
		t.Errorf("got %+v", next)
	}
}

func TestTheSessionIDCreditsItsRequestOnlyWhenTheBatchNamesItsChat(t *testing.T) {
	var w olderWaiter
	ask := w.wait("3EB0REQ1", annLID.String())
	other := testConverter().history(onDemand(conversation(group, "3EB0G1")), parsedAsText)
	if rest, how, _ := w.deliver(other, "3EB0REQ1"); how != matchOtherChat || len(rest.Messages) != 1 {
		t.Fatalf("got %s, %+v; want the batch passed whole to the history event", how, rest)
	}
	select {
	case batch := <-ask.answer:
		t.Fatalf("another chat's batch was read as this chat's start: %+v", batch)
	default:
	}
	h := testConverter().history(onDemand(conversation(annLID, "3EB0O1")), parsedAsText)
	if _, how, _ := w.deliver(h, "3EB0REQ1"); how != matchSession || len((<-ask.answer).Messages) != 1 {
		t.Fatalf("got %s", how)
	}
	if _, how, _ := w.deliver(h, "3EB0REQ1"); how != matchLate {
		t.Errorf("a second answer to a request already answered is late, got %s", how)
	}
}

func TestALateEmptyAnswerDoesNotEndTheNextRequestOnTheSameChat(t *testing.T) {
	var w olderWaiter
	w.forget(w.wait("3EB0REQ1", annLID.String()))
	second := w.wait("3EB0REQ2", annLID.String())

	rest, how, _ := w.deliver(testConverter().history(onDemand(), parsedAsText), "3EB0REQ1")
	if how != matchLate || len(rest.Contacts) != 1 {
		t.Fatalf("got %s, %+v; want the late answer passed whole to the history event", how, rest)
	}
	select {
	case batch := <-second.answer:
		t.Fatalf("the late empty answer was read as the chat's start: %+v", batch)
	default:
	}
	h := testConverter().history(onDemand(conversation(annLID, "3EB0O1")), parsedAsText)
	if _, how, _ := w.deliver(h, "3EB0REQ2"); how != matchSession || len((<-second.answer).Messages) != 1 {
		t.Errorf("got %s", how)
	}
}

func TestAnUnknownSessionIDFallsBackToTheChat(t *testing.T) {
	h := testConverter().history(onDemand(conversation(annLID, "3EB0O1")), parsedAsText)
	var w olderWaiter
	ask := w.wait("3EB0REQ1", annLID.String())
	if _, how, credited := w.deliver(h, "3EB0SESSION"); how != matchChat || credited != 1 {
		t.Fatalf("got %s, %d", how, credited)
	}
	<-ask.answer
}

func TestOnlyTheLastRequestsAreRememberedAsLate(t *testing.T) {
	var w olderWaiter
	for n := range olderLate + 1 {
		w.forget(w.wait(string(rune('A'+n)), annLID.String()))
	}
	if len(w.late) != olderLate || w.late[0] != "B" {
		t.Errorf("got %v", w.late)
	}
}

func page(oldest string, sent int, ids ...string) *olderBatch {
	batch := &olderBatch{Messages: []waMessage{}, More: sent > 0, sent: sent, oldest: rawKey{id: oldest}}
	for _, id := range ids {
		batch.Messages = append(batch.Messages, waMessage{ID: id, Chat: annLID.String()})
	}
	return batch
}

type asked struct {
	anchor string
	count  int
}

// phone answers each ask with the next of its answers: a batch, or an error.
func phone(t *testing.T, answers ...any) (olderAsker, *[]asked) {
	gap := olderGap
	olderGap = 0
	t.Cleanup(func() { olderGap = gap })
	log := &[]asked{}
	return func(info types.MessageInfo, count int) (*olderBatch, error) {
		*log = append(*log, asked{info.ID, count})
		if len(answers) == 0 {
			t.Fatal("asked once more than the test expects")
		}
		next := answers[0]
		answers = answers[1:]
		if err, ok := next.(error); ok {
			return nil, err
		}
		return next.(*olderBatch), nil
	}, log
}

func TestAShortAnswerIsAskedOnFromItsOldestUntilTheCountArrives(t *testing.T) {
	ask, log := phone(t, page("3EB0B", 20, "3EB0A", "3EB0B"), page("3EB0D", 30, "3EB0C", "3EB0D"))
	batch, err := collectOlder(t.Context(), types.MessageInfo{ID: "3EB0ANCHOR"}, 50, ask)
	if err != nil || len(batch.Messages) != 4 || !batch.More {
		t.Fatalf("got %+v, %v", batch, err)
	}
	if want := []asked{{"3EB0ANCHOR", 50}, {"3EB0B", 30}}; !slices.Equal(*log, want) {
		t.Errorf("asked %v, want %v", *log, want)
	}
}

func TestTheChatsStartEndsTheAsksAndKeepsWhatArrived(t *testing.T) {
	ask, log := phone(t, page("3EB0B", 2, "3EB0A", "3EB0B"), page("", 0))
	batch, err := collectOlder(t.Context(), types.MessageInfo{ID: "3EB0ANCHOR"}, 50, ask)
	if err != nil || len(batch.Messages) != 2 || batch.More || len(*log) != 2 {
		t.Errorf("got %+v, %v after %d asks", batch, err, len(*log))
	}
}

func TestAFailureAfterAChunkAnswersTheChunk(t *testing.T) {
	ask, _ := phone(t, page("3EB0B", 2, "3EB0A", "3EB0B"), olderTimeout())
	batch, err := collectOlder(t.Context(), types.MessageInfo{ID: "3EB0ANCHOR"}, 50, ask)
	if err != nil || len(batch.Messages) != 2 || !batch.More {
		t.Errorf("got %+v, %v", batch, err)
	}
}

func TestAFailureBeforeAnyMessagePassesOn(t *testing.T) {
	ask, _ := phone(t, olderTimeout())
	if _, err := collectOlder(t.Context(), types.MessageInfo{ID: "3EB0ANCHOR"}, 50, ask); err == nil {
		t.Fatal("want the timeout")
	}
}

func TestTheAsksStopAtTheRoundsCap(t *testing.T) {
	ask, log := phone(t, page("3EB0A", 1, "3EB0A"), page("3EB0B", 1, "3EB0B"), page("3EB0C", 1, "3EB0C"))
	batch, err := collectOlder(t.Context(), types.MessageInfo{ID: "3EB0ANCHOR"}, 50, ask)
	if err != nil || len(batch.Messages) != olderRounds || len(*log) != olderRounds || !batch.More {
		t.Errorf("got %+v, %v after %d asks", batch, err, len(*log))
	}
}

func TestOnlySkippedMessagesAreAskedPastForTheWholeCount(t *testing.T) {
	ask, log := phone(t, page("3EB0R", 50), page("3EB0S", 50), page("3EB0T", 50))
	_, err := collectOlder(t.Context(), types.MessageInfo{ID: "3EB0ANCHOR"}, 50, ask)
	if f, ok := err.(*failure); !ok || f.Code != "provider_error" {
		t.Fatalf("got %v", err)
	}
	if want := []asked{{"3EB0ANCHOR", 50}, {"3EB0R", 50}, {"3EB0S", 50}}; !slices.Equal(*log, want) {
		t.Errorf("asked %v, want %v", *log, want)
	}
}
