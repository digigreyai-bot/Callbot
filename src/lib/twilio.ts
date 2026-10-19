import { config } from "./config";

/** Twilio REST helpers — mirrors Make.com twilio:SendSMS + Get Messages modules. */

function authHeader(): string {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.");
  }
  const cred = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");
  return `Basic ${cred}`;
}

function baseUrl() {
  return `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}`;
}

export function twilioFromNumber(): string {
  return config.twilio.fromNumber || "";
}

export async function sendSms(to: string, body: string): Promise<{ sid: string; from: string; to: string }> {
  const params = new URLSearchParams({ To: to, Body: body });
  if (config.twilio.messagingServiceSid) {
    params.set("MessagingServiceSid", config.twilio.messagingServiceSid);
  } else if (config.twilio.fromNumber) {
    params.set("From", config.twilio.fromNumber);
  } else {
    throw new Error("Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER in .env.");
  }

  const res = await fetch(`${baseUrl()}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await res.json()) as { sid?: string; message?: string; from?: string; to?: string };
  if (!res.ok) throw new Error(data.message || `Twilio send failed (${res.status})`);
  return {
    sid: data.sid!,
    from: data.from || config.twilio.fromNumber || "",
    to: data.to || to,
  };
}

export type TwilioMessageStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "receiving"
  | "received"
  | "accepted"
  | "scheduled"
  | "canceled"
  | "read";

export async function getMessageStatus(sid: string): Promise<{
  sid: string;
  status: TwilioMessageStatus;
  from: string | null;
  to: string | null;
  errorCode: number | null;
  errorMessage: string | null;
}> {
  const res = await fetch(`${baseUrl()}/Messages/${sid}.json`, {
    headers: { Authorization: authHeader() },
  });
  const data = (await res.json()) as {
    sid?: string;
    status?: string;
    from?: string;
    to?: string;
    error_code?: number | null;
    error_message?: string | null;
    message?: string;
  };
  if (!res.ok) throw new Error(data.message || `Twilio status failed (${res.status})`);
  return {
    sid: data.sid ?? sid,
    status: (data.status as TwilioMessageStatus) || "queued",
    from: data.from ?? null,
    to: data.to ?? null,
    errorCode: data.error_code ?? null,
    errorMessage: data.error_message ?? null,
  };
}

export function mapTwilioStatus(status: string): import("./types").SmsDeliveryStatus {
  switch (status) {
    case "queued":
    case "accepted":
    case "scheduled":
      return "queued";
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
    case "read":
      return "delivered";
    case "undelivered":
      return "undelivered";
    case "failed":
    case "canceled":
      return "failed";
    case "receiving":
    case "received":
      return "received";
    default:
      return "unknown";
  }
}

export interface TwilioMessage {
  sid: string;
  body: string;
  direction: string;
  date_sent: string;
  from: string;
  to: string;
}

/** Fetch inbound messages from a lead since a given ISO timestamp. */
export async function getInboundMessagesSince(
  leadPhone: string,
  sinceIso: string
): Promise<TwilioMessage[]> {
  const since = new Date(sinceIso).getTime();
  const params = new URLSearchParams({
    To: config.twilio.fromNumber || config.twilio.messagingServiceSid,
    PageSize: "20",
  });

  const res = await fetch(`${baseUrl()}/Messages.json?${params}`, {
    headers: { Authorization: authHeader() },
  });
  const data = (await res.json()) as { messages?: TwilioMessage[]; message?: string };
  if (!res.ok) throw new Error(data.message || `Twilio list failed (${res.status})`);

  return (data.messages ?? []).filter((m) => {
    const fromMatch =
      m.from === leadPhone ||
      m.from.replace(/\D/g, "") === leadPhone.replace(/\D/g, "");
    const inbound = m.direction === "inbound";
    const after = new Date(m.date_sent).getTime() >= since;
    return fromMatch && inbound && after;
  });
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    config.twilio.accountSid &&
      config.twilio.authToken &&
      (config.twilio.messagingServiceSid || config.twilio.fromNumber)
  );
}
