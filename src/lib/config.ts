/**
 * Central environment / configuration access.
 */

export type AgentDirection = "inbound" | "outbound";

export interface AgentConfig {
  id: string;
  label: string;
  retellAgentId: string;
  direction: AgentDirection;
}

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function envInt(name: string, fallback: number): number {
  const v = parseInt(env(name, String(fallback)), 10);
  return isNaN(v) ? fallback : v;
}

export const config = {
  retell: {
    apiKey: env("RETELL_API_KEY"),
    fromNumber: env("RETELL_FROM_NUMBER"),
    inboundAgentId: env("RETELL_INBOUND_AGENT_ID"),
    outboundAgentId: env("RETELL_OUTBOUND_AGENT_ID"),
  },
  twilio: {
    accountSid: env("TWILIO_ACCOUNT_SID"),
    authToken: env("TWILIO_AUTH_TOKEN"),
    messagingServiceSid: env("TWILIO_MESSAGING_SERVICE_SID"),
    fromNumber: env("TWILIO_FROM_NUMBER"),
  },
  extraction: {
    provider: (env("EXTRACTION_PROVIDER", "openai").toLowerCase() === "deepseek"
      ? "deepseek"
      : "openai") as "openai" | "deepseek",
    openaiApiKey: env("OPENAI_API_KEY"),
    openaiModel: env("OPENAI_MODEL", "gpt-4o-mini"),
    deepseekApiKey: env("DEEPSEEK_API_KEY"),
    deepseekModel: env("DEEPSEEK_MODEL", "deepseek-chat"),
    deepseekBaseUrl: env("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
  },
  calendar: {
    calendarId: env("GOOGLE_CALENDAR_ID"),
    serviceAccountEmail: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
  },
  timezone: env("DEFAULT_TIMEZONE", "Asia/Karachi"),
  workflow: {
    smsWaitSec: envInt("OUTBOUND_SMS_WAIT_SEC", 300),
    retryWaitSec: envInt("OUTBOUND_RETRY_WAIT_SEC", 600),
    leadFlowDelaySec: 10,
  },
  dashboard: {
    url: env("DASHBOARD_API_URL"),
    inboundUrl: env("DASHBOARD_INBOUND_URL", env("DASHBOARD_API_URL")),
    apiKey: env("DASHBOARD_API_KEY"),
    clientId: env("DASHBOARD_CLIENT_ID"),
    leadUrl: env("DASHBOARD_LEAD_URL", "https://real-estate-automation-backend.vercel.app/api/make/lf/leads"),
  },
};

export function getAgents(): AgentConfig[] {
  const agents: AgentConfig[] = [];
  if (config.retell.outboundAgentId) {
    agents.push({
      id: "outbound",
      label: "Outbound — Adrian (Connector)",
      retellAgentId: config.retell.outboundAgentId,
      direction: "outbound",
    });
  }
  if (config.retell.inboundAgentId) {
    agents.push({
      id: "inbound",
      label: "Inbound — Adrian (Trusted Advisor)",
      retellAgentId: config.retell.inboundAgentId,
      direction: "inbound",
    });
  }
  return agents;
}

export function configStatus() {
  return {
    retellApiKey: Boolean(config.retell.apiKey),
    retellFromNumber: config.retell.fromNumber || null,
    inboundAgentId: config.retell.inboundAgentId || null,
    outboundAgentId: config.retell.outboundAgentId || null,
    twilioConfigured: Boolean(config.twilio.accountSid && config.twilio.authToken),
    twilioMessaging: config.twilio.messagingServiceSid || config.twilio.fromNumber || null,
    extractionProvider: config.extraction.provider,
    openaiKey: Boolean(config.extraction.openaiApiKey),
    openaiModel: config.extraction.openaiModel,
    deepseekKey: Boolean(config.extraction.deepseekApiKey),
    deepseekModel: config.extraction.deepseekModel,
    calendarConfigured: Boolean(
      config.calendar.calendarId &&
        config.calendar.serviceAccountEmail &&
        config.calendar.privateKey
    ),
    calendarId: config.calendar.calendarId || null,
    timezone: config.timezone,
    dashboardForwarding: Boolean(config.dashboard.url),
    smsWaitSec: config.workflow.smsWaitSec,
  };
}
