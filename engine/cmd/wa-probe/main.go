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

	dsn := "file:" + filepath.Join(dataDir, "session.db") +
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
