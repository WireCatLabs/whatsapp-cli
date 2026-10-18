package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// pollFields are the request fields of createPoll and vote. A vote names answers by their text: WhatsApp counts a
// vote by the SHA-256 of the answer's text.
type pollFields struct {
	Question string   `json:"question,omitempty"`
	Answers  []string `json:"answers,omitempty"`
	Multiple bool     `json:"multiple,omitempty"`
}

type waPollAnswer struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

// waPoll is a poll as its message carries it. Votes come later, one message per voter; nothing here counts them.
type waPoll struct {
	Question string         `json:"question"`
	Answers  []waPollAnswer `json:"answers"`
	Multiple bool           `json:"multiple"`
}

// waVote is one person's newest choice in a poll: the full SHA-256 of each chosen answer's text, as WhatsApp sends
// it; none takes the vote back. A vote from the history push rides in that push's `votes` with its poll, which the
// same message carries: the poll itself may go to an `older` request instead of the push.
type waVote struct {
	Chat      string   `json:"chat"`
	Message   string   `json:"message"`
	Voter     string   `json:"voter"`
	VoterName *string  `json:"voterName"`
	Selected  []string `json:"selected"`
	VotedAt   string   `json:"votedAt"`
	Poll      *waPoll  `json:"poll,omitempty"`
}

func hashesOf(options [][]byte) []string {
	hashes := make([]string, len(options))
	for i, option := range options {
		hashes[i] = hex.EncodeToString(option)
	}
	return hashes
}

// vote is a live vote once whatsmeow has decrypted it. The account's own vote, cast on the phone, carries the
// account's id exactly as self() has it: cli-core keeps the CLI's own vote under that id, and two ids would count
// one person twice.
func (c *converter) vote(evt *events.Message, decrypted *waE2E.PollVoteMessage) (waVote, bool) {
	info := evt.Info
	update := evt.Message.GetPollUpdateMessage()
	poll := update.GetPollCreationMessageKey().GetID()
	if poll == "" || info.Chat == types.StatusBroadcastJID {
		return waVote{}, false
	}
	k := known{}
	k.add(info.Sender, info.SenderAlt)
	k.add(info.SenderAlt, info.Sender)
	if !info.IsGroup {
		k.add(info.Chat, info.RecipientAlt)
		k.add(info.RecipientAlt, info.Chat)
	}
	voter, voterName := c.self, (*string)(nil)
	if !info.IsFromMe {
		voter = c.canonical(info.Sender, k)
		voterName = name(info.PushName, c.nameOf(voter))
	}
	if voter.IsEmpty() {
		return waVote{}, false
	}
	at := info.Timestamp
	if ms := update.GetSenderTimestampMS(); ms > 0 {
		at = time.UnixMilli(ms)
	}
	return waVote{
		Chat:      c.canonical(info.Chat, k).String(),
		Message:   poll,
		Voter:     voter.String(),
		VoterName: voterName,
		Selected:  hashesOf(decrypted.GetSelectedOptions()),
		VotedAt:   iso(at),
	}, true
}

// historyVotes are the votes the phone pushes beside their poll, already decrypted. A vote's key names its voter:
// the participant in a group, the chat in a one-to-one chat, the account when it is its own.
func (c *converter) historyVotes(poll waMessage, web *waWeb.WebMessageInfo, k known) []waVote {
	var votes []waVote
	for _, update := range web.GetPollUpdates() {
		key := update.GetPollUpdateMessageKey()
		voter := c.self
		if !key.GetFromMe() {
			raw := key.GetParticipant()
			if raw == "" {
				raw = key.GetRemoteJID()
			}
			parsed, err := types.ParseJID(raw)
			if err != nil {
				continue
			}
			voter = c.canonical(parsed, k)
		}
		if voter.IsEmpty() || voter.Server == types.GroupServer {
			continue
		}
		at := poll.Timestamp
		for _, ms := range []int64{update.GetSenderTimestampMS(), update.GetServerTimestampMS()} {
			if ms > 0 {
				at = iso(time.UnixMilli(ms))
				break
			}
		}
		var voterName *string
		if voter != c.self {
			voterName = name(c.nameOf(voter))
		}
		votes = append(votes, waVote{
			Chat:      poll.Chat,
			Message:   poll.ID,
			Voter:     voter.String(),
			VoterName: voterName,
			Selected:  hashesOf(update.GetVote().GetSelectedOptions()),
			VotedAt:   at,
			Poll:      poll.Poll,
		})
	}
	return votes
}

// pollVote decrypts a vote with the poll's secret, which whatsmeow keeps for every poll this device saw. A vote for
// a poll it never saw cannot be read, and is passed over.
func (e *engine) pollVote(evt *events.Message) {
	decrypted, err := e.client.DecryptPollVote(e.ctx, evt)
	if err != nil {
		return
	}
	if vote, ok := e.conv.vote(evt, decrypted); ok {
		e.out.event("vote", vote)
	}
}

// What WhatsApp's apps let a poll have.
const pollAnswerLimit = 12

func (e *engine) dispatchPolls(req request) (any, bool, error) {
	switch req.Op {
	case "createPoll":
		value, err := e.createPoll(req)
		return value, true, err
	case "vote":
		return nil, true, e.vote(req)
	}
	return nil, false, nil
}

func pollCreationOf(m *waE2E.Message) *waE2E.PollCreationMessage {
	for _, poll := range []*waE2E.PollCreationMessage{
		m.GetPollCreationMessage(), m.GetPollCreationMessageV2(), m.GetPollCreationMessageV3(),
		m.GetPollCreationMessageV5(), m.GetPollCreationMessageV6(),
	} {
		if poll != nil {
			return poll
		}
	}
	return nil
}

func pollOf(creation *waE2E.PollCreationMessage) *waPoll {
	if creation == nil {
		return nil
	}
	texts := make([]string, len(creation.GetOptions()))
	for i, option := range creation.GetOptions() {
		texts[i] = option.GetOptionName()
	}
	ids := answerIDs(texts)
	answers := make([]waPollAnswer, len(texts))
	for i, text := range texts {
		answers[i] = waPollAnswer{ID: ids[i], Text: text}
	}
	return &waPoll{Question: creation.GetName(), Answers: answers, Multiple: creation.GetSelectableOptionsCount() != 1}
}

// answerIDs names each answer by the start of the hash WhatsApp votes with, so an id is the provider's own and not a
// position; the prefix grows until the answers differ.
func answerIDs(texts []string) []string {
	hashes := make([]string, len(texts))
	for i, text := range texts {
		sum := sha256.Sum256([]byte(text))
		hashes[i] = hex.EncodeToString(sum[:])
	}
	for size := 8; ; size += 4 {
		ids := make([]string, len(hashes))
		seen := map[string]bool{}
		unique := true
		for i, hash := range hashes {
			ids[i] = hash[:min(size, len(hash))]
			if seen[ids[i]] && size < len(hash) {
				unique = false
			}
			seen[ids[i]] = true
		}
		if unique {
			return ids
		}
	}
}

func (e *engine) createPoll(req request) (*waMessage, error) {
	to, err := types.ParseJID(req.Chat)
	if err != nil || to.User == "" {
		return nil, &failure{"validation_error", "not a WhatsApp chat id"}
	}
	if req.SendID == "" {
		return nil, &failure{"validation_error", "a send needs its message id"}
	}
	if req.Question == "" {
		return nil, &failure{"validation_error", "a poll needs a question"}
	}
	if len(req.Answers) < 2 || len(req.Answers) > pollAnswerLimit {
		return nil, &failure{"validation_error", "a WhatsApp poll takes 2 to 12 answers"}
	}
	seen := map[string]bool{}
	for _, answer := range req.Answers {
		if answer == "" || seen[answer] {
			return nil, &failure{"validation_error", "each answer needs text of its own: WhatsApp counts a vote by it"}
		}
		seen[answer] = true
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	selectable := 1
	if req.Multiple {
		selectable = 0
	}
	content := e.client.BuildPollCreation(req.Question, req.Answers, selectable)
	sent, err := e.client.SendMessage(e.ctx, to, content, whatsmeow.SendRequestExtra{ID: req.SendID})
	if err != nil {
		return nil, err
	}
	message := &waMessage{
		ID:        sent.ID,
		Chat:      e.conv.canonical(to, nil).String(),
		FromMe:    true,
		Timestamp: iso(sent.Timestamp),
		Text:      req.Question,
		Poll:      pollOf(content.GetPollCreationMessage()),
	}
	if me, _ := e.me(); me != nil {
		message.Sender = &me.JID
		message.SenderName = me.Name
	}
	e.phones.note(e.ctx, message.Chat)
	return message, nil
}

// vote sends the account's choice, encrypted with the poll's own secret, which whatsmeow keeps in private.db for
// every poll this device saw arrive, sent or got in the history push. No answers takes the vote back.
func (e *engine) vote(req request) error {
	t, err := targetOf(req)
	if err != nil {
		return err
	}
	if err := e.connect(); err != nil {
		return err
	}
	t = e.participantFor(t)
	phone := t.inGroup() && t.mine() && e.phoneAddressed(t.chat)
	info := pollInfoOf(t, e.conv.self, e.conv.selfPN, phone)
	content, err := e.client.BuildPollVote(e.ctx, &info, req.Answers)
	if errors.Is(err, whatsmeow.ErrOriginalMessageSecretNotFound) {
		return &failure{"not_found", "this device holds no key for that poll; vote on the phone"}
	}
	if err != nil {
		return err
	}
	_, err = e.client.SendMessage(e.ctx, t.chat, content)
	return err
}

// pollInfoOf is the poll's key as whatsmeow builds a vote from it. The account's own poll is sent under its LID,
// or under its phone JID in a group still addressed by phone numbers; that choice also picks the voter id the vote
// is encrypted for.
func pollInfoOf(t target, self, selfPN types.JID, phoneGroup bool) types.MessageInfo {
	sender := t.sender
	if t.mine() {
		sender = self
		if phoneGroup || self.IsEmpty() {
			sender = selfPN
		}
	}
	return types.MessageInfo{
		MessageSource: types.MessageSource{Chat: t.chat, Sender: sender, IsFromMe: t.mine(), IsGroup: t.inGroup()},
		ID:            t.id,
	}
}
