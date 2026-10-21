package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	waBinary "go.mau.fi/whatsmeow/binary"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func callMeta(creator types.JID) types.BasicCallMeta {
	return types.BasicCallMeta{From: creator, Timestamp: sentAt, CallCreator: creator, CallID: "C0FFEE01"}
}

func at(meta types.BasicCallMeta, later time.Duration) types.BasicCallMeta {
	meta.Timestamp = sentAt.Add(later)
	return meta
}

func callLines(t *testing.T, evts ...any) []waMessage {
	t.Helper()
	var out bytes.Buffer
	e := &engine{out: newWire(&out), conv: testConverter()}
	for _, evt := range evts {
		e.handle(evt)
	}
	var messages []waMessage
	for _, line := range strings.Split(strings.TrimSpace(out.String()), "\n") {
		if line == "" {
			continue
		}
		var got struct {
			Event   string    `json:"event"`
			Message waMessage `json:"message"`
		}
		if err := json.Unmarshal([]byte(line), &got); err != nil || got.Event != "message" {
			t.Fatalf("line %s is not a message event (%v)", line, err)
		}
		messages = append(messages, got.Message)
	}
	return messages
}

func TestACallNobodyAnswersIsStoredAsMissedUnderOneId(t *testing.T) {
	stored[annPN.User] = annLID
	defer delete(stored, annPN.User)
	meta := callMeta(annPN)
	got := callLines(t,
		&events.CallOffer{BasicCallMeta: meta, Data: &waBinary.Node{Tag: "offer"}},
		&events.CallTerminate{BasicCallMeta: at(meta, 30*time.Second), Reason: "timeout"},
	)
	if len(got) != 2 {
		t.Fatalf("got %d messages, want the ringing call and its end", len(got))
	}
	ringing, missed := got[0], got[1]
	if ringing.Text != "Incoming voice call" || missed.Text != "Missed voice call" {
		t.Errorf("texts %q then %q", ringing.Text, missed.Text)
	}
	if ringing.ID != "call-C0FFEE01" || missed.ID != ringing.ID || missed.Timestamp != iso(sentAt) {
		t.Errorf("the end must name the ringing message at its time: %+v", missed)
	}
	if missed.Chat != annLID.String() || *missed.Sender != annLID.String() || *missed.SenderName != "Ann Lee" || missed.FromMe {
		t.Errorf("a phone-form caller must come out by their LID: %+v", missed)
	}
	if missed.Call.Outcome != "missed" || missed.Call.Video || missed.Call.Duration != nil {
		t.Errorf("call %+v", missed.Call)
	}
}

func TestAnAnsweredVideoCallCarriesItsLength(t *testing.T) {
	meta := callMeta(annLID)
	video := &waBinary.Node{Tag: "offer", Content: []waBinary.Node{{Tag: "video"}}}
	got := callLines(t,
		&events.CallOffer{BasicCallMeta: meta, Data: video},
		&events.CallAccept{BasicCallMeta: at(meta, 5*time.Second)},
		&events.CallTerminate{BasicCallMeta: at(meta, 65*time.Second)},
	)
	if len(got) != 3 {
		t.Fatalf("got %d messages", len(got))
	}
	ended := got[2]
	if ended.Text != "Video call" || ended.Call.Outcome != "answered" || !ended.Call.Video || *ended.Call.Duration != 60 {
		t.Errorf("ended %q %+v", ended.Text, ended.Call)
	}
	if got[1].Call.Outcome != "answered" || got[1].Call.Duration != nil {
		t.Errorf("an answered call still going has no length: %+v", got[1].Call)
	}
}

func TestADeclinedCallSaysSo(t *testing.T) {
	meta := callMeta(annLID)
	got := callLines(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallReject{BasicCallMeta: at(meta, time.Second)},
		&events.CallTerminate{BasicCallMeta: at(meta, 2*time.Second)},
	)
	if len(got) != 2 || got[1].Text != "Declined voice call" || got[1].Call.Outcome != "declined" {
		t.Errorf("got %+v", got)
	}
}

func TestAGroupCallIsRecordedInTheGroupOnlyAsItRings(t *testing.T) {
	meta := callMeta(annLID)
	meta.GroupJID = group
	got := callLines(t,
		&events.CallOfferNotice{BasicCallMeta: meta, Media: "video", Type: "group"},
		&events.CallAccept{BasicCallMeta: at(meta, time.Second)},
		&events.CallTerminate{BasicCallMeta: at(meta, time.Minute)},
	)
	if len(got) != 1 {
		t.Fatalf("got %d messages, want only the ringing", len(got))
	}
	if got[0].Chat != group.String() || got[0].Text != "Incoming group video call" || !got[0].Call.Group {
		t.Errorf("got %+v %+v", got[0], got[0].Call)
	}
}

func TestTheOwnersOwnGroupCallIsTheirs(t *testing.T) {
	meta := callMeta(selfPN)
	meta.GroupJID = group
	got := callLines(t, &events.CallOfferNotice{BasicCallMeta: meta, Media: "audio", Type: "group"})
	if len(got) != 1 || !got[0].FromMe || *got[0].Sender != selfLID.String() || got[0].Text != "Group voice call" {
		t.Errorf("got %+v", got)
	}
}

func TestACallWithNoChatToPutItInIsSkipped(t *testing.T) {
	got := callLines(t,
		&events.CallOffer{BasicCallMeta: callMeta(selfLID)},
		&events.CallOffer{BasicCallMeta: types.BasicCallMeta{CallCreator: annLID}},
		&events.CallTerminate{BasicCallMeta: callMeta(annLID)},
		&events.CallAccept{BasicCallMeta: callMeta(bobPN)},
	)
	if len(got) != 0 {
		t.Errorf("got %+v", got)
	}
}
