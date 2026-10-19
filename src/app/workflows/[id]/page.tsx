"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import WorkflowTimeline, { WorkflowStatusBadge } from "@/components/WorkflowTimeline";
import type { CallRow, SmsDeliveryStatus, WorkflowWithDetails } from "@/lib/types";

interface WorkflowPayload extends WorkflowWithDetails {
  linked_call?: CallRow | null;
}

function smsStatusClass(status: SmsDeliveryStatus | string | undefined) {
  switch (status) {
    case "delivered":
    case "received":
      return "bg-success/20 text-success";
    case "failed":
    case "undelivered":
      return "bg-danger/20 text-danger";
    case "sent":
    case "sending":
    case "queued":
      return "bg-warn/20 text-warn";
    default:
      return "bg-surface2 text-muted";
  }
}

function callStatusClass(status: string) {
  if (status === "ended") return "bg-success/20 text-success";
  if (status === "error" || status === "failed") return "bg-danger/20 text-danger";
  return "bg-primary/20 text-primary";
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const [wf, setWf] = useState<WorkflowPayload | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [smsRefreshing, setSmsRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workflows/${params.id}`, { cache: "no-store" });
    const data = await res.json();
    if (data.workflow) setWf(data.workflow);
  }, [params.id]);

  const refreshSms = useCallback(async () => {
    setSmsRefreshing(true);
    try {
      await fetch(`/api/workflows/${params.id}/sms/refresh`, { method: "POST" });
      await load();
    } finally {
      setSmsRefreshing(false);
    }
  }, [params.id, load]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!wf) return;
    const active = ["running", "waiting_reply", "waiting_delay", "pending"].includes(wf.status);
    if (!active) return;
    refreshSms();
    const t = setInterval(refreshSms, 10000);
    return () => clearInterval(t);
  }, [wf?.status, wf?.id, refreshSms]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    await fetch(`/api/workflows/${params.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    });
    setReply("");
    setBusy(false);
    load();
  }

  if (!wf) return <p className="py-20 text-center text-sm text-muted">Loading workflow…</p>;

  const waitingReply = wf.status === "waiting_reply" || wf.current_step === "wait_for_reply";
  const linked = wf.linked_call;

  return (
    <div>
      <PageHeader
        title={wf.lead.name || "Workflow"}
        subtitle={`${wf.type === "lead_flow_sms" ? "Lead Flow SMS" : "Outbound Campaign"} · ${wf.lead.phone}`}
        action={
          <Link href="/workflows" className="btn-ghost">
            ← All workflows
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <WorkflowStatusBadge status={wf.status} />
        {wf.current_step && (
          <span className="badge bg-surface2 text-muted">Step: {wf.current_step}</span>
        )}
        {wf.scheduled_callback && (
          <span className="badge bg-primary/15 text-primary">
            Callback: {wf.scheduled_callback.scheduled_at}
          </span>
        )}
      </div>

      {wf.error && (
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {wf.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-6">
          <h3 className="mb-5 text-sm font-semibold text-white">Flow Timeline</h3>
          <WorkflowTimeline steps={wf.steps} />
        </div>

        <div className="space-y-6">
          {linked && (
            <div className="card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Call status</h3>
                <span className={`badge ${callStatusClass(linked.status)}`}>{linked.status}</span>
              </div>
              <p className="text-xs text-muted">
                Retell ID: <span className="text-white/80">{linked.retell_call_id}</span>
              </p>
              {linked.duration_sec != null && (
                <p className="text-xs text-muted">Duration: {linked.duration_sec}s</p>
              )}
              {linked.id > 0 ? (
                <Link href={`/calls/${linked.id}`} className="btn-ghost w-full text-center text-xs">
                  Open call detail / transcript →
                </Link>
              ) : (
                <p className="text-[11px] text-muted">Call in progress — detail appears when ended.</p>
              )}
            </div>
          )}

          {(waitingReply || wf.status === "running") && (
            <form onSubmit={sendReply} className="card space-y-3 p-5">
              <h3 className="text-sm font-semibold text-white">Simulate SMS Reply</h3>
              <p className="text-xs text-muted">
                Type the lead&apos;s reply here (e.g. &quot;YES&quot;, &quot;call me at 3pm&quot;, &quot;busy later&quot;).
              </p>
              <input
                className="input"
                placeholder='e.g. "YES" or "call me tomorrow at 2pm"'
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "Processing…" : "Send reply & advance flow"}
              </button>
            </form>
          )}

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">SMS Thread</h3>
              <button
                type="button"
                onClick={refreshSms}
                disabled={smsRefreshing}
                className="btn-ghost px-2.5 py-1 text-[11px]"
              >
                {smsRefreshing ? "Refreshing…" : "Refresh SMS status"}
              </button>
            </div>
            {wf.sms_messages.length === 0 ? (
              <p className="text-xs text-muted">No messages yet.</p>
            ) : (
              <div className="space-y-2">
                {wf.sms_messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3 py-2.5 text-xs ${
                      m.direction === "outbound" ? "bg-surface2 text-white" : "ml-4 bg-primary/20 text-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase text-muted">
                        {m.direction === "outbound" ? "Sent" : "Received"}
                      </span>
                      <span className={`badge text-[10px] ${smsStatusClass(m.status)}`}>
                        {m.status || "unknown"}
                      </span>
                      <span className="text-[10px] text-muted">{m.created_at}</span>
                    </div>
                    {(m.from_number || m.to_number) && (
                      <p className="mt-1 text-[10px] text-muted">
                        {m.from_number || "—"} → {m.to_number || "—"}
                      </p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                    {m.twilio_sid && (
                      <p className="mt-1 truncate text-[10px] text-muted" title={m.twilio_sid}>
                        SID: {m.twilio_sid.slice(0, 8)}…{m.twilio_sid.slice(-4)}
                      </p>
                    )}
                    {m.error_message && (
                      <p className="mt-1 text-[10px] text-danger">{m.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5 text-xs text-muted">
            <p className="mb-2 font-semibold text-white/80">Make.com steps mapped</p>
            <ul className="space-y-1 leading-relaxed">
              <li>① SMS → ② Wait → ③ Check reply → ④ AI yes/no</li>
              <li>YES → Retell call → poll → extract → calendar → dashboard</li>
              <li>NO → time analysis → confirm/reschedule → save schedule</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
