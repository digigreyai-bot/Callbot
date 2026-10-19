import { NextResponse } from "next/server";
import { config, getAgents } from "@/lib/config";
import { createCall, createLead } from "@/lib/db";
import { placePhoneCall } from "@/lib/retell";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const property = String(body.property ?? "").trim();
    const agentId = String(body.agentId ?? "outbound").trim();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    const agent = getAgents().find((a) => a.id === agentId) ?? getAgents()[0];
    if (!agent) {
      return NextResponse.json(
        { error: "No agents configured. Set RETELL_OUTBOUND_AGENT_ID in .env." },
        { status: 400 }
      );
    }

    const lead = createLead({ name, phone, property_interested_in: property || null });

    const dynamicVars: Record<string, string> = {
      lead_name: name,
      property_interested_in: property,
      Phone_Number: phone,
      current_datetime: new Date().toISOString(),
      timezone: config.timezone,
    };

    const result = await placePhoneCall({
      toNumber: phone,
      overrideAgentId: agent.retellAgentId,
      dynamicVars,
      metadata: { lead_id: String(lead.id) },
    });

    const call = createCall({
      retell_call_id: result.call_id,
      lead_id: lead.id,
      direction: "outbound",
      agent_id: agent.retellAgentId,
      status: (result as { call_status?: string }).call_status ?? "registered",
    });

    return NextResponse.json({ call, retell: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to place call.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
