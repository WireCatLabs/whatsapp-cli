package main

import (
	"time"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func (e *engine) endedBy() *refusal {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.ended
}

// end tells the CLI the connection's state, and keeps why WhatsApp ended it for the requests that follow.
func (e *engine) end(state string, why *refusal) {
	e.mu.Lock()
	e.ended = why
	e.mu.Unlock()
	until := ""
	if why != nil {
		until = why.Until
	}
	e.out.connection(state, until)
}

func (e *engine) handle(raw any) {
	switch evt := raw.(type) {
	case *events.Message:
		if n := evt.Message.GetProtocolMessage().GetHistorySyncNotification(); n != nil {
			if evt.Info.IsFromMe && e.downloads != nil {
				e.downloads.add(n)
			}
		} else if evt.Info.Chat.Server == types.NewsletterServer {
			if post, ok := e.conv.channelPost(evt); ok {
				e.out.event("message", post)
			}
		} else if evt.Message.GetPollUpdateMessage() != nil {
			e.pollVote(evt)
		} else if evt.Message.GetReactionMessage() != nil {
			e.liveReaction(evt)
		} else if changed, ok := e.liveMessage(evt); ok {
			if changed.kind == "delete" {
				e.out.deleted(changed.message.Chat, changed.message.ID)
			} else {
				e.out.event(changed.kind, changed.message)
			}
		}
	case *events.HistorySync:
		history := e.conv.history(evt.Data, e.client.ParseWebMessage)
		e.remember(history.Chats)
		rekeys := e.historyRekeys(history)
		if history.Kind == "on_demand" {
			history = e.onDemand(history, evt.Notification)
		}
		history.Rekeys = rekeys
		if history.Kind != "on_demand" || !history.empty() || len(rekeys) > 0 {
			e.out.event("history", history)
		}
	case *events.Star:
		if chat, ok := e.appStateChat(evt.ChatJID, evt.MessageID); ok && evt.Action != nil {
			e.out.starred(chat, evt.MessageID, evt.Action.GetStarred())
		}
	case *events.Archive, *events.Mute, *events.MarkChatAsRead:
		e.chatStateChanged(evt)
	case *events.GroupInfo:
		for _, change := range e.conv.groupChanges(evt) {
			e.out.event("chat_event", change)
		}
		if notice, ok := e.conv.groupNotice(evt); ok {
			e.pushChats([]waChat{notice})
		}
	case *events.JoinedGroup:
		if chat, ok := e.conv.joined(evt); ok {
			e.pushChats([]waChat{chat})
		}
	case *events.DeleteForMe:
		if chat, ok := e.appStateChat(evt.ChatJID, evt.MessageID); ok {
			e.out.deleted(chat, evt.MessageID)
		}
	case *events.CallOffer, *events.CallOfferNotice, *events.CallAccept, *events.CallReject, *events.CallTerminate:
		e.call(raw)
	case *events.MediaRetry:
		e.retries.deliver(evt)
	case *events.AppStateSyncComplete:
		// The address book arrives in this patch; until then contacts have no names.
		if evt.Name == appstate.WAPatchCriticalUnblockLow {
			e.out.event("history", waHistory{Kind: "other", Chats: []waChat{}, Contacts: e.contacts(), Messages: []waMessage{}, Votes: []waVote{}})
		}
	case *events.Connected:
		e.refreshSelf()
		e.end("connected", nil)
		// While listening nothing else asks for the directory, so these pushes are how the store learns the joined
		// groups and the channels.
		go e.joinedGroups()
		go e.followedChannels()
	case *events.Disconnected, *events.KeepAliveTimeout:
		e.out.connection("disconnected", "")
	case *events.KeepAliveRestored:
		e.out.connection("connected", "")
	case *events.LoggedOut:
		e.end("logged_out", loggedOut)
	case *events.StreamReplaced:
		e.end("replaced", replaced)
	case *events.TemporaryBan:
		e.end("banned", bannedFor(evt.Expire, time.Now()))
	case *events.ClientOutdated:
		e.end("outdated", outdated)
	case *events.ConnectFailure:
		switch {
		case evt.Reason == events.ConnectFailureTempBanned:
			e.end("banned", banned)
		case evt.Reason == events.ConnectFailureClientOutdated:
			e.end("outdated", outdated)
		case evt.Reason.IsLoggedOut():
			e.end("logged_out", loggedOut)
		default:
			e.out.connection("disconnected", "")
		}
	}
}

var (
	loggedOut = because("device.logged-out", "authentication_error", "WhatsApp logged this device out")
	replaced  = because("device.replaced", "provider_unavailable",
		"another connection took over this WhatsApp login; WhatsApp allows one per linked device")
	banned   = because("account.banned", "permission_error", "WhatsApp has banned or restricted this account; see the phone")
	outdated = because("client.outdated", "provider_unavailable", "WhatsApp no longer accepts this version of wa; update it")
)

// bannedFor dates the ban's end when WhatsApp gives one, so the CLI's hold on writes ends with it.
func bannedFor(expire time.Duration, now time.Time) *refusal {
	if expire <= 0 {
		return banned
	}
	dated := *banned
	dated.Until = iso(now.Add(expire))
	return &dated
}
