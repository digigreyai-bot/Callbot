import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runWorkflow, startWorkflowProcessor } from "@/lib/workflows/engine";

export const runtime = "nodejs";

/**
 * Blueprint: Telnyx Call — webhook + delay → trigger scheduled Retell call.
 * Finds workflows at scheduled_call step whose time has passed.
 */
export async function POST(req: Request) {
  startWorkflowProcessor();
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? body.from ?? "").replace(/\D/g, "").slice(-10);

  const rows = db()
    .prepare(
      `SELECT w.id FROM workflows w
       JOIN leads l ON l.id = w.lead_id
       WHERE w.current_step = 'scheduled_call'
         AND w.status = 'waiting_delay'
         AND REPLACE(REPLACE(l.phone,'+',''),' ','') LIKE '%' || @phone
       ORDER BY w.id DESC LIMIT 1`
    )
    .all({ phone: phone || "___" }) as { id: number }[];

  if (rows[0]) {
    await runWorkflow(rows[0].id);
    return NextResponse.json({ ok: true, triggered: rows[0].id });
  }

  return NextResponse.json({ ok: true, triggered: null, note: "No matching scheduled workflow" });
}
