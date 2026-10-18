package main

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/types"
)

type askLog struct {
	at    []time.Time
	sizes []int
	asked map[string]int
}

func fakeAsker(t *testing.T, path string, clock *time.Time, fail error) (*lidAsker, *askLog) {
	t.Helper()
	log := &askLog{asked: map[string]int{}}
	a, err := openLidAsker(context.Background(), openTestDB(t, path), false, func(jids []types.JID) error {
		log.at = append(log.at, *clock)
		log.sizes = append(log.sizes, len(jids))
		for _, jid := range jids {
			log.asked[jid.User]++
		}
		return fail
	})
	if err != nil {
		t.Fatal(err)
	}
	a.now = func() time.Time { return *clock }
	a.wait = func(d time.Duration) bool { *clock = clock.Add(d); return true }
	return a, log
}

func fakeUsers(n int) []string {
	users := make([]string, n)
	for i := range users {
		users[i] = fmt.Sprintf("700000000%02d", i)
	}
	return users
}

func TestLookupsGoInSmallBatchesAtANumberLookupsPaceAndStopAtTheRunsCap(t *testing.T) {
	clock := time.Date(2026, 10, 18, 10, 0, 0, 0, time.UTC)
	a, log := fakeAsker(t, filepath.Join(t.TempDir(), "private.db"), &clock, nil)
	a.run(context.Background(), fakeUsers(23))
	if fmt.Sprint(log.sizes) != "[5 5 5 5]" {
		t.Fatalf("batches %v, want four of five", log.sizes)
	}
	for i := 1; i < len(log.at); i++ {
		if gap := log.at[i].Sub(log.at[i-1]); gap < lidAskGap {
			t.Errorf("request %d came %v after the one before", i, gap)
		}
	}
	a.run(context.Background(), fakeUsers(23))
	if len(log.sizes) != 5 || log.sizes[4] != 3 {
		t.Errorf("the next run should ask the three left, got %v", log.sizes)
	}
	if gap := log.at[4].Sub(log.at[3]); gap < lidAskGap {
		t.Errorf("the pace broke between runs: %v", gap)
	}
}

func TestAPersonIsAskedAtMostOnceAWeekAcrossRestarts(t *testing.T) {
	clock := time.Date(2026, 10, 18, 10, 0, 0, 0, time.UTC)
	path := filepath.Join(t.TempDir(), "private.db")
	first, _ := fakeAsker(t, path, &clock, nil)
	first.run(context.Background(), fakeUsers(1))

	again, log := fakeAsker(t, path, &clock, nil)
	clock = clock.Add(lidAskAgain - time.Hour)
	again.run(context.Background(), fakeUsers(1))
	if len(log.sizes) != 0 {
		t.Fatalf("asked again within the week: %v", log.sizes)
	}
	clock = clock.Add(2 * time.Hour)
	again.run(context.Background(), fakeUsers(1))
	if log.asked[fakeUsers(1)[0]] != 1 {
		t.Errorf("not asked again after the week: %v", log.asked)
	}
}

func TestAFailedRequestEndsTheRunAndCountsAsAsked(t *testing.T) {
	clock := time.Date(2026, 10, 18, 10, 0, 0, 0, time.UTC)
	a, log := fakeAsker(t, filepath.Join(t.TempDir(), "private.db"), &clock, errors.New("rate-overlimit"))
	a.run(context.Background(), fakeUsers(12))
	if len(log.sizes) != 1 {
		t.Fatalf("went on after a refusal: %v", log.sizes)
	}
	a.run(context.Background(), fakeUsers(5))
	if len(log.sizes) != 1 {
		t.Errorf("asked again at once for the refused batch: %v", log.sizes)
	}
}

func TestOnlyTheAccountsOwnPhoneFormChatsAreCandidates(t *testing.T) {
	p := testPhoneChats(t, filepath.Join(t.TempDir(), "private.db"))
	p.note(context.Background(), fakePN)
	p.note(context.Background(), fakeLID)
	if got := p.waiting(); fmt.Sprint(got) != "[70000000009]" {
		t.Errorf("got %v", got)
	}
}
