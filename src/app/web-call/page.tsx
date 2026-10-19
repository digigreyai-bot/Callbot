"use client";

import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import PageHeader from "@/components/PageHeader";

interface AgentOption {
  id: string;
  label: string;
  direction: string;
}

type CallState = "idle" | "connecting" | "active" | "ended";

interface TranscriptTurn {
  role: string;
  content: string;
}

export default function WebCallPage() {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [property, setProperty] = useState("");
  const [state, setState] = useState<CallState>("idle");
  const [agentTalking, setAgentTalking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  const clientRef = useRef<RetellWebClient | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => {
        const list: AgentOption[] = d.agents ?? [];
        setAgents(list);
        const preferred = list.find((a) => a.direction === "inbound") ?? list[0];
        if (preferred) setAgentId(preferred.id);
      })
      .catch(() => setAgents([]));

    return () => {
      clientRef.current?.stopCall();
    };
  }, []);

  async function startCall() {
    setError(null);
    setTranscript([]);
    setState("connecting");
    try {
      const res = await fetch("/api/calls/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, name, property }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start web call.");
      setCallId(data.callId);

      const client = new RetellWebClient();
      clientRef.current = client;

      client.on("call_started", () => setState("active"));
      client.on("call_ready", () => setState("active"));
      client.on("agent_start_talking", () => setAgentTalking(true));
      client.on("agent_stop_talking", () => setAgentTalking(false));
      client.on("update", (update: { transcript?: TranscriptTurn[] }) => {
        if (update?.transcript) setTranscript([...update.transcript]);
      });
      client.on("call_ended", () => {
        setState("ended");
        setAgentTalking(false);
      });
      client.on("error", (err: unknown) => {
        setError(typeof err === "string" ? err : "A call error occurred.");
        client.stopCall();
        setState("ended");
      });

      await client.startCall({ accessToken: data.accessToken });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start web call.");
      setState("idle");
    }
  }

  function endCall() {
    clientRef.current?.stopCall();
    setState("ended");
    setAgentTalking(false);
  }

  const isLive = state === "active" || state === "connecting";

  return (
    <div>
      <PageHeader
        title="Web Call (Browser Mic)"
        subtitle="Talk to your agent live through your microphone — great for testing the script."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="card space-y-5 p-6">
          <div>
            <label className="label">Agent</label>
            <select
              className="input"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={isLive}
            >
              {agents.length === 0 && <option value="">No agents configured</option>}
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Your Name (optional)</label>
            <input
              className="input"
              placeholder="e.g. Bilal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLive}
            />
          </div>
          <div>
            <label className="label">Property (optional)</label>
            <input
              className="input"
              placeholder="e.g. villa"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              disabled={isLive}
            />
          </div>

          <div className="flex flex-col items-center gap-4 pt-2">
            <div
              className={`grid h-28 w-28 place-items-center rounded-full transition ${
                state === "active"
                  ? agentTalking
                    ? "bg-accent/20 ring-4 ring-accent/40 animate-pulse"
                    : "bg-primary/20 ring-4 ring-primary/40"
                  : "bg-surface2 ring-1 ring-border"
              }`}
            >
              <MicGlyph className="h-12 w-12 text-white" />
            </div>
            <p className="text-sm font-medium text-muted">
              {state === "idle" && "Ready to connect"}
              {state === "connecting" && "Connecting…"}
              {state === "active" && (agentTalking ? "Agent is speaking…" : "Listening…")}
              {state === "ended" && "Call ended"}
            </p>

            {!isLive ? (
              <button className="btn-primary w-full" onClick={startCall} disabled={!agentId}>
                Start web call
              </button>
            ) : (
              <button className="btn-danger w-full" onClick={endCall}>
                End call
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          {state === "ended" && callId && (
            <p className="text-center text-xs text-muted">
              Call saved. Open the dashboard to view the synced transcript and extraction.
            </p>
          )}
        </div>

        <div className="card flex flex-col p-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Live Transcript</h3>
          <div className="min-h-[320px] flex-1 space-y-3 overflow-y-auto">
            {transcript.length === 0 ? (
              <p className="text-sm text-muted">The conversation will appear here once the call starts.</p>
            ) : (
              transcript.map((turn, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    turn.role === "agent"
                      ? "bg-surface2 text-white"
                      : "ml-auto bg-primary/20 text-white"
                  }`}
                >
                  <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {turn.role === "agent" ? "Agent" : "You"}
                  </p>
                  {turn.content}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MicGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}
