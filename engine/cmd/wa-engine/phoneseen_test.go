package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestThePhoneIsMarkedSeenAtMostOnceAnHour(t *testing.T) {
	stamp := filepath.Join(t.TempDir(), "private.db.phone-seen")
	first := time.Now().Add(-3 * time.Hour).Truncate(time.Second)
	phoneSeen(stamp, first)
	phoneSeen(stamp, first.Add(30*time.Minute))
	if info, err := os.Stat(stamp); err != nil || !info.ModTime().Equal(first) {
		t.Fatalf("stamp %v, %v; want %s", info, err, first)
	}
	later := first.Add(2 * time.Hour)
	phoneSeen(stamp, later)
	if info, _ := os.Stat(stamp); !info.ModTime().Equal(later) || info.Mode().Perm() != 0o600 {
		t.Fatalf("stamp at %s mode %v, want %s 0600", info.ModTime(), info.Mode().Perm(), later)
	}
}
