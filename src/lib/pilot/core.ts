/**
 * 실증 기록 → 기존 판단 파이프라인 연결 (순수 함수 — DB·네트워크·현재 시각을 읽지 않는다)
 *
 * - 판단은 기존 코드 그대로 runStatePipeline(상태이벤트 → 편차 → 연쇄위험 → 우선순위)으로 한다.
 *   통합일정 화면과 같은 가정(작업시간 유지)을 쓰고, 기준시각만 실제 기록시각을 넘긴다.
 * - 위험 판단 전후는 '판단 대상 번호(seq) 직전까지'와 '그 번호까지'의 기록으로 계산한다.
 *   그래서 판단을 늦게 하거나 다시 해도 결과가 같다 (저장된 입력으로 누구나 재계산 가능).
 * - '실제 업무'와 '검증 시나리오' 기록은 섞지 않는다 (호출하는 쪽이 같은 구분만 넘긴다).
 */
import { RISK_RULE_VERSION, diffRisk, gradeRank, type RiskDiff, type SiteInput } from "@/lib/risk-engine";
import { PRIORITY_VERSION, diffPriority, type PriorityChange } from "@/lib/priority-engine";
import {
  STATE_MODEL_VERSION,
  runStatePipeline,
  type EventKind,
  type PipelineInput,
  type PipelineResult,
  type StateEvent,
  type WorkContext,
} from "@/lib/state-events";
import { hhmm, kst } from "./time";

export const DATA_KINDS = ["실제 업무", "검증 시나리오"] as const;
export type DataKind = (typeof DATA_KINDS)[number];

/** 통합일정 화면(OPS_ASSUMPTIONS)과 같은 가정 — 같은지 실증 테스트가 확인한다 */
export const PILOT_ASSUMPTIONS = { assumeDurationKept: true } as const;

export const VERSIONS = {
  rule: RISK_RULE_VERSION,
  state: STATE_MODEL_VERSION,
  priority: PRIORITY_VERSION,
} as const;

/* ── DB 행 형식 ─────────────────────────────────────── */

export interface ScheduleRow {
  id: string;
  data_kind: DataKind;
  work_date: string;
  assignee_id: string;
  site_name: string;
  region: string;
  planned_start: string;
  planned_end: string;
  travel_minutes: number | null;
  travel_from_id: string | null;
  priority: "긴급" | "보통" | "낮음";
  status: "예정" | "취소";
  version: number;
}

export interface RevisionRow {
  seq: number;
  schedule_id: string;
  revision: number;
  change_kind: "등록" | "수정" | "취소";
  snapshot: ScheduleRow;
}

export type PilotEventKind = "업무 확인" | "작업개시" | "예상 종료 보고" | "작업종료" | "기록 무효";
export type EntryMode = "즉시 기록" | "지연 전송" | "사후 입력";

export interface EventRow {
  seq: number;
  id: string;
  schedule_id: string;
  data_kind: DataKind;
  work_date: string;
  kind: PilotEventKind;
  occurred_at: string;
  entered_time: string | null;
  expected_end: string | null;
  entry_mode: EntryMode;
  recorded_at: string;
  source: "현장 직원" | "관리자";
  actor_id: string;
  voids_event_id: string | null;
}

export interface JobRow {
  id: string;
  seq: number;
  trigger_kind: string;
  trigger_ref: string;
  data_kind: DataKind;
  work_date: string;
  as_of: string;
}

/* ── 변환 ───────────────────────────────────────────── */

export function toSiteInput(s: ScheduleRow): SiteInput {
  return {
    id: s.id,
    title: s.site_name,
    region: s.region || undefined,
    workerId: s.assignee_id,
    date: s.work_date,
    plannedStart: hhmm(s.planned_start)!,
    plannedEnd: hhmm(s.planned_end)!,
    status: s.status === "취소" ? "취소" : "예정",
    travelMinutes: s.travel_minutes,
    travelSource: s.travel_minutes === null ? undefined : "입력값",
    travelFromId: s.travel_from_id ?? undefined,
  };
}

/** 이벤트 기록 경로 — 판단 근거에 그대로 표시된다 */
export function sourceLabel(e: Pick<EventRow, "kind" | "source" | "entry_mode">): string {
  if (e.kind === "예상 종료 보고") return e.source === "현장 직원" ? "현장 보고" : "관리자 입력";
  if (e.source === "관리자") return "관리자 입력";
  if (e.entry_mode === "사후 입력") return "현장 보고(사후 입력)";
  const button = e.kind === "업무 확인" ? "업무 확인 버튼" : e.kind === "작업개시" ? "작업 시작 버튼" : "작업 종료 버튼";
  return e.entry_mode === "지연 전송" ? `${button}(지연 전송)` : button;
}

/** 정정·무효로 대체된 기록과 '기록 무효' 자체는 판단에 쓰지 않는다 */
export function activeEvents(events: EventRow[]): EventRow[] {
  const voided = new Set(events.map((e) => e.voids_event_id).filter((x): x is string => !!x));
  return events.filter((e) => e.kind !== "기록 무효" && !voided.has(e.id));
}

export function toStateEvent(e: EventRow): StateEvent {
  const ev: StateEvent = {
    id: e.id,
    kind: e.kind as EventKind,
    siteId: e.schedule_id,
    at: kst(e.occurred_at).minute,
    source: sourceLabel(e),
    origin: e.data_kind === "실제 업무" ? "실증 기록" : "검증 시나리오",
  };
  if (e.kind === "예상 종료 보고") ev.value = hhmm(e.expected_end);
  return ev;
}

/** 일정·이벤트 기록 → 판단 파이프라인 입력 */
export function buildPipelineInput(schedules: ScheduleRow[], events: EventRow[], asOf: string): PipelineInput {
  const kinds = new Set([...schedules.map((s) => s.data_kind), ...events.map((e) => e.data_kind)]);
  if (kinds.size > 1) throw new Error("실제 업무와 검증 시나리오 기록을 한 판단에 섞을 수 없습니다.");
  const ordered = schedules.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const contexts: WorkContext[] = ordered.map((s) => ({ siteId: s.id, priority: s.priority }));
  return {
    planned: ordered.map(toSiteInput),
    events: activeEvents(events)
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map(toStateEvent),
    contexts,
    asOf: kst(asOf).minute,
    assumeDurationKept: PILOT_ASSUMPTIONS.assumeDurationKept,
  };
}

/** 번호(seq)까지의 일정 수정본 중 일정별 최신본 */
export function schedulesAt(revisions: RevisionRow[], maxSeq: number): ScheduleRow[] {
  const latest = new Map<string, RevisionRow>();
  for (const r of revisions) {
    if (r.seq > maxSeq) continue;
    const cur = latest.get(r.schedule_id);
    if (!cur || r.seq > cur.seq) latest.set(r.schedule_id, r);
  }
  return [...latest.values()].map((r) => r.snapshot);
}

/* ── 판단 기록 ──────────────────────────────────────── */

export interface JudgmentSummary {
  risky_before: number;
  risky_after: number;
  held_before: number;
  held_after: number;
  changed_links: number;
  affected_sites: number;
  priority_before: string[];
  priority_after: string[];
  event_issues_after: number;
  schedules: number;
  events: number;
}

export interface JudgmentPayload {
  job_id: string;
  seq: number;
  rule_version: string;
  state_version: string;
  priority_version: string;
  app_version: string;
  input_before: PipelineInput;
  input_after: PipelineInput;
  result_before: PipelineResult;
  result_after: PipelineResult;
  changes: RiskDiff;
  priority_changes: PriorityChange[];
  summary: JudgmentSummary;
  computed_at: string;
}

const risky = (r: PipelineResult) => r.risk.links.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2).length;
const held = (r: PipelineResult) => r.risk.links.filter((l) => l.status === "판단 보류").length;
const ranks = (r: PipelineResult) => r.priority.items.map((i) => `${i.rank}. ${i.title} (${i.score}점)`);

/** 같은 입력이면 같은 결과 — 저장된 input_after 로 result_after 를 다시 만들 수 있다 */
export function evaluate(input: PipelineInput): PipelineResult {
  return runStatePipeline(input);
}

export function computeJudgment(
  job: JobRow,
  revisions: RevisionRow[],
  events: EventRow[],
  meta: { appVersion: string; computedAt: string },
): JudgmentPayload {
  if (revisions.some((r) => r.snapshot.data_kind !== job.data_kind) || events.some((e) => e.data_kind !== job.data_kind)) {
    throw new Error("판단 대상과 데이터 구분이 다른 기록이 섞였습니다.");
  }
  const beforeEvents = events.filter((e) => e.seq < job.seq);
  const afterEvents = events.filter((e) => e.seq <= job.seq);
  const input_before = buildPipelineInput(schedulesAt(revisions, job.seq - 1), beforeEvents, job.as_of);
  const input_after = buildPipelineInput(schedulesAt(revisions, job.seq), afterEvents, job.as_of);
  const result_before = evaluate(input_before);
  const result_after = evaluate(input_after);
  const changes = diffRisk(result_before.risk, result_after.risk);
  return {
    job_id: job.id,
    seq: job.seq,
    rule_version: VERSIONS.rule,
    state_version: VERSIONS.state,
    priority_version: VERSIONS.priority,
    app_version: meta.appVersion,
    input_before,
    input_after,
    result_before,
    result_after,
    changes,
    priority_changes: diffPriority(result_before.priority, result_after.priority),
    summary: {
      risky_before: risky(result_before),
      risky_after: risky(result_after),
      held_before: held(result_before),
      held_after: held(result_after),
      changed_links: changes.changes.length,
      affected_sites: changes.affectedSites.length,
      priority_before: ranks(result_before),
      priority_after: ranks(result_after),
      event_issues_after: result_after.eventIssues.length,
      schedules: input_after.planned.length,
      events: input_after.events.length,
    },
    computed_at: meta.computedAt,
  };
}

/** 기준시각의 현재 판단 (화면 표시용 — 기록되는 판단은 computeJudgment) */
export function judgeAt(schedules: ScheduleRow[], events: EventRow[], asOf: string): PipelineResult {
  return evaluate(buildPipelineInput(schedules, events, asOf));
}

/**
 * 지금 이 일정의 직전 일정 — DB(save_schedule)가 이동 출발 현장을 정하는 규칙과 같다.
 * 같은 작업자·날짜·데이터 구분의 '예정' 일정 중 예정 시작이 더 이른 마지막 일정.
 */
export function predecessorOf(s: ScheduleRow, schedules: ScheduleRow[]): ScheduleRow | undefined {
  return schedules
    .filter(
      (o) =>
        o.assignee_id === s.assignee_id &&
        o.work_date === s.work_date &&
        o.data_kind === s.data_kind &&
        o.status === "예정" &&
        o.id !== s.id &&
        o.planned_start < s.planned_start,
    )
    .sort((a, b) => (a.planned_start === b.planned_start ? (a.id < b.id ? 1 : -1) : a.planned_start < b.planned_start ? 1 : -1))[0];
}

/** 이동시간을 넣은 뒤 일정 순서가 바뀌어, 이동 출발 현장이 지금 직전 일정과 다른지 */
export function travelBasisStale(s: ScheduleRow, schedules: ScheduleRow[]): boolean {
  if (s.status !== "예정" || s.travel_minutes === null) return false;
  return (predecessorOf(s, schedules)?.id ?? null) !== s.travel_from_id;
}

/**
 * 이 일정의 이동 기준을 흔드는 취소 일정 — 엔진 R7(판단 보류) 원인과 같은 조건.
 * ① 직전 유효 일정과 이 일정 사이(예정 시작 기준)에 취소된 일정이 있거나 ② 이동 출발 현장이 취소된 일정.
 * 관리자에게 이동 출발지·이동시간 재확인을 안내하는 데만 쓰며, 판단 결과를 바꾸지 않는다.
 */
export function cancelledBetween(s: ScheduleRow, schedules: ScheduleRow[]): ScheduleRow[] {
  if (s.status !== "예정") return [];
  const prev = predecessorOf(s, schedules);
  const same = (o: ScheduleRow) => o.assignee_id === s.assignee_id && o.work_date === s.work_date && o.data_kind === s.data_kind && o.id !== s.id;
  return schedules.filter(
    (o) =>
      same(o) &&
      o.status === "취소" &&
      ((!!prev && o.planned_start > prev.planned_start && o.planned_start < s.planned_start) || o.id === s.travel_from_id),
  );
}

/** 취소한 일정 바로 뒤의 같은 직원 예정 일정 — 취소 직후 재확인 안내 대상 */
export function followingOf(cancelled: ScheduleRow, schedules: ScheduleRow[]): ScheduleRow | undefined {
  return schedules
    .filter(
      (o) =>
        o.assignee_id === cancelled.assignee_id &&
        o.work_date === cancelled.work_date &&
        o.data_kind === cancelled.data_kind &&
        o.status === "예정" &&
        o.id !== cancelled.id &&
        o.planned_start > cancelled.planned_start,
    )
    .sort((a, b) => (a.planned_start < b.planned_start ? -1 : a.planned_start > b.planned_start ? 1 : a.id < b.id ? -1 : 1))[0];
}

/* ── 저장된 판단 재계산 확인 ─────────────────────────── */

/** 키 순서를 정렬한 JSON — DB(jsonb)는 키 순서를 바꾸므로 비교 전에 맞춘다. undefined 는 JSON 처럼 뺀다 */
export function canonical(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? "null" : canonical(v))).join(",")}]`;
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

export interface RecomputeCheck {
  /** 기록 당시 규칙 버전과 지금 버전이 같아 다시 계산해 비교했는지 */
  checked: boolean;
  before: boolean;
  after: boolean;
  reason: string;
}

/** 저장된 판단 입력으로 지금 엔진을 다시 돌려 저장된 결과와 같은지 확인한다 */
export function recheckJudgment(row: {
  rule_version: string;
  state_version: string;
  priority_version: string;
  input_before: PipelineInput;
  input_after: PipelineInput;
  result_before: unknown;
  result_after: unknown;
}): RecomputeCheck {
  if (row.rule_version !== VERSIONS.rule || row.state_version !== VERSIONS.state || row.priority_version !== VERSIONS.priority) {
    return { checked: false, before: false, after: false, reason: `기록 당시 규칙 버전(${row.rule_version} · ${row.state_version} · ${row.priority_version})이 지금과 달라 비교하지 않았습니다.` };
  }
  const before = canonical(evaluate(row.input_before)) === canonical(row.result_before);
  const after = canonical(evaluate(row.input_after)) === canonical(row.result_after);
  return {
    checked: true,
    before,
    after,
    reason: before && after ? "저장된 입력으로 다시 계산한 결과가 저장된 판단 전·후 결과와 같습니다." : "다시 계산한 결과가 저장된 결과와 다릅니다 — 확인이 필요합니다.",
  };
}

/* ── 현장 화면용 상태 ───────────────────────────────── */

export interface ScheduleProgress {
  acknowledged?: EventRow;
  started?: EventRow;
  ended?: EventRow;
  expectedEnd?: EventRow;
  phase: "예정" | "확인함" | "작업 중" | "작업 종료" | "취소";
}

export function progressOf(s: Pick<ScheduleRow, "id" | "status">, events: EventRow[]): ScheduleProgress {
  const mine = activeEvents(events.filter((e) => e.schedule_id === s.id)).sort((a, b) => a.seq - b.seq);
  const first = (k: PilotEventKind) => mine.find((e) => e.kind === k);
  const reports = mine.filter((e) => e.kind === "예상 종료 보고");
  const p: ScheduleProgress = {
    acknowledged: first("업무 확인"),
    started: first("작업개시"),
    ended: first("작업종료"),
    expectedEnd: reports[reports.length - 1],
    phase: "예정",
  };
  p.phase = s.status === "취소" ? "취소" : p.ended ? "작업 종료" : p.started ? "작업 중" : p.acknowledged ? "확인함" : "예정";
  return p;
}
