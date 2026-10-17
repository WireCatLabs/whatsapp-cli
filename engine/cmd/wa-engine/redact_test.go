package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/rs/zerolog"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func TestTheEngineLogMasksPhoneNumbersAndUserIDs(t *testing.T) {
	var file bytes.Buffer
	logger := waLog.Zerolog(zerolog.New(redacting{&file}).Level(zerolog.WarnLevel))
	logger.Warnf("Failed to get peer recipient PN for %s: %v", "71234567890@s.whatsapp.net", "no row")
	logger.Warnf("retry for %s from %s", "71234567890:12@s.whatsapp.net", "71234567890.0:3@s.whatsapp.net")
	logger.Errorf("Failed to store LID-PN mapping for %s -> %s", "100000000000126@lid", "100000000000127@c.us")
	logger.Warnf("old group %s, number %s", "100000000000128-1600000000@g.us", "+71234567890")
	logger.Warnf("message 3EB0A1B2C3D4E5F60718 in 120363000000000001@g.us was retried 3 times")

	got := file.String()
	for _, number := range []string{"71234567890", "100000000000126", "100000000000127", "100000000000128"} {
		if strings.Contains(got, number) {
			t.Errorf("the log kept %s:\n%s", number, got)
		}
	}
	for _, kept := range []string{
		"…@s.whatsapp.net", "…:12@s.whatsapp.net", "….0:3@s.whatsapp.net", "…@lid", "…@c.us", "…@g.us",
		"3EB0A1B2C3D4E5F60718", "120363000000000001@g.us", "retried 3 times",
	} {
		if !strings.Contains(got, kept) {
			t.Errorf("the log lost %q:\n%s", kept, got)
		}
	}
}
