/**
 * Structured execution logging.
 *
 * Hackathon-critical: judging asks for "agent execution logs, API usage records"
 * as evidence that AI runs in production continuously. Every AI call and agent
 * decision emits one JSON line here so we can later export the evidence trail.
 */

export type LogEvent =
  | "message_in"
  | "intent_classified"
  | "static_answer"
  | "engine_call"
  | "ai_call"
  | "ai_error"
  | "message_out"
  | "consent_blocked";

export interface LogRecord {
  ts: string;
  event: LogEvent;
  userId?: string;
  [key: string]: unknown;
}

type Sink = (record: LogRecord) => void;

const jsonSink: Sink = (record) => {
  // One JSON object per line — trivially exportable to the evidence package.
  console.log(JSON.stringify(record));
};

let sink: Sink = jsonSink;

/** Swap the sink in tests (or to ship logs to Firestore/BigQuery later). */
export function setLogSink(next: Sink): void {
  sink = next;
}

export function logEvent(event: LogEvent, data: Omit<LogRecord, "ts" | "event"> = {}): void {
  sink({ ts: new Date().toISOString(), event, ...data });
}
