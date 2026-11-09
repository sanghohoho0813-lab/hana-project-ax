import "server-only";
import type { PilotClient } from "./supabase";
import type { DataKind, EventRow, ScheduleRow } from "./core";
import { kst } from "./time";

/** 관리자·현장 화면이 읽는 하루치 기록 — 로그인한 사용자 세션으로 읽으므로 RLS 가 보이는 범위를 정한다 */

export interface ScheduleView extends ScheduleRow {
  note: string | null;
  updated_at: string;
}

export interface StaffRow {
  id: string;
  display_name: string;
  role: "admin" | "field";
  active: boolean;
  email: string;
  created_at: string;
}

export const KIND_PARAM: Record<string, DataKind> = { real: "실제 업무", scenario: "검증 시나리오" };
export const kindParam = (k: DataKind) => (k === "실제 업무" ? "real" : "scenario");

export function parseDay(sp: { date?: string; kind?: string }): { date: string; kind: DataKind } {
  const today = kst(new Date()).date;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && !Number.isNaN(Date.parse(sp.date)) ? sp.date : today;
  return { date, kind: KIND_PARAM[sp.kind ?? ""] ?? "실제 업무" };
}

const SCHEDULE_COLS =
  "id, data_kind, work_date, assignee_id, site_name, region, planned_start, planned_end, travel_minutes, travel_from_id, priority, status, version, note, updated_at";
const EVENT_COLS =
  "seq, id, schedule_id, data_kind, work_date, kind, occurred_at, entered_time, expected_end, entry_mode, recorded_at, source, actor_id, voids_event_id, note";

export async function loadDay(sb: PilotClient, date: string, kind: DataKind) {
  const [s, e] = await Promise.all([
    sb.from("schedules").select(SCHEDULE_COLS).eq("work_date", date).eq("data_kind", kind).order("planned_start").order("id"),
    sb.from("work_events").select(EVENT_COLS).eq("work_date", date).eq("data_kind", kind).order("seq"),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (e.error) throw new Error(e.error.message);
  return { schedules: (s.data ?? []) as ScheduleView[], events: (e.data ?? []) as (EventRow & { note: string | null })[] };
}

export async function loadStaff(sb: PilotClient): Promise<StaffRow[]> {
  const { data, error } = await sb.from("profiles").select("id, display_name, role, active, email, created_at").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffRow[];
}

export async function pendingJobs(sb: PilotClient): Promise<number> {
  const { count } = await sb.from("judgment_jobs").select("id", { count: "exact", head: true }).eq("status", "대기");
  return count ?? 0;
}

/* ── 기록·판단 이력 (관리자) ─────────────────────────── */

export interface EventRecord {
  seq: number;
  id: string;
  schedule_id: string;
  kind: string;
  occurred_at: string;
  entered_time: string | null;
  expected_end: string | null;
  entry_mode: string;
  recorded_at: string;
  client_pressed_at: string | null;
  client_sent_at: string | null;
  send_delay_seconds: number | null;
  source: string;
  actor_id: string;
  voids_event_id: string | null;
  note: string | null;
}

export interface JudgmentListRow {
  id: string;
  seq: number;
  trigger_kind: string;
  trigger_ref: string;
  triggered_by: string;
  as_of: string;
  summary: import("./core").JudgmentSummary;
  rule_version: string;
  state_version: string;
  priority_version: string;
  app_version: string;
  payload_sha256: string;
  computed_at: string;
  recorded_at: string;
}

export interface RevisionRecord {
  seq: number;
  schedule_id: string;
  revision: number;
  change_kind: string;
  actor_id: string;
  recorded_at: string;
  snapshot: { site_name: string; planned_start: string; planned_end: string; travel_minutes: number | null; status: string };
}

export async function loadRecords(sb: PilotClient, date: string, kind: DataKind) {
  const [e, j, r, sc] = await Promise.all([
    sb
      .from("work_events")
      .select("seq, id, schedule_id, kind, occurred_at, entered_time, expected_end, entry_mode, recorded_at, client_pressed_at, client_sent_at, send_delay_seconds, source, actor_id, voids_event_id, note")
      .eq("work_date", date)
      .eq("data_kind", kind)
      .order("seq"),
    sb
      .from("risk_judgments")
      .select("id, seq, trigger_kind, trigger_ref, triggered_by, as_of, summary, rule_version, state_version, priority_version, app_version, payload_sha256, computed_at, recorded_at")
      .eq("work_date", date)
      .eq("data_kind", kind)
      .order("seq"),
    sb.from("schedule_revisions").select("seq, schedule_id, revision, change_kind, actor_id, recorded_at, snapshot").eq("work_date", date).eq("data_kind", kind).order("seq"),
    sb.from("judgment_jobs").select("seq, trigger_kind, status, attempts, last_error").eq("work_date", date).eq("data_kind", kind).eq("status", "대기").order("seq"),
  ]);
  for (const x of [e, j, r, sc]) if (x.error) throw new Error(x.error.message);
  return {
    events: (e.data ?? []) as EventRecord[],
    judgments: (j.data ?? []) as JudgmentListRow[],
    revisions: (r.data ?? []) as RevisionRecord[],
    pending: (sc.data ?? []) as { seq: number; trigger_kind: string; status: string; attempts: number; last_error: string | null }[],
  };
}
