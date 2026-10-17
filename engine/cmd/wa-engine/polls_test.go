package main

import (
	"encoding/hex"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
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

func voteUpdate(poll string) *waE2E.Message {
	return &waE2E.Message{PollUpdateMessage: &waE2E.PollUpdateMessage{
		PollCreationMessageKey: &waCommon.MessageKey{ID: proto.String(poll)},
		SenderTimestampMS:      proto.Int64(sentAt.Add(time.Minute).UnixMilli()),
	}}
}

func TestALiveVoteNamesItsVoterByLIDAndEachAnswerByItsFullHash(t *testing.T) {
	evt := incoming(group, annPN, voteUpdate("3EB0POLL"))
	evt.Info.SenderAlt = annLID
	hashes := whatsmeow.HashPollOptions([]string{"Tuesday"})
	vote, ok := testConverter().vote(evt, &waE2E.PollVoteMessage{SelectedOptions: hashes})
	if !ok || vote.Chat != group.String() || vote.Message != "3EB0POLL" || vote.Voter != annLID.String() {
		t.Fatalf("got %+v", vote)
	}
	if vote.VoterName == nil || *vote.VoterName != "Ann Lee" || vote.VotedAt != "2026-09-01T10:01:00.000Z" {
		t.Fatalf("got %+v", vote)
	}
	if len(vote.Selected) != 1 || vote.Selected[0] != hex.EncodeToString(hashes[0]) || vote.Poll != nil {
		t.Fatalf("got %v, want the full hash", vote.Selected)
	}
}

func TestTheAccountsOwnVoteFromThePhoneIsUnderTheAccountsID(t *testing.T) {
	evt := incoming(group, types.JID{User: selfPN.User, Server: types.DefaultUserServer, Device: 7}, voteUpdate("3EB0POLL"))
	evt.Info.IsFromMe = true
	vote, ok := testConverter().vote(evt, &waE2E.PollVoteMessage{})
	if !ok || vote.Voter != selfLID.String() || vote.VoterName != nil || len(vote.Selected) != 0 {
		t.Fatalf("got %+v, want the account's LID and no answers", vote)
	}
}

func TestHistoryVotesComeWithTheirPoll(t *testing.T) {
	creation := (*whatsmeow.Client)(nil).BuildPollCreation("Which day?", []string{"Monday", "Tuesday"}, 1)
	hashes := whatsmeow.HashPollOptions([]string{"Monday", "Tuesday"})
	data := &waHistorySync.HistorySync{
		SyncType: waHistorySync.HistorySync_RECENT.Enum(),
		PhoneNumberToLidMappings: []*waHistorySync.PhoneNumberToLIDMapping{
			{PnJID: proto.String(annPN.String()), LidJID: proto.String(annLID.String())},
		},
		Conversations: []*waHistorySync.Conversation{{
			ID: proto.String(group.String()),
			Messages: []*waHistorySync.HistorySyncMsg{{Message: &waWeb.WebMessageInfo{
				Key: &waCommon.MessageKey{ID: proto.String("3EB0POLL")},
				PollUpdates: []*waWeb.PollUpdate{
					{
						PollUpdateMessageKey: &waCommon.MessageKey{Participant: proto.String(annPN.String())},
						Vote:                 &waE2E.PollVoteMessage{SelectedOptions: hashes[1:]},
						SenderTimestampMS:    proto.Int64(sentAt.Add(time.Minute).UnixMilli()),
					},
					{
						PollUpdateMessageKey: &waCommon.MessageKey{FromMe: proto.Bool(true)},
						Vote:                 &waE2E.PollVoteMessage{SelectedOptions: hashes[:1]},
					},
				},
			}}},
		}},
	}
	parse := func(chat types.JID, web *waWeb.WebMessageInfo) (*events.Message, error) {
		evt := incoming(chat, annLID, creation)
		evt.Info.ID = web.GetKey().GetID()
		return evt, nil
	}
	votes := testConverter().history(data, parse).votes
	if len(votes) != 2 {
		t.Fatalf("got %+v", votes)
	}
	ann, mine := votes[0], votes[1]
	if ann.Voter != annLID.String() || ann.Message != "3EB0POLL" || ann.Chat != group.String() ||
		ann.Selected[0] != hex.EncodeToString(hashes[1]) || ann.VotedAt != "2026-09-01T10:01:00.000Z" {
		t.Errorf("their vote: got %+v", ann)
	}
	if ann.Poll == nil || len(ann.Poll.Answers) != 2 {
		t.Errorf("a history vote carries its poll, got %+v", ann.Poll)
	}
	if mine.Voter != selfLID.String() || mine.VotedAt != "2026-09-01T10:00:00.000Z" {
		t.Errorf("own vote: got %+v, want the account's id and the poll's time", mine)
	}
}
