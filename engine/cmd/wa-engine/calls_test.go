package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	waBinary "go.mau.fi/whatsmeow/binary"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
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
	messages, _ := callRun(t, evts...)
	return messages
}

type logLines []string

func (l *logLines) Warnf(msg string, args ...any)  { *l = append(*l, fmt.Sprintf(msg, args...)) }
func (l *logLines) Errorf(msg string, args ...any) { l.Warnf(msg, args...) }
func (l *logLines) Infof(string, ...any)           {}
func (l *logLines) Debugf(string, ...any)          {}
func (l *logLines) Sub(string) waLog.Logger        { return l }

func callRun(t *testing.T, evts ...any) ([]waMessage, logLines) {
	t.Helper()
	var out bytes.Buffer
	var logged logLines
	e := &engine{out: newWire(&out), conv: testConverter(), client: &whatsmeow.Client{Store: &store.Device{}, Log: &logged}}
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
	return messages, logged
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

func ended(t *testing.T, got []waMessage, want int) waMessage {
	t.Helper()
	if len(got) != want {
		t.Fatalf("got %d messages, want %d: %+v", len(got), want, got)
	}
	last := got[len(got)-1]
	if last.ID != "call-C0FFEE01" {
		t.Fatalf("the end must name the ringing message: %+v", last)
	}
	return last
}

func TestACallAnsweredOnThePhoneIsAnsweredWithNoLength(t *testing.T) {
	meta := callMeta(annLID)
	got, logged := callRun(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallTerminate{BasicCallMeta: at(meta, 4*time.Second), Reason: "accepted_elsewhere"},
	)
	call := ended(t, got, 2)
	if call.Text != "Voice call" || call.Call.Outcome != "answered" || call.Call.Duration != nil {
		t.Errorf("got %q %+v", call.Text, call.Call)
	}
	want := `call.end: reason "accepted_elsewhere", known true, answer seen here false, outcome "answered"`
	if len(logged) != 1 || logged[0] != want {
		t.Errorf("log %q", logged)
	}
}

func TestACallDeclinedOnThePhoneIsDeclined(t *testing.T) {
	meta := callMeta(annLID)
	call := ended(t, callLines(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallTerminate{BasicCallMeta: at(meta, 3*time.Second), Reason: "rejected_elsewhere"},
	), 2)
	if call.Text != "Declined voice call" || call.Call.Outcome != "declined" {
		t.Errorf("got %q %+v", call.Text, call.Call)
	}
}

func TestACallTheCallerHungUpIsMissedAsThePhoneShowsIt(t *testing.T) {
	meta := callMeta(annLID)
	call := ended(t, callLines(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallTerminate{BasicCallMeta: at(meta, 3*time.Second)},
	), 2)
	if call.Text != "Missed voice call" || call.Call.Outcome != "missed" {
		t.Errorf("got %q %+v", call.Text, call.Call)
	}
}

func TestACallEndedForAnUnknownReasonIsKeptWithNoOutcomeAndItsReasonLogged(t *testing.T) {
	meta := callMeta(annLID)
	got, logged := callRun(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallTerminate{BasicCallMeta: at(meta, 3*time.Second), Reason: "network_lost"},
	)
	call := ended(t, got, 2)
	if call.Text != "Voice call" || call.Call.Outcome != "" || call.Call.Duration != nil {
		t.Errorf("got %q %+v", call.Text, call.Call)
	}
	if len(logged) != 1 || !strings.Contains(logged[0], `reason "network_lost", known false`) {
		t.Fatalf("log %q", logged)
	}
	if strings.Contains(logged[0], "C0FFEE01") || strings.Contains(logged[0], annLID.User) {
		t.Errorf("the log must carry no call id or number: %q", logged[0])
	}
}

func TestAReasonThatIsNotAProtocolWordNeverReachesTheLog(t *testing.T) {
	meta := callMeta(annLID)
	_, logged := callRun(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallTerminate{BasicCallMeta: at(meta, time.Second), Reason: "34600000000"},
	)
	if len(logged) != 1 || strings.Contains(logged[0], "34600000000") {
		t.Errorf("log %q", logged)
	}
}

func TestADeviceTooBusyToRingDoesNotDeclineTheCall(t *testing.T) {
	meta := callMeta(annLID)
	busy := &waBinary.Node{Tag: "reject", Attrs: waBinary.Attrs{"reason": "busy"}}
	call := ended(t, callLines(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallReject{BasicCallMeta: at(meta, time.Second), Data: busy},
		&events.CallTerminate{BasicCallMeta: at(meta, 5*time.Second), Reason: "accepted_elsewhere"},
	), 2)
	if call.Call.Outcome != "answered" {
		t.Errorf("got %+v", call.Call)
	}
}

func TestAnAnswerReplayedOnReconnectHasNoMadeUpLength(t *testing.T) {
	meta := callMeta(annLID)
	call := ended(t, callLines(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.CallAccept{BasicCallMeta: at(meta, 5*time.Second)},
		&events.CallTerminate{BasicCallMeta: at(meta, 5*time.Second), Reason: "accepted_elsewhere"},
		&events.OfflineSyncCompleted{},
	), 3)
	if call.Call.Outcome != "answered" || call.Call.Duration != nil {
		t.Errorf("got %+v", call.Call)
	}
}

func TestACallReplayedOnReconnectWithNoEndIsMissedUntilItsEndSaysOtherwise(t *testing.T) {
	meta := callMeta(annLID)
	got := callLines(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.OfflineSyncCompleted{},
		&events.OfflineSyncCompleted{},
	)
	if call := ended(t, got, 2); call.Text != "Missed voice call" || call.Call.Outcome != "missed" {
		t.Errorf("got %q %+v", call.Text, call.Call)
	}
	got = callLines(t,
		&events.CallOffer{BasicCallMeta: meta},
		&events.OfflineSyncCompleted{},
		&events.CallTerminate{BasicCallMeta: at(meta, 3*time.Second), Reason: "rejected_elsewhere"},
	)
	if call := ended(t, got, 3); call.Call.Outcome != "declined" {
		t.Errorf("got %+v", call.Call)
	}
}

func TestAnEndThatComesBeforeItsOfferStillSettlesTheCall(t *testing.T) {
	meta := callMeta(annLID)
	call := ended(t, callLines(t,
		&events.CallTerminate{BasicCallMeta: at(meta, 3*time.Second), Reason: "rejected_elsewhere"},
		&events.CallOffer{BasicCallMeta: meta},
		&events.OfflineSyncCompleted{},
	), 1)
	if call.Text != "Declined voice call" || call.Call.Outcome != "declined" {
		t.Errorf("got %q %+v", call.Text, call.Call)
	}
}

func TestAGroupCallReplayedOnReconnectStaysAsItRang(t *testing.T) {
	meta := callMeta(annLID)
	meta.GroupJID = group
	got := callLines(t,
		&events.CallTerminate{BasicCallMeta: meta, Reason: "group_call_ended"},
		&events.CallOfferNotice{BasicCallMeta: meta, Media: "audio", Type: "group"},
		&events.OfflineSyncCompleted{},
	)
	if len(got) != 1 || got[0].Text != "Incoming group voice call" || got[0].Call.Outcome != "" {
		t.Errorf("got %+v", got)
	}
}
