import { config } from "./config";
import type { ClientCreds } from "./clients";

/** External dashboard POST — mirrors Make.com http:ActionSendData modules. */

type DashboardAuth = {
  clientId?: string | null;
  serviceKey?: string;
  apiKey?: string;
  agentId?: string | null;
  callingNumber?: string | null;
};

function buildHeaders(auth: DashboardAuth): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth.serviceKey) {
    headers["x-callbot-service-key"] = auth.serviceKey;
    if (auth.clientId) headers["x-client-id"] = auth.clientId;
    if (auth.agentId) headers["x-retell-agent-id"] = auth.agentId;
    if (auth.callingNumber) headers["x-calling-number"] = auth.callingNumber;
    return headers;
  }

  if (auth.apiKey) headers["x-api-key"] = auth.apiKey;
  if (auth.clientId) headers["x-client-id"] = auth.clientId;
  return headers;
}

/** Prefer explicit UI client creds; otherwise resolve via AA+ service key / env. */
async function resolveAuth(opts: {
  agentId?: string | null;
  callingNumber?: string | null;
  creds?: ClientCreds | null;
}): Promise<DashboardAuth> {
  if (opts.creds?.dashboardClientId || opts.creds?.apiKey) {
    return {
      clientId: opts.creds.dashboardClientId || config.dashboard.clientId || null,
      apiKey: opts.creds.apiKey || config.dashboard.apiKey || undefined,
      serviceKey: undefined,
      agentId: opts.agentId || null,
      callingNumber: opts.callingNumber || null,
    };
  }

  const serviceKey = config.dashboard.serviceKey;
  const fallback: DashboardAuth = {
    clientId: config.dashboard.clientId || null,
    serviceKey: serviceKey || undefined,
    apiKey: config.dashboard.apiKey || undefined,
    agentId: opts.agentId || null,
    callingNumber: opts.callingNumber || null,
  };

  if (!serviceKey || !config.dashboard.resolveUrl) {
    return fallback;
  }

  try {
    const params = new URLSearchParams();
    if (opts.agentId) params.set("agentId", opts.agentId);
    if (opts.callingNumber) params.set("number", opts.callingNumber);
    if (!params.toString()) return fallback;

    const res = await fetch(`${config.dashboard.resolveUrl}?${params.toString()}`, {
      headers: { "x-callbot-service-key": serviceKey },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { clientId?: string };
    return {
      ...fallback,
      clientId: data.clientId || fallback.clientId,
    };
  } catch (err) {
    console.error("[dashboard-resolve]", err);
    return fallback;
  }
}

export async function postLeadToDashboard(
  input: {
    leadId: string;
    firstName: string;
    phoneNumber: string;
    email?: string;
    agentId?: string;
  },
  creds?: ClientCreds | null
) {
  const url = config.dashboard.leadUrl;
  if (!url) return;
  const auth = await resolveAuth({ agentId: input.agentId, creds });
  await fetch(url, {
    method: "POST",
    headers: buildHeaders(auth),
    body: JSON.stringify({
      LeadId: input.leadId,
      firstName: input.firstName,
      email: input.email ?? "",
      phoneNumber: input.phoneNumber,
      agentId: input.agentId ?? "",
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
    agentId?: string | null;
    fromNumber?: string | null;
  },
  opts?: { inbound?: boolean; creds?: ClientCreds | null }
) {
  const url =
    opts?.inbound && config.dashboard.inboundUrl
      ? config.dashboard.inboundUrl
      : config.dashboard.url;
  if (!url) return;

  const auth = await resolveAuth({
    agentId: input.agentId,
    callingNumber: input.fromNumber,
    creds: opts?.creds,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(auth),
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
      agentId: input.agentId ?? "",
      from_number: input.fromNumber ?? "",
      clientId: auth.clientId ?? "",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[dashboard-post]", res.status, text.slice(0, 300));
  }
}

export async function postScheduleToDashboard(
  input: {
    name: string;
    phoneNumber: string;
    scheduledAt: string;
    notes?: string;
    agentId?: string | null;
  },
  creds?: ClientCreds | null
) {
  if (!config.dashboard.url) return;
  const auth = await resolveAuth({ agentId: input.agentId, creds });
  await fetch(config.dashboard.url, {
    method: "POST",
    headers: buildHeaders(auth),
    body: JSON.stringify({
      type: "scheduled_callback",
      name: input.name,
      phoneNumber: input.phoneNumber,
      scheduledAt: input.scheduledAt,
      notes: input.notes ?? "",
      agentId: input.agentId ?? "",
      clientId: auth.clientId ?? "",
    }),
  });
}
