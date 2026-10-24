package main

import (
	"testing"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/types"
)

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
	patch, err = buildContact(annPN, types.JID{}, "Synthetic Person", "Person", true)
	if err != nil || !patch.Mutations[0].Value.GetContactAction().GetSaveOnPrimaryAddressbook() {
		t.Fatal("explicit phonebook choice lost")
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
