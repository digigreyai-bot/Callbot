"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

/**
 * Blueprint: 1. LEAD_FLOW_TALHA
 * Twilio SMS → wait 10s → follow-up SMS → POST lead to dashboard
 */
export default function LeadFlowPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [property, setProperty] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "lead_flow_sms", name, phone, property, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      router.push(`/workflows/${data.workflow.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Lead Flow SMS"
        subtitle="Blueprint: 1. LEAD_FLOW_TALHA — initial SMS, 10s wait, follow-up SMS, then POST lead to dashboard."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={start} className="card space-y-5 p-6">
          <div>
            <label className="label">Lead Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bilal" />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1…" />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Property</label>
            <input className="input" value={property} onChange={(e) => setProperty(e.target.value)} placeholder="ABC villa" />
          </div>
          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Starting…" : "Start Lead Flow"}
          </button>
        </form>

        <div className="card space-y-4 p-6">
          <h3 className="text-sm font-semibold text-white">Steps (from Make.com blueprint)</h3>
          <ol className="space-y-3 text-sm text-muted">
            <FlowStep n={1} title="Twilio SMS #1" desc="Hi {name}, thanks for reaching out about {property}… wrapping up, back in a couple minutes." />
            <FlowStep n={2} title="Delay 10 seconds" desc="util:FunctionSleep" />
            <FlowStep n={3} title="Twilio SMS #2" desc="When would be a good time for a quick call?" />
            <FlowStep n={4} title="HTTP POST" desc="Save lead to admin dashboard API" />
          </ol>
        </div>
      </div>
    </div>
  );
}

function FlowStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">{n}</span>
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-xs">{desc}</p>
      </div>
    </li>
  );
}
