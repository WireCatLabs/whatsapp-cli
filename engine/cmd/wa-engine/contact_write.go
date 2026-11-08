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

// refuseOwnContact fails closed: a contact keyed to the account's own number renames the account on all its devices,
// and a profile linked to the wrong phone makes "a person's number" the own one (WA-1, 2026-11-08).
func refuseOwnContact(pn, lid, ownPN, ownLID types.JID) error {
	if ownPN.IsEmpty() && ownLID.IsEmpty() {
		return &failure{"authentication_error", "this device does not know its own account yet; nothing was saved"}
	}
	if (!ownPN.IsEmpty() && pn.ToNonAD().User == ownPN.User) || (!ownLID.IsEmpty() && lid.ToNonAD().User == ownLID.User) {
		return &failure{"validation_error", "that number is this account's own; a contact is for another person — nothing was saved"}
	}
	return nil
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
	e.refreshSelf()
	if err := refuseOwnContact(pn, lid, e.conv.selfPN, e.conv.self); err != nil {
		return err
	}
	patch, err := buildContact(pn, lid, req.ContactName, req.FirstName, req.Phonebook)
	if err != nil {
		return err
	}
	return e.sendAppState(patch)
}
