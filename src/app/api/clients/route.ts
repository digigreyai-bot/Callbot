import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteClient, getClient, listClients, setDefaultClient, upsertClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "active_client_id";

export async function GET() {
  const clients = listClients().map((c) => ({
    ...c,
    dashboard_api_key: c.dashboard_api_key ? maskKey(c.dashboard_api_key) : null,
    has_api_key: Boolean(c.dashboard_api_key),
  }));
  const jar = await cookies();
  const activeId = jar.get(COOKIE)?.value || clients.find((c) => c.is_default)?.id || clients[0]?.id || "";
  return NextResponse.json({ clients, activeId });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const dashboard_client_id = String(body.dashboard_client_id ?? "").trim();
    if (!name || !dashboard_client_id) {
      return NextResponse.json(
        { error: "name and dashboard_client_id are required." },
        { status: 400 }
      );
    }
    const client = upsertClient({
      name,
      dashboard_client_id,
      dashboard_api_key: body.dashboard_api_key != null ? String(body.dashboard_api_key) : null,
      calendar_id: body.calendar_id != null ? String(body.calendar_id) : null,
      is_default: Boolean(body.is_default),
    });
    return NextResponse.json({
      client: { ...client, dashboard_api_key: client.dashboard_api_key ? maskKey(client.dashboard_api_key) : null },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save client.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    if (!id || !getClient(id)) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (body.set_default) {
      const client = setDefaultClient(id);
      return NextResponse.json({ client });
    }
    const name = String(body.name ?? "").trim();
    const dashboard_client_id = String(body.dashboard_client_id ?? "").trim();
    if (!name || !dashboard_client_id) {
      return NextResponse.json(
        { error: "name and dashboard_client_id are required." },
        { status: 400 }
      );
    }
    const client = upsertClient({
      id,
      name,
      dashboard_client_id,
      dashboard_api_key:
        body.dashboard_api_key != null && String(body.dashboard_api_key).trim() !== ""
          ? String(body.dashboard_api_key)
          : undefined,
      calendar_id: body.calendar_id != null ? String(body.calendar_id) : null,
      is_default: Boolean(body.is_default),
    });
    return NextResponse.json({
      client: { ...client, dashboard_api_key: client.dashboard_api_key ? maskKey(client.dashboard_api_key) : null },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update client.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const ok = deleteClient(id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function maskKey(key: string) {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
