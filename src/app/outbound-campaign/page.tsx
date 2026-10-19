"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

/**
 * Full 19-step outbound campaign from user's Make.com description
 * + BismillahRealty post-call (Retell → calendar → dashboard)
 */
export default function OutboundCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [property, setProperty] = useState("");
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
        body: JSON.stringify({ type: "outbound_campaign", name, phone, property }),
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
        title="Outbound Campaign"
        subtitle="Full SMS → wait → yes/no AI decision → call or reschedule → calendar + dashboard."
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
            <label className="label">Property Interested In</label>
            <input className="input" value={property} onChange={(e) => setProperty(e.target.value)} placeholder="villa downtown" />
          </div>
          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Launching campaign…" : "Start Outbound Campaign"}
          </button>
          <p className="text-xs text-muted text-center">
            After launch, open the workflow page to simulate SMS replies or wait for real Twilio replies.
          </p>
        </form>

        <div className="card max-h-[600px] overflow-y-auto p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">All 19 steps (Make.com flow)</h3>
          <ol className="space-y-2.5 text-xs text-muted">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-2">
                <span className="w-5 flex-shrink-0 font-bold text-primary">{s.n}.</span>
                <span><strong className="text-white/90">{s.title}</strong> — {s.desc}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { n: 1, title: "New Lead Trigger", desc: "Lead received from form/CRM" },
  { n: 2, title: "Delay", desc: "Initial delay before outreach" },
  { n: 3, title: "Twilio SMS", desc: "Call will be placed in 5 minutes" },
  { n: 4, title: "Delay 5 min", desc: "Wait for lead to respond" },
  { n: 5, title: "Get Messages", desc: "Check if lead replied" },
  { n: 6, title: "DeepSeek Decision", desc: "Classify YES vs NO vs STOP" },
  { n: 7, title: "Router", desc: "Branch on decision" },
  { n: 8, title: "Create Call (YES)", desc: "Retell outbound phone call" },
  { n: 9, title: "Time Analysis (NO)", desc: "Did they suggest a callback time?" },
  { n: 10, title: "Router", desc: "Has time vs no time" },
  { n: 11, title: "Confirmation SMS", desc: "Acknowledge requested time" },
  { n: 12, title: "Default Scheduler", desc: "3 min from now if no time" },
  { n: 13, title: "Time Extractor", desc: "Natural language → datetime" },
  { n: 14, title: "Dashboard Update", desc: "Save callback to admin API" },
  { n: 15, title: "Follow-up SMS", desc: "When are you available?" },
  { n: 16, title: "Delay", desc: "Wait before reminder" },
  { n: 17, title: "Reminder SMS", desc: "Availability check" },
  { n: 18, title: "Time Normalizer", desc: "Standardize follow-up reply" },
  { n: 19, title: "Schedule Save", desc: "Store final callback + trigger call" },
];
