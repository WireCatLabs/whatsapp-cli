package main

import (
	"testing"

	"go.mau.fi/whatsmeow/proto/waVnameCert"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

func TestProfileWireShape(t *testing.T) {
	c := testConverter()
	known := c.profile(annLID, types.UserInfo{Status: "synthetic about"}, types.ContactInfo{Found: true, FullName: "Ann Lee"})
	assertJSON(t, known, `{"jid":"100000000000002@lid","name":"Ann Lee","about":"synthetic about","business":false,`+
		`"verified":false,"contact":true,"photo":null}`)

	business := types.UserInfo{VerifiedName: &types.VerifiedName{
		VerifiedLevel: "high",
		Details:       &waVnameCert.VerifiedNameCertificate_Details{VerifiedName: proto.String("Synthetic Shop")},
	}}
	got := c.profile(bobLID, business, types.ContactInfo{PushName: "+7 123 456 78 92"})
	if got.Name == nil || *got.Name != "Synthetic Shop" || !got.Business || !got.Verified || got.Contact {
		t.Fatalf("got %+v", got)
	}
}
