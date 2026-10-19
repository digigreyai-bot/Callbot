import { config } from "./config";

/** External dashboard POST — mirrors Make.com http:ActionSendData modules. */

export async function postLeadToDashboard(input: {
  leadId: string;
  firstName: string;
  phoneNumber: string;
  email?: string;
}) {
  const url = config.dashboard.leadUrl;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.dashboard.apiKey ? { authorization: config.dashboard.apiKey } : {}),
      ...(config.dashboard.clientId ? { "x-client-id": config.dashboard.clientId } : {}),
    },
    body: JSON.stringify({
      LeadId: input.leadId,
      firstName: input.firstName,
      email: input.email ?? "",
      phoneNumber: input.phoneNumber,
    }),
  });
}

/** POST call result — inbound uses DASHBOARD_INBOUND_URL if set (Call Copilot / 2.Lead_Flow_call). */
export async function postCallToDashboard(
  input: {
    name: string;
    email?: string;
    phoneNumber: string;
    appointmentTime?: string;
    propertyInterestedIn?: string;
    callRecordingURL?: string;
    callDuration?: number;
    callId: string;
    summary?: string;
  },
  opts?: { inbound?: boolean }
) {
  const url = opts?.inbound && config.dashboard.inboundUrl ? config.dashboard.inboundUrl : config.dashboard.url;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.dashboard.apiKey ? { authorization: config.dashboard.apiKey } : {}),
      ...(config.dashboard.clientId ? { "x-client-id": config.dashboard.clientId } : {}),
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email ?? "",
      phoneNumber: input.phoneNumber,
      appointmentTime: input.appointmentTime ?? "",
      property_interested_in: input.propertyInterestedIn ?? "",
      callRecordingURL: input.callRecordingURL ?? "",
      callDuration: input.callDuration ?? 0,
      callId: input.callId,
      summary: input.summary ?? "",
    }),
  });
}

export async function postScheduleToDashboard(input: {
  name: string;
  phoneNumber: string;
  scheduledAt: string;
  notes?: string;
}) {
  if (!config.dashboard.url) return;
  await fetch(config.dashboard.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.dashboard.apiKey ? { "x-api-key": config.dashboard.apiKey } : {}),
      ...(config.dashboard.clientId ? { "x-client-id": config.dashboard.clientId } : {}),
    },
    body: JSON.stringify({
      type: "scheduled_callback",
      name: input.name,
      phoneNumber: input.phoneNumber,
      scheduledAt: input.scheduledAt,
      notes: input.notes ?? "",
    }),
  });
}
