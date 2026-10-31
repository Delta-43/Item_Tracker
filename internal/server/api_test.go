package server

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Delta-43/Item_Tracker/internal/store"
)

// Names in tests are invented; real rosters never enter the repository.

func testStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

type client struct {
	t *testing.T
	h http.Handler
}

func newClient(t *testing.T) *client {
	return &client{t: t, h: New(Config{}, testStore(t), testUI())}
}

// call sends JSON as the desk tab would and decodes the reply into out.
func (c *client) call(method, path string, body any, wantStatus int, out any) {
	c.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Host = "localhost:4242"
	req.Header.Set("Origin", "http://localhost:4242")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	if rec.Code != wantStatus {
		c.t.Fatalf("%s %s: status %d, want %d: %s", method, path, rec.Code, wantStatus, rec.Body)
	}
	if out != nil {
		if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
			c.t.Fatalf("%s %s: decode: %v (%s)", method, path, err, rec.Body)
		}
	}
}

func TestDeskFlow(t *testing.T) {
	c := newClient(t)

	var settings store.Settings
	c.call("GET", "/api/settings", nil, 200, &settings)
	settings.Volunteers = []string{"Kasia M.", "Piotr"}
	c.call("PUT", "/api/settings", settings, 200, &settings)

	var item store.Item
	c.call("POST", "/api/items", map[string]string{"label": "Card 3", "code": "carddesk:3"}, 201, &item)
	var imported store.ImportResult
	c.call("POST", "/api/borrowers/import", map[string]any{"names": []string{"Ada Testowa", "Bo Przykład"}}, 200, &imported)
	if imported.Added != 2 {
		t.Fatalf("import: %+v", imported)
	}
	var roster []store.Borrower
	c.call("GET", "/api/borrowers", nil, 200, &roster)

	var scan store.ScanResult
	c.call("POST", "/api/scan", map[string]string{"code": "carddesk:3"}, 200, &scan)
	if scan.Action != "lend" || scan.Item.ID != item.ID {
		t.Fatalf("scan free: %+v", scan)
	}
	var loan store.Loan
	c.call("POST", "/api/loans", map[string]int64{"item_id": item.ID, "borrower_id": roster[0].ID}, 201, &loan)
	if loan.LentBy != "Kasia M., Piotr" {
		t.Fatalf("volunteer not recorded: %+v", loan)
	}
	var apiErr store.Error
	c.call("POST", "/api/loans", map[string]int64{"item_id": item.ID, "borrower_id": roster[1].ID}, 409, &apiErr)
	if apiErr.Code != "item_busy" || !strings.Contains(apiErr.Message, "Ada Testowa") {
		t.Fatalf("busy error: %+v", apiErr)
	}

	var state State
	c.call("GET", "/api/state", nil, 200, &state)
	if len(state.Items) != 1 || state.Items[0].Loan == nil || len(state.Borrowers) != 2 || len(state.Recent) != 1 {
		t.Fatalf("state: %+v", state)
	}

	c.call("POST", "/api/scan", map[string]string{"code": "carddesk:3"}, 200, &scan)
	if scan.Action != "returned" || scan.Loan == nil || scan.Loan.ReturnedBy != "Kasia M., Piotr" {
		t.Fatalf("scan lent: %+v", scan)
	}
	c.call("POST", "/api/loans/"+itoa(loan.ID)+"/undo-return", nil, 200, &loan)
	if loan.ReturnedAt != "" {
		t.Fatalf("undo: %+v", loan)
	}
	c.call("POST", "/api/loans/"+itoa(loan.ID)+"/return", nil, 200, &loan)

	var history []store.Loan
	c.call("GET", "/api/loans?from=2000-01-01T00:00:00Z", nil, 200, &history)
	if len(history) != 1 || history[0].CloseReason != "returned" {
		t.Fatalf("history: %+v", history)
	}
	c.call("GET", "/api/loans?from=yesterday", nil, 400, &apiErr)
	c.call("POST", "/api/scan", map[string]string{"code": "unknown"}, 404, &apiErr)
	if apiErr.Code != "unknown_code" {
		t.Fatalf("unknown code: %+v", apiErr)
	}
}

func TestItemAndRosterEndpoints(t *testing.T) {
	c := newClient(t)
	var item store.Item
	c.call("POST", "/api/items", map[string]string{"label": "Key A"}, 201, &item)
	if !strings.HasPrefix(item.Code, "item:") {
		t.Fatalf("generated code: %q", item.Code)
	}
	damaged := "damaged"
	c.call("PATCH", "/api/items/"+itoa(item.ID), map[string]any{"condition": damaged, "note": "cracked"}, 200, &item)
	if item.Condition != "damaged" || item.Note != "cracked" {
		t.Fatalf("patch: %+v", item)
	}
	var apiErr store.Error
	c.call("PATCH", "/api/items/"+itoa(item.ID), map[string]any{"colour": "red"}, 400, &apiErr)
	c.call("DELETE", "/api/items/"+itoa(item.ID), nil, 204, nil)
	c.call("DELETE", "/api/items/"+itoa(item.ID), nil, 404, &apiErr)

	var b store.Borrower
	c.call("POST", "/api/borrowers", map[string]string{"name": "Zoë Testowa"}, 201, &b)
	c.call("POST", "/api/borrowers", map[string]string{"name": "zoe testowa"}, 409, &apiErr)
	c.call("PATCH", "/api/borrowers/"+itoa(b.ID), map[string]bool{"active": false}, 200, &b)
	var all []store.Borrower
	c.call("GET", "/api/borrowers?all=1", nil, 200, &all)
	if len(all) != 1 || all[0].Active {
		t.Fatalf("all borrowers: %+v", all)
	}
}

func TestBackupDownload(t *testing.T) {
	c := newClient(t)
	req := httptest.NewRequest("GET", "/api/backup", nil)
	req.Host = "localhost"
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	if rec.Code != 200 || !bytes.HasPrefix(rec.Body.Bytes(), []byte("SQLite format 3")) {
		t.Fatalf("backup: %d %q", rec.Code, rec.Body.Bytes()[:min(16, rec.Body.Len())])
	}
	if !strings.Contains(rec.Header().Get("Content-Disposition"), "item-tracker-") {
		t.Fatalf("filename: %q", rec.Header().Get("Content-Disposition"))
	}
}

func TestRestoreUpload(t *testing.T) {
	c := newClient(t)
	c.call("POST", "/api/items", map[string]string{"label": "1"}, 201, nil)
	req := httptest.NewRequest("GET", "/api/backup", nil)
	req.Host = "localhost"
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	backup := rec.Body.Bytes()
	c.call("POST", "/api/items", map[string]string{"label": "2"}, 201, nil)

	upload := func(body []byte, origin string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/restore", bytes.NewReader(body))
		req.Host = "localhost:4242"
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		c.h.ServeHTTP(rec, req)
		return rec
	}
	if rec := upload(backup, "http://evil.example"); rec.Code != http.StatusForbidden {
		t.Fatalf("cross-site restore: %d", rec.Code)
	}
	if rec := upload([]byte("not a database at all"), "http://localhost:4242"); rec.Code != 422 || !strings.Contains(rec.Body.String(), "not_a_backup") {
		t.Fatalf("junk upload: %d %s", rec.Code, rec.Body)
	}
	rec = upload(backup, "http://localhost:4242")
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"saved":"before-restore-`) {
		t.Fatalf("restore: %d %s", rec.Code, rec.Body)
	}
	var st State
	c.call("GET", "/api/state", nil, 200, &st)
	if len(st.Items) != 1 || st.Items[0].Label != "1" {
		t.Fatalf("items after restore: %+v", st.Items)
	}
}

func TestEventsNotifyOnChange(t *testing.T) {
	st := testStore(t)
	srv := httptest.NewServer(New(Config{}, st, testUI()))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", srv.URL+"/api/events", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	lines := bufio.NewScanner(resp.Body)
	waitFor := func(event string) {
		t.Helper()
		for lines.Scan() {
			if lines.Text() == "event: "+event {
				return
			}
		}
		t.Fatalf("no %q event: %v", event, lines.Err())
	}
	waitFor("ready")

	post, _ := http.NewRequest("POST", srv.URL+"/api/items", strings.NewReader(`{"label":"Card 1"}`))
	post.Header.Set("Content-Type", "application/json")
	if r, err := http.DefaultClient.Do(post); err != nil || r.StatusCode != 201 {
		t.Fatalf("create item: %v %v", r, err)
	}
	waitFor("change")
}

func itoa(id int64) string {
	b, _ := json.Marshal(id)
	return string(b)
}
