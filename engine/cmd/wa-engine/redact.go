package main

import (
	"bytes"
	"io"
	"regexp"
)

var (
	// A user's JID in every form whatsmeow prints: bare, with an agent or a device (`…:12@`), and an old group id,
	// whose first digits are its creator's phone number. LIDs are masked too: each one stands for one person.
	userJID = regexp.MustCompile(`\d{6,}((?:[.:]\d+)*@(?:s\.whatsapp\.net|c\.us|lid|hosted|hosted\.lid))|\d{6,}-\d+(@g\.us)`)
	// A number on its own, as a database or a server error might quote it; one before `@` is a group's or a
	// channel's id, which names nobody.
	bareNumber = regexp.MustCompile(`\+?\b\d{7,}\b@?`)
	// whatsmeow logs a failed media download with the URL in its error, and that URL holds the path, the file's hash
	// and the signed `oh`/`oe` that let anyone fetch the file. zerolog escapes `"` and `\` only, so a URL ends there.
	anyURL     = regexp.MustCompile(`(?i)\b(?:https?|wss?)://[^\s"'<>\\]+`)
	directPath = regexp.MustCompile(`(^|[^\w./-])/(?:(?:o1|m1)/)?(?:v/t|mms/)[^\s"'<>\\]*`)
	mediaParam = regexp.MustCompile(`(?i)\b(oh|oe|hash|auth|token|ccb|d_md|e_handle|_nc_[a-z]+)=(?:\\?")?[^\s&"'<>\\]*`)
)

func maskNumber(match []byte) []byte {
	if bytes.HasSuffix(match, []byte("@")) {
		return match
	}
	return []byte("…")
}

// redacting drops media URLs and masks phone numbers and user ids before a line reaches WA_ENGINE_LOG. zerolog writes each event in one
// Write, so a match never splits across two calls.
type redacting struct{ out io.Writer }

func (r redacting) Write(line []byte) (int, error) {
	masked := anyURL.ReplaceAll(line, []byte("[url]"))
	masked = directPath.ReplaceAll(masked, []byte("${1}[path]"))
	masked = mediaParam.ReplaceAll(masked, []byte("${1}=…"))
	masked = userJID.ReplaceAll(masked, []byte("…${1}${2}"))
	masked = bareNumber.ReplaceAllFunc(masked, maskNumber)
	if _, err := r.out.Write(masked); err != nil {
		return 0, err
	}
	return len(line), nil
}
