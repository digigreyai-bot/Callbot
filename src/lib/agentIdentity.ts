export interface AgentIdentity {
  agentName: string;
  companyName: string;
  knowledgeBase: string;
}

const HEADER_KEYS: Record<keyof AgentIdentity, string> = {
  agentName: "agent_name",
  companyName: "company_name",
  knowledgeBase: "knowledge_base",
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Reads values from header lines like `{{agent_name}}: Adrian`. */
export function extractIdentity(prompt: string | null | undefined): AgentIdentity {
  const text = prompt ?? "";
  const read = (key: string) => {
    const m = text.match(new RegExp(`^\\s*\\{\\{${key}\\}\\}\\s*:\\s*(.+?)\\s*$`, "m"));
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
  };
  return {
    agentName: read(HEADER_KEYS.agentName),
    companyName: read(HEADER_KEYS.companyName),
    knowledgeBase: read(HEADER_KEYS.knowledgeBase),
  };
}

/** Case-insensitive, whole-word replacement of each changed identity value. */
export function applyIdentity(
  text: string,
  from: AgentIdentity,
  to: AgentIdentity
): string {
  let out = text;
  for (const key of Object.keys(HEADER_KEYS) as (keyof AgentIdentity)[]) {
    const oldVal = from[key].trim();
    const newVal = to[key].trim();
    if (!oldVal || !newVal || oldVal === newVal) continue;
    const re = new RegExp(`(?<![\\w])${escapeRegex(oldVal)}(?![\\w])`, "gi");
    out = out.replace(re, () => newVal);
  }
  return out;
}
