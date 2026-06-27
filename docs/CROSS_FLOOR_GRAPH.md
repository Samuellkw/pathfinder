# v4 cross-floor routing update

Cross-floor routing is now active.

## Directional connector model

The mall uses separate up/down escalators in several locations, so every escalator is a **directed edge**.

- **A** is modeled as two paths: B1 → L1 near Lenskart/ALDO–Ray-Ban, and L1 → B1 near G2000/Lenskart.
- **B** is B1 DBS → L1 Goldheart.
- **C** is L1 The Body Shop → B1 McDonald's/KFC.
- **D** is L1 ALDO → L2 Charles & Keith.
- **E** is L2 ANTA → L1 G2000.
- **F** is L1 Goldheart → L2 ASICS.
- **G** is L2 TYPO → L1 The Body Shop.

This deliberately means the route engine may select different escalators for an outward and return journey.

## Main files

- `data/nodes.json` — every routable place: 38 stores + directional connector endpoints.
- `data/edges.json` — canonical directed graph; use this for Dijkstra/A*.
- `data/vertical_connectors.json` — human-readable connector and instruction data.
- `data/test_routes.json` — cross-floor test routes and their resolved edge sequences.
- `docs/connector_reference.csv` — quick reference table for the team.

## Remaining optional polish

1. Add a photo at each connector endpoint B–G for more visual route steps.
2. Add measured seconds/distance to edges once you have time.
3. Complete `route_photo_binding.csv` so the app shows the exact relevant Hallway/Turn photo rather than the whole directional sequence.
4. Add map coordinates only if you want to draw animated routes on the floor-plan images.
