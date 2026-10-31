package store

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Names in tests are invented; real rosters never enter the repository.

type fixture struct {
	t     *testing.T
	s     *Store
	clock time.Time
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	f := &fixture{t: t, s: s, clock: time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC)}
	s.SetClock(func() time.Time { return f.clock })
	return f
}

func (f *fixture) tick(d time.Duration) { f.clock = f.clock.Add(d) }

func (f *fixture) item(label, code string) Item {
	f.t.Helper()
	it, err := f.s.CreateItem(context.Background(), label, code)
	if err != nil {
		f.t.Fatal(err)
	}
	return it
}

func (f *fixture) borrower(name string) Borrower {
	f.t.Helper()
	b, err := f.s.AddBorrower(context.Background(), name)
	if err != nil {
		f.t.Fatal(err)
	}
	return b
}

func wantCode(t *testing.T, err error, code string) {
	t.Helper()
	e, ok := AsError(err)
	if !ok || e.Code != code {
		t.Fatalf("want error %q, got %v", code, err)
	}
}

func TestLendScanReturnUndo(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	card := f.item("Card 1", "carddesk:4242")
	ada := f.borrower("Ada Testowa")

	res, err := f.s.Scan(ctx, " carddesk:4242 ", "Vol")
	if err != nil || res.Action != "lend" {
		t.Fatalf("scan free item: %+v %v", res, err)
	}
	loan, err := f.s.Lend(ctx, card.ID, ada.ID, "Vol")
	if err != nil {
		t.Fatal(err)
	}
	if loan.LentAt != "2026-11-02T09:00:00.000Z" || loan.LentBy != "Vol" || loan.BorrowerName != "Ada Testowa" {
		t.Fatalf("loan: %+v", loan)
	}

	f.tick(2*time.Hour + 14*time.Minute)
	res, err = f.s.Scan(ctx, "carddesk:4242", "Other")
	if err != nil || res.Action != "returned" || res.Loan.ReturnedAt != "2026-11-02T11:14:00.000Z" || res.Loan.ReturnedBy != "Other" {
		t.Fatalf("scan lent item: %+v %v", res, err)
	}

	if _, err := f.s.UndoReturn(ctx, loan.ID); err != nil {
		t.Fatal(err)
	}
	it, _ := f.s.Item(ctx, card.ID)
	if it.Loan == nil || it.Loan.ID != loan.ID {
		t.Fatalf("undo should reopen the loan: %+v", it)
	}
	_, err = f.s.UndoReturn(ctx, loan.ID)
	wantCode(t, err, "cannot_undo")
}

func TestLendRules(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	c1, c2 := f.item("Card 1", ""), f.item("Card 2", "")
	ada, bo := f.borrower("Ada Testowa"), f.borrower("Bo Przykład")

	if _, err := f.s.Lend(ctx, c1.ID, ada.ID, ""); err != nil {
		t.Fatal(err)
	}
	_, err := f.s.Lend(ctx, c1.ID, bo.ID, "")
	wantCode(t, err, "item_busy")
	_, err = f.s.Lend(ctx, c2.ID, ada.ID, "")
	wantCode(t, err, "borrower_has_item")

	if _, err := f.s.SetBorrowerActive(ctx, bo.ID, false); err != nil {
		t.Fatal(err)
	}
	_, err = f.s.Lend(ctx, c2.ID, bo.ID, "")
	wantCode(t, err, "not_on_roster")

	damaged := ConditionDamaged
	if _, err := f.s.UpdateItem(ctx, c2.ID, ItemPatch{Condition: &damaged}, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.SetBorrowerActive(ctx, bo.ID, true); err != nil {
		t.Fatal(err)
	}
	_, err = f.s.Lend(ctx, c2.ID, bo.ID, "")
	wantCode(t, err, "item_out_of_service")
	res, err := f.s.Scan(ctx, c2.Code, "")
	if err != nil || res.Action != "out_of_service" {
		t.Fatalf("scan damaged: %+v %v", res, err)
	}
	_, err = f.s.Scan(ctx, "nope", "")
	wantCode(t, err, "unknown_code")
}

func TestMarkLentItemLostClosesLoan(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	c := f.item("Card 7", "")
	ada := f.borrower("Ada Testowa")
	loan, _ := f.s.Lend(ctx, c.ID, ada.ID, "")
	lost := ConditionLost
	it, err := f.s.UpdateItem(ctx, c.ID, ItemPatch{Condition: &lost}, "Vol")
	if err != nil || it.Loan != nil || it.Condition != "lost" {
		t.Fatalf("mark lost: %+v %v", it, err)
	}
	history, _ := f.s.Loans(ctx, LoanFilter{ItemID: c.ID})
	if len(history) != 1 || history[0].ID != loan.ID || history[0].CloseReason != "lost" || history[0].ReturnedBy != "Vol" {
		t.Fatalf("history: %+v", history)
	}
	_, err = f.s.UndoReturn(ctx, loan.ID)
	wantCode(t, err, "cannot_undo")
	// Ada no longer holds an item, so she can borrow again.
	c2 := f.item("Card 8", "")
	if _, err := f.s.Lend(ctx, c2.ID, ada.ID, ""); err != nil {
		t.Fatal(err)
	}
}

func TestItemsValidationAndOrder(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	for _, l := range []string{"Card 10", "Card 2", "Card 1"} {
		f.item(l, "")
	}
	_, err := f.s.CreateItem(ctx, "card 2", "")
	wantCode(t, err, "label_taken")
	f.item("Spare", "fixed")
	_, err = f.s.CreateItem(ctx, "Other", "fixed")
	wantCode(t, err, "code_taken")
	_, err = f.s.CreateItem(ctx, "  ", "")
	wantCode(t, err, "invalid_label")

	items, _ := f.s.Items(ctx)
	var labels []string
	for _, it := range items {
		labels = append(labels, it.Label)
	}
	if got := labels; len(got) != 4 || got[0] != "Card 1" || got[1] != "Card 2" || got[2] != "Card 10" || got[3] != "Spare" {
		t.Fatalf("natural order: %v", got)
	}
}

func TestDeleteItem(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	unused, used := f.item("A", ""), f.item("B", "")
	ada := f.borrower("Ada Testowa")
	f.s.Lend(ctx, used.ID, ada.ID, "")
	if err := f.s.DeleteItem(ctx, unused.ID); err != nil {
		t.Fatal(err)
	}
	wantCode(t, f.s.DeleteItem(ctx, used.ID), "has_history")
	wantCode(t, f.s.DeleteItem(ctx, unused.ID), "item_not_found")
}

func TestImportRoster(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	res, err := f.s.ImportRoster(ctx, []string{"Łukasz  Przykładowy", "lukasz przykladowy", "Zoë Testowa", "", "  "}, false)
	if err != nil || res.Added != 2 {
		t.Fatalf("first import: %+v %v", res, err)
	}
	all, _ := f.s.Borrowers(ctx, false)
	if len(all) != 2 || all[0].Name != "Łukasz Przykładowy" {
		t.Fatalf("roster: %+v", all)
	}

	// Zoë holds an item, so a replacing import keeps her on the roster.
	c := f.item("Card 1", "")
	f.s.Lend(ctx, c.ID, all[1].ID, "")
	res, err = f.s.ImportRoster(ctx, []string{"Nowa Osoba"}, true)
	if err != nil || res.Added != 1 || res.Deactivated != 1 || len(res.KeptActive) != 1 || res.KeptActive[0] != "Zoë Testowa" {
		t.Fatalf("replace import: %+v %v", res, err)
	}
	res, _ = f.s.ImportRoster(ctx, []string{"ŁUKASZ PRZYKŁADOWY"}, false)
	if res.Reactivated != 1 {
		t.Fatalf("reactivate: %+v", res)
	}
	_, err = f.s.AddBorrower(ctx, "nowa osoba")
	wantCode(t, err, "already_on_roster")
}

func TestNameKey(t *testing.T) {
	cases := map[string]string{
		"Łukasz Wójcik":    "lukasz wojcik",
		"Ümmü  Güzeliş":    "ummu guzelis",
		"İnci":             "inci",
		"Małgorzata Żak":   "malgorzata zak",
		"ZOFIA Wiśniewska": "zofia wisniewska",
	}
	for in, want := range cases {
		if got := NameKey(in); got != want {
			t.Errorf("NameKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestRecentAndHistoryFilters(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	c := f.item("Card 1", "")
	ada := f.borrower("Ada Testowa")
	l1, _ := f.s.Lend(ctx, c.ID, ada.ID, "")
	f.tick(time.Hour)
	f.s.Return(ctx, l1.ID, "")
	f.tick(time.Hour)
	f.s.Lend(ctx, c.ID, ada.ID, "")

	recent, err := f.s.Recent(ctx, 10)
	if err != nil || len(recent) != 3 || recent[0].Kind != "lent" || recent[1].Kind != "returned" || recent[2].Kind != "lent" {
		t.Fatalf("recent: %+v %v", recent, err)
	}
	open, _ := f.s.Loans(ctx, LoanFilter{OpenOnly: true})
	if len(open) != 1 {
		t.Fatalf("open loans: %+v", open)
	}
	window, _ := f.s.Loans(ctx, LoanFilter{From: "2026-11-02T10:30:00.000Z"})
	if len(window) != 1 {
		t.Fatalf("from filter: %+v", window)
	}
}

func TestSettingsAndBackup(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	st, _ := f.s.Settings(ctx)
	if st.OverdueMinutes != 180 || st.Labels["en"].Item != "Card" || st.Volunteers == nil {
		t.Fatalf("defaults: %+v", st)
	}
	st.Volunteers = []string{"  Kasia  M. ", "", "Piotr", "kasia m."}
	st.ClosingTime = "19:00"
	saved, err := f.s.SaveSettings(ctx, st)
	if err != nil || saved.OnDuty() != "Kasia M., Piotr" || saved.ClosingTime != "19:00" {
		t.Fatalf("save: %+v %v", saved, err)
	}
	st.ClosingTime = "25:00"
	_, err = f.s.SaveSettings(ctx, st)
	wantCode(t, err, "invalid_closing_time")

	path := filepath.Join(t.TempDir(), "backup.db")
	if err := f.s.Backup(ctx, path); err != nil {
		t.Fatal(err)
	}
	copyStore, err := OpenFile(path)
	if err != nil {
		t.Fatal(err)
	}
	defer copyStore.Close()
	got, _ := copyStore.Settings(ctx)
	if got.OnDuty() != "Kasia M., Piotr" {
		t.Fatalf("backup lost settings: %+v", got)
	}
}

func TestVolunteersLimitAndLegacyMigration(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	st, _ := f.s.Settings(ctx)
	st.Volunteers = []string{"A", "B", "C", "D", "E", "F"}
	_, err := f.s.SaveSettings(ctx, st)
	wantCode(t, err, "too_many_volunteers")

	// A desk saved before teams existed stored one "volunteer" string.
	if _, err := f.s.db.ExecContext(ctx, `INSERT INTO settings (id, value) VALUES (1, '{"language":"en","branding":"none","volunteer":"Ola Dawna","overdue_minutes":60}')
		ON CONFLICT (id) DO UPDATE SET value = excluded.value`); err != nil {
		t.Fatal(err)
	}
	got, err := f.s.Settings(ctx)
	if err != nil || len(got.Volunteers) != 1 || got.Volunteers[0] != "Ola Dawna" || got.LegacyVolunteer != "" {
		t.Fatalf("legacy migration: %+v %v", got, err)
	}
}

func TestRestore(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	it := f.item("1", "")
	ola := f.borrower("Ola Zapasowa")
	if _, err := f.s.Lend(ctx, it.ID, ola.ID, "Kasia"); err != nil {
		t.Fatal(err)
	}
	st, _ := f.s.Settings(ctx)
	st.ClosingTime = "18:00"
	if _, err := f.s.SaveSettings(ctx, st); err != nil {
		t.Fatal(err)
	}
	backup := filepath.Join(t.TempDir(), "backup.db")
	if err := f.s.Backup(ctx, backup); err != nil {
		t.Fatal(err)
	}

	// Change everything after the backup, then restore it.
	f.item("2", "")
	f.borrower("Jan Późniejszy")
	st.ClosingTime = ""
	f.s.SaveSettings(ctx, st)
	f.tick(time.Hour)
	saved, err := f.s.Restore(ctx, backup)
	if err != nil {
		t.Fatal(err)
	}
	items, _ := f.s.Items(ctx)
	people, _ := f.s.Borrowers(ctx, true)
	got, _ := f.s.Settings(ctx)
	if len(items) != 1 || items[0].Loan == nil || items[0].Loan.BorrowerName != "Ola Zapasowa" || len(people) != 1 || got.ClosingTime != "18:00" {
		t.Fatalf("after restore: items %+v people %+v settings %+v", items, people, got)
	}

	// The data from before the restore was saved and is itself a valid backup.
	if saved != "before-restore-2026-11-02-100000.db" {
		t.Fatalf("saved as %q", saved)
	}
	if _, err := f.s.Restore(ctx, filepath.Join(filepath.Dir(f.s.path), saved)); err != nil {
		t.Fatal(err)
	}
	if items, _ = f.s.Items(ctx); len(items) != 2 {
		t.Fatalf("undo restore: %+v", items)
	}
}

func TestRestoreRefusesOtherFiles(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	f.item("1", "")
	dir := t.TempDir()

	junk := filepath.Join(dir, "junk.db")
	os.WriteFile(junk, []byte("hello, not a database"), 0o600)
	_, err := f.s.Restore(ctx, junk)
	wantCode(t, err, "not_a_backup")

	empty := filepath.Join(dir, "empty.db")
	os.WriteFile(empty, nil, 0o600)
	_, err = f.s.Restore(ctx, empty)
	wantCode(t, err, "not_a_backup")

	newer := filepath.Join(dir, "newer.db")
	if err := f.s.Backup(ctx, newer); err != nil {
		t.Fatal(err)
	}
	db, _ := sql.Open("sqlite", "file:"+newer)
	db.Exec(fmt.Sprintf(`PRAGMA user_version = %d`, len(migrations)+1))
	db.Close()
	_, err = f.s.Restore(ctx, newer)
	wantCode(t, err, "backup_too_new")

	if items, _ := f.s.Items(ctx); len(items) != 1 {
		t.Fatalf("a refused restore changed the desk: %+v", items)
	}
}
