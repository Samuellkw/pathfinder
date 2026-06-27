# pathfinder
## OpenAI route chatbot

1. Run `npm install openai`.
2. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.
3. Run `npm run dev`.

The chat endpoint parses a natural-language route request with OpenAI, then resolves store names and computes the route **locally** from `data/edges.json`. The model is not allowed to invent indoor directions.

## Vision-assisted landmark confirmation

The vision panel sends an uploaded storefront/corridor image to a server-side OpenAI endpoint. It returns up to three likely **mapped** stores and asks the user to confirm one before routing. It deliberately does not claim indoor GPS accuracy.

## Concierge

The concierge extracts the user's time, budget and interests with OpenAI, then chooses stops from `data/store_profiles.json`. Route legs are still generated locally from the directed graph, so the model cannot make up indoor directions. See `docs/EXA_NEXT_STEP.md` for the safe next step for optional fresh promotions/events.
