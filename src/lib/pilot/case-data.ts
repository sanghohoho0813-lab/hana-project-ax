import "server-only";
import type { PilotClient } from "./supabase";
import type { DataKind, JudgmentSummary } from "./core";
import type { LinkChange, RiskDiff } from "@/lib/risk-engine";
import { CASE_COLS, OPEN, PHOTO_COLS, STEP_COLS, type CaseRow, type PhotoRow, type StepRow } from "./cases";

/**
 * 사건 읽기 — 로그인한 사용자 세션으로 읽으므로 RLS 가 범위를 정한다 (현장 직원: 본인 사건만).
 * 사진은 비공개 버킷에서 짧은 서명 주소(10분)로만 연다.
 */

export interface CaseBundle {
  cases: CaseRow[];
  steps: StepRow[];
  photos: (PhotoRow & { url: string | null })[];
}

async function withDetails(sb: PilotClient, cases: CaseRow[]): Promise<CaseBundle> {
  const ids = cases.map((c) => c.id);
  if (ids.length === 0) return { cases, steps: [], photos: [] };
  const [s, p] = await Promise.all([
    sb.from("case_steps").select(STEP_COLS).in("case_id", ids).order("step_no"),
    sb.from("case_photos").select(PHOTO_COLS).in("case_id", ids).order("recorded_at"),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (p.error) throw new Error(p.error.message);
  const photos = (p.data ?? []) as PhotoRow[];
  const live = photos.filter((x) => !x.deleted_at).map((x) => x.object_path);
  const urls = new Map<string, string>();
  if (live.length) {
    const { data } = await sb.storage.from("field-photos").createSignedUrls(live, 600);
    for (const u of data ?? []) if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl);
  }
  return { cases, steps: (s.data ?? []) as StepRow[], photos: photos.map((x) => ({ ...x, url: urls.get(x.object_path) ?? null })) };
}

/** 그 날짜의 사건 (현장 직원 화면 · 관리자 날짜 보기) */
export async function loadCasesOfDay(sb: PilotClient, date: string, kind: DataKind): Promise<CaseBundle> {
  const { data, error } = await sb.from("field_cases").select(CASE_COLS).eq("work_date", date).eq("data_kind", kind).order("reported_at");
  if (error) throw new Error(error.message);
  return withDetails(sb, (data ?? []) as CaseRow[]);
}

/** 관리자 수신함 — 처리되지 않은 사건은 날짜와 상관없이 계속 보인다 + 그 날짜의 끝난 사건 */
export async function loadInbox(sb: PilotClient, date: string, kind: DataKind): Promise<CaseBundle> {
  const [open, day] = await Promise.all([
    sb.from("field_cases").select(CASE_COLS).eq("data_kind", kind).in("status", OPEN).order("reported_at"),
    sb.from("field_cases").select(CASE_COLS).eq("data_kind", kind).eq("work_date", date).order("reported_at"),
  ]);
  if (open.error) throw new Error(open.error.message);
  if (day.error) throw new Error(day.error.message);
  const all = new Map<string, CaseRow>();
  for (const c of [...((open.data ?? []) as CaseRow[]), ...((day.data ?? []) as CaseRow[])]) all.set(c.id, c);
  return withDetails(sb, [...all.values()]);
}

export async function loadCase(sb: PilotClient, id: string): Promise<CaseBundle> {
  const { data, error } = await sb.from("field_cases").select(CASE_COLS).eq("id", id);
  if (error) throw new Error(error.message);
  return withDetails(sb, (data ?? []) as CaseRow[]);
}

export interface JudgmentBrief {
  id: string;
  seq: number;
  as_of: string;
  trigger_kind: string;
  summary: JudgmentSummary;
  changes: { changes: LinkChange[]; affectedSites: RiskDiff["affectedSites"] };
  app_version: string;
  rule_version: string;
  payload_sha256: string;
  recorded_at: string;
}

/** 사건에 연결된 엔진 판단 (관리자만 읽힘) — 보고의 예상 종료 · 일정 조정 · 예상 종료 변경 */
export async function judgmentsFor(sb: PilotClient, seqs: number[]): Promise<Map<number, JudgmentBrief>> {
  const m = new Map<number, JudgmentBrief>();
  if (seqs.length === 0) return m;
  const { data } = await sb
    .from("risk_judgments")
    .select("id, seq, as_of, trigger_kind, summary, changes, app_version, rule_version, payload_sha256, recorded_at")
    .in("seq", seqs);
  for (const j of (data ?? []) as JudgmentBrief[]) m.set(j.seq, j);
  return m;
}

/** 사건의 예상 종료 보고 기록 번호 (work_events.seq) */
export async function endEventSeqs(sb: PilotClient, eventIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (eventIds.length === 0) return m;
  const { data } = await sb.from("work_events").select("id, seq").in("id", eventIds);
  for (const e of (data ?? []) as { id: string; seq: number }[]) m.set(e.id, e.seq);
  return m;
}

export interface CaseEvidence extends CaseBundle {
  /** 엔진에 들어간 작업 기록 (예상 종료 보고 · 무효) */
  events: Record<string, unknown>[];
  /** 엔진에 들어간 일정 수정본 */
  revisions: Record<string, unknown>[];
  /** 연결된 판단 전후 기록 (전체) */
  judgments: Record<string, unknown>[];
  schedule: Record<string, unknown> | null;
}

/** 사건 하나의 증빙 — 사건 · 사진 · 조치 · 엔진 입력(작업 기록·일정 수정본) · 판단 전후 (관리자 세션) */
export async function loadCaseEvidence(sb: PilotClient, id: string): Promise<CaseEvidence | null> {
  const b = await loadCase(sb, id);
  const c = b.cases[0];
  if (!c) return null;
  const linked = b.steps.map((s) => s.linked_seq).filter((x): x is number => x !== null);
  const [ev, sch] = await Promise.all([
    sb
      .from("work_events")
      .select("seq, id, schedule_id, kind, occurred_at, entered_time, expected_end, entry_mode, recorded_at, client_pressed_at, client_sent_at, send_delay_seconds, source, actor_id, voids_event_id, note")
      .eq("schedule_id", c.schedule_id)
      .order("seq"),
    sb.from("schedules").select("id, site_name, region, work_date, data_kind, assignee_id, planned_start, planned_end, travel_minutes, version, status").eq("id", c.schedule_id).maybeSingle(),
  ]);
  const events = ((ev.data ?? []) as { id: string; seq: number; voids_event_id: string | null }[]).filter(
    (e) => e.id === c.end_event_id || linked.includes(e.seq) || (e.voids_event_id && e.voids_event_id === c.end_event_id),
  );
  const rev = linked.length ? await sb.from("schedule_revisions").select("seq, schedule_id, revision, change_kind, snapshot, actor_id, recorded_at").in("seq", linked) : { data: [] };
  const seqs = [...events.map((e) => e.seq), ...((rev.data ?? []) as { seq: number }[]).map((r) => r.seq)];
  const j = seqs.length ? await sb.from("risk_judgments").select("*").in("seq", seqs).order("seq") : { data: [] };
  return { ...b, events, revisions: (rev.data ?? []) as Record<string, unknown>[], judgments: (j.data ?? []) as Record<string, unknown>[], schedule: (sch.data as Record<string, unknown>) ?? null };
}
