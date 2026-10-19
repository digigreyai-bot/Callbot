import { NextResponse } from "next/server";
import { getCallById, getCallWithDetails } from "@/lib/db";
import { runExtraction, syncCallByRetellId } from "@/lib/sync";

export const runtime = "nodejs";

/**
 * POST /api/calls/:id/extract
 * Force a (re-)sync and re-run LLM extraction for a call.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const call = getCallById(numId);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  try {
    // Pull the latest transcript first, then force a fresh extraction.
    await syncCallByRetellId(call.retell_call_id, { forceExtract: true });
    const refreshed = getCallById(numId)!;
    if (!refreshed.transcript) {
      return NextResponse.json(
        { error: "No transcript available yet for this call.", call: getCallWithDetails(numId) },
        { status: 409 }
      );
    }
    await runExtraction(numId, refreshed.transcript);
    return NextResponse.json({ call: getCallWithDetails(numId) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
