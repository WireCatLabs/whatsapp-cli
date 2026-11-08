package main

import (
	"context"
	"encoding/json"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
)

type oneLID struct {
	store.LIDStore
	pn, lid types.JID
}

func (s oneLID) GetLIDForPN(_ context.Context, pn types.JID) (types.JID, error) {
	if pn.User == s.pn.User {
		return s.lid, nil
	}
	return types.JID{}, nil
}

func (s oneLID) GetPNForLID(_ context.Context, lid types.JID) (types.JID, error) {
	if lid.User == s.lid.User {
		return s.pn, nil
	}
	return types.JID{}, nil
}

func TestSaveContactRefusesTheLinkedAccountsOwnNumberBeforeAnySync(t *testing.T) {
	ownDevice := types.NewADJID(annPN.User, 0, 7)
	for _, target := range []string{annPN.String(), annLID.String()} {
		e := &engine{ctx: context.Background(), conv: testConverter(), client: &whatsmeow.Client{Store: &store.Device{
			ID: &ownDevice, LID: annLID, LIDs: oneLID{pn: annPN, lid: annLID},
		}}}
		if err := e.saveContact(request{JID: target, contactFields: contactFields{ContactName: "WA check 1"}}); !isFailure(err, "validation_error") {
			t.Fatalf("contact for the account's own %s went on: %v", target, err)
		}
	}
}

func TestContactPatchUsesOneCriticalContactMutationWithExplicitPhonebookChoice(t *testing.T) {
	patch, err := buildContact(annPN, annLID, " Synthetic Person ", "", false)
	if err != nil {
		t.Fatal(err)
	}
	if patch.Type != appstate.WAPatchCriticalUnblockLow || len(patch.Mutations) != 1 {
		t.Fatalf("bad collection: %+v", patch)
	}
	mutation := patch.Mutations[0]
	if mutation.Version != 2 || len(mutation.Index) != 2 || mutation.Index[0] != appstate.IndexContact || mutation.Index[1] != annPN.String() {
		t.Fatalf("bad mutation: %+v", mutation.Index)
	}
	action := mutation.Value.GetContactAction()
	if action.GetFullName() != "Synthetic Person" || action.GetFirstName() != "Synthetic" || action.GetPnJID() != annPN.String() || action.GetLidJID() != annLID.String() || action.SaveOnPrimaryAddressbook == nil || action.GetSaveOnPrimaryAddressbook() {
		t.Fatal("contact fields changed")
	}
	patch, err = buildContact(annPN, annLID, "Synthetic Person", "Person", true)
	if err != nil || !patch.Mutations[0].Value.GetContactAction().GetSaveOnPrimaryAddressbook() {
		t.Fatal("explicit phonebook choice lost")
	}
}

func TestContactPatchRefusesANumberWithoutItsLID(t *testing.T) {
	if _, err := buildContact(annPN, types.JID{}, "Synthetic Person", "", false); !isFailure(err, "not_found") {
		t.Fatalf("contact without a LID accepted: %v", err)
	}
}

func TestContactPatchRefusesInvalidIDsAndNamesBeforeAnySync(t *testing.T) {
	for _, test := range []struct {
		pn, lid     types.JID
		full, first string
	}{
		{annLID, types.JID{}, "Synthetic", ""},
		{group, types.JID{}, "Synthetic", ""},
		{annPN, group, "Synthetic", ""},
		{annPN, annLID, "  ", ""},
		{annPN, annLID, "Synthetic\nPerson", ""},
		{annPN, annLID, "Synthetic", "bad\x00name"},
	} {
		if _, err := buildContact(test.pn, test.lid, test.full, test.first, false); !isFailure(err, "validation_error") {
			t.Fatalf("invalid contact accepted: %v", err)
		}
	}
}

func TestContactWriteRefusesTheAccountsOwnNumberOrLID(t *testing.T) {
	for _, own := range []struct{ pn, lid types.JID }{
		{annPN, types.JID{}},
		{types.JID{}, annLID},
		{types.NewADJID(annPN.User, 0, 5), annLID},
	} {
		if err := refuseOwnContact(annPN, annLID, own.pn, own.lid); !isFailure(err, "validation_error") {
			t.Fatalf("contact for the own account accepted (own %v): %v", own, err)
		}
	}
	if err := refuseOwnContact(annPN, annLID, types.JID{}, types.JID{}); !isFailure(err, "authentication_error") {
		t.Fatalf("contact written without knowing the own account: %v", err)
	}
	other := types.NewJID("70000000009", types.DefaultUserServer)
	if err := refuseOwnContact(annPN, annLID, other, types.NewJID("100000000000009", types.HiddenUserServer)); err != nil {
		t.Fatalf("another person's contact refused: %v", err)
	}
}

func TestOwnNumberAnswersAMatchAndOnlyTheLastFourDigits(t *testing.T) {
	own := types.NewADJID(annPN.User, 0, 7)
	if got, err := ownNumber(&own, annPN.User); err != nil || !got.Matches || got.Ends != "0002" {
		t.Fatalf("own number not recognised: %+v %v", got, err)
	}
	if got, err := ownNumber(&own, "34600000001"); err != nil || got.Matches || got.Ends != "0002" {
		t.Fatalf("another number matched: %+v %v", got, err)
	}
	if _, err := ownNumber(nil, annPN.User); !isFailure(err, "authentication_error") {
		t.Fatalf("unlinked device answered: %v", err)
	}
	if _, err := ownNumber(&own, "+7 000"); !isFailure(err, "validation_error") {
		t.Fatalf("formatted number accepted: %v", err)
	}
}

func TestOwnContactPatchNamesTheDevicesOwnIDsUnderTheChosenKey(t *testing.T) {
	ownDevice := types.NewADJID(annPN.User, 0, 7)
	for _, test := range []struct {
		key, index, target string
		version            int32
		stored             types.JID
	}{
		{"pn", appstate.IndexContact, annPN.String(), 2, annPN},
		{"lid", appstate.IndexContact, annLID.String(), 2, annLID},
		{"lid_contact", appstate.IndexLIDContact, annLID.String(), 1, types.JID{}},
	} {
		stored, patch, err := ownContactPatch(&ownDevice, annLID, test.key, " Own Name ")
		if err != nil {
			t.Fatal(err)
		}
		mutation := patch.Mutations[0]
		if stored != test.stored || patch.Type != appstate.WAPatchCriticalUnblockLow || len(patch.Mutations) != 1 ||
			mutation.Version != test.version || len(mutation.Index) != 2 || mutation.Index[0] != test.index ||
			mutation.Index[1] != test.target {
			t.Fatalf("%s: bad patch: %v %+v", test.key, stored, mutation)
		}
		if test.key == "lid_contact" {
			action := mutation.Value.GetLidContactAction()
			if mutation.Value.GetContactAction() != nil || action.GetFullName() != "Own Name" ||
				action.GetFirstName() != "Own" || action.Username != nil || action.Birthday != nil {
				t.Fatalf("lid_contact: bad value: %+v", mutation.Value)
			}
			continue
		}
		action := mutation.Value.GetContactAction()
		if action.GetFullName() != "Own Name" || action.GetFirstName() != "Own" || action.GetPnJID() != annPN.String() ||
			action.GetLidJID() != annLID.String() || (test.key == "lid") != (action.SaveOnPrimaryAddressbook == nil) {
			t.Fatalf("%s: bad value: %+v", test.key, action)
		}
	}
}

func TestOwnContactPatchRefusesAnUnknownKeyMissingOwnIDsAndAnEmptyName(t *testing.T) {
	ownDevice := types.NewADJID(annPN.User, 0, 7)
	for _, key := range []string{"", "phone", "LID"} {
		if _, _, err := ownContactPatch(&ownDevice, annLID, key, "Own Name"); !isFailure(err, "validation_error") {
			t.Fatalf("own contact written under key %q: %v", key, err)
		}
	}
	for _, key := range []string{"pn", "lid", "lid_contact"} {
		if _, _, err := ownContactPatch(nil, annLID, key, "Own Name"); !isFailure(err, "authentication_error") {
			t.Fatalf("%s: own contact written without the own phone id: %v", key, err)
		}
		if _, _, err := ownContactPatch(&ownDevice, types.JID{}, key, "Own Name"); !isFailure(err, "authentication_error") {
			t.Fatalf("%s: own contact written without the own LID: %v", key, err)
		}
		if _, _, err := ownContactPatch(&ownDevice, annLID, key, " "); !isFailure(err, "validation_error") {
			t.Fatalf("%s: empty own contact name accepted: %v", key, err)
		}
	}
}

func TestSaveContactStillRefusesTheOwnNumberWhateverElseTheRequestCarries(t *testing.T) {
	ownDevice := types.NewADJID(annPN.User, 0, 7)
	e := &engine{ctx: context.Background(), conv: testConverter(), client: &whatsmeow.Client{Store: &store.Device{
		ID: &ownDevice, LID: annLID, LIDs: oneLID{pn: annPN, lid: annLID},
	}}}
	var req request
	if err := json.Unmarshal([]byte(`{"op":"saveContact","jid":"`+annPN.String()+`","contactName":"Own Name","allowOwn":true,"own":true}`), &req); err != nil {
		t.Fatal(err)
	}
	if err := e.saveContact(req); !isFailure(err, "validation_error") {
		t.Fatalf("saveContact named the account's own number: %v", err)
	}
}
