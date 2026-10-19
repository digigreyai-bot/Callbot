import { NextResponse } from "next/server";
import { getCallById, getCallWithDetails } from "@/lib/db";
import { createCalendarFromCall } from "@/lib/sync";

export const runtime = "nodejs";

/** Blueprint: Call_pilot_Calendar_Summary Complete — GetCall → DeepSeek → Google Calendar */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const call = getCallById(Number(id));
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (call.status !== "ended") {
    return NextResponse.json({ error: "Call must be ended first." }, { status: 409 });
  }
  try {
    const result = await createCalendarFromCall(Number(id));
    return NextResponse.json({ ok: true, ...result, call: getCallWithDetails(Number(id)) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calendar creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
