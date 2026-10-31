---
name: Item_Tracker
description: A lending desk drawn as a 42 cluster map; every item is a seat that shows who is on it.
colors:
  navy: "#121f3e"
  navy-deep: "#0c1630"
  seat: "#1a2a52"
  seat-hover: "#213462"
  popover: "#182850"
  line: "#2b3c66"
  mist: "#a9b8d6"
  white: "#ffffff"
  teal: "#00babc"
  amber: "#f9ab20"
  pink: "#ff3ea5"
typography:
  seat-number:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 26cqh, 4.5rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  title-lg:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  desk-title:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.12em"
  body:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
    fontFeature: "tnum"
  state-word:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
    letterSpacing: "0.14em"
  caption:
    fontFamily: "Jost Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: "4px"
  md: "6.4px"
  lg: "8px"
  xl: "11.2px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  seat-gap: "12px"
  md: "16px"
  rail: "20px"
  lg: "24px"
  strip: "28px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.navy}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.seat}"
  button-ghost:
    textColor: "{colors.mist}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  input:
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  seat-free:
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
    padding: "12px"
  seat-out:
    backgroundColor: "{colors.seat}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
    padding: "12px"
  seat-out-hover:
    backgroundColor: "{colors.seat-hover}"
  seat-due:
    backgroundColor: "{colors.seat}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
    padding: "12px"
  seat-overdue:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.navy}"
    rounded: "{rounded.xl}"
    padding: "12px"
  seat-out-of-service:
    backgroundColor: "{colors.seat}"
    textColor: "{colors.mist}"
    rounded: "{rounded.xl}"
    padding: "12px"
  rail:
    backgroundColor: "{colors.navy-deep}"
    padding: "{spacing.rail}"
    width: "clamp(18rem, 28vw, 26rem)"
  drawer:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
---

# Design System: Item_Tracker

## Overview

**Creative North Star: "The Cluster Map"**

The desk is drawn like the seat map of a 42 cluster: a navy room, a strict grid of seats, and every seat telling you at a glance whether it is free and who is sitting in it. Nothing in the main view is a dashboard tile or a table; the map is the interface. A volunteer scans an item, its seat lights in place, the rail on the right asks the one question that matters next, and Enter finishes the job.

The world is dark, flat and dense in a calm way. One family (Jost, the open Futura stand-in pinned by the 42 Warsaw brief) carries everything, numbers set tabular. Colour is a status language, not decoration: teal means out, amber means due soon, pink means overdue, and every one of those states is also said by an icon and by words. Depth comes from tonal steps of navy and 1px hairline dividers, never from stacked cards.

Motion is short, strong ease-out and always in place. Seats never reorder or remount; a change is shown by a ring that flashes on the seat that changed and by the corner icon cross-fading to its new state.

**Key Characteristics:**
- Navy ground, white type, one Jost family, tabular numbers everywhere.
- A fixed seat board: the item number is the largest type on screen.
- State is always colour + icon + text, never colour alone.
- Flat surfaces separated by 1px hairlines; the only filled accent tile is an overdue seat.
- In-place motion: ring flash, icon cross-fade, 0.96 press; no reordering.

## Colors

A pinned 42 Warsaw palette: a navy ramp for ground and surfaces, three saturated signal colours, and one cool grey-blue for secondary text.

### Primary
- **42 Teal** (teal): the "out" state (seat edge, status icon, legend), the primary Lend/Return button fill, focus outlines, selection and text caret, the camera framing guide and the "free" word on empty seats. It is the colour of action and of things in use.

### Secondary
- **Due Amber** (amber): due-soon only. Seat edge, due time text and icon, and the camera's "several codes in view" notice (navy text on amber).

### Tertiary
- **Overdue Pink** (pink): overdue only, and destructive actions (mark lost or damaged). An overdue seat is the one solid-filled tile on the board, with navy text and icon on it for contrast (about 5:1; white measured 3.2:1).

### Neutral
- **Cluster Navy** (navy): page ground, header, strip; text colour on teal, amber and pink fills.
- **Deep Navy** (navy-deep): recessed wells: the camera frame, the roster list, the rail at 40% and the drawer scrim at 60%, and the dark stripe of the out-of-service hatch.
- **Seat Navy** (seat): the body of an occupied seat and the light stripe of the hatch; muted/secondary surface.
- **Seat Hover** (seat-hover): hover on occupied seats; accent surface.
- **Drawer Navy** (popover): History and Items drawers, menus, dialogs.
- **Hairline** (line): every border and divider, dashed free-seat outlines, the out-of-service edge, scrollbar thumb.
- **Mist** (mist): secondary text: durations, timestamps, legend counts, hints, idle copy.
- **White** (white): primary text, the selected-seat outline and the flash ring.

### Named Rules
**The Status Is Spoken Three Ways Rule.** Every seat state is colour plus a fixed icon plus words (Free / since HH:MM / due HH:MM / Overdue / Lost or Damaged). Removing any one of the three is a regression.

**The Signals Are Reserved Rule.** Teal, amber and pink mean out, due soon and overdue. They do not appear as decoration, section accents or brand flourishes.

## Typography

**Display Font:** Jost Variable (with system-ui, sans-serif)
**Body Font:** Jost Variable (with system-ui, sans-serif)

**Character:** One geometric Futura-like family at every size; hierarchy comes from size and weight (400 to 700), not from a second face. The body sets `font-variant-numeric: tabular-nums` so clocks and durations do not jitter.

### Hierarchy
- **Seat number** (700, clamp(2.5rem, 26cqh, 4.5rem) of the seat's container height, line-height 1, -0.04em): the item label on each seat; the largest type on the screen.
- **Headline** (700, 2.25rem, line-height 1, -0.03em): the selected item's title at the top of the rail ("Card 7").
- **Title large** (600, 1.5rem to 1.875rem): rail idle title, borrower name in the loan view, empty-desk title.
- **Title** (600, 1.25rem): drawer titles.
- **Desk title** (600, 1.125rem, 0.12em, uppercase): the desk's name in the header. It is the page h1, not a label above another heading.
- **Body** (400, 1rem, line-height 1.5): rail copy, roster rows (max 34 to 48ch for paragraphs). Borrower name on a seat is 600 at 1rem, 1.125rem once the seat is at least 9rem wide, clamped to two lines.
- **Label** (500, 0.875rem): buttons, inputs, legend, activity strip, seat time line.
- **State word** (600, 0.875rem, 0.14em, uppercase, teal): the "Free" word on an empty seat; part of the state vocabulary.
- **Caption** (400, 0.75rem): camera status pill, "already holds" hints in the roster list.

### Named Rules
**The Number Is the Seat Rule.** The item number outranks everything else on the board, including names. No other text on the desk may approach its size.

## Layout

A full-height app shell (`100svh`): header 64px, then a two-column body, then a 56px activity strip. Nothing scrolls the page; regions scroll internally.

- **Body columns:** the map takes `1fr` with 24px padding and 16px gap between legend and board; the rail is `clamp(18rem, 28vw, 26rem)` with 20px padding and 20px gaps, separated by a 1px hairline and a 40% deep-navy tint. The direction asked for a 400px rail; the build's clamp lands at 403px at 1440 wide and narrows to 18rem on small laptops (1093x614 verified).
- **Seat board:** a fixed board that fills the remaining height with 12px gaps. Up to 10 items, columns = min(5, ceil(n / 2)) and rows = ceil(n / columns), so 10 items are two rows of five. 11 to 15 items are a 5x3 board. Beyond 15 the board switches to auto-fill columns (min 9.5rem) with rows of 9 to 12rem and scrolls vertically. Seats never reorder.
- **Seats are container-query components:** the number scales with the seat's own height (26cqh) and the name, time phrasing and icon inset step up once the seat is at least 9rem wide. Seat padding is 12px, 16px from 1280px viewport width.
- **Camera:** 16:9, capped at 24svh tall so the lend panel keeps room on short screens.
- **Legend row:** counts with 24px column gap; free and out always shown, other states only when non-zero.
- **Activity strip:** single line, 28px gaps, latest eight actions, faded out at the right edge with a mask rather than truncated mid-word.
- **Drawers:** right-side sheets, full width on phones; Items is max 36rem, History max 56rem. Header and filter bars are separated by hairlines; content pads 16px.
- **Print sheet (physical units):** A4, 10mm page margin, five columns of 31.75mm (1.25in) square QR codes including quiet zone, 6mm column and 4mm row gaps, 0.25mm dashed cutting guide drawn outside the square (outline, so it never shrinks the code), 3mm Jost 600 caption in a 5mm band, and a 50mm calibration ruler. Black on white; only the sheet prints.

## Elevation & Depth

Flat by default. Depth is tonal: navy-deep for recessed wells, navy for the ground, seat for occupied tiles, popover for overlays, all separated by 1px hairlines. The only shadow in use is the drawer's inherited soft shadow (Tailwind `shadow-lg`), which on navy reads as little more than a darker edge; overlays mostly separate through the 60% deep-navy scrim.

### Shadow Vocabulary
- **Drawer lift** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): side drawers only.

### Named Rules
**The No Cards In Cards Rule.** Regions are divided by 1px hairlines, not boxed. Seats are the only tiles, and nothing is nested inside them but text and one icon.

## Shapes

Gently rounded rectangles throughout, scaled from a 0.5rem base. Seats and the camera frame use the largest corner (11.2px); buttons, inputs, the roster list and the print preview use 8px; small chips and the camera notice 6.4px; the Enter key cap 4px; status pills and dots are fully round. The flash ring sits 4px outside a seat with its corner enlarged by the same 4px so the curves stay concentric.

Stroke is meaningful: 1px for structure, 2px for seat state edges (dashed for free, solid for out, due and overdue), 2px for the camera framing guide, 3px outline at 3px offset for selection (white) and keyboard focus (teal). The out-of-service seat is hatched at 135 degrees in 12px bands of seat and deep navy, with mist text, so it reads as disabled without losing its number.

## Components

### Seat
The map's only tile; a button that is the whole state of one item.
- **Free:** transparent, 2px dashed hairline edge, mist dashed-circle icon, teal "Free" state word. Hover fills seat navy at 60%.
- **Out:** seat navy fill, 2px teal edge, teal clock icon, borrower name and "duration · since HH:MM" in mist.
- **Due soon:** seat navy fill, 2px amber edge, amber alarm-clock icon, time line in amber reading "due HH:MM".
- **Overdue:** solid pink fill and edge, navy warning-triangle icon, navy name and "duration · Overdue". Hover brightens 5%.
- **Out of service:** hatched, hairline edge, mist ban icon and "Lost" or "Damaged".
- **Selected:** 3px white outline at 3px offset; keyboard focus uses the same outline in teal.
- **Press:** scale 0.96 (160ms ease-out), background and filter changes 200ms.
- **Status icon cross-fade:** all five state icons stay mounted in the 20px top-right slot; the active one is at full opacity and scale, the rest at opacity 0, scale 0.25 and 4px blur, transitioning over 300ms on `cubic-bezier(0.2, 0, 0, 1)`.

### Seat Ring Flash (signature move)
When a seat changes (scan, lend, return, undo, condition change), a 2px white ring 4px outside the seat plays once: opacity 0.9 to 0 and scale 1 to 1.06 over 300ms on `cubic-bezier(0.23, 1, 0.32, 1)`. It is run with the Web Animations API on a persistent element, cancelling any running flash, so the seat button never remounts and keyboard focus is kept. Only opacity and transform animate. Under reduced motion it plays as the opacity fade alone.

### Buttons
- **Shape:** 8px corners (6.4px at small sizes); heights 28, 32 and 36px.
- **Primary:** teal fill, navy text, 500 weight, leading icon; the rail's Lend and Return buttons are the large size and show an Enter key cap at the trailing edge when Enter will trigger them. Hover drops to 80% teal.
- **Outline:** navy fill with hairline border; header History and Items buttons, Cancel, Back in service. Hover fills seat navy.
- **Ghost:** no fill, mist text; secondary actions such as mark lost or damaged and closing the rail.
- **Destructive:** pink at 10 to 20% with pink text, only inside confirmation dialogs.
- **Press / Focus:** scale 0.96 on press (150ms ease-out), 3px teal focus ring at 50%.

### Inputs / Fields
- **Style:** transparent over navy (hairline at 30%), 1px hairline border, 8px corners, 32px tall, teal caret.
- **Focus:** border turns teal plus a 3px teal ring at 50%.
- **Roster combobox:** a deep-navy well with hairline border; nothing counts as picked until the volunteer types or uses the arrow keys, so the first row is not highlighted until then.

### Rail
The right column: camera, then the action panel. Idle shows a teal scan icon, a title and short mist copy. With an item selected it shows the headline, then either the lend form, the loan details (due state in amber or pink with its icon), or the out-of-service notice. The camera carries a framing square in teal at 80%, a round status pill (teal ready, amber starting, pink problem) and an amber notice when several codes are in view, which slides up 4px and fades in over 150ms.

### Navigation
A 64px header with hairline bottom border: logo, uppercase desk title, flexible space, the on-duty team as up to five removable name chips (max 8.5rem each, truncating) with an add button, then outline History and Items buttons, which fold to icon-only below 1280px so a full team fits. The drawers use segmented tabs; the active tab is a raised pill.

### Drawers
Right-side sheets on drawer navy over a 60% deep-navy scrim. They slide 40px and fade over 300ms on `cubic-bezier(0.32, 0.72, 0, 1)`; the scrim fades over 100ms.

### Motion and reduced motion
Curves: `--ease-out` cubic-bezier(0.23, 1, 0.32, 1) for UI responses and the ring flash; `--ease-in-out` cubic-bezier(0.77, 0, 0.175, 1) for on-screen movement; `--ease-drawer` cubic-bezier(0.32, 0.72, 0, 1) for sheets; `--ease-icon` cubic-bezier(0.2, 0, 0, 1) for the icon cross-fade. Durations sit between 150 and 300ms. Under `prefers-reduced-motion: reduce` fades and colour changes stay; drawer, dialog, menu and tooltip travel and zoom are zeroed, press scale is held at 1, and the ring flash plays without scaling.

## Do's and Don'ts

### Do:
- **Do** say every seat state with colour, its fixed icon and words.
- **Do** keep the item number the largest type on the screen (up to 4.5rem, 700, -0.04em).
- **Do** keep seats in a fixed order and animate changes in place: ring flash (300ms, opacity and transform only), icon cross-fade, 0.96 press.
- **Do** put navy text on any pink, amber or teal fill.
- **Do** divide regions with 1px hairlines and tonal navy steps.
- **Do** honour reduced motion by keeping fades and colour and dropping travel, zoom and press scale.
- **Do** set print artwork in millimetres; a code is 31.75mm square, cut guides sit outside it.

### Don't:
- **Don't** use teal, amber or pink for anything but out, due soon and overdue (teal also marks the primary action and focus).
- **Don't** nest cards inside regions or anything boxed inside a seat.
- **Don't** reorder, re-sort or remount seats to show a change.
- **Don't** put white text on overdue pink; it measured 3.2:1.
- **Don't** introduce a second typeface.
