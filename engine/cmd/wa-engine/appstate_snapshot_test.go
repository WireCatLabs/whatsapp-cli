package main

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func TestFullSyncStarsAndDeletionsAreOneHistoryBatchInsteadOfLiveEvents(t *testing.T) {
	var output bytes.Buffer
	e := &engine{ctx: context.Background(), out: newWire(&output), conv: testConverter()}
	e.handle(&events.Star{ChatJID: group, MessageID: "STAR", Action: &waSyncAction.StarAction{Starred: proto.Bool(true)}, FromFullSync: true})
	e.handle(&events.DeleteForMe{ChatJID: group, MessageID: "DELETE", Action: &waSyncAction.DeleteMessageForMeAction{}, FromFullSync: true})
	if output.Len() != 0 {
		t.Fatal("snapshot printed live changes")
	}
	e.handle(&events.AppStateSyncComplete{Name: appstate.WAPatchRegular})
	if output.Len() != 0 {
		t.Fatal("unrelated collection flushed the snapshot")
	}
	e.handle(&events.AppStateSyncComplete{Name: appstate.WAPatchRegularHigh})
	var got struct {
		Event   string    `json:"event"`
		History waHistory `json:"history"`
	}
	if err := json.Unmarshal(output.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Event != "history" || len(got.History.Stars) != 1 || len(got.History.Deletions) != 1 {
		t.Fatalf("bad snapshot: %+v", got)
	}
	output.Reset()
	e.handle(&events.Star{ChatJID: group, MessageID: "LIVE", Action: &waSyncAction.StarAction{Starred: proto.Bool(true)}})
	if !bytes.Contains(output.Bytes(), []byte(`"event":"star"`)) {
		t.Fatal("a live star stopped being live")
	}
}
