import { NextResponse } from "next/server";
import { injectSmsReply } from "@/lib/workflows/engine";

export const runtime = "nodejs";

/** Simulate an inbound SMS reply when Twilio webhook isn't configured. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const reply = String(body.reply ?? "").trim();
    if (!reply) return NextResponse.json({ error: "Reply text required." }, { status: 400 });
    await injectSmsReply(Number(id), reply);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
