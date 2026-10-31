// Package store keeps items, borrowers and loans in a single SQLite file.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite" // registers the pure-Go "sqlite" driver
)

// timeFormat is fixed-width UTC so stored timestamps sort lexically.
const timeFormat = "2006-01-02T15:04:05.000Z"

// Store is safe for concurrent use; writes are serialised through one connection.
type Store struct {
	db   *sql.DB
	path string
	now  func() time.Time
}

// Error is a failure the volunteer can act on, carrying the HTTP status to report.
type Error struct {
	Status  int    `json:"-"`
	Code    string `json:"error"`
	Message string `json:"message"`
}

func (e *Error) Error() string { return e.Message }

func errorf(status int, code, format string, args ...any) *Error {
	return &Error{Status: status, Code: code, Message: fmt.Sprintf(format, args...)}
}

// AsError reports whether err is a *Error and returns it.
func AsError(err error) (*Error, bool) {
	var e *Error
	ok := errors.As(err, &e)
	return e, ok
}

// Open creates the data directory and database if needed and applies migrations.
func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create data directory: %w", err)
	}
	return OpenFile(filepath.Join(dir, "item-tracker.db"))
}

// OpenFile opens the database at path (":memory:" works for tests).
func OpenFile(path string) (*Store, error) {
	dsn := "file:" + path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection keeps every read-check-write sequence atomic without
	// explicit locking, and SQLite only allows one writer anyway.
	db.SetMaxOpenConns(1)
	s := &Store{db: db, path: path, now: time.Now}
	if err := s.migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// SetClock replaces the time source; tests use it to control timestamps.
func (s *Store) SetClock(now func() time.Time) { s.now = now }

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

func (s *Store) stamp() string { return s.now().UTC().Format(timeFormat) }

var migrations = []string{
	`CREATE TABLE items (
		id         INTEGER PRIMARY KEY,
		label      TEXT NOT NULL,
		code       TEXT NOT NULL UNIQUE,
		condition  TEXT NOT NULL DEFAULT 'ok' CHECK (condition IN ('ok', 'lost', 'damaged')),
		note       TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL
	);
	CREATE UNIQUE INDEX items_label ON items (label COLLATE NOCASE);

	CREATE TABLE borrowers (
		id         INTEGER PRIMARY KEY,
		name       TEXT NOT NULL,
		name_key   TEXT NOT NULL UNIQUE,
		active     INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL
	);

	CREATE TABLE loans (
		id           INTEGER PRIMARY KEY,
		item_id      INTEGER NOT NULL REFERENCES items (id),
		borrower_id  INTEGER NOT NULL REFERENCES borrowers (id),
		lent_at      TEXT NOT NULL,
		lent_by      TEXT NOT NULL DEFAULT '',
		returned_at  TEXT,
		returned_by  TEXT NOT NULL DEFAULT '',
		close_reason TEXT NOT NULL DEFAULT '' CHECK (close_reason IN ('', 'returned', 'lost', 'damaged'))
	);
	CREATE UNIQUE INDEX loans_open_item ON loans (item_id) WHERE returned_at IS NULL;
	CREATE UNIQUE INDEX loans_open_borrower ON loans (borrower_id) WHERE returned_at IS NULL;
	CREATE INDEX loans_lent_at ON loans (lent_at);

	CREATE TABLE settings (
		id    INTEGER PRIMARY KEY CHECK (id = 1),
		value TEXT NOT NULL
	);`,
}

func (s *Store) migrate(ctx context.Context) error {
	var version int
	if err := s.db.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&version); err != nil {
		return err
	}
	for i := version; i < len(migrations); i++ {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, migrations[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d: %w", i+1, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`PRAGMA user_version = %d`, i+1)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// Backup writes a consistent copy of the database to path.
func (s *Store) Backup(ctx context.Context, path string) error {
	_, err := s.db.ExecContext(ctx, `VACUUM INTO ?`, path)
	return err
}

// inTx runs fn in a transaction, rolling back on error.
func (s *Store) inTx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func notFound(what string) *Error {
	return errorf(http.StatusNotFound, what+"_not_found", "That %s no longer exists", what)
}
