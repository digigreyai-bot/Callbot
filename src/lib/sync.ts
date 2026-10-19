import { config } from "./config";
import { getCallWithDetails, getCallByRetellId, updateCallFromRetell, upsertExtraction, getCallById } from "./db";
import { extractFromTranscript } from "./extract";
import { getCall } from "./retell";
import { postCallToDashboard } from "./dashboard";
import { createCalendarEvent } from "./calendar";
import { extractCalendarFromTranscript } from "./sms-ai";
import type { CallWithDetails } from "./types";

/**
 * Pull the latest state of a call from Retell into the local DB.
 * When the call has ended and has a transcript, run LLM extraction
 * (unless already extracted, or force = true) and optionally forward
 * the result to an external dashboard.
 */
export async function syncCallByRetellId(
  retellCallId: string,
  opts?: { forceExtract?: boolean }
): Promise<CallWithDetails | undefined> {
  const existing = getCallByRetellId(retellCallId);
  if (!existing) return undefined;

  const remote = await getCall(retellCallId);
  updateCallFromRetell(retellCallId, {
    status: remote.status,
    transcript: remote.transcript,
    recording_url: remote.recordingUrl,
    duration_sec: remote.durationSec,
    agent_id: remote.agentId,
  });

  const refreshed = getCallByRetellId(retellCallId)!;
  const details = getCallWithDetails(refreshed.id)!;

  const shouldExtract =
    remote.status === "ended" &&
    !!refreshed.transcript &&
    (opts?.forceExtract || !details.extraction);

  if (shouldExtract) {
    await runExtraction(refreshed.id, refreshed.transcript!);
  }

  return getCallWithDetails(refreshed.id);
}

export async function runExtraction(callId: number, transcript: string) {
  const result = await extractFromTranscript(transcript);
  upsertExtraction({
    call_id: callId,
    name: result.name || null,
    email: result.email || null,
    phone: result.phone || null,
    appointment_time: result.appointmentTime || null,
    property_interested_in: result.propertyInterestedIn || null,
    summary: result.summary || null,
    raw_json: JSON.stringify(result),
  });
  await forwardToDashboard(callId);
}

/** Inbound Call Copilot + Calendar_Summary: extract, calendar, dashboard POST. */
export async function processInboundCallEnded(retellCallId: string): Promise<CallWithDetails | undefined> {
  const synced = await syncCallByRetellId(retellCallId, { forceExtract: true });
  if (!synced?.transcript) return synced;

  const nowIso = new Date().toISOString();
  try {
    const cal = await extractCalendarFromTranscript(synced.transcript, nowIso);
    if (cal.startDateTime) {
      await createCalendarEvent({
        startDateTime: cal.startDateTime,
        summary: cal.eventName,
        description: cal.summary,
      });
    }
  } catch (e) {
    console.error("[inbound-calendar]", e);
  }

  try {
    await postCallToDashboard(
      {
        name: synced.extraction?.name ?? synced.lead?.name ?? "",
        email: synced.extraction?.email ?? "",
        phoneNumber: synced.extraction?.phone ?? synced.lead?.phone ?? "",
        appointmentTime: synced.extraction?.appointment_time ?? "",
        propertyInterestedIn: synced.extraction?.property_interested_in ?? "",
        callRecordingURL: synced.recording_url ?? "",
        callDuration: synced.duration_sec ?? 0,
        callId: retellCallId,
        summary: synced.extraction?.summary ?? "",
      },
      { inbound: true }
    );
  } catch (e) {
    console.error("[inbound-dashboard]", e);
  }

  return getCallWithDetails(synced.id);
}

/** Calendar_Summary blueprint — manual run on any ended call. */
export async function createCalendarFromCall(callId: number) {
  const call = getCallById(callId);
  if (!call?.transcript) throw new Error("No transcript on this call.");
  const cal = await extractCalendarFromTranscript(call.transcript, new Date().toISOString());
  if (!cal.startDateTime) throw new Error("Could not extract appointment time from transcript.");
  const ev = await createCalendarEvent({
    startDateTime: cal.startDateTime,
    summary: cal.eventName,
    description: cal.summary,
  });
  return { extraction: cal, event: ev };
}

/** Optional: replicate the old Make.com HTTP POST to an external dashboard. */
async function forwardToDashboard(callId: number) {
  if (!config.dashboard.url) return;
  const details = getCallWithDetails(callId);
  if (!details) return;
  try {
    await fetch(config.dashboard.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.dashboard.apiKey ? { "x-api-key": config.dashboard.apiKey } : {}),
        ...(config.dashboard.clientId ? { "x-client-id": config.dashboard.clientId } : {}),
      },
      body: JSON.stringify({
        name: details.extraction?.name ?? details.lead?.name ?? "",
        email: details.extraction?.email ?? "",
        phoneNumber: details.extraction?.phone ?? details.lead?.phone ?? "",
        appointmentTime: details.extraction?.appointment_time ?? "",
        property_interested_in: details.extraction?.property_interested_in ?? "",
        callRecordingURL: details.recording_url ?? "",
        callDuration: details.duration_sec ?? 0,
        callId: details.retell_call_id,
        summary: details.extraction?.summary ?? "",
      }),
    });
  } catch (err) {
    console.error("[dashboard-forward] failed:", err);
  }
}
