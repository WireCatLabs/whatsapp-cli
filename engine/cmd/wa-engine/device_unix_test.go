//go:build !windows

package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	waLog "go.mau.fi/whatsmeow/util/log"
	"golang.org/x/sys/unix"
)

func TestTheLockMakesANewProfilesFolderOwnerOnly(t *testing.T) {
	defer unix.Umask(unix.Umask(0o022))
	folder := filepath.Join(t.TempDir(), "profiles", "new")
	lock, refused := holdLock(filepath.Join(folder, "private.db"), "session start")
	if refused != nil {
		t.Fatal(refused)
	}
	defer lock.Close()
	info, err := os.Stat(folder)
	if err != nil {
		t.Fatal(err)
	}
	if mode := info.Mode().Perm(); mode != 0o700 {
		t.Errorf("the profile folder is %o, want 700", mode)
	}
}

func TestDeviceKeysAndTheirJournalsAreOwnerOnly(t *testing.T) {
	defer unix.Umask(unix.Umask(0o022))
	ownerOnly()
	path := filepath.Join(t.TempDir(), "private.db")
	_, db, refused := openDevice(context.Background(), path, true, waLog.Noop)
	if refused != nil {
		t.Fatal(refused)
	}
	defer db.Close()
	for _, file := range []string{path, path + "-wal", path + "-shm"} {
		info, err := os.Stat(file)
		if err != nil {
			t.Fatal(err)
		}
		if mode := info.Mode().Perm(); mode != 0o600 {
			t.Errorf("%s is %o, want 600", filepath.Base(file), mode)
		}
	}
}
