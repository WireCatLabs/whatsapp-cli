package main

import (
	"errors"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

type waProfile struct {
	JID      string  `json:"jid"`
	Name     *string `json:"name"`
	About    *string `json:"about"`
	Business bool    `json:"business"`
	Verified bool    `json:"verified"`
	Contact  bool    `json:"contact"`
	// nil when their privacy hides the photo from the account.
	Photo *bool `json:"photo"`
}

// A number lookup is the request a phone makes when someone types a number; many in a row is what a scraper
// sends, and WhatsApp bans accounts for it. One per lookupGap per engine process.
const lookupGap = 10 * time.Second

var lookups struct {
	sync.Mutex
	last time.Time
}

func (e *engine) dispatchPeople(req request) (any, bool, error) {
	switch req.Op {
	case "profile":
		value, err := e.profile(req.JID)
		return value, true, err
	case "block":
		return nil, true, e.block(req.JID, req.Blocked)
	case "lookup":
		value, err := e.lookup(req.Phone)
		return value, true, err
	case "contacts":
		return e.contacts(), true, nil
	}
	return nil, false, nil
}

func (e *engine) profile(raw string) (*waProfile, error) {
	jid, err := personJID(raw)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	infos, err := e.client.GetUserInfo(e.ctx, []types.JID{jid})
	if err != nil {
		return nil, err
	}
	info, found := infos[jid]
	if !found {
		return nil, &failure{"not_found", "WhatsApp has no such person"}
	}
	id := e.conv.canonical(jid, nil)
	profile := e.conv.profile(id, info, e.contact(id))
	profile.Photo = e.hasPhoto(jid)
	return &profile, nil
}

func (c *converter) profile(id types.JID, info types.UserInfo, contact types.ContactInfo) waProfile {
	profile := waProfile{
		JID:     id.String(),
		Name:    name(contact.FullName, contact.FirstName, contact.BusinessName, contact.PushName),
		About:   str(info.Status),
		Contact: contact.FullName != "" || contact.FirstName != "",
	}
	if info.VerifiedName != nil {
		profile.Business = true
		// "high" is the official business account WhatsApp marks with its badge.
		profile.Verified = info.VerifiedName.VerifiedLevel == "high"
		if profile.Name == nil && info.VerifiedName.Details != nil {
			profile.Name = name(info.VerifiedName.Details.GetVerifiedName())
		}
	}
	return profile
}

func (e *engine) hasPhoto(jid types.JID) *bool {
	yes, no := true, false
	picture, err := e.client.GetProfilePictureInfo(e.ctx, jid, &whatsmeow.GetProfilePictureParams{Preview: true})
	switch {
	case err == nil && picture != nil:
		return &yes
	case errors.Is(err, whatsmeow.ErrProfilePictureNotSet):
		return &no
	}
	return nil
}

func (e *engine) block(raw string, blocked bool) error {
	jid, err := personJID(raw)
	if err != nil {
		return err
	}
	if err := e.connect(); err != nil {
		return err
	}
	action := events.BlocklistChangeActionUnblock
	if blocked {
		action = events.BlocklistChangeActionBlock
	}
	_, err = e.client.UpdateBlocklist(e.ctx, jid, action, "")
	return err
}

// lookup asks whether one number has WhatsApp. It reads only: nothing is sent to the number.
func (e *engine) lookup(phone string) (*waContact, error) {
	digits := strings.Map(func(r rune) rune {
		switch {
		case r >= '0' && r <= '9':
			return r
		case r == ' ' || r == '-' || r == '(' || r == ')' || r == '+':
			return -1
		}
		return 'x'
	}, phone)
	if len(digits) < 6 || len(digits) > 15 || strings.ContainsRune(digits, 'x') {
		return nil, &failure{"validation_error", "that is not a phone number — digits, with a country code"}
	}
	lookups.Lock()
	wait := time.Until(lookups.last.Add(lookupGap))
	if wait > 0 {
		lookups.Unlock()
		return nil, &failure{"rate_limited", "one number lookup at a time; wait a few seconds"}
	}
	lookups.last = time.Now()
	lookups.Unlock()
	if err := e.connect(); err != nil {
		return nil, err
	}
	found, err := e.client.IsOnWhatsApp(e.ctx, []string{"+" + digits})
	if err != nil {
		return nil, err
	}
	for _, one := range found {
		if one.IsIn && !one.JID.IsEmpty() {
			id := e.conv.canonical(one.JID, nil)
			return &waContact{JID: id.String(), Name: name(e.nameOf(id))}, nil
		}
	}
	return nil, &failure{"not_found", "nobody on WhatsApp has that number, or their privacy hides them"}
}
