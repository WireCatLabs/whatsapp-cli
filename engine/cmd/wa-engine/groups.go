package main

import (
	"errors"
	"image"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"time"
	"unicode/utf8"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// groupFields are the request fields of the group and people requests.
type groupFields struct {
	Title       *string  `json:"title,omitempty"`
	Description *string  `json:"description,omitempty"`
	People      []string `json:"people,omitempty"`
	Link        string   `json:"link,omitempty"`
	WithLink    bool     `json:"withLink,omitempty"`
	Action      string   `json:"action,omitempty"`
	Accept      bool     `json:"accept,omitempty"`
	Blocked     bool     `json:"blocked,omitempty"`
	AddMode     string   `json:"addMode,omitempty"`
	Approval    *bool    `json:"approval,omitempty"`
	Announce    *bool    `json:"announce,omitempty"`
	Locked      *bool    `json:"locked,omitempty"`
	Ephemeral   *uint32  `json:"ephemeral,omitempty"`
	RemovePhoto bool     `json:"removePhoto,omitempty"`
}

type waMember struct {
	JID  string  `json:"jid"`
	Name *string `json:"name"`
	Role string  `json:"role"`
}

// waGroup is a group in WhatsApp's own terms; the adapter maps the switches onto cli-core's.
type waGroup struct {
	Chat        waChat     `json:"chat"`
	Description *string    `json:"description"`
	Link        *string    `json:"link"`
	AddMode     string     `json:"addMode"`
	Approval    bool       `json:"approval"`
	Announce    bool       `json:"announce"`
	Locked      bool       `json:"locked"`
	Ephemeral   uint32     `json:"ephemeral"`
	Members     []waMember `json:"members"`
}

type waCreated struct {
	Group    waGroup  `json:"group"`
	NotAdded []string `json:"notAdded"`
}

type waJoined struct {
	Group     *waGroup `json:"group"`
	Requested bool     `json:"requested"`
}

// WhatsApp refuses a longer subject with 406 (whatsmeow's ReqCreateGroup).
const groupNameLimit = 25

var inviteCode = regexp.MustCompile(`(?i)^\s*(?:https?://)?chat\.whatsapp\.com/([A-Za-z0-9]+)(?:[?#][^\s]*)?\s*$`)

func (e *engine) dispatchGroups(req request) (any, bool, error) {
	if value, handled, err := e.groupOp(req); handled {
		return value, true, groupFailure(err)
	}
	return e.dispatchPeople(req)
}

// groupFailure names what WhatsApp answers a member who is not an admin. classify would read its 401 as a device
// that is no longer linked, and an agent told that may unlink the device.
func groupFailure(err error) error {
	var known *failure
	switch {
	case err == nil:
		return nil
	case errors.As(err, &known):
		return known
	case errors.Is(err, whatsmeow.ErrNotInGroup), errors.Is(err, whatsmeow.ErrGroupNotFound):
		return err
	case isIQ(err, 401), isIQ(err, 403):
		return &failure{"permission_error", "only the group's admins may do that"}
	}
	return err
}

func (e *engine) groupOp(req request) (any, bool, error) {
	switch req.Op {
	case "group":
		value, err := e.group(req.JID, req.WithLink)
		return value, true, err
	case "createGroup":
		value, err := e.createGroup(req)
		return value, true, err
	case "join":
		value, err := e.join(req.Link)
		return value, true, err
	case "leave":
		return nil, true, e.leave(req.JID)
	case "updateGroup":
		value, err := e.updateGroup(req)
		return value, true, err
	case "resetLink":
		value, err := e.resetLink(req.JID)
		return value, true, err
	case "setGroupPhoto":
		value, err := e.setGroupPhoto(req.JID, req.Path, req.RemovePhoto)
		return value, true, err
	case "participants":
		value, err := e.participants(req)
		return value, true, err
	case "requests":
		value, err := e.requests(req.JID)
		return value, true, err
	case "answerRequest":
		return nil, true, e.answerRequest(req)
	}
	return nil, false, nil
}

// member is the id the store keys a person by: their LID when WhatsApp has one.
func (c *converter) member(p types.GroupParticipant) types.JID {
	if !p.LID.IsEmpty() {
		return c.canonical(p.LID, nil)
	}
	return c.canonical(p.JID, nil)
}

func roleOf(p types.GroupParticipant) string {
	switch {
	case p.IsSuperAdmin:
		return "owner"
	case p.IsAdmin:
		return "admin"
	}
	return "member"
}

func (c *converter) group(info *types.GroupInfo, link *string) waGroup {
	members := make([]waMember, 0, len(info.Participants))
	for _, participant := range info.Participants {
		id := c.member(participant)
		members = append(members, waMember{JID: id.String(), Name: name(c.nameOf(id)), Role: roleOf(participant)})
	}
	count := len(info.Participants)
	return waGroup{
		Chat:        linked(waChat{JID: info.JID.String(), Name: name(info.Name), Kind: "group", Participants: &count}, info),
		Description: str(info.Topic),
		Link:        link,
		AddMode:     string(info.MemberAddMode),
		Approval:    info.IsJoinApprovalRequired,
		Announce:    info.IsAnnounce,
		Locked:      info.IsLocked,
		Ephemeral:   info.DisappearingTimer,
		Members:     members,
	}
}

func groupJID(raw string) (types.JID, error) {
	jid, err := types.ParseJID(raw)
	if err != nil || jid.Server != types.GroupServer || jid.User == "" {
		return types.JID{}, &failure{"validation_error", "not a WhatsApp group id (…@g.us)"}
	}
	return jid, nil
}

func personJID(raw string) (types.JID, error) {
	jid, err := types.ParseJID(raw)
	if err != nil || jid.User == "" || (jid.Server != types.HiddenUserServer && jid.Server != types.DefaultUserServer) {
		return types.JID{}, &failure{"validation_error", "not a WhatsApp person id (…@lid)"}
	}
	return jid.ToNonAD(), nil
}

// group reads one group; the invite link only when asked, since it costs a request and only admins get one.
func (e *engine) group(raw string, withLink bool) (*waGroup, error) {
	jid, err := groupJID(raw)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	group, err := e.readGroup(jid, withLink)
	if err != nil {
		return nil, err
	}
	// The whole chat, so a group the store does not hold yet gets its title. Membership stays unsaid: the engine
	// cannot tell a refused read of a stored group from a typo, and cli-core's null would clear "archived".
	e.pushChats([]waChat{group.Chat})
	return group, nil
}

func (e *engine) readGroup(jid types.JID, withLink bool) (*waGroup, error) {
	info, err := e.client.GetGroupInfo(e.ctx, jid)
	if err != nil {
		return nil, err
	}
	// A link WhatsApp will not give is no link, never a failure: this read also follows writes that succeeded.
	var link *string
	if withLink {
		if got, err := e.client.GetGroupInviteLink(e.ctx, jid, false); err == nil {
			link = &got
		}
	}
	group := e.conv.group(info, link)
	e.mu.Lock()
	e.addressing[jid] = info.AddressingMode
	e.mu.Unlock()
	return &group, nil
}

func (e *engine) people(raw []string) ([]types.JID, error) {
	jids := make([]types.JID, 0, len(raw))
	for _, one := range raw {
		jid, err := personJID(one)
		if err != nil {
			return nil, err
		}
		jids = append(jids, jid)
	}
	return jids, nil
}

func (e *engine) createGroup(req request) (*waCreated, error) {
	if req.Title == nil || *req.Title == "" {
		return nil, &failure{"validation_error", "a group needs a title"}
	}
	if utf8.RuneCountInString(*req.Title) > groupNameLimit {
		return nil, &failure{"validation_error", "WhatsApp takes a group name of at most 25 characters"}
	}
	people, err := e.people(req.People)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	info, err := e.client.CreateGroup(e.ctx, whatsmeow.ReqCreateGroup{Name: *req.Title, Participants: people})
	if err != nil {
		return nil, err
	}
	notAdded := failedOf(people, info.Participants, e.conv)
	added := info.Participants[:0:0]
	for _, participant := range info.Participants {
		if participant.Error == 0 {
			added = append(added, participant)
		}
	}
	info.Participants = added
	return &waCreated{Group: e.conv.group(info, nil), NotAdded: notAdded}, nil
}

// failedOf names, in the form they were asked by, the people WhatsApp answered with an error for: a participant
// can come back in phone form when it was asked by LID.
func failedOf(asked []types.JID, answered []types.GroupParticipant, c *converter) []string {
	failed := map[types.JID]bool{}
	for _, participant := range answered {
		if participant.Error == 0 {
			continue
		}
		for _, id := range []types.JID{participant.JID, participant.LID, participant.PhoneNumber} {
			if !id.IsEmpty() {
				failed[c.canonical(id, nil)] = true
			}
		}
	}
	notAdded := []string{}
	for _, jid := range asked {
		if failed[c.canonical(jid, nil)] {
			notAdded = append(notAdded, jid.String())
		}
	}
	return notAdded
}

// join checks the link first, then joins. WhatsApp answers a joined group and a request sent alike, so a group
// that asks its admins first counts as requested until the account is in it.
func (e *engine) join(link string) (*waJoined, error) {
	found := inviteCode.FindStringSubmatch(link)
	if found == nil {
		return nil, &failure{"validation_error", "not a WhatsApp invite link (chat.whatsapp.com/…)"}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	jid, err := e.client.JoinGroupWithLink(e.ctx, found[1])
	if err != nil {
		return nil, inviteFailure(err)
	}
	group, err := e.readGroup(jid, false)
	if errors.Is(err, whatsmeow.ErrNotInGroup) || isIQ(err, 403) || isIQ(err, 401) {
		return &waJoined{Requested: true}, nil
	}
	if err != nil {
		return nil, err
	}
	// The answer is not stored, so the push is how the store gets the group. cli-core clears a left mark after a join.
	e.pushChats([]waChat{group.Chat})
	return &waJoined{Group: group}, nil
}

func isIQ(err error, code int) bool {
	var iq *whatsmeow.IQError
	return errors.As(err, &iq) && iq.Code == code
}

func inviteFailure(err error) error {
	switch {
	case errors.Is(err, whatsmeow.ErrInviteLinkRevoked):
		return &failure{"not_found", "that invite link was revoked"}
	case errors.Is(err, whatsmeow.ErrInviteLinkInvalid):
		return &failure{"not_found", "that invite link is not valid"}
	}
	return err
}

func (e *engine) leave(raw string) error {
	jid, err := groupJID(raw)
	if err != nil {
		return err
	}
	if err := e.connect(); err != nil {
		return err
	}
	return e.client.LeaveGroup(e.ctx, jid)
}

func (e *engine) updateGroup(req request) (*waGroup, error) {
	jid, err := groupJID(req.JID)
	if err != nil {
		return nil, err
	}
	if req.Title != nil && (*req.Title == "" || utf8.RuneCountInString(*req.Title) > groupNameLimit) {
		return nil, &failure{"validation_error", "WhatsApp takes a group name of 1 to 25 characters"}
	}
	mode := types.GroupMemberAddMode(req.AddMode)
	if mode != "" && mode != types.GroupMemberAddModeAdmin && mode != types.GroupMemberAddModeAllMember {
		return nil, &failure{"validation_error", "addMode is admin_add or all_member_add"}
	}
	var timer time.Duration
	if req.Ephemeral != nil {
		var ok bool
		if timer, ok = disappearingTimer(*req.Ephemeral); !ok {
			return nil, &failure{"validation_error", "WhatsApp makes messages disappear after 24h, 7d or 90d, or never"}
		}
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	if req.Title != nil {
		if err := e.client.SetGroupName(e.ctx, jid, *req.Title); err != nil {
			return nil, err
		}
	}
	if req.Description != nil {
		if err := e.client.SetGroupTopic(e.ctx, jid, "", "", *req.Description); err != nil {
			return nil, err
		}
	}
	if mode != "" {
		if err := e.client.SetGroupMemberAddMode(e.ctx, jid, mode); err != nil {
			return nil, err
		}
	}
	if req.Approval != nil {
		if err := e.client.SetGroupJoinApprovalMode(e.ctx, jid, *req.Approval); err != nil {
			return nil, err
		}
	}
	if req.Announce != nil {
		if err := e.client.SetGroupAnnounce(e.ctx, jid, *req.Announce); err != nil {
			return nil, err
		}
	}
	if req.Locked != nil {
		if err := e.client.SetGroupLocked(e.ctx, jid, *req.Locked); err != nil {
			return nil, err
		}
	}
	if req.Ephemeral != nil {
		if err := e.client.SetDisappearingTimer(e.ctx, jid, timer, time.Time{}); err != nil {
			return nil, err
		}
	}
	return e.readGroup(jid, true)
}

// disappearingTimer accepts only the timers WhatsApp's apps offer: its server rejects any other in a group.
func disappearingTimer(seconds uint32) (time.Duration, bool) {
	timer := time.Duration(seconds) * time.Second
	switch timer {
	case whatsmeow.DisappearingTimerOff, whatsmeow.DisappearingTimer24Hours,
		whatsmeow.DisappearingTimer7Days, whatsmeow.DisappearingTimer90Days:
		return timer, true
	}
	return 0, false
}

func (e *engine) resetLink(raw string) (*waGroup, error) {
	jid, err := groupJID(raw)
	if err != nil {
		return nil, err
	}
	if err := e.connect(); err != nil {
		return nil, err
	}
	link, err := e.client.GetGroupInviteLink(e.ctx, jid, true)
	if err != nil {
		if errors.Is(err, whatsmeow.ErrGroupInviteLinkUnauthorized) {
			return nil, &failure{"permission_error", "only the group's admins may replace its invite link"}
		}
		return nil, err
	}
	group, err := e.readGroup(jid, false)
	if err != nil {
		return nil, err
	}
	group.Link = &link
	return group, nil
}

// WhatsApp takes a group photo as a JPEG, and whatsmeow sends the bytes as given. mautrix-whatsapp v0.2610.0 sends
// only square JPEGs of these sides: it re-encodes any other picture to a side clamped to them, ends included
// (pkg/connector/handlematrix.go, convertRoomAvatar). The account's own photo goes in the same request, which Baileys
// makes a 640-pixel square JPEG for both (src/Utils/messages-media.ts, generateProfilePicture). No source gives sides
// for an own photo, so there they are wa's check, not WhatsApp's rule (not checked live).
const (
	photoMin = 190
	photoMax = 720
)

// squareJPEG reads a group's or the account's photo, `what`, in full only once its header shows WhatsApp would take it.
// `sidesBy` names who sets the sides, so a refusal does not pass wa's own limit off as WhatsApp's.
func squareJPEG(path, what, sidesBy string) ([]byte, error) {
	if !filepath.IsAbs(path) {
		return nil, &failure{"validation_error", "a " + what + " needs its absolute path"}
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, &failure{"validation_error", "the " + what + " could not be opened"}
	}
	defer file.Close()
	config, format, err := image.DecodeConfig(file)
	if err != nil || format != "jpeg" {
		return nil, &failure{"validation_error", "WhatsApp takes a " + what + " only as a JPEG"}
	}
	if config.Width != config.Height || config.Width < photoMin || config.Width > photoMax {
		return nil, &failure{"validation_error", sidesBy + " takes a " + what + " as a square of 190 to 720 pixels a side"}
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	return io.ReadAll(file)
}

func groupPhoto(path string) ([]byte, error) { return squareJPEG(path, "group photo", "WhatsApp") }

// newGroupPhoto is what SetGroupPhoto gets: nil takes the photo away (whatsmeow group.go, SetGroupPhoto).
func newGroupPhoto(path string, remove bool) ([]byte, error) {
	if !remove {
		return groupPhoto(path)
	}
	if path != "" {
		return nil, &failure{"validation_error", "give a new group photo or remove it, not both"}
	}
	return nil, nil
}

// setPicture sets a group's photo, or the account's own with types.EmptyJID: whatsmeow then sends no target, as
// Baileys does for the account's own picture (src/Socket/chats.ts, updateProfilePicture).
func (e *engine) setPicture(jid types.JID, photo []byte) error {
	if err := e.connect(); err != nil {
		return err
	}
	if _, err := e.client.SetGroupPhoto(e.ctx, jid, photo); err != nil {
		if errors.Is(err, whatsmeow.ErrInvalidImageFormat) {
			return &failure{"validation_error", "WhatsApp refused the photo; it takes a square JPEG"}
		}
		return err
	}
	return nil
}

func (e *engine) setGroupPhoto(raw, path string, remove bool) (*waGroup, error) {
	jid, err := groupJID(raw)
	if err != nil {
		return nil, err
	}
	photo, err := newGroupPhoto(path, remove)
	if err != nil {
		return nil, err
	}
	if err := e.setPicture(jid, photo); err != nil {
		return nil, err
	}
	return e.readGroup(jid, true)
}
