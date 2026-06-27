import { NextResponse } from "next/server";
import { findStoreMatches, storeCatalogueForPrompt } from "@/lib/mall-runtime";
import { createStructuredResponse } from "@/lib/openai-server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const visionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidate_names", "confidence", "evidence"],
  properties: {
    candidate_names: {
      type: "array",
      maxItems: 3,
      items: { type: "string" }
    },
    confidence: { type: "number" },
    evidence: { type: "string" }
  }
};

type VisionResult = {
  candidate_names: string[];
  confidence: number;
  evidence: string;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      return NextResponse.json({ status: "error", message: "Upload a mall photo first." }, { status: 400 });
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json({ status: "error", message: "Upload a JPG, PNG, WEBP or other image file." }, { status: 400 });
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { status: "error", message: "Keep the photo below 5 MB for the demo." },
        { status: 400 }
      );
    }

    const prompt = String(formData.get("message") ?? "").trim();
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");

    const result = await createStructuredResponse<VisionResult>({
      schemaName: "plaza_visual_location",
      schema: visionSchema,
      instructions: [
        "You identify a likely location inside the Plaza Singapura B1–L2 pilot from a user photo.",
        "Read visible storefront signage, logos, unit numbers and distinctive contextual clues.",
        "Only nominate stores from the supplied catalogue. Do not invent a location.",
        "If the image does not contain enough evidence, return an empty candidate_names array and low confidence.",
        "This is landmark-assisted location confirmation, not GPS.",
        `Supported store catalogue: ${JSON.stringify(storeCatalogueForPrompt())}`
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt || "Identify the likely mapped store in this photo." },
            {
              type: "input_image",
              image_url: `data:${image.type};base64,${base64}`
            }
          ]
        }
      ],
      maxOutputTokens: 360
    });

    const candidates = result.candidate_names
      .flatMap((candidateName) => findStoreMatches(candidateName, 1))
      .filter((match, index, items) => items.findIndex((item) => item.store.id === match.store.id) === index)
      .slice(0, 3)
      .map((match) => ({
        id: match.store.id,
        name: match.store.name,
        floor: match.store.floor_display ?? match.store.floor_id,
        unit: match.store.unit ?? "",
        matchScore: match.score
      }));

    return NextResponse.json({
      status: "ready",
      candidates,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      evidence: result.evidence,
      needsConfirmation: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyse that image.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ status: "error", message }, { status });
  }
}
