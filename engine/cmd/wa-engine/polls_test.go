package main

import (
	"encoding/hex"
	"testing"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
)

func TestAPollMessageCarriesItsAnswersByTheHashAVoteNames(t *testing.T) {
	built := (*whatsmeow.Client)(nil).BuildPollCreation("Which day?", []string{"Monday", "Tuesday"}, 1)
	if len(built.GetMessageContextInfo().GetMessageSecret()) != 32 {
		t.Fatal("a poll goes out with its own secret, which every vote is encrypted with")
	}
	changed, ok := testConverter().message(incoming(group, annLID, built), nil)
	if !ok || changed.message.Poll == nil {
		t.Fatalf("got %+v, want a message with a poll", changed)
	}
	poll := changed.message.Poll
	if changed.message.Text != "Which day?" || poll.Question != "Which day?" || poll.Multiple {
		t.Fatalf("got %+v", poll)
	}
	hashes := whatsmeow.HashPollOptions([]string{"Monday", "Tuesday"})
	for i, answer := range poll.Answers {
		if answer.ID != hex.EncodeToString(hashes[i])[:8] {
			t.Fatalf("answer %d: id %s is not the start of the hash a vote for %q carries", i, answer.ID, answer.Text)
		}
	}
}

func TestEveryPollVersionIsAPoll(t *testing.T) {
	creation := &waE2E.PollCreationMessage{
		Name:                   new("Pizza?"),
		Options:                []*waE2E.PollCreationMessage_Option{{OptionName: new("yes")}, {OptionName: new("no")}},
		SelectableOptionsCount: new(uint32(0)),
	}
	for name, content := range map[string]*waE2E.Message{
		"v2": {PollCreationMessageV2: creation},
		"v3": {PollCreationMessageV3: creation},
		"v5": {PollCreationMessageV5: creation},
		"v6": {PollCreationMessageV6: creation},
	} {
		t.Run(name, func(t *testing.T) {
			changed, ok := testConverter().message(incoming(annLID, annLID, content), nil)
			if !ok || changed.message.Poll == nil || !changed.message.Poll.Multiple || len(changed.message.Poll.Answers) != 2 {
				t.Fatalf("got %+v, want a poll with several answers allowed", changed.message.Poll)
			}
		})
	}
}

func TestAnswerIDsDifferForTheSameStart(t *testing.T) {
	ids := answerIDs([]string{"same", "same"})
	if len(ids[0]) != 64 {
		t.Fatalf("two equal texts share every hash prefix; got %v", ids)
	}
	ids = answerIDs([]string{"a", "b"})
	if len(ids[0]) != 8 || ids[0] == ids[1] {
		t.Fatalf("got %v", ids)
	}
}

func TestAVoteAddressesThePollAsItWasSent(t *testing.T) {
	cases := []struct {
		name  string
		t     target
		phone bool
		want  types.JID
	}{
		{"the account's own poll in a group", target{chat: group, id: "3EB0A1"}, false, selfLID},
		{"the account's own poll in a group addressed by phone", target{chat: group, id: "3EB0A1"}, true, selfPN},
		{"someone else's poll in a group", target{chat: group, id: "3EB0A1", sender: annLID}, false, annLID},
		{"the other person's poll in a one-to-one chat", target{chat: annLID, id: "3EB0A1", sender: annLID}, false, annLID},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info := pollInfoOf(tc.t, selfLID, selfPN, tc.phone)
			if info.Sender != tc.want || info.Chat != tc.t.chat || info.ID != "3EB0A1" || info.IsFromMe != tc.t.mine() ||
				info.IsGroup != tc.t.inGroup() {
				t.Fatalf("got %+v, want sender %v", info, tc.want)
			}
		})
	}
}
