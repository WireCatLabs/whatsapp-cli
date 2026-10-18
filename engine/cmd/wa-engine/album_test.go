package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"regexp"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
)

func TestAlbumIDsKeepTheSendIDFirstAndRepeatTheRest(t *testing.T) {
	parent, ids := albumIDs("3EB0AAAAAAAAAAAAAAAAAA", 3)
	again, repeated := albumIDs("3EB0AAAAAAAAAAAAAAAAAA", 3)
	if parent != again || !equalIDs(ids, repeated) {
		t.Fatalf("a repeat derived other ids: %s %v, then %s %v", parent, ids, again, repeated)
	}
	if ids[0] != "3EB0AAAAAAAAAAAAAAAAAA" || len(ids) != 3 {
		t.Fatalf("ids = %v, want the send id first and three in all", ids)
	}
	shape := regexp.MustCompile(`^3EB0[0-9A-F]{18}$`)
	seen := map[string]bool{ids[0]: true}
	for _, id := range append([]string{parent}, ids[1:]...) {
		if !shape.MatchString(id) || seen[id] {
			t.Fatalf("id %q is not a fresh id in whatsmeow's form", id)
		}
		seen[id] = true
	}
	if other, _ := albumIDs("3EB0BBBBBBBBBBBBBBBBBB", 3); other == parent {
		t.Fatal("two sends derived the same album id")
	}
}

func equalIDs(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestAlbumAnnouncesItsPhotosAndVideosAndEachFilePointsAtIt(t *testing.T) {
	album := albumOf([]*staged{{media: "image"}, {media: "video"}, {media: "image"}}).GetAlbumMessage()
	if album.GetExpectedImageCount() != 2 || album.GetExpectedVideoCount() != 1 {
		t.Fatalf("album = %v, want two images and one video", album)
	}
	if photos := albumOf([]*staged{{media: "image"}, {media: "image"}}).GetAlbumMessage(); photos.ExpectedVideoCount != nil {
		t.Fatalf("an album of photos announced videos: %v", photos)
	}
	chat := types.NewJID("100000000000001", types.HiddenUserServer)
	association := inAlbum(chat, "3EB0CCCCCCCCCCCCCCCCCC").GetMessageAssociation()
	key := association.GetParentMessageKey()
	if association.GetAssociationType() != waE2E.MessageAssociation_MEDIA_ALBUM || key.GetID() != "3EB0CCCCCCCCCCCCCCCCCC" ||
		!key.GetFromMe() || key.GetRemoteJID() != chat.String() {
		t.Fatalf("association = %v", association)
	}
}

func TestThumbnailFitsTheLongerSideAndDecodesAsJPEG(t *testing.T) {
	wide := image.NewRGBA(image.Rect(0, 0, 400, 200))
	got := decoded(t, thumbnail(wide))
	if b := got.Bounds(); b.Dx() != thumbnailSide || b.Dy() != thumbnailSide/2 {
		t.Fatalf("thumbnail is %v, want %dx%d", b, thumbnailSide, thumbnailSide/2)
	}
	small := decoded(t, thumbnail(image.NewRGBA(image.Rect(0, 0, 10, 30))))
	if b := small.Bounds(); b.Dx() != 10 || b.Dy() != 30 {
		t.Fatalf("a small picture was resized to %v", b)
	}
}

func TestThumbnailLaysTransparencyOverWhite(t *testing.T) {
	transparent := image.NewNRGBA(image.Rect(0, 0, 100, 100))
	r, g, b, _ := decoded(t, thumbnail(transparent)).At(36, 36).RGBA()
	if r < 0xf000 || g < 0xf000 || b < 0xf000 {
		t.Fatalf("a transparent picture's thumbnail is %x %x %x, want white", r, g, b)
	}
}

func TestThumbnailOfAPhotoOnDiskAndNoneForWhatCannotBeDecoded(t *testing.T) {
	picture := image.NewRGBA(image.Rect(0, 0, 300, 300))
	picture.Set(0, 0, color.RGBA{R: 255, A: 255})
	var file bytes.Buffer
	if err := png.Encode(&file, picture); err != nil {
		t.Fatal(err)
	}
	reader := bytes.NewReader(file.Bytes())
	config, _, err := image.DecodeConfig(reader)
	if err != nil {
		t.Fatal(err)
	}
	if thumb := thumbnailOf(reader, config); len(thumb) == 0 {
		t.Fatal("a PNG photo got no thumbnail")
	}
	if thumbnailOf(bytes.NewReader([]byte("RIFF synthetic webp")), image.Config{Width: 10, Height: 10}) != nil {
		t.Fatal("bytes the standard library cannot decode got a thumbnail")
	}
	if thumbnailOf(reader, image.Config{Width: 10_000, Height: 10_000}) != nil {
		t.Fatal("a picture above the pixel cap was decoded")
	}
}

func TestTheThumbnailGoesInTheMessageAndNeverOnTheWire(t *testing.T) {
	photo := waAttachment{Kind: "photo", Mime: "image/jpeg", Ref: ref("image"), thumb: []byte{0xff, 0xd8, 0xff}}
	content, err := contentOf(photo, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(content.GetImageMessage().GetJPEGThumbnail(), photo.thumb) {
		t.Fatal("the photo's message lacks its thumbnail")
	}
	line, err := json.Marshal(photo)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(line, []byte("thumb")) || bytes.Contains(line, []byte("/9j/")) {
		t.Fatalf("the thumbnail reached the JSON line: %s", line)
	}
}

func TestAFailureMidAlbumIsUnknownButKeepsWhatsAppsReason(t *testing.T) {
	if got := classify(partly(&whatsmeow.IQError{Code: 429})); got.Reason != "account.rate-limited" {
		t.Errorf("a rate limit mid-album became %+v", got)
	}
	if got := classify(partly(whatsmeow.ErrNotConnected)); got.Code != "outcome_unknown" || got.Reason != "" {
		t.Errorf("a lost connection mid-album became %+v", got)
	}
}

func decoded(t *testing.T, data []byte) image.Image {
	t.Helper()
	img, err := jpeg.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("not a JPEG: %v", err)
	}
	return img
}
