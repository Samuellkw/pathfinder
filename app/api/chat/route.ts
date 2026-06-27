import { NextResponse } from "next/server";
import {
  buildRouteForStores,
  getStoreById,
  resolveStore,
  storeCatalogueForPrompt
} from "@/lib/mall-runtime";
import { createStructuredResponse } from "@/lib/openai-server";

export const runtime = "nodejs";

const navigationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "start_query", "destination_query", "reply"],
  properties: {
    intent: {
      type: "string",
      enum: ["navigation", "clarification", "unsupported"]
    },
    start_query: { type: "string" },
    destination_query: { type: "string" },
    reply: { type: "string" }
  }
};

type NavigationIntent = {
  intent: "navigation" | "clarification" | "unsupported";
  start_query: string;
  destination_query: string;
  reply: string;
};

type ChatRequest = {
  message?: string;
  startOverrideId?: string;
  destinationOverrideId?: string;
};

function formatMatches(query: string, matches: ReturnType<typeof resolveStore>["matches"]) {
  const options = matches
    .map((match) => `${match.store.name} (${match.store.floor_display ?? match.store.floor_id})`)
    .join(", ");

  return options
    ? `I could not confidently match “${query}”. Did you mean ${options}?`
    : `I could not find “${query}” in the mapped B1–L2 pilot zone.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim();

    if (!message || message.length > 700) {
      return NextResponse.json(
        { status: "error", message: "Send a route question between 1 and 700 characters." },
        { status: 400 }
      );
    }

    const startOverride = getStoreById(body.startOverrideId);
    const destinationOverride = getStoreById(body.destinationOverrideId);

    if (body.startOverrideId && !startOverride) {
      return NextResponse.json({ status: "error", message: "Unknown start override." }, { status: 400 });
    }

    if (body.destinationOverrideId && !destinationOverride) {
      return NextResponse.json(
        { status: "error", message: "Unknown destination override." },
        { status: 400 }
      );
    }

    const intent = await createStructuredResponse<NavigationIntent>({
      schemaName: "plaza_navigation_intent",
      schema: navigationSchema,
      instructions: [
        "You extract indoor navigation intent for a Plaza Singapura B1–L2 pilot.",
        "Return only the requested JSON schema.",
        "Identify a start location and destination from the user message.",
        "When the user says ‘here’, use the known current location if provided.",
        "When the user says ‘this place’, use the known destination if provided.",
        "Do not invent stores outside the supplied catalogue.",
        "If one location is missing, use intent clarification and leave that field empty.",
        `Known current location: ${startOverride?.name ?? "none"}.`,
        `Known destination: ${destinationOverride?.name ?? "none"}.`,
        `Supported store catalogue: ${JSON.stringify(storeCatalogueForPrompt())}`
      ].join("\n"),
      input: message,
      maxOutputTokens: 320
    });

    const startResolution = startOverride
      ? { store: startOverride, matches: [] }
      : resolveStore(intent.start_query);
    const destinationResolution = destinationOverride
      ? { store: destinationOverride, matches: [] }
      : resolveStore(intent.destination_query);

    if (!startResolution.store || !destinationResolution.store) {
      const parts = [];
      if (!startResolution.store) {
        parts.push(formatMatches(intent.start_query || "your current location", startResolution.matches));
      }
      if (!destinationResolution.store) {
        parts.push(
          formatMatches(intent.destination_query || "your destination", destinationResolution.matches)
        );
      }

      return NextResponse.json({
        status: "needs_clarification",
        message: parts.join(" "),
        startCandidates: startResolution.matches.map((match) => match.store),
        destinationCandidates: destinationResolution.matches.map((match) => match.store)
      });
    }

    const navigation = buildRouteForStores(
      startResolution.store.id,
      destinationResolution.store.id
    );

    if (!navigation) {
      return NextResponse.json({
        status: "error",
        message: "No route was found in the current directed graph."
      });
    }

    return NextResponse.json({
      status: "ready",
      message:
        intent.reply ||
        `I found a route from ${startResolution.store.name} to ${destinationResolution.store.name}.`,
      start: startResolution.store,
      destination: destinationResolution.store,
      ...navigation
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to plan that route.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;

    return NextResponse.json({ status: "error", message }, { status });
  }
}
