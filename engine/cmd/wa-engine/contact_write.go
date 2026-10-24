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
	action := &waSyncAction.ContactAction{
		FullName: &full, FirstName: &first, PnJID: &target, SaveOnPrimaryAddressbook: &phonebook,
	}
	if !lid.IsEmpty() {
		if lid.Server != types.HiddenUserServer || !contactDigits.MatchString(lid.User) {
			return appstate.PatchInfo{}, &failure{"validation_error", "not a contact LID"}
		}
		action.LidJID = proto.String(lid.ToNonAD().String())
	}
	return appstate.PatchInfo{Type: appstate.WAPatchCriticalUnblockLow, Mutations: []appstate.MutationInfo{{
		Index: []string{appstate.IndexContact, target}, Version: 2,
		Value: &waSyncAction.SyncActionValue{ContactAction: action},
	}}}, nil
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
	patch, err := buildContact(pn, lid, req.ContactName, req.FirstName, req.Phonebook)
	if err != nil {
		return err
	}
	return e.sendAppState(patch)
}
