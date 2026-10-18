package main

import (
	"fmt"
	"testing"

	"go.mau.fi/whatsmeow/types"
)

var channel = types.NewJID("120363000000000001", types.NewsletterServer)

func channelMeta(role types.NewsletterRole) *types.NewsletterMetadata {
	meta := &types.NewsletterMetadata{
		ID: channel,
		ThreadMeta: types.NewsletterThreadMetadata{
			InviteCode:      "FAKE0000000000000000AA",
			Name:            types.NewsletterText{Text: "Synthetic news"},
			Description:     types.NewsletterText{Text: "synthetic description"},
			SubscriberCount: 42,
		},
	}
	if role != "" {
		meta.ViewerMeta = &types.NewsletterViewerMetadata{Role: role}
	}
	return meta
}

func TestChannelWireShape(t *testing.T) {
	assertJSON(t, channelOf(channelMeta(types.NewsletterRoleAdmin)), `{"chat":{"jid":"120363000000000001@newsletter",`+
		`"name":"Synthetic news","kind":"newsletter","unread":null,"lastMessageAt":null,"participants":42},`+
		`"description":"synthetic description","link":"https://whatsapp.com/channel/FAKE0000000000000000AA","role":"admin"}`)
}

func TestChannelWithoutViewerMetadataHasNoRole(t *testing.T) {
	if got := channelOf(channelMeta("")).Role; got != "" {
		t.Fatalf("got role %q", got)
	}
}

func TestChannelPostsKeepTheMessageIDAndTheServerID(t *testing.T) {
	shown := str("Synthetic news")
	posts := []*types.NewsletterMessage{
		{MessageServerID: 101, MessageID: "3EB0000000000000000101", Timestamp: sentAt, Message: text("synthetic post")},
		{MessageServerID: 102, MessageID: "", Timestamp: sentAt, Message: text("no id")},
		{MessageServerID: 103, MessageID: "3EB0000000000000000103", Timestamp: sentAt},
		nil,
	}
	got := testConverter().channelPosts(channel, shown, posts)
	if len(got) != 1 {
		t.Fatalf("got %d posts, want 1: %+v", len(got), got)
	}
	post := got[0]
	if post.ID != "3EB0000000000000000101" || post.ServerID == nil || *post.ServerID != 101 {
		t.Fatalf("got id %q, server id %v", post.ID, post.ServerID)
	}
	if post.Chat != channel.String() || post.Sender == nil || *post.Sender != channel.String() || post.FromMe {
		t.Fatalf("got %+v", post)
	}
	if post.SenderName == nil || *post.SenderName != "Synthetic news" || post.Text != "synthetic post" {
		t.Fatalf("got %+v", post)
	}
}

func TestChannelInviteTakesTheCodeOfAChannelLinkOnly(t *testing.T) {
	cases := map[string]string{
		"https://whatsapp.com/channel/FAKE0000000000000000AA":       "FAKE0000000000000000AA",
		"whatsapp.com/channel/FAKE0000000000000000AA/":              "FAKE0000000000000000AA",
		"https://www.whatsapp.com/channel/FAKE0000000000000000AA?x": "FAKE0000000000000000AA",
		"https://chat.whatsapp.com/FAKE0000000000000000AA":          "",
		"https://whatsapp.com.example/channel/FAKE":                 "",
	}
	for link, want := range cases {
		got := ""
		if match := channelInvite.FindStringSubmatch(link); match != nil {
			got = match[1]
		}
		if got != want {
			t.Errorf("%s: got %q, want %q", link, got, want)
		}
	}
}

func TestASentPostReadsAsTheChannelsWithItsServerID(t *testing.T) {
	e := &engine{chats: map[string]waChat{}, channels: []waChat{channelOf(channelMeta("")).Chat}}
	message := &waMessage{ID: "3EB0000000000000000201", Sender: str(selfLID.String()), FromMe: true}
	e.asChannelPost(message, channel, 201)
	if *message.Sender != channel.String() || *message.SenderName != "Synthetic news" || *message.ServerID != 201 {
		t.Fatalf("got %+v", message)
	}
}

func TestChannelFailureReadsGraphQLCodes(t *testing.T) {
	cases := map[int]string{404: "not_found", 403: "permission_error", 429: "rate_limited", 500: "provider_error"}
	for code, want := range cases {
		err := fmt.Errorf("graphql error: %w", types.GraphQLErrors{{Extensions: types.GraphQLErrorExtensions{ErrorCode: code}}})
		var got *failure
		if failed, ok := channelFailure(err).(*failure); ok {
			got = failed
		}
		if got == nil || got.Code != want {
			t.Errorf("%d: got %+v, want %s", code, got, want)
		}
	}
}
