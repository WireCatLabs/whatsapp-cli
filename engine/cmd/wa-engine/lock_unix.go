//go:build !windows

package main

import (
	"os"

	"golang.org/x/sys/unix"
)

func tryLock(file *os.File) bool {
	return unix.Flock(int(file.Fd()), unix.LOCK_EX|unix.LOCK_NB) == nil
}

// ownerOnly makes every file the engine creates owner-only, SQLite's -wal and -shm included.
func ownerOnly() { unix.Umask(0o077) }
