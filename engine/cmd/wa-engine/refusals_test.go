package main

import (
	"encoding/json"
	"testing"
)

// An engine with no WhatsApp client: a request that reached connect() would panic, so each case proves the refusal
// comes first.
func TestWriteOpsRefuseBeforeConnecting(t *testing.T) {
	cases := []struct {
		name string
		req  string
		code string
		want string
	}{
		{"a reaction in a channel", `{"op":"react","chat":"120363000000000009@newsletter","message":"3EB0A1","sender":"120363000000000009@newsletter","emoji":"x"}`, "validation_error", "reactions in channels are not supported yet"},
		{"an edit of someone else's message", `{"op":"edit","chat":"100000000000002@lid","message":"3EB0A1","text":"new"}`, "validation_error", "only your own messages can be edited"},
		{"an edit with no text", `{"op":"edit","chat":"100000000000002@lid","message":"3EB0A1","fromMe":true}`, "validation_error", "an edit needs the new text"},
		{"deleting their message in a one-to-one chat", `{"op":"revoke","chat":"100000000000002@lid","message":"3EB0A1"}`, "permission_error", "only your own messages can be deleted for everyone in a one-to-one chat"},
		{"a read receipt for the account's own message", `{"op":"read","chat":"100000000000002@lid","message":"3EB0A1","fromMe":true}`, "validation_error", "your own message has no read receipt to send"},
		{"a send to no chat", `{"op":"send","chat":"@","sendId":"3EB0B1","text":"hi"}`, "validation_error", "not a WhatsApp chat id"},
		{"a send with no message id", `{"op":"send","chat":"100000000000002@lid","text":"hi"}`, "validation_error", "a send needs its message id"},
		{"a reply posted to a channel", `{"op":"send","chat":"120363000000000009@newsletter","sendId":"3EB0B1","text":"hi","replyTo":"3EB0A1"}`, "validation_error", "a channel post cannot be a reply"},
		{"an edit in a channel", `{"op":"edit","chat":"120363000000000009@newsletter","message":"3EB0A1","fromMe":true,"text":"new"}`, "validation_error", "edits in channels are not supported yet"},
		{"a deletion in a channel", `{"op":"revoke","chat":"120363000000000009@newsletter","message":"3EB0A1","fromMe":true}`, "validation_error", "deleting in channels is not supported yet"},
		{"a poll in a channel", `{"op":"createPoll","chat":"120363000000000009@newsletter","sendId":"3EB0B1","question":"q","answers":["a","b"]}`, "validation_error", "polls in channels are not supported yet"},
		{"a vote in a channel", `{"op":"vote","chat":"120363000000000009@newsletter","message":"3EB0A1","sender":"120363000000000009@newsletter","answers":["a"]}`, "validation_error", "polls in channels are not supported yet"},
		{"a file to a channel", `{"op":"sendMedia","chat":"120363000000000009@newsletter","sendId":"3EB0B1","file":{"path":"/tmp/a.jpg"}}`, "validation_error", "sending files to channels is not supported yet"},
		{"a file to no chat", `{"op":"sendMedia","chat":"","sendId":"3EB0B1","file":{"path":"/tmp/a.jpg"}}`, "validation_error", "not a WhatsApp chat id"},
		{"a file with no message id", `{"op":"sendMedia","chat":"100000000000002@lid","file":{"path":"/tmp/a.jpg"}}`, "validation_error", "a send needs its message id"},
		{"a file by a relative path", `{"op":"sendMedia","chat":"100000000000002@lid","sendId":"3EB0B1","file":{"path":"a.jpg"}}`, "validation_error", "a file to send needs its absolute path"},
		{"a forward to a channel", `{"op":"forward","chat":"120363000000000009@newsletter","sendId":"3EB0B1","text":"hi"}`, "validation_error", "sending files to channels is not supported yet"},
		{"a forward of nothing", `{"op":"forward","chat":"100000000000002@lid","sendId":"3EB0B1"}`, "validation_error", "the message has nothing to forward"},
		{"a poll in no chat", `{"op":"createPoll","chat":"@","sendId":"3EB0B1","question":"q","answers":["a","b"]}`, "validation_error", "not a WhatsApp chat id"},
		{"a poll with no message id", `{"op":"createPoll","chat":"120363000000000001@g.us","question":"q","answers":["a","b"]}`, "validation_error", "a send needs its message id"},
		{"a poll with no question", `{"op":"createPoll","chat":"120363000000000001@g.us","sendId":"3EB0B1","answers":["a","b"]}`, "validation_error", "a poll needs a question"},
		{"a poll with one answer", `{"op":"createPoll","chat":"120363000000000001@g.us","sendId":"3EB0B1","question":"q","answers":["a"]}`, "validation_error", "a WhatsApp poll takes 2 to 12 answers"},
		{"a poll with the same answer twice", `{"op":"createPoll","chat":"120363000000000001@g.us","sendId":"3EB0B1","question":"q","answers":["a","a"]}`, "validation_error", "each answer needs text of its own: WhatsApp counts a vote by it"},
		{"a group with no title", `{"op":"createGroup","people":["100000000000002@lid"]}`, "validation_error", "a group needs a title"},
		{"a group title over 25 characters", `{"op":"createGroup","title":"abcdefghijklmnopqrstuvwxyz"}`, "validation_error", "WhatsApp takes a group name of at most 25 characters"},
		{"a group with a group among its people", `{"op":"createGroup","title":"t","people":["120363000000000001@g.us"]}`, "validation_error", "not a WhatsApp person id (…@lid)"},
		{"leaving a person, not a group", `{"op":"leave","jid":"100000000000002@lid"}`, "validation_error", "not a WhatsApp group id (…@g.us)"},
		{"an update to a person, not a group", `{"op":"updateGroup","jid":"100000000000002@lid","title":"t"}`, "validation_error", "not a WhatsApp group id (…@g.us)"},
		{"an empty group title", `{"op":"updateGroup","jid":"120363000000000001@g.us","title":""}`, "validation_error", "WhatsApp takes a group name of 1 to 25 characters"},
		{"an add mode WhatsApp lacks", `{"op":"updateGroup","jid":"120363000000000001@g.us","addMode":"anyone"}`, "validation_error", "addMode is admin_add or all_member_add"},
		{"a disappearing timer WhatsApp lacks", `{"op":"updateGroup","jid":"120363000000000001@g.us","ephemeral":60}`, "validation_error", "WhatsApp makes messages disappear after 24h, 7d or 90d, or never"},
		{"a new link for a person, not a group", `{"op":"resetLink","jid":"100000000000002@lid"}`, "validation_error", "not a WhatsApp group id (…@g.us)"},
		{"a participant action WhatsApp lacks", `{"op":"participants","jid":"120363000000000001@g.us","action":"ban","people":["100000000000002@lid"]}`, "validation_error", "action is add, remove, promote or demote"},
		{"a participant change naming nobody", `{"op":"participants","jid":"120363000000000001@g.us","action":"add"}`, "validation_error", "name at least one person"},
		{"answering two join requests at once", `{"op":"answerRequest","jid":"120363000000000001@g.us","people":["100000000000002@lid","100000000000003@lid"],"accept":true}`, "validation_error", "answer one request at a time"},
		{"a join by something not an invite link", `{"op":"join","link":"https://example.com/abc"}`, "validation_error", "not a WhatsApp invite link (chat.whatsapp.com/…)"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req request
			if err := json.Unmarshal([]byte(tc.req), &req); err != nil {
				t.Fatal(err)
			}
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("reached the client instead of refusing: %v", r)
				}
			}()
			_, err := (&engine{}).dispatch(req)
			if f, ok := err.(*failure); !ok || f.Code != tc.code || f.Message != tc.want {
				t.Fatalf("got %v, want a %s: %s", err, tc.code, tc.want)
			}
		})
	}
}
