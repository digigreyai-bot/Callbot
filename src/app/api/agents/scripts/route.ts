import { NextResponse } from "next/server";
import { getAgents } from "@/lib/config";
import { applyScriptEdits, loadAgentScript, type AgentScriptDetails } from "@/lib/retell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CacheEntry = { at: number; scripts: AgentScriptDetails[] };
const globalCache = globalThis as unknown as { __agentScriptsCache?: CacheEntry };
const TTL_MS = 60_000;

function clearScriptsCache() {
  globalCache.__agentScriptsCache = undefined;
}

export async function GET() {
  const now = Date.now();
  if (globalCache.__agentScriptsCache && now - globalCache.__agentScriptsCache.at < TTL_MS) {
    return NextResponse.json({
      scripts: globalCache.__agentScriptsCache.scripts,
      cached: true,
    });
  }

  const agents = getAgents();
  const scripts = await Promise.all(
    agents.map((a) => loadAgentScript(a.retellAgentId, a.direction, a.label))
  );

  globalCache.__agentScriptsCache = { at: now, scripts };
  return NextResponse.json({ scripts, cached: false });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const agentId = String(body.agentId ?? "").trim();
    const generalPrompt = String(body.generalPrompt ?? "");
    const hasBegin = Object.prototype.hasOwnProperty.call(body, "beginMessage");
    const beginMessage = hasBegin
      ? body.beginMessage == null
        ? null
        : String(body.beginMessage)
      : undefined;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required." }, { status: 400 });
    }
    if (!generalPrompt.trim()) {
      return NextResponse.json({ error: "generalPrompt is required." }, { status: 400 });
    }

    const allowed = getAgents().map((a) => a.retellAgentId);
    if (!allowed.includes(agentId)) {
      return NextResponse.json(
        { error: "Agent is not configured in this app (.env inbound/outbound IDs only)." },
        { status: 403 }
      );
    }

    const result = await applyScriptEdits(agentId, generalPrompt, beginMessage);
    clearScriptsCache();

    const agents = getAgents();
    const scripts = await Promise.all(
      agents.map((a) => loadAgentScript(a.retellAgentId, a.direction, a.label))
    );
    globalCache.__agentScriptsCache = { at: Date.now(), scripts };

    return NextResponse.json({ ok: true, llmId: result.llmId, scripts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
