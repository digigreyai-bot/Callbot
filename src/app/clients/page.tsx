"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";

interface ClientItem {
  id: string;
  name: string;
  dashboard_client_id: string;
  dashboard_api_key: string | null;
  has_api_key?: boolean;
  calendar_id: string | null;
  is_default: number;
}

const emptyForm = {
  id: "",
  name: "",
  dashboard_client_id: "",
  dashboard_api_key: "",
  calendar_id: "",
  is_default: false,
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/clients");
    const data = await res.json();
    setClients(data.clients ?? []);
  }, []);

  useEffect(() => {
    load().catch(() => setClients([]));
  }, [load]);

  function startEdit(c: ClientItem) {
    setEditing(true);
    setForm({
      id: c.id,
      name: c.name,
      dashboard_client_id: c.dashboard_client_id,
      dashboard_api_key: "",
      calendar_id: c.calendar_id || "",
      is_default: Boolean(c.is_default),
    });
    setError(null);
    setOk(null);
  }

  function startNew() {
    setEditing(false);
    setForm(emptyForm);
    setError(null);
    setOk(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/clients", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing ? form.id : undefined,
          name: form.name,
          dashboard_client_id: form.dashboard_client_id,
          dashboard_api_key: form.dashboard_api_key || undefined,
          calendar_id: form.calendar_id || null,
          is_default: form.is_default,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setOk(editing ? "Client updated." : "Client created.");
      startNew();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this client?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await load();
      if (form.id === id) startNew();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    await fetch("/api/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, set_default: true }),
    });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="One shared Retell number — each client has its own Agent Assist ID, API key, and Google Calendar."
        action={
          <button type="button" className="btn-ghost" onClick={startNew}>
            New client
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface2/80 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Client ID</th>
                <th className="px-4 py-3">Calendar</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No clients yet. Add one with your Agent Assist client ID.
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{c.name}</p>
                    {c.is_default ? (
                      <span className="badge mt-1 bg-primary/15 text-primary">Default</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{c.dashboard_client_id}</td>
                  <td className="px-4 py-3 text-xs text-muted">{c.calendar_id || "— env —"}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => startEdit(c)}>
                      Edit
                    </button>
                    {!c.is_default && (
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => makeDefault(c.id)}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs text-danger"
                      onClick={() => remove(c.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={save} className="card space-y-4 p-6">
          <h3 className="text-sm font-semibold text-ink">{editing ? "Edit client" : "Add client"}</h3>
          <div>
            <label className="label">Display name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Realty"
              required
            />
          </div>
          <div>
            <label className="label">Agent Assist Client ID</label>
            <input
              className="input font-mono text-xs"
              value={form.dashboard_client_id}
              onChange={(e) => setForm({ ...form, dashboard_client_id: e.target.value })}
              placeholder="x-client-id value"
              required
            />
          </div>
          <div>
            <label className="label">API key {editing ? "(leave blank to keep)" : "(optional)"}</label>
            <input
              className="input font-mono text-xs"
              type="password"
              value={form.dashboard_api_key}
              onChange={(e) => setForm({ ...form, dashboard_api_key: e.target.value })}
              placeholder={editing ? "•••• keep existing" : "Falls back to DASHBOARD_API_KEY"}
            />
          </div>
          <div>
            <label className="label">Google Calendar ID</label>
            <input
              className="input font-mono text-xs"
              value={form.calendar_id}
              onChange={(e) => setForm({ ...form, calendar_id: e.target.value })}
              placeholder="Falls back to GOOGLE_CALENDAR_ID"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            Set as default (inbound + fallback)
          </label>
          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          {ok && (
            <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
              {ok}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : editing ? "Update client" : "Add client"}
          </button>
        </form>
      </div>
    </div>
  );
}
