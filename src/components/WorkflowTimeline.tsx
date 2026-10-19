"use client";

import type { WorkflowStepRow } from "@/lib/types";

const STEP_ICONS: Record<string, string> = {
  sms_initial: "📱",
  sms_followup: "📱",
  sms_call_notice: "📱",
  sms_confirmation: "✅",
  sms_followup_busy: "📱",
  sms_reminder: "🔔",
  delay: "⏳",
  wait_for_reply: "⏳",
  delay_retry: "⏳",
  check_messages: "💬",
  ai_decision: "🤖",
  ai_time_analysis: "🤖",
  ai_schedule_default: "🤖",
  ai_normalize_time: "🤖",
  place_call: "📞",
  poll_call: "🔄",
  post_call_process: "📋",
  create_calendar: "📅",
  dashboard_post_lead: "☁️",
  dashboard_post_call: "☁️",
  schedule_save: "💾",
  route_has_time: "🔀",
};

export default function WorkflowTimeline({ steps }: { steps: WorkflowStepRow[] }) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted">Workflow started — steps will appear here…</p>;
  }

  return (
    <ol className="relative space-y-0">
      {steps.map((s, i) => {
        const done = s.status === "done";
        const failed = s.status === "failed";
        const icon = STEP_ICONS[s.step_key] ?? "•";
        return (
          <li key={s.id} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full text-sm ${
                  failed
                    ? "bg-danger/20 ring-2 ring-danger/50"
                    : done
                      ? "bg-success/20 ring-2 ring-success/40"
                      : "bg-surface2 ring-1 ring-border"
                }`}
              >
                {icon}
              </div>
              {i < steps.length - 1 && (
                <div className={`mt-1 w-0.5 flex-1 min-h-[24px] ${done ? "bg-success/30" : "bg-border"}`} />
              )}
            </div>
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{s.label}</p>
                <StepStatus status={s.status} />
              </div>
              {s.detail && <p className="mt-1 text-xs text-muted leading-relaxed">{s.detail}</p>}
              <p className="mt-0.5 text-[10px] text-muted/60">{s.created_at}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepStatus({ status }: { status: string }) {
  const cls =
    status === "done"
      ? "bg-success/15 text-success"
      : status === "failed"
        ? "bg-danger/15 text-danger"
        : status === "running"
          ? "bg-accent/15 text-accent"
          : "bg-muted/15 text-muted";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function WorkflowStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-muted/15 text-muted" },
    running: { label: "Running", cls: "bg-accent/15 text-accent" },
    waiting_reply: { label: "Waiting for SMS reply", cls: "bg-warn/15 text-warn" },
    waiting_delay: { label: "Waiting…", cls: "bg-warn/15 text-warn" },
    completed: { label: "Completed", cls: "bg-success/15 text-success" },
    failed: { label: "Failed", cls: "bg-danger/15 text-danger" },
    cancelled: { label: "Cancelled", cls: "bg-muted/15 text-muted" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted/15 text-muted" };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}
