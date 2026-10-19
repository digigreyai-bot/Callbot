import OpenAI from "openai";
import { config } from "./config";

/** AI helpers for SMS reply classification — mirrors Make.com DeepSeek modules. */

function getClient(): { client: OpenAI; model: string } {
  if (config.extraction.provider === "deepseek" && config.extraction.deepseekApiKey) {
    return {
      client: new OpenAI({
        apiKey: config.extraction.deepseekApiKey,
        baseURL: config.extraction.deepseekBaseUrl,
      }),
      model: config.extraction.deepseekModel,
    };
  }
  if (!config.extraction.openaiApiKey) {
    throw new Error("No LLM API key configured for SMS decisions.");
  }
  return {
    client: new OpenAI({ apiKey: config.extraction.openaiApiKey }),
    model: config.extraction.openaiModel,
  };
}

async function chatJson(system: string, user: string): Promise<Record<string, unknown>> {
  const { client, model } = getClient();
  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Step 6 — DeepSeek Call Decision: yes (call now) vs no (busy/reschedule/stop). */
export async function classifySmsReply(
  replyText: string,
  nowIso: string
): Promise<{ decision: "yes" | "no" | "stop"; reason: string }> {
  const result = await chatJson(
    `You classify SMS replies from real-estate leads about whether they are ready for a phone call NOW.
Current time: ${nowIso} (${config.timezone}).

Return JSON: {"decision":"yes"|"no"|"stop","reason":"..."}
- "yes" = ready now, affirmative, "sure", "call me", "ok", "yes"
- "stop" = unsubscribe, hostile, "don't call", "remove me"
- "no" = busy, later, reschedule, noncommittal, or suggests a different time`,
    `Lead reply: "${replyText}"`
  );
  const d = String(result.decision ?? "no").toLowerCase();
  if (d === "yes") return { decision: "yes", reason: String(result.reason ?? "") };
  if (d === "stop") return { decision: "stop", reason: String(result.reason ?? "") };
  return { decision: "no", reason: String(result.reason ?? "") };
}

/** Step 9 — DeepSeek Time Analysis: did the lead suggest a callback time? */
export async function analyzeCallbackTime(
  replyText: string,
  nowIso: string
): Promise<{ hasTime: boolean; suggestedTime: string; notes: string }> {
  const result = await chatJson(
    `Extract whether the lead suggested a specific callback time in their SMS.
Current time: ${nowIso} (${config.timezone}).

Return JSON:
{"hasTime":true|false,"suggestedTime":"ISO 8601 or empty","notes":"brief explanation"}`,
    `Lead reply: "${replyText}"`
  );
  return {
    hasTime: Boolean(result.hasTime),
    suggestedTime: String(result.suggestedTime ?? ""),
    notes: String(result.notes ?? ""),
  };
}

/** Step 13 — DeepSeek Time Extractor: natural language → YYYY-MM-DD HH:MM */
export async function extractCallbackTime(
  replyText: string,
  nowIso: string
): Promise<string> {
  const result = await chatJson(
    `Convert the lead's natural-language time request into an ISO 8601 datetime in ${config.timezone}.
Current time: ${nowIso}.

Return JSON: {"datetime":"ISO 8601"}`,
    `Lead message: "${replyText}"`
  );
  return String(result.datetime ?? "");
}

/** Step 12 — Default scheduler: 3 minutes from now when no time given. */
export function defaultCallbackTime(now = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 1000).toISOString();
}

/** Step 18 — DeepSeek Time Normalizer for follow-up replies. */
export async function normalizeCallbackTime(
  replyText: string,
  nowIso: string
): Promise<string> {
  return extractCallbackTime(replyText, nowIso);
}

/** Calendar extraction from call transcript (Calendar_Summary blueprint). */
export async function extractCalendarFromTranscript(
  transcript: string,
  nowIso: string
): Promise<{ startDateTime: string; eventName: string; summary: string }> {
  const result = await chatJson(
    `Extract appointment details from a call transcript. Current time: ${nowIso} (${config.timezone}).
Return JSON:
{
  "Start_date_time": "ISO 8601 for Google Calendar",
  "name_of_appointment": "[Client Name] | [Property]",
  "summary": "Briefing for the agent: outcome + next steps"
}`,
    `Transcript:\n${transcript}`
  );
  return {
    startDateTime: String(result.Start_date_time ?? result.startDateTime ?? ""),
    eventName: String(result.name_of_appointment ?? result.eventName ?? "Appointment"),
    summary: String(result.summary ?? ""),
  };
}
