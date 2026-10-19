import { NextResponse } from "next/server";
import { dashboardStats, listCalls } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const direction = url.searchParams.get("direction");
  const calls = listCalls(200).filter((c) => !direction || c.direction === direction);
  const stats = dashboardStats();
  return NextResponse.json({ calls, stats });
}
