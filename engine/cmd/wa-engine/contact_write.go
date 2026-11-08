package main

import (
	"regexp"
	"strings"
	"unicode"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

type contactFields struct {
	ContactName string `json:"contactName,omitempty"`
	FirstName   string `json:"firstName,omitempty"`
	Phonebook   bool   `json:"phonebook,omitempty"`
}

var contactDigits = regexp.MustCompile(`^\d+$`)

func validContactName(value string) bool {
	if strings.TrimSpace(value) == "" {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

func buildContact(pn, lid types.JID, full, first string, phonebook bool) (appstate.PatchInfo, error) {
	if pn.Server != types.DefaultUserServer || !contactDigits.MatchString(pn.User) || !validContactName(full) {
		return appstate.PatchInfo{}, &failure{"validation_error", "a contact needs a phone id and a nonempty name without control characters"}
	}
	full = strings.TrimSpace(full)
	if first == "" {
		first = strings.Fields(full)[0]
	}
	if !validContactName(first) {
		return appstate.PatchInfo{}, &failure{"validation_error", "a first name must not contain control characters"}
	}
	first = strings.TrimSpace(first)
	target := pn.ToNonAD().String()
	// Current clients key a contact by its LID and show only the number for one saved without it (wacli refuses too).
	if lid.IsEmpty() {
		return appstate.PatchInfo{}, &failure{"not_found", "WhatsApp has not given this number's LID yet; nothing was saved"}
	}
	if lid.Server != types.HiddenUserServer || !contactDigits.MatchString(lid.User) {
		return appstate.PatchInfo{}, &failure{"validation_error", "not a contact LID"}
	}
	action := &waSyncAction.ContactAction{
		FullName: &full, FirstName: &first, PnJID: &target, LidJID: proto.String(lid.ToNonAD().String()),
		SaveOnPrimaryAddressbook: &phonebook,
	}
	return appstate.PatchInfo{Type: appstate.WAPatchCriticalUnblockLow, Mutations: []appstate.MutationInfo{{
		Index: []string{appstate.IndexContact, target}, Version: 2,
		Value: &waSyncAction.SyncActionValue{ContactAction: action},
	}}}, nil
}

// A contact keyed to the account's own number shows as the account's name on its own devices. Without the own ids
// the check cannot hold, so it refuses.
func refuseOwnContact(pn, lid, ownPN, ownLID types.JID) error {
	if ownPN.IsEmpty() && ownLID.IsEmpty() {
		return &failure{"authentication_error", "this device does not know its own account yet; nothing was saved"}
	}
	if (!ownPN.IsEmpty() && pn.ToNonAD().User == ownPN.User) || (!ownLID.IsEmpty() && lid.ToNonAD().User == ownLID.User) {
		return &failure{"validation_error", "that number is this account's own; a contact is for another person — nothing was saved"}
	}
	return nil
}

type waOwnNumber struct {
	Matches bool   `json:"matches"`
	Ends    string `json:"ends"`
}

// ownNumber answers whether the typed number is the linked account's, and only the last four digits of the account's,
// so a live check can tell a spare from the owner's main account without the number leaving the engine.
func ownNumber(own *types.JID, typed string) (*waOwnNumber, error) {
	if own == nil || own.User == "" {
		return nil, &failure{"authentication_error", "this device is not linked"}
	}
	if !contactDigits.MatchString(typed) {
		return nil, &failure{"validation_error", "a phone number is digits only, with the country code"}
	}
	user := own.ToNonAD().User
	return &waOwnNumber{Matches: user == typed, Ends: user[max(0, len(user)-4):]}, nil
}

func (e *engine) ownNumber(req request) (*waOwnNumber, error) {
	return ownNumber(e.client.Store.ID, req.Phone)
}

type waOwnContact struct {
	ReadBack bool `json:"readBack"`
}

// ownContactPatch names the account's own contact entry, keyed like any contact by its phone id, so it replaces a name
// written there before. It takes the device's own ids, not a target: nobody else can be named through it.
func ownContactPatch(own *types.JID, ownLID types.JID, name string) (types.JID, appstate.PatchInfo, error) {
	if own == nil || own.IsEmpty() || ownLID.IsEmpty() {
		return types.JID{}, appstate.PatchInfo{}, &failure{"authentication_error", "this device does not know its own account yet; nothing was saved"}
	}
	pn := own.ToNonAD()
	patch, err := buildContact(pn, ownLID.ToNonAD(), name, "", false)
	return pn, patch, err
}

// saveOwnContact is for bin/fix-own-contact-name alone, which undoes a contact name a live check wrote for the account's
// own number. saveContact keeps refusing that number.
func (e *engine) saveOwnContact(req request) (*waOwnContact, error) {
	pn, patch, err := ownContactPatch(e.client.Store.ID, e.client.Store.LID, req.ContactName)
	if err != nil {
		return nil, err
	}
	if err := e.sendAppState(patch); err != nil {
		return nil, err
	}
	// The write went out, so a failed read answers "not read back", not an error that reads as "not saved".
	contact, err := e.client.Store.Contacts.GetContact(e.ctx, pn)
	return &waOwnContact{ReadBack: err == nil && contact.FullName == strings.TrimSpace(req.ContactName)}, nil
}

func (e *engine) saveContact(req request) error {
	jid, err := personJID(req.JID)
	if err != nil {
		return err
	}
	pn, lid := jid, types.JID{}
	if jid.Server == types.HiddenUserServer {
		lid = jid
		pn, err = e.client.Store.LIDs.GetPNForLID(e.ctx, jid)
		if err != nil {
			return err
		}
	} else {
		lid, err = e.client.Store.LIDs.GetLIDForPN(e.ctx, jid)
		if err != nil {
			return err
		}
	}
	ownPN := types.JID{}
	if e.client.Store.ID != nil {
		ownPN = e.client.Store.ID.ToNonAD()
	}
	if err := refuseOwnContact(pn, lid, ownPN, e.client.Store.LID.ToNonAD()); err != nil {
		return err
	}
	patch, err := buildContact(pn, lid, req.ContactName, req.FirstName, req.Phonebook)
	if err != nil {
		return err
	}
	return e.sendAppState(patch)
}
