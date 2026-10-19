import { statusTone } from "@/lib/format";

export default function StatusBadge({ status }: { status: string }) {
  const { label, className } = statusTone(status);
  return <span className={`badge ${className}`}>{label}</span>;
}
