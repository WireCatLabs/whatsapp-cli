package main

import (
	"testing"

	"go.mau.fi/whatsmeow/appstate"
)

func TestUpdateProfileRefusesBeforeConnecting(t *testing.T) {
	blank, name := "  ", "Synthetic Owner"
	cases := map[string]request{
		"nothing":     {},
		"blank name":  {settingsFields: settingsFields{PushName: &blank}},
		"blank about": {settingsFields: settingsFields{PushName: &name, About: &blank}},
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

func TestAnAboutFailingAfterTheNameSaysTheNameChanged(t *testing.T) {
	for _, code := range []string{"provider_error", "outcome_unknown"} {
		got := classify(nameOnly(&failure{code, "the about failed"}))
		if got.Code != code || got.Message != "the name is changed; the about failed" {
			t.Errorf("got %+v", got)
		}
	}
}
