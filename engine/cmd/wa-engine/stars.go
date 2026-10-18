package main

import (
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types"
)

// star stars one message or takes the star off, on the account's devices alone; nobody in the chat is told.
func (e *engine) star(req request) error {
	if req.Starred == nil {
		return &failure{"validation_error", "say whether to star the message or take the star off"}
	}
	// Before targetOf: a channel's post has no sender to ask for.
	if chat, err := types.ParseJID(req.Chat); err == nil &&
		(chat.Server == types.NewsletterServer || chat.Server == types.BroadcastServer) {
		return &failure{"validation_error", "wa stars messages in chats and groups; star a channel's post on the phone"}
	}
	t, err := targetOf(req)
	if err != nil {
		return err
	}
	if err := e.connect(); err != nil {
		return err
	}
	return e.sendAppState(buildStar(e.participantFor(t), *req.Starred))
}

// buildStar is built here, not with whatsmeow's BuildStar: that one writes the sender at index 4 whenever its user
// part differs from the chat's, so the account's own message, or a one-to-one chat stored under a LID with a phone
// sender, would carry a participant WhatsApp Web never writes. This is WAWebStarMessageSync's patch: regular_high,
// version 2, index [star, chat, id, fromMe, participant], as whatsapp-rust's STAR schema and Cobalt write it too.
func buildStar(t target, starred bool) appstate.PatchInfo {
	return appstate.PatchInfo{
		Type: appstate.WAPatchRegularHigh,
		Mutations: []appstate.MutationInfo{{
			Index:   []string{appstate.IndexStar, t.chat.String(), t.id, indexFlag(t.mine()), syncParticipant(t)},
			Version: 2,
			Value:   &waSyncAction.SyncActionValue{StarAction: &waSyncAction.StarAction{Starred: &starred}},
		}},
	}
}

// appStateMessage is the chat a star or a delete for the owner alone made on another device names, as the store keys
// it. whatsmeow emits these only outside a full app-state sync: stars from before the link come with the history
// push's messages instead.
func (c *converter) appStateMessage(chat types.JID, id string) (string, bool) {
	if chat.IsEmpty() || id == "" || chat == types.StatusBroadcastJID {
		return "", false
	}
	return c.canonical(chat, nil).String(), true
}
