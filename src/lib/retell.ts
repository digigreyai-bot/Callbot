import Retell from "retell-sdk";
import { config } from "./config";

/** Server-side Retell client wrappers. */

let client: Retell | null = null;

function getClient(): Retell {
  if (!config.retell.apiKey) {
    throw new Error("RETELL_API_KEY is not set. Add it to your .env file.");
  }
  if (!client) client = new Retell({ apiKey: config.retell.apiKey });
  return client;
}

export type DynamicVars = Record<string, string>;

export interface PlacePhoneCallInput {
  toNumber: string;
  overrideAgentId: string;
  dynamicVars?: DynamicVars;
  metadata?: Record<string, string>;
}

export async function placePhoneCall(input: PlacePhoneCallInput) {
  if (!config.retell.fromNumber) {
    throw new Error("RETELL_FROM_NUMBER is not set. Add it to your .env file.");
  }
  const res = await getClient().call.createPhoneCall({
    from_number: config.retell.fromNumber,
    to_number: input.toNumber,
    override_agent_id: input.overrideAgentId,
    retell_llm_dynamic_variables: input.dynamicVars,
    metadata: input.metadata,
  });
  return res; // includes call_id
}

export interface CreateWebCallInput {
  agentId: string;
  dynamicVars?: DynamicVars;
  metadata?: Record<string, string>;
}

export async function createWebCall(input: CreateWebCallInput) {
  const res = await getClient().call.createWebCall({
    agent_id: input.agentId,
    retell_llm_dynamic_variables: input.dynamicVars,
    metadata: input.metadata,
  });
  return res; // { access_token, call_id, ... }
}

export interface NormalizedCall {
  callId: string;
  status: string;
  transcript: string | null;
  recordingUrl: string | null;
  durationSec: number | null;
  agentId: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
}

export async function getCall(callId: string): Promise<NormalizedCall> {
  const c = (await getClient().call.retrieve(callId)) as unknown as Record<string, unknown>;
  const durationMs = typeof c.duration_ms === "number" ? (c.duration_ms as number) : null;
  return {
    callId: (c.call_id as string) ?? callId,
    status: (c.call_status as string) ?? "registered",
    transcript: (c.transcript as string) ?? null,
    recordingUrl: (c.recording_url as string) ?? null,
    durationSec: durationMs != null ? Math.round(durationMs / 1000) : null,
    agentId: (c.agent_id as string) ?? null,
    fromNumber: (c.from_number as string) ?? null,
    toNumber: (c.to_number as string) ?? null,
  };
}

export interface AgentScriptDetails {
  agentId: string;
  direction: "inbound" | "outbound";
  label: string;
  agentName: string | null;
  voiceId: string | null;
  language: string | null;
  isPublished: boolean | null;
  llmId: string | null;
  generalPrompt: string | null;
  beginMessage: string | null;
  toolNames: string[];
  dynamicVars: string[];
  error?: string;
}

export async function getAgentRaw(agentId: string): Promise<Record<string, unknown>> {
  const agent = (await getClient().agent.retrieve(agentId)) as unknown as Record<string, unknown>;
  return agent;
}

export async function getRetellLlmRaw(llmId: string): Promise<Record<string, unknown>> {
  const llm = (await getClient().llm.retrieve(llmId)) as unknown as Record<string, unknown>;
  return llm;
}

const EXPECTED_VARS = [
  "lead_name",
  "property_interested_in",
  "current_datetime",
  "timezone",
  "Phone_Number",
  "company_name",
  "agent_name",
];

export async function loadAgentScript(
  agentId: string,
  direction: "inbound" | "outbound",
  label: string
): Promise<AgentScriptDetails> {
  try {
    const agent = await getAgentRaw(agentId);
    const engine = agent.response_engine as { type?: string; llm_id?: string } | undefined;
    const llmId = engine?.llm_id ?? null;
    let generalPrompt: string | null = null;
    let beginMessage: string | null = null;
    let toolNames: string[] = [];
    if (llmId) {
      const llm = await getRetellLlmRaw(llmId);
      generalPrompt = typeof llm.general_prompt === "string" ? llm.general_prompt : null;
      beginMessage = typeof llm.begin_message === "string" ? llm.begin_message : null;
      const tools = Array.isArray(llm.general_tools) ? llm.general_tools : [];
      toolNames = tools
        .map((t) => (t && typeof t === "object" && "name" in t ? String((t as { name: string }).name) : ""))
        .filter(Boolean);
    }
    const prompt = generalPrompt ?? "";
    const dynamicVars = EXPECTED_VARS.filter((v) => prompt.includes(`{{${v}}}`));
    return {
      agentId,
      direction,
      label,
      agentName: typeof agent.agent_name === "string" ? agent.agent_name : null,
      voiceId: typeof agent.voice_id === "string" ? agent.voice_id : null,
      language: typeof agent.language === "string" ? agent.language : null,
      isPublished: typeof agent.is_published === "boolean" ? agent.is_published : null,
      llmId,
      generalPrompt,
      beginMessage,
      toolNames,
      dynamicVars,
    };
  } catch (err: unknown) {
    return {
      agentId,
      direction,
      label,
      agentName: null,
      voiceId: null,
      language: null,
      isPublished: null,
      llmId: null,
      generalPrompt: null,
      beginMessage: null,
      toolNames: [],
      dynamicVars: [],
      error: err instanceof Error ? err.message : "Failed to load agent",
    };
  }
}

export async function updateRetellLlmPrompt(
  llmId: string,
  input: { general_prompt?: string; begin_message?: string | null }
) {
  const body: { general_prompt?: string; begin_message?: string | null } = {};
  if (typeof input.general_prompt === "string") body.general_prompt = input.general_prompt;
  if (input.begin_message !== undefined) body.begin_message = input.begin_message;
  return getClient().llm.update(llmId, body);
}

export async function applyScriptEdits(
  agentId: string,
  promptText: string,
  beginMessage?: string | null
): Promise<{ llmId: string }> {
  const agent = await getAgentRaw(agentId);
  const engine = agent.response_engine as { type?: string; llm_id?: string } | undefined;
  const llmId = engine?.llm_id;
  if (!llmId) throw new Error("Agent has no Retell LLM response engine.");
  await updateRetellLlmPrompt(llmId, {
    general_prompt: promptText,
    ...(beginMessage !== undefined ? { begin_message: beginMessage } : {}),
  });
  return { llmId };
}
