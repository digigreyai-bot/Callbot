"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { applyIdentity, extractIdentity, type AgentIdentity } from "@/lib/agentIdentity";

const IDENTITY_FIELDS: { key: keyof AgentIdentity; label: string; header: string }[] = [
  { key: "agentName", label: "Agent name", header: "agent_name" },
  { key: "companyName", label: "Company name", header: "company_name" },
  { key: "knowledgeBase", label: "Knowledge base", header: "knowledge_base" },
];

interface AgentScript {
  agentId: string;
  direction: "inbound" | "outbound";
  label: string;
  agentName: string | null;
  voiceId: string | null;
  language: string | null;
  isPublished: boolean | null;
  llmId: string | null;
  generalPrompt: string | null;
  beginMessage: string | null;
  toolNames: string[];
  dynamicVars: string[];
  error?: string;
}

export default function AgentsPage() {
  const [scripts, setScripts] = useState<AgentScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftBegin, setDraftBegin] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [draftIdentity, setDraftIdentity] = useState<AgentIdentity>({
    agentName: "",
    companyName: "",
    knowledgeBase: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/agents/scripts", { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Failed to load");
    setScripts(d.scripts ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  async function patchScript(s: AgentScript, generalPrompt: string, beginMessage: string | null) {
    const res = await fetch("/api/agents/scripts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: s.agentId, generalPrompt, beginMessage }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    setScripts(data.scripts ?? []);
  }

  function startIdentity(s: AgentScript) {
    setIdentityId(s.agentId);
    setDraftIdentity(extractIdentity(s.generalPrompt));
    setEditingId(null);
    setSaveMsg(null);
    setError(null);
  }

  async function saveIdentity(s: AgentScript) {
    const current = extractIdentity(s.generalPrompt);
    const missing = IDENTITY_FIELDS.filter(
      (f) => !current[f.key] && draftIdentity[f.key].trim()
    );
    if (missing.length > 0) {
      setError(
        `Script is missing the header line ${missing
          .map((f) => `{{${f.header}}}: …`)
          .join(", ")} so the old value can't be found. Add it via Edit first.`
      );
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const prompt = applyIdentity(s.generalPrompt ?? "", current, draftIdentity);
      const begin = s.beginMessage == null ? null : applyIdentity(s.beginMessage, current, draftIdentity);
      await patchScript(s, prompt, begin);
      setIdentityId(null);
      setSaveMsg(`Updated identity for ${s.agentName || s.label} across the whole script`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: AgentScript) {
    setIdentityId(null);
    setEditingId(s.agentId);
    setDraftPrompt(s.generalPrompt ?? "");
    setDraftBegin(s.beginMessage ?? "");
    setSaveMsg(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftPrompt("");
    setDraftBegin("");
  }

  async function saveEdit(s: AgentScript) {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      await patchScript(s, draftPrompt, draftBegin);
      setEditingId(null);
      setSaveMsg(`Saved ${s.agentName || s.label}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Agents & Scripts"
        subtitle="View and edit Retell inbound/outbound scripts here — no Retell dashboard needed."
      />

      {loading && <p className="text-sm text-muted">Loading agent scripts…</p>}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {saveMsg && (
        <div className="mb-4 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {saveMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {scripts.map((s) => {
          const editing = editingId === s.agentId;
          return (
            <article key={s.agentId} className="card flex flex-col p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">{s.direction}</p>
                  <h2 className="text-lg font-semibold text-white">{s.agentName || s.label}</h2>
                  <p className="mt-1 text-xs text-muted">{s.label}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`badge ${
                      s.isPublished ? "bg-success/20 text-success" : "bg-warn/20 text-warn"
                    }`}
                  >
                    {s.isPublished ? "Published" : "Draft"}
                  </span>
                  {!s.error && !editing && (
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => startEdit(s)}>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Agent ID</dt>
                  <dd className="break-all text-white/90">{s.agentId}</dd>
                </div>
                <div>
                  <dt className="text-muted">Voice</dt>
                  <dd className="text-white/90">{s.voiceId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Language</dt>
                  <dd className="text-white/90">{s.language || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted">LLM</dt>
                  <dd className="break-all text-white/90">{s.llmId || "—"}</dd>
                </div>
              </dl>

              {!s.error && (
                <div className="mb-4 rounded-xl border border-border bg-surface2/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-white/80">Identity</p>
                    {identityId !== s.agentId && (
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1 text-xs"
                        disabled={editing}
                        onClick={() => startIdentity(s)}
                      >
                        Change
                      </button>
                    )}
                  </div>
                  {identityId === s.agentId ? (
                    <div className="space-y-2">
                      {IDENTITY_FIELDS.map((f) => (
                        <div key={f.key}>
                          <label className="label">{f.label}</label>
                          <input
                            className="input text-sm"
                            value={draftIdentity[f.key]}
                            onChange={(e) =>
                              setDraftIdentity((d) => ({ ...d, [f.key]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                      <p className="text-[11px] text-muted">
                        Replaces every occurrence in the script and begin message. The knowledge base
                        name is text only; the attached Retell knowledge base does not change.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary flex-1"
                          disabled={saving || !draftIdentity.agentName.trim()}
                          onClick={() => saveIdentity(s)}
                        >
                          {saving ? "Saving…" : "Save to Retell"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost flex-1"
                          disabled={saving}
                          onClick={() => setIdentityId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const id = extractIdentity(s.generalPrompt);
                      return (
                        <dl className="grid grid-cols-3 gap-2 text-xs">
                          {IDENTITY_FIELDS.map((f) => (
                            <div key={f.key}>
                              <dt className="text-muted">{f.label}</dt>
                              <dd className="break-all text-white/90">{id[f.key] || "—"}</dd>
                            </div>
                          ))}
                        </dl>
                      );
                    })()
                  )}
                </div>
              )}

              {s.toolNames.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs text-muted">Tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.toolNames.map((t) => (
                      <span key={t} className="badge bg-surface2 text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {s.dynamicVars.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs text-muted">Dynamic variables in script</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.dynamicVars.map((v) => (
                      <span key={v} className="badge bg-primary/15 text-primary">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {s.error ? (
                <p className="text-sm text-danger">{s.error}</p>
              ) : editing ? (
                <div className="mt-auto space-y-3">
                  <div>
                    <label className="label">Begin message (first words)</label>
                    <input
                      className="input text-sm"
                      value={draftBegin}
                      onChange={(e) => setDraftBegin(e.target.value)}
                      placeholder="Hello, this is Adrian…"
                    />
                  </div>
                  <div>
                    <label className="label">Script</label>
                    <textarea
                      className="input min-h-[360px] font-mono text-[11px] leading-relaxed"
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      disabled={saving || !draftPrompt.trim()}
                      onClick={() => saveEdit(s)}
                    >
                      {saving ? "Saving…" : "Save to Retell"}
                    </button>
                    <button type="button" className="btn-ghost flex-1" disabled={saving} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-auto space-y-3">
                  {s.beginMessage && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-white/80">Begin message</p>
                      <p className="rounded-xl border border-border bg-surface2/80 px-3 py-2 text-xs text-white/85">
                        {s.beginMessage}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-white/80">Script</p>
                    <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface2/80 p-4 text-[11px] leading-relaxed text-white/85">
                      {s.generalPrompt || "No prompt found for this agent."}
                    </pre>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!loading && scripts.length === 0 && (
        <p className="text-sm text-muted">
          No agents configured. Set RETELL_INBOUND_AGENT_ID and RETELL_OUTBOUND_AGENT_ID in .env.
        </p>
      )}
    </div>
  );
}
