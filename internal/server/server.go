// Package server wires the HTTP API and the embedded web app together.
package server

import (
	"encoding/json"
	"io/fs"
	"net"
	"net/http"
	"path"
	"strings"

	"github.com/Delta-43/Item_Tracker/internal/store"
)

// Config controls how the server accepts requests.
type Config struct {
	// AllowedHosts lists extra Host header values (without port) accepted in
	// addition to localhost, 127.0.0.1 and ::1.
	AllowedHosts []string
	// Version is reported by /api/health.
	Version string
}

// New returns the root handler: the JSON API under /api and the web app elsewhere.
func New(cfg Config, st *store.Store, ui fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": cfg.Version})
	})
	(&api{store: st, events: newHub()}).routes(mux)
	mux.Handle("/api/", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "Unknown API endpoint")
	}))
	mux.Handle("/", spaHandler(ui))
	return guard(cfg.AllowedHosts, mux)
}

// guard rejects requests that did not come from the desk's own browser tab.
// The Host check stops DNS-rebinding pages; the Origin check stops other sites
// from posting to the local API with the volunteer's browser.
func guard(extraHosts []string, next http.Handler) http.Handler {
	allowed := map[string]bool{"localhost": true, "127.0.0.1": true, "::1": true}
	for _, h := range extraHosts {
		if h = strings.TrimSpace(strings.ToLower(h)); h != "" {
			allowed[h] = true
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowed[hostOnly(r.Host)] {
			writeError(w, http.StatusForbidden, "host_not_allowed", "This address is not allowed; open the desk at http://localhost")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if origin := r.Header.Get("Origin"); origin != "" && !sameHost(origin, r.Host) {
				writeError(w, http.StatusForbidden, "origin_not_allowed", "Requests from other sites are not allowed")
				return
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

func hostOnly(hostport string) string {
	host, _, err := net.SplitHostPort(hostport)
	if err != nil {
		host = hostport
	}
	return strings.ToLower(strings.Trim(host, "[]"))
}

func sameHost(origin, host string) bool {
	rest, ok := strings.CutPrefix(origin, "http://")
	if !ok {
		rest, ok = strings.CutPrefix(origin, "https://")
	}
	return ok && strings.EqualFold(rest, host)
}

// spaHandler serves built assets and falls back to index.html for app routes.
func spaHandler(ui fs.FS) http.Handler {
	files := http.FileServerFS(ui)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" {
			if info, err := fs.Stat(ui, name); err == nil && !info.IsDir() {
				if strings.HasPrefix(name, "assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				files.ServeHTTP(w, r)
				return
			}
		}
		index, err := fs.ReadFile(ui, "index.html")
		if err != nil {
			http.Error(w, "The web app is not built. Run `npm run build` in web/ and rebuild the server.", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(index)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
