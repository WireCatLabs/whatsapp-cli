package main

import (
	"context"
	"path/filepath"
	"testing"

	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func labelEdit(id, title string, kind waSyncAction.LabelEditAction_ListType, full bool) *events.LabelEdit {
	return &events.LabelEdit{LabelID: id, FromFullSync: full, Action: &waSyncAction.LabelEditAction{
		Name: proto.String(title), Type: kind.Enum(),
	}}
}

func TestListsPersistAcrossEngineStartsAndShareLabelStateWithBusinessLabels(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t, filepath.Join(t.TempDir(), "device.db"))
	labels, err := openLabels(ctx, db, false)
	if err != nil {
		t.Fatal(err)
	}
	if ready, err := labels.ready(ctx); err != nil || ready {
		t.Fatalf("fresh labels claimed synced: %v %v", ready, err)
	}
	for _, event := range []any{
		&events.LabelAssociationChat{LabelID: "custom", JID: annPN, Action: &waSyncAction.LabelAssociationAction{Labeled: proto.Bool(true)}, FromFullSync: true},
		labelEdit("custom", "People", waSyncAction.LabelEditAction_CUSTOM, true),
		labelEdit("business", "Customer", waSyncAction.LabelEditAction_NONE, true),
	} {
		if err := labels.update(ctx, event); err != nil {
			t.Fatal(err)
		}
	}
	if ready, _ := labels.ready(ctx); ready {
		t.Fatal("partial snapshot became readable")
	}
	if err := labels.complete(ctx); err != nil {
		t.Fatal(err)
	}
	labels, err = openLabels(ctx, db, false)
	if err != nil {
		t.Fatal(err)
	}
	lists, err := labels.lists(ctx)
	if err != nil || len(lists) != 1 || lists[0].ID != "custom" || len(lists[0].Chats) != 1 || lists[0].Chats[0] != annPN.String() {
		t.Fatalf("lists: %+v %v", lists, err)
	}
	if err := labels.update(ctx, &events.LabelEdit{LabelID: "custom", Action: &waSyncAction.LabelEditAction{Name: proto.String("Renamed")}}); err != nil {
		t.Fatal(err)
	}
	lists, _ = labels.lists(ctx)
	if len(lists) != 1 || lists[0].Name != "Renamed" {
		t.Fatalf("rename lost list type: %+v", lists)
	}
	if err := labels.update(ctx, &events.LabelAssociationChat{LabelID: "custom", JID: annPN, Action: &waSyncAction.LabelAssociationAction{Labeled: proto.Bool(false)}}); err != nil {
		t.Fatal(err)
	}
	lists, _ = labels.lists(ctx)
	if len(lists[0].Chats) != 0 {
		t.Fatal("unlabelled chat remained")
	}
	if err := labels.update(ctx, &events.LabelEdit{LabelID: "custom", Action: &waSyncAction.LabelEditAction{Deleted: proto.Bool(true)}}); err != nil {
		t.Fatal(err)
	}
	lists, _ = labels.lists(ctx)
	if len(lists) != 0 {
		t.Fatal("deleted list remained")
	}
	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM wa_labels WHERE id='business'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("business label lost: %d %v", count, err)
	}
	if _, err := openLabels(ctx, db, true); err != nil {
		t.Fatal(err)
	}
	if ready, _ := labels.ready(ctx); ready {
		t.Fatal("new device inherited the old account's snapshot")
	}
}

func TestEmptyFullSnapshotClearsListsAndAFailedSnapshotDoesNotClaimSuccess(t *testing.T) {
	ctx := context.Background()
	labels, err := openLabels(ctx, openTestDB(t, filepath.Join(t.TempDir(), "device.db")), false)
	if err != nil {
		t.Fatal(err)
	}
	if err := labels.update(ctx, labelEdit("custom", "Old", waSyncAction.LabelEditAction_CUSTOM, false)); err != nil {
		t.Fatal(err)
	}
	labels.failed()
	if ready, _ := labels.ready(ctx); ready {
		t.Fatal("failed snapshot became readable")
	}
	if err := labels.complete(ctx); err != nil {
		t.Fatal(err)
	}
	if ready, err := labels.ready(ctx); err != nil || !ready {
		t.Fatalf("empty synced list unavailable: %v %v", ready, err)
	}
	lists, err := labels.lists(ctx)
	if err != nil || len(lists) != 0 {
		t.Fatalf("old lists survived empty snapshot: %+v %v", lists, err)
	}
}
