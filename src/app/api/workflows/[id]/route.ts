import { NextResponse } from "next/server";
import { getCallByRetellId, getWorkflow, getWorkflowContext } from "@/lib/db";
import { getCall } from "@/lib/retell";
import { processDueWorkflows, runWorkflow, startWorkflowProcessor } from "@/lib/workflows/engine";
import { syncCallByRetellId } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function withLinkedCall(wfId: number) {
  const wf = getWorkflow(wfId);
  if (!wf) return null;

  const ctx = getWorkflowContext(wfId);
  const retellCallId = typeof ctx.retellCallId === "string" ? ctx.retellCallId : null;
  if (!retellCallId) {
    return { ...wf, linked_call: null };
  }

  let linked = getCallByRetellId(retellCallId) ?? null;
  if (!linked || linked.status !== "ended") {
    try {
      const remote = await getCall(retellCallId);
      if (remote.status === "ended") {
        await syncCallByRetellId(retellCallId);
        linked = getCallByRetellId(retellCallId) ?? linked;
      } else if (linked) {
        // keep local row; status may lag — surface remote status via a shallow merge
        linked = { ...linked, status: remote.status, duration_sec: remote.durationSec };
      } else {
        linked = {
          id: 0,
          retell_call_id: retellCallId,
          lead_id: wf.lead_id,
          direction: "outbound",
          agent_id: remote.agentId,
          status: remote.status,
          transcript: remote.transcript,
          recording_url: remote.recordingUrl,
          duration_sec: remote.durationSec,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error("[linked-call]", err);
    }
  }

  return { ...wf, linked_call: linked };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  startWorkflowProcessor();
  await processDueWorkflows();
  const { id } = await ctx.params;
  const workflow = await withLinkedCall(Number(id));
  if (!workflow) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ workflow });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await runWorkflow(Number(id));
  const workflow = await withLinkedCall(Number(id));
  return NextResponse.json({ workflow });
}
