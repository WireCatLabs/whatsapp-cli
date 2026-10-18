package main

import (
	"os"
	"path/filepath"
	"testing"

	"go.mau.fi/whatsmeow/appstate"
)

func TestUpdateProfileRefusesBeforeConnecting(t *testing.T) {
	blank, name := "  ", "Synthetic Owner"
	png := filepath.Join(t.TempDir(), "photo.jpg")
	if err := os.WriteFile(png, []byte("\x89PNG\r\n\x1a\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	cases := map[string]request{
		"nothing":     {},
		"blank name":  {settingsFields: settingsFields{PushName: &blank}},
		"blank about": {settingsFields: settingsFields{PushName: &name, About: &blank}},
		"a non-JPEG":  {settingsFields: settingsFields{PushName: &name}, Path: png},
		"a relative":  {Path: "photo.jpg"},
	}
	for label, req := range cases {
		// A zero engine has no client: reaching the network would panic.
		if _, err := (&engine{}).updateProfile(req); !isFailure(err, "validation_error") {
			t.Errorf("%s gave %v, want a validation_error", label, err)
		}
	}
}

func TestThePushNameIsTheCriticalSettingWhatsmeowReadsBack(t *testing.T) {
	patch := appstate.BuildSettingPushName("Synthetic Owner")
	if patch.Type != appstate.WAPatchCriticalBlock {
		t.Errorf("the name goes in %s", patch.Type)
	}
	mutation := patch.Mutations[0]
	if mutation.Index[0] != appstate.IndexSettingPushName || mutation.Value.GetPushNameSetting().GetName() != "Synthetic Owner" {
		t.Errorf("got %v", mutation)
	}
}

func TestALaterStepFailingSaysWhatChangedBeforeIt(t *testing.T) {
	for _, code := range []string{"provider_error", "outcome_unknown"} {
		got := classify(changedBefore([]string{"name"}, &failure{code, "the about failed"}))
		if got.Code != code || got.Message != "the name is changed; the about failed" {
			t.Errorf("got %+v", got)
		}
	}
	got := classify(changedBefore([]string{"name", "about"}, &failure{"provider_error", "the photo failed"}))
	if got.Message != "the name and the about are changed; the photo failed" {
		t.Errorf("got %+v", got)
	}
	untouched := &failure{"validation_error", "WhatsApp refused the photo; it takes a square JPEG"}
	if changedBefore(nil, untouched) != error(untouched) {
		t.Error("a first step's failure changed")
	}
}
