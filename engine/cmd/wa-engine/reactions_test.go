package main

import (
	"bytes"
	"encoding/json"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

func reactionTo(target, emoji string) *waE2E.Message {
	return &waE2E.Message{ReactionMessage: &waE2E.ReactionMessage{
		Key:               &waCommon.MessageKey{ID: proto.String(target)},
		Text:              proto.String(emoji),
		SenderTimestampMS: proto.Int64(sentAt.Add(time.Minute).UnixMilli()),
	}}
}

func TestALiveReactionNamesItsReactorByLID(t *testing.T) {
	evt := incoming(group, annPN, reactionTo("3EB0TARGET", "👍"))
	evt.Info.SenderAlt = annLID
	got, ok := testConverter().reaction(evt)
	if !ok || got.Chat != group.String() || got.Message != "3EB0TARGET" || got.Reactor != annLID.String() || got.Own {
		t.Fatalf("got %+v", got)
	}
	if got.Reaction == nil || *got.Reaction != "👍" || got.ReactedAt != "2026-09-01T10:01:00.000Z" {
		t.Fatalf("got %+v, want the emoji at the reactor's send time", got)
	}
	if got.ReactorName == nil || *got.ReactorName != "Ann Lee" {
		t.Fatalf("got %+v", got.ReactorName)
	}
}

func TestAChangedReactionIsTheSamePersonWithTheNewEmoji(t *testing.T) {
	first := incoming(annPN, annPN, reactionTo("3EB0TARGET", "👍"))
	first.Info.SenderAlt = annLID
	device := types.JID{User: annLID.User, Server: types.HiddenUserServer, Device: 2}
	changed := incoming(annLID, device, reactionTo("3EB0TARGET", "❤️"))
	a, _ := testConverter().reaction(first)
	b, ok := testConverter().reaction(changed)
	if !ok || a.Reactor != b.Reactor || a.Chat != b.Chat || b.Chat != annLID.String() || *b.Reaction != "❤️" {
		t.Fatalf("one person must come out under one id: %+v then %+v", a, b)
	}
}

func TestATakenBackReactionHasNoEmoji(t *testing.T) {
	got, ok := testConverter().reaction(incoming(group, annLID, reactionTo("3EB0TARGET", "")))
	if !ok || got.Reaction != nil {
		t.Fatalf("got %+v, want a take-back", got)
	}
	line, _ := json.Marshal(got)
	if !bytes.Contains(line, []byte(`"reaction":null`)) {
		t.Fatalf("a take-back goes on the wire as null, got %s", line)
	}
}

func TestTheAccountsOwnReactionFromThePhoneIsUnderTheAccountsID(t *testing.T) {
	evt := incoming(group, types.JID{User: selfPN.User, Server: types.DefaultUserServer, Device: 7}, reactionTo("3EB0TARGET", "🔥"))
	evt.Info.IsFromMe = true
	got, ok := testConverter().reaction(evt)
	if !ok || got.Reactor != selfLID.String() || !got.Own || got.ReactorName != nil {
		t.Fatalf("got %+v, want the account's LID, marked own", got)
	}
}

func TestAReactionWithoutItsTargetIsPassedOver(t *testing.T) {
	if got, ok := testConverter().reaction(incoming(group, annLID, reactionTo("", "👍"))); ok {
		t.Fatalf("got %+v", got)
	}
}

func TestALiveReactionGoesOnTheWireAsAReactionAndNotAsAMessage(t *testing.T) {
	var out bytes.Buffer
	e := &engine{out: newWire(&out), conv: testConverter()}
	e.handle(incoming(group, annLID, reactionTo("3EB0TARGET", "👍")))
	var line struct {
		Event    string      `json:"event"`
		Reaction *waReaction `json:"reaction"`
	}
	if err := json.Unmarshal(out.Bytes(), &line); err != nil || line.Event != "reaction" || line.Reaction == nil ||
		line.Reaction.Message != "3EB0TARGET" {
		t.Fatalf("got %s", out.String())
	}
}

func TestHistoryReactionsComeWithTheMessageTheyAreOn(t *testing.T) {
	data := &waHistorySync.HistorySync{
		SyncType: waHistorySync.HistorySync_RECENT.Enum(),
		PhoneNumberToLidMappings: []*waHistorySync.PhoneNumberToLIDMapping{
			{PnJID: proto.String(annPN.String()), LidJID: proto.String(annLID.String())},
		},
		Conversations: []*waHistorySync.Conversation{
			{
				ID: proto.String(group.String()),
				Messages: []*waHistorySync.HistorySyncMsg{{Message: &waWeb.WebMessageInfo{
					Key: &waCommon.MessageKey{ID: proto.String("3EB0G1")},
					Reactions: []*waWeb.Reaction{
						{
							Key:               &waCommon.MessageKey{Participant: proto.String(annPN.String())},
							Text:              proto.String("👍"),
							SenderTimestampMS: proto.Int64(sentAt.Add(time.Minute).UnixMilli()),
						},
						{Key: &waCommon.MessageKey{FromMe: proto.Bool(true)}, Text: proto.String("🔥")},
						{Key: &waCommon.MessageKey{RemoteJID: proto.String(group.String())}, Text: proto.String("?")},
					},
				}}},
			},
			{
				ID: proto.String(annPN.String()),
				Messages: []*waHistorySync.HistorySyncMsg{{Message: &waWeb.WebMessageInfo{
					Key: &waCommon.MessageKey{ID: proto.String("3EB0D1")},
					Reactions: []*waWeb.Reaction{
						{Key: &waCommon.MessageKey{RemoteJID: proto.String(annPN.String())}, Text: proto.String("")},
					},
				}}},
			},
		},
	}
	reactions := testConverter().history(data, parsedAsText).Reactions
	if len(reactions) != 3 {
		t.Fatalf("got %+v, want two in the group (one without a reactor passed over) and one in the chat", reactions)
	}
	ann, mine, inChat := reactions[0], reactions[1], reactions[2]
	if ann.Reactor != annLID.String() || ann.Own || ann.Chat != group.String() || ann.Message != "3EB0G1" ||
		*ann.Reaction != "👍" || ann.ReactedAt != "2026-09-01T10:01:00.000Z" {
		t.Errorf("their reaction: got %+v", ann)
	}
	if mine.Reactor != selfLID.String() || !mine.Own || mine.ReactedAt != "2026-09-01T10:00:00.000Z" {
		t.Errorf("own reaction: got %+v, want the account's id and the message's time", mine)
	}
	if inChat.Reactor != annLID.String() || inChat.Chat != annLID.String() || inChat.Reaction != nil {
		t.Errorf("one-to-one take-back: got %+v, want the other person by LID and no emoji", inChat)
	}
}

func TestReactionsInTheAnsweredChatStayInTheHistoryEvent(t *testing.T) {
	h := testConverter().history(onDemand(conversation(annLID, "3EB0O1")), parsedAsText)
	h.Contacts = nil
	h.Reactions = []waReaction{{Chat: annLID.String(), Message: "3EB0O1", Reactor: annLID.String()}}
	var w olderWaiter
	ask := w.wait("3EB0REQ1", annLID.String())
	rest, _, _ := w.deliver(h, "")
	<-ask.answer
	if len(rest.Messages) != 0 || len(rest.Reactions) != 1 || rest.empty() {
		t.Errorf("got %+v, want the reaction kept for the history event", rest)
	}
}
