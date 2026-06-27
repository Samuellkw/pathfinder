# Plaza Sing Navigator

We are building a hackathon MVP for indoor landmark-guided navigation in Plaza Singapura.

## Scope
- Only B1, L1 and L2.
- B1: use only the outer oval route. Ignore the middle retail island.
- L1: use only the lower loop from The Body Shop / Bath & Body Works onwards. Ignore the upper Taxi / Sephora / MRT extension.
- L2: use only the selected mapped ring.

## Data
- `data/nodes.json`: stores + directional escalator endpoints.
- `data/edges.json`: canonical directed routing graph. Use this for Dijkstra.
- `data/places.json`: user-selectable store destinations and photo references.
- `data/vertical_connectors.json`: human-readable escalator instructions.
- `data/route_sequences.json`: hallway / turn photos in clockwise and anticlockwise order.
- `public/assets/`: store photos, route photos and floor maps.

## Required MVP
1. Mobile-first page.
2. Current location dropdown containing stores only.
3. Destination dropdown containing stores only.
4. Find Route button.
5. Dijkstra routing based on `data/edges.json`.
6. Show a numbered, understandable route with floor changes and escalator instructions.
7. Show relevant image cards where possible.

## Important routing rules
- Same-floor routes may travel clockwise or counter-clockwise.
- Escalator edges are directional. Do not invent reverse escalators.
- Never route through excluded floor areas.
- Do not edit source JSON data unless explicitly asked.
- No OpenAI API or vision features until basic route planning works.

Read PROJECT_CONTEXT.md and inspect the JSON files before writing code.
