import PageHeader from "@/components/PageHeader";
import { configStatus } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const s = configStatus();

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configuration is read from your .env file. Edit .env and restart the dev server to change these."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Retell AI</h3>
          <dl className="space-y-3 text-sm">
            <Row label="API key" ok={s.retellApiKey} />
            <Row label="From number" value={s.retellFromNumber} ok={Boolean(s.retellFromNumber)} />
            <Row label="Inbound agent" value={s.inboundAgentId} ok={Boolean(s.inboundAgentId)} />
            <Row label="Outbound agent" value={s.outboundAgentId} ok={Boolean(s.outboundAgentId)} />
          </dl>
        </section>

        <section className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">LLM Extraction</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Provider" value={s.extractionProvider} ok />
            <Row
              label="OpenAI"
              value={s.openaiKey ? s.openaiModel : "no key"}
              ok={s.extractionProvider !== "openai" || s.openaiKey}
            />
            <Row
              label="DeepSeek"
              value={s.deepseekKey ? s.deepseekModel : "no key"}
              ok={s.extractionProvider !== "deepseek" || s.deepseekKey}
            />
            <Row label="Timezone" value={s.timezone} ok />
          </dl>
        </section>

        <section className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Twilio SMS</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Account configured" ok={s.twilioConfigured} />
            <Row label="Messaging / From" value={s.twilioMessaging} ok={Boolean(s.twilioMessaging)} />
            <Row label="SMS wait (campaign)" value={`${s.smsWaitSec}s`} ok />
          </dl>
        </section>

        <section className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Google Calendar</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Configured" ok={s.calendarConfigured} />
            <Row label="Calendar ID" value={s.calendarId} ok={Boolean(s.calendarId)} />
          </dl>
        </section>

        <section className="card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-white">Optional dashboard forwarding</h3>
          <dl className="space-y-3 text-sm">
            <Row
              label="External dashboard POST"
              value={s.dashboardForwarding ? "enabled" : "disabled (local only)"}
              ok
            />
          </dl>
          <p className="mt-4 text-xs text-muted">
            Set <code className="text-white/80">DASHBOARD_API_URL</code> in .env to also forward each
            extracted call to an external dashboard (replicates the old Make.com HTTP POST).
          </p>
        </section>
      </div>

        <section className="card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-white">Webhooks (copy to Make.com replacements)</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <WebhookRow label="Retell (inbound + outbound)" path="/api/webhooks/retell" />
            <WebhookRow label="CRM lead trigger (Bismillah)" path="/api/webhooks/lead" />
            <WebhookRow label="Twilio inbound SMS" path="/api/webhooks/twilio/sms" />
            <WebhookRow label="Telnyx scheduled callback" path="/api/webhooks/telnyx" />
          </div>
        </section>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value?: string | null; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-2 text-right font-medium text-white">
        {value && <span className="text-xs text-muted">{value}</span>}
        <span className={`badge ${ok ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
          {ok ? "OK" : "Missing"}
        </span>
      </dd>
    </div>
  );
}

function WebhookRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface2/60 p-3">
      <p className="text-xs font-medium text-white mb-1">{label}</p>
      <code className="text-[10px] text-accent break-all">{"<host>"}{path}</code>
    </div>
  );
}
