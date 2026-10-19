import { NextResponse } from "next/server";
import { createCall, getCallByRetellId } from "@/lib/db";
import { syncCallByRetellId } from "@/lib/sync";

export const runtime = "nodejs";

/**
 * Optional Retell webhook receiver.
 * Local-first apps usually rely on polling (GET /api/calls/:id?sync=1),
 * but if you expose this app via a tunnel (ngrok) or deploy it, point the
 * Retell agent webhook here. Handles call_started / call_ended / call_analyzed.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const event: string = body?.event ?? "";
    const call = body?.call ?? {};
    const callId: string | undefined = call?.call_id;

    if (!callId) {
      return NextResponse.json({ ok: true, ignored: "no call_id" });
    }

    // Make sure we have a local row even for inbound calls we didn't initiate.
    if (!getCallByRetellId(callId)) {
      createCall({
        retell_call_id: callId,
        direction: call?.direction === "inbound" ? "inbound" : "outbound",
        agent_id: call?.agent_id ?? null,
        status: call?.call_status ?? "registered",
      });
    }

    // On end/analysis, sync + extract (+ inbound calendar + dashboard).
    if (event === "call_ended" || event === "call_analyzed") {
      const direction = call?.direction === "inbound" ? "inbound" : "outbound";
      if (direction === "inbound") {
        const { processInboundCallEnded } = await import("@/lib/sync");
        await processInboundCallEnded(callId);
      } else {
        await syncCallByRetellId(callId);
      }
    } else {
      // call_started or others: light status touch via sync (best effort).
      await syncCallByRetellId(callId).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error.";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
