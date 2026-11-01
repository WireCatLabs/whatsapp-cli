package main

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types/events"
)

// historyWait bounds how long close waits for a history push still downloading. The CLI kills the engine 5 s after
// it asks it to close (CLOSE_WAIT_MS in src/engine/go-engine.ts); the rest is left for the disconnect.
var historyWait = 3 * time.Second

// historyDownloads takes over whatsmeow's own history loop (message.go, handleHistorySyncNotificationLoop), one push
// at a time in arrival order as that loop does, so that close can wait for the one in flight. Each push is kept in
// the device store before it gets here (historypushes.go), and acknowledged only once handed on: an exit
// mid-download leaves it for the next listening run instead of losing it.
type historyDownloads struct {
	fetch   func(context.Context, *waE2E.HistorySyncNotification) (*waHistorySync.HistorySync, error)
	deliver func(context.Context, *events.HistorySync)
	// after answers for a push with an id once it is handed on (ok) or its download failed.
	after func(ctx context.Context, id string, ok bool)

	queue chan queuedPush
	mu    sync.Mutex
	open  int
	idle  chan struct{} // closed while nothing is queued or in flight
}

func newHistoryDownloads(
	fetch func(context.Context, *waE2E.HistorySyncNotification) (*waHistorySync.HistorySync, error),
	deliver func(context.Context, *events.HistorySync),
) *historyDownloads {
	idle := make(chan struct{})
	close(idle)
	h := &historyDownloads{fetch: fetch, deliver: deliver, queue: make(chan queuedPush, 32), idle: idle}
	go h.loop(context.Background())
	return h
}

// downloadsFor downloads with whatsmeow's storage done before the batch is handed on: the push's phone-to-LID
// mappings are what its re-keys are read from, and an exit would lose storage still running in the background.
func downloadsFor(client *whatsmeow.Client, handle func(any)) *historyDownloads {
	return newHistoryDownloads(
		func(ctx context.Context, n *waE2E.HistorySyncNotification) (*waHistorySync.HistorySync, error) {
			return client.DownloadHistorySync(ctx, n, true)
		},
		func(ctx context.Context, evt *events.HistorySync) {
			// whatsmeow's dispatch survives a handler's panic and still deletes the blob; so does this.
			func() {
				defer func() {
					if recover() != nil {
						fmt.Fprintln(os.Stderr, "wa-engine: a history push could not be handled")
					}
				}()
				handle(evt)
			}()
			n := evt.Notification
			_ = client.DeleteMedia(ctx, whatsmeow.MediaHistory, n.GetDirectPath(), n.GetFileEncSHA256(), n.GetEncHandle())
		},
	)
}

type queuedPush struct {
	id           string
	notification *waE2E.HistorySyncNotification
}

func (h *historyDownloads) add(n *waE2E.HistorySyncNotification) { h.addKept("", n) }

// addKept queues a push kept under id, the announcing message's id.
func (h *historyDownloads) addKept(id string, n *waE2E.HistorySyncNotification) {
	h.mu.Lock()
	if h.open == 0 {
		h.idle = make(chan struct{})
	}
	h.open++
	h.mu.Unlock()
	h.queue <- queuedPush{id: id, notification: n}
}

func (h *historyDownloads) loop(ctx context.Context) {
	for push := range h.queue {
		h.one(ctx, push)
	}
}

func (h *historyDownloads) one(ctx context.Context, push queuedPush) {
	defer h.done()
	n := push.notification
	data, err := h.fetch(ctx, n)
	if err != nil {
		fmt.Fprintln(os.Stderr, "wa-engine: a history push could not be downloaded")
		if h.after != nil {
			h.after(ctx, push.id, false)
		}
		return
	}
	h.deliver(ctx, &events.HistorySync{Data: data, Notification: n})
	if h.after != nil {
		h.after(ctx, push.id, true)
	}
}

func (h *historyDownloads) done() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.open--
	if h.open == 0 {
		close(h.idle)
	}
}

// settled waits until every push announced so far is handed on, or `wait` passes; it answers which came first.
func (h *historyDownloads) settled(wait time.Duration) bool {
	if h == nil {
		return true
	}
	h.mu.Lock()
	idle := h.idle
	h.mu.Unlock()
	select {
	case <-idle:
		return true
	case <-time.After(wait):
		return false
	}
}
