"use client";

import { useCallback, useEffect, useState } from "react";

interface ClientOption {
  id: string;
  name: string;
  is_default: number;
}

export default function ClientSwitcher() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      const list: ClientOption[] = data.clients ?? [];
      setClients(list);
      setActiveId(data.activeId || list.find((c) => c.is_default)?.id || list[0]?.id || "");
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onChange(id: string) {
    setActiveId(id);
    await fetch("/api/clients/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface2 px-2.5 py-2 text-[11px] text-muted">
        Loading clients…
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface2/60 px-2.5 py-2 text-[11px] text-muted">
        No clients yet. Add one under Clients.
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
        Active client
      </label>
      <select
        className="input py-1.5 text-[13px]"
        value={activeId}
        onChange={(e) => onChange(e.target.value)}
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.is_default ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
