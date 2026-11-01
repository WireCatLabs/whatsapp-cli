// wa-probe links a real account and records what WhatsApp pushes, as totals only.
// It never stores message text, names or numbers, and sends nothing unless asked with send-self.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

type syncBatch struct {
	At            time.Time `json:"at"`
	Type          string    `json:"type"`
	Chunk         uint32    `json:"chunk"`
	Progress      uint32    `json:"progress"`
	Conversations int       `json:"conversations"`
	Messages      int       `json:"messages"`
	LIDChats      int       `json:"lidChats"`
	PhoneChats    int       `json:"phoneChats"`
	GroupChats    int       `json:"groupChats"`
}

type stats struct {
	mu             sync.Mutex
	path           string
	StartedAt      time.Time      `json:"startedAt"`
	PairedAt       *time.Time     `json:"pairedAt,omitempty"`
	ConnectedAt    *time.Time     `json:"connectedAt,omitempty"`
	OfflineSynced  *int           `json:"offlineSyncedCount,omitempty"`
	HistoryBatches []syncBatch    `json:"historyBatches"`
	TotalMessages  int            `json:"totalHistoryMessages"`
	LiveMessages   int            `json:"liveMessages"`
	Events         map[string]int `json:"events"`
	Alerts         []string       `json:"alerts"`
	Contacts       int            `json:"contacts"`
	FinishedAt     *time.Time     `json:"finishedAt,omitempty"`
}

func (s *stats) save() {
	data, _ := json.MarshalIndent(s, "", "  ")
	tmp := s.path + ".tmp"
	if os.WriteFile(tmp, data, 0o600) == nil {
		os.Rename(tmp, s.path)
	}
}

func (s *stats) update(fn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	fn()
	s.save()
}

func now() *time.Time { t := time.Now().UTC(); return &t }

func main() {
	if len(os.Args) < 2 {
		fail("usage: wa-probe link <phone> [minutes] | send-self")
	}
	dataDir := os.Getenv("WA_PROBE_DIR")
	if dataDir == "" {
		home, _ := os.UserHomeDir()
		dataDir = filepath.Join(home, ".local", "share", "whatsapp-cli", "probe")
	}
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		fail(err.Error())
	}
	if err := os.Chmod(dataDir, 0o700); err != nil {
		fail(err.Error())
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client, logFile := newClient(ctx, dataDir)
	defer logFile.Close()

	switch os.Args[1] {
	case "link":
		if len(os.Args) < 3 {
			fail("usage: wa-probe link <phone> [minutes]")
		}
		minutes := 15
		if len(os.Args) > 3 {
			fmt.Sscan(os.Args[3], &minutes)
		}
		link(ctx, client, dataDir, os.Args[2], time.Duration(minutes)*time.Minute)
	case "send-self":
		sendSelf(ctx, client)
	case "full":
		if len(os.Args) < 4 {
			fail("usage: wa-probe full <from-unix> <days>")
		}
		var from int64
		var days int
		fmt.Sscan(os.Args[2], &from)
		fmt.Sscan(os.Args[3], &days)
		full(ctx, client, from, days)
	case "chunk":
		if len(os.Args) < 4 {
			fail("usage: wa-probe chunk <sync-type> <order> [notification-id]")
		}
		var order uint32
		fmt.Sscan(os.Args[3], &order)
		id := ""
		if len(os.Args) > 4 {
			id = os.Args[4]
		}
		chunk(ctx, client, os.Args[2], order, id)
	case "older":
		if len(os.Args) < 3 {
			fail("usage: wa-probe older <chat-jid> [anchor-id]")
		}
		anchor := ""
		if len(os.Args) > 3 {
			anchor = os.Args[3]
		}
		older(ctx, client, os.Args[2], anchor)
	default:
		fail("unknown command " + os.Args[1])
	}
}

func newClient(ctx context.Context, dataDir string) (*whatsmeow.Client, *os.File) {
	logFile, err := os.OpenFile(filepath.Join(dataDir, "whatsmeow.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		fail(err.Error())
	}
	logger := waLog.Zerolog(zerolog.New(logFile).With().Timestamp().Logger().Level(zerolog.InfoLevel))

	session := os.Getenv("WA_PROBE_STORE")
	if session == "" {
		session = filepath.Join(dataDir, "session.db")
	}
	dsn := "file:" + session +
		"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		fail(err.Error())
	}
	container := sqlstore.NewWithDB(db, "sqlite", logger.Sub("db"))
	if err := container.Upgrade(ctx); err != nil {
		fail(err.Error())
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		fail(err.Error())
	}

	// Desktop with full sync asks the phone for all history, not the last few months.
	// These props travel in the pairing handshake, so they only matter for a new link.
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_DESKTOP.Enum()
	store.DeviceProps.RequireFullSync = proto.Bool(true)
	// The phone lists the device under this name; it says the host system, never this tool (CLAUDE.md rule 7).
	store.SetOSInfo(osName(), [3]uint32{0, 1, 0})

	return whatsmeow.NewClient(device, logger.Sub("client")), logFile
}

func link(ctx context.Context, client *whatsmeow.Client, dataDir, phone string, listenFor time.Duration) {
	phone = strings.TrimLeft(strings.ReplaceAll(phone, " ", ""), "+")
	st := &stats{path: filepath.Join(dataDir, "stats.json"), StartedAt: time.Now().UTC(), Events: map[string]int{}}
	st.save()

	stopNow := make(chan string, 1)
	client.AddEventHandler(func(raw any) {
		name := fmt.Sprintf("%T", raw)
		st.update(func() { st.Events[strings.TrimPrefix(name, "*events.")]++ })
		switch evt := raw.(type) {
		case *events.PairSuccess:
			st.update(func() { st.PairedAt = now() })
			fmt.Println("Linked. Receiving history; keep your phone online and WhatsApp open.")
		case *events.Connected:
			st.update(func() { st.ConnectedAt = now() })
		case *events.OfflineSyncCompleted:
			st.update(func() { c := evt.Count; st.OfflineSynced = &c })
		case *events.HistorySync:
			b := summarize(evt)
			st.update(func() {
				st.HistoryBatches = append(st.HistoryBatches, b)
				st.TotalMessages += b.Messages
			})
			fmt.Printf("history %s chunk %d: %d chats, %d messages (progress %d%%)\n",
				b.Type, b.Chunk, b.Conversations, b.Messages, b.Progress)
		case *events.Message:
			st.update(func() { st.LiveMessages++ })
		case *events.TemporaryBan:
			alert(st, stopNow, "temporary ban: "+evt.String())
		case *events.LoggedOut:
			alert(st, stopNow, fmt.Sprintf("logged out (reason %d)", evt.Reason))
		case *events.StreamReplaced:
			alert(st, stopNow, "another process took over this login")
		case *events.ConnectFailure:
			alert(st, stopNow, fmt.Sprintf("connect failure %d: %s", evt.Reason, evt.Message))
		case *events.ClientOutdated:
			alert(st, stopNow, "WhatsApp says this client version is outdated")
		}
	})

	if client.Store.ID == nil {
		qr, _ := client.GetQRChannel(ctx)
		if err := client.Connect(); err != nil {
			fail(err.Error())
		}
		if !pair(ctx, client, qr, phone) {
			return
		}
	} else {
		fmt.Println("Already linked; listening.")
		if err := client.Connect(); err != nil {
			fail(err.Error())
		}
	}

	fmt.Printf("Listening until %s for more events. Ctrl+C stops early and saves the totals.\n",
		time.Now().Add(listenFor).Format("15:04 MST"))
	select {
	case <-ctx.Done():
		fmt.Println("Stopped.")
	case reason := <-stopNow:
		fmt.Println("Stopped: " + reason)
	case <-time.After(listenFor):
		fmt.Printf("Done after %s.\n", listenFor)
	}
	if contacts, err := client.Store.Contacts.GetAllContacts(context.Background()); err == nil {
		st.update(func() { st.Contacts = len(contacts) })
	}
	st.update(func() { st.FinishedAt = now() })
	client.Disconnect()
	fmt.Println("Totals written to " + st.path)
}

func pair(ctx context.Context, client *whatsmeow.Client, qr <-chan whatsmeow.QRChannelItem, phone string) bool {
	requested := false
	for {
		select {
		case <-ctx.Done():
			return false
		case item, ok := <-qr:
			if !ok {
				fail("pairing channel closed")
			}
			switch {
			case item.Event == whatsmeow.QRChannelEventCode:
				if requested {
					continue
				}
				code, err := client.PairPhone(ctx, phone, true, whatsmeow.PairClientChrome, "Chrome (Linux)")
				if err != nil {
					fail("pairing code: " + err.Error())
				}
				requested = true
				fmt.Println()
				fmt.Println("Pairing code: " + code)
				fmt.Println("On the phone: tap the WhatsApp notification, or go to Settings > Linked devices >")
				fmt.Println("Link a device > Link with phone number instead, and enter the code. It expires in ~2 minutes.")
				fmt.Println()
			case item == whatsmeow.QRChannelSuccess:
				return true
			default:
				fail("pairing ended: " + item.Event)
			}
		}
	}
}

func summarize(evt *events.HistorySync) syncBatch {
	b := syncBatch{
		At:            time.Now().UTC(),
		Type:          evt.Data.GetSyncType().String(),
		Chunk:         evt.Data.GetChunkOrder(),
		Progress:      evt.Data.GetProgress(),
		Conversations: len(evt.Data.GetConversations()),
	}
	for _, conv := range evt.Data.GetConversations() {
		b.Messages += len(conv.GetMessages())
		switch id := conv.GetID(); {
		case strings.HasSuffix(id, "@lid"):
			b.LIDChats++
		case strings.HasSuffix(id, "@s.whatsapp.net"):
			b.PhoneChats++
		case strings.HasSuffix(id, "@g.us"):
			b.GroupChats++
		}
	}
	return b
}

func alert(st *stats, stopNow chan<- string, msg string) {
	st.update(func() { st.Alerts = append(st.Alerts, msg) })
	fmt.Println("ALERT: " + msg)
	select {
	case stopNow <- msg:
	default:
	}
}

func sendSelf(ctx context.Context, client *whatsmeow.Client) {
	if client.Store.ID == nil {
		fail("not linked; run link first")
	}
	if err := client.Connect(); err != nil {
		fail(err.Error())
	}
	defer client.Disconnect()
	waitCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if !client.WaitForConnection(30 * time.Second) {
		fail("could not connect within 30s")
	}
	self := client.Store.ID.ToNonAD()
	text := "whatsapp-cli test " + time.Now().UTC().Format(time.RFC3339)
	resp, err := client.SendMessage(waitCtx, self, &waE2E.Message{Conversation: proto.String(text)})
	if err != nil {
		fail("send: " + err.Error())
	}
	fmt.Printf("Sent to your own chat. Message ID %s, server time %s\n", resp.ID, resp.Timestamp.UTC().Format(time.RFC3339))
}

// older asks the phone for one on-demand page of chat, counting back from anchor, or from no known message at all
// when anchor is empty. It prints counts and times only: message text never reaches the terminal.
func older(ctx context.Context, client *whatsmeow.Client, chatArg, anchor string) {
	if client.Store.ID == nil {
		fail("not linked")
	}
	chat, err := types.ParseJID(chatArg)
	if err != nil {
		fail(err.Error())
	}
	info := types.MessageInfo{
		MessageSource: types.MessageSource{Chat: chat, IsFromMe: os.Getenv("WA_PROBE_FROM_ME") == "1"},
		ID:            anchor,
		Timestamp:     time.Now(),
	}
	if at := os.Getenv("WA_PROBE_AT"); at != "" {
		var unix int64
		fmt.Sscan(at, &unix)
		info.Timestamp = time.Unix(unix, 0)
	}
	probeAsk(ctx, client, client.BuildHistorySyncRequest(&info, 50), fmt.Sprintf("50 messages of %s, anchor id %q", chat, anchor), 60*time.Second)
}

func probeAsk(ctx context.Context, client *whatsmeow.Client, ask *waE2E.Message, what string, wait time.Duration) {
	if client.Store.ID == nil {
		fail("not linked")
	}
	answered := make(chan struct{}, 64)
	client.AddEventHandler(func(evt any) {
		if msg, ok := evt.(*events.Message); ok {
			if pm := msg.Message.GetProtocolMessage(); pm != nil {
				resp := pm.GetPeerDataOperationRequestResponseMessage()
				fmt.Printf("protocol message type=%s peer-response-type=%s results=%d\n", pm.GetType(),
					resp.GetPeerDataOperationRequestType(), len(resp.GetPeerDataOperationResult()))
				for _, r := range resp.GetPeerDataOperationResult() {
					fmt.Printf("  result: %s\n", r.String()[:min(300, len(r.String()))])
				}
			}
			return
		}
		hs, ok := evt.(*events.HistorySync)
		if !ok {
			return
		}
		data := hs.Data
		fmt.Printf("history push type=%s conversations=%d\n", data.GetSyncType(), len(data.GetConversations()))
		for _, conv := range data.GetConversations() {
			var oldest, newest uint64
			for _, m := range conv.GetMessages() {
				ts := m.GetMessage().GetMessageTimestamp()
				if oldest == 0 || ts < oldest {
					oldest = ts
				}
				if ts > newest {
					newest = ts
				}
			}
			fmt.Printf("  chat=%s messages=%d oldest=%s newest=%s\n", conv.GetID(), len(conv.GetMessages()),
				time.Unix(int64(oldest), 0).UTC().Format(time.RFC3339), time.Unix(int64(newest), 0).UTC().Format(time.RFC3339))
		}
		{
			select {
			case answered <- struct{}{}:
			default:
			}
		}
	})
	if err := client.Connect(); err != nil {
		fail(err.Error())
	}
	defer client.Disconnect()
	if !client.WaitForConnection(30 * time.Second) {
		fail("could not connect within 30s")
	}
	own := client.Store.GetJID().ToNonAD()
	if _, err := client.SendMessage(ctx, own, ask, whatsmeow.SendRequestExtra{Peer: true}); err != nil {
		fail("ask: " + err.Error())
	}
	fmt.Printf("asked the phone for %s; waiting %s\n", what, wait)
	deadline := time.After(wait)
	got := 0
	for {
		select {
		case <-answered:
			got++
		case <-deadline:
			if got == 0 {
				fmt.Println("no history answer")
			}
			return
		case <-ctx.Done():
			return
		}
	}
}

// full asks the phone to push history from a time over a number of days, with no message to count back from.
func full(ctx context.Context, client *whatsmeow.Client, from int64, days int) {
	ask := &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{
		Type: waE2E.ProtocolMessage_PEER_DATA_OPERATION_REQUEST_MESSAGE.Enum(),
		PeerDataOperationRequestMessage: &waE2E.PeerDataOperationRequestMessage{
			PeerDataOperationRequestType: waE2E.PeerDataOperationRequestType_FULL_HISTORY_SYNC_ON_DEMAND.Enum(),
			FullHistorySyncOnDemandRequest: &waE2E.PeerDataOperationRequestMessage_FullHistorySyncOnDemandRequest{
				RequestMetadata:   &waE2E.FullHistorySyncOnDemandRequestMetadata{RequestID: proto.String(client.GenerateMessageID())},
				HistorySyncConfig: store.DeviceProps.HistorySyncConfig,
				FullHistorySyncOnDemandConfig: &waE2E.FullHistorySyncOnDemandConfig{
					HistoryFromTimestamp: proto.Uint64(uint64(from)),
					HistoryDurationDays:  proto.Uint32(uint32(days)),
				},
			},
		},
	}}
	probeAsk(ctx, client, ask, fmt.Sprintf("full history from %s for %d days", time.Unix(from, 0).UTC().Format(time.RFC3339), days), 120*time.Second)
}

// chunk asks the phone to send one chunk of the link-time history push again.
func chunk(ctx context.Context, client *whatsmeow.Client, kind string, order uint32, id string) {
	syncType := waE2E.HistorySyncType(waE2E.HistorySyncType_value[kind])
	retry := &waE2E.PeerDataOperationRequestMessage_HistorySyncChunkRetryRequest{
		SyncType: syncType.Enum(), ChunkOrder: proto.Uint32(order), RegenerateChunk: proto.Bool(true),
	}
	if id != "" {
		retry.ChunkNotificationID = proto.String(id)
	}
	ask := &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{
		Type: waE2E.ProtocolMessage_PEER_DATA_OPERATION_REQUEST_MESSAGE.Enum(),
		PeerDataOperationRequestMessage: &waE2E.PeerDataOperationRequestMessage{
			PeerDataOperationRequestType: waE2E.PeerDataOperationRequestType_HISTORY_SYNC_CHUNK_RETRY.Enum(),
			HistorySyncChunkRetryRequest: retry,
		},
	}}
	probeAsk(ctx, client, ask, fmt.Sprintf("chunk %d of %s again", order, syncType), 60*time.Second)
}

func osName() string {
	switch runtime.GOOS {
	case "darwin":
		return "Mac OS"
	case "windows":
		return "Windows"
	default:
		return "Linux"
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "wa-probe: "+msg)
	os.Exit(1)
}
