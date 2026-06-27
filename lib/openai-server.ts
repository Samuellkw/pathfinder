import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5.5";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey });
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

type StructuredResponseOptions = {
  schemaName: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string | unknown[];
  maxOutputTokens?: number;
};

export async function createStructuredResponse<T>({
  schemaName,
  schema,
  instructions,
  input,
  maxOutputTokens = 700
}: StructuredResponseOptions): Promise<T> {
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: getOpenAIModel(),
    instructions,
    input: input as never,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema
      }
    }
  });

  if (!response.output_text) {
    throw new Error("The model returned no text output.");
  }

  return JSON.parse(response.output_text) as T;
}
