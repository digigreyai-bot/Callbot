"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { directionLabel, formatDateTime, formatDuration } from "@/lib/format";
import type { CallWithDetails } from "@/lib/types";

interface Stats {
  totalCalls: number;
  endedCalls: number;
  booked: number;
  avgDurationSec: number;
  activeWorkflows?: number;
  smsSentToday?: number;
  smsFailedToday?: number;
}

export default function DashboardPage() {
  const [calls, setCalls] = useState<CallWithDetails[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all");

  async function load(dir?: string) {
    try {
      const q = dir && dir !== "all" ? `?direction=${dir}` : "";
      const res = await fetch(`/api/calls${q}`, { cache: "no-store" });
      const data = await res.json();
      setCalls(data.calls ?? []);
      setStats(data.stats ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter === "all" ? undefined : filter);
    const t = setInterval(() => load(filter === "all" ? undefined : filter), 5000);
    return () => clearInterval(t);
  }, [filter]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of your call activity and booked appointments."
        action={
          <div className="flex gap-2">
            <Link href="/outbound-campaign" className="btn-primary">
              + Campaign
            </Link>
            <Link href="/workflows" className="btn-ghost">
              Workflows
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total Calls" value={stats?.totalCalls ?? 0} />
        <StatCard label="Completed" value={stats?.endedCalls ?? 0} accent="success" />
        <StatCard label="Appointments" value={stats?.booked ?? 0} accent="primary" />
        <StatCard label="Active Flows" value={stats?.activeWorkflows ?? 0} accent="warn" />
        <StatCard label="Avg Duration" value={formatDuration(stats?.avgDurationSec)} />
        <StatCard label="SMS Sent Today" value={stats?.smsSentToday ?? 0} accent="primary" />
        <StatCard label="SMS Failed Today" value={stats?.smsFailedToday ?? 0} accent="danger" />
      </div>

      <div className="card mt-7 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Recent Calls</h2>
          <div className="flex gap-1">
            {(["all", "inbound", "outbound"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-xs capitalize ${
                  filter === f ? "bg-primary/20 text-white" : "text-muted hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading && calls.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Loading…</p>
        ) : calls.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-muted">No calls yet.</p>
            <Link href="/outbound" className="btn-primary mt-4">
              Place your first call
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">Direction</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Appointment</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-border/60 transition hover:bg-surface2/50"
                  >
                    <td className="px-5 py-3.5">
                      <Link href={`/calls/${c.id}`} className="block">
                        <p className="font-medium text-white group-hover:text-primary">
                          {c.lead?.name || c.extraction?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted">
                          {c.lead?.phone || c.extraction?.phone || c.retell_call_id.slice(0, 16)}
                        </p>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-muted">{directionLabel(c.direction)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {c.extraction?.appointment_time ? (
                        <span className="text-success">
                          {formatDateTime(c.extraction.appointment_time)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted">{formatDuration(c.duration_sec)}</td>
                    <td className="px-5 py-3.5 text-muted">{formatDateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "primary" | "success" | "warn" | "danger";
}) {
  const tone =
    accent === "primary"
      ? "text-primary"
      : accent === "success"
        ? "text-success"
        : accent === "warn"
          ? "text-warn"
          : accent === "danger"
            ? "text-danger"
            : "text-white";
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
