/** Small client-safe formatting helpers (no node-only imports). */

export function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusTone(status: string): { label: string; className: string } {
  switch (status) {
    case "ended":
      return { label: "Ended", className: "bg-success/15 text-success" };
    case "ongoing":
      return { label: "Ongoing", className: "bg-accent/15 text-accent" };
    case "registered":
      return { label: "Ringing", className: "bg-warn/15 text-warn" };
    case "error":
    case "not_connected":
      return { label: status === "error" ? "Error" : "No answer", className: "bg-danger/15 text-danger" };
    default:
      return { label: status || "—", className: "bg-muted/15 text-muted" };
  }
}

export function directionLabel(d: string): string {
  if (d === "web") return "Web";
  if (d === "inbound") return "Inbound";
  return "Outbound";
}
