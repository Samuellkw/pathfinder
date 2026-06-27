export type LiveContextItem = {
  title: string;
  summary: string;
  url: string;
  source: string;
};

export type LiveMallContext = {
  status: "ready" | "empty" | "unavailable" | "skipped";
  message: string;
  items: LiveContextItem[];
};

type ExaSearchResult = {
  title?: string;
  url?: string;
  highlights?: string[];
};

type ExaSearchResponse = {
  results?: ExaSearchResult[];
  error?: string;
};

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const OFFICIAL_DOMAINS = ["plazasing.com", "capitaland.com"];
const CACHE_TTL_MS = 10 * 60 * 1000;

const liveContextCache = new Map<string, { expiresAt: number; value: LiveMallContext }>();

export function emptyLiveContext(message: string): LiveMallContext {
  return {
    status: "skipped",
    message,
    items: []
  };
}

function isOfficialSource(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function sourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Official mall source";
  }
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 320);
}

function buildQuery(request: string, stopNames: string[]) {
  const cleanRequest = compactText(request).slice(0, 450);
  const stops = stopNames.length > 0 ? `Mapped itinerary stops: ${stopNames.join(", ")}.` : "";

  return [
    "Current Plaza Singapura Singapore official promotions, events, tenant updates, and mall activities.",
    stops,
    cleanRequest ? `Visitor request: ${cleanRequest}` : "",
    "Use official Plaza Singapura or CapitaLand pages only."
  ]
    .filter(Boolean)
    .join(" ");
}

export async function getLiveMallContext(input: {
  request: string;
  stopNames: string[];
}): Promise<LiveMallContext> {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    return {
      status: "unavailable",
      message: "Live official promotions and events are unavailable until EXA_API_KEY is configured.",
      items: []
    };
  }

  const query = buildQuery(input.request, input.stopNames);
  const cacheKey = query.toLowerCase();
  const cached = liveContextCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const response = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 5,
        includeDomains: OFFICIAL_DOMAINS,
        contents: {
          highlights: true
        }
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Exa request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as ExaSearchResponse;
    const items = (payload.results ?? [])
      .filter((result): result is ExaSearchResult & { title: string; url: string } =>
        Boolean(result.title && result.url && isOfficialSource(result.url))
      )
      .map((result) => ({
        title: compactText(result.title),
        summary: compactText(result.highlights?.[0] ?? "Open the official source for details."),
        url: result.url,
        source: sourceLabel(result.url)
      }))
      .slice(0, 3);

    const value: LiveMallContext = items.length > 0
      ? {
          status: "ready",
          message:
            "Live official web context from Exa. Check the source before relying on an offer or event.",
          items
        }
      : {
          status: "empty",
          message: "Exa found no matching official live context for this plan right now.",
          items: []
        };

    liveContextCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value
    });

    return value;
  } catch (error) {
    console.error("Exa live context failed:", error);
    return {
      status: "unavailable",
      message: "Live official context is temporarily unavailable. Your local route plan still works.",
      items: []
    };
  }
}
