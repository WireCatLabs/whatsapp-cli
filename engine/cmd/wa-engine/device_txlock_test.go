package main

import (
	"context"
	"path/filepath"
	"sync"
	"testing"
	"time"

	waLog "go.mau.fi/whatsmeow/util/log"
)

func TestConcurrentDecryptionTransactionsWaitInsteadOfFailingBusy(t *testing.T) {
	ctx := context.Background()
	_, db, refused := openDevice(ctx, filepath.Join(t.TempDir(), "private.db"), true, waLog.Noop)
	if refused != nil {
		t.Fatal(refused.Message)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE identities (n INTEGER)`); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			tx, err := db.BeginTx(ctx, nil)
			if err != nil {
				errs <- err
				return
			}
			defer tx.Rollback()
			var n int
			if err := tx.QueryRow(`SELECT count(*) FROM identities`).Scan(&n); err != nil {
				errs <- err
				return
			}
			time.Sleep(20 * time.Millisecond)
			if _, err := tx.Exec(`INSERT INTO identities VALUES (?)`, n); err != nil {
				errs <- err
				return
			}
			errs <- tx.Commit()
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
}
