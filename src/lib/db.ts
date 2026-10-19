import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  CallRow,
  CallWithDetails,
  ExtractionRow,
  Lead,
  ScheduledCallbackRow,
  SmsMessageRow,
  WorkflowRow,
  WorkflowStatus,
  WorkflowStepRow,
  WorkflowType,
  WorkflowWithDetails,
} from "./types";

/**
 * Zero-setup local persistence using SQLite (better-sqlite3).
 * The DB file lives in ./data/app.db and is created on first run.
 * A singleton is cached on globalThis to survive Next.js dev hot-reloads.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

const globalForDb = globalThis as unknown as { __callBotDb?: Database.Database };

function createDb(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT,
      property_interested_in TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      retell_call_id TEXT NOT NULL UNIQUE,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      direction TEXT NOT NULL DEFAULT 'outbound',
      agent_id TEXT,
      status TEXT NOT NULL DEFAULT 'registered',
      transcript TEXT,
      recording_url TEXT,
      duration_sec INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS extractions (
      call_id INTEGER PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
      name TEXT,
      email TEXT,
      phone TEXT,
      appointment_time TEXT,
      property_interested_in TEXT,
      summary TEXT,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at DESC);

    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      current_step TEXT,
      context_json TEXT,
      next_run_at TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sms_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      body TEXT NOT NULL,
      twilio_sid TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      from_number TEXT,
      to_number TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS scheduled_callbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status, next_run_at);
    CREATE INDEX IF NOT EXISTS idx_workflow_steps_wf ON workflow_steps(workflow_id);
  `);

  ensureColumn(db, "sms_messages", "status", "TEXT NOT NULL DEFAULT 'queued'");
  ensureColumn(db, "sms_messages", "from_number", "TEXT");
  ensureColumn(db, "sms_messages", "to_number", "TEXT");
  ensureColumn(db, "sms_messages", "error_message", "TEXT");
  ensureColumn(db, "sms_messages", "updated_at", "TEXT");
}

function ensureColumn(database: Database.Database, table: string, column: string, ddl: string) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

export function db(): Database.Database {
  if (!globalForDb.__callBotDb) globalForDb.__callBotDb = createDb();
  return globalForDb.__callBotDb;
}

/* ───────────────────────────── Leads ───────────────────────────── */

export function createLead(input: {
  name: string;
  phone: string;
  email?: string | null;
  property_interested_in?: string | null;
}): Lead {
  const stmt = db().prepare(
    `INSERT INTO leads (name, phone, email, property_interested_in)
     VALUES (@name, @phone, @email, @property_interested_in)`
  );
  const info = stmt.run({
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    property_interested_in: input.property_interested_in ?? null,
  });
  return db().prepare(`SELECT * FROM leads WHERE id = ?`).get(info.lastInsertRowid) as Lead;
}

/* ───────────────────────────── Calls ───────────────────────────── */

export function createCall(input: {
  retell_call_id: string;
  lead_id?: number | null;
  direction: string;
  agent_id?: string | null;
  status?: string;
}): CallRow {
  const stmt = db().prepare(
    `INSERT INTO calls (retell_call_id, lead_id, direction, agent_id, status)
     VALUES (@retell_call_id, @lead_id, @direction, @agent_id, @status)
     ON CONFLICT(retell_call_id) DO UPDATE SET
       direction = excluded.direction,
       agent_id = COALESCE(excluded.agent_id, calls.agent_id),
       updated_at = datetime('now')`
  );
  stmt.run({
    retell_call_id: input.retell_call_id,
    lead_id: input.lead_id ?? null,
    direction: input.direction,
    agent_id: input.agent_id ?? null,
    status: input.status ?? "registered",
  });
  return getCallByRetellId(input.retell_call_id)!;
}

export function updateCallFromRetell(
  retellCallId: string,
  fields: {
    status?: string;
    transcript?: string | null;
    recording_url?: string | null;
    duration_sec?: number | null;
    agent_id?: string | null;
  }
): CallRow | undefined {
  const existing = getCallByRetellId(retellCallId);
  if (!existing) return undefined;
  db()
    .prepare(
      `UPDATE calls SET
         status = COALESCE(@status, status),
         transcript = COALESCE(@transcript, transcript),
         recording_url = COALESCE(@recording_url, recording_url),
         duration_sec = COALESCE(@duration_sec, duration_sec),
         agent_id = COALESCE(@agent_id, agent_id),
         updated_at = datetime('now')
       WHERE retell_call_id = @retell_call_id`
    )
    .run({
      retell_call_id: retellCallId,
      status: fields.status ?? null,
      transcript: fields.transcript ?? null,
      recording_url: fields.recording_url ?? null,
      duration_sec: fields.duration_sec ?? null,
      agent_id: fields.agent_id ?? null,
    });
  return getCallByRetellId(retellCallId);
}

export function getCallByRetellId(retellCallId: string): CallRow | undefined {
  return db().prepare(`SELECT * FROM calls WHERE retell_call_id = ?`).get(retellCallId) as
    | CallRow
    | undefined;
}

export function getCallById(id: number): CallRow | undefined {
  return db().prepare(`SELECT * FROM calls WHERE id = ?`).get(id) as CallRow | undefined;
}

export function listCalls(limit = 100): CallWithDetails[] {
  const rows = db()
    .prepare(`SELECT * FROM calls ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as CallRow[];
  return rows.map(hydrate);
}

export function getCallWithDetails(id: number): CallWithDetails | undefined {
  const call = getCallById(id);
  return call ? hydrate(call) : undefined;
}

function hydrate(call: CallRow): CallWithDetails {
  const lead = call.lead_id
    ? (db().prepare(`SELECT * FROM leads WHERE id = ?`).get(call.lead_id) as Lead | undefined) ??
      null
    : null;
  const extraction =
    (db().prepare(`SELECT * FROM extractions WHERE call_id = ?`).get(call.id) as
      | ExtractionRow
      | undefined) ?? null;
  return { ...call, lead, extraction };
}

/* ──────────────────────────── Extractions ──────────────────────── */

export function upsertExtraction(input: ExtractionRow): ExtractionRow {
  db()
    .prepare(
      `INSERT INTO extractions (call_id, name, email, phone, appointment_time, property_interested_in, summary, raw_json)
       VALUES (@call_id, @name, @email, @phone, @appointment_time, @property_interested_in, @summary, @raw_json)
       ON CONFLICT(call_id) DO UPDATE SET
         name = excluded.name,
         email = excluded.email,
         phone = excluded.phone,
         appointment_time = excluded.appointment_time,
         property_interested_in = excluded.property_interested_in,
         summary = excluded.summary,
         raw_json = excluded.raw_json`
    )
    .run({
      call_id: input.call_id,
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      appointment_time: input.appointment_time ?? null,
      property_interested_in: input.property_interested_in ?? null,
      summary: input.summary ?? null,
      raw_json: input.raw_json ?? null,
    });
  return db().prepare(`SELECT * FROM extractions WHERE call_id = ?`).get(input.call_id) as ExtractionRow;
}

/* ──────────────────────────── Stats ────────────────────────────── */

/* ─────────────────────────── Workflows ─────────────────────────── */

export function createWorkflow(input: {
  type: WorkflowType;
  lead_id: number;
  context?: Record<string, unknown>;
}): WorkflowRow {
  const info = db()
    .prepare(
      `INSERT INTO workflows (type, lead_id, status, context_json)
       VALUES (@type, @lead_id, 'pending', @context_json)`
    )
    .run({
      type: input.type,
      lead_id: input.lead_id,
      context_json: input.context ? JSON.stringify(input.context) : null,
    });
  return db().prepare(`SELECT * FROM workflows WHERE id = ?`).get(info.lastInsertRowid) as WorkflowRow;
}

export function updateWorkflow(
  id: number,
  fields: Partial<{
    status: WorkflowStatus;
    current_step: string | null;
    context_json: string | null;
    next_run_at: string | null;
    error: string | null;
  }>
) {
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: Record<string, unknown> = { id };
  if (fields.status !== undefined) {
    sets.push("status = @status");
    params.status = fields.status;
  }
  if (fields.current_step !== undefined) {
    sets.push("current_step = @current_step");
    params.current_step = fields.current_step;
  }
  if (fields.context_json !== undefined) {
    sets.push("context_json = @context_json");
    params.context_json = fields.context_json;
  }
  if (fields.next_run_at !== undefined) {
    sets.push("next_run_at = @next_run_at");
    params.next_run_at = fields.next_run_at;
  }
  if (fields.error !== undefined) {
    sets.push("error = @error");
    params.error = fields.error;
  }
  db().prepare(`UPDATE workflows SET ${sets.join(", ")} WHERE id = @id`).run(params);
}

export function getWorkflowContext(id: number): Record<string, unknown> {
  const row = db().prepare(`SELECT context_json FROM workflows WHERE id = ?`).get(id) as
    | { context_json: string | null }
    | undefined;
  if (!row?.context_json) return {};
  try {
    return JSON.parse(row.context_json);
  } catch {
    return {};
  }
}

export function setWorkflowContext(id: number, ctx: Record<string, unknown>) {
  updateWorkflow(id, { context_json: JSON.stringify(ctx) });
}

export function addWorkflowStep(
  workflowId: number,
  stepKey: string,
  label: string,
  status: WorkflowStepRow["status"],
  detail?: string
): WorkflowStepRow {
  const info = db()
    .prepare(
      `INSERT INTO workflow_steps (workflow_id, step_key, label, status, detail)
       VALUES (@workflow_id, @step_key, @label, @status, @detail)`
    )
    .run({
      workflow_id: workflowId,
      step_key: stepKey,
      label,
      status,
      detail: detail ?? null,
    });
  return db()
    .prepare(`SELECT * FROM workflow_steps WHERE id = ?`)
    .get(info.lastInsertRowid) as WorkflowStepRow;
}

export function listWorkflows(limit = 50): WorkflowWithDetails[] {
  const rows = db()
    .prepare(`SELECT * FROM workflows ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as WorkflowRow[];
  return rows.map(hydrateWorkflow);
}

export function getWorkflow(id: number): WorkflowWithDetails | undefined {
  const row = db().prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as WorkflowRow | undefined;
  return row ? hydrateWorkflow(row) : undefined;
}

export function listDueWorkflows(): WorkflowRow[] {
  return db()
    .prepare(
      `SELECT * FROM workflows
       WHERE status IN ('running', 'waiting_delay', 'waiting_reply')
         AND (next_run_at IS NULL OR next_run_at <= datetime('now'))
       ORDER BY next_run_at ASC`
    )
    .all() as WorkflowRow[];
}

function hydrateWorkflow(wf: WorkflowRow): WorkflowWithDetails {
  const lead = db().prepare(`SELECT * FROM leads WHERE id = ?`).get(wf.lead_id) as Lead;
  const steps = db()
    .prepare(`SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY id ASC`)
    .all(wf.id) as WorkflowStepRow[];
  const sms_messages = db()
    .prepare(`SELECT * FROM sms_messages WHERE workflow_id = ? ORDER BY id ASC`)
    .all(wf.id) as SmsMessageRow[];
  const scheduled_callback =
    (db()
      .prepare(`SELECT * FROM scheduled_callbacks WHERE workflow_id = ? ORDER BY id DESC LIMIT 1`)
      .get(wf.id) as ScheduledCallbackRow | undefined) ?? null;
  return { ...wf, lead, steps, sms_messages, scheduled_callback };
}

export function logSms(input: {
  workflow_id?: number | null;
  lead_id: number;
  direction: "outbound" | "inbound";
  body: string;
  twilio_sid?: string | null;
  status?: SmsMessageRow["status"];
  from_number?: string | null;
  to_number?: string | null;
  error_message?: string | null;
}): SmsMessageRow {
  const now = new Date().toISOString();
  const status =
    input.status ??
    (input.direction === "inbound" ? "received" : input.twilio_sid ? "queued" : "failed");
  const info = db()
    .prepare(
      `INSERT INTO sms_messages
         (workflow_id, lead_id, direction, body, twilio_sid, status, from_number, to_number, error_message, updated_at)
       VALUES
         (@workflow_id, @lead_id, @direction, @body, @twilio_sid, @status, @from_number, @to_number, @error_message, @updated_at)`
    )
    .run({
      workflow_id: input.workflow_id ?? null,
      lead_id: input.lead_id,
      direction: input.direction,
      body: input.body,
      twilio_sid: input.twilio_sid ?? null,
      status,
      from_number: input.from_number ?? null,
      to_number: input.to_number ?? null,
      error_message: input.error_message ?? null,
      updated_at: now,
    });
  return db().prepare(`SELECT * FROM sms_messages WHERE id = ?`).get(info.lastInsertRowid) as SmsMessageRow;
}

export function updateSmsStatus(
  id: number,
  input: {
    status: SmsMessageRow["status"];
    from_number?: string | null;
    to_number?: string | null;
    error_message?: string | null;
  }
): SmsMessageRow | undefined {
  db()
    .prepare(
      `UPDATE sms_messages SET
         status = @status,
         from_number = COALESCE(@from_number, from_number),
         to_number = COALESCE(@to_number, to_number),
         error_message = @error_message,
         updated_at = @updated_at
       WHERE id = @id`
    )
    .run({
      id,
      status: input.status,
      from_number: input.from_number ?? null,
      to_number: input.to_number ?? null,
      error_message: input.error_message ?? null,
      updated_at: new Date().toISOString(),
    });
  return db().prepare(`SELECT * FROM sms_messages WHERE id = ?`).get(id) as SmsMessageRow | undefined;
}

export function listSmsForWorkflow(workflowId: number): SmsMessageRow[] {
  return db()
    .prepare(`SELECT * FROM sms_messages WHERE workflow_id = ? ORDER BY id ASC`)
    .all(workflowId) as SmsMessageRow[];
}

export function saveScheduledCallback(input: {
  workflow_id: number;
  lead_id: number;
  scheduled_at: string;
  notes?: string | null;
}): ScheduledCallbackRow {
  const info = db()
    .prepare(
      `INSERT INTO scheduled_callbacks (workflow_id, lead_id, scheduled_at, notes)
       VALUES (@workflow_id, @lead_id, @scheduled_at, @notes)`
    )
    .run({
      workflow_id: input.workflow_id,
      lead_id: input.lead_id,
      scheduled_at: input.scheduled_at,
      notes: input.notes ?? null,
    });
  return db()
    .prepare(`SELECT * FROM scheduled_callbacks WHERE id = ?`)
    .get(info.lastInsertRowid) as ScheduledCallbackRow;
}

export function getLead(id: number): Lead | undefined {
  return db().prepare(`SELECT * FROM leads WHERE id = ?`).get(id) as Lead | undefined;
}

export function dashboardStats() {
  const totalCalls = (db().prepare(`SELECT COUNT(*) AS c FROM calls`).get() as { c: number }).c;
  const endedCalls = (
    db().prepare(`SELECT COUNT(*) AS c FROM calls WHERE status = 'ended'`).get() as { c: number }
  ).c;
  const booked = (
    db()
      .prepare(
        `SELECT COUNT(*) AS c FROM extractions WHERE appointment_time IS NOT NULL AND appointment_time != ''`
      )
      .get() as { c: number }
  ).c;
  const avgDuration = (
    db().prepare(`SELECT AVG(duration_sec) AS a FROM calls WHERE duration_sec IS NOT NULL`).get() as {
      a: number | null;
    }
  ).a;
  const activeWorkflows = (
    db()
      .prepare(
        `SELECT COUNT(*) AS c FROM workflows WHERE status IN ('running','waiting_delay','waiting_reply','pending')`
      )
      .get() as { c: number }
  ).c;
  const smsSentToday = (
    db()
      .prepare(
        `SELECT COUNT(*) AS c FROM sms_messages
         WHERE direction = 'outbound'
           AND date(created_at) = date('now')
           AND status IN ('queued','sending','sent','delivered')`
      )
      .get() as { c: number }
  ).c;
  const smsFailedToday = (
    db()
      .prepare(
        `SELECT COUNT(*) AS c FROM sms_messages
         WHERE direction = 'outbound'
           AND date(created_at) = date('now')
           AND status IN ('failed','undelivered')`
      )
      .get() as { c: number }
  ).c;
  return {
    totalCalls,
    endedCalls,
    booked,
    avgDurationSec: avgDuration ? Math.round(avgDuration) : 0,
    activeWorkflows,
    smsSentToday,
    smsFailedToday,
  };
}
