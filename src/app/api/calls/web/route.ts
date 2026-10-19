import { NextResponse } from "next/server";
import { config, getAgents } from "@/lib/config";
import { createCall } from "@/lib/db";
import { createWebCall } from "@/lib/retell";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const agentId = String(body.agentId ?? "inbound").trim();
    const name = String(body.name ?? "").trim();
    const property = String(body.property ?? "").trim();

    const agent = getAgents().find((a) => a.id === agentId) ?? getAgents()[0];
    if (!agent) {
      return NextResponse.json(
        { error: "No agents configured. Set agent IDs in .env." },
        { status: 400 }
      );
    }

    const dynamicVars: Record<string, string> = {
      current_datetime: new Date().toISOString(),
      timezone: config.timezone,
    };
    if (name) dynamicVars.lead_name = name;
    if (property) dynamicVars.property_interested_in = property;

    const result = await createWebCall({ agentId: agent.retellAgentId, dynamicVars });

    createCall({
      retell_call_id: result.call_id,
      direction: "web",
      agent_id: agent.retellAgentId,
      status: (result as { call_status?: string }).call_status ?? "registered",
    });

    return NextResponse.json({
      accessToken: result.access_token,
      callId: result.call_id,
      agent: { id: agent.id, label: agent.label },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start web call.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
