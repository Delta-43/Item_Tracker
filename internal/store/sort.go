package store

import (
	"slices"
	"strings"
	"unicode"

	"golang.org/x/text/cases"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// sortItems orders labels naturally, so "Card 2" comes before "Card 10".
func sortItems(items []Item) {
	slices.SortStableFunc(items, func(a, b Item) int { return naturalCompare(a.Label, b.Label) })
}

func naturalCompare(a, b string) int {
	a, b = strings.ToLower(a), strings.ToLower(b)
	for a != "" && b != "" {
		ra, rb := []rune(a)[0], []rune(b)[0]
		if unicode.IsDigit(ra) && unicode.IsDigit(rb) {
			na, restA := leadingNumber(a)
			nb, restB := leadingNumber(b)
			if c := compareNumeric(na, nb); c != 0 {
				return c
			}
			a, b = restA, restB
			continue
		}
		if ra != rb {
			if ra < rb {
				return -1
			}
			return 1
		}
		a, b = a[len(string(ra)):], b[len(string(rb)):]
	}
	return len(a) - len(b)
}

func leadingNumber(s string) (string, string) {
	i := strings.IndexFunc(s, func(r rune) bool { return !unicode.IsDigit(r) })
	if i < 0 {
		return s, ""
	}
	return s[:i], s[i:]
}

func compareNumeric(a, b string) int {
	a, b = strings.TrimLeft(a, "0"), strings.TrimLeft(b, "0")
	if len(a) != len(b) {
		return len(a) - len(b)
	}
	return strings.Compare(a, b)
}

var folder = cases.Fold()

// NameKey identifies a person regardless of case, accents and spacing, so
// "Łukasz  Nowicki" and "lukasz nowicki" are the same roster entry.
func NameKey(name string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	stripped, _, _ := transform.String(t, cleanText(name))
	// Letters that are distinct base characters rather than base + accent.
	stripped = strings.NewReplacer("ł", "l", "Ł", "L", "ø", "o", "Ø", "O", "đ", "d", "Đ", "D", "ı", "i").Replace(stripped)
	return folder.String(stripped)
}
