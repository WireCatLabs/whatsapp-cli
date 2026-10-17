package main

import (
	"testing"

	"go.mau.fi/whatsmeow/types"
)

func TestTargetOfAddressesTheMessage(t *testing.T) {
	cases := []struct {
		name string
		req  request
		want types.JID
	}{
		{"the account's own message has no sender", request{Chat: group.String(), Message: "3EB0A1", FromMe: true, Sender: selfLID.String()}, types.EmptyJID},
		{"someone else's message in a group names them", request{Chat: group.String(), Message: "3EB0A1", Sender: annLID.String()}, annLID},
		{"a device part is dropped", request{Chat: group.String(), Message: "3EB0A1", Sender: "100000000000002:7@lid"}, annLID},
		{"the other person in a one-to-one chat is its sender", request{Chat: annLID.String(), Message: "3EB0A1"}, annLID},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := targetOf(tc.req)
			if err != nil {
				t.Fatal(err)
			}
			if got.sender != tc.want || got.id != "3EB0A1" {
				t.Fatalf("got %+v, want sender %v", got, tc.want)
			}
		})
	}
}

func TestTargetOfRefusesWhatCannotBeAddressed(t *testing.T) {
	cases := []struct {
		name string
		req  request
	}{
		{"no chat", request{Message: "3EB0A1", FromMe: true}},
		{"no message id", request{Chat: annLID.String(), FromMe: true}},
		{"a group message from nobody known", request{Chat: group.String(), Message: "3EB0A1"}},
		{"a sender that is not a JID", request{Chat: group.String(), Message: "3EB0A1", Sender: "@"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := targetOf(tc.req)
			if f, ok := err.(*failure); !ok || f.Code != "validation_error" {
				t.Fatalf("got %v, want a validation_error", err)
			}
		})
	}
}
