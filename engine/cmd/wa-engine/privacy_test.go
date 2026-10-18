package main

import (
	"testing"

	"go.mau.fi/whatsmeow/types"
)

func TestPrivacyWireShape(t *testing.T) {
	got := privacyOf(types.PrivacySettings{
		GroupAdd:     types.PrivacySettingContacts,
		LastSeen:     types.PrivacySettingNone,
		Online:       types.PrivacySettingMatchLastSeen,
		CallAdd:      types.PrivacySettingKnown,
		ReadReceipts: types.PrivacySettingAll,
	})
	assertJSON(t, got, `{"groupadd":"contacts","last":"none","online":"match_last_seen","calladd":"known"}`)
}

func TestCheckPrivacyRefusesBeforeAnythingIsSent(t *testing.T) {
	for _, changes := range [][]waPrivacyChange{
		nil,
		{{Name: "readreceipts", Value: "none"}},
		{{Name: "last", Value: "none"}, {Name: "calladd", Value: "none"}},
		{{Name: "online", Value: "contacts"}},
		{{Name: "groupadd", Value: "none"}},
	} {
		if f, ok := checkPrivacy(changes).(*failure); !ok || f.Code != "validation_error" {
			t.Fatalf("%v must be refused, got %v", changes, f)
		}
	}
	if err := checkPrivacy([]waPrivacyChange{{Name: "last", Value: "none"}, {Name: "online", Value: "match_last_seen"},
		{Name: "groupadd", Value: "contacts"}, {Name: "calladd", Value: "known"}}); err != nil {
		t.Fatal(err)
	}
}

func TestPartlyChangedKeepsTheCodeAndSaysSo(t *testing.T) {
	got := partlyChanged(&failure{"timeout", "WhatsApp did not answer in time"})
	if got.Code != "timeout" || got.Message != "WhatsApp did not answer in time; the privacy settings sent before it did change (see account privacy show)" {
		t.Fatalf("got %+v", got)
	}
	before := banned.Message
	if reasoned := partlyChanged(banned); reasoned.Reason != "account.banned" || banned.Message != before {
		t.Fatalf("the shared ban refusal must keep its reason and stay unchanged, got %+v", reasoned)
	}
}
