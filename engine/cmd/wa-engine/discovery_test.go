package main

import (
	"context"
	"errors"
	"testing"

	"go.mau.fi/whatsmeow/types"
)

type previewReader struct {
	group *types.GroupInfo
	err   error
	code  string
}

func (r *previewReader) GetGroupInfoFromLink(_ context.Context, code string) (*types.GroupInfo, error) {
	r.code = code
	return r.group, r.err
}
func (r *previewReader) GetNewsletterInfoWithInvite(context.Context, string) (*types.NewsletterMetadata, error) {
	return nil, r.err
}

func TestInvitePreviewUsesTheServerCountWithoutJoining(t *testing.T) {
	info := groupInfo()
	info.ParticipantCount = 132
	info.Participants = nil
	source := &previewReader{group: info}
	preview, err := inspectInvite(context.Background(), source, "group", "SYNTHETIC")
	if err != nil {
		t.Fatal(err)
	}
	if source.code != "SYNTHETIC" || *preview.Participants != 132 || preview.Member != nil || !preview.Approval {
		t.Fatalf("unexpected preview: %+v", preview)
	}
	want := errors.New("synthetic provider failure")
	source.err = want
	if _, err := inspectInvite(context.Background(), source, "group", "SYNTHETIC"); !errors.Is(err, want) {
		t.Fatal(err)
	}
}

func TestInvalidInviteIsRefusedBeforeConnecting(t *testing.T) {
	e := &engine{}
	for _, link := range []string{"https://example.invalid/invite", "https://chat.whatsapp.com/abc/extra"} {
		if _, err := e.inspect(link); err == nil {
			t.Fatal("invalid invite accepted")
		}
	}
}

func TestDeviceListIncludesThisDeviceAndNeverExposesJIDs(t *testing.T) {
	own := types.NewJID("100000000000001", types.DefaultUserServer)
	own.Device = 7
	phone := own
	phone.Device = 0
	other := own
	other.Device = 12
	stranger := types.NewJID("100000000000002", types.DefaultUserServer)
	devices := deviceList(own, []types.JID{phone, other, other, stranger})
	assertJSON(t, devices, `[{"id":0,"current":false},{"id":7,"current":true},{"id":12,"current":false}]`)
}
