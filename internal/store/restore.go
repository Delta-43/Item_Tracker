package store

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
)

// Restore replaces every item, borrower, loan and setting with the contents of
// the backup at path. The current data is saved first, next to the database,
// so a mistaken restore can be undone by restoring that copy; its file name is
// returned ("" for an in-memory store).
func (s *Store) Restore(ctx context.Context, path string) (string, error) {
	if err := checkBackup(ctx, path); err != nil {
		return "", err
	}
	// Opening the backup brings an older schema up to date, so the tables
	// below line up column for column.
	src, err := OpenFile(path)
	if err != nil {
		return "", errorf(http.StatusUnprocessableEntity, "not_a_backup", "That file is not an Item Tracker backup")
	}
	if err := src.Close(); err != nil {
		return "", err
	}

	saved := ""
	if s.path != "" && s.path != ":memory:" {
		dir, stem := filepath.Dir(s.path), "before-restore-"+s.now().Format("2006-01-02-150405")
		saved = stem + ".db"
		for n := 2; fileExists(filepath.Join(dir, saved)); n++ {
			saved = fmt.Sprintf("%s-%d.db", stem, n)
		}
		if err := s.Backup(ctx, filepath.Join(dir, saved)); err != nil {
			return "", fmt.Errorf("save the current desk: %w", err)
		}
	}

	// ATTACH holds for one connection only, so pin the store's single one.
	conn, err := s.db.Conn(ctx)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, `ATTACH DATABASE ? AS backup`, path); err != nil {
		return "", err
	}
	defer conn.ExecContext(context.Background(), `DETACH DATABASE backup`)

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	for _, q := range []string{
		`DELETE FROM loans`,
		`DELETE FROM borrowers`,
		`DELETE FROM items`,
		`DELETE FROM settings`,
		`INSERT INTO items SELECT * FROM backup.items`,
		`INSERT INTO borrowers SELECT * FROM backup.borrowers`,
		`INSERT INTO loans SELECT * FROM backup.loans`,
		`INSERT INTO settings SELECT * FROM backup.settings`,
	} {
		if _, err := tx.ExecContext(ctx, q); err != nil {
			tx.Rollback()
			return "", fmt.Errorf("restore: %w", err)
		}
	}
	return saved, tx.Commit()
}

// checkBackup refuses files that are not a healthy Item Tracker database made
// by this version or an earlier one.
func checkBackup(ctx context.Context, path string) error {
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		return err
	}
	defer db.Close()
	notBackup := errorf(http.StatusUnprocessableEntity, "not_a_backup", "That file is not an Item Tracker backup")
	var version int
	if err := db.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&version); err != nil || version == 0 {
		return notBackup
	}
	if version > len(migrations) {
		return errorf(http.StatusUnprocessableEntity, "backup_too_new", "That backup comes from a newer Item Tracker; update this desk first")
	}
	var check string
	if err := db.QueryRowContext(ctx, `PRAGMA quick_check`).Scan(&check); err != nil || check != "ok" {
		return errorf(http.StatusUnprocessableEntity, "backup_damaged", "That backup file is damaged")
	}
	var tables int
	err = db.QueryRowContext(ctx, `SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('items', 'borrowers', 'loans', 'settings')`).Scan(&tables)
	if err != nil || tables != 4 {
		return notBackup
	}
	return nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
