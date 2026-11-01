package main

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"go.mau.fi/util/jsontime"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types/events"
)

func refusedSend(code int) error { return fmt.Errorf("%w %d", whatsmeow.ErrServerReturnedError, code) }

func TestSendCodesGetTheirOwnReasons(t *testing.T) {
	for code, reason := range map[int]string{463: "account.reachout-restricted", 421: "message.rejected", 479: "message.rejected"} {
		if got := classify(refusedSend(code)).Reason; got != reason {
			t.Errorf("code %d: reason %q, want %q", code, got, reason)
		}
	}
	if got := classify(refusedSend(500)); got.Reason != "" || got.Code != "provider_error" {
		t.Errorf("an unknown send code: %+v", got)
	}
}

func TestARestrictionOnNewContactsIsDatedFromTheNoticeOfAnEarlierRun(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "private.db")
	ends := time.Now().Add(48 * time.Hour).Truncate(time.Second)
	earlier, err := openReachout(ctx, openTestDB(t, path), false)
	if err != nil {
		t.Fatal(err)
	}
	earlier.noticed(ctx, &events.NotifyAccountReachoutTimelock{IsActive: true,
		TimeEnforcementEnds: jsontime.UnixString{Time: ends}})

	e, _ := followingEngine(&fakeFollows{})
	if e.reachout, err = openReachout(ctx, openTestDB(t, path), false); err != nil {
		t.Fatal(err)
	}
	refused := e.refusalFor("send", refusedSend(463))
	if refused.Reason != "account.reachout-restricted" || refused.Until != iso(ends) {
		t.Fatalf("refusal %+v, want dated %s", refused, iso(ends))
	}

	e.reachout.noticed(ctx, &events.NotifyAccountReachoutTimelock{IsActive: false})
	if refused := e.refusalFor("send", refusedSend(463)); refused.Until != "" {
		t.Fatalf("a lifted restriction still dated: %+v", refused)
	}
}
