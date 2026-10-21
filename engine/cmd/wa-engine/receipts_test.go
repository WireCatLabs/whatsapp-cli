package main

import (
	"bytes"
	"strings"
	"testing"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func receiptFrom(chat types.JID, kind types.ReceiptType, ids ...string) *events.Receipt {
	return &events.Receipt{
		MessageSource: types.MessageSource{Chat: chat, Sender: chat, IsGroup: chat.Server == types.GroupServer},
		MessageIDs:    ids,
		Timestamp:     sentAt,
		Type:          kind,
	}
}

func TestAReceiptFromTheOtherPersonNamesTheirChatByItsLID(t *testing.T) {
	stored[annPN.User] = annLID
	defer delete(stored, annPN.User)
	got := testConverter().receipts(receiptFrom(annPN, types.ReceiptTypeRead, "3EB0A", "3EB0B"))
	want := []waReceipt{
		{Chat: annLID.String(), ID: "3EB0A", Delivery: "read", At: "2026-09-01T10:00:00.000Z"},
		{Chat: annLID.String(), ID: "3EB0B", Delivery: "read", At: "2026-09-01T10:00:00.000Z"},
	}
	if len(got) != 2 || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("got %+v", got)
	}
}

func TestReceiptKindsBecomeDeliveredOrRead(t *testing.T) {
	cases := map[types.ReceiptType]string{
		types.ReceiptTypeDelivered:   "delivered",
		types.ReceiptTypeRead:        "read",
		types.ReceiptTypePlayed:      "read",
		types.ReceiptTypeSender:      "",
		types.ReceiptTypeReadSelf:    "",
		types.ReceiptTypePlayedSelf:  "",
		types.ReceiptTypeRetry:       "",
		types.ReceiptTypeServerError: "",
		types.ReceiptTypeInactive:    "",
		types.ReceiptTypePeerMsg:     "",
		types.ReceiptTypeHistorySync: "",
	}
	for kind, want := range cases {
		got := testConverter().receipts(receiptFrom(annLID, kind, "3EB0A"))
		if want == "" && len(got) != 0 || want != "" && (len(got) != 1 || got[0].Delivery != want) {
			t.Errorf("%q: got %+v, want %q", kind, got, want)
		}
	}
}

func TestReceiptsFromTheOwnersDevicesGroupsAndChannelsAreLeftOut(t *testing.T) {
	own := receiptFrom(annLID, types.ReceiptTypeRead, "3EB0A")
	own.IsFromMe = true
	newsletter := types.NewJID("120363000000000009", types.NewsletterServer)
	for name, evt := range map[string]*events.Receipt{
		"the owner's own device": own,
		"a group":                receiptFrom(group, types.ReceiptTypeRead, "3EB0A"),
		"a channel":              receiptFrom(newsletter, types.ReceiptTypeRead, "3EB0A"),
		"a status":               receiptFrom(types.StatusBroadcastJID, types.ReceiptTypeRead, "3EB0A"),
	} {
		if got := testConverter().receipts(evt); len(got) != 0 {
			t.Errorf("%s: got %+v", name, got)
		}
	}
}

func TestHandleSendsEachReceiptAsAReceiptLine(t *testing.T) {
	var out bytes.Buffer
	e := &engine{out: newWire(&out), conv: testConverter()}
	e.handle(receiptFrom(annLID, types.ReceiptTypeDelivered, "3EB0A"))
	want := `{"event":"receipt","receipt":{"chat":"100000000000002@lid","id":"3EB0A","delivery":"delivered","at":"2026-09-01T10:00:00.000Z"}}`
	if got := strings.TrimSpace(out.String()); got != want {
		t.Errorf("got %s", got)
	}
}

func TestAPushCarriesHowFarTheOwnersOneToOneMessagesGot(t *testing.T) {
	web := func(id string, fromMe bool, status waWeb.WebMessageInfo_Status) *waHistorySync.HistorySyncMsg {
		return &waHistorySync.HistorySyncMsg{Message: &waWeb.WebMessageInfo{
			Key:    &waCommon.MessageKey{ID: proto.String(id), FromMe: proto.Bool(fromMe)},
			Status: status.Enum(),
		}}
	}
	data := &waHistorySync.HistorySync{
		SyncType: waHistorySync.HistorySync_INITIAL_BOOTSTRAP.Enum(),
		Conversations: []*waHistorySync.Conversation{
			{ID: proto.String(annLID.String()), Messages: []*waHistorySync.HistorySyncMsg{
				web("READ", true, waWeb.WebMessageInfo_READ),
				web("PLAYED", true, waWeb.WebMessageInfo_PLAYED),
				web("DELIVERED", true, waWeb.WebMessageInfo_DELIVERY_ACK),
				web("SENT", true, waWeb.WebMessageInfo_SERVER_ACK),
				web("THEIRS", false, waWeb.WebMessageInfo_READ),
			}},
			{ID: proto.String(group.String()), Messages: []*waHistorySync.HistorySyncMsg{
				web("GROUP", true, waWeb.WebMessageInfo_READ),
			}},
		},
	}
	parse := func(chat types.JID, w *waWeb.WebMessageInfo) (*events.Message, error) {
		sender := chat
		if w.GetKey().GetFromMe() {
			sender = selfLID
		}
		evt := incoming(chat, sender, text("hi"))
		evt.Info.ID = w.GetKey().GetID()
		evt.Info.IsFromMe = w.GetKey().GetFromMe()
		return evt, nil
	}
	got := map[string]string{}
	for _, m := range testConverter().history(data, parse).Messages {
		got[m.ID] = ""
		if m.Delivery != nil {
			got[m.ID] = *m.Delivery
		}
	}
	want := map[string]string{"READ": "read", "PLAYED": "read", "DELIVERED": "delivered", "SENT": "", "THEIRS": "", "GROUP": ""}
	for id, delivery := range want {
		if d, ok := got[id]; !ok || d != delivery {
			t.Errorf("%s: got %q (held %v), want %q", id, d, ok, delivery)
		}
	}
}
