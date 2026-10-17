package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"
)

var (
	syntheticKey = bytes.Repeat([]byte{1}, 32)
	syntheticSum = bytes.Repeat([]byte{2}, 32)
	syntheticEnc = bytes.Repeat([]byte{3}, 32)
)

func ref(media string) *waMediaRef {
	return &waMediaRef{Media: media, DirectPath: "/v/t62/synthetic", MediaKey: syntheticKey, FileSHA256: syntheticSum,
		FileEncSHA256: syntheticEnc}
}

func TestAttachmentsOfEachKind(t *testing.T) {
	path, key, sum, enc := proto.String("/v/t62/synthetic"), syntheticKey, syntheticSum, syntheticEnc
	cases := []struct {
		name string
		in   *waE2E.Message
		want []waAttachment
	}{
		{"a photo", &waE2E.Message{ImageMessage: &waE2E.ImageMessage{DirectPath: path, MediaKey: key, FileSHA256: sum,
			FileEncSHA256: enc, FileLength: proto.Uint64(1200), Mimetype: proto.String("image/jpeg"), Width: proto.Uint32(640),
			Height: proto.Uint32(480), Caption: proto.String("caption")}},
			[]waAttachment{{Kind: "photo", Width: 640, Height: 480, Size: 1200, Mime: "image/jpeg", Ref: ref("image")}}},
		{"a voice note", &waE2E.Message{AudioMessage: &waE2E.AudioMessage{DirectPath: path, MediaKey: key, FileSHA256: sum,
			FileEncSHA256: enc, FileLength: proto.Uint64(900), Mimetype: proto.String("audio/ogg; codecs=opus"),
			Seconds: proto.Uint32(7), PTT: proto.Bool(true)}},
			[]waAttachment{{Kind: "voice", Size: 900, Mime: "audio/ogg; codecs=opus", Duration: 7, Ref: ref("audio")}}},
		{"an audio file", &waE2E.Message{AudioMessage: &waE2E.AudioMessage{DirectPath: path, MediaKey: key,
			FileSHA256: sum, FileEncSHA256: enc, Mimetype: proto.String("audio/mpeg")}},
			[]waAttachment{{Kind: "audio", Mime: "audio/mpeg", Ref: ref("audio")}}},
		{"a video note", &waE2E.Message{PtvMessage: &waE2E.VideoMessage{DirectPath: path, MediaKey: key, FileSHA256: sum,
			FileEncSHA256: enc, Seconds: proto.Uint32(12), Mimetype: proto.String("video/mp4")}},
			[]waAttachment{{Kind: "video", Mime: "video/mp4", Duration: 12, Ref: ref("video")}}},
		{"a document", &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{DirectPath: path, MediaKey: key,
			FileSHA256: sum, FileEncSHA256: enc, FileName: proto.String("report.pdf"), Mimetype: proto.String("application/pdf"),
			FileLength: proto.Uint64(5000)}},
			[]waAttachment{{Kind: "document", Name: "report.pdf", Size: 5000, Mime: "application/pdf", Ref: ref("document")}}},
		{"a sticker", &waE2E.Message{StickerMessage: &waE2E.StickerMessage{DirectPath: path, MediaKey: key,
			FileSHA256: sum, FileEncSHA256: enc, Mimetype: proto.String("image/webp"), Width: proto.Uint32(512),
			Height: proto.Uint32(512)}},
			[]waAttachment{{Kind: "sticker", Width: 512, Height: 512, Mime: "image/webp", Ref: ref("sticker")}}},
		{"a place", &waE2E.Message{LocationMessage: &waE2E.LocationMessage{DegreesLatitude: proto.Float64(39.47),
			DegreesLongitude: proto.Float64(-0.376), Name: proto.String("Synthetic Square")}},
			[]waAttachment{{Kind: "location", URL: "geo:39.470000,-0.376000", Title: "Synthetic Square"}}},
		{"a contact card keeps its name, never the vCard", &waE2E.Message{ContactMessage: &waE2E.ContactMessage{
			DisplayName: proto.String("Ann Lee"), Vcard: proto.String("BEGIN:VCARD\nTEL:+00000\nEND:VCARD")}},
			[]waAttachment{{Kind: "contact", Name: "Ann Lee"}}},
		{"a file whose keys never came has no ref", &waE2E.Message{ImageMessage: &waE2E.ImageMessage{}},
			[]waAttachment{{Kind: "photo"}}},
		{"plain text has none", text("hi"), nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := attachmentsOf(tc.in); !reflect.DeepEqual(got, tc.want) {
				t.Errorf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestAMessageCarriesItsAttachments(t *testing.T) {
	content := &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{FileName: proto.String("a.pdf"),
		Caption: proto.String("see attached")}}
	changed, ok := testConverter().message(incoming(annLID, annLID, content), nil)
	if !ok || changed.message.Text != "see attached" || len(changed.message.Attachments) != 1 ||
		changed.message.Attachments[0].Name != "a.pdf" {
		t.Fatalf("got %+v", changed.message)
	}
}

func TestContentOfSendsTheStoredKeysAgain(t *testing.T) {
	forwarded := &waE2E.ContextInfo{IsForwarded: proto.Bool(true), ForwardingScore: proto.Uint32(1)}
	for _, a := range []waAttachment{
		{Kind: "photo", Width: 640, Height: 480, Size: 1200, Mime: "image/jpeg", Ref: ref("image")},
		{Kind: "video", Size: 3000, Mime: "video/mp4", Duration: 4, Ref: ref("video")},
		{Kind: "voice", Size: 900, Mime: "audio/ogg; codecs=opus", Duration: 7, Ref: ref("audio")},
		{Kind: "document", Name: "report.pdf", Size: 5000, Mime: "application/pdf", Ref: ref("document")},
		{Kind: "sticker", Width: 512, Height: 512, Mime: "image/webp", Ref: ref("sticker")},
	} {
		caption := ""
		if a.Kind == "photo" || a.Kind == "video" || a.Kind == "document" {
			caption = "synthetic caption"
		}
		content, err := contentOf(a, caption, forwarded)
		if err != nil {
			t.Fatalf("%s: %v", a.Kind, err)
		}
		if got := attachmentsOf(content); !reflect.DeepEqual(got, []waAttachment{a}) {
			t.Errorf("%s: got %+v", a.Kind, got)
		}
		if text, _ := textOf(content); text != caption {
			t.Errorf("%s: caption %q", a.Kind, text)
		}
	}
}

func TestContentOfRefusesWhatItCannotRebuild(t *testing.T) {
	for _, a := range []waAttachment{
		{Kind: "photo"},
		{Kind: "location", URL: "geo:0,0"},
		{Kind: "photo", Ref: ref("audio")},
	} {
		if _, err := contentOf(a, "", nil); err == nil {
			t.Errorf("%+v was rebuilt", a)
		}
	}
	if _, err := contentOf(waAttachment{Kind: "voice", Ref: ref("audio")}, "words", nil); err == nil {
		t.Error("a voice note took a caption")
	}
}

func TestDescribeReadsWhatTheRecipientSeesFirst(t *testing.T) {
	dir := t.TempDir()
	picture := filepath.Join(dir, "synthetic.png")
	var encoded bytes.Buffer
	_ = png.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 3, 2)))
	_ = os.WriteFile(picture, encoded.Bytes(), 0o600)
	file, _ := os.Open(picture)
	defer file.Close()
	a, media, err := describe(file, waUpload{Kind: "photo", Path: picture, Name: "synthetic.png"})
	if err != nil || media != "image" || a.Kind != "photo" || a.Mime != "image/png" || a.Width != 3 || a.Height != 2 {
		t.Fatalf("got %+v %q %v", a, media, err)
	}

	voice := filepath.Join(dir, "synthetic.ogg")
	page := append([]byte("OggS\x00\x04"), make([]byte, 8)...)
	binary.LittleEndian.PutUint64(page[6:], 48000*5)
	_ = os.WriteFile(voice, append(bytes.Repeat([]byte{0}, 100), page...), 0o600)
	file2, _ := os.Open(voice)
	defer file2.Close()
	a, media, err = describe(file2, waUpload{Kind: "voice", Path: voice, Name: "synthetic.ogg"})
	if err != nil || media != "audio" || a.Kind != "voice" || a.Duration != 5 || a.Mime != "audio/ogg; codecs=opus" {
		t.Fatalf("got %+v %q %v", a, media, err)
	}

	if _, _, err := describe(file, waUpload{Kind: "album"}); err == nil {
		t.Error("an unknown kind was described")
	}
}
