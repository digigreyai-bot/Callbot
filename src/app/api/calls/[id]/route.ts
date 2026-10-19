import { NextResponse } from "next/server";
import { getCallById, getCallWithDetails } from "@/lib/db";
import { syncCallByRetellId } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calls/:id?sync=1
 * Returns the call with details. When sync=1, first pulls the latest
 * state from Retell (and runs extraction if the call just ended).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const call = getCallById(numId);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const url = new URL(req.url);
  const shouldSync = url.searchParams.get("sync") === "1";

  if (shouldSync) {
    try {
      const synced = await syncCallByRetellId(call.retell_call_id);
      return NextResponse.json({ call: synced });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync failed.";
      // Still return the local copy so the UI can render something.
      return NextResponse.json({ call: getCallWithDetails(numId), syncError: message });
    }
  }

  return NextResponse.json({ call: getCallWithDetails(numId) });
}
