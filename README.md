# Item Tracker

A self-hosted lending desk. Stick a QR code on each item you lend out (access cards, keys, laptops, tools), scan it with the laptop's webcam, and Item Tracker records who has it and since when. Scan it again when it comes back.

It runs on one computer with one Docker command. No accounts, no cloud, no RFID reader, no internet connection needed at the desk, and all data stays on that computer.

> **Status:** early development. The skeleton is in place; the desk is being built feature by feature (see [Roadmap](#roadmap)).

## Quick start (Windows)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
2. Download [`compose.yaml`](compose.yaml) into a new folder.
3. Open a terminal in that folder and run:

   ```powershell
   docker compose up -d
   ```

4. Open <http://localhost:4242> in Chrome, Edge or Firefox and allow camera access.

To stop the desk, run `docker compose down`. Your data stays in the `item-tracker-data` Docker volume until you delete it with `docker volume rm`.

The desk only listens on `127.0.0.1`, so other devices on the network can't reach it.

## Roadmap

- [x] Project skeleton: Go server, React app, Docker image, CI
- [x] Items, borrowers and loans stored in SQLite, with a JSON API and live updates
- [x] The desk: live item map, browser QR scanning, lend and return
- [x] Borrower roster import (only roster names can borrow) and the volunteer on duty
- [ ] Loan history with CSV export, overdue highlighting, lost/damaged items
- [ ] Printable QR sheets (1.25 in squares on A4), configurable labels, Polish translation

## Privacy

Borrower names, the roster and the database live only in the local Docker volume. Nothing is sent anywhere, and none of it belongs in this repository: `data/` and `private/` are git-ignored, and tests use invented names.

## Development

Requirements: Go 1.27, Node.js 24.

```bash
cd web && npm ci && npm run build && cd ..
go run ./cmd/itemtracker
```

The server listens on `:4242`. For live frontend reloading, keep the Go server running and start Vite in another terminal with `cd web && npm run dev`; it proxies `/api` to the Go server.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ITEMTRACKER_ADDR` | `:4242` | Listen address |
| `ITEMTRACKER_DATA` | `./data` | Folder for the SQLite database |
| `ITEMTRACKER_ALLOWED_HOSTS` | _(empty)_ | Extra host names allowed besides `localhost`, comma-separated |

Build the image yourself with `docker build -t item-tracker .`.

Tests:

```bash
go test ./...                       # server
cd web && npm test                  # frontend units
npx playwright test                 # end to end; needs web/dist and bin/itemtracker built first
```

The end-to-end suite gives Chromium a fake camera that plays a generated QR code video, so the whole scan path (camera, decoder, lend, return) is exercised without hardware.

## Acknowledgements

Item Tracker grew out of an idea by **Stanisław Zdanowski**, who built the original card-lending desk for 42 Warsaw's Discovery Piscine. His larger system had a self-service kiosk where students requested cards, volunteer approval from phones, a Stream Deck button panel, QR scanning through the host computer's webcam, and a full label-printing studio. Item Tracker keeps his core idea, QR-tagged items lent to people with a complete record, and reshapes it into a smaller, portable tool anyone can run.

## License

[MIT](LICENSE) © 2026 Debadeep Chaudhury. The 42 Warsaw logo is a trademark of 42 Warsaw and is not covered by the license; see [TRADEMARKS.md](TRADEMARKS.md).
