package main

import (
	"context"
	"errors"
	"io"
	"regexp"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

// WhatsApp channels are whatsmeow's newsletters. Unlike chats, their posts live on WhatsApp's servers, so they are
// read from there, by the server id WhatsApp numbers each post with.

// channelFields are the request fields of the channel requests.
type channelFields struct {
	// channelMessages: the server id to read back from; 0 is the newest post.
	Before int64 `json:"before,omitempty"`
}

// waChannel is a channel in WhatsApp's terms. Role is the account's own in it, "" when WhatsApp did not say.
type waChannel struct {
	Chat        waChat  `json:"chat"`
	Description *string `json:"description"`
	Link        *string `json:"link"`
	Role        string  `json:"role"`
}

type waChannelPage struct {
	Messages []waMessage `json:"messages"`
	More     bool        `json:"more"`
}

// channelPageMax is unverified against WhatsApp: whatsmeow sets no limit, and 50 is what wa asks of the phone.
const channelPageMax = 50

// channelRounds bounds how often one read asks again when a page held only posts the contract skips.
const channelRounds = 3

var channelInvite = regexp.MustCompile(`(?i)^\s*(?:https?://)?(?:www\.)?whatsapp\.com/channel/([A-Za-z0-9]+)/?(?:[?#][^\s]*)?\s*$`)

func (e *engine) dispatchChannels(req request) (any, bool, error) {
	var value any
	var err error
	switch req.Op {
	case "channel":
		value, err = e.channel(req.JID)
	case "channelMessages":
		value, err = e.channelMessages(req.JID, req.Before, req.Count)
	case "followChannel":
		value, err = e.followChannel(req.Link)
	case "unfollowChannel":
		err = e.unfollowChannel(req.JID)
	default:
		return nil, false, nil
	}
	return value, true, channelFailure(err)
}

// channelFailure reads the codes WhatsApp puts in a channel request's GraphQL errors; classify knows only IQ codes.
func channelFailure(err error) error {
	var graph types.GraphQLErrors
	if !errors.As(err, &graph) || len(graph) == 0 {
		return err
	}
	switch graph[0].Extensions.ErrorCode {
	case 400, 404:
		return &failure{"not_found", "WhatsApp has no such channel"}
	case 401, 403:
		return &failure{"permission_error", "WhatsApp refused: not allowed in this channel"}
	case 429:
		return &failure{"rate_limited", "WhatsApp asks to slow down"}
	}
	return &failure{"provider_error", "WhatsApp refused the channel request"}
}

func channelJID(raw string) (types.JID, error) {
	jid, err := types.ParseJID(raw)
	if err != nil || jid.Server != types.NewsletterServer || jid.User == "" {
		return types.JID{}, &failure{"validation_error", "not a WhatsApp channel id (…@newsletter)"}
	}
	return jid, nil
}

func channelLink(code string) *string {
	if code == "" {
		return nil
	}
	return str(whatsmeow.NewsletterLinkPrefix + code)
}

func channelOf(meta *types.NewsletterMetadata) waChannel {
	thread := meta.ThreadMeta
	subscribers := thread.SubscriberCount
	role := ""
	if meta.ViewerMeta != nil {
		role = string(meta.ViewerMeta.Role)
	}
	return waChannel{
		Chat:        waChat{JID: meta.ID.String(), Name: name(thread.Name.Text), Kind: "newsletter", Participants: &subscribers},
		Description: str(thread.Description.Text),
		Link:        channelLink(thread.InviteCode),
		Role:        role,
	}
}

type follows interface {
	IsConnected() bool
	GetSubscribedNewsletters(ctx context.Context) ([]*types.NewsletterMetadata, error)
}

// followedChannels asks WhatsApp once per process, like the joined groups; a failure leaves them out of the directory.
// The first answer also goes out as a history push, so a listening store keeps the channels as chats.
func (e *engine) followedChannels() []waChat {
	e.mu.Lock()
	known, asked := e.channels, e.channels != nil
	e.mu.Unlock()
	if asked || !e.following.IsConnected() {
		return known
	}
	followed, err := e.following.GetSubscribedNewsletters(e.ctx)
	if err != nil {
		return nil
	}
	list := make([]waChat, 0, len(followed))
	for _, meta := range followed {
		if meta != nil {
			list = append(list, channelOf(meta).Chat)
		}
	}
	e.mu.Lock()
	e.channels = list
	e.mu.Unlock()
	e.pushChats(list)
	return list
}

func (e *engine) pushChats(chats []waChat) {
	e.out.event("history", waHistory{Kind: "other", Chats: chats, Contacts: []waContact{}, Messages: []waMessage{}, Votes: []waVote{}})
}

func (e *engine) channelName(jid types.JID) *string {
	e.mu.Lock()
	defer e.mu.Unlock()
	for _, chat := range e.channels {
		if chat.JID == jid.String() {
			return chat.Name
		}
	}
	if chat, ok := e.chats[jid.String()]; ok {
		return chat.Name
	}
	return nil
}

func (e *engine) channel(raw string) (*waChannel, error) {
	jid, err := channelJID(raw)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	meta, err := e.client.GetNewsletterInfo(e.ctx, jid)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		return nil, &failure{"not_found", "WhatsApp has no such channel"}
	}
	channel := channelOf(meta)
	return &channel, nil
}

func (e *engine) channelMessages(raw string, before int64, count int) (*waChannelPage, error) {
	jid, err := channelJID(raw)
	if err != nil {
		return nil, err
	}
	if count <= 0 || count > channelPageMax {
		count = channelPageMax
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	e.followedChannels()
	shown := e.channelName(jid)
	page := &waChannelPage{Messages: []waMessage{}}
	for round := 0; round < channelRounds; round++ {
		posts, err := e.client.GetNewsletterMessages(e.ctx, jid, &whatsmeow.GetNewsletterMessagesParams{
			Count:  count,
			Before: types.MessageServerID(before),
		})
		if err != nil {
			return nil, err
		}
		page.More = len(posts) > 0
		page.Messages = e.conv.channelPosts(jid, shown, posts)
		if len(page.Messages) > 0 || len(posts) == 0 {
			break
		}
		before = int64(oldestServerID(posts))
	}
	if len(page.Messages) == 0 {
		page.More = false
	}
	return page, nil
}

func oldestServerID(posts []*types.NewsletterMessage) types.MessageServerID {
	oldest := posts[0].MessageServerID
	for _, post := range posts {
		if post.MessageServerID < oldest {
			oldest = post.MessageServerID
		}
	}
	return oldest
}

// channelPosts converts the posts as a live message would be, so text and files read the same; the channel is the
// sender. whatsmeow does not say which posts are the account's own, so none is marked so.
func (c *converter) channelPosts(jid types.JID, shown *string, posts []*types.NewsletterMessage) []waMessage {
	out := make([]waMessage, 0, len(posts))
	for _, post := range posts {
		if post == nil || post.Message == nil || post.MessageID == "" {
			continue
		}
		evt := &events.Message{
			Info: types.MessageInfo{
				MessageSource: types.MessageSource{Chat: jid, Sender: jid},
				ID:            post.MessageID,
				ServerID:      post.MessageServerID,
				Timestamp:     post.Timestamp,
			},
			Message: post.Message,
		}
		if message, ok := c.channelPost(evt); ok {
			message.SenderName = shown
			out = append(out, message)
		}
	}
	return out
}

// channelPost is one post as the store keeps it: by its message id, with the server id that reads back from it. An
// edit or deletion in a channel is addressed by the server id alone, which is not mapped yet, so it is passed over.
func (c *converter) channelPost(evt *events.Message) (waMessage, bool) {
	changed, ok := c.message(evt, known{})
	if !ok || changed.kind != "message" || changed.message.ID == "" {
		return waMessage{}, false
	}
	message := changed.message
	if evt.Info.ServerID != 0 {
		id := int64(evt.Info.ServerID)
		message.ServerID = &id
	}
	return message, true
}

func (e *engine) followChannel(link string) (*waChannel, error) {
	match := channelInvite.FindStringSubmatch(link)
	if match == nil {
		return nil, &failure{"validation_error", "not a WhatsApp channel link (whatsapp.com/channel/…)"}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	invited, err := e.client.GetNewsletterInfoWithInvite(e.ctx, match[1])
	if err != nil {
		return nil, err
	}
	if invited == nil {
		return nil, &failure{"not_found", "WhatsApp has no channel by that link"}
	}
	if err := e.client.FollowNewsletter(e.ctx, invited.ID); err != nil {
		return nil, err
	}
	// The invite's answer has no role in it; a read after following has, and a failed one still followed.
	meta, err := e.client.GetNewsletterInfo(e.ctx, invited.ID)
	if err != nil || meta == nil {
		meta = invited
	}
	channel := channelOf(meta)
	e.mu.Lock()
	if e.channels != nil {
		e.channels = append(e.channels, channel.Chat)
	}
	e.chats[channel.Chat.JID] = channel.Chat
	e.mu.Unlock()
	e.pushChats([]waChat{channel.Chat})
	return &channel, nil
}

func (e *engine) unfollowChannel(raw string) error {
	jid, err := channelJID(raw)
	if err != nil {
		return err
	}
	if err := e.connect(); err != nil {
		return err
	}
	if err := e.client.UnfollowNewsletter(e.ctx, jid); err != nil {
		return err
	}
	e.mu.Lock()
	kept := e.channels[:0:0]
	for _, chat := range e.channels {
		if chat.JID != jid.String() {
			kept = append(kept, chat)
		}
	}
	if e.channels != nil {
		e.channels = kept
	}
	e.mu.Unlock()
	return nil
}

// asChannelPost makes a post the account sent read as the posts read back from the channel: the channel is the sender,
// and no post is the account's own, since a read cannot tell and would turn the stored copy back.
func (e *engine) asChannelPost(message *waMessage, jid types.JID, serverID types.MessageServerID) {
	message.FromMe = false
	message.Sender = str(jid.String())
	message.SenderName = e.channelName(jid)
	if serverID != 0 {
		id := int64(serverID)
		message.ServerID = &id
	}
}

// postToChannel uploads and posts one file to a channel. A channel's files go unencrypted (whatsmeow's
// UploadNewsletter): no media key, and the post names the upload by the handle WhatsApp gave it.
func (e *engine) postToChannel(to types.JID, req request, s *staged) (*waMessage, error) {
	if _, err := s.file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	uploaded, err := e.client.UploadNewsletterReader(e.ctx, s.file, mediaTypes[s.media])
	if err != nil {
		return nil, err
	}
	content, err := channelFile(s, uploaded, req.Text)
	if err != nil {
		return nil, err
	}
	extra := whatsmeow.SendRequestExtra{ID: req.SendID, MediaHandle: uploaded.Handle}
	return e.post(to, extra, content, req.Text, "")
}

// channelFile builds a channel post's file as whatsmeow's UploadNewsletter example does: the URL, the direct path and
// the plain file's hash, and no key.
func channelFile(s *staged, uploaded whatsmeow.UploadResponse, caption string) (*waE2E.Message, error) {
	s.described.Size = uploaded.FileLength
	s.described.Ref = &waMediaRef{Media: s.media, DirectPath: uploaded.DirectPath, FileSHA256: uploaded.FileSHA256}
	content, err := contentOf(s.described, caption, nil)
	if err != nil {
		return nil, err
	}
	url := proto.String(uploaded.URL)
	switch {
	case uploaded.URL == "":
	case content.ImageMessage != nil:
		content.ImageMessage.URL = url
	case content.VideoMessage != nil:
		content.VideoMessage.URL = url
	case content.AudioMessage != nil:
		content.AudioMessage.URL = url
	case content.DocumentMessage != nil:
		content.DocumentMessage.URL = url
	}
	return content, nil
}
