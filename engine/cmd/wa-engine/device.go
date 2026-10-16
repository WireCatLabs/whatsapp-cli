package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

// holdLock takes the one lock per linked device before anything can connect: a second connection would not fail,
// WhatsApp would silently drop the first. The loser is told who holds it.
func holdLock(storePath, holder string) (*os.File, *failure) {
	file, err := os.OpenFile(storePath+".lock", os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, &failure{"provider_error", "cannot open the lock beside the device store"}
	}
	if !tryLock(file) {
		owner, _ := os.ReadFile(storePath + ".lock")
		file.Close()
		who := strings.TrimSpace(string(owner))
		if who == "" {
			who = "another wa process"
		}
		return nil, &failure{"provider_unavailable",
			"this WhatsApp login is in use by " + who + "; WhatsApp allows one connection per linked device"}
	}
	_ = file.Truncate(0)
	_, _ = file.WriteAt([]byte(fmt.Sprintf("%s (pid %d)\n", holder, os.Getpid())), 0)
	return file, nil
}

// openDevice opens the profile's device store. One device per file: none means not linked yet (only login may then
// create one), several means the file is not ours to guess in.
func openDevice(ctx context.Context, storePath string, linking bool, logger waLog.Logger) (*store.Device, *failure) {
	if err := os.MkdirAll(filepath.Dir(storePath), 0o700); err != nil {
		return nil, &failure{"provider_error", "cannot create the profile folder"}
	}
	dsn := "file:" + storePath + "?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, &failure{"provider_error", "cannot open the device store"}
	}
	container := sqlstore.NewWithDB(db, "sqlite", logger)
	if err := container.Upgrade(ctx); err != nil {
		return nil, &failure{"provider_error", "cannot prepare the device store"}
	}
	_ = os.Chmod(storePath, 0o600)
	devices, err := container.GetAllDevices(ctx)
	if err != nil {
		return nil, &failure{"provider_error", "cannot read the device store"}
	}
	switch {
	case len(devices) == 1:
		return devices[0], nil
	case len(devices) > 1:
		return nil, &failure{"provider_error", "the device store holds more than one linked device; log in again"}
	case linking:
		return container.NewDevice(), nil
	default:
		return nil, &failure{"authentication_error", "this profile is not linked to WhatsApp"}
	}
}

// lookLikeABrowser sets what WhatsApp sees at pairing: a desktop browser on the host system, never this tool.
// Desktop with full sync asks the phone for all history, not the last few months.
func lookLikeABrowser() {
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_DESKTOP.Enum()
	store.DeviceProps.RequireFullSync = proto.Bool(true)
	store.SetOSInfo(osName(), [3]uint32{0, 1, 0})
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
