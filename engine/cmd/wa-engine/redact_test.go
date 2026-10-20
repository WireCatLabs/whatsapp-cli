package main

import (
	"bytes"
	"errors"
	"fmt"
	neturl "net/url"
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

func TestTheEngineLogDropsMediaURLsAndTheirTokens(t *testing.T) {
	const marker = "SECRETMARKER"
	var file bytes.Buffer
	logger := waLog.Zerolog(zerolog.New(redacting{&file}).Level(zerolog.WarnLevel))
	direct := "/v/t62.7118-24/" + marker + "_n.enc?ccb=11-4&oh=01_" + marker + "&oe=6A1B2C3D&_nc_sid=5e03e0"
	legacy := "/o1/v/t24/f2/m233/" + marker + "?ccb=9-4&oh=01_" + marker + "&oe=6A1B2C3D"
	url := "https://mmg.whatsapp.net" + direct + "&hash=" + marker + "&mms-type=image&__wa-mms="
	logger.Warnf("Failed to download media: %s, trying with next host...",
		fmt.Errorf("failed to download: %w", &neturl.Error{Op: "Get", URL: url, Err: errors.New("connection reset")}))
	logger.Warnf("Failed to download media due to network error: %v, retrying in %s...",
		&neturl.Error{Op: "Get", URL: "HTTPS://mmg.whatsapp.net" + legacy, Err: errors.New("i/o timeout")}, "1s")
	logger.Warnf("Failed to delete history sync media from server: %v", &neturl.Error{
		Op: "Delete", URL: "https://mmg.whatsapp.net/mms/md-msg-hist/" + marker + "?auth=" + marker + "&d_md=" + marker,
		Err: errors.New("EOF"),
	})
	logger.Warnf("bare path %s and legacy %s", direct, legacy)
	logger.Warnf("Unexpected child in media_conn element: %s", `<media_conn auth="`+marker+`" ttl="300"/>`)

	got := file.String()
	if strings.Contains(got, marker) {
		t.Errorf("the log kept a media token:\n%s", got)
	}
	for _, kept := range []string{"[url]", "[path]", "connection reset", "i/o timeout", "retrying in 1s"} {
		if !strings.Contains(got, kept) {
			t.Errorf("the log lost %q:\n%s", kept, got)
		}
	}
}
