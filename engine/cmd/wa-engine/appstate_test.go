package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waAdv"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func TestMuteEndReadsUntilAsWhatsmeowBuildsTheMute(t *testing.T) {
	now := time.Date(2026, 9, 25, 8, 0, 0, 0, time.UTC)
	forever, later := "forever", "2026-09-25T09:00:00.000Z"

	if muted, end, err := muteEnd(&forever, now); err != nil || !muted || end != nil {
		t.Errorf("forever became muted=%v end=%v err=%v; BuildMuteAbs writes -1 for no end", muted, end, err)
	}
	if muted, end, err := muteEnd(&later, now); err != nil || !muted || end == nil || *end != 1790326800000 {
		t.Errorf("a time became muted=%v end=%v err=%v, want its Unix milliseconds", muted, end, err)
	}
	if muted, end, err := muteEnd(nil, now); err != nil || muted || end != nil {
		t.Errorf("unmute became muted=%v end=%v err=%v", muted, end, err)
	}
	if patch := appstate.BuildMuteAbs(group, true, nil); patch.Mutations[0].Value.GetMuteAction().GetMuteEndTimestamp() != -1 {
		t.Errorf("whatsmeow no longer writes forever as -1")
	}
}

func TestMuteEndRefusesWhatIsNotAFutureTime(t *testing.T) {
	now := time.Date(2026, 9, 25, 8, 0, 0, 0, time.UTC)
	for _, until := range []string{"2h", "tomorrow", "2026-09-25T07:00:00Z"} {
		if _, _, err := muteEnd(&until, now); !isFailure(err, "validation_error") {
			t.Errorf("%q gave %v, want a validation_error", until, err)
		}
	}
}

func TestAMissingSettingsKeyIsTheKeysReason(t *testing.T) {
	cases := []error{
		// Both built as whatsmeow builds them in sendAppState and EncodePatch.
		fmt.Errorf("no app state keys found, creating app state keys is not yet supported"),
		fmt.Errorf("failed to get app state key details with key ID %x: %w", []byte{1}, appstate.ErrKeyNotFound),
	}
	for _, err := range cases {
		if got := classify(appStateFailure(err)); got.Code != "provider_unavailable" || got.Reason != "settings.keys-missing" {
			t.Errorf("%v became %+v", err, got)
		}
	}
}

// whatsmeow answers before it reaches the network, so this pins the wording appStateFailure matches.
func TestWhatsmeowsOwnNoKeysErrorIsTheKeysReason(t *testing.T) {
	device, _, refused := openDevice(context.Background(), filepath.Join(t.TempDir(), "private.db"), true, waLog.Noop)
	if refused != nil {
		t.Fatal(refused)
	}
	device.ID = &selfPN
	device.Account = &waAdv.ADVSignedDeviceIdentity{
		Details:             []byte{},
		AccountSignature:    make([]byte, 64),
		AccountSignatureKey: make([]byte, 32),
		DeviceSignature:     make([]byte, 64),
	}
	if err := device.Save(context.Background()); err != nil {
		t.Fatal(err)
	}
	err := whatsmeow.NewClient(device, waLog.Noop).SendAppState(context.Background(), appstate.BuildMuteAbs(group, true, nil))
	if got := appStateFailure(err); got != keysMissing {
		t.Errorf("whatsmeow's %v became %v", err, got)
	}
}

func TestAPatchTheServerTookIsDoneThoughReadingBackFailed(t *testing.T) {
	err := fmt.Errorf("failed to fetch app state after sending update: %w", errors.New("synthetic"))
	if got := appStateFailure(err); got != nil {
		t.Errorf("got %v, want the write reported as done", got)
	}
	refused := fmt.Errorf("%w (%s): %s", whatsmeow.ErrAppStateUpdate, appstate.WAPatchRegularHigh, "synthetic")
	if got := appStateFailure(refused); got != refused {
		t.Errorf("a refused patch became %v", got)
	}
}

func isFailure(err error, code string) bool {
	var f *failure
	return errors.As(err, &f) && f.Code == code
}

func TestAPatchThatLeftWithoutAnAnswerIsOutcomeUnknown(t *testing.T) {
	for _, err := range []error{
		whatsmeow.ErrIQTimedOut,
		context.DeadlineExceeded,
		whatsmeow.ErrIQDisconnected,
		fmt.Errorf("failed to fetch app state after sending update: %w", whatsmeow.ErrIQTimedOut),
	} {
		want := "outcome_unknown"
		if strings.HasPrefix(err.Error(), sentNotReadBack) {
			want = ""
		}
		got := ""
		if failed := appStateFailure(err); failed != nil {
			got = classify(failed).Code
		}
		if got != want {
			t.Errorf("%v became %q, want %q", err, got, want)
		}
	}
	// whatsmeow answers ErrNotConnected before a patch leaves, and also when it resends one after a reconnect, so
	// appStateFailure leaves it to refusalFor, which counts it as maybe sent for a write.
	if got := classify(appStateFailure(whatsmeow.ErrNotConnected)).Code; got != "network_error" {
		t.Errorf("appStateFailure decided a lost connection itself: %q", got)
	}
	e := &engine{out: newWire(io.Discard)}
	if got := e.refusalFor("mute", appStateFailure(whatsmeow.ErrNotConnected)).Code; got != "outcome_unknown" {
		t.Errorf("a patch that may have left became %q", got)
	}
}

// The read-back failure has no type, so this pins the wording appStateFailure matches in whatsmeow's own source.
func TestWhatsmeowStillWordsAFailedReadBackAsMatched(t *testing.T) {
	dir, err := exec.Command("go", "list", "-m", "-f", "{{.Dir}}", "go.mau.fi/whatsmeow").Output()
	if err != nil {
		t.Fatal(err)
	}
	source, err := os.ReadFile(filepath.Join(strings.TrimSpace(string(dir)), "appstate.go"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(source), `"`+sentNotReadBack+`: %w"`) {
		t.Errorf("whatsmeow's appstate.go no longer says %q", sentNotReadBack)
	}
}
