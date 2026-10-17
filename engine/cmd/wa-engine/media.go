package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// waMediaRef is what whatsmeow needs to fetch and decrypt a file again. It is stored with the message as the
// attachment's opaque provider reference, so a download, a transcript or a forward needs no copy of the message.
type waMediaRef struct {
	Media         string `json:"media"` // image, video, audio, document, sticker
	DirectPath    string `json:"directPath"`
	MediaKey      []byte `json:"mediaKey,omitempty"`
	FileSHA256    []byte `json:"fileSha256,omitempty"`
	FileEncSHA256 []byte `json:"fileEncSha256,omitempty"`
}

// waAttachment follows cli-core's Attachment field for field and in its order, so a stored answer prints the same.
type waAttachment struct {
	Kind     string      `json:"kind"`
	URL      string      `json:"url,omitempty"`
	Width    uint32      `json:"width,omitempty"`
	Height   uint32      `json:"height,omitempty"`
	Title    string      `json:"title,omitempty"`
	Name     string      `json:"name,omitempty"`
	Size     uint64      `json:"size,omitempty"`
	Mime     string      `json:"mime,omitempty"`
	Duration uint32      `json:"duration,omitempty"`
	Ref      *waMediaRef `json:"ref,omitempty"`
}

// waUpload is a file on this machine to send. Kind is decided by the CLI, as tg decides it: photo, video, voice
// or document.
type waUpload struct {
	Kind string `json:"kind"`
	Path string `json:"path"`
	Name string `json:"name"`
}

var mediaTypes = map[string]whatsmeow.MediaType{
	"image":    whatsmeow.MediaImage,
	"sticker":  whatsmeow.MediaImage,
	"video":    whatsmeow.MediaVideo,
	"audio":    whatsmeow.MediaAudio,
	"document": whatsmeow.MediaDocument,
}

func refOf(media string, d whatsmeow.DownloadableMessage) *waMediaRef {
	if d.GetDirectPath() == "" {
		return nil
	}
	return &waMediaRef{Media: media, DirectPath: d.GetDirectPath(), MediaKey: d.GetMediaKey(),
		FileSHA256: d.GetFileSHA256(), FileEncSHA256: d.GetFileEncSHA256()}
}

// attachmentsOf lists what a message carries besides its text. A contact card keeps only its name: the vCard holds
// a phone number, and nothing here stores one.
func attachmentsOf(m *waE2E.Message) []waAttachment {
	switch {
	case m == nil:
		return nil
	case m.ImageMessage != nil:
		x := m.GetImageMessage()
		return []waAttachment{{Kind: "photo", Width: x.GetWidth(), Height: x.GetHeight(), Size: x.GetFileLength(),
			Mime: x.GetMimetype(), Ref: refOf("image", x)}}
	case m.VideoMessage != nil, m.PtvMessage != nil:
		x := m.GetVideoMessage()
		if x == nil {
			x = m.GetPtvMessage()
		}
		return []waAttachment{{Kind: "video", Width: x.GetWidth(), Height: x.GetHeight(), Size: x.GetFileLength(),
			Mime: x.GetMimetype(), Duration: x.GetSeconds(), Ref: refOf("video", x)}}
	case m.AudioMessage != nil:
		x := m.GetAudioMessage()
		kind := "audio"
		if x.GetPTT() {
			kind = "voice"
		}
		return []waAttachment{{Kind: kind, Size: x.GetFileLength(), Mime: x.GetMimetype(), Duration: x.GetSeconds(),
			Ref: refOf("audio", x)}}
	case m.DocumentMessage != nil:
		x := m.GetDocumentMessage()
		return []waAttachment{{Kind: "document", Name: x.GetFileName(), Size: x.GetFileLength(), Mime: x.GetMimetype(),
			Ref: refOf("document", x)}}
	case m.StickerMessage != nil:
		x := m.GetStickerMessage()
		return []waAttachment{{Kind: "sticker", Width: x.GetWidth(), Height: x.GetHeight(), Size: x.GetFileLength(),
			Mime: x.GetMimetype(), Ref: refOf("sticker", x)}}
	case m.LocationMessage != nil:
		x := m.GetLocationMessage()
		return []waAttachment{location(x.GetDegreesLatitude(), x.GetDegreesLongitude(), x.GetName(), x.GetAddress())}
	case m.LiveLocationMessage != nil:
		x := m.GetLiveLocationMessage()
		return []waAttachment{location(x.GetDegreesLatitude(), x.GetDegreesLongitude(), "", "")}
	case m.ContactMessage != nil:
		return []waAttachment{{Kind: "contact", Name: m.GetContactMessage().GetDisplayName()}}
	case m.ContactsArrayMessage != nil:
		list := []waAttachment{}
		for _, contact := range m.GetContactsArrayMessage().GetContacts() {
			list = append(list, waAttachment{Kind: "contact", Name: contact.GetDisplayName()})
		}
		return list
	}
	return nil
}

func location(lat, lng float64, name, address string) waAttachment {
	title := name
	if title == "" {
		title = address
	}
	return waAttachment{Kind: "location", URL: fmt.Sprintf("geo:%.6f,%.6f", lat, lng), Title: title}
}

// contentOf builds the message that carries a file whose keys are known: one just uploaded, or one stored and now
// forwarded. WhatsApp clients forward by sending the same keys again; nothing is uploaded twice.
func contentOf(a waAttachment, caption string, info *waE2E.ContextInfo) (*waE2E.Message, error) {
	ref := a.Ref
	if ref == nil || ref.DirectPath == "" {
		return nil, &failure{"validation_error", "the store does not hold this file's keys, so it cannot be sent again"}
	}
	length := proto.Uint64(a.Size)
	optional := func(s string) *string {
		if s == "" {
			return nil
		}
		return proto.String(s)
	}
	switch {
	case a.Kind == "photo" && ref.Media == "image":
		return &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
			DirectPath: proto.String(ref.DirectPath), MediaKey: ref.MediaKey, FileSHA256: ref.FileSHA256,
			FileEncSHA256: ref.FileEncSHA256, FileLength: length, Mimetype: optional(a.Mime), Caption: optional(caption),
			Width: nonZero(a.Width), Height: nonZero(a.Height), ContextInfo: info,
		}}, nil
	case a.Kind == "video" && ref.Media == "video":
		return &waE2E.Message{VideoMessage: &waE2E.VideoMessage{
			DirectPath: proto.String(ref.DirectPath), MediaKey: ref.MediaKey, FileSHA256: ref.FileSHA256,
			FileEncSHA256: ref.FileEncSHA256, FileLength: length, Mimetype: optional(a.Mime), Caption: optional(caption),
			Width: nonZero(a.Width), Height: nonZero(a.Height), Seconds: nonZero(a.Duration), ContextInfo: info,
		}}, nil
	case (a.Kind == "voice" || a.Kind == "audio") && ref.Media == "audio":
		if caption != "" {
			return nil, &failure{"validation_error", "WhatsApp sends a voice or audio message without text"}
		}
		return &waE2E.Message{AudioMessage: &waE2E.AudioMessage{
			DirectPath: proto.String(ref.DirectPath), MediaKey: ref.MediaKey, FileSHA256: ref.FileSHA256,
			FileEncSHA256: ref.FileEncSHA256, FileLength: length, Mimetype: optional(a.Mime),
			Seconds: nonZero(a.Duration), PTT: proto.Bool(a.Kind == "voice"), ContextInfo: info,
		}}, nil
	case a.Kind == "document" && ref.Media == "document":
		return &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{
			DirectPath: proto.String(ref.DirectPath), MediaKey: ref.MediaKey, FileSHA256: ref.FileSHA256,
			FileEncSHA256: ref.FileEncSHA256, FileLength: length, Mimetype: optional(a.Mime), Caption: optional(caption),
			FileName: optional(a.Name), Title: optional(a.Name), ContextInfo: info,
		}}, nil
	case a.Kind == "sticker" && ref.Media == "sticker":
		if caption != "" {
			return nil, &failure{"validation_error", "WhatsApp sends a sticker without text"}
		}
		return &waE2E.Message{StickerMessage: &waE2E.StickerMessage{
			DirectPath: proto.String(ref.DirectPath), MediaKey: ref.MediaKey, FileSHA256: ref.FileSHA256,
			FileEncSHA256: ref.FileEncSHA256, FileLength: length, Mimetype: optional(a.Mime),
			Width: nonZero(a.Width), Height: nonZero(a.Height), ContextInfo: info,
		}}, nil
	}
	return nil, &failure{"validation_error", "this kind of attachment cannot be sent again"}
}

func nonZero(n uint32) *uint32 {
	if n == 0 {
		return nil
	}
	return proto.Uint32(n)
}

func (e *engine) recipient(raw, sendID string) (types.JID, error) {
	to, err := types.ParseJID(raw)
	if err != nil || to.User == "" {
		return types.JID{}, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if to.Server == types.NewsletterServer {
		return types.JID{}, &failure{"validation_error", "sending files to channels is not supported yet"}
	}
	if sendID == "" {
		return types.JID{}, &failure{"validation_error", "a send needs its message id"}
	}
	return to, nil
}

// sendMedia uploads one file and sends it. The upload comes first: a failure there means nothing was sent.
func (e *engine) sendMedia(req request) (*waMessage, error) {
	to, err := e.recipient(req.Chat, req.SendID)
	if err != nil {
		return nil, err
	}
	upload := req.File
	if upload == nil || !filepath.IsAbs(upload.Path) {
		return nil, &failure{"validation_error", "a file to send needs its absolute path"}
	}
	file, err := os.Open(upload.Path)
	if err != nil {
		return nil, &failure{"validation_error", "the file to send could not be opened"}
	}
	defer file.Close()
	described, media, err := describe(file, *upload)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	uploaded, err := e.client.UploadReader(e.ctx, file, nil, mediaTypes[media])
	if err != nil {
		return nil, err
	}
	described.Size = uploaded.FileLength
	described.Ref = &waMediaRef{Media: media, DirectPath: uploaded.DirectPath, MediaKey: uploaded.MediaKey,
		FileSHA256: uploaded.FileSHA256, FileEncSHA256: uploaded.FileEncSHA256}
	content, err := contentOf(described, req.Text, e.replyContext(req))
	if err != nil {
		return nil, err
	}
	return e.post(to, req.SendID, content, req.Text, req.ReplyTo)
}

var uploadKinds = map[string]struct{ kind, media string }{
	"photo":    {"photo", "image"},
	"video":    {"video", "video"},
	"voice":    {"voice", "audio"},
	"document": {"document", "document"},
}

// describe reads what the recipient's app shows before the download: the type, a picture's size, a voice's length.
func describe(file *os.File, upload waUpload) (waAttachment, string, error) {
	kind, ok := uploadKinds[upload.Kind]
	if !ok {
		return waAttachment{}, "", &failure{"validation_error", "the engine cannot send this kind of file"}
	}
	info, err := file.Stat()
	if err != nil || info.IsDir() {
		return waAttachment{}, "", &failure{"validation_error", "the file to send could not be read"}
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	a := waAttachment{Kind: kind.kind, Mime: mimeOf(upload.Name, head[:n])}
	switch kind.kind {
	case "voice":
		a.Mime = "audio/ogg; codecs=opus"
		a.Duration = oggSeconds(file, info.Size())
	case "photo":
		if _, err := file.Seek(0, io.SeekStart); err == nil {
			if config, _, err := image.DecodeConfig(file); err == nil {
				a.Width, a.Height = uint32(config.Width), uint32(config.Height)
			}
		}
	case "document":
		a.Name = upload.Name
	}
	return a, kind.media, nil
}

func mimeOf(name string, head []byte) string {
	if byName := mime.TypeByExtension(strings.ToLower(filepath.Ext(name))); byName != "" {
		return byName
	}
	return http.DetectContentType(head)
}

// oggSeconds reads a voice note's length from its last Ogg page: Opus counts its granule position at 48 kHz.
func oggSeconds(file *os.File, size int64) uint32 {
	start := max(size-64*1024, 0)
	tail := make([]byte, size-start)
	if _, err := file.ReadAt(tail, start); err != nil && !errors.Is(err, io.EOF) {
		return 0
	}
	at := bytes.LastIndex(tail, []byte("OggS"))
	if at < 0 || at+14 > len(tail) {
		return 0
	}
	granule := binary.LittleEndian.Uint64(tail[at+6 : at+14])
	return uint32((granule + 24000) / 48000)
}

// forward sends a stored message again, marked forwarded. The CLI sends what its store holds; a file whose keys
// it does not hold is refused there, before anything reaches WhatsApp.
func (e *engine) forward(req request) (*waMessage, error) {
	to, err := e.recipient(req.Chat, req.SendID)
	if err != nil {
		return nil, err
	}
	info := &waE2E.ContextInfo{IsForwarded: proto.Bool(true), ForwardingScore: proto.Uint32(1)}
	content := &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{Text: proto.String(req.Text), ContextInfo: info}}
	if req.Attachment != nil {
		if content, err = contentOf(*req.Attachment, req.Text, info); err != nil {
			return nil, err
		}
	} else if req.Text == "" {
		return nil, &failure{"validation_error", "the message has nothing to forward"}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	return e.post(to, req.SendID, content, req.Text, "")
}

func (e *engine) post(to types.JID, sendID string, content *waE2E.Message, text, replyTo string) (*waMessage, error) {
	sent, err := e.client.SendMessage(e.ctx, to, content, whatsmeow.SendRequestExtra{ID: sendID})
	if err != nil {
		return nil, err
	}
	message := &waMessage{
		ID:          sent.ID,
		Chat:        e.conv.canonical(to, nil).String(),
		FromMe:      true,
		Timestamp:   iso(sent.Timestamp),
		Text:        text,
		ReplyTo:     str(replyTo),
		Attachments: attachmentsOf(content),
	}
	if me, _ := e.me(); me != nil {
		message.Sender = &me.JID
		message.SenderName = me.Name
	}
	return message, nil
}

// download writes one stored file to the path the CLI chose, created here and readable by this user alone.
func (e *engine) download(req request) error {
	if req.Attachment == nil || req.Attachment.Ref == nil || req.Attachment.Ref.DirectPath == "" {
		return &failure{"validation_error", "the store does not hold this file's keys"}
	}
	ref := req.Attachment.Ref
	media, ok := mediaTypes[ref.Media]
	if !ok {
		return &failure{"validation_error", "the engine cannot download this kind of file"}
	}
	if !filepath.IsAbs(req.Path) {
		return &failure{"validation_error", "a download needs an absolute path to write to"}
	}
	if err := e.connect(); err != nil {
		return err
	}
	file, err := os.OpenFile(req.Path, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return &failure{"validation_error", "the download could not create its file"}
	}
	mediaKey := ref.MediaKey
	if ref.FileEncSHA256 == nil {
		mediaKey = nil
	}
	err = e.client.DownloadMediaWithPathToFile(e.ctx, ref.DirectPath, ref.FileEncSHA256, ref.FileSHA256, mediaKey,
		media, "", false, file)
	closeErr := file.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		_ = os.Remove(req.Path)
		return mediaFailure(err)
	}
	return nil
}

func mediaFailure(err error) error {
	switch {
	case errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith404), errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith410):
		return &failure{"not_found", "WhatsApp no longer keeps this file; ask the sender to send it again"}
	case errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith403):
		return &failure{"permission_error", "WhatsApp refused this file's download"}
	case errors.Is(err, whatsmeow.ErrInvalidMediaSHA256), errors.Is(err, whatsmeow.ErrInvalidMediaHMAC),
		errors.Is(err, whatsmeow.ErrInvalidMediaEncSHA256):
		return &failure{"provider_error", "the downloaded file did not match its checksum"}
	}
	return err
}
