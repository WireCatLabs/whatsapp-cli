package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/rs/zerolog"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func TestTheEngineLogMasksPhoneNumbersAndUserIDs(t *testing.T) {
	var file bytes.Buffer
	logger := waLog.Zerolog(zerolog.New(redacting{&file}).Level(zerolog.WarnLevel))
	logger.Warnf("Failed to get peer recipient PN for %s: %v", "70000000001@s.whatsapp.net", "no row")
	logger.Warnf("retry for %s from %s", "70000000001:12@s.whatsapp.net", "70000000001.0:3@s.whatsapp.net")
	logger.Errorf("Failed to store LID-PN mapping for %s -> %s", "100000000000126@lid", "100000000000127@c.us")
	logger.Warnf("old group %s, number %s", "100000000000128-1600000000@g.us", "+70000000001")
	logger.Warnf("message 3EB0A1B2C3D4E5F60718 in 120363000000000001@g.us was retried 3 times")

	got := file.String()
	for _, number := range []string{"70000000001", "100000000000126", "100000000000127", "100000000000128"} {
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

func TestTheEngineLogMasksJIDsInsideStructDumps(t *testing.T) {
	var file bytes.Buffer
	logger := waLog.Zerolog(zerolog.New(redacting{&file}).Level(zerolog.WarnLevel))
	phone := types.JID{User: "70000000001", Device: 12, Server: types.DefaultUserServer}
	lid := types.JID{User: "100000000000126", Server: types.HiddenUserServer}
	info := types.MessageInfo{MessageSource: types.MessageSource{Chat: phone, Sender: phone, SenderAlt: lid}}
	logger.Warnf("%v %+v %#v %#v", info, &info, phone, lid)

	got := file.String()
	for _, number := range []string{"70000000001", "100000000000126"} {
		if strings.Contains(got, number) {
			t.Errorf("the log kept %s:\n%s", number, got)
		}
	}
}
