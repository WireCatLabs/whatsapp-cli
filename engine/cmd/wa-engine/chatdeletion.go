package main

import (
	"time"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types"
)

// No deletion, of a chat or of one message, touches the photos and files the phone saved from the chat: they are the
// owner's files outside the chat, and nothing brings them back. A clear deletes every message, starred ones too, as
// cli-core's `chats clear` says. Baileys' "0 when keep starred messages is enabled" and whatsapp-rust's name
// `deleteStarred` agree: "1" deletes them.
const (
	deleteMedia   = false
	deleteStarred = true
)

// deleteChat deletes the chat (`deleteChat`) or every message in it (`clearChat`) from the account's devices, up to the
// chat's newest stored message. Nobody else in the chat is told.
func (e *engine) deleteChat(req request) error {
	return e.sendUpTo(req, "wa deletes chats and groups; delete a channel on the phone",
		func(chat types.JID, at time.Time, last *waCommon.MessageKey) appstate.PatchInfo {
			return chatDeletionPatch(req.Op, chat, at, last)
		})
}

// sendUpTo sends a patch bounded by the chat's newest stored message; `channel` is the refusal for a channel.
func (e *engine) sendUpTo(req request, channel string, build func(types.JID, time.Time, *waCommon.MessageKey) appstate.PatchInfo) error {
	t, at, err := lastOf(req, channel)
	if err != nil {
		return err
	}
	if err := e.connect(); err != nil {
		return err
	}
	t = e.participantFor(t)
	return e.sendAppState(build(t.chat, at, e.client.BuildMessageKey(t.chat, t.sender, t.id)))
}

// lastOf reads the chat's newest message as the CLI's store holds it. WhatsApp applies the patch up to the message it
// names, so a guessed one would make the phone drop the patch without a word.
func lastOf(req request, channel string) (target, time.Time, error) {
	t, err := targetOf(req)
	if err != nil {
		return target{}, time.Time{}, err
	}
	if t.chat.Server == types.NewsletterServer || t.chat.Server == types.BroadcastServer {
		return target{}, time.Time{}, &failure{"validation_error", channel}
	}
	at, err := time.Parse(time.RFC3339Nano, req.Timestamp)
	if err != nil {
		return target{}, time.Time{}, &failure{"validation_error", "the message's time is not an ISO 8601 time"}
	}
	return t, at, nil
}

func chatDeletionPatch(op string, chat types.JID, at time.Time, last *waCommon.MessageKey) appstate.PatchInfo {
	if op == "clearChat" {
		return buildClearChat(chat, at, last)
	}
	return appstate.BuildDeleteChat(chat, at, last, deleteMedia)
}

// buildClearChat is the patch whatsmeow has an index for but no builder. It is BuildDeleteChat's twin: the same
// collection, version and message range, with the index [clearChat, chat, deleteStarred, deleteMedia] — as WhatsApp
// Web's WAWebClearChatSync writes it (whatsapp-rust's schema), as Baileys' chatModify sends it, and as whatsmeow reads
// one back (deleteMedia at index 3).
func buildClearChat(chat types.JID, at time.Time, last *waCommon.MessageKey) appstate.PatchInfo {
	// whatsmeow's range builder is unexported; its delete patch carries the very range a clear needs.
	messageRange := appstate.BuildDeleteChat(chat, at, last, deleteMedia).Mutations[0].Value.GetDeleteChatAction().GetMessageRange()
	return appstate.PatchInfo{
		Type: appstate.WAPatchRegularHigh,
		Mutations: []appstate.MutationInfo{{
			Index:   []string{appstate.IndexClearChat, chat.String(), indexFlag(deleteStarred), indexFlag(deleteMedia)},
			Version: 6,
			Value: &waSyncAction.SyncActionValue{
				ClearChatAction: &waSyncAction.ClearChatAction{MessageRange: messageRange},
			},
		}},
	}
}

func indexFlag(on bool) string {
	if on {
		return "1"
	}
	return "0"
}

// deleteForMe deletes one message from the account's devices alone; the others in the chat keep it.
func (e *engine) deleteForMe(req request) error {
	const channel = "wa deletes messages in chats and groups; delete a channel's post on the phone"
	if chat, err := types.ParseJID(req.Chat); err == nil &&
		(chat.Server == types.NewsletterServer || chat.Server == types.BroadcastServer) {
		return &failure{"validation_error", channel}
	}
	t, at, err := lastOf(req, channel)
	if err != nil {
		return err
	}
	if err := e.connect(); err != nil {
		return err
	}
	return e.sendAppState(buildDeleteForMe(e.participantFor(t), at))
}

// buildDeleteForMe is the patch whatsmeow has an index for but no builder, as WhatsApp Web's
// WAWebDeleteMessageForMeSync writes it: regular_high, version 3, index [deleteMessageForMe, chat, id, fromMe,
// participant]. Cobalt and whatsapp-rust write the same; whatsmeow reads index 4 back as the sender. The message's
// time is in seconds, as WhatsApp Web's message time is.
func buildDeleteForMe(t target, at time.Time) appstate.PatchInfo {
	// WhatsApp Web reads deleteMedia as required when two devices' deletions meet, so it is always set.
	media, sent := deleteMedia, at.Unix()
	return appstate.PatchInfo{
		Type: appstate.WAPatchRegularHigh,
		Mutations: []appstate.MutationInfo{{
			Index:   []string{appstate.IndexDeleteMessageForMe, t.chat.String(), t.id, indexFlag(t.mine()), syncParticipant(t)},
			Version: 3,
			Value: &waSyncAction.SyncActionValue{
				DeleteMessageForMeAction: &waSyncAction.DeleteMessageForMeAction{DeleteMedia: &media, MessageTimestamp: &sent},
			},
		}},
	}
}

// syncParticipant is the last part of a message's key in a settings patch, as WhatsApp Web's
// constructMsgKeySegmentsFromMsgKey writes it: the sender of someone else's message in a group, without the device
// part, and "0" otherwise — also in a one-to-one chat, whichever addressing the sender is stored in.
func syncParticipant(t target) string {
	if t.inGroup() && !t.mine() {
		return t.sender.ToNonAD().String()
	}
	return "0"
}
