---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: []
---

# Desk screen

Scope: the single screen of Item_Tracker (desk with History and Items side drawers). Mode: Operate.

Audience and job: volunteers at a campus desk lend and take back ~10 access cards to ~100 roster students, in bursts; only volunteers see the screen. Scan-first: lent item scanned → returned with undo; free item scanned → pick a roster student → lend.

Constraints: 42 Warsaw palette and Futura-style type are pinned by the brief (navy #121f3e ground, teal #00babc, amber #f9ab20, pink #ff3ea5, white; Jost as the open Futura stand-in); state never by colour alone; EN + PL; shadcn/ui controls.

Memorable moment: glancing at the map and seeing every card's holder at once, like spotting who sits where on the 42 cluster map.

## Direction contract

THESIS: The desk is a 42 cluster map: every item is a seat that shows who is on it. Refuses the category default of a KPI-tiles-plus-table inventory dashboard.

OWN-WORLD: Navy ground and header, white type, Jost throughout. Seat tiles on a strict grid: free seats are dashed outlines, occupied seats carry a teal edge, due-soon amber, overdue fill pink, out-of-service hatched and dimmed. 1px hairline dividers only, no cards in cards. Item number is the largest type on screen.

STORY: The volunteer sees at once which items are free and who holds the rest; scans an item; the matching seat lights and the side panel asks for a student or confirms the return; they press Enter and move to the next student.

FIRST VIEWPORT: Header (logo, desk title, volunteer on duty, History, Items). Legend counts row. Centre: seat grid, two rows of five at 1440 wide, ~300px tall seats. Right rail 400px: camera, scanned item, student combobox, primary Lend/Return button. Bottom strip: today's latest actions.

FORM: Cluster Map, position 1 on the ordered list (IMPECCABLE'S PICK; the roll assigned position 4, Piscine Lanes). seed:a8e3e3eeafc2e29f. Signature move: a scanned item's seat lights with a white outline and its state change animates in place; seats never reorder.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Layout of the History and Items drawers (inherit this world).
- Seat grid for item counts other than 10 (auto-fit columns).
