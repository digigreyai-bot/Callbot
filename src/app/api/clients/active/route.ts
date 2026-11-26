import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "active_client_id";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clientId = String(body.clientId ?? "").trim();
    if (!clientId || !getClient(clientId)) {
      return NextResponse.json({ error: "Invalid client." }, { status: 400 });
    }
    const jar = await cookies();
    jar.set(COOKIE, clientId, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return NextResponse.json({ ok: true, activeId: clientId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to set active client.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
