/**
 * Workflow engine — replaces all Make.com scenarios:
 *
 * 1. LEAD_FLOW_TALHA        → type: lead_flow_sms
 * 2. Outbound 19-step SMS   → type: outbound_campaign
 * 3. BismillahRealty post-call → handled inside outbound_campaign after place_call
 * 4. Calendar_Summary       → create_calendar step
 * 5. Lead_Flow_call extract → extract + dashboard_post_call
 */

import { config, getAgents } from "../config";
import {
  addWorkflowStep,
  createCall,
  createLead,
  getLead,
  getWorkflow,
  getWorkflowContext,
  listDueWorkflows,
  logSms,
  saveScheduledCallback,
  setWorkflowContext,
  updateWorkflow,
} from "../db";
import { postCallToDashboard, postLeadToDashboard, postScheduleToDashboard } from "../dashboard";
import { createCalendarEvent } from "../calendar";
import {
  analyzeCallbackTime,
  classifySmsReply,
  defaultCallbackTime,
  extractCalendarFromTranscript,
  extractCallbackTime,
  normalizeCallbackTime,
} from "../sms-ai";
import { getInboundMessagesSince, isTwilioConfigured, sendSms, twilioFromNumber } from "../twilio";
import { placePhoneCall, getCall } from "../retell";
import { syncCallByRetellId } from "../sync";

function fmtDelay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

async function sendAndLogSms(
  wfId: number,
  lead: { id: number; phone: string },
  body: string
) {
  const { sid, from, to } = await sendSms(lead.phone, body);
  logSms({
    workflow_id: wfId,
    lead_id: lead.id,
    direction: "outbound",
    body,
    twilio_sid: sid,
    status: "queued",
    from_number: from || twilioFromNumber() || null,
    to_number: to || lead.phone,
  });
  return sid;
}

function scheduleAt(secondsFromNow: number): string {
  return fmtDelay(new Date(Date.now() + secondsFromNow * 1000).toISOString());
}

async function stepDone(wfId: number, key: string, label: string, detail?: string) {
  addWorkflowStep(wfId, key, label, "done", detail);
}

async function stepFail(wfId: number, key: string, label: string, detail: string) {
  addWorkflowStep(wfId, key, label, "failed", detail);
  updateWorkflow(wfId, { status: "failed", error: detail });
}

/* ═══════════════════════ LEAD FLOW SMS (Blueprint 1) ═══════════════════════ */

export async function startLeadFlowSms(input: {
  name: string;
  phone: string;
  property?: string;
  email?: string;
}) {
  const lead = createLead({
    name: input.name,
    phone: input.phone,
    email: input.email,
    property_interested_in: input.property ?? null,
  });
  const { createWorkflow } = await import("../db");
  const wf = createWorkflow({ type: "lead_flow_sms", lead_id: lead.id, context: { step: "sms_initial" } });
  updateWorkflow(wf.id, { status: "running", current_step: "sms_initial" });
  runWorkflow(wf.id).catch((e) => console.error("[workflow]", e));
  return wf;
}

/* ═════════════════════ OUTBOUND CAMPAIGN (19-step + BismillahRealty) ═════════════════════ */

export async function startOutboundCampaign(input: {
  name: string;
  phone: string;
  property?: string;
  email?: string;
}) {
  const lead = createLead({
    name: input.name,
    phone: input.phone,
    email: input.email,
    property_interested_in: input.property ?? null,
  });
  const { createWorkflow } = await import("../db");
  const wf = createWorkflow({
    type: "outbound_campaign",
    lead_id: lead.id,
    context: { step: "sms_call_notice", retryCount: 0 },
  });
  updateWorkflow(wf.id, { status: "running", current_step: "sms_call_notice" });
  runWorkflow(wf.id).catch((e) => console.error("[workflow]", e));
  return wf;
}

export async function startDirectRetellCall(input: {
  name: string;
  phone: string;
  property?: string;
  time?: string;
  email?: string;
}) {
  const lead = createLead({
    name: input.name,
    phone: input.phone,
    email: input.email,
    property_interested_in: input.property ?? null,
  });
  const { createWorkflow } = await import("../db");
  const wf = createWorkflow({
    type: "direct_retell_call",
    lead_id: lead.id,
    context: {
      step: "place_call",
      webhookTime: input.time ?? new Date().toISOString(),
    },
  });
  updateWorkflow(wf.id, { status: "running", current_step: "place_call" });
  runWorkflow(wf.id).catch((e) => console.error("[workflow]", e));
  return wf;
}

/* ═════════════════════════════ ENGINE CORE ═════════════════════════════ */

export async function processDueWorkflows() {
  const due = listDueWorkflows();
  for (const wf of due) {
    await runWorkflow(wf.id).catch((e) => console.error(`[workflow ${wf.id}]`, e));
  }
}

export async function runWorkflow(wfId: number) {
  const wf = getWorkflow(wfId);
  if (!wf || wf.status === "completed" || wf.status === "failed" || wf.status === "cancelled") return;

  const ctx = getWorkflowContext(wfId);
  const step = String(ctx.step ?? "unknown");
  const lead = getLead(wf.lead_id)!;
  const property = lead.property_interested_in || "your inquiry";
  const nowIso = new Date().toISOString();

  updateWorkflow(wfId, { status: "running", current_step: step, next_run_at: null });

  try {
    if (wf.type === "lead_flow_sms") {
      await runLeadFlowStep(wfId, step, lead, property, ctx);
    } else if (wf.type === "outbound_campaign" || wf.type === "direct_retell_call") {
      await runOutboundStep(wfId, step, lead, property, ctx, nowIso);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await stepFail(wfId, step, step, msg);
  }
}

async function runLeadFlowStep(
  wfId: number,
  step: string,
  lead: { id: number; name: string; phone: string; property_interested_in: string | null },
  property: string,
  ctx: Record<string, unknown>
) {
  if (step === "sms_initial") {
    const body = `Hi ${lead.name},\nThanks for reaching out about ${property}!\nI'm just wrapping up a few tasks right now, but I'll get back to you in a couple of minutes. Talk soon!`;
    if (isTwilioConfigured()) {
      await sendAndLogSms(wfId, lead, body);
    }
    await stepDone(wfId, "sms_initial", "Send initial SMS", body.slice(0, 80));
    setWorkflowContext(wfId, { ...ctx, step: "delay" });
    updateWorkflow(wfId, {
      status: "waiting_delay",
      current_step: "delay",
      next_run_at: scheduleAt(config.workflow.leadFlowDelaySec),
    });
    return;
  }

  if (step === "delay") {
    await stepDone(wfId, "delay", `Wait ${config.workflow.leadFlowDelaySec}s`, "Delay complete");
    setWorkflowContext(wfId, { ...ctx, step: "sms_followup" });
    await runWorkflow(wfId);
    return;
  }

  if (step === "sms_followup") {
    const body = `Hi ${lead.name},\nThank you for waiting! When would be a good time for a quick call to talk about ${property} and set up your appointment? Just let me know what works for you, and I'll take care of the rest!`;
    if (isTwilioConfigured()) {
      await sendAndLogSms(wfId, lead, body);
    }
    await stepDone(wfId, "sms_followup", "Send follow-up SMS");
    setWorkflowContext(wfId, { ...ctx, step: "dashboard_post_lead" });
    await runWorkflow(wfId);
    return;
  }

  if (step === "dashboard_post_lead") {
    await postLeadToDashboard({
      leadId: `lead_${lead.id}`,
      firstName: lead.name,
      phoneNumber: lead.phone,
    });
    await stepDone(wfId, "dashboard_post_lead", "POST lead to dashboard");
    updateWorkflow(wfId, { status: "completed", current_step: "done" });
  }
}

async function runOutboundStep(
  wfId: number,
  step: string,
  lead: { id: number; name: string; phone: string; property_interested_in: string | null },
  property: string,
  ctx: Record<string, unknown>,
  nowIso: string
) {
  /* Step 3 — SMS: call in 5 minutes */
  if (step === "sms_call_notice") {
    const body = `Hi ${lead.name}! This is Adrian from Right At Home Realty regarding ${property}. I'll give you a quick call in about 5 minutes. Reply YES when you're ready, or let me know a better time.`;
    if (isTwilioConfigured()) {
      await sendAndLogSms(wfId, lead, body);
    }
    await stepDone(wfId, "sms_call_notice", "SMS — call in 5 minutes");
    setWorkflowContext(wfId, {
      ...ctx,
      step: "wait_for_reply",
      smsSentAt: nowIso,
    });
    updateWorkflow(wfId, {
      status: "waiting_reply",
      current_step: "wait_for_reply",
      next_run_at: scheduleAt(config.workflow.smsWaitSec),
    });
    return;
  }

  /* Step 4–5 — Wait then check messages */
  if (step === "wait_for_reply") {
    await stepDone(wfId, "wait_for_reply", `Wait ${config.workflow.smsWaitSec}s for reply`);
    setWorkflowContext(wfId, { ...ctx, step: "check_messages" });
    await runWorkflow(wfId);
    return;
  }

  if (step === "check_messages") {
    const since = String(ctx.smsSentAt ?? nowIso);
    let reply = String(ctx.manualReply ?? "");
    if (!reply && isTwilioConfigured()) {
      const msgs = await getInboundMessagesSince(lead.phone, since);
      reply = msgs[0]?.body ?? "";
      if (reply) {
        logSms({
          workflow_id: wfId,
          lead_id: lead.id,
          direction: "inbound",
          body: reply,
          twilio_sid: msgs[0]?.sid,
          status: "received",
          from_number: msgs[0]?.from ?? lead.phone,
          to_number: msgs[0]?.to ?? twilioFromNumber() ?? null,
        });
      }
    }
    await stepDone(wfId, "check_messages", "Check SMS replies", reply ? `"${reply.slice(0, 60)}"` : "No reply yet");
    setWorkflowContext(wfId, { ...ctx, step: "ai_decision", lastReply: reply });
    await runWorkflow(wfId);
    return;
  }

  /* Step 6–7 — AI yes/no decision + router */
  if (step === "ai_decision") {
    const reply = String(ctx.lastReply ?? "");
    let decision: "yes" | "no" | "stop" = "no";
    if (!reply) {
      decision = "no"; // no reply → treat as busy, go to reschedule path
    } else {
      const result = await classifySmsReply(reply, nowIso);
      decision = result.decision;
      await stepDone(wfId, "ai_decision", "AI call decision", `${decision}: ${result.reason}`);
    }

    if (decision === "stop") {
      await stepDone(wfId, "cancelled", "Lead opted out");
      updateWorkflow(wfId, { status: "cancelled", current_step: "cancelled" });
      return;
    }
    if (decision === "yes") {
      setWorkflowContext(wfId, { ...ctx, step: "place_call" });
      await runWorkflow(wfId);
      return;
    }
    setWorkflowContext(wfId, { ...ctx, step: "ai_time_analysis" });
    await runWorkflow(wfId);
    return;
  }

  /* Step 8(YES) — Place Retell outbound call (BismillahRealty blueprint) */
  if (step === "place_call") {
    const agent = getAgents().find((a) => a.direction === "outbound") ?? getAgents()[0];
    if (!agent) throw new Error("No outbound agent configured.");

    const webhookTime = String(ctx.webhookTime ?? nowIso);
    const result = await placePhoneCall({
      toNumber: lead.phone,
      overrideAgentId: agent.retellAgentId,
      dynamicVars: {
        lead_name: lead.name,
        property_interested_in: property,
        Phone_Number: lead.phone,
        current_datetime: webhookTime,
        timezone: config.timezone,
      },
    });
    createCall({
      retell_call_id: result.call_id,
      lead_id: lead.id,
      direction: "outbound",
      agent_id: agent.retellAgentId,
      status: "registered",
    });
    await stepDone(wfId, "place_call", "Create Retell outbound call", result.call_id);
    setWorkflowContext(wfId, { ...ctx, step: "poll_call", retellCallId: result.call_id });
    updateWorkflow(wfId, {
      status: "waiting_delay",
      current_step: "poll_call",
      next_run_at: scheduleAt(30),
    });
    return;
  }

  /* Poll until call ends (BismillahRealty: sleep + GetCall) */
  if (step === "poll_call") {
    const callId = String(ctx.retellCallId ?? "");
    const remote = await getCall(callId);
    if (remote.status !== "ended") {
      updateWorkflow(wfId, {
        status: "waiting_delay",
        current_step: "poll_call",
        next_run_at: scheduleAt(20),
      });
      return;
    }
    await stepDone(wfId, "poll_call", "Call ended — sync transcript");
    setWorkflowContext(wfId, { ...ctx, step: "post_call_process" });
    await runWorkflow(wfId);
    return;
  }

  if (step === "post_call_process") {
    const callId = String(ctx.retellCallId ?? "");
    const synced = await syncCallByRetellId(callId, { forceExtract: true });
    const transcript = synced?.transcript ?? "";

    /* Calendar_Summary + BismillahRealty calendar step */
    if (transcript) {
      const cal = await extractCalendarFromTranscript(transcript, nowIso);
      if (cal.startDateTime) {
        const ev = await createCalendarEvent({
          startDateTime: cal.startDateTime,
          summary: cal.eventName,
          description: cal.summary,
        });
        await stepDone(
          wfId,
          "create_calendar",
          "Google Calendar event",
          ev ? ev.eventId : "Skipped (not configured)"
        );
      }
    }

    /* Lead_Flow_call dashboard POST */
    await postCallToDashboard({
      name: synced?.extraction?.name ?? lead.name,
      email: synced?.extraction?.email ?? "",
      phoneNumber: synced?.extraction?.phone ?? lead.phone,
      appointmentTime: synced?.extraction?.appointment_time ?? "",
      propertyInterestedIn: synced?.extraction?.property_interested_in ?? property,
      callRecordingURL: synced?.recording_url ?? "",
      callDuration: synced?.duration_sec ?? 0,
      callId,
      summary: synced?.extraction?.summary ?? "",
    });
    await stepDone(wfId, "dashboard_post_call", "POST call result to dashboard");
    updateWorkflow(wfId, { status: "completed", current_step: "done" });
    return;
  }

  /* Step 9(NO) — Time analysis */
  if (step === "ai_time_analysis") {
    const reply = String(ctx.lastReply ?? "busy");
    const analysis = await analyzeCallbackTime(reply, nowIso);
    await stepDone(wfId, "ai_time_analysis", "AI time analysis", analysis.notes);
    setWorkflowContext(wfId, { ...ctx, step: "route_has_time", timeAnalysis: analysis });
    await runWorkflow(wfId);
    return;
  }

  /* Step 10 — Router: has callback time? */
  if (step === "route_has_time") {
    const analysis = ctx.timeAnalysis as { hasTime: boolean; suggestedTime: string; notes: string };
    if (analysis?.hasTime && analysis.suggestedTime) {
      setWorkflowContext(wfId, { ...ctx, step: "sms_confirmation", scheduledAt: analysis.suggestedTime });
    } else {
      setWorkflowContext(wfId, { ...ctx, step: "ai_schedule_default" });
    }
    await runWorkflow(wfId);
    return;
  }

  /* Step 11 — Confirmation SMS */
  if (step === "sms_confirmation") {
    const at = String(ctx.scheduledAt ?? "");
    const body = `Got it, ${lead.name}! I've noted your preferred time. We'll reach out around then. Thanks!`;
    if (isTwilioConfigured()) {
      await sendAndLogSms(wfId, lead, body);
    }
    await stepDone(wfId, "sms_confirmation", "Confirmation SMS", at);
    setWorkflowContext(wfId, { ...ctx, step: "schedule_save" });
    await runWorkflow(wfId);
    return;
  }

  /* Step 12 — Default scheduler (3 min from now) */
  if (step === "ai_schedule_default") {
    const reply = String(ctx.lastReply ?? "");
    let scheduledAt = defaultCallbackTime();
    if (reply) {
      const extracted = await extractCallbackTime(reply, nowIso);
      if (extracted) scheduledAt = extracted;
    }
    await stepDone(wfId, "ai_schedule_default", "Default callback time", scheduledAt);
    setWorkflowContext(wfId, { ...ctx, step: "sms_followup_busy", scheduledAt });
    await runWorkflow(wfId);
    return;
  }

  /* Step 15 — Follow-up SMS when busy */
  if (step === "sms_followup_busy") {
    const body = `No worries, ${lead.name}! When would be a good time for a quick call about ${property}? Just reply with a time that works.`;
    if (isTwilioConfigured()) {
      await sendAndLogSms(wfId, lead, body);
    }
    await stepDone(wfId, "sms_followup_busy", "Follow-up SMS (busy)");
    setWorkflowContext(wfId, { ...ctx, step: "delay_retry", retrySentAt: nowIso });
    updateWorkflow(wfId, {
      status: "waiting_reply",
      current_step: "delay_retry",
      next_run_at: scheduleAt(config.workflow.retryWaitSec),
    });
    return;
  }

  /* Step 16 — Delay before reminder */
  if (step === "delay_retry") {
    await stepDone(wfId, "delay_retry", `Wait ${config.workflow.retryWaitSec}s`);
    setWorkflowContext(wfId, { ...ctx, step: "check_reminder_reply" });
    await runWorkflow(wfId);
    return;
  }

  if (step === "check_reminder_reply") {
    const since = String(ctx.retrySentAt ?? ctx.smsSentAt ?? nowIso);
    let reply = String(ctx.manualReply ?? ctx.lastReply ?? "");
    if (!reply && isTwilioConfigured()) {
      const msgs = await getInboundMessagesSince(lead.phone, since);
      reply = msgs[0]?.body ?? "";
      if (reply) {
        logSms({
          workflow_id: wfId,
          lead_id: lead.id,
          direction: "inbound",
          body: reply,
          twilio_sid: msgs[0]?.sid,
          status: "received",
          from_number: msgs[0]?.from ?? lead.phone,
          to_number: msgs[0]?.to ?? twilioFromNumber() ?? null,
        });
      }
    }
    if (reply) {
      const normalized = await normalizeCallbackTime(reply, nowIso);
      setWorkflowContext(wfId, { ...ctx, step: "schedule_save", scheduledAt: normalized || defaultCallbackTime(), lastReply: reply });
      await stepDone(wfId, "ai_normalize_time", "Normalize callback time", normalized);
    } else {
      const body = `Hi ${lead.name}, just checking — are you available for a quick call today about ${property}? Reply with a time or YES to call now.`;
      if (isTwilioConfigured()) {
        await sendAndLogSms(wfId, lead, body);
      }
      await stepDone(wfId, "sms_reminder", "Reminder SMS");
      setWorkflowContext(wfId, { ...ctx, step: "schedule_save", scheduledAt: defaultCallbackTime() });
    }
    await runWorkflow(wfId);
    return;
  }

  /* Step 19 — Save schedule + dashboard */
  if (step === "schedule_save") {
    const scheduledAt = String(ctx.scheduledAt ?? defaultCallbackTime());
    saveScheduledCallback({
      workflow_id: wfId,
      lead_id: lead.id,
      scheduled_at: scheduledAt,
      notes: String(ctx.lastReply ?? ""),
    });
    await postScheduleToDashboard({
      name: lead.name,
      phoneNumber: lead.phone,
      scheduledAt,
      notes: String(ctx.lastReply ?? ""),
    });
    await stepDone(wfId, "schedule_save", "Save callback schedule", scheduledAt);

    /* If scheduled time is now/past, trigger the call */
    if (new Date(scheduledAt).getTime() <= Date.now() + 60_000) {
      setWorkflowContext(wfId, { ...ctx, step: "place_call" });
      await runWorkflow(wfId);
      return;
    }

    updateWorkflow(wfId, {
      status: "waiting_delay",
      current_step: "scheduled_call",
      next_run_at: fmtDelay(scheduledAt),
    });
    setWorkflowContext(wfId, { ...ctx, step: "scheduled_call" });
    return;
  }

  if (step === "scheduled_call") {
    setWorkflowContext(wfId, { ...ctx, step: "place_call" });
    await runWorkflow(wfId);
  }
}

/** Allow manual SMS reply injection from UI (when Twilio webhook isn't set up). */
export async function injectSmsReply(workflowId: number, replyText: string) {
  const ctx = getWorkflowContext(workflowId);
  const wf = getWorkflow(workflowId);
  if (!wf) throw new Error("Workflow not found");
  logSms({
    workflow_id: workflowId,
    lead_id: wf.lead_id,
    direction: "inbound",
    body: replyText,
    status: "received",
    from_number: wf.lead.phone,
    to_number: twilioFromNumber() || null,
  });
  const step = String(ctx.step);
  if (step === "delay_retry" || step === "check_reminder_reply") {
    setWorkflowContext(workflowId, { ...ctx, manualReply: replyText, lastReply: replyText, step: "check_reminder_reply" });
  } else if (step === "wait_for_reply" || step === "waiting_reply") {
    setWorkflowContext(workflowId, { ...ctx, manualReply: replyText, lastReply: replyText, step: "check_messages" });
  } else {
    setWorkflowContext(workflowId, { ...ctx, manualReply: replyText, lastReply: replyText });
  }
  updateWorkflow(workflowId, { status: "running", next_run_at: null });
  await runWorkflow(workflowId);
}

// Background processor — started once in dev
let processorStarted = false;
export function startWorkflowProcessor() {
  if (processorStarted) return;
  processorStarted = true;
  setInterval(() => {
    processDueWorkflows().catch(console.error);
  }, 3000);
}
