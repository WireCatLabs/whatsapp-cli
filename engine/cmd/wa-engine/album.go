package main

import (
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// sendAlbum sends photos and videos as WhatsApp's apps send an album: a message that announces how many, then each
// file as a message of its own tied to it, the caption on the first. Every file is uploaded before anything goes, so
// a failed upload sent nothing. The answer is the first file's message.
func (e *engine) sendAlbum(req request) (*waMessage, error) {
	to, err := e.recipient(req.Chat, req.SendID)
	if err != nil {
		return nil, err
	}
	if len(req.Files) < 2 {
		return nil, &failure{"validation_error", "an album needs two files or more"}
	}
	files := make([]*staged, 0, len(req.Files))
	defer func() {
		for _, s := range files {
			s.file.Close()
		}
	}()
	for i := range req.Files {
		s, err := stage(&req.Files[i])
		if err != nil {
			return nil, err
		}
		files = append(files, s)
		if s.media != "image" && s.media != "video" {
			return nil, &failure{"validation_error", "a WhatsApp album holds photos and videos only; send other files on their own"}
		}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	for _, s := range files {
		if err := e.upload(s); err != nil {
			return nil, err
		}
	}
	parent, ids := albumIDs(req.SendID, len(files))
	if _, err := e.client.SendMessage(e.ctx, to, albumOf(files), whatsmeow.SendRequestExtra{ID: parent}); err != nil {
		return nil, err
	}
	var first *waMessage
	for i, s := range files {
		caption, info, replyTo := "", (*waE2E.ContextInfo)(nil), ""
		if i == 0 {
			caption, info, replyTo = req.Text, e.replyContext(req), req.ReplyTo
		}
		content, err := contentOf(s.described, caption, info)
		if err != nil {
			return nil, partly(err)
		}
		content.MessageContextInfo = inAlbum(to, parent)
		sent, err := e.post(to, whatsmeow.SendRequestExtra{ID: ids[i]}, content, caption, replyTo)
		if err != nil {
			return nil, partly(err)
		}
		if i == 0 {
			first = sent
		}
	}
	return first, nil
}

// albumIDs derives every id of an album from the send's own, in the form whatsmeow's GenerateMessageID makes one:
// a repeat with the same send id sends the same ids, and a recipient drops what already arrived. The first file keeps
// the send id itself, as a single file would.
func albumIDs(sendID string, files int) (string, []string) {
	derive := func(label string) string {
		sum := sha256.Sum256([]byte(sendID + "/" + label))
		return whatsmeow.WebMessageIDPrefix + strings.ToUpper(hex.EncodeToString(sum[:9]))
	}
	ids := []string{sendID}
	for i := 1; i < files; i++ {
		ids = append(ids, derive(strconv.Itoa(i)))
	}
	return derive("album"), ids
}

func albumOf(files []*staged) *waE2E.Message {
	var images, videos uint32
	for _, s := range files {
		if s.media == "image" {
			images++
		} else {
			videos++
		}
	}
	return &waE2E.Message{AlbumMessage: &waE2E.AlbumMessage{ExpectedImageCount: nonZero(images),
		ExpectedVideoCount: nonZero(videos)}}
}

func inAlbum(to types.JID, parent string) *waE2E.MessageContextInfo {
	return &waE2E.MessageContextInfo{MessageAssociation: &waE2E.MessageAssociation{
		AssociationType:  waE2E.MessageAssociation_MEDIA_ALBUM.Enum(),
		ParentMessageKey: &waCommon.MessageKey{RemoteJID: proto.String(to.String()), FromMe: proto.Bool(true), ID: proto.String(parent)},
	}}
}

// partly reports a failure once the album has begun to go out: some files may have arrived, and the same send id
// sends the rest without repeating them. A reason (a ban, a rate limit) is kept, since the CLI holds writes on it.
func partly(err error) error {
	refused := classify(err)
	if refused.Reason != "" {
		return refused
	}
	return &failure{"outcome_unknown", "part of the album may have gone out; repeat the send with the same id to send the rest"}
}
