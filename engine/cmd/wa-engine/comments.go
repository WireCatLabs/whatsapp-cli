package main

import (
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func (c *converter) comment(evt *events.Message, k known) (change, bool) {
	encrypted := evt.Message.GetEncCommentMessage()
	key := encrypted.GetTargetMessageKey()
	if c.decryptComment == nil || evt.Info.Chat.Server != types.GroupServer || key.GetID() == "" {
		return change{}, false
	}
	if remote := key.GetRemoteJID(); remote != "" && remote != evt.Info.Chat.String() {
		return change{}, false
	}
	content, err := c.decryptComment(evt)
	if err != nil || content == nil || content.GetEncCommentMessage() != nil {
		return change{}, false
	}
	decrypted := *evt
	decrypted.Message = content
	changed, ok := c.message(&decrypted, k)
	if !ok || changed.kind != "message" {
		return change{}, false
	}
	changed.message.Thread = key.GetID()
	changed.message.ReplyTo = str(key.GetID())
	return changed, true
}

func (e *engine) commentGroup(raw string) (bool, error) {
	jid, err := groupJID(raw)
	if err != nil {
		return false, &failure{"validation_error", "comments exist only in community announcement groups; channels have none"}
	}
	if err := e.connect(); err != nil {
		return false, err
	}
	group, err := e.client.GetGroupInfo(e.ctx, jid)
	if err != nil {
		return false, err
	}
	if group == nil || !group.IsDefaultSubGroup {
		return false, &failure{"validation_error", "comments exist only in community announcement groups"}
	}
	return true, nil
}

func (e *engine) decryptComment(evt *events.Message) (*waE2E.Message, error) {
	return e.client.DecryptComment(e.ctx, evt)
}
