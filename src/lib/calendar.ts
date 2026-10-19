import { config } from "./config";

/** Google Calendar event creation — mirrors Make.com google-calendar:createAnEvent. */

function isConfigured(): boolean {
  return Boolean(
    config.calendar.calendarId &&
      config.calendar.serviceAccountEmail &&
      config.calendar.privateKey
  );
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: config.calendar.serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const crypto = await import("node:crypto");
  const signInput = `${header}.${claim}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(config.calendar.privateKey, "base64url");
  const jwt = `${signInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || "Google auth failed");
  return data.access_token;
}

export async function createCalendarEvent(input: {
  startDateTime: string;
  summary: string;
  description?: string;
  durationMinutes?: number;
}): Promise<{ eventId: string; htmlLink?: string } | null> {
  if (!isConfigured()) {
    console.warn("[calendar] Not configured — skipping event creation.");
    return null;
  }

  const start = new Date(input.startDateTime);
  if (isNaN(start.getTime())) throw new Error(`Invalid start datetime: ${input.startDateTime}`);
  const end = new Date(start.getTime() + (input.durationMinutes ?? 15) * 60 * 1000);

  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description ?? "",
        start: { dateTime: start.toISOString(), timeZone: config.timezone },
        end: { dateTime: end.toISOString(), timeZone: config.timezone },
      }),
    }
  );
  const data = (await res.json()) as { id?: string; htmlLink?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || "Calendar create failed");
  return { eventId: data.id!, htmlLink: data.htmlLink };
}

export function isCalendarConfigured(): boolean {
  return isConfigured();
}
