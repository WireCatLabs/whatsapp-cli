package main

import (
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

type waNotAdded struct {
	NotAdded []string `json:"notAdded"`
}

type waJoinRequest struct {
	JID         string  `json:"jid"`
	Name        *string `json:"name"`
	RequestedAt *string `json:"requestedAt"`
}

var participantActions = map[string]whatsmeow.ParticipantChange{
	"add":     whatsmeow.ParticipantChangeAdd,
	"remove":  whatsmeow.ParticipantChangeRemove,
	"promote": whatsmeow.ParticipantChangePromote,
	"demote":  whatsmeow.ParticipantChangeDemote,
}

// participants adds, removes, promotes or demotes. A group still addressed by phone numbers is sent phone JIDs.
func (e *engine) participants(req request) (*waNotAdded, error) {
	jid, err := groupJID(req.JID)
	if err != nil {
		return nil, err
	}
	action, ok := participantActions[req.Action]
	if !ok {
		return nil, &failure{"validation_error", "action is add, remove, promote or demote"}
	}
	people, err := e.people(req.People)
	if err != nil {
		return nil, err
	}
	if len(people) == 0 {
		return nil, &failure{"validation_error", "name at least one person"}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	addressed := make([]types.JID, len(people))
	for i, person := range people {
		addressed[i] = e.participantFor(target{chat: jid, sender: person}).sender
	}
	answered, err := e.client.UpdateGroupParticipants(e.ctx, jid, addressed, action)
	if err != nil {
		return nil, err
	}
	notAdded := failedOf(people, answered, e.conv)
	if action != whatsmeow.ParticipantChangeAdd && len(notAdded) > 0 {
		return nil, &failure{"provider_error", "WhatsApp did not make the change for everyone named; read the group before retrying"}
	}
	return &waNotAdded{NotAdded: notAdded}, nil
}

func (e *engine) requests(raw string) ([]waJoinRequest, error) {
	jid, err := groupJID(raw)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	found, err := e.client.GetGroupRequestParticipants(e.ctx, jid)
	if err != nil {
		return nil, err
	}
	return e.conv.joinRequests(found), nil
}

func (c *converter) joinRequests(found []types.GroupParticipantRequest) []waJoinRequest {
	list := make([]waJoinRequest, 0, len(found))
	for _, one := range found {
		id := c.canonical(one.JID, nil)
		list = append(list, waJoinRequest{JID: id.String(), Name: name(c.nameOf(id)), RequestedAt: isoPtr(one.RequestedAt)})
	}
	return list
}

func (e *engine) answerRequest(req request) error {
	jid, err := groupJID(req.JID)
	if err != nil {
		return err
	}
	people, err := e.people(req.People)
	if err != nil {
		return err
	}
	if len(people) != 1 {
		return &failure{"validation_error", "answer one request at a time"}
	}
	if err := e.connect(); err != nil {
		return err
	}
	action := whatsmeow.ParticipantChangeReject
	if req.Accept {
		action = whatsmeow.ParticipantChangeApprove
	}
	answered, err := e.client.UpdateGroupRequestParticipants(e.ctx, jid, people, action)
	if err != nil {
		return err
	}
	if len(failedOf(people, answered, e.conv)) > 0 {
		return &failure{"not_found", "that request is gone: answered elsewhere or withdrawn"}
	}
	return nil
}
