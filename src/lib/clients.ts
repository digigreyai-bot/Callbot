import { config } from "./config";
import { getClient, getDefaultClient } from "./db";

export interface ClientCreds {
  /** Internal SQLite client row id (may be empty if env-only fallback). */
  id: string | null;
  name: string;
  /** Agent Assist x-client-id */
  dashboardClientId: string;
  apiKey: string;
  calendarId: string;
}

/** Resolve dashboard + calendar credentials for a client row or env fallback. */
export function resolveClientCreds(clientId?: string | null): ClientCreds {
  const row = clientId ? getClient(clientId) : getDefaultClient();
  const fallback = getDefaultClient();
  const chosen = row ?? fallback;

  return {
    id: chosen?.id ?? null,
    name: chosen?.name ?? "Env default",
    dashboardClientId:
      chosen?.dashboard_client_id?.trim() || config.dashboard.clientId || "",
    apiKey: chosen?.dashboard_api_key?.trim() || config.dashboard.apiKey || "",
    calendarId: chosen?.calendar_id?.trim() || config.calendar.calendarId || "",
  };
}
