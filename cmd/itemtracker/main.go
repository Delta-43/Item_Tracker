// Command itemtracker runs the lending desk: one binary serving the API and web app.
package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Delta-43/Item_Tracker/internal/server"
	"github.com/Delta-43/Item_Tracker/internal/store"
	"github.com/Delta-43/Item_Tracker/web"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	addr := env("ITEMTRACKER_ADDR", ":4242")
	dataDir := env("ITEMTRACKER_DATA", "data")
	st, err := store.Open(dataDir)
	if err != nil {
		return fmt.Errorf("open database in %s: %w", dataDir, err)
	}
	defer st.Close()
	ui, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		return err
	}
	handler := server.New(server.Config{
		AllowedHosts: strings.Split(os.Getenv("ITEMTRACKER_ALLOWED_HOSTS"), ","),
		Version:      version,
	}, st, ui)

	srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 10 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Printf("Item Tracker %s listening on %s (data in %s)", version, addr, dataDir)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// healthcheck lets the distroless container check itself without curl.
func healthcheck() int {
	port := env("ITEMTRACKER_ADDR", ":4242")
	if i := strings.LastIndex(port, ":"); i >= 0 {
		port = port[i+1:]
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/api/health")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "unhealthy:", resp.Status)
		return 1
	}
	return 0
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
