package main

import "go.mau.fi/whatsmeow/types"

type privacyFields struct {
	Privacy []waPrivacyChange `json:"privacy,omitempty"`
}

type waPrivacyChange struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// waPrivacy is the account's privacy in WhatsApp's own names and values; "" is a setting WhatsApp did not send.
type waPrivacy struct {
	GroupAdd string `json:"groupadd"`
	LastSeen string `json:"last"`
	Online   string `json:"online"`
	CallAdd  string `json:"calladd"`
}

// privacyValues are the settings wa changes and the values whatsmeow documents for each (types.PrivacySettings),
// less groupadd none: whatsmeow lists it, but Baileys dropped it as refused by WhatsApp (WhiskeySockets/Baileys#966).
var privacyValues = map[types.PrivacySettingType][]types.PrivacySetting{
	types.PrivacySettingTypeGroupAdd: {types.PrivacySettingAll, types.PrivacySettingContacts,
		types.PrivacySettingContactBlacklist},
	types.PrivacySettingTypeLastSeen: {types.PrivacySettingAll, types.PrivacySettingContacts,
		types.PrivacySettingContactBlacklist, types.PrivacySettingNone},
	types.PrivacySettingTypeOnline:  {types.PrivacySettingAll, types.PrivacySettingMatchLastSeen},
	types.PrivacySettingTypeCallAdd: {types.PrivacySettingAll, types.PrivacySettingKnown},
}

func (e *engine) dispatchPrivacy(req request) (any, bool, error) {
	switch req.Op {
	case "privacy":
		value, err := e.privacy()
		return value, true, err
	case "setPrivacy":
		value, err := e.setPrivacy(req.Privacy)
		return value, true, err
	}
	return nil, false, nil
}

// privacy asks WhatsApp, not whatsmeow's cache: another device may have changed a setting since it was filled.
func (e *engine) privacy() (*waPrivacy, error) {
	if err := e.connect(); err != nil {
		return nil, err
	}
	settings, err := e.client.TryFetchPrivacySettings(e.ctx, true)
	if err != nil {
		return nil, err
	}
	answer := privacyOf(*settings)
	return &answer, nil
}

// setPrivacy sends one request per setting, so every one is checked before the first goes: a refusal changes nothing.
// WhatsApp failing a later request does not undo the earlier ones, and the failure says so.
func (e *engine) setPrivacy(changes []waPrivacyChange) (*waPrivacy, error) {
	if err := checkPrivacy(changes); err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	for i, change := range changes {
		_, err := e.client.SetPrivacySetting(e.ctx, types.PrivacySettingType(change.Name), types.PrivacySetting(change.Value))
		if err != nil && i > 0 {
			return nil, partlyChanged(err)
		}
		if err != nil {
			return nil, err
		}
	}
	return e.privacy()
}

func partlyChanged(err error) *refusal {
	partly := *classify(err)
	partly.Message += "; the privacy settings sent before it did change (see account privacy show)"
	return &partly
}

func checkPrivacy(changes []waPrivacyChange) error {
	if len(changes) == 0 {
		return &failure{"validation_error", "no privacy setting to change"}
	}
	for _, change := range changes {
		values, known := privacyValues[types.PrivacySettingType(change.Name)]
		if !known {
			return &failure{"validation_error", "the engine changes no such privacy setting"}
		}
		if !hasValue(values, types.PrivacySetting(change.Value)) {
			return &failure{"validation_error", "WhatsApp has no such value for that privacy setting"}
		}
	}
	return nil
}

func hasValue(values []types.PrivacySetting, value types.PrivacySetting) bool {
	for _, one := range values {
		if one == value {
			return true
		}
	}
	return false
}

func privacyOf(settings types.PrivacySettings) waPrivacy {
	return waPrivacy{
		GroupAdd: string(settings.GroupAdd),
		LastSeen: string(settings.LastSeen),
		Online:   string(settings.Online),
		CallAdd:  string(settings.CallAdd),
	}
}
