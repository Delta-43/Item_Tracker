package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func testUI() fstest.MapFS {
	return fstest.MapFS{
		"index.html":    {Data: []byte("<!doctype html><title>desk</title>")},
		"assets/app.js": {Data: []byte("console.log('desk')")},
	}
}

func do(t *testing.T, h http.Handler, method, target, host, origin string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, nil)
	req.Host = host
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHealth(t *testing.T) {
	h := New(Config{Version: "test"}, testStore(t), testUI())
	rec := do(t, h, http.MethodGet, "/api/health", "localhost:4242", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"version":"test"`) {
		t.Fatalf("health: %d %s", rec.Code, rec.Body)
	}
}

func TestHostGuard(t *testing.T) {
	h := New(Config{AllowedHosts: []string{"desk.lan"}}, testStore(t), testUI())
	for _, host := range []string{"localhost:4242", "127.0.0.1:4242", "[::1]:4242", "desk.lan:4242"} {
		if rec := do(t, h, http.MethodGet, "/api/health", host, ""); rec.Code != http.StatusOK {
			t.Errorf("host %s: got %d", host, rec.Code)
		}
	}
	if rec := do(t, h, http.MethodGet, "/api/health", "evil.example:4242", ""); rec.Code != http.StatusForbidden {
		t.Errorf("rebinding host: got %d", rec.Code)
	}
}

func TestOriginGuard(t *testing.T) {
	h := New(Config{}, testStore(t), testUI())
	if rec := do(t, h, http.MethodPost, "/api/nothing", "localhost:4242", "https://evil.example"); rec.Code != http.StatusForbidden {
		t.Errorf("cross-site post: got %d", rec.Code)
	}
	if rec := do(t, h, http.MethodPost, "/api/nothing", "localhost:4242", "http://localhost:4242"); rec.Code != http.StatusNotFound {
		t.Errorf("same-site post should reach the API: got %d", rec.Code)
	}
}

func TestSPA(t *testing.T) {
	h := New(Config{}, testStore(t), testUI())
	if rec := do(t, h, http.MethodGet, "/history", "localhost", ""); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "desk") {
		t.Errorf("app route should serve index.html: %d", rec.Code)
	}
	rec := do(t, h, http.MethodGet, "/assets/app.js", "localhost", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Errorf("asset: %d %q", rec.Code, rec.Header().Get("Cache-Control"))
	}
	if rec := do(t, h, http.MethodGet, "/api/missing", "localhost", ""); rec.Code != http.StatusNotFound {
		t.Errorf("unknown API route: got %d", rec.Code)
	}
}

func TestSPAMissingBuild(t *testing.T) {
	h := New(Config{}, testStore(t), fstest.MapFS{})
	if rec := do(t, h, http.MethodGet, "/", "localhost", ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("missing build: got %d", rec.Code)
	}
}
