import { NextResponse } from "next/server";
import { buildConciergePlan, ConciergeConstraints } from "@/lib/concierge";
import { emptyLiveContext, getLiveMallContext } from "@/lib/exa-live-context";
import { createStructuredResponse } from "@/lib/openai-server";

export const runtime = "nodejs";

const conciergeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "duration_minutes",
    "budget_sgd",
    "party",
    "interests",
    "needs_shopping",
    "needs_meal",
    "needs_dessert",
    "start_query",
    "reply"
  ],
  properties: {
    duration_minutes: { type: "integer", minimum: 0, maximum: 600 },
    budget_sgd: { type: "integer", minimum: 0, maximum: 1000 },
    party: { type: "string" },
    interests: { type: "array", items: { type: "string" }, maxItems: 8 },
    needs_shopping: { type: "boolean" },
    needs_meal: { type: "boolean" },
    needs_dessert: { type: "boolean" },
    start_query: { type: "string" },
    reply: { type: "string" }
  }
};

type ConciergeIntent = ConciergeConstraints & { reply: string };
type ConciergeRequest = {
  message?: string;
  includeLiveContext?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConciergeRequest;
    const message = body.message?.trim();

    if (!message || message.length > 900) {
      return NextResponse.json(
        { status: "error", message: "Describe your mall plan in 1 to 900 characters." },
        { status: 400 }
      );
    }

    const intent = await createStructuredResponse<ConciergeIntent>({
      schemaName: "plaza_concierge_intent",
      schema: conciergeSchema,
      instructions: [
        "You extract preferences for a Plaza Singapura B1–L2 mall concierge pilot.",
        "Return only the requested JSON schema.",
        "Use 0 for an unknown budget or duration.",
        "Infer shopping, meal and dessert needs only when the user asks for them or clearly implies them.",
        "Use party = 'date' when the user mentions a girlfriend, boyfriend, partner, date or couple.",
        "Do not claim live promotions, opening hours, queues or availability."
      ].join("\n"),
      input: message,
      maxOutputTokens: 360
    });

    const itinerary = buildConciergePlan(intent);
    const liveContext = body.includeLiveContext === false
      ? emptyLiveContext("Live official promotions and events were not requested for this plan.")
      : await getLiveMallContext({
          request: message,
          stopNames: itinerary.stops.map((stop) => stop.name)
        });

    return NextResponse.json({
      status: "ready",
      message: intent.reply || "Here is a route-aware plan using the mapped pilot stores.",
      constraints: intent,
      itinerary,
      liveContext
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build that plan.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ status: "error", message }, { status });
  }
}
