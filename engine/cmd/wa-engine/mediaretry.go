package main

import (
	"errors"
	"io"
	"os"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waMmsRetry"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// retryWait bounds how long the phone may take to upload a file again. mautrix-whatsapp waits 30 s
// (connector/directmedia.go, requestAndWaitDirectMedia); this one is shorter, so a download, the wait and the second
// download fit in cli-core's default 30 s command deadline more often than not.
var retryWait = 20 * time.Second

// expired is the download failure WhatsApp's apps answer by asking the phone to upload the file again: whatsmeow's
// SendMediaRetryReceipt names 404 and 410; mautrix-whatsapp also retries 403 (connector/directmedia.go).
func expired(err error) bool {
	return errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith404) ||
		errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith410) ||
		errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith403)
}

// retryWaiter hands each phone answer to the downloads waiting for its message. Several downloads run at once, so
// answers are matched by message id alone: the chat and sender may come back in another form than they were sent.
type retryWaiter struct {
	mu   sync.Mutex
	asks map[string][]chan *events.MediaRetry
}

func (w *retryWaiter) wait(id string) chan *events.MediaRetry {
	answer := make(chan *events.MediaRetry, 1)
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.asks == nil {
		w.asks = map[string][]chan *events.MediaRetry{}
	}
	w.asks[id] = append(w.asks[id], answer)
	return answer
}

func (w *retryWaiter) forget(id string, answer chan *events.MediaRetry) {
	w.mu.Lock()
	defer w.mu.Unlock()
	kept := w.asks[id][:0]
	for _, one := range w.asks[id] {
		if one != answer {
			kept = append(kept, one)
		}
	}
	if len(kept) == 0 {
		delete(w.asks, id)
	} else {
		w.asks[id] = kept
	}
}

// deliver never blocks the event handler: an answer nobody waits for any more is dropped.
func (w *retryWaiter) deliver(evt *events.MediaRetry) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, answer := range w.asks[string(evt.MessageID)] {
		select {
		case answer <- evt:
		default:
		}
	}
}

// retryInfo is the message as SendMediaRetryReceipt addresses it, built as mautrix-whatsapp builds it
// (connector/mediarequest.go, sendMediaRequestDirect).
func retryInfo(t target, sender types.JID) *types.MessageInfo {
	return &types.MessageInfo{ID: t.id, MessageSource: types.MessageSource{
		Chat: t.chat, Sender: sender, IsFromMe: t.mine(), IsGroup: t.inGroup(),
	}}
}

// What the retry can answer, each with a reason, so a caller tells the outcomes apart without reading the words
// (WC-OUT-15).
var (
	notOnPhone = because("media.not-on-phone", "not_found",
		"neither WhatsApp nor the phone keeps this file any more; ask the sender to send it again")
	phoneCannotDecrypt = because("media.phone-cannot-decrypt", "not_found",
		"the phone could not read the request for this file; ask the sender to send it again")
	phoneAnswerUnreadable = because("media.phone-answer-unreadable", "provider_error",
		"the phone's answer about this file could not be read")
	phoneFailed = because("media.phone-failed", "provider_error",
		"the phone could not upload this file again; it must be online, with WhatsApp able to connect")
	phoneTimeout = because("media.phone-timeout", "timeout",
		"the phone did not upload this file again in time; it must be online, with WhatsApp able to connect")
	retryStopped = because("engine.stopped", "provider_unavailable", "the engine stopped before the phone answered")
	againFailed  = because("media.retry-failed", "provider_error",
		"the phone uploaded this file again, but the new copy did not download")
)

// reuploadedPath reads the phone's answer. A new path counts even with an error result, as mautrix-whatsapp takes it
// (connector/directmedia.go, receiveDirectMediaRetry).
func reuploadedPath(evt *events.MediaRetry, mediaKey []byte) (string, error) {
	notice, err := whatsmeow.DecryptMediaRetryNotification(evt, mediaKey)
	switch {
	case errors.Is(err, whatsmeow.ErrMediaNotAvailableOnPhone):
		return "", notOnPhone
	case err != nil:
		return "", phoneAnswerUnreadable
	case notice.GetDirectPath() != "":
		return notice.GetDirectPath(), nil
	}
	switch notice.GetResult() {
	case waMmsRetry.MediaRetryNotification_NOT_FOUND:
		return "", notOnPhone
	case waMmsRetry.MediaRetryNotification_DECRYPTION_ERROR:
		return "", phoneCannotDecrypt
	}
	return "", phoneFailed
}

// reupload asks the account's own phone to upload a file WhatsApp no longer keeps, and answers its new path. The
// receipt goes to the owner's phone (whatsmeow sends it to the account's own JID), not to the sender; it is what
// WhatsApp's apps send when a file will not download, and only a download the owner asked for reaches it.
func (e *engine) reupload(req request, ref *waMediaRef) (string, error) {
	t, err := targetOf(req)
	if err != nil {
		return "", err
	}
	sender := e.quotedSender(t.chat, quote{FromMe: t.mine(), Sender: req.Sender})
	answer := e.retries.wait(t.id)
	defer e.retries.forget(t.id, answer)
	if err := e.client.SendMediaRetryReceipt(e.ctx, retryInfo(t, sender), ref.MediaKey); err != nil {
		return "", err
	}
	select {
	case evt := <-answer:
		return reuploadedPath(evt, ref.MediaKey)
	case <-time.After(retryWait):
		return "", phoneTimeout
	case <-e.ctx.Done():
		return "", retryStopped
	}
}

// refreshed is a download's answer after the phone uploaded the file again: the new copy's path, which the adapter
// keeps in the stored ref so a later download or a forward does not use the dead one. Only the path changes: the phone
// uploads the same encrypted file, as mautrix-whatsapp takes it (connector/directmedia.go, receiveDirectMediaRetry,
// sets DirectPath alone). A download WhatsApp still served answers nil, which goes out as null.
type refreshed struct {
	DirectPath string `json:"directPath"`
}

// fetchAgain downloads a file WhatsApp no longer keeps once more, from the path the phone's new upload has, and
// answers that path. A success is the one sign the retry ran, so it goes to WA_ENGINE_LOG, in fixed words.
func (e *engine) fetchAgain(req request, ref *waMediaRef, media whatsmeow.MediaType, file *os.File) (*refreshed, error) {
	path, err := e.reupload(req, ref)
	if err != nil {
		return nil, err
	}
	if err := file.Truncate(0); err != nil {
		return nil, err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	again := *ref
	again.DirectPath = path
	if err := e.fetch(&again, media, file); err != nil {
		return nil, againFailed
	}
	e.client.Log.Warnf("media.reuploaded: the phone uploaded a file WhatsApp no longer kept, and the new copy downloaded")
	return &refreshed{DirectPath: path}, nil
}
