"use client";

import { useEffect, useState } from "react";

interface ClientOption {
  id: string;
  name: string;
  is_default: number;
}

/** Form select bound to active client cookie; optional override via onChange. */
export default function ClientSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => {
        const list: ClientOption[] = d.clients ?? [];
        setClients(list);
        if (!value) {
          const preferred = d.activeId || list.find((c) => c.is_default)?.id || list[0]?.id || "";
          if (preferred) onChange(preferred);
        }
      })
      .catch(() => setClients([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (clients.length === 0) {
    return (
      <p className="text-xs text-muted">
        No clients configured — dashboard uses .env defaults. Add clients under Clients.
      </p>
    );
  }

  return (
    <div>
      <label className="label">Client</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
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
