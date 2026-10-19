"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

/**
 * Blueprint: Lead_Flow_BismillahRealty
 * Webhook → Retell CreatePhoneCall → poll → DeepSeek → Calendar → dashboard
 */
export default function DirectCallPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [property, setProperty] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Phone required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/webhooks/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_name: name,
          phone_number: phone,
          property_interested_in: property,
          time: time || new Date().toISOString(),
          mode: "direct_call",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(`/workflows/${data.workflowId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Direct Retell Call"
        subtitle="Blueprint: Lead_Flow_BismillahRealty — CRM/dashboard sends lead → immediate Retell call → calendar → dashboard. No SMS wait."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={start} className="card space-y-5 p-6">
          <div>
            <label className="label">Lead Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
          </div>
          <div>
            <label className="label">Property</label>
            <input className="input" value={property} onChange={(e) => setProperty(e.target.value)} />
          </div>
          <div>
            <label className="label">Time (for agent context)</label>
            <input className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="ISO or leave empty = now" />
          </div>
          {error && <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Starting call…" : "Trigger direct call"}
          </button>
        </form>

        <div className="card space-y-4 p-6 text-sm text-muted">
          <h3 className="font-semibold text-white">Webhook for CRM / Meta / Dashboard</h3>
          <p>POST the same payload to:</p>
          <code className="block rounded-xl border border-border bg-surface2 px-3 py-2 text-xs text-accent break-all">
            POST /api/webhooks/lead
          </code>
          <pre className="rounded-xl bg-surface2 p-3 text-xs overflow-x-auto">
{`{
  "lead_name": "Bilal",
  "phone_number": "+1...",
  "property_interested_in": "villa",
  "time": "2026-06-30T12:00:00Z",
  "mode": "direct_call"
}`}
          </pre>
          <p className="text-xs">
            Use <code className="text-white/80">mode: &quot;outbound_campaign&quot;</code> to start full SMS flow instead.
          </p>
        </div>
      </div>
    </div>
  );
}
