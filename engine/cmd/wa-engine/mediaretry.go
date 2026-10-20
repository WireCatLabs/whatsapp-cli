package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waMmsRetry"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"go.mau.fi/whatsmeow/util/cbcutil"
	"go.mau.fi/whatsmeow/util/hkdfutil"
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

// reuploadedPath reads the phone's answer: the new path and the phone's result. A new path counts even with an error
// result, as mautrix-whatsapp takes it (connector/directmedia.go, receiveDirectMediaRetry); the result is kept, so a
// download from that path that fails answers what the phone said instead of claiming it uploaded the file.
func reuploadedPath(
	evt *events.MediaRetry, mediaKey []byte,
) (string, waMmsRetry.MediaRetryNotification_ResultType, error) {
	notice, err := whatsmeow.DecryptMediaRetryNotification(evt, mediaKey)
	switch {
	case errors.Is(err, whatsmeow.ErrMediaNotAvailableOnPhone):
		return "", 0, notOnPhone
	case err != nil:
		return "", 0, phoneAnswerUnreadable
	case notice.GetDirectPath() != "":
		return notice.GetDirectPath(), notice.GetResult(), nil
	}
	return "", notice.GetResult(), phoneRefusal(notice.GetResult())
}

func phoneRefusal(result waMmsRetry.MediaRetryNotification_ResultType) *refusal {
	switch result {
	case waMmsRetry.MediaRetryNotification_NOT_FOUND:
		return notOnPhone
	case waMmsRetry.MediaRetryNotification_DECRYPTION_ERROR:
		return phoneCannotDecrypt
	}
	return phoneFailed
}

// downloadCause names why a download failed in fixed words. Never err.Error(): a network error quotes the whole media
// URL, its tokens with it (WC-SECR-1).
func downloadCause(err error) string {
	var status whatsmeow.DownloadHTTPError
	var network net.Error
	switch {
	case errors.As(err, &status) && status.Response != nil:
		return fmt.Sprintf("WhatsApp answered HTTP %d", status.StatusCode)
	case errors.Is(err, whatsmeow.ErrInvalidMediaEncSHA256):
		return "the encrypted file did not match its checksum"
	case errors.Is(err, whatsmeow.ErrInvalidMediaHMAC):
		return "the file did not match its key"
	case errors.Is(err, whatsmeow.ErrInvalidMediaSHA256), errors.Is(err, whatsmeow.ErrInvalidUnencryptedMediaSHA256):
		return "the decrypted file did not match its checksum"
	case errors.Is(err, whatsmeow.ErrTooShortFile):
		return "the file was too short"
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return "the download ran out of time"
	case errors.As(err, &network):
		return "a network error"
	}
	return "an unclassified error"
}

// refetchFailure answers a download from the phone's new path that failed: what the phone said when its result was an
// error, else media.retry-failed, each with the cause and whether the phone gave the expired path back, so a live run
// without WA_ENGINE_LOG still tells a dead path from a file that does not match.
func refetchFailure(result waMmsRetry.MediaRetryNotification_ResultType, samePath bool, cause string) *refusal {
	failed := againFailed
	if result != waMmsRetry.MediaRetryNotification_SUCCESS {
		failed = phoneRefusal(result)
	}
	message := failed.Message + ": " + cause
	if samePath {
		message += "; the phone gave the expired path back"
	}
	return because(failed.Reason, failed.Code, message)
}

// reupload asks the account's own phone to upload a file WhatsApp no longer keeps, and answers its new path. The
// receipt goes to the owner's phone (whatsmeow sends it to the account's own JID), not to the sender; it is what
// WhatsApp's apps send when a file will not download, and only a download the owner asked for reaches it.
func (e *engine) reupload(
	req request, ref *waMediaRef,
) (string, waMmsRetry.MediaRetryNotification_ResultType, error) {
	t, err := targetOf(req)
	if err != nil {
		return "", 0, err
	}
	sender := e.quotedSender(t.chat, quote{FromMe: t.mine(), Sender: req.Sender})
	answer := e.retries.wait(t.id)
	defer e.retries.forget(t.id, answer)
	if err := e.client.SendMediaRetryReceipt(e.ctx, retryInfo(t, sender), ref.MediaKey); err != nil {
		return "", 0, err
	}
	select {
	case evt := <-answer:
		path, result, err := reuploadedPath(evt, ref.MediaKey)
		if errors.Is(err, phoneAnswerUnreadable) && evt.Error != nil {
			e.client.Log.Warnf("media.phone-answer-unreadable: WhatsApp answered error code %d", evt.Error.Code)
		}
		return path, result, err
	case <-time.After(retryWait):
		return "", 0, phoneTimeout
	case <-e.ctx.Done():
		return "", 0, retryStopped
	}
}

// refreshed is a download's answer after the phone uploaded the file again: the new copy's path, which the adapter
// keeps in the stored ref so a later download or a forward does not use the dead one. Usually only the path changes,
// as mautrix-whatsapp takes it (connector/directmedia.go, receiveDirectMediaRetry, sets DirectPath alone); a copy the
// phone encrypted again carries its new checksums too, or the next download and a forward would fail on the old ones.
// A download WhatsApp still served answers nil, which goes out as null.
type refreshed struct {
	DirectPath    string `json:"directPath"`
	FileSHA256    []byte `json:"fileSha256,omitempty"`
	FileEncSHA256 []byte `json:"fileEncSha256,omitempty"`
}

// fetchAgain downloads a file WhatsApp no longer keeps once more, from the path the phone's new upload has, and
// answers that path. A success is the one sign the retry ran, so it goes to WA_ENGINE_LOG, in fixed words; so does a
// failure, with the first download's cause, the phone's result and whether its path is the dead one again.
func (e *engine) fetchAgain(
	req request, ref *waMediaRef, media whatsmeow.MediaType, file *os.File, first error,
) (*refreshed, error) {
	path, result, err := e.reupload(req, ref)
	if err != nil {
		return nil, err
	}
	same := path == ref.DirectPath
	fail := func(cause string) (*refreshed, error) {
		e.client.Log.Warnf("media.refetch-failed: first download: %s; the phone answered %s, same path as before: %t; "+
			"the new copy: %s", downloadCause(first), result, same, cause)
		return nil, refetchFailure(result, same, cause)
	}
	if !strings.HasPrefix(path, "/") {
		return fail("the phone's answer held no usable path")
	}
	if err := rewind(file); err != nil {
		return nil, err
	}
	again := *ref
	again.DirectPath = path
	err = e.fetch(&again, media, file)
	if !otherChecksums(err) {
		if err != nil {
			return fail(downloadCause(err))
		}
		e.client.Log.Warnf("media.reuploaded: the phone uploaded a file WhatsApp no longer kept, and the new copy downloaded")
		return &refreshed{DirectPath: path}, nil
	}
	if err := rewind(file); err != nil {
		return nil, err
	}
	if err := e.client.DownloadMediaWithPathToFile(e.ctx, path, nil, nil, nil, media, "", true, file); err != nil {
		return fail(downloadCause(err))
	}
	renewed, err := openReencrypted(file, ref.MediaKey, media)
	if err != nil {
		return fail(downloadCause(err))
	}
	renewed.DirectPath = path
	e.client.Log.Warnf("media.reuploaded: the phone encrypted a file WhatsApp no longer kept again, and the new copy " +
		"downloaded under the stored key")
	return renewed, nil
}

// otherChecksums is a copy from the phone's new upload that fails only the stored checksums. The phone can encrypt the
// file again from what it keeps, and the key fixes the cipher's IV, so a changed file changes both checksums; only
// the file's MAC still proves the copy was made by someone holding the stored key.
func otherChecksums(err error) bool {
	return errors.Is(err, whatsmeow.ErrInvalidMediaEncSHA256) || errors.Is(err, whatsmeow.ErrInvalidMediaSHA256)
}

func rewind(file *os.File) error {
	if err := file.Truncate(0); err != nil {
		return err
	}
	_, err := file.Seek(0, io.SeekStart)
	return err
}

const mediaMACLength = 10

// openReencrypted checks and decrypts a file downloaded as it lies on WhatsApp's servers, the same way whatsmeow does
// (download-to-file.go, downloadAndDecryptToFile) minus the stored checksums: the MAC must match the stored key, or
// nothing is decrypted. It answers the copy's own checksums, for the stored ref.
func openReencrypted(file *os.File, mediaKey []byte, media whatsmeow.MediaType) (*refreshed, error) {
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	size := info.Size() - mediaMACLength
	if size <= 0 {
		return nil, whatsmeow.ErrTooShortFile
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	keys := hkdfutil.SHA256(mediaKey, nil, []byte(media), 112)
	iv, cipherKey, macKey := keys[:16], keys[16:48], keys[48:80]
	encrypted, signed := sha256.New(), hmac.New(sha256.New, macKey)
	signed.Write(iv)
	if _, err := io.Copy(io.MultiWriter(encrypted, signed), io.LimitReader(file, size)); err != nil {
		return nil, err
	}
	mac := make([]byte, mediaMACLength)
	if _, err := io.ReadFull(file, mac); err != nil {
		return nil, err
	}
	encrypted.Write(mac)
	if !hmac.Equal(signed.Sum(nil)[:mediaMACLength], mac) {
		return nil, whatsmeow.ErrInvalidMediaHMAC
	}
	if err := file.Truncate(size); err != nil {
		return nil, err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	if err := cbcutil.DecryptFile(cipherKey, iv, file); err != nil {
		return nil, err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	plain := sha256.New()
	if _, err := io.Copy(plain, file); err != nil {
		return nil, err
	}
	return &refreshed{FileSHA256: plain.Sum(nil), FileEncSHA256: encrypted.Sum(nil)}, nil
}
