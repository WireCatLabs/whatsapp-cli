package main

import (
	"time"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/types"
)

const notInTheChatList = "wa archives, pins and marks unread chats and groups, not channels"

// arrangeChat archives, unarchives or marks read or unread a chat, up to its newest stored message: WhatsApp's apps read the
// range to tell what came after. Nobody in the chat is told.
func (e *engine) arrangeChat(req request) error {
	return e.sendUpTo(req, notInTheChatList, func(chat types.JID, at time.Time, last *waCommon.MessageKey) appstate.PatchInfo {
		return chatListPatch(req.Op, chat, at, last)
	})
}

// chatListPatch: whatsmeow's archive patch also unpins the chat (Baileys' does not). Read and unread are one patch
// with read true or false, and neither sends a receipt: a read receipt does not take a mark-unread off.
func chatListPatch(op string, chat types.JID, at time.Time, last *waCommon.MessageKey) appstate.PatchInfo {
	if op == "markChatRead" || op == "markChatUnread" {
		return appstate.BuildMarkChatAsRead(chat, op == "markChatRead", at, last)
	}
	return appstate.BuildArchive(chat, op == "archiveChat", at, last)
}

// pinChat pins or unpins a chat at the top of the account's chat list. WhatsApp's apps keep three pinned chats, but the
// server cannot read a patch to refuse a fourth, so nothing counts them here.
func (e *engine) pinChat(req request) error {
	chat, err := types.ParseJID(req.JID)
	if err != nil || chat.User == "" {
		return &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if chat.Server == types.NewsletterServer || chat.Server == types.BroadcastServer {
		return &failure{"validation_error", notInTheChatList}
	}
	return e.sendAppState(appstate.BuildPin(chat, req.Op == "pinChat"))
}
