"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { CallWithDetails } from "@/lib/types";

/**
 * Blueprint: 2.Lead_Flow_call + Inbound Call Copilot
 * Retell inbound agent webhook → call ended → OpenAI extract → dashboard POST
 */
export default function InboundPage() {
  const [calls, setCalls] = useState<CallWithDetails[]>([]);

  useEffect(() => {
    const load = () =>
      fetch("/api/calls?direction=inbound", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setCalls(d.calls ?? []));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <PageHeader
        title="Inbound Call Copilot"
        subtitle="Adrian answers inbound calls on Retell. When a call ends, transcript is extracted and sent to your dashboard — same as Make.com 2.Lead_Flow_call."
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Setup (one time)</h3>
          <ol className="space-y-3 text-sm text-muted">
            <li>1. In Retell dashboard, open your <strong className="text-white">Inbound agent</strong> (Asim Inbound).</li>
            <li>2. Webhook Settings → paste URL below.</li>
            <li>3. Agent collects <code className="text-accent">lead_name</code> + <code className="text-accent">contact_phone</code> during call.</li>
            <li>4. When call ends, this app extracts name, email, phone, appointment, summary.</li>
          </ol>
          <code className="block rounded-xl border border-border bg-surface2 px-4 py-2.5 text-xs text-accent break-all">
            {"<your-ngrok-url>"}/api/webhooks/retell
          </code>
          <p className="text-xs text-muted">
            Locally: calls still sync if you open a call and click Re-sync. Webhook needs ngrok for real inbound numbers.
          </p>
        </div>

        <div className="card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-white">Extracted JSON (Make.com format)</h3>
          <pre className="rounded-xl bg-surface2 p-4 text-xs text-muted overflow-x-auto">
{`{
  "name": "...",
  "email": "...",
  "phoneNumber": "+1...",
  "appointmentTime": "ISO 8601",
  "callDuration": "seconds",
  "summary": "..."
}`}
          </pre>
          <p className="text-xs text-muted">
            Set <code className="text-white/80">DASHBOARD_INBOUND_URL</code> in .env for the admin dashboard POST.
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Inbound Calls</h2>
        </div>
        {calls.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">
            No inbound calls yet. Point Retell webhook here or test via Web Call with inbound agent.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left">Lead</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Appointment</th>
                <th className="px-5 py-3 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-border/60 hover:bg-surface2/50">
                  <td className="px-5 py-3">
                    <Link href={`/calls/${c.id}`} className="font-medium text-white hover:text-primary">
                      {c.extraction?.name || c.lead?.name || "Caller"}
                    </Link>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3 text-muted">
                    {c.extraction?.appointment_time ? formatDateTime(c.extraction.appointment_time) : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{formatDuration(c.duration_sec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
