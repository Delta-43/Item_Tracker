package store

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

// Loan is one lend of an item to a borrower; ReturnedAt is empty while it is out.
type Loan struct {
	ID           int64  `json:"id"`
	ItemID       int64  `json:"item_id"`
	ItemLabel    string `json:"item_label"`
	BorrowerID   int64  `json:"borrower_id"`
	BorrowerName string `json:"borrower_name"`
	LentAt       string `json:"lent_at"`
	LentBy       string `json:"lent_by"`
	ReturnedAt   string `json:"returned_at,omitempty"`
	ReturnedBy   string `json:"returned_by,omitempty"`
	CloseReason  string `json:"close_reason,omitempty"`
}

// LoanFilter narrows the history; zero values match everything.
type LoanFilter struct {
	From, To   string // RFC 3339 bounds on lent_at (inclusive, exclusive)
	ItemID     int64
	BorrowerID int64
	OpenOnly   bool
	Limit      int
}

const loanSelect = `SELECT l.id, l.item_id, i.label, l.borrower_id, b.name, l.lent_at, l.lent_by,
	COALESCE(l.returned_at, ''), l.returned_by, l.close_reason
	FROM loans l JOIN items i ON i.id = l.item_id JOIN borrowers b ON b.id = l.borrower_id`

func scanLoan(row scanner) (Loan, error) {
	var l Loan
	err := row.Scan(&l.ID, &l.ItemID, &l.ItemLabel, &l.BorrowerID, &l.BorrowerName,
		&l.LentAt, &l.LentBy, &l.ReturnedAt, &l.ReturnedBy, &l.CloseReason)
	return l, err
}

func (s *Store) loan(ctx context.Context, q queryer, id int64) (Loan, error) {
	l, err := scanLoan(q.QueryRowContext(ctx, loanSelect+` WHERE l.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return l, notFound("loan")
	}
	return l, err
}

// Loans returns the history, newest first.
func (s *Store) Loans(ctx context.Context, f LoanFilter) ([]Loan, error) {
	var where []string
	var args []any
	if f.From != "" {
		where, args = append(where, "l.lent_at >= ?"), append(args, f.From)
	}
	if f.To != "" {
		where, args = append(where, "l.lent_at < ?"), append(args, f.To)
	}
	if f.ItemID != 0 {
		where, args = append(where, "l.item_id = ?"), append(args, f.ItemID)
	}
	if f.BorrowerID != 0 {
		where, args = append(where, "l.borrower_id = ?"), append(args, f.BorrowerID)
	}
	if f.OpenOnly {
		where = append(where, "l.returned_at IS NULL")
	}
	q := loanSelect
	if len(where) > 0 {
		q += " WHERE " + strings.Join(where, " AND ")
	}
	limit := f.Limit
	if limit <= 0 || limit > 10000 {
		limit = 10000
	}
	q += " ORDER BY l.lent_at DESC, l.id DESC LIMIT ?"
	args = append(args, limit)
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Loan{}
	for rows.Next() {
		l, err := scanLoan(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	return list, rows.Err()
}

// Lend gives a free, in-service item to an active borrower who holds nothing else.
func (s *Store) Lend(ctx context.Context, itemID, borrowerID int64, by string) (Loan, error) {
	var loan Loan
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		it, err := s.item(ctx, tx, "i.id = ?", itemID)
		if err != nil {
			return err
		}
		switch {
		case it.Condition != ConditionOK:
			return errorf(http.StatusConflict, "item_out_of_service", "%s is marked %s and can't be lent", it.Label, it.Condition)
		case it.Loan != nil:
			return errorf(http.StatusConflict, "item_busy", "%s is already lent to %s", it.Label, it.Loan.BorrowerName)
		}
		var name string
		var active bool
		err = tx.QueryRowContext(ctx, `SELECT name, active FROM borrowers WHERE id = ?`, borrowerID).Scan(&name, &active)
		if errors.Is(err, sql.ErrNoRows) {
			return notFound("borrower")
		} else if err != nil {
			return err
		}
		if !active {
			return errorf(http.StatusConflict, "not_on_roster", "%s is not on the roster", name)
		}
		var held sql.NullString
		err = tx.QueryRowContext(ctx, `SELECT i.label FROM loans l JOIN items i ON i.id = l.item_id
			WHERE l.borrower_id = ? AND l.returned_at IS NULL`, borrowerID).Scan(&held)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if held.Valid {
			return errorf(http.StatusConflict, "borrower_has_item", "%s already has %s; take it back first", name, held.String)
		}
		res, err := tx.ExecContext(ctx, `INSERT INTO loans (item_id, borrower_id, lent_at, lent_by) VALUES (?, ?, ?, ?)`,
			itemID, borrowerID, s.stamp(), by)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		loan, err = s.loan(ctx, tx, id)
		return err
	})
	return loan, err
}

// Return closes an open loan.
func (s *Store) Return(ctx context.Context, loanID int64, by string) (Loan, error) {
	var loan Loan
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE loans SET returned_at = ?, returned_by = ?, close_reason = 'returned'
			WHERE id = ? AND returned_at IS NULL`, s.stamp(), by, loanID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			if _, err := s.loan(ctx, tx, loanID); err != nil {
				return err
			}
			return errorf(http.StatusConflict, "already_returned", "That item was already returned")
		}
		loan, err = s.loan(ctx, tx, loanID)
		return err
	})
	return loan, err
}

// UndoReturn reopens a returned loan, as long as neither the item nor the
// borrower has started another loan since.
func (s *Store) UndoReturn(ctx context.Context, loanID int64) (Loan, error) {
	var loan Loan
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		l, err := s.loan(ctx, tx, loanID)
		if err != nil {
			return err
		}
		if l.ReturnedAt == "" || l.CloseReason != "returned" {
			return errorf(http.StatusConflict, "cannot_undo", "Only a return can be undone")
		}
		_, err = tx.ExecContext(ctx, `UPDATE loans SET returned_at = NULL, returned_by = '', close_reason = '' WHERE id = ?`, loanID)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				return errorf(http.StatusConflict, "cannot_undo", "%s or %s has a newer loan, so this return can't be undone", l.ItemLabel, l.BorrowerName)
			}
			return err
		}
		loan, err = s.loan(ctx, tx, loanID)
		return err
	})
	return loan, err
}

// ScanResult says what a scanned QR value means at the desk.
type ScanResult struct {
	// Action is "returned" (the item was out and is now back), "lend" (the
	// item is free; ask who borrows it) or "out_of_service".
	Action string `json:"action"`
	Item   Item   `json:"item"`
	Loan   *Loan  `json:"loan,omitempty"`
}

// Scan handles a QR value: a lent item is returned at once, a free one is
// ready to lend.
func (s *Store) Scan(ctx context.Context, code, by string) (ScanResult, error) {
	code = strings.TrimSpace(code)
	it, err := s.item(ctx, s.db, "i.code = ?", code)
	if err != nil {
		if e, ok := AsError(err); ok && e.Code == "item_not_found" {
			return ScanResult{}, errorf(http.StatusNotFound, "unknown_code", "This QR code doesn't belong to any item")
		}
		return ScanResult{}, err
	}
	switch {
	case it.Loan != nil:
		loan, err := s.Return(ctx, it.Loan.ID, by)
		if err != nil {
			return ScanResult{}, err
		}
		it.Loan = nil
		return ScanResult{Action: "returned", Item: it, Loan: &loan}, nil
	case it.Condition != ConditionOK:
		return ScanResult{Action: "out_of_service", Item: it}, nil
	default:
		return ScanResult{Action: "lend", Item: it}, nil
	}
}

// Activity is one lend or return in the recent-actions feed.
type Activity struct {
	Kind string `json:"kind"` // "lent" or "returned" (or "lost"/"damaged")
	At   string `json:"at"`
	Loan Loan   `json:"loan"`
}

// Recent returns the latest lends and returns, newest first.
func (s *Store) Recent(ctx context.Context, limit int) ([]Activity, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT kind, at, id FROM (
			SELECT 'lent' AS kind, lent_at AS at, id FROM loans
			UNION ALL
			SELECT close_reason, returned_at, id FROM loans WHERE returned_at IS NOT NULL
		) ORDER BY at DESC, id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	type ref struct {
		kind, at string
		id       int64
	}
	var refs []ref
	for rows.Next() {
		var r ref
		if err := rows.Scan(&r.kind, &r.at, &r.id); err != nil {
			rows.Close()
			return nil, err
		}
		refs = append(refs, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	list := make([]Activity, 0, len(refs))
	for _, r := range refs {
		l, err := s.loan(ctx, s.db, r.id)
		if err != nil {
			return nil, err
		}
		list = append(list, Activity{Kind: r.kind, At: r.at, Loan: l})
	}
	return list, nil
}
