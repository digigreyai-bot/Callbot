import { NextResponse } from "next/server";
import { startDirectRetellCall, startOutboundCampaign, startWorkflowProcessor } from "@/lib/workflows/engine";

export const runtime = "nodejs";

/**
 * Blueprint: Lead_Flow_BismillahRealty webhook trigger
 * Body: { phone_number, lead_name, property_interested_in, time, mode? }
 * mode: "direct_call" (default) | "outbound_campaign"
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body.phone_number ?? body.phone ?? "").trim();
    const name = String(body.lead_name ?? body.name ?? "").trim();
    const property = String(body.property_interested_in ?? body.property ?? "").trim();
    const time = String(body.time ?? new Date().toISOString()).trim();
    const mode = String(body.mode ?? "direct_call").trim();

    if (!phone) return NextResponse.json({ error: "phone_number required" }, { status: 400 });

    startWorkflowProcessor();
    const wf =
      mode === "outbound_campaign"
        ? await startOutboundCampaign({ name, phone, property })
        : await startDirectRetellCall({ name, phone, property, time });

    return NextResponse.json({ ok: true, workflowId: wf.id, type: wf.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
