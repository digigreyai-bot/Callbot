import { NextResponse } from "next/server";
import { getWorkflow, listSmsForWorkflow, updateSmsStatus } from "@/lib/db";
import { getMessageStatus, isTwilioConfigured, mapTwilioStatus } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const wfId = Number(id);
  const wf = getWorkflow(wfId);
  if (!wf) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!isTwilioConfigured()) {
    return NextResponse.json({ workflow: wf, updated: 0, note: "Twilio not configured" });
  }

  const messages = listSmsForWorkflow(wfId);
  let updated = 0;
  for (const m of messages) {
    if (!m.twilio_sid || m.direction !== "outbound") continue;
    if (m.status === "delivered" || m.status === "failed" || m.status === "undelivered") continue;
    try {
      const remote = await getMessageStatus(m.twilio_sid);
      updateSmsStatus(m.id, {
        status: mapTwilioStatus(remote.status),
        from_number: remote.from,
        to_number: remote.to,
        error_message: remote.errorMessage
          ? `${remote.errorCode ?? ""} ${remote.errorMessage}`.trim()
          : null,
      });
      updated += 1;
    } catch (err) {
      console.error("[sms-refresh]", m.twilio_sid, err);
    }
  }

  const refreshed = getWorkflow(wfId);
  return NextResponse.json({ workflow: refreshed, updated });
}
