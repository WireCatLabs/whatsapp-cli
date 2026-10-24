package main

import (
	"errors"
	"testing"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func encryptedComment(chat types.JID, post string) *events.Message {
	return incoming(chat, annLID, &waE2E.Message{EncCommentMessage: &waE2E.EncCommentMessage{
		TargetMessageKey: &waCommon.MessageKey{ID: proto.String(post), RemoteJID: proto.String(chat.String())},
	}})
}

func TestDecryptedCommunityCommentKeepsItsOwnIDAndPostThread(t *testing.T) {
	c := testConverter()
	c.decryptComment = func(*events.Message) (*waE2E.Message, error) { return text("synthetic comment"), nil }
	evt := encryptedComment(group, "POST")
	got, ok := c.message(evt, nil)
	if !ok || got.kind != "message" || got.message.ID != evt.Info.ID || got.message.Thread != "POST" ||
		got.message.ReplyTo == nil || *got.message.ReplyTo != "POST" || got.message.Chat != group.String() {
		t.Fatalf("unexpected comment: %+v, %v", got, ok)
	}
	if evt.Message.GetEncCommentMessage() == nil {
		t.Fatal("mutated original encrypted event")
	}
	c.decryptComment = func(*events.Message) (*waE2E.Message, error) { return nil, errors.New("missing secret") }
	if _, ok := c.message(evt, nil); ok {
		t.Fatal("undecryptable comment became a normal message")
	}
}

func TestCommentRejectsChannelsAndMissingOrCrossChatParents(t *testing.T) {
	c := testConverter()
	c.decryptComment = func(*events.Message) (*waE2E.Message, error) {
		t.Fatal("invalid comment reached decryptor")
		return nil, nil
	}
	mismatch := encryptedComment(group, "POST")
	mismatch.Message.EncCommentMessage.TargetMessageKey.RemoteJID = proto.String("120363000000000099@g.us")
	for _, evt := range []*events.Message{encryptedComment(types.NewJID("100000000000001", types.NewsletterServer), "POST"), encryptedComment(group, ""), mismatch} {
		if _, ok := c.message(evt, nil); ok {
			t.Fatal("invalid comment accepted")
		}
	}
}
