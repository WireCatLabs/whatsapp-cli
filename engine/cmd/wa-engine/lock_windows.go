//go:build windows

package main

import (
	"os"

	"golang.org/x/sys/windows"
)

func tryLock(file *os.File) bool {
	// The locked byte lies far past the holder's name, so another process can still read who holds the lock.
	overlapped := windows.Overlapped{OffsetHigh: 1}
	flags := uint32(windows.LOCKFILE_EXCLUSIVE_LOCK | windows.LOCKFILE_FAIL_IMMEDIATELY)
	return windows.LockFileEx(windows.Handle(file.Fd()), flags, 0, 1, 0, &overlapped) == nil
}

// ownerOnly has nothing to do on Windows: a file in the user's profile folder is the user's.
func ownerOnly() {}
