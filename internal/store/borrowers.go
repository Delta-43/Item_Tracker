package store

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"strings"

	"golang.org/x/text/unicode/norm"
)

// Borrower is a person on the roster. Inactive borrowers keep their history
// but can't borrow.
type Borrower struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

// ImportResult summarises a roster import.
type ImportResult struct {
	Added       int      `json:"added"`
	Reactivated int      `json:"reactivated"`
	Unchanged   int      `json:"unchanged"`
	Deactivated int      `json:"deactivated"`
	KeptActive  []string `json:"kept_active"` // not on the new list but holding an item
	Invalid     []string `json:"invalid"`
}

const maxName = 120

func cleanName(name string) (string, error) {
	name = norm.NFC.String(cleanText(name))
	switch {
	case name == "":
		return "", errorf(http.StatusUnprocessableEntity, "invalid_name", "Enter a name")
	case len([]rune(name)) > maxName:
		return "", errorf(http.StatusUnprocessableEntity, "invalid_name", "Names can be at most %d characters", maxName)
	}
	return name, nil
}

// Borrowers lists the roster in name order; inactive entries only when asked.
func (s *Store) Borrowers(ctx context.Context, includeInactive bool) ([]Borrower, error) {
	q := `SELECT id, name, active FROM borrowers`
	if !includeInactive {
		q += ` WHERE active = 1`
	}
	rows, err := s.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Borrower{}
	for rows.Next() {
		var b Borrower
		if err := rows.Scan(&b.ID, &b.Name, &b.Active); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	slices.SortFunc(list, func(a, b Borrower) int { return strings.Compare(NameKey(a.Name), NameKey(b.Name)) })
	return list, rows.Err()
}

// AddBorrower puts one person on the roster, reactivating them if they were removed.
func (s *Store) AddBorrower(ctx context.Context, name string) (Borrower, error) {
	name, err := cleanName(name)
	if err != nil {
		return Borrower{}, err
	}
	var b Borrower
	err = s.inTx(ctx, func(tx *sql.Tx) error {
		key := NameKey(name)
		err := tx.QueryRowContext(ctx, `SELECT id, name, active FROM borrowers WHERE name_key = ?`, key).Scan(&b.ID, &b.Name, &b.Active)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			res, err := tx.ExecContext(ctx, `INSERT INTO borrowers (name, name_key, created_at) VALUES (?, ?, ?)`, name, key, s.stamp())
			if err != nil {
				return err
			}
			b = Borrower{Name: name, Active: true}
			b.ID, _ = res.LastInsertId()
			return nil
		case err != nil:
			return err
		case b.Active:
			return errorf(http.StatusConflict, "already_on_roster", "%s is already on the roster", b.Name)
		}
		b.Name, b.Active = name, true
		_, err = tx.ExecContext(ctx, `UPDATE borrowers SET name = ?, active = 1 WHERE id = ?`, name, b.ID)
		return err
	})
	return b, err
}

// SetBorrowerActive adds a known person back to the roster or takes them off it.
func (s *Store) SetBorrowerActive(ctx context.Context, id int64, active bool) (Borrower, error) {
	var b Borrower
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		err := tx.QueryRowContext(ctx, `SELECT id, name, active FROM borrowers WHERE id = ?`, id).Scan(&b.ID, &b.Name, &b.Active)
		if errors.Is(err, sql.ErrNoRows) {
			return notFound("borrower")
		} else if err != nil {
			return err
		}
		if !active {
			var open int
			if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM loans WHERE borrower_id = ? AND returned_at IS NULL`, id).Scan(&open); err != nil {
				return err
			}
			if open > 0 {
				return errorf(http.StatusConflict, "borrower_has_item", "%s still has an item; take it back first", b.Name)
			}
		}
		b.Active = active
		_, err = tx.ExecContext(ctx, `UPDATE borrowers SET active = ? WHERE id = ?`, active, id)
		return err
	})
	return b, err
}

// ImportRoster adds every name in the list. With replace, people missing from
// the list are taken off the roster, except anyone still holding an item.
func (s *Store) ImportRoster(ctx context.Context, names []string, replace bool) (ImportResult, error) {
	res := ImportResult{KeptActive: []string{}, Invalid: []string{}}
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		seen := map[string]bool{}
		for _, raw := range names {
			name, err := cleanName(raw)
			if err != nil {
				if strings.TrimSpace(raw) != "" {
					res.Invalid = append(res.Invalid, raw)
				}
				continue
			}
			key := NameKey(name)
			if seen[key] {
				continue
			}
			seen[key] = true
			var id int64
			var active bool
			err = tx.QueryRowContext(ctx, `SELECT id, active FROM borrowers WHERE name_key = ?`, key).Scan(&id, &active)
			switch {
			case errors.Is(err, sql.ErrNoRows):
				if _, err := tx.ExecContext(ctx, `INSERT INTO borrowers (name, name_key, created_at) VALUES (?, ?, ?)`, name, key, s.stamp()); err != nil {
					return err
				}
				res.Added++
			case err != nil:
				return err
			case active:
				res.Unchanged++
			default:
				if _, err := tx.ExecContext(ctx, `UPDATE borrowers SET active = 1, name = ? WHERE id = ?`, name, id); err != nil {
					return err
				}
				res.Reactivated++
			}
		}
		if !replace {
			return nil
		}
		rows, err := tx.QueryContext(ctx, `SELECT b.id, b.name, b.name_key,
			EXISTS (SELECT 1 FROM loans l WHERE l.borrower_id = b.id AND l.returned_at IS NULL)
			FROM borrowers b WHERE b.active = 1`)
		if err != nil {
			return err
		}
		var drop []int64
		for rows.Next() {
			var id int64
			var name, key string
			var holding bool
			if err := rows.Scan(&id, &name, &key, &holding); err != nil {
				rows.Close()
				return err
			}
			switch {
			case seen[key]:
			case holding:
				res.KeptActive = append(res.KeptActive, name)
			default:
				drop = append(drop, id)
			}
		}
		rows.Close()
		for _, id := range drop {
			if _, err := tx.ExecContext(ctx, `UPDATE borrowers SET active = 0 WHERE id = ?`, id); err != nil {
				return err
			}
		}
		res.Deactivated = len(drop)
		return nil
	})
	return res, err
}
