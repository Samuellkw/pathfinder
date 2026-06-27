# Exa live mall context

The concierge can now ask Exa for current, official web context after it builds a deterministic local itinerary.

## Setup

Add this to `.env.local`:

```env
EXA_API_KEY=your_exa_api_key_here
```

Restart `npm run dev` after changing environment variables.

## What Exa does

- Searches only `plazasing.com` and `capitaland.com`.
- Looks for current official promotions, events and tenant updates relevant to the user's plan.
- Returns source links and concise excerpts in the concierge result.
- Uses a 10-minute server-side cache to avoid repeatedly spending requests on the same plan.

## What Exa does not do

- It does not calculate indoor directions.
- It does not decide whether an unmapped web result becomes a route stop.
- It does not claim that an offer is still valid; the interface tells the user to check the official source.

The deterministic local graph remains the navigation source of truth.
