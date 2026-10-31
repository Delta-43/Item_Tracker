package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

// Labels name things on screen so the desk can track any kind of item.
type Labels struct {
	Item      string `json:"item"`      // "Card"
	Items     string `json:"items"`     // "Cards"
	Borrower  string `json:"borrower"`  // "Student"
	Borrowers string `json:"borrowers"` // "Students"
	Desk      string `json:"desk"`      // header title
}

// Settings are shared by every browser tab using the desk.
type Settings struct {
	Labels     map[string]Labels `json:"labels"`     // per language code
	Language   string            `json:"language"`   // "en" or "pl"
	Branding   string            `json:"branding"`   // "42warsaw" or "none"
	Volunteers []string          `json:"volunteers"` // on duty (up to MaxVolunteers); all recorded on each lend and return
	// LegacyVolunteer is the single name stored before teams were supported;
	// it is moved into Volunteers when settings load and never written back.
	LegacyVolunteer string `json:"volunteer,omitempty"`
	OverdueMinutes  int    `json:"overdue_minutes"` // 0 disables the duration rule
	ClosingTime     string `json:"closing_time"`    // "HH:MM" local time, or "" for none
}

// DefaultSettings fit the first deployment: access cards lent to students.
func DefaultSettings() Settings {
	return Settings{
		Labels: map[string]Labels{
			"en": {Item: "Card", Items: "Cards", Borrower: "Student", Borrowers: "Students", Desk: "Access card desk"},
			"pl": {Item: "Karta", Items: "Karty", Borrower: "Uczestnik", Borrowers: "Uczestnicy", Desk: "Wypożyczalnia kart"},
		},
		Language:       "en",
		Branding:       "42warsaw",
		Volunteers:     []string{},
		OverdueMinutes: 180,
		ClosingTime:    "",
	}
}

// MaxVolunteers is how many people can be on duty at the desk at once.
const MaxVolunteers = 5

var clockTime = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

func (st *Settings) validate() error {
	bad := func(code, msg string) error { return errorf(http.StatusUnprocessableEntity, code, "%s", msg) }
	switch {
	case st.Language != "en" && st.Language != "pl":
		return bad("invalid_language", "Language must be en or pl")
	case st.Branding != "42warsaw" && st.Branding != "none":
		return bad("invalid_branding", "Branding must be 42warsaw or none")
	case st.OverdueMinutes < 0 || st.OverdueMinutes > 7*24*60:
		return bad("invalid_overdue", "The overdue limit must be between 0 minutes and 7 days")
	case st.ClosingTime != "" && !clockTime.MatchString(st.ClosingTime):
		return bad("invalid_closing_time", "Closing time must look like 18:30")
	case len(st.Volunteers) > MaxVolunteers:
		return bad("too_many_volunteers", fmt.Sprintf("Up to %d people can be on duty at once", MaxVolunteers))
	}
	for _, v := range st.Volunteers {
		if len([]rune(v)) > maxName {
			return bad("invalid_volunteer", "A volunteer name is too long")
		}
	}
	for lang, l := range st.Labels {
		if lang != "en" && lang != "pl" {
			return bad("invalid_labels", "Labels are only kept for en and pl")
		}
		for _, v := range []string{l.Item, l.Items, l.Borrower, l.Borrowers, l.Desk} {
			if strings.TrimSpace(v) == "" || len([]rune(v)) > 40 {
				return bad("invalid_labels", "Every label needs 1 to 40 characters")
			}
		}
	}
	return nil
}

// Settings returns the stored settings, filling gaps with defaults.
func (s *Store) Settings(ctx context.Context) (Settings, error) {
	st := DefaultSettings()
	var raw string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE id = 1`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return st, nil
	} else if err != nil {
		return st, err
	}
	defaults := st.Labels
	if err := json.Unmarshal([]byte(raw), &st); err != nil {
		return DefaultSettings(), nil
	}
	if st.Labels == nil {
		st.Labels = map[string]Labels{}
	}
	if len(st.Volunteers) == 0 && st.LegacyVolunteer != "" {
		st.Volunteers = []string{st.LegacyVolunteer}
	}
	st.LegacyVolunteer = ""
	if st.Volunteers == nil {
		st.Volunteers = []string{}
	}
	for lang, l := range defaults {
		if _, ok := st.Labels[lang]; !ok {
			st.Labels[lang] = l
		}
	}
	return st, nil
}

// SaveSettings validates and stores the settings.
func (s *Store) SaveSettings(ctx context.Context, st Settings) (Settings, error) {
	st.Volunteers = cleanVolunteers(st.Volunteers)
	st.LegacyVolunteer = ""
	for lang, l := range st.Labels {
		st.Labels[lang] = Labels{cleanText(l.Item), cleanText(l.Items), cleanText(l.Borrower), cleanText(l.Borrowers), cleanText(l.Desk)}
	}
	if err := st.validate(); err != nil {
		return st, err
	}
	raw, _ := json.Marshal(st)
	_, err := s.db.ExecContext(ctx, `INSERT INTO settings (id, value) VALUES (1, ?)
		ON CONFLICT (id) DO UPDATE SET value = excluded.value`, string(raw))
	if err != nil {
		return st, err
	}
	return s.Settings(ctx)
}

// cleanVolunteers tidies spacing and drops blanks and repeats (ignoring case
// and accents), keeping the order people were added in.
func cleanVolunteers(names []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, n := range names {
		n = cleanText(n)
		if n == "" || seen[NameKey(n)] {
			continue
		}
		seen[NameKey(n)] = true
		out = append(out, n)
	}
	return out
}

// OnDuty is the team recorded on a lend or return, e.g. "Kasia M., Piotr".
func (st Settings) OnDuty() string { return strings.Join(st.Volunteers, ", ") }
