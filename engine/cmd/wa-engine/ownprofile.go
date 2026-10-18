package main

import (
	"strings"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/types"
)

// updateProfile changes the account's own name, "about" line and photo, and answers the account as it now stands.
//
// The name is an app-state setting, synced to the owner's devices. A client's presence carries its name (whatsmeow's
// SendPresence), and the engine sends none, so others probably see the new name only once the phone next comes online
// (not checked live).
func (e *engine) updateProfile(req request) (*waAccount, error) {
	pushName, about := req.PushName, req.About
	if pushName == nil && about == nil && req.Path == "" {
		return nil, &failure{"validation_error", "nothing to change — give a name, an about or a photo"}
	}
	if pushName != nil && strings.TrimSpace(*pushName) == "" {
		return nil, &failure{"validation_error", "a WhatsApp name cannot be empty"}
	}
	if about != nil && strings.TrimSpace(*about) == "" {
		return nil, &failure{"validation_error", "a WhatsApp about cannot be empty"}
	}
	var photo []byte
	if req.Path != "" {
		read, err := squareJPEG(req.Path, "profile photo", "wa")
		if err != nil {
			return nil, err
		}
		photo = read
	}
	var changed []string
	// The name goes first: a device without the settings keys yet is refused before anything changed. The photo goes
	// last, as tg sends it; its file is checked above, so what WhatsApp can still refuse is rare.
	if pushName != nil {
		before := e.client.Store.PushName
		if err := e.sendAppState(appstate.BuildSettingPushName(*pushName)); err != nil {
			return nil, err
		}
		e.keepPushName(before, *pushName)
		changed = append(changed, "name")
	}
	if about != nil {
		if err := e.setAbout(*about); err != nil {
			return nil, changedBefore(changed, err)
		}
		changed = append(changed, "about")
	}
	if photo != nil {
		if err := e.setOwnPhoto(photo); err != nil {
			return nil, changedBefore(changed, err)
		}
	}
	return e.me()
}

func (e *engine) setAbout(about string) error {
	if err := e.connect(); err != nil {
		return err
	}
	err := e.client.SetStatusMessage(e.ctx, types.SetStatusInput{Text: &about})
	if unanswered(err) {
		return &failure{"outcome_unknown", "WhatsApp did not confirm the new about; it may have been set"}
	}
	return err
}

func (e *engine) setOwnPhoto(photo []byte) error {
	err := e.setPicture(types.EmptyJID, photo)
	if unanswered(err) {
		return &failure{"outcome_unknown", "WhatsApp did not confirm the new photo; it may have been set"}
	}
	return err
}

// changedBefore keeps a later step's failure and says what before it did change, so nobody retries thinking nothing
// did.
func changedBefore(changed []string, err error) error {
	if len(changed) == 0 {
		return err
	}
	refused := *classify(err)
	verb := " is"
	if len(changed) > 1 {
		verb = " are"
	}
	refused.Message = "the " + strings.Join(changed, " and the ") + verb + " changed; " + refused.Message
	return &refused
}

// keepPushName fills in the name in whatsmeow's store, which `me` reads, when whatsmeow did not. whatsmeow writes it
// itself as it reads the patch back (appstate.go, dispatchAppState), and a failed read-back still counts as sent
// (appStateFailure); a store that moved on is whatsmeow's, and may hold a newer name from the phone. A failed save
// loses nothing that matters: the name is already on WhatsApp, and the next sync of the settings writes it here again.
func (e *engine) keepPushName(before, pushName string) {
	if e.client.Store.PushName != before || before == pushName {
		return
	}
	e.client.Store.PushName = pushName
	_ = e.client.Store.Save(e.ctx)
}
