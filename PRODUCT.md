# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-chosen: Go single binary with SQLite (pure-Go driver), React + TypeScript built with Vite and embedded in the binary, Tailwind CSS + shadcn/ui. Shipped as a Docker image (ghcr.io) and run with Docker Compose.

## Users

Volunteers staffing a campus desk. During a one-week course, about 100 students can only enter and leave campus with an access card, and the volunteers manage about 10 such cards. The volunteer's job is to lend a card to a student, take it back, and always know which student holds which card and since when. Only volunteers look at the screen.

## Product Purpose

Item_Tracker is a self-hosted lending desk: items (access cards by default) are lent to people (students by default) and returned, with every loan recorded with its start and end time. Success means a lend or return takes seconds, nobody ever has to ask "who has card 7?", and the week ends with a complete, exportable history.

It is generic and reusable by anyone: the item and borrower labels are configurable. 42 Warsaw is the first deployment.

## Positioning

One laptop, one Docker command. The laptop's own webcam scans QR stickers stuck on the items, so no RFID reader, accounts, cloud service or internet connection is needed, and all data stays on the device.

## Operating Context

- A single Windows laptop runs Docker Desktop; the app is used in a browser on that laptop at `http://localhost:4242`, with the built-in webcam.
- Traffic comes in bursts: groups of students leave or return together, so several scans arrive in quick succession.
- Scan-first flow: scanning a lent item returns it (with undo); scanning an available item asks for the borrower, picked from the roster.
- QR stickers are printed from the app and stuck on the cards: each QR is exactly 1.25 in × 1.25 in (31.75 mm, square), tiled on an A4 sheet at that true size. Values from the earlier tool (e.g. `carddesk:4242`) must keep working.
- The roster of students is prepared before the week (from photos of name tags) and imported into the app.

## Capabilities and Constraints

- Strict roster: only borrowers on the imported roster can borrow; anyone else is refused until added to the roster in settings.
- One item per borrower at a time.
- Loan history with filters and CSV export.
- Overdue highlighting (time out longer than a threshold, or still out at a closing time).
- Lost/damaged status takes an item out of service.
- Up to five volunteers can be on duty at once; the whole team on duty is recorded with each lend and return.
- Interface in English and Polish.
- Single machine only: bound to localhost, no login, no remote devices. Scanning from phones is out of scope.
- Student names, the roster and the database never leave the device: never committed, never in the public image, never in screenshots or test data.

## Brand Commitments

- Name: Item_Tracker. Public, MIT licensed, copyright Debadeep Chaudhury.
- Credit: Stanisław Zdanowski originated the idea with his larger card-lending desk for 42 Warsaw.
- The 42 Warsaw deployment uses the 42 Warsaw logo (bundled in the repo, marked as a 42 trademark outside the MIT license) and a theme inspired by https://42warsaw.pl/en/, more polished than the site.

## Evidence on Hand

- 42 Warsaw logo (white wordmark) from the 42warsaw.pl website.
- No real user data may appear anywhere in the repo; examples use invented names.

## Product Principles

1. Speed at the desk beats features: the common path is one scan, or one scan plus one pick.
2. The current state is always visible: every item shows free, out (to whom, since when), overdue or out of service.
3. Nothing personal leaves the laptop.
4. Generic core, local branding: anything specific to 42 Warsaw is configuration or branding, never hard-coded behavior.
5. Mistakes are cheap: undo a return, close a loan by hand, fall back to clicking an item when a sticker won't scan.

## Accessibility & Inclusion

Status must never rely on colour alone (free / out / overdue / out of service also differ by text or icon). Keyboard-operable for volunteers who prefer typing. Polish diacritics in names must render, sort and search correctly.
