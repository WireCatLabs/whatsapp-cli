package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waMmsRetry"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"go.mau.fi/whatsmeow/util/cbcutil"
	"go.mau.fi/whatsmeow/util/gcmutil"
	"go.mau.fi/whatsmeow/util/hkdfutil"
	waLog "go.mau.fi/whatsmeow/util/log"
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
			path, _, err := reuploadedPath(tc.evt, syntheticKey)
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

func TestAPathGivenWithAnErrorKeepsThePhonesResult(t *testing.T) {
	failed := waMmsRetry.MediaRetryNotification_GENERAL_ERROR
	path, result, err := reuploadedPath(phoneAnswer(t, "3EB0A1", &waMmsRetry.MediaRetryNotification{
		DirectPath: proto.String("/v/t62/again"), Result: failed.Enum()}), syntheticKey)
	if path != "/v/t62/again" || result != failed || err != nil {
		t.Errorf("%q, %s, %v; want the path tried, its result kept", path, result, err)
	}
}

func TestAFailedDownloadFromTheNewPathSaysWhatThePhoneAnsweredAndWhy(t *testing.T) {
	for _, tc := range []struct {
		result       waMmsRetry.MediaRetryNotification_ResultType
		code, reason string
	}{
		{waMmsRetry.MediaRetryNotification_SUCCESS, "provider_error", "media.retry-failed"},
		{waMmsRetry.MediaRetryNotification_GENERAL_ERROR, "provider_error", "media.phone-failed"},
		{waMmsRetry.MediaRetryNotification_NOT_FOUND, "not_found", "media.not-on-phone"},
		{waMmsRetry.MediaRetryNotification_DECRYPTION_ERROR, "not_found", "media.phone-cannot-decrypt"},
	} {
		refused := classify(mediaFailure(refetchFailure(tc.result, false, "WhatsApp answered HTTP 404")))
		named := strings.HasSuffix(refused.Message, ": WhatsApp answered HTTP 404")
		if refused.Code != tc.code || refused.Reason != tc.reason || !named {
			t.Errorf("%s: %s (%s) %q, want %s (%s)", tc.result, refused.Code, refused.Reason, refused.Message, tc.code,
				tc.reason)
		}
	}
}

func TestADownloadFailureIsNamedByItsKindNeverByItsText(t *testing.T) {
	const marker = "/v/t62/SYNTHETIC-PATH-MARKER?oh=SYNTHETIC-TOKEN"
	leaky := &url.Error{Op: "Get", URL: "https://mmg.example.invalid" + marker, Err: errors.New("connection reset")}
	for _, tc := range []struct {
		err  error
		want string
	}{
		{whatsmeow.ErrMediaDownloadFailedWith404, "WhatsApp answered HTTP 404"},
		{whatsmeow.ErrMediaDownloadFailedWith410, "WhatsApp answered HTTP 410"},
		{fmt.Errorf("failed to download media from last host: %w",
			whatsmeow.DownloadHTTPError{Response: &http.Response{StatusCode: 500}}), "WhatsApp answered HTTP 500"},
		{fmt.Errorf("failed to download media from last host: %w", whatsmeow.ErrInvalidMediaEncSHA256),
			"the encrypted file did not match its checksum"},
		{fmt.Errorf("failed to download media from last host: %w", whatsmeow.ErrInvalidMediaHMAC),
			"the file did not match its key"},
		{whatsmeow.ErrInvalidMediaSHA256, "the decrypted file did not match its checksum"},
		{whatsmeow.ErrTooShortFile, "the file was too short"},
		{&url.Error{Op: "Get", URL: "https://mmg.example.invalid" + marker, Err: context.DeadlineExceeded},
			"the download ran out of time"},
		{leaky, "a network error"},
		{fmt.Errorf("media download path does not start with slash: %s", marker), "an unclassified error"},
	} {
		got := downloadCause(tc.err)
		if got != tc.want {
			t.Errorf("%v named %q, want %q", tc.err, got, tc.want)
		}
		if strings.Contains(got, "MARKER") || strings.Contains(got, "TOKEN") {
			t.Errorf("the cause repeats the URL: %q", got)
		}
	}
}

func TestAFailedDownloadSaysWhenThePhoneGaveTheExpiredPathBack(t *testing.T) {
	refused := refetchFailure(waMmsRetry.MediaRetryNotification_GENERAL_ERROR, true, "WhatsApp answered HTTP 404")
	if !strings.HasSuffix(refused.Message, ": WhatsApp answered HTTP 404; the phone gave the expired path back") {
		t.Errorf("message %q", refused.Message)
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

func TestADownloadAnswersTheNewPathOnlyAfterTheRetry(t *testing.T) {
	var out bytes.Buffer
	w := newWire(&out)
	w.ok(1, (*refreshed)(nil))
	w.ok(2, &refreshed{DirectPath: "/v/t62/synthetic-again"})
	want := `{"id":1,"ok":null}` + "\n" + `{"id":2,"ok":{"directPath":"/v/t62/synthetic-again"}}` + "\n"
	if out.String() != want {
		t.Errorf("answers %q, want %q", out.String(), want)
	}
}

type servedBlob []byte

func (b servedBlob) RoundTrip(*http.Request) (*http.Response, error) {
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(b)), ContentLength: -1}, nil
}

// encryptedAsWhatsAppDoes builds a file as it lies on WhatsApp's servers: AES-CBC under the key's expansion, then the
// first ten bytes of the HMAC over the IV and the ciphertext.
func encryptedAsWhatsAppDoes(t *testing.T, key, plain []byte, media whatsmeow.MediaType) []byte {
	t.Helper()
	keys := hkdfutil.SHA256(key, nil, []byte(media), 112)
	iv, cipherKey, macKey := keys[:16], keys[16:48], keys[48:80]
	sealed, err := cbcutil.Encrypt(cipherKey, iv, plain)
	if err != nil {
		t.Fatal(err)
	}
	mac := hmac.New(sha256.New, macKey)
	mac.Write(iv)
	mac.Write(sealed)
	return append(sealed, mac.Sum(nil)[:mediaMACLength]...)
}

// serve hands blob to whatsmeow's own download code through a fake transport, never the network (WC-TEST-3).
func serve(t *testing.T, blob []byte, key, enc, sum []byte) (*os.File, error) {
	t.Helper()
	client := whatsmeow.NewClient(&store.Device{}, waLog.Noop)
	client.SetMediaHTTPClient(&http.Client{Transport: servedBlob(blob)})
	file, err := os.OpenFile(filepath.Join(t.TempDir(), "file"), os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = file.Close() })
	err = client.DangerousInternals().DownloadAndDecryptToFile(context.Background(), "https://media.invalid/v/t62/again",
		key, whatsmeow.MediaImage, enc, sum, file)
	return file, err
}

func TestACopyThePhoneEncryptedAgainOpensUnderTheStoredKeyWithItsOwnChecksums(t *testing.T) {
	stored := []byte("synthetic photo as the sender sent it")
	again := []byte("synthetic photo as the phone keeps it now, re-encoded")
	storedSum, storedEnc := sha256.Sum256(stored), sha256.Sum256(encryptedAsWhatsAppDoes(t, syntheticKey, stored,
		whatsmeow.MediaImage))
	blob := encryptedAsWhatsAppDoes(t, syntheticKey, again, whatsmeow.MediaImage)

	_, err := serve(t, blob, syntheticKey, storedEnc[:], storedSum[:])
	if !errors.Is(err, whatsmeow.ErrInvalidMediaEncSHA256) || !otherChecksums(err) {
		t.Fatalf("the stored checksums: %v, want the live failure, ErrInvalidMediaEncSHA256", err)
	}
	raw, err := serve(t, blob, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	renewed, err := openReencrypted(raw, syntheticKey, whatsmeow.MediaImage)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := os.ReadFile(raw.Name())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(saved, again) {
		t.Errorf("saved %q, want %q", saved, again)
	}
	if _, err := serve(t, blob, syntheticKey, renewed.FileEncSHA256, renewed.FileSHA256); err != nil {
		t.Errorf("whatsmeow refuses the new checksums: %v", err)
	}
}

func TestACopyWhoseMACDoesNotMatchTheStoredKeyIsNeverDecrypted(t *testing.T) {
	plain := []byte("synthetic photo")
	cases := map[string][]byte{
		"another key": encryptedAsWhatsAppDoes(t, bytes.Repeat([]byte{9}, 32), plain, whatsmeow.MediaImage),
		"a changed byte": func() []byte {
			b := encryptedAsWhatsAppDoes(t, syntheticKey, plain, whatsmeow.MediaImage)
			b[0] ^= 1
			return b
		}(),
		"another kind of file": encryptedAsWhatsAppDoes(t, syntheticKey, plain, whatsmeow.MediaVideo),
	}
	for name, blob := range cases {
		t.Run(name, func(t *testing.T) {
			raw, err := serve(t, blob, nil, nil, nil)
			if err != nil {
				t.Fatal(err)
			}
			_, err = openReencrypted(raw, syntheticKey, whatsmeow.MediaImage)
			if !errors.Is(err, whatsmeow.ErrInvalidMediaHMAC) {
				t.Errorf("%v, want ErrInvalidMediaHMAC", err)
			}
			if kept, _ := os.ReadFile(raw.Name()); !bytes.Equal(kept, blob) {
				t.Error("the file was changed before its MAC matched")
			}
		})
	}
	short, err := serve(t, make([]byte, mediaMACLength), nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := openReencrypted(short, syntheticKey, whatsmeow.MediaImage); !errors.Is(err, whatsmeow.ErrTooShortFile) {
		t.Errorf("a file no longer than its MAC: %v", err)
	}
}

func TestOnlyACopyFailingTheStoredChecksumsIsOpenedUnderTheKey(t *testing.T) {
	for _, err := range []error{whatsmeow.ErrInvalidMediaEncSHA256, whatsmeow.ErrInvalidMediaSHA256,
		fmt.Errorf("failed to download media from last host: %w", whatsmeow.ErrInvalidMediaEncSHA256)} {
		if !otherChecksums(err) {
			t.Errorf("%v is not opened under the key", err)
		}
	}
	for _, err := range []error{nil, whatsmeow.ErrInvalidMediaHMAC, whatsmeow.ErrMediaDownloadFailedWith404,
		whatsmeow.ErrTooShortFile, errors.New("network")} {
		if otherChecksums(err) {
			t.Errorf("%v is opened under the key", err)
		}
	}
}
