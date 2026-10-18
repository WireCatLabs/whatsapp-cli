package main

import (
	"errors"
	"fmt"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waMmsRetry"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"go.mau.fi/whatsmeow/util/gcmutil"
	"go.mau.fi/whatsmeow/util/hkdfutil"
	"google.golang.org/protobuf/proto"
)

// phoneAnswer encrypts a notification the way the phone does, so the test reads it back with whatsmeow's own code.
func phoneAnswer(t *testing.T, id string, notice *waMmsRetry.MediaRetryNotification) *events.MediaRetry {
	t.Helper()
	plain, err := proto.Marshal(notice)
	if err != nil {
		t.Fatal(err)
	}
	iv := make([]byte, 12)
	key := hkdfutil.SHA256(syntheticKey, nil, []byte("WhatsApp Media Retry Notification"), 32)
	sealed, err := gcmutil.Encrypt(key, iv, plain, []byte(id))
	if err != nil {
		t.Fatal(err)
	}
	return &events.MediaRetry{MessageID: types.MessageID(id), Ciphertext: sealed, IV: iv}
}

func TestThePhonesAnswerGivesTheNewPathOrSaysWhy(t *testing.T) {
	success := waMmsRetry.MediaRetryNotification_SUCCESS.Enum()
	cases := []struct {
		name       string
		evt        *events.MediaRetry
		wantPath   string
		wantCode   string
		wantReason string
	}{
		{"a new upload", phoneAnswer(t, "3EB0A1", &waMmsRetry.MediaRetryNotification{
			DirectPath: proto.String("/v/t62/again"), Result: success}), "/v/t62/again", "", ""},
		{"an error that still carries a path", phoneAnswer(t, "3EB0A1", &waMmsRetry.MediaRetryNotification{
			DirectPath: proto.String("/v/t62/again"), Result: waMmsRetry.MediaRetryNotification_GENERAL_ERROR.Enum()}),
			"/v/t62/again", "", ""},
		{"the phone lost it", phoneAnswer(t, "3EB0A1", &waMmsRetry.MediaRetryNotification{
			Result: waMmsRetry.MediaRetryNotification_NOT_FOUND.Enum()}), "", "not_found", "media.not-on-phone"},
		{"the phone could not read the request", phoneAnswer(t, "3EB0A1", &waMmsRetry.MediaRetryNotification{
			Result: waMmsRetry.MediaRetryNotification_DECRYPTION_ERROR.Enum()}),
			"", "not_found", "media.phone-cannot-decrypt"},
		{"the phone failed", phoneAnswer(t, "3EB0A1", &waMmsRetry.MediaRetryNotification{
			Result: waMmsRetry.MediaRetryNotification_GENERAL_ERROR.Enum()}), "", "provider_error", "media.phone-failed"},
		{"the server says the phone has none", &events.MediaRetry{MessageID: "3EB0A1",
			Error: &events.MediaRetryError{Code: 2}}, "", "not_found", "media.not-on-phone"},
		{"an answer sealed for another message", func() *events.MediaRetry {
			evt := phoneAnswer(t, "3EB0A1", &waMmsRetry.MediaRetryNotification{Result: success})
			evt.MessageID = "3EB0B2"
			return evt
		}(), "", "provider_error", "media.phone-answer-unreadable"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path, err := reuploadedPath(tc.evt, syntheticKey)
			if path != tc.wantPath {
				t.Errorf("path %q, want %q", path, tc.wantPath)
			}
			if err == nil {
				if tc.wantCode != "" {
					t.Errorf("no error, want %s", tc.wantReason)
				}
				return
			}
			if refused := classify(err); refused.Code != tc.wantCode || refused.Reason != tc.wantReason {
				t.Errorf("%s (%s), want %s (%s)", refused.Code, refused.Reason, tc.wantCode, tc.wantReason)
			}
		})
	}
}

// The outcomes reupload and fetchAgain answer once the phone was asked; only a live check reaches them in place.
func TestEveryRetryOutcomeAfterTheAskCarriesItsReason(t *testing.T) {
	for _, tc := range []struct {
		err          error
		code, reason string
	}{
		{phoneTimeout, "timeout", "media.phone-timeout"},
		{retryStopped, "provider_unavailable", "engine.stopped"},
		{againFailed, "provider_error", "media.retry-failed"},
	} {
		refused := classify(mediaFailure(tc.err))
		if refused.Code != tc.code || refused.Reason != tc.reason {
			t.Errorf("%s (%s), want %s (%s)", refused.Code, refused.Reason, tc.code, tc.reason)
		}
	}
}

func TestOnlyAFileWhatsAppNoLongerKeepsIsAskedForAgain(t *testing.T) {
	for _, err := range []error{whatsmeow.ErrMediaDownloadFailedWith404, whatsmeow.ErrMediaDownloadFailedWith410,
		whatsmeow.ErrMediaDownloadFailedWith403, fmt.Errorf("download: %w", whatsmeow.ErrMediaDownloadFailedWith410)} {
		if !expired(err) {
			t.Errorf("%v is not asked for again", err)
		}
	}
	for _, err := range []error{nil, whatsmeow.ErrInvalidMediaHMAC, errors.New("network")} {
		if expired(err) {
			t.Errorf("%v is asked for again", err)
		}
	}
}

func TestAnAnswerReachesEveryDownloadOfItsMessageAndNoOther(t *testing.T) {
	var w retryWaiter
	first, second, other := w.wait("3EB0A1"), w.wait("3EB0A1"), w.wait("3EB0B2")
	w.deliver(&events.MediaRetry{MessageID: "3EB0A1"})
	w.deliver(&events.MediaRetry{MessageID: "3EB0A1"}) // a repeat never blocks the event handler
	if len(first) != 1 || len(second) != 1 || len(other) != 0 {
		t.Fatalf("delivered %d, %d, %d", len(first), len(second), len(other))
	}
	w.forget("3EB0A1", first)
	w.forget("3EB0A1", second)
	w.forget("3EB0B2", other)
	if len(w.asks) != 0 {
		t.Errorf("waiters left: %v", w.asks)
	}
}

func TestTheReceiptAddressesTheMessageAsMautrixDoes(t *testing.T) {
	group := types.NewJID("120363000000000001", types.GroupServer)
	ann := types.NewJID("100000000000002", types.HiddenUserServer)
	info := retryInfo(target{chat: group, id: "3EB0A1", sender: ann}, ann)
	if info.ID != "3EB0A1" || info.Chat != group || info.Sender != ann || info.IsFromMe || !info.IsGroup {
		t.Errorf("someone else's in a group: %+v", info)
	}
	own := retryInfo(target{chat: ann, id: "3EB0A2"}, types.EmptyJID)
	if !own.IsFromMe || own.IsGroup || own.Chat != ann {
		t.Errorf("the account's own in a one-to-one chat: %+v", own)
	}
}
