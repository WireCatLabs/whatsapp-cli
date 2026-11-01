package main

import (
	"os"
	"time"
)

// phoneSeenStamp's modification time is when the account's phone was last seen online: WhatsApp drops a linked
// device whose phone stays away about two weeks, and `doctor` warns before that. An empty file beside private.db, as
// lookupStamp, so the CLI reads it without opening the keys.
var phoneSeenStamp string

// phoneSeen records a sign of the phone: its own read receipt or a media retry answer, as mautrix-whatsapp counts
// them (pkg/connector/phoneping.go). Once an hour at most.
func phoneSeen(stamp string, at time.Time) {
	if stamp == "" || at.IsZero() {
		return
	}
	if info, err := os.Stat(stamp); err == nil && !at.After(info.ModTime().Add(time.Hour)) {
		return
	}
	if os.WriteFile(stamp, nil, 0o600) == nil {
		_ = os.Chtimes(stamp, at, at)
	}
}
