package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types/events"
)

func TestOnlyWhatsAppsOwnRateLimitCarriesTheAccountReason(t *testing.T) {
	if got := classify(&whatsmeow.IQError{Code: 429}); got.Code != "rate_limited" || got.Reason != "account.rate-limited" {
		t.Errorf("WhatsApp's 429 became %+v", got)
	}
	local := &failure{"rate_limited", "one number lookup every 10 seconds; wait and try again"}
	if got := classify(local); got.Code != "rate_limited" || got.Reason != "" {
		t.Errorf("the engine's own lookup pace became %+v", got)
	}
}

func TestTheEngineKeepsWhyWhatsAppEndedTheConnection(t *testing.T) {
	cases := []struct {
		event  any
		state  string
		reason string
	}{
		{&events.TemporaryBan{}, "banned", "account.banned"},
		{&events.ConnectFailure{Reason: events.ConnectFailureTempBanned}, "banned", "account.banned"},
		{&events.ClientOutdated{}, "outdated", "client.outdated"},
		{&events.ConnectFailure{Reason: events.ConnectFailureClientOutdated}, "outdated", "client.outdated"},
		{&events.StreamReplaced{}, "replaced", "device.replaced"},
		{&events.LoggedOut{}, "logged_out", "device.logged-out"},
	}
	for _, c := range cases {
		var out bytes.Buffer
		e := &engine{out: newWire(&out)}
		e.handle(c.event)
		if got := e.endedBy(); got == nil || got.Reason != c.reason {
			t.Errorf("%T kept %+v, want %s", c.event, got, c.reason)
		}
		if want := `{"event":"connection","state":"` + c.state + `"}`; strings.TrimSpace(out.String()) != want {
			t.Errorf("%T went out as %s, want %s", c.event, out.String(), want)
		}
	}

	var out bytes.Buffer
	e := &engine{out: newWire(&out)}
	e.handle(&events.Disconnected{})
	if got := e.endedBy(); got != nil {
		t.Errorf("a dropped connection kept %+v; the engine reconnects after one", got)
	}
}

func TestARefusalGoesOnTheWireWithItsReasonAndAPlainOneWithout(t *testing.T) {
	var out bytes.Buffer
	wire := newWire(&out)
	wire.fail(1, classify(banned))
	wire.fail(2, classify(&failure{"not_found", "WhatsApp has no such chat"}))
	lines := bytes.Split(bytes.TrimSpace(out.Bytes()), []byte("\n"))
	var first, second struct{ Error map[string]string }
	_ = json.Unmarshal(lines[0], &first)
	_ = json.Unmarshal(lines[1], &second)
	if first.Error["reason"] != "account.banned" || first.Error["code"] != "permission_error" {
		t.Errorf("a ban went out as %s", lines[0])
	}
	if _, has := second.Error["reason"]; has {
		t.Errorf("a plain refusal went out with a reason: %s", lines[1])
	}
}

func TestABanWithAnEndCarriesItOnTheWireAndOneWithoutDoesNot(t *testing.T) {
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	if got := bannedFor(2*time.Hour, now); got.Until != "2026-10-17T14:00:00.000Z" || got.Reason != "account.banned" {
		t.Errorf("a two-hour ban became %+v", got)
	}
	if got := bannedFor(0, now); got.Until != "" {
		t.Errorf("a ban without an end got one: %+v", got)
	}
	if banned.Until != "" {
		t.Errorf("dating a ban changed the shared refusal: %+v", banned)
	}

	var out bytes.Buffer
	e := &engine{out: newWire(&out)}
	e.handle(&events.TemporaryBan{Expire: time.Hour})
	var line struct{ Event, State, Until string }
	_ = json.Unmarshal(out.Bytes(), &line)
	if line.State != "banned" || line.Until == "" || e.endedBy().Until != line.Until {
		t.Errorf("a dated ban went out as %s and was kept as %+v", out.String(), e.endedBy())
	}
}

func TestARequestCutOffByAnEndedConnectionAnswersWhyItEnded(t *testing.T) {
	var out bytes.Buffer
	e := &engine{out: newWire(&out)}
	if got := e.refusalFor("chat", whatsmeow.ErrNotConnected); got.Code != "network_error" {
		t.Errorf("before anything ended, not connected became %+v", got)
	}
	e.handle(&events.StreamReplaced{})
	if got := e.refusalFor("chat", whatsmeow.ErrNotConnected); got.Reason != "device.replaced" {
		t.Errorf("after the login was taken over, not connected became %+v", got)
	}
	if got := e.refusalFor("chat", &failure{"not_found", "WhatsApp has no such chat"}); got.Code != "not_found" {
		t.Errorf("a refusal of its own was replaced by why the connection ended: %+v", got)
	}
}
