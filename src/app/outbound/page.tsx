"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

interface AgentOption {
  id: string;
  label: string;
  direction: string;
}

export default function OutboundPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [property, setProperty] = useState("");
  const [agentId, setAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => {
        const list: AgentOption[] = d.agents ?? [];
        setAgents(list);
        const preferred = list.find((a) => a.direction === "outbound") ?? list[0];
        if (preferred) setAgentId(preferred.id);
      })
      .catch(() => setAgents([]));
  }, []);

  async function placeCall(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Please enter a phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/calls/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, property, agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place call.");
      router.push(`/calls/${data.call.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to place call.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Quick Outbound Call"
        subtitle="Dial immediately via Retell — no SMS wait. For the full SMS → yes/no → call flow, use Outbound Campaign."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={placeCall} className="card space-y-5 p-6">
          <div>
            <label className="label">Lead Name</label>
            <input
              className="input"
              placeholder="e.g. Bilal Ahmed"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Phone Number *</label>
            <input
              className="input"
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">Use full international format (E.164), e.g. +1…</p>
          </div>

          <div>
            <label className="label">Property Interested In</label>
            <input
              className="input"
              placeholder="e.g. 3-bed villa, Downtown"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Agent</label>
            <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.length === 0 && <option value="">No agents configured</option>}
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Dialing…" : "Call now"}
          </button>
        </form>

        <div className="card space-y-4 p-6">
          <h3 className="text-sm font-semibold text-white">How it works</h3>
          <ol className="space-y-3 text-sm text-muted">
            <Step n={1}>Retell dials the lead from your configured number.</Step>
            <Step n={2}>The agent qualifies the lead and books an appointment.</Step>
            <Step n={3}>After the call ends, the transcript and recording sync here.</Step>
            <Step n={4}>The LLM extracts the appointment time, contact info, and a summary.</Step>
          </ol>
          <div className="rounded-xl border border-border bg-surface2/60 p-4 text-xs text-muted">
            The dynamic variables <code className="text-white/80">lead_name</code>,{" "}
            <code className="text-white/80">property_interested_in</code>,{" "}
            <code className="text-white/80">Phone_Number</code>, and{" "}
            <code className="text-white/80">current_datetime</code> are passed to the agent — matching
            the original Make.com flow.
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
