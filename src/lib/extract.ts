import OpenAI from "openai";
import { config } from "./config";

/**
 * LLM extraction service.
 * Ports the OpenAI / DeepSeek system prompts from the Make.com blueprints
 * (2.Lead_Flow_call + Calendar_Summary) into a single structured extraction.
 * Provider is selectable via EXTRACTION_PROVIDER.
 */

export interface ExtractionResult {
  name: string;
  email: string;
  phone: string;
  appointmentTime: string; // ISO 8601 or ""
  propertyInterestedIn: string;
  summary: string;
}

function getOpenAIClient(): { client: OpenAI; model: string } {
  if (config.extraction.provider === "deepseek") {
    if (!config.extraction.deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY is not set. Add it to your .env file.");
    }
    return {
      client: new OpenAI({
        apiKey: config.extraction.deepseekApiKey,
        baseURL: config.extraction.deepseekBaseUrl,
      }),
      model: config.extraction.deepseekModel,
    };
  }
  if (!config.extraction.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your .env file.");
  }
  return {
    client: new OpenAI({ apiKey: config.extraction.openaiApiKey }),
    model: config.extraction.openaiModel,
  };
}

function buildSystemPrompt(nowIso: string): string {
  return `You extract structured contact and appointment information from a phone-call transcript between a real-estate agent and a caller, and write a short briefing summary.

Priorities:
- Prioritize information the USER (caller) provided over what the agent transcribed. If the user corrects the agent, use the user's final confirmed value.
- For phone numbers, include the country code (e.g. +1). Reconstruct digits spoken one-by-one.
- Email: correct obvious misspellings of common providers (gmail, outlook, yahoo) only when clearly intended.
- Appointment time: return a precise ISO 8601 timestamp. Resolve relative phrases ("tomorrow", "this weekend", "3 PM") against the current datetime ${nowIso} in the ${config.timezone} timezone. If no appointment was booked, use an empty string.
- Summary: 1-3 sentences written as a briefing for the human specialist — the outcome of the call and the exact next step.

If a field is not present in the transcript, its value MUST be an empty string.

Return ONLY a valid JSON object with EXACTLY these keys:
{
  "name": "",
  "email": "",
  "phone": "",
  "appointmentTime": "",
  "propertyInterestedIn": "",
  "summary": ""
}`;
}

export async function extractFromTranscript(
  transcript: string,
  opts?: { now?: Date }
): Promise<ExtractionResult> {
  const nowIso = (opts?.now ?? new Date()).toISOString();
  const { client, model } = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(nowIso) },
      { role: "user", content: `Transcript:\n${transcript || "(empty transcript)"}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return normalize(raw);
}

function normalize(raw: string): ExtractionResult {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to salvage a JSON object embedded in surrounding text.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = {};
      }
    }
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : v != null ? String(v) : "");
  return {
    name: str(parsed.name),
    email: str(parsed.email),
    phone: str(parsed.phone ?? parsed.phoneNumber),
    appointmentTime: str(parsed.appointmentTime ?? parsed.Start_date_time),
    propertyInterestedIn: str(parsed.propertyInterestedIn ?? parsed.property_interested_in),
    summary: str(parsed.summary),
  };
}
