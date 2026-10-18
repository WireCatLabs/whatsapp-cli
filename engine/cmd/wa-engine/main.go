// wa-engine speaks WhatsApp through whatsmeow for wa. It reads requests as JSON lines on stdin and writes answers
// and events as JSON lines on stdout; the contract is src/engine/contract.ts. It writes no message, name or number
// anywhere else: stderr gets fixed wording only, and whatsmeow's own log is off unless WA_ENGINE_LOG names a file,
// where phone numbers and user ids are masked.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	waLog "go.mau.fi/whatsmeow/util/log"
)

var version = "dev"

func main() {
	storePath := flag.String("store", "", "the profile's device store (private.db)")
	holder := flag.String("holder", "wa", "who holds the connection, named to anyone refused it")
	linking := flag.Bool("link", false, "allow an empty store: this run links a new device")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}
	ownerOnly()
	out := newWire(os.Stdout)
	if *storePath == "" {
		out.refuse(&failure{"validation_error", "the engine needs --store"})
		os.Exit(2)
	}

	logger, closeLog := whatsmeowLog()
	defer closeLog()

	lock, busy := holdLock(*storePath, *holder)
	if busy != nil {
		out.refuse(busy)
		os.Exit(1)
	}
	defer lock.Close()
	lookupStamp = *storePath + ".lookup"

	// SIGINT reaches the whole process group on Ctrl+C; the CLI decides when to stop, through stdin.
	signal.Ignore(os.Interrupt)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM)
	defer stop()

	device, db, refused := openDevice(ctx, *storePath, *linking, logger.Sub("store"))
	if refused != nil {
		out.refuse(refused)
		os.Exit(1)
	}
	lookLikeABrowser()
	e := newEngine(ctx, device, out, logger.Sub("client"))
	phones, err := openPhoneChats(ctx, db, device.ID == nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, "wa-engine: cannot keep the phone-form chats in the device store; they will not be re-keyed")
	}
	e.phones = phones
	// Right after pairing the phone pushes the whole history; no lookup goes out in that run.
	if phones != nil {
		asks, err := openLidAsker(e.ctx, db, device.ID == nil, e.askLIDs)
		if err != nil {
			fmt.Fprintln(os.Stderr, "wa-engine: cannot keep the LID lookups in the device store; none will be made")
		} else if !*linking {
			e.asks = asks
		}
	}
	out.hello(hello{Protocol: protocol, Engine: "whatsmeow", Version: version, Self: e.self()})
	e.announce()
	go func() {
		<-ctx.Done()
		os.Stdin.Close()
	}()
	e.run(os.Stdin)
}

func whatsmeowLog() (waLog.Logger, func()) {
	path := os.Getenv("WA_ENGINE_LOG")
	if path == "" {
		return waLog.Noop, func() {}
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		fmt.Fprintln(os.Stderr, "wa-engine: cannot open WA_ENGINE_LOG; logging off")
		return waLog.Noop, func() {}
	}
	logger := zerolog.New(redacting{file}).With().Timestamp().Logger().Level(zerolog.WarnLevel)
	return waLog.Zerolog(logger), func() { file.Close() }
}
