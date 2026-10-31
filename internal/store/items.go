package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

// Item conditions. Anything but ConditionOK takes the item out of service.
const (
	ConditionOK      = "ok"
	ConditionLost    = "lost"
	ConditionDamaged = "damaged"
)

// Item is something that can be lent, identified at the desk by its QR code.
type Item struct {
	ID        int64  `json:"id"`
	Label     string `json:"label"`
	Code      string `json:"code"`
	Condition string `json:"condition"`
	Note      string `json:"note"`
	Loan      *Loan  `json:"loan"` // the open loan, if the item is out
}

// ItemPatch changes the fields that are set.
type ItemPatch struct {
	Label     *string `json:"label"`
	Code      *string `json:"code"`
	Condition *string `json:"condition"`
	Note      *string `json:"note"`
}

const maxLabel, maxCode, maxNote = 40, 200, 500

func cleanText(s string) string { return strings.Join(strings.Fields(s), " ") }

func validateItem(label, code string) error {
	switch {
	case label == "":
		return errorf(http.StatusUnprocessableEntity, "invalid_label", "Give the item a label")
	case len([]rune(label)) > maxLabel:
		return errorf(http.StatusUnprocessableEntity, "invalid_label", "Labels can be at most %d characters", maxLabel)
	case code == "":
		return errorf(http.StatusUnprocessableEntity, "invalid_code", "The QR value can't be empty")
	case len(code) > maxCode:
		return errorf(http.StatusUnprocessableEntity, "invalid_code", "QR values can be at most %d characters", maxCode)
	}
	return nil
}

// NewCode returns a random QR value that is short enough to print as a small,
// easily scanned code.
func NewCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O or 1/I
	b := make([]byte, 8)
	rand.Read(b)
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return "item:" + string(b)
}

const itemColumns = `i.id, i.label, i.code, i.condition, i.note,
	l.id, l.borrower_id, b.name, l.lent_at, l.lent_by`

const itemJoins = `FROM items i
	LEFT JOIN loans l ON l.item_id = i.id AND l.returned_at IS NULL
	LEFT JOIN borrowers b ON b.id = l.borrower_id`

type scanner interface{ Scan(...any) error }

func scanItem(row scanner) (Item, error) {
	var it Item
	var loanID, borrowerID sql.NullInt64
	var borrower, lentAt, lentBy sql.NullString
	if err := row.Scan(&it.ID, &it.Label, &it.Code, &it.Condition, &it.Note,
		&loanID, &borrowerID, &borrower, &lentAt, &lentBy); err != nil {
		return it, err
	}
	if loanID.Valid {
		it.Loan = &Loan{
			ID: loanID.Int64, ItemID: it.ID, ItemLabel: it.Label,
			BorrowerID: borrowerID.Int64, BorrowerName: borrower.String,
			LentAt: lentAt.String, LentBy: lentBy.String,
		}
	}
	return it, nil
}

// Items lists every item with its open loan, in label order.
func (s *Store) Items(ctx context.Context) ([]Item, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+itemColumns+` `+itemJoins+` ORDER BY i.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Item{}
	for rows.Next() {
		it, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	sortItems(items)
	return items, rows.Err()
}

func (s *Store) item(ctx context.Context, q queryer, where string, arg any) (Item, error) {
	it, err := scanItem(q.QueryRowContext(ctx, `SELECT `+itemColumns+` `+itemJoins+` WHERE `+where, arg))
	if errors.Is(err, sql.ErrNoRows) {
		return it, notFound("item")
	}
	return it, err
}

// Item returns one item by ID.
func (s *Store) Item(ctx context.Context, id int64) (Item, error) {
	return s.item(ctx, s.db, "i.id = ?", id)
}

type queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// CreateItem adds an item. An empty code gets a generated one.
func (s *Store) CreateItem(ctx context.Context, label, code string) (Item, error) {
	label, code = cleanText(label), strings.TrimSpace(code)
	if code == "" {
		code = NewCode()
	}
	if err := validateItem(label, code); err != nil {
		return Item{}, err
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO items (label, code, created_at) VALUES (?, ?, ?)`, label, code, s.stamp())
	if err != nil {
		return Item{}, uniqueItemError(err)
	}
	id, _ := res.LastInsertId()
	return s.Item(ctx, id)
}

func uniqueItemError(err error) error {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "items.code"):
		return errorf(http.StatusConflict, "code_taken", "Another item already uses that QR value")
	case strings.Contains(msg, "items.label") || strings.Contains(msg, "items_label"):
		return errorf(http.StatusConflict, "label_taken", "Another item already has that label")
	}
	return err
}

// UpdateItem applies a patch. Marking a lent item lost or damaged closes its loan.
func (s *Store) UpdateItem(ctx context.Context, id int64, p ItemPatch, by string) (Item, error) {
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		cur, err := s.item(ctx, tx, "i.id = ?", id)
		if err != nil {
			return err
		}
		label, code, condition, note := cur.Label, cur.Code, cur.Condition, cur.Note
		if p.Label != nil {
			label = cleanText(*p.Label)
		}
		if p.Code != nil {
			code = strings.TrimSpace(*p.Code)
		}
		if p.Note != nil {
			note = strings.TrimSpace(*p.Note)
			if len([]rune(note)) > maxNote {
				return errorf(http.StatusUnprocessableEntity, "invalid_note", "Notes can be at most %d characters", maxNote)
			}
		}
		if p.Condition != nil {
			condition = *p.Condition
			if condition != ConditionOK && condition != ConditionLost && condition != ConditionDamaged {
				return errorf(http.StatusUnprocessableEntity, "invalid_condition", "Unknown condition %q", condition)
			}
		}
		if err := validateItem(label, code); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE items SET label = ?, code = ?, condition = ?, note = ? WHERE id = ?`,
			label, code, condition, note, id); err != nil {
			return uniqueItemError(err)
		}
		if cur.Loan != nil && condition != ConditionOK {
			_, err := tx.ExecContext(ctx,
				`UPDATE loans SET returned_at = ?, returned_by = ?, close_reason = ? WHERE id = ?`,
				s.stamp(), by, condition, cur.Loan.ID)
			return err
		}
		return nil
	})
	if err != nil {
		return Item{}, err
	}
	return s.Item(ctx, id)
}

// DeleteItem removes an item that has never been lent. Items with history
// should be marked lost or damaged instead so the history stays complete.
func (s *Store) DeleteItem(ctx context.Context, id int64) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		var loans int
		if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM loans WHERE item_id = ?`, id).Scan(&loans); err != nil {
			return err
		}
		if loans > 0 {
			return errorf(http.StatusConflict, "has_history", "This item has loan history; mark it lost or damaged instead of deleting it")
		}
		res, err := tx.ExecContext(ctx, `DELETE FROM items WHERE id = ?`, id)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return notFound("item")
		}
		return nil
	})
}
