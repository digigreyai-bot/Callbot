"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { directionLabel, formatDateTime, formatDuration } from "@/lib/format";
import type { CallWithDetails } from "@/lib/types";

export default function CallDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [call, setCall] = useState<CallWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (sync: boolean) => {
      try {
        const res = await fetch(`/api/calls/${id}${sync ? "?sync=1" : ""}`, { cache: "no-store" });
        const data = await res.json();
        if (data.call) setCall(data.call);
        if (data.syncError) setError(data.syncError);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load(true);
    // Poll (with sync) until the call has ended.
    pollRef.current = setInterval(() => {
      setCall((prev) => {
        if (prev && prev.status === "ended") {
          if (pollRef.current) clearInterval(pollRef.current);
          return prev;
        }
        load(true);
        return prev;
      });
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const [calendarMsg, setCalendarMsg] = useState<string | null>(null);

  async function createCalendar() {
    setBusy(true);
    setError(null);
    setCalendarMsg(null);
    try {
      const res = await fetch(`/api/calls/${id}/calendar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Calendar failed.");
      setCalendarMsg(data.event?.eventId ? `Event created: ${data.event.eventId}` : "Calendar step completed.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Calendar failed.");
    } finally {
      setBusy(false);
    }
  }
  async function reExtract() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${id}/extract`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed.");
      setCall(data.call);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !call) {
    return <p className="py-20 text-center text-sm text-muted">Loading call…</p>;
  }
  if (!call) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted">Call not found.</p>
        <Link href="/" className="btn-ghost mt-4">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const ext = call.extraction;
  const turns = parseTranscript(call.transcript);

  return (
    <div>
      <PageHeader
        title={call.lead?.name || ext?.name || "Call detail"}
        subtitle={call.lead?.phone || ext?.phone || call.retell_call_id}
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => load(true)} disabled={busy}>
              Re-sync
            </button>
            {call.status === "ended" && (
              <button className="btn-ghost" onClick={createCalendar} disabled={busy}>
                Create calendar
              </button>
            )}
            <button className="btn-primary" onClick={reExtract} disabled={busy}>
              {busy ? "Working…" : "Re-extract"}
            </button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusBadge status={call.status} />
        <span className="badge bg-surface2 text-muted">{directionLabel(call.direction)}</span>
        <span className="badge bg-surface2 text-muted">
          Duration: {formatDuration(call.duration_sec)}
        </span>
        <span className="badge bg-surface2 text-muted">Started {formatDateTime(call.created_at)}</span>
      </div>

      {calendarMsg && (
        <div className="mb-5 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {calendarMsg}
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Transcript + recording */}
        <div className="space-y-6">
          {call.recording_url && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-white">Recording</h3>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={call.recording_url} className="w-full" />
            </div>
          )}

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">Transcript</h3>
            {turns.length === 0 ? (
              <p className="text-sm text-muted">
                {call.status === "ended"
                  ? "No transcript was produced for this call."
                  : "Transcript will appear here once the call completes."}
              </p>
            ) : (
              <div className="space-y-3">
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${
                      t.role === "agent" ? "bg-surface2 text-white" : "ml-auto bg-primary/20 text-white"
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted">
                      {t.role === "agent" ? "Agent" : "Caller"}
                    </p>
                    {t.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Extraction */}
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Extracted Details</h3>
            {!ext ? (
              <p className="text-sm text-muted">
                {call.status === "ended"
                  ? "Not extracted yet — click Re-extract."
                  : "Available after the call ends."}
              </p>
            ) : (
              <dl className="space-y-3 text-sm">
                <Field label="Name" value={ext.name} />
                <Field label="Phone" value={ext.phone} />
                <Field label="Email" value={ext.email} />
                <Field label="Property" value={ext.property_interested_in} />
                <Field
                  label="Appointment"
                  value={ext.appointment_time ? formatDateTime(ext.appointment_time) : null}
                  highlight
                />
              </dl>
            )}
          </div>

          {ext?.summary && (
            <div className="card p-5">
              <h3 className="mb-2 text-sm font-semibold text-white">Summary</h3>
              <p className="text-sm leading-relaxed text-muted">{ext.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right font-medium ${highlight && value ? "text-success" : "text-white"}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

interface Turn {
  role: string;
  content: string;
}

/** Retell transcripts come as plain text "Agent: ...\nUser: ...". Parse to turns. */
function parseTranscript(transcript?: string | null): Turn[] {
  if (!transcript) return [];
  const lines = transcript.split("\n").filter((l) => l.trim());
  const turns: Turn[] = [];
  for (const line of lines) {
    const m = line.match(/^(agent|user|assistant|caller|bot)\s*:\s*(.*)$/i);
    if (m) {
      const roleRaw = m[1].toLowerCase();
      const role = roleRaw === "agent" || roleRaw === "assistant" || roleRaw === "bot" ? "agent" : "user";
      turns.push({ role, content: m[2] });
    } else if (turns.length > 0) {
      turns[turns.length - 1].content += " " + line.trim();
    } else {
      turns.push({ role: "agent", content: line.trim() });
    }
  }
  return turns;
}
