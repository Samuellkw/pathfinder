# Plaza Singapura Landmark Navigator — Clean Data Pack (v3)

This is a cleaned, app-ready rebuild using the **full uploaded photo set**.

## What is complete now

- **38 mapped store nodes** in the clockwise order supplied by your team.
- **38 same-floor loop edges**: your route engine can already choose clockwise or counter-clockwise routes on B1, L1 and L2.
- **All 48 hallway/turn photos** copied, compressed to web-ready JPEGs, and linked to directional walkthrough sequences.
- **All usable store captures** copied into a predictable `public/assets/places/...` layout and attached to the relevant store node.
- Reference maps for B1, L1 and L2 are included.
- Your intended pilot boundaries are hard-coded so routing does not wander into unsupported areas.

## Important scope rules

- **B1:** only the photographed outer oval. The middle retail island is excluded.
- **L1:** only the lower loop from Bath & Body Works onwards. The northern/upward Taxi–Sephora–MRT extension is excluded.
- **L2:** only the selected photographed main ring.

## Use these files

| File | Purpose |
|---|---|
| `data/mall.json` | App-level capability flags |
| `data/places.json` | Store nodes, clockwise index, image references |
| `data/edges.json` | Same-floor loop graph |
| `data/floor_loops.json` | Ordered loop nodes per floor |
| `data/floor_scopes.json` | Allowed/excluded pilot zones |
| `data/route_sequences.json` | Eight CW + eight ACW visual steps per floor |
| `data/assets.json` | Every copied photo/map with its web path |
| `data/vertical_connectors.json` | Cross-floor schema; deliberately empty until verified |
| `data/qa_report.json` | Known data-quality notes |
| `docs/*.csv` | Small remaining annotation tasks |

## Current routing capability

**Works now:** Store-to-store navigation on the same floor.

**Not enabled yet:** B1 ↔ L1 ↔ L2 routing. Add real escalator/lift mappings to `vertical_connectors.json`; do not infer them from the general floor map.

## Three short annotation tasks remaining

1. `docs/photo_role_assignment.csv`  
   Mark the best photo for each store as `storefront_reference` or `outward_view_reference`. This is optional for routing, but improves visual localization and first-step instructions.

2. `docs/route_photo_binding.csv`  
   For each Hallway/Turn photo, state which store edge(s) it represents. This lets the UI show only the relevant route images rather than all eight in a floor-direction sequence.

3. `docs/vertical_connector_worksheet.csv`  
   Add each confirmed escalator/lift/stair link across floors. This unlocks B1 → L1 → L2 navigation.

The pack intentionally does not invent any missing connector or image-location relationship.


---

## v4 update — verified cross-floor connectors

Cross-floor navigation is now enabled with seven named connector groups (A–G) and eight directional escalator paths. 
Use `nodes.json` + `edges.json` as the canonical graph. `vertical_connectors.json` contains the human-facing landmark instructions.

The old blank vertical-connector worksheet has been removed because the connector topology is now filled in from the team's confirmed descriptions.
