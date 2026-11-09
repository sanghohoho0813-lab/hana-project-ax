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
