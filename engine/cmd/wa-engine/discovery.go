package main

import (
	"context"
	"slices"

	"go.mau.fi/whatsmeow/types"
)

type waPreview struct {
	JID          string  `json:"jid"`
	Kind         string  `json:"kind"`
	Name         *string `json:"name"`
	Description  *string `json:"description"`
	Participants *int    `json:"participants"`
	Member       *bool   `json:"member"`
	Approval     bool    `json:"approval"`
}

type inviteReader interface {
	GetGroupInfoFromLink(context.Context, string) (*types.GroupInfo, error)
	GetNewsletterInfoWithInvite(context.Context, string) (*types.NewsletterMetadata, error)
}

func inviteKind(link string) (string, string, error) {
	if match := inviteCode.FindStringSubmatch(link); match != nil {
		return "group", match[1], nil
	}
	if match := channelInvite.FindStringSubmatch(link); match != nil {
		return "newsletter", match[1], nil
	}
	return "", "", &failure{"validation_error", "not a WhatsApp group or channel invite link"}
}

func inspectInvite(ctx context.Context, source inviteReader, kind, code string) (*waPreview, error) {
	if kind == "newsletter" {
		meta, err := source.GetNewsletterInfoWithInvite(ctx, code)
		if err != nil {
			return nil, err
		}
		if meta == nil {
			return nil, &failure{"not_found", "WhatsApp has no channel by that link"}
		}
		channel := channelOf(meta)
		var member *bool
		if channel.Role != "" {
			joined := channel.Role != "guest"
			member = &joined
		}
		return &waPreview{JID: channel.Chat.JID, Kind: kind, Name: channel.Chat.Name,
			Description: channel.Description, Participants: channel.Chat.Participants, Member: member}, nil
	}
	info, err := source.GetGroupInfoFromLink(ctx, code)
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, &failure{"not_found", "WhatsApp has no group by that link"}
	}
	count := info.ParticipantCount
	if count == 0 && len(info.Participants) > 0 {
		count = len(info.Participants)
	}
	return &waPreview{JID: info.JID.String(), Kind: "group", Name: name(info.Name),
		Description: str(info.Topic), Participants: &count, Approval: info.IsJoinApprovalRequired}, nil
}

func (e *engine) inspect(link string) (*waPreview, error) {
	kind, code, err := inviteKind(link)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	return inspectInvite(e.ctx, e.client, kind, code)
}

type waDevice struct {
	ID      uint16 `json:"id"`
	Current bool   `json:"current"`
}

func deviceList(own types.JID, devices []types.JID) []waDevice {
	ids := map[uint16]bool{own.Device: true}
	for _, jid := range devices {
		if jid.ToNonAD() == own.ToNonAD() {
			ids[jid.Device] = true
		}
	}
	result := make([]waDevice, 0, len(ids))
	for id := range ids {
		result = append(result, waDevice{ID: id, Current: id == own.Device})
	}
	slices.SortFunc(result, func(a, b waDevice) int { return int(a.ID) - int(b.ID) })
	return result
}

func (e *engine) devices() ([]waDevice, error) {
	if err := e.connect(); err != nil {
		return nil, err
	}
	own := e.client.Store.ID
	if own == nil {
		return nil, &failure{"authentication_error", "link this device before listing sessions"}
	}
	devices, err := e.client.GetUserDevices(e.ctx, []types.JID{own.ToNonAD()})
	if err != nil {
		return nil, err
	}
	return deviceList(*own, devices), nil
}
