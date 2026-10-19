"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { WorkflowStatusBadge } from "@/components/WorkflowTimeline";
import type { WorkflowWithDetails } from "@/lib/types";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/workflows", { cache: "no-store" });
    const data = await res.json();
    setWorkflows(data.workflows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <PageHeader
        title="Workflows"
        subtitle="All automated flows — SMS nurture, outbound campaigns, call + calendar + dashboard."
        action={
          <div className="flex gap-2">
            <Link href="/lead-flow" className="btn-ghost">
              + Lead Flow SMS
            </Link>
            <Link href="/outbound-campaign" className="btn-primary">
              + Outbound Campaign
            </Link>
          </div>
        }
      />

      <div className="card overflow-hidden">
        {loading && workflows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Loading…</p>
        ) : workflows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-muted">No workflows yet. Start a Lead Flow or Outbound Campaign.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-3">Lead</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Current Step</th>
                <th className="px-5 py-3">Steps</th>
                <th className="px-5 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.id} className="border-b border-border/60 hover:bg-surface2/50">
                  <td className="px-5 py-3.5">
                    <Link href={`/workflows/${w.id}`} className="font-medium text-white hover:text-primary">
                      {w.lead.name || "—"}
                    </Link>
                    <p className="text-xs text-muted">{w.lead.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted">
                    {w.type === "lead_flow_sms"
                      ? "Lead Flow SMS"
                      : w.type === "direct_retell_call"
                        ? "Direct Retell Call"
                        : "Outbound Campaign"}
                  </td>
                  <td className="px-5 py-3.5">
                    <WorkflowStatusBadge status={w.status} />
                  </td>
                  <td className="px-5 py-3.5 text-muted">{w.current_step ?? "—"}</td>
                  <td className="px-5 py-3.5 text-muted">{w.steps.length}</td>
                  <td className="px-5 py-3.5 text-muted">{w.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
