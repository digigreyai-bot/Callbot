export type CallDirection = "inbound" | "outbound" | "web";

export interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  property_interested_in: string | null;
  created_at: string;
}

export interface CallRow {
  id: number;
  retell_call_id: string;
  lead_id: number | null;
  direction: CallDirection;
  agent_id: string | null;
  status: string;
  transcript: string | null;
  recording_url: string | null;
  duration_sec: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractionRow {
  call_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  appointment_time: string | null;
  property_interested_in: string | null;
  summary: string | null;
  raw_json: string | null;
}

export interface CallWithDetails extends CallRow {
  lead: Lead | null;
  extraction: ExtractionRow | null;
}

/* ── Workflows (replaces Make.com scenarios) ── */

export type WorkflowType = "lead_flow_sms" | "outbound_campaign" | "direct_retell_call";

export type WorkflowStatus =
  | "pending"
  | "running"
  | "waiting_reply"
  | "waiting_delay"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowRow {
  id: number;
  type: WorkflowType;
  lead_id: number;
  status: WorkflowStatus;
  current_step: string | null;
  context_json: string | null;
  next_run_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepRow {
  id: number;
  workflow_id: number;
  step_key: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
  detail: string | null;
  created_at: string;
}

export type SmsDeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "received"
  | "unknown";

export interface SmsMessageRow {
  id: number;
  workflow_id: number | null;
  lead_id: number;
  direction: "outbound" | "inbound";
  body: string;
  twilio_sid: string | null;
  status: SmsDeliveryStatus;
  from_number: string | null;
  to_number: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ScheduledCallbackRow {
  id: number;
  workflow_id: number;
  lead_id: number;
  scheduled_at: string;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
}

export interface WorkflowWithDetails extends WorkflowRow {
  lead: Lead;
  steps: WorkflowStepRow[];
  sms_messages: SmsMessageRow[];
  scheduled_callback: ScheduledCallbackRow | null;
}
