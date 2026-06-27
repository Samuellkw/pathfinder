# Optional Exa live context

The concierge currently plans from the team-curated `data/store_profiles.json` and the local route graph. That makes its routes deterministic and demo-safe.

Use Exa only for **fresh information** such as official Plaza Sing promotions, events or temporary tenant updates. Do not use Exa for indoor routing.

Before adding Exa, use the Exa Dashboard Onboarding flow to generate the current tested integration snippet for this exact Next.js project and add it as a server-only API route. Then pass its returned sources into the concierge response under a clearly labelled **Live context** section.
