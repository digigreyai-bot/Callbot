import { NextResponse } from "next/server";
import { listWorkflows } from "@/lib/db";
import { startLeadFlowSms, startOutboundCampaign, startWorkflowProcessor } from "@/lib/workflows/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  startWorkflowProcessor();
  const workflows = listWorkflows(100);
  return NextResponse.json({ workflows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const type = String(body.type ?? "outbound_campaign");
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const property = String(body.property ?? "").trim();
    const email = String(body.email ?? "").trim() || undefined;

    if (!phone) return NextResponse.json({ error: "Phone is required." }, { status: 400 });

    startWorkflowProcessor();
    const wf =
      type === "lead_flow_sms"
        ? await startLeadFlowSms({ name, phone, property, email })
        : await startOutboundCampaign({ name, phone, property, email });

    return NextResponse.json({ workflow: wf });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start workflow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
