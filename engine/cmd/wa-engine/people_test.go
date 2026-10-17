package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waVnameCert"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

func TestProfileWireShape(t *testing.T) {
	c := testConverter()
	known := c.profile(annLID, types.UserInfo{Status: "synthetic about"}, types.ContactInfo{Found: true, FullName: "Ann Lee"})
	assertJSON(t, known, `{"jid":"100000000000002@lid","name":"Ann Lee","about":"synthetic about","business":false,`+
		`"verified":false,"contact":true,"photo":null}`)

	business := types.UserInfo{VerifiedName: &types.VerifiedName{
		VerifiedLevel: "high",
		Details:       &waVnameCert.VerifiedNameCertificate_Details{VerifiedName: proto.String("Synthetic Shop")},
	}}
	got := c.profile(bobLID, business, types.ContactInfo{PushName: "+7 123 456 78 92"})
	if got.Name == nil || *got.Name != "Synthetic Shop" || !got.Business || !got.Verified || got.Contact {
		t.Fatalf("got %+v", got)
	}
}

func TestTakeLookupAllowsOneEveryGapAcrossProcesses(t *testing.T) {
	stamp := filepath.Join(t.TempDir(), "private.db.lookup")
	now := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	if err := takeLookup(stamp, now); err != nil {
		t.Fatal(err)
	}
	if f, ok := takeLookup(stamp, now.Add(lookupGap/2)).(*failure); !ok || f.Code != "rate_limited" {
		t.Fatal("a second lookup within the gap must be refused")
	}
	if err := takeLookup(stamp, now.Add(lookupGap)); err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(stamp); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("the stamp must be private: %v %v", info, err)
	}
}
