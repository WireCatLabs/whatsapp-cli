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

const syntheticVCard = "BEGIN:VCARD\nVERSION:3.0\nFN:Ann Lee\nTEL:+00 000 000 0001\nEND:VCARD"

var (
	syntheticPlace = &waPlace{Latitude: 39.47, Longitude: -0.376, Name: "Synthetic Square"}
	syntheticCard  = &waCard{Name: "Ann Lee", VCard: syntheticVCard}
)

func ref(media string) *waMediaRef {
	return &waMediaRef{Media: media, DirectPath: "/v/t62/synthetic", MediaKey: syntheticKey, FileSHA256: syntheticSum,
		FileEncSHA256: syntheticEnc}
}

// uploaded is a ref as an upload or a phone's message leaves it: with the URL and the key's time.
func uploaded(media string) *waMediaRef {
	r := ref(media)
	r.URL, r.MediaKeyTimestamp = "https://mmg.whatsapp.net/v/t62/synthetic&mms3=true", 1760000000
	return r
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
		{"a photo keeps its URL and its key's time", &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
			URL: proto.String(uploaded("image").URL), DirectPath: path, MediaKey: key, MediaKeyTimestamp: proto.Int64(1760000000),
			FileSHA256: sum, FileEncSHA256: enc}},
			[]waAttachment{{Kind: "photo", Ref: uploaded("image")}}},
		{"a captioned document as WhatsApp's apps wrap it", &waE2E.Message{DocumentWithCaptionMessage: &waE2E.FutureProofMessage{
			Message: &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{DirectPath: path, MediaKey: key,
				FileSHA256: sum, FileEncSHA256: enc, FileName: proto.String("report.pdf"), Caption: proto.String("caption")}}}},
			[]waAttachment{{Kind: "document", Name: "report.pdf", Ref: ref("document")}}},
		{"a place", &waE2E.Message{LocationMessage: &waE2E.LocationMessage{DegreesLatitude: proto.Float64(39.47),
			DegreesLongitude: proto.Float64(-0.376), Name: proto.String("Synthetic Square")}},
			[]waAttachment{{Kind: "location", URL: "geo:39.470000,-0.376000", Title: "Synthetic Square",
				Ref: &waMediaRef{Place: syntheticPlace}}}},
		{"a contact card keeps its vCard in the ref, which cli-core never prints", &waE2E.Message{
			ContactMessage: &waE2E.ContactMessage{DisplayName: proto.String("Ann Lee"), Vcard: proto.String(syntheticVCard)}},
			[]waAttachment{{Kind: "contact", Name: "Ann Lee", Ref: &waMediaRef{Card: syntheticCard}}}},
		{"a live location is not sent again", &waE2E.Message{LiveLocationMessage: &waE2E.LiveLocationMessage{
			DegreesLatitude: proto.Float64(39.47), DegreesLongitude: proto.Float64(-0.376)}},
			[]waAttachment{{Kind: "location", URL: "geo:39.470000,-0.376000"}}},
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

func TestAViewOnceFileKeepsNoKeys(t *testing.T) {
	content := &waE2E.Message{ImageMessage: &waE2E.ImageMessage{DirectPath: proto.String("/v/t62/synthetic"),
		MediaKey: syntheticKey, FileSHA256: syntheticSum, FileEncSHA256: syntheticEnc}}
	evt := incoming(annLID, annLID, content)
	evt.IsViewOnce = true
	changed, ok := testConverter().message(evt, nil)
	if !ok || len(changed.message.Attachments) != 1 || changed.message.Attachments[0].Ref != nil {
		t.Fatalf("got %+v", changed.message.Attachments)
	}
}

func TestContentOfSendsTheStoredKeysAgain(t *testing.T) {
	forwarded := &waE2E.ContextInfo{IsForwarded: proto.Bool(true), ForwardingScore: proto.Uint32(1)}
	for _, a := range []waAttachment{
		{Kind: "photo", Width: 640, Height: 480, Size: 1200, Mime: "image/jpeg", Ref: uploaded("image")},
		{Kind: "video", Size: 3000, Mime: "video/mp4", Duration: 4, Ref: uploaded("video")},
		{Kind: "voice", Size: 900, Mime: "audio/ogg; codecs=opus", Duration: 7, Ref: uploaded("audio")},
		{Kind: "document", Name: "report.pdf", Size: 5000, Mime: "application/pdf", Ref: uploaded("document")},
		{Kind: "sticker", Width: 512, Height: 512, Mime: "image/webp", Ref: uploaded("sticker")},
		{Kind: "location", URL: "geo:39.470000,-0.376000", Title: "Synthetic Square", Ref: &waMediaRef{Place: &waPlace{
			Latitude: 39.47, Longitude: -0.376, Name: "Synthetic Square", Address: "1 Synthetic St", URL: "https://example.com"}}},
		{Kind: "contact", Name: "Ann Lee", Ref: &waMediaRef{Card: syntheticCard}},
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
		if wrapped := content.GetDocumentWithCaptionMessage(); wrapped != nil {
			content = wrapped.GetMessage()
		}
		if text, _ := textOf(content); text != caption {
			t.Errorf("%s: caption %q", a.Kind, text)
		}
	}
}

func TestAStoredFileWithoutItsURLGetsOneBuiltFromItsPath(t *testing.T) {
	content, err := contentOf(waAttachment{Kind: "photo", Ref: ref("image")}, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	image := content.GetImageMessage()
	if image.GetURL() != "https://mmg.whatsapp.net/v/t62/synthetic" || image.MediaKeyTimestamp != nil {
		t.Errorf("got URL %q, key time %v", image.GetURL(), image.MediaKeyTimestamp)
	}
}

func TestACaptionedDocumentGoesWrappedAndABareOneDoesNot(t *testing.T) {
	a := waAttachment{Kind: "document", Name: "report.pdf", Ref: uploaded("document")}
	captioned, _ := contentOf(a, "synthetic caption", nil)
	if captioned.DocumentMessage != nil ||
		captioned.GetDocumentWithCaptionMessage().GetMessage().GetDocumentMessage().GetCaption() != "synthetic caption" {
		t.Errorf("captioned: %+v", captioned)
	}
	bare, _ := contentOf(a, "", nil)
	if bare.GetDocumentMessage().GetURL() != uploaded("document").URL || bare.DocumentWithCaptionMessage != nil {
		t.Errorf("bare: %+v", bare)
	}
}

func TestContentOfRefusesWhatItCannotRebuild(t *testing.T) {
	for _, a := range []waAttachment{
		{Kind: "photo"},
		{Kind: "location", URL: "geo:0,0"},
		{Kind: "photo", Ref: ref("audio")},
		{Kind: "location", Ref: &waMediaRef{Card: syntheticCard}},
		{Kind: "contact", Name: "Ann Lee", Ref: &waMediaRef{Card: &waCard{Name: "Ann Lee"}}},
	} {
		if _, err := contentOf(a, "", nil); err == nil {
			t.Errorf("%+v was rebuilt", a)
		}
	}
	if _, err := contentOf(waAttachment{Kind: "voice", Ref: ref("audio")}, "words", nil); err == nil {
		t.Error("a voice note took a caption")
	}
	if _, err := contentOf(waAttachment{Kind: "location", Ref: &waMediaRef{Place: syntheticPlace}}, "words", nil); err == nil {
		t.Error("a place took a caption")
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

func syntheticWebP(chunk string, body []byte) []byte {
	head := append([]byte("RIFF\x00\x00\x00\x00WEBP"+chunk+"\x00\x00\x00\x00"), body...)
	return append(head, make([]byte, 16)...)
}

func TestAStickerFileIsSentAsAStickerMessage(t *testing.T) {
	path := filepath.Join(t.TempDir(), "synthetic.webp")
	canvas := []byte{0x10, 0, 0, 0, 0xff, 0x01, 0, 0xff, 0x01, 0}
	_ = os.WriteFile(path, syntheticWebP("VP8X", canvas), 0o600)
	s, err := stage(&waUpload{Kind: "sticker", Path: path, Name: "synthetic.webp"})
	if err != nil {
		t.Fatal(err)
	}
	defer s.file.Close()
	if s.media != "sticker" || s.described.Kind != "sticker" || s.described.Mime != "image/webp" ||
		s.described.Width != 512 || s.described.Height != 512 {
		t.Fatalf("staged %+v as %q", s.described, s.media)
	}
	if mediaTypes[s.media] != mediaTypes["image"] {
		t.Error("a sticker is not uploaded as an image")
	}
	s.described.Ref = ref(s.media)
	content, err := contentOf(s.described, "", nil)
	sticker := content.GetStickerMessage()
	if err != nil || sticker == nil || sticker.GetMimetype() != "image/webp" || sticker.GetWidth() != 512 ||
		sticker.GetDirectPath() != "/v/t62/synthetic" {
		t.Fatalf("got %v %v", content, err)
	}
	if _, err := contentOf(s.described, "words", nil); err == nil {
		t.Error("a sticker took a caption")
	}
}

func TestWebPSizeReadsEachKindOfFirstChunk(t *testing.T) {
	lossless := []byte{0x2f, 0, 0, 0, 0}
	binary.LittleEndian.PutUint32(lossless[1:], 299|199<<14)
	lossy := []byte{0, 0, 0, 0x9d, 0x01, 0x2a, 0, 0, 0, 0}
	binary.LittleEndian.PutUint16(lossy[6:], 320)
	binary.LittleEndian.PutUint16(lossy[8:], 240)
	for _, c := range []struct {
		name          string
		head          []byte
		width, height uint32
	}{
		{"lossless", syntheticWebP("VP8L", lossless), 300, 200},
		{"lossy", syntheticWebP("VP8 ", lossy), 320, 240},
		{"not a WebP", bytes.Repeat([]byte{0}, 64), 0, 0},
		{"too short", []byte("RIFF"), 0, 0},
	} {
		if w, h := webpSize(c.head); w != c.width || h != c.height {
			t.Errorf("%s: got %dx%d", c.name, w, h)
		}
	}
}

func TestWebPSizeNeverReadsPastATruncatedOrHostileHead(t *testing.T) {
	lossless := []byte{0x2f, 0xff, 0xff, 0xff, 0xff}
	lossy := []byte{0, 0, 0, 0x9d, 0x01, 0x2a, 0xff, 0xff, 0xff, 0xff}
	for _, whole := range [][]byte{
		syntheticWebP("VP8X", bytes.Repeat([]byte{0xff}, 10)),
		syntheticWebP("VP8L", lossless),
		syntheticWebP("VP8 ", lossy),
	} {
		for n := range len(whole) + 1 {
			webpSize(whole[:n])
			corrupt := bytes.Clone(whole[:n])
			for i := 12; i < len(corrupt); i++ {
				corrupt[i] ^= 0xff
				webpSize(corrupt)
			}
		}
	}
}
