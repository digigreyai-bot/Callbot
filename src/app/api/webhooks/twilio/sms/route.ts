import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function handleInbound(from: string, body: string) {
  const digits = from.replace(/\D/g, "").slice(-10);
  const rows = db()
    .prepare(
      `SELECT w.id FROM workflows w
       JOIN leads l ON l.id = w.lead_id
       WHERE w.status IN ('waiting_reply','waiting_delay','running')
         AND REPLACE(REPLACE(l.phone,'+',''),' ','') LIKE '%' || @phone
       ORDER BY w.id DESC LIMIT 1`
    )
    .all({ phone: digits }) as { id: number }[];

  if (rows[0]) {
    const { injectSmsReply } = await import("@/lib/workflows/engine");
    await injectSmsReply(rows[0].id, body);
  }
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let from = "";
  let body = "";

  if (ct.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    from = String(form.get("From") ?? "");
    body = String(form.get("Body") ?? "");
  } else {
    const json = await req.json().catch(() => ({}));
    from = String(json.From ?? json.from ?? "");
    body = String(json.Body ?? json.body ?? "");
  }

  if (from && body) await handleInbound(from, body);

  return new NextResponse("<Response></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}
