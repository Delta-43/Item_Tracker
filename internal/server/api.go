package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/Delta-43/Item_Tracker/internal/store"
)

type api struct {
	store  *store.Store
	events *hub
}

func (a *api) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/state", a.state)
	mux.HandleFunc("GET /api/events", a.events.serve)
	mux.HandleFunc("POST /api/scan", a.scan)

	mux.HandleFunc("GET /api/loans", a.loans)
	mux.HandleFunc("POST /api/loans", a.lend)
	mux.HandleFunc("POST /api/loans/{id}/return", a.returnLoan)
	mux.HandleFunc("POST /api/loans/{id}/undo-return", a.undoReturn)

	mux.HandleFunc("GET /api/borrowers", a.borrowers)
	mux.HandleFunc("POST /api/borrowers", a.addBorrower)
	mux.HandleFunc("POST /api/borrowers/import", a.importRoster)
	mux.HandleFunc("PATCH /api/borrowers/{id}", a.updateBorrower)

	mux.HandleFunc("POST /api/items", a.createItem)
	mux.HandleFunc("PATCH /api/items/{id}", a.updateItem)
	mux.HandleFunc("DELETE /api/items/{id}", a.deleteItem)

	mux.HandleFunc("GET /api/settings", a.settings)
	mux.HandleFunc("PUT /api/settings", a.saveSettings)
	mux.HandleFunc("GET /api/backup", a.backup)
}

// State is everything the desk screen needs in one response.
type State struct {
	Settings   store.Settings   `json:"settings"`
	Items      []store.Item     `json:"items"`
	Borrowers  []store.Borrower `json:"borrowers"`
	Recent     []store.Activity `json:"recent"`
	ServerTime string           `json:"server_time"`
}

func (a *api) state(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var st State
	var err error
	if st.Settings, err = a.store.Settings(ctx); err != nil {
		fail(w, err)
		return
	}
	if st.Items, err = a.store.Items(ctx); err != nil {
		fail(w, err)
		return
	}
	if st.Borrowers, err = a.store.Borrowers(ctx, false); err != nil {
		fail(w, err)
		return
	}
	if st.Recent, err = a.store.Recent(ctx, 12); err != nil {
		fail(w, err)
		return
	}
	st.ServerTime = time.Now().UTC().Format(time.RFC3339Nano)
	writeJSON(w, http.StatusOK, st)
}

// volunteer is whoever is on duty when the action happens.
func (a *api) volunteer(r *http.Request) string {
	st, err := a.store.Settings(r.Context())
	if err != nil {
		return ""
	}
	return st.Volunteer
}

func (a *api) scan(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code string `json:"code"`
	}
	if !decode(w, r, &in) {
		return
	}
	res, err := a.store.Scan(r.Context(), in.Code, a.volunteer(r))
	a.respond(w, res, err, res.Action == "returned")
}

func (a *api) loans(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.LoanFilter{OpenOnly: q.Get("open") == "1"}
	var ok bool
	if f.From, ok = timeParam(w, q.Get("from")); !ok {
		return
	}
	if f.To, ok = timeParam(w, q.Get("to")); !ok {
		return
	}
	f.ItemID, _ = strconv.ParseInt(q.Get("item_id"), 10, 64)
	f.BorrowerID, _ = strconv.ParseInt(q.Get("borrower_id"), 10, 64)
	f.Limit, _ = strconv.Atoi(q.Get("limit"))
	list, err := a.store.Loans(r.Context(), f)
	a.respond(w, list, err, false)
}

func (a *api) lend(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ItemID     int64 `json:"item_id"`
		BorrowerID int64 `json:"borrower_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	loan, err := a.store.Lend(r.Context(), in.ItemID, in.BorrowerID, a.volunteer(r))
	a.respondCreated(w, loan, err)
}

func (a *api) returnLoan(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	loan, err := a.store.Return(r.Context(), id, a.volunteer(r))
	a.respond(w, loan, err, true)
}

func (a *api) undoReturn(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	loan, err := a.store.UndoReturn(r.Context(), id)
	a.respond(w, loan, err, true)
}

func (a *api) borrowers(w http.ResponseWriter, r *http.Request) {
	list, err := a.store.Borrowers(r.Context(), r.URL.Query().Get("all") == "1")
	a.respond(w, list, err, false)
}

func (a *api) addBorrower(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &in) {
		return
	}
	b, err := a.store.AddBorrower(r.Context(), in.Name)
	a.respondCreated(w, b, err)
}

func (a *api) importRoster(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Names   []string `json:"names"`
		Replace bool     `json:"replace"`
	}
	if !decode(w, r, &in) {
		return
	}
	res, err := a.store.ImportRoster(r.Context(), in.Names, in.Replace)
	a.respond(w, res, err, true)
}

func (a *api) updateBorrower(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var in struct {
		Active bool `json:"active"`
	}
	if !decode(w, r, &in) {
		return
	}
	b, err := a.store.SetBorrowerActive(r.Context(), id, in.Active)
	a.respond(w, b, err, true)
}

func (a *api) createItem(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Label string `json:"label"`
		Code  string `json:"code"`
	}
	if !decode(w, r, &in) {
		return
	}
	it, err := a.store.CreateItem(r.Context(), in.Label, in.Code)
	a.respondCreated(w, it, err)
}

func (a *api) updateItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var p store.ItemPatch
	if !decode(w, r, &p) {
		return
	}
	it, err := a.store.UpdateItem(r.Context(), id, p, a.volunteer(r))
	a.respond(w, it, err, true)
}

func (a *api) deleteItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	err := a.store.DeleteItem(r.Context(), id)
	if err == nil {
		a.events.notify()
		w.WriteHeader(http.StatusNoContent)
		return
	}
	fail(w, err)
}

func (a *api) settings(w http.ResponseWriter, r *http.Request) {
	st, err := a.store.Settings(r.Context())
	a.respond(w, st, err, false)
}

func (a *api) saveSettings(w http.ResponseWriter, r *http.Request) {
	var st store.Settings
	if !decode(w, r, &st) {
		return
	}
	saved, err := a.store.SaveSettings(r.Context(), st)
	a.respond(w, saved, err, true)
}

// backup streams a consistent copy of the database for safekeeping.
func (a *api) backup(w http.ResponseWriter, r *http.Request) {
	dir, err := os.MkdirTemp("", "item-tracker-backup-")
	if err != nil {
		fail(w, err)
		return
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "backup.db")
	if err := a.store.Backup(r.Context(), path); err != nil {
		fail(w, err)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		fail(w, err)
		return
	}
	defer f.Close()
	name := fmt.Sprintf("item-tracker-%s.db", time.Now().Format("2006-01-02-1504"))
	w.Header().Set("Content-Type", "application/vnd.sqlite3")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	w.Header().Set("Cache-Control", "no-store")
	_, _ = io.Copy(w, f)
}

// respond writes v or the error; changed tells open tabs to refresh.
func (a *api) respond(w http.ResponseWriter, v any, err error, changed bool) {
	if err != nil {
		fail(w, err)
		return
	}
	if changed {
		a.events.notify()
	}
	writeJSON(w, http.StatusOK, v)
}

func (a *api) respondCreated(w http.ResponseWriter, v any, err error) {
	if err != nil {
		fail(w, err)
		return
	}
	a.events.notify()
	writeJSON(w, http.StatusCreated, v)
}

func fail(w http.ResponseWriter, err error) {
	if e, ok := store.AsError(err); ok {
		writeJSON(w, e.Status, e)
		return
	}
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal", "Something went wrong; try again")
}

const maxBody = 1 << 20

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large", "The request is too large")
		} else {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body is not valid JSON for this endpoint")
		}
		return false
	}
	return true
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "bad_id", "Invalid id")
		return 0, false
	}
	return id, true
}

// timeParam normalises an RFC 3339 query value to the store's UTC format.
func timeParam(w http.ResponseWriter, v string) (string, bool) {
	if v == "" {
		return "", true
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_time", "Times must be RFC 3339, like 2026-11-02T09:00:00Z")
		return "", false
	}
	return t.UTC().Format("2006-01-02T15:04:05.000Z"), true
}
