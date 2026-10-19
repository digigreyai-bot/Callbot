import { NextResponse } from "next/server";
import { getAgents } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  // Only expose non-secret fields.
  const agents = getAgents().map((a) => ({
    id: a.id,
    label: a.label,
    direction: a.direction,
  }));
  return NextResponse.json({ agents });
}
