/**
 * 로컬 실증(브라우저 저장) 기록 모델 — 순수 함수 (저장소·현재 시각·난수는 인자로 받는다)
 *
 * 목적: 하나정보통신에서 전달받은 현장정보를 컨설턴트가 직접 여러 번 입력·시험하며,
 * 출처와 측정방법이 분명한 기술검증·전후 비교자료를 쌓는다. 중앙 DB 가 아니다.
 *
 * 원칙
 *  - 기록은 추가만 한다. 고치면 정정 기록, 지우면 '기록 무효' — 원래 기록은 남는다.
 *  - 정보 제공자 · 프로그램 입력자 · 실제 발생시각 · 프로그램 입력시각 · 자료 출처 · 데이터 구분을 따로 저장한다.
 *  - 실제 발생시각을 모르면 비워 둔다 (추정해 채우지 않음). 엔진은 그 기록을 판단에 쓰지 않는다.
 *  - 위험 판단은 기존 엔진(runStatePipeline → 연쇄위험 → 우선순위)을 그대로 쓴다 (`@/lib/pilot/core`).
 *  - 실제 업무 · 사후 재현 · 가상 시나리오는 세트(회차) 단위로 나뉘어, 한 판단에 섞이지 않는다.
 */
import {
  cancelledBetween,
  computeJudgment,
  judgeAt,
  predecessorOf,
  travelBasisStale,
  VERSIONS,
  type EventRow,
  type JobRow,
  type JudgmentSummary,
  type PilotEventKind,
  type RevisionRow,
  type ScheduleRow,
} from "@/lib/pilot/core";
import { kst } from "@/lib/pilot/time";
import type { LinkChange, RiskDiff, RiskLink } from "@/lib/risk-engine";
import type { PriorityChange } from "@/lib/priority-engine";
import type { PipelineResult } from "@/lib/state-events";

/* ── 구분값 ─────────────────────────────────────────── */

export const LAB_KINDS = ["실제 업무", "사후 재현", "가상 시나리오"] as const;
export type LabKind = (typeof LAB_KINDS)[number];
export const KIND_DESC: Record<LabKind, string> = {
  "실제 업무": "그날 실제로 일어나는 일을 바로 입력 (버튼 누른 시각 = 실제 시각)",
  "사후 재현": "이미 지난 현장 업무를 전달받은 정보·원자료로 다시 입력",
  "가상 시나리오": "시험·연습용으로 만든 가상 일정 (실제 기록 아님)",
};

export const SOURCES = ["현장기사 실시간 입력", "현장기사 구두 전달", "업무일지", "일정표", "메신저 기록", "직접 시험", "가상 시나리오"] as const;
export const TIME_BASES = ["버튼 누른 시각(실시간)", "정보 제공자 진술", "원자료 기록", "가상 시각", "모름"] as const;
export type TimeBasis = (typeof TIME_BASES)[number];
export type AsOfBasis = "실제 현재 시각" | "재현 기준시각(가정값)";

/* ── 기록 형식 ──────────────────────────────────────── */

export interface Person {
  id: string;
  name: string;
  /** 시험용 참가자 코드 (예: P01) */
  code: string;
  role: string;
  org: string;
  note: string;
  createdAt: string;
  /** 이름·코드를 고친 이력 (이전 값) */
  history: { at: string; by: string; name: string; code: string; role: string; org: string }[];
}

export interface Session {
  id: string;
  /** 전체 일련번호 */
  no: number;
  title: string;
  kind: LabKind;
  /** 현장 업무 날짜 */
  workDate: string;
  /** 핵심 참여자 */
  participantId: string;
  /** 기본 정보 제공자 */
  informantId: string | null;
  /** 기본 자료 출처 */
  source: string;
  /** 원자료 (업무일지·일정표 이름·위치 등) */
  sourceRef: string;
  /** 사후 재현·가상: 판단 기준시각 HH:MM (가정값) · 실제 업무: null(실제 현재 시각) */
  clock: string | null;
  clockHistory: { at: string; by: string; from: string | null; to: string }[];
  /** 반복 회차의 원본 세트 */
  basedOn: string | null;
  createdAt: string;
  createdBy: string;
  note: string;
}

export interface Snap {
  id: string;
  workerId: string;
  siteName: string;
  region: string;
  plannedStart: string;
  plannedEnd: string;
  travelMinutes: number | null;
  travelFromId: string | null;
  priority: "긴급" | "보통" | "낮음";
  status: "예정" | "취소";
  version: number;
  note: string;
}

interface EntryBase {
  /** 변경 기록 공통 번호 (일정 변경·작업 기록이 같은 순서 체계) */
  seq: number;
  /** 요청 번호 — 같은 요청이 두 번 와도 한 번만 기록 */
  opId: string;
  sessionId: string;
  /** 프로그램 입력 시각 (이 브라우저 시계) */
  enteredAt: string;
  /** 프로그램에 입력한 사람 */
  enteredBy: string;
  /** 실제 정보를 알려 준 사람 */
  informantId: string | null;
  source: string;
  sourceRef: string;
  /** 이 기록 뒤 위험 판단의 기준시각과 그 근거 */
  asOf: string;
  asOfBasis: AsOfBasis;
}

export interface RevisionEntry extends EntryBase {
  type: "schedule";
  scheduleId: string;
  revision: number;
  changeKind: "등록" | "수정" | "취소";
  snapshot: Snap;
  reason: string;
}

export interface EventEntry extends EntryBase {
  type: "event";
  scheduleId: string;
  kind: PilotEventKind;
  /** 실제 작업 발생시각 (모르면 null — 추정하지 않음) */
  occurredAt: string | null;
  timeBasis: TimeBasis;
  /** 사람이 직접 넣은 시각 HH:MM (버튼 실시간 기록이면 null) */
  enteredTime: string | null;
  expectedEnd: string | null;
  via: "현장기사 화면" | "관리자 화면";
  /** 정정·무효 대상 기록 번호 */
  voidsSeq: number | null;
  note: string;
}

export type Entry = RevisionEntry | EventEntry;

export interface JudgmentEntry {
  seq: number;
  sessionId: string;
  trigger: string;
  asOf: string;
  asOfBasis: AsOfBasis;
  ruleVersion: string;
  stateVersion: string;
  priorityVersion: string;
  summary: JudgmentSummary;
  changes: LinkChange[];
  affected: RiskDiff["affectedSites"];
  priorityChanges: PriorityChange[];
  /** 사람이 읽는 계산 흐름 (기록값·계산값·가정값 표시) */
  story: string[];
  computedAt: string;
}

export const TRIAL_METHODS = ["수기", "AX"] as const;
export const SCENARIO_TYPES = ["가상 시나리오", "실제 현장정보 재현"] as const;
export const FOLLOW_UP = ["파악함", "일부 파악", "파악 못 함"] as const;
export const MEASURE_METHODS = ["앱 측정기", "스톱워치", "기록지", "화면 녹화"] as const;

export interface TrialValues {
  date: string;
  participantId: string;
  operatorId: string;
  method: (typeof TRIAL_METHODS)[number];
  scenarioType: (typeof SCENARIO_TYPES)[number];
  /** 시나리오 (비교시험 A1~B5·R1~R2 또는 현장 실증 세트 번호 또는 직접 이름) */
  scenario: string;
  /** 대응 묶음 — 같은 묶음의 수기·AX 회차를 비교한다 */
  pairKey: string;
  /** 위험 발견 소요시간(초) */
  t1Sec: number | null;
  /** 일정 조정 후 재판단 소요시간(초) */
  t2Sec: number | null;
  t1Timeout: boolean;
  t2Timeout: boolean;
  /** 앱 측정기 원시 시각 (있을 때) */
  stamps: { part1Start?: string; part1End?: string; actionGiven?: string; part2End?: string };
  correct: number | null;
  /** 정답 위험 수 (정답표·사전 확정값이 있을 때) */
  expected: number | null;
  missed: number | null;
  missedNote: string;
  wrong: number | null;
  wrongNote: string;
  followUp: (typeof FOLLOW_UP)[number] | null;
  followUpNote: string;
  measureMethod: string;
  /** 원자료 (기록지 번호·파일 이름) */
  rawRef: string;
  /** 시험 중 발견된 오류·수정사항 */
  issues: string;
  /** 참여자가 결과를 직접 확인했는지 */
  confirmedByParticipant: boolean;
  note: string;
}

export interface TrialRun extends TrialValues {
  id: string;
  no: number;
  createdAt: string;
  createdBy: string;
  /** 고치기 전 값 (정정 이력) */
  history: { at: string; by: string; values: TrialValues }[];
  voided: { at: string; by: string; reason: string } | null;
}

export const NOTE_TYPES = ["오류", "수정사항", "개선 제안", "참여자 피드백", "관찰"] as const;
export const CONFIRMATION = ["참여자가 직접 확인", "미확인 (입력자 기록)"] as const;

export interface NoteValues {
  type: (typeof NOTE_TYPES)[number];
  text: string;
  /** 말한 사람·출처 */
  speakerId: string | null;
  confirmation: (typeof CONFIRMATION)[number];
  status: "열림" | "반영함" | "보류";
  sessionId: string | null;
  trialId: string | null;
}

export interface Note extends NoteValues {
  id: string;
  no: number;
  at: string;
  recordedBy: string;
  history: { at: string; by: string; values: NoteValues }[];
}

export interface ReportText {
  /** ② 적용 전 업무방식과 문제점 */
  before: string;
  /** ⑥ 향후 예상 효과와 계산 근거 (예상 — 측정 아님) */
  expected: string;
  /** ⑦ 한계와 추가 검증계획 */
  limits: string;
}

export interface LabState {
  format: "hana-ax-lab";
  version: 1;
  createdAt: string;
  updatedAt: string;
  seq: number;
  /** 저장할 때마다 1 증가 — 백업 뒤 바뀐 수를 센다 */
  changeCount: number;
  people: Person[];
  sessions: Session[];
  entries: Entry[];
  judgments: JudgmentEntry[];
  trials: TrialRun[];
  notes: Note[];
  report: ReportText;
  backup: { lastAt: string | null; lastChangeCount: number; lastFile: string | null };
}

/* ── 오류 ──────────────────────────────────────────── */

export class LabError extends Error {}
const fail = (m: string): never => {
  throw new LabError(m);
};

export interface Ctx {
  now: Date;
  id: () => string;
}

/* ── 시작 상태 ──────────────────────────────────────── */

export const SEED_PEOPLE: Omit<Person, "createdAt" | "history">[] = [
  { id: "p-koo", name: "구본석", code: "P01", role: "현장 관계자 · 핵심 참여자", org: "하나정보통신 이사", note: "" },
  { id: "p-consultant", name: "컨설턴트", code: "C01", role: "입력자", org: "", note: "이름을 바꿔 쓰세요" },
];

export function emptyState(now: Date): LabState {
  const at = now.toISOString();
  return {
    format: "hana-ax-lab",
    version: 1,
    createdAt: at,
    updatedAt: at,
    seq: 0,
    changeCount: 0,
    people: SEED_PEOPLE.map((p) => ({ ...p, createdAt: at, history: [] })),
    sessions: [],
    entries: [],
    judgments: [],
    trials: [],
    notes: [],
    report: { before: "", expected: "", limits: "" },
    backup: { lastAt: null, lastChangeCount: 0, lastFile: null },
  };
}

/* ── 도우미 ────────────────────────────────────────── */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const min = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** 한국 날짜 + 시각 → ISO */
export const kstIso = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+09:00`).toISOString();

const touch = (s: LabState, now: Date): LabState => ({ ...s, updatedAt: now.toISOString(), changeCount: s.changeCount + 1 });

export const personName = (s: LabState, id: string | null | undefined) => (id ? (s.people.find((p) => p.id === id)?.name ?? "알 수 없음") : "-");
export const sessionOf = (s: LabState, id: string) => s.sessions.find((x) => x.id === id) ?? fail("[입력] 실증 세트를 찾을 수 없습니다.");

export function sessionEntries(s: LabState, sessionId: string): Entry[] {
  return s.entries.filter((e) => e.sessionId === sessionId);
}

/** 세트의 지금 일정 (일정별 마지막 수정본) */
export function currentSchedules(s: LabState, sessionId: string): Snap[] {
  const latest = new Map<string, RevisionEntry>();
  for (const e of s.entries) if (e.type === "schedule" && e.sessionId === sessionId) latest.set(e.scheduleId, e);
  return [...latest.values()].map((r) => r.snapshot).sort((a, b) => (a.plannedStart < b.plannedStart ? -1 : a.plannedStart > b.plannedStart ? 1 : a.id < b.id ? -1 : 1));
}

export function sessionEvents(s: LabState, sessionId: string): EventEntry[] {
  return s.entries.filter((e): e is EventEntry => e.type === "event" && e.sessionId === sessionId);
}

/** 정정·무효로 대체되지 않은 작업 기록 */
export function activeLabEvents(events: EventEntry[]): EventEntry[] {
  const replaced = new Set(events.map((e) => e.voidsSeq).filter((x): x is number => x !== null));
  return events.filter((e) => e.kind !== "기록 무효" && !replaced.has(e.seq));
}

export function replacedBy(events: EventEntry[]): Map<number, EventEntry> {
  const m = new Map<number, EventEntry>();
  for (const e of events) if (e.voidsSeq !== null) m.set(e.voidsSeq, e);
  return m;
}

/** 대리 입력인지 — 입력자와 그 일정의 현장기사가 다르면 대리 입력 */
export const isProxy = (enteredBy: string, workerId: string | null) => !workerId || enteredBy !== workerId;

/* ── 엔진 연결 (실증 연결부 core 재사용) ────────────── */

const coreKind = (k: LabKind) => (k === "가상 시나리오" ? "검증 시나리오" : "실제 업무");

function toScheduleRow(session: Session, x: Snap): ScheduleRow {
  return {
    id: x.id,
    data_kind: coreKind(session.kind),
    work_date: session.workDate,
    assignee_id: x.workerId,
    site_name: x.siteName,
    region: x.region,
    planned_start: x.plannedStart,
    planned_end: x.plannedEnd,
    travel_minutes: x.travelMinutes,
    travel_from_id: x.travelFromId,
    priority: x.priority,
    status: x.status,
    version: x.version,
  };
}

function toRevisionRow(session: Session, e: RevisionEntry): RevisionRow {
  return { seq: e.seq, schedule_id: e.scheduleId, revision: e.revision, change_kind: e.changeKind, snapshot: toScheduleRow(session, e.snapshot) };
}

function toEventRow(session: Session, e: EventEntry): EventRow {
  return {
    seq: e.seq,
    id: `e${e.seq}`,
    schedule_id: e.scheduleId,
    data_kind: coreKind(session.kind),
    work_date: session.workDate,
    kind: e.kind,
    occurred_at: e.occurredAt ?? "",
    entered_time: e.enteredTime,
    expected_end: e.expectedEnd,
    entry_mode: e.timeBasis === "버튼 누른 시각(실시간)" ? "즉시 기록" : "사후 입력",
    recorded_at: e.enteredAt,
    source: e.via === "현장기사 화면" ? "현장 직원" : "관리자",
    actor_id: e.enteredBy,
    voids_event_id: e.voidsSeq === null ? null : `e${e.voidsSeq}`,
  };
}

/** 세트의 지금 판단 — 기준시각(실제 현재 시각 또는 재현 기준시각) */
export function judgeSession(s: LabState, sessionId: string, now: Date): { result: PipelineResult; asOf: string; asOfBasis: AsOfBasis } {
  const session = sessionOf(s, sessionId);
  const { asOf, asOfBasis } = sessionAsOf(session, now);
  const schedules = currentSchedules(s, sessionId).map((x) => toScheduleRow(session, x));
  const events = sessionEvents(s, sessionId).map((e) => toEventRow(session, e));
  return { result: judgeAt(schedules, events, asOf), asOf, asOfBasis };
}

export function sessionAsOf(session: Session, now: Date): { asOf: string; asOfBasis: AsOfBasis } {
  if (session.kind === "실제 업무" || !session.clock) return { asOf: now.toISOString(), asOfBasis: "실제 현재 시각" };
  return { asOf: kstIso(session.workDate, session.clock), asOfBasis: "재현 기준시각(가정값)" };
}

/* ── 계산 흐름 문장 ─────────────────────────────────── */

const gradeText = (l: Pick<RiskLink, "status" | "grade"> | null | undefined) =>
  !l ? "연결 없음" : l.status !== "판정" ? l.status : l.grade === "없음" ? "위험 없음" : `위험 ${l.grade}`;

function linkLine(l: RiskLink): string {
  const travel = l.travel.minutes === null ? "이동시간 없음" : `이동 ${l.travel.minutes}분(입력값)`;
  if (l.status !== "판정") return `${l.prev.title} → ${l.next.title}: ${l.status} — ${l.reason}`;
  const arrive = l.arrival ? `${l.next.title} 도착 ${l.arrival}(계산값)` : `${l.next.title} 도착 계산 안 함`;
  const slack = l.slack === null ? "" : l.slack < 0 ? ` → ${l.shortfall}분 늦음` : ` → 여유 ${l.slack}분`;
  return `${l.prev.title} 예상 종료 ${l.prev.expectedEnd}(${l.prev.endSource}) + ${travel} → ${arrive} / 예정 시작 ${l.next.plannedStart}${slack} → ${gradeText(l)}`;
}

function triggerLine(s: LabState, session: Session, e: Entry, prev: Snap | undefined): string {
  if (e.type === "schedule") {
    const x = e.snapshot;
    const plan = `예정 ${x.plannedStart}~${x.plannedEnd}${x.travelMinutes === null ? "" : `, 이동 ${x.travelMinutes}분`}`;
    if (e.changeKind === "등록") return `일정 등록: ${personName(s, x.workerId)} · ${x.siteName} (${plan})`;
    if (e.changeKind === "취소") return `일정 취소: ${x.siteName}${e.reason ? ` (사유: ${e.reason})` : ""}`;
    const was = prev ? `예정 ${prev.plannedStart}~${prev.plannedEnd}${prev.travelMinutes === null ? "" : `, 이동 ${prev.travelMinutes}분`}` : "";
    return `일정 조정: ${x.siteName} (${was} → ${plan})`;
  }
  const sched = currentSchedules(s, session.id).find((x) => x.id === e.scheduleId);
  const site = sched?.siteName ?? "알 수 없는 현장";
  const label = e.kind === "작업개시" ? "작업 시작" : e.kind === "작업종료" ? "작업 종료" : e.kind;
  if (e.kind === "기록 무효") return `${site} 기록 무효 처리 (번호 ${e.voidsSeq})`;
  const time = e.occurredAt ? `${kst(e.occurredAt).time}(기록값 · ${e.timeBasis})` : "실제 시각 모름 — 판단에 쓰지 않음";
  const fix = e.voidsSeq !== null ? ` · 번호 ${e.voidsSeq} 정정` : "";
  if (e.kind === "예상 종료 보고") {
    const late = sched && e.expectedEnd ? min(e.expectedEnd) - min(sched.plannedEnd) : 0;
    return `${site} 예상 종료 보고: ${e.expectedEnd}${late > 0 ? ` (예정 종료 ${sched?.plannedEnd}보다 ${late}분 늦음)` : ""} · 보고 시각 ${time}${fix}`;
  }
  let late = "";
  if (e.kind === "작업개시" && e.occurredAt && sched) {
    const d = min(kst(e.occurredAt).time) - min(sched.plannedStart);
    late = d > 0 ? ` — 예정 ${sched.plannedStart}보다 ${d}분 늦음` : d < 0 ? ` — 예정보다 ${-d}분 이름` : " — 예정대로";
  }
  return `${site} ${label} ${time}${late}${fix}`;
}

function story(s: LabState, session: Session, e: Entry, prevSnap: Snap | undefined, before: PipelineResult, after: PipelineResult, changes: LinkChange[]): string[] {
  const lines = [triggerLine(s, session, e, prevSnap)];
  const byKey = new Map(after.risk.links.map((l) => [l.key, l]));
  const beforeKey = new Map(before.risk.links.map((l) => [l.key, l]));
  for (const c of changes) {
    const a = byKey.get(c.key);
    const b = beforeKey.get(c.key);
    if (a) lines.push(linkLine(a));
    lines.push(`판단 변화: ${c.kind} (${gradeText(b)} → ${gradeText(a)})`);
  }
  if (changes.length === 0) lines.push("위험 판단 변화 없음");
  return lines;
}

/* ── 판단 기록 ─────────────────────────────────────── */

function judge(s: LabState, e: Entry, prevSnap: Snap | undefined, now: Date): JudgmentEntry {
  const session = sessionOf(s, e.sessionId);
  const entries = sessionEntries(s, session.id).filter((x) => x.seq <= e.seq);
  const revisions = entries.filter((x): x is RevisionEntry => x.type === "schedule").map((x) => toRevisionRow(session, x));
  const events = entries.filter((x): x is EventEntry => x.type === "event").map((x) => toEventRow(session, x));
  const job: JobRow = {
    id: `j${e.seq}`,
    seq: e.seq,
    trigger_kind: e.type === "schedule" ? `일정 ${e.changeKind}` : `작업 기록 · ${e.kind}`,
    trigger_ref: e.type === "schedule" ? e.scheduleId : `e${e.seq}`,
    data_kind: coreKind(session.kind),
    work_date: session.workDate,
    as_of: e.asOf,
  };
  const p = computeJudgment(job, revisions, events, { appVersion: "local", computedAt: now.toISOString() });
  return {
    seq: e.seq,
    sessionId: session.id,
    trigger: job.trigger_kind,
    asOf: e.asOf,
    asOfBasis: e.asOfBasis,
    ruleVersion: VERSIONS.rule,
    stateVersion: VERSIONS.state,
    priorityVersion: VERSIONS.priority,
    summary: p.summary,
    changes: p.changes.changes,
    affected: p.changes.affectedSites,
    priorityChanges: p.priority_changes,
    story: story(s, session, e, prevSnap, p.result_before, p.result_after, p.changes.changes),
    computedAt: now.toISOString(),
  };
}

/** 저장된 기록으로 판단을 다시 계산 — 불러온 백업이 같은 결과를 내는지 확인할 때 */
export function recomputeJudgments(s: LabState, now: Date): JudgmentEntry[] {
  const prevSnaps = new Map<string, Snap>();
  const out: JudgmentEntry[] = [];
  for (const e of s.entries) {
    const prev = e.type === "schedule" ? prevSnaps.get(e.scheduleId) : undefined;
    // 그 기록 시점의 상태(그 번호까지의 기록)로 계산 — 기록할 때와 같은 조건
    out.push(judge({ ...s, entries: s.entries.filter((x) => x.seq <= e.seq) }, e, prev, now));
    if (e.type === "schedule") prevSnaps.set(e.scheduleId, e.snapshot);
  }
  return out;
}

/** 다시 계산한 판단이 저장된 판단과 같은지 (계산 시각은 빼고 비교) */
export function judgmentsMatch(stored: JudgmentEntry[], again: JudgmentEntry[]): { same: number; differ: number[] } {
  const strip = (j: JudgmentEntry) => JSON.stringify({ ...j, computedAt: "" });
  const m = new Map(again.map((j) => [j.seq, strip(j)]));
  const differ: number[] = [];
  let same = 0;
  for (const j of stored) {
    if (m.get(j.seq) === strip(j)) same++;
    else differ.push(j.seq);
  }
  return { same, differ };
}

function append(s: LabState, e: Entry, prevSnap: Snap | undefined, now: Date): LabState {
  const next: LabState = { ...s, seq: e.seq, entries: [...s.entries, e] };
  return { ...next, judgments: [...s.judgments, judge(next, e, prevSnap, now)] };
}

/* ── 사람 ──────────────────────────────────────────── */

export function addPerson(s: LabState, input: { name: string; code: string; role: string; org: string }, ctx: Ctx): { state: LabState; id: string } {
  const name = input.name.trim();
  if (!name) fail("[입력] 이름을 넣어 주세요.");
  const code = input.code.trim();
  if (code && s.people.some((p) => p.code === code)) fail(`[중복] 참가자 코드 ${code}는 이미 있습니다.`);
  const id = ctx.id();
  const p: Person = { id, name, code, role: input.role.trim() || "현장기사", org: input.org.trim(), note: "", createdAt: ctx.now.toISOString(), history: [] };
  return { state: touch({ ...s, people: [...s.people, p] }, ctx.now), id };
}

export function editPerson(s: LabState, id: string, input: { name: string; code: string; role: string; org: string }, by: string, ctx: Ctx): LabState {
  const p = s.people.find((x) => x.id === id) ?? fail("[입력] 사람을 찾을 수 없습니다.");
  if (!input.name.trim()) fail("[입력] 이름을 넣어 주세요.");
  if (input.code.trim() && s.people.some((x) => x.id !== id && x.code === input.code.trim())) fail(`[중복] 참가자 코드 ${input.code}는 이미 있습니다.`);
  const prev = { at: ctx.now.toISOString(), by, name: p.name, code: p.code, role: p.role, org: p.org };
  const next = { ...p, name: input.name.trim(), code: input.code.trim(), role: input.role.trim(), org: input.org.trim(), history: [...p.history, prev] };
  return touch({ ...s, people: s.people.map((x) => (x.id === id ? next : x)) }, ctx.now);
}

/* ── 실증 세트(회차) ───────────────────────────────── */

export interface SessionInput {
  title: string;
  kind: LabKind;
  workDate: string;
  participantId: string;
  informantId: string | null;
  source: string;
  sourceRef: string;
  clock: string | null;
  note: string;
  createdBy: string;
}

export function createSession(s: LabState, input: SessionInput, ctx: Ctx): { state: LabState; id: string } {
  if (!LAB_KINDS.includes(input.kind)) fail("[입력] 데이터 구분을 고르세요.");
  if (!DATE_RE.test(input.workDate)) fail("[입력] 현장 업무 날짜를 넣어 주세요.");
  if (input.kind === "실제 업무" && input.workDate !== kst(ctx.now).date) fail("[입력] '실제 업무'는 오늘 날짜만 됩니다. 지난 업무는 '사후 재현'으로 입력하세요.");
  if (input.kind !== "실제 업무" && !(input.clock && TIME_RE.test(input.clock))) fail("[입력] 재현 기준시각(HH:MM)을 넣어 주세요 — 위험 판단을 이 시각 기준으로 합니다 (가정값).");
  if (!s.people.some((p) => p.id === input.participantId)) fail("[입력] 핵심 참여자를 고르세요.");
  const id = ctx.id();
  const no = s.sessions.length + 1;
  const session: Session = {
    id,
    no,
    title: input.title.trim() || `${input.workDate} ${input.kind}`,
    kind: input.kind,
    workDate: input.workDate,
    participantId: input.participantId,
    informantId: input.informantId,
    source: input.kind === "가상 시나리오" ? "가상 시나리오" : input.source || SOURCES[1],
    sourceRef: input.sourceRef.trim(),
    clock: input.kind === "실제 업무" ? null : input.clock,
    clockHistory: [],
    basedOn: null,
    createdAt: ctx.now.toISOString(),
    createdBy: input.createdBy,
    note: input.note.trim(),
  };
  return { state: touch({ ...s, sessions: [...s.sessions, session] }, ctx.now), id };
}

/** 같은 일정으로 반복 회차 — 원본의 지금 일정(취소 제외)을 새 세트에 다시 등록한다 (작업 기록은 옮기지 않음) */
export function repeatSession(s: LabState, sessionId: string, by: string, ctx: Ctx, override?: { workDate?: string; clock?: string | null }): { state: LabState; id: string } {
  const src = sessionOf(s, sessionId);
  const root = src.basedOn ?? src.id;
  const kind = src.kind === "실제 업무" ? "사후 재현" : src.kind;
  const plans = currentSchedules(s, sessionId).filter((x) => x.status === "예정");
  const made = createSession(
    s,
    {
      title: `${s.sessions.find((x) => x.id === root)?.title ?? src.title} · 반복`,
      kind,
      workDate: override?.workDate ?? src.workDate,
      participantId: src.participantId,
      informantId: src.informantId,
      source: src.source,
      sourceRef: src.sourceRef,
      // 기준시각(가정값): 지정하지 않으면 원본이 처음 시작한 기준시각, 없으면 첫 일정 예정 시작
      clock: override?.clock ?? src.clockHistory[0]?.from ?? src.clock ?? plans[0]?.plannedStart ?? null,
      note: `세트 ${src.no} 일정으로 반복`,
      createdBy: by,
    },
    ctx,
  );
  let st: LabState = {
    ...made.state,
    sessions: made.state.sessions.map((x) => (x.id === made.id ? { ...x, basedOn: root } : x)),
  };
  const idMap = new Map<string, string>();
  for (const x of plans) idMap.set(x.id, ctx.id());
  for (const x of plans) {
    st = saveSchedule(
      st,
      {
        opId: ctx.id(),
        sessionId: made.id,
        scheduleId: null,
        expectedVersion: null,
        workerId: x.workerId,
        siteName: x.siteName,
        region: x.region,
        plannedStart: x.plannedStart,
        plannedEnd: x.plannedEnd,
        travelMinutes: x.travelMinutes,
        priority: x.priority,
        note: x.note,
        reason: `세트 ${src.no}에서 복사`,
        prov: { enteredBy: by, informantId: src.informantId, source: src.source, sourceRef: src.sourceRef },
        newId: idMap.get(x.id),
      },
      ctx,
    ).state;
  }
  return { state: st, id: made.id };
}

export function setClock(s: LabState, sessionId: string, clock: string, by: string, ctx: Ctx): LabState {
  const x = sessionOf(s, sessionId);
  if (x.kind === "실제 업무") fail("[입력] 실제 업무는 실제 현재 시각으로 판단합니다.");
  if (!TIME_RE.test(clock)) fail("[입력] 기준시각(HH:MM)을 확인해 주세요.");
  if (x.clock === clock) return s;
  const next = { ...x, clock, clockHistory: [...x.clockHistory, { at: ctx.now.toISOString(), by, from: x.clock, to: clock }] };
  return touch({ ...s, sessions: s.sessions.map((o) => (o.id === sessionId ? next : o)) }, ctx.now);
}

/* ── 일정 ──────────────────────────────────────────── */

export interface Provenance {
  enteredBy: string;
  informantId: string | null;
  source: string;
  sourceRef: string;
}

export interface ScheduleInput {
  opId: string;
  sessionId: string;
  scheduleId: string | null;
  expectedVersion: number | null;
  workerId: string;
  siteName: string;
  region: string;
  plannedStart: string;
  plannedEnd: string;
  travelMinutes: number | null;
  priority: Snap["priority"];
  note: string;
  reason: string;
  prov: Provenance;
  /** 반복 회차 복사용 */
  newId?: string;
}

export interface Result {
  state: LabState;
  seq: number;
  duplicated: boolean;
}

function duplicate(s: LabState, opId: string): Result | null {
  const e = s.entries.find((x) => x.opId === opId);
  return e ? { state: s, seq: e.seq, duplicated: true } : null;
}

function baseOf(s: LabState, session: Session, opId: string, prov: Provenance, now: Date, asOfOverride?: string): EntryBase {
  if (!s.people.some((p) => p.id === prov.enteredBy)) fail("[입력] 입력자를 고르세요.");
  const a = sessionAsOf(session, now);
  return {
    seq: s.seq + 1,
    opId,
    sessionId: session.id,
    enteredAt: now.toISOString(),
    enteredBy: prov.enteredBy,
    informantId: prov.informantId,
    source: prov.source || session.source,
    sourceRef: prov.sourceRef,
    asOf: asOfOverride ?? a.asOf,
    asOfBasis: a.asOfBasis,
  };
}

export function saveSchedule(s: LabState, x: ScheduleInput, ctx: Ctx): Result {
  const dup = duplicate(s, x.opId);
  if (dup) return dup;
  const session = sessionOf(s, x.sessionId);
  const siteName = x.siteName.trim();
  if (!siteName) fail("[입력] 현장 이름을 넣어 주세요.");
  if (!TIME_RE.test(x.plannedStart) || !TIME_RE.test(x.plannedEnd)) fail("[입력] 예정 시작·종료 시각(HH:MM)을 넣어 주세요.");
  if (min(x.plannedEnd) <= min(x.plannedStart)) fail("[입력] 예정 종료는 예정 시작보다 늦어야 합니다.");
  if (x.travelMinutes !== null && !(Number.isInteger(x.travelMinutes) && x.travelMinutes >= 0 && x.travelMinutes <= 600)) fail("[입력] 이동시간은 0~600 사이 분 단위 숫자입니다.");
  if (!s.people.some((p) => p.id === x.workerId)) fail("[입력] 현장기사를 고르세요.");
  const current = currentSchedules(s, session.id);
  let prev: Snap | undefined;
  let version = 1;
  if (x.scheduleId) {
    prev = current.find((o) => o.id === x.scheduleId) ?? fail("[입력] 일정을 찾을 수 없습니다.");
    if (prev.version !== x.expectedVersion) fail("[충돌] 다른 화면에서 이 일정이 먼저 바뀌었습니다. 새로 불러온 뒤 다시 저장해 주세요.");
    if (prev.status === "취소") fail("[입력] 취소된 일정은 고칠 수 없습니다.");
    version = prev.version + 1;
  }
  const id = x.scheduleId ?? x.newId ?? ctx.id();
  const draft: Snap = {
    id,
    workerId: x.workerId,
    siteName,
    region: x.region.trim(),
    plannedStart: x.plannedStart,
    plannedEnd: x.plannedEnd,
    travelMinutes: x.travelMinutes,
    travelFromId: null,
    priority: x.priority,
    status: "예정",
    version,
    note: x.note.trim(),
  };
  // 이동시간은 '지금 이 기사의 직전 일정'에서 출발하는 값으로 기록 (DB 실증판 save_schedule 과 같은 규칙)
  const others = current.filter((o) => o.id !== id).map((o) => toScheduleRow(session, o));
  const pred = predecessorOf(toScheduleRow(session, draft), others);
  if (x.travelMinutes !== null && !pred) fail("[입력] 이 기사의 그날 첫 일정이라 직전 현장에서의 이동시간을 넣을 수 없습니다.");
  draft.travelFromId = x.travelMinutes === null ? null : (pred?.id ?? null);
  const entry: RevisionEntry = {
    ...baseOf(s, session, x.opId, x.prov, ctx.now),
    type: "schedule",
    scheduleId: id,
    revision: version,
    changeKind: x.scheduleId ? "수정" : "등록",
    snapshot: draft,
    reason: x.reason.trim(),
  };
  const st = append(s, entry, prev, ctx.now);
  return { state: touch(st, ctx.now), seq: entry.seq, duplicated: false };
}

export function cancelSchedule(
  s: LabState,
  x: { opId: string; sessionId: string; scheduleId: string; expectedVersion: number; reason: string; prov: Provenance },
  ctx: Ctx,
): Result {
  const dup = duplicate(s, x.opId);
  if (dup) return dup;
  const session = sessionOf(s, x.sessionId);
  const prev = currentSchedules(s, session.id).find((o) => o.id === x.scheduleId) ?? fail("[입력] 일정을 찾을 수 없습니다.");
  if (prev.version !== x.expectedVersion) fail("[충돌] 다른 화면에서 이 일정이 먼저 바뀌었습니다. 새로 불러온 뒤 다시 시도해 주세요.");
  if (prev.status === "취소") fail("[입력] 이미 취소된 일정입니다.");
  const snap: Snap = { ...prev, status: "취소", version: prev.version + 1 };
  const entry: RevisionEntry = {
    ...baseOf(s, session, x.opId, x.prov, ctx.now),
    type: "schedule",
    scheduleId: prev.id,
    revision: snap.version,
    changeKind: "취소",
    snapshot: snap,
    reason: x.reason.trim(),
  };
  return { state: touch(append(s, entry, prev, ctx.now), ctx.now), seq: entry.seq, duplicated: false };
}

/* ── 작업 기록 ─────────────────────────────────────── */

export interface EventInput {
  opId: string;
  sessionId: string;
  scheduleId: string;
  kind: PilotEventKind;
  /** 지금: 버튼 누른 시각(실제 업무만) · 입력: 사람이 넣은 시각 · 모름: 비워 둠 */
  timeMode: "지금" | "입력" | "모름";
  time?: string;
  /** 입력한 시각의 근거 */
  timeBasis?: TimeBasis;
  expectedEnd?: string | null;
  voidsSeq?: number | null;
  via: EventEntry["via"];
  note?: string;
  prov: Provenance;
}

export function recordEvent(s: LabState, x: EventInput, ctx: Ctx): Result {
  const dup = duplicate(s, x.opId);
  if (dup) return dup;
  const session = sessionOf(s, x.sessionId);
  const sched = currentSchedules(s, session.id).find((o) => o.id === x.scheduleId) ?? fail("[입력] 일정을 찾을 수 없습니다.");
  if (sched.status === "취소" && x.kind !== "기록 무효") fail("[입력] 취소된 일정입니다.");
  const today = kst(ctx.now).date;

  // 실제 발생시각 — 모르면 비운다
  let occurredAt: string | null = null;
  let timeBasis: TimeBasis = "모름";
  let enteredTime: string | null = null;
  if (x.kind === "기록 무효") {
    timeBasis = "모름";
  } else if (x.timeMode === "지금") {
    if (session.kind !== "실제 업무") fail("[입력] 지금 시각 기록은 '실제 업무' 세트에서만 됩니다. 실제 시각을 넣거나 '모름'을 고르세요.");
    if (x.kind !== "업무 확인" && session.workDate !== today) fail(`[입력] 일정 날짜(${session.workDate})가 오늘이 아닙니다. 실제 시각을 넣어 주세요.`);
    occurredAt = ctx.now.toISOString();
    timeBasis = "버튼 누른 시각(실시간)";
  } else if (x.timeMode === "입력") {
    if (!x.time || !TIME_RE.test(x.time)) fail("[입력] 실제 시각(HH:MM)을 넣거나 '모름'을 고르세요.");
    enteredTime = x.time!;
    occurredAt = kstIso(session.workDate, enteredTime);
    timeBasis = session.kind === "가상 시나리오" ? "가상 시각" : x.timeBasis && x.timeBasis !== "모름" && x.timeBasis !== "버튼 누른 시각(실시간)" ? x.timeBasis : "정보 제공자 진술";
    if (session.kind === "실제 업무" && Date.parse(occurredAt) > ctx.now.getTime() + 60_000) fail("[입력] 아직 오지 않은 시각은 기록할 수 없습니다.");
  }

  if (x.kind === "예상 종료 보고") {
    if (!x.expectedEnd || !TIME_RE.test(x.expectedEnd)) fail("[입력] 예상 종료 시각(HH:MM)을 넣어 주세요.");
    if (min(x.expectedEnd!) <= min(sched.plannedStart)) fail(`[입력] 예상 종료 시각은 예정 시작(${sched.plannedStart})보다 늦어야 합니다.`);
  } else if (x.expectedEnd) fail("[입력] 예상 종료 시각은 예상 종료 보고에만 넣습니다.");

  const events = sessionEvents(s, session.id).filter((e) => e.scheduleId === sched.id);
  const active = activeLabEvents(events);
  const voidsSeq = x.voidsSeq ?? null;
  if (voidsSeq !== null) {
    const target = events.find((e) => e.seq === voidsSeq) ?? fail("[입력] 정정할 기록이 이 일정에 없습니다.");
    if (!active.includes(target)) fail("[입력] 이미 정정·무효 처리된 기록입니다.");
    if (x.kind !== "기록 무효" && x.kind !== target.kind) fail("[입력] 같은 종류의 기록으로만 정정할 수 있습니다.");
    if (x.kind === "기록 무효" && target.kind === "작업개시" && active.some((e) => e.kind === "작업종료"))
      fail("[입력] 작업 종료 기록이 남아 있어 작업 시작 기록만 무효로 할 수 없습니다 (종료부터 무효 처리).");
  } else if (x.kind === "기록 무효") fail("[입력] 무효 처리할 기록을 지정해 주세요.");

  if (["업무 확인", "작업개시", "작업종료"].includes(x.kind) && voidsSeq === null && active.some((e) => e.kind === x.kind))
    fail("[중복] 이미 기록된 단계입니다. 시각이 틀렸다면 정정해 주세요.");
  if (x.kind === "예상 종료 보고" && voidsSeq === null) {
    // 같은 값을 연달아 누른 경우(10초 안) — 새로 기록하지 않는다
    const last = active.filter((e) => e.kind === "예상 종료 보고").at(-1);
    if (last && last.expectedEnd === x.expectedEnd && ctx.now.getTime() - Date.parse(last.enteredAt) < 10_000) return { state: s, seq: last.seq, duplicated: true };
  }
  if (x.kind === "작업종료") {
    const start = active.find((e) => e.kind === "작업개시" && (voidsSeq === null || e.seq !== voidsSeq));
    if (!start) fail("[입력] 작업 시작 기록이 먼저 있어야 합니다 (시작을 놓쳤다면 시각을 넣어 기록).");
    if (start!.occurredAt && occurredAt && Date.parse(occurredAt) <= Date.parse(start!.occurredAt)) fail("[입력] 작업 종료가 작업 시작보다 빠를 수 없습니다.");
  }

  // 판단 기준시각: 실제 업무는 지금, 재현·가상은 기준시각 — 기록 시각이 더 늦으면 그 시각으로 옮긴다
  let st = s;
  let asOfOverride: string | undefined;
  if (session.kind !== "실제 업무" && enteredTime && session.clock && min(enteredTime) > min(session.clock)) {
    st = setClock(s, session.id, enteredTime, x.prov.enteredBy, ctx);
    asOfOverride = kstIso(session.workDate, enteredTime);
  }
  const entry: EventEntry = {
    ...baseOf(st, sessionOf(st, session.id), x.opId, x.prov, ctx.now, asOfOverride),
    type: "event",
    scheduleId: sched.id,
    kind: x.kind,
    occurredAt,
    timeBasis,
    enteredTime,
    expectedEnd: x.expectedEnd ?? null,
    via: x.via,
    voidsSeq,
    note: (x.note ?? "").trim(),
  };
  return { state: touch(append(st, entry, undefined, ctx.now), ctx.now), seq: entry.seq, duplicated: false };
}

/* ── 비교시험 측정 ─────────────────────────────────── */

function checkTrial(s: LabState, v: TrialValues) {
  if (!DATE_RE.test(v.date)) fail("[입력] 시험 날짜를 넣어 주세요.");
  if (!s.people.some((p) => p.id === v.participantId)) fail("[입력] 참가자를 고르세요.");
  if (!s.people.some((p) => p.id === v.operatorId)) fail("[입력] 실제 입력자(진행자)를 고르세요.");
  if (!TRIAL_METHODS.includes(v.method)) fail("[입력] 시험 유형(수기 / AX)을 고르세요.");
  if (!v.scenario.trim()) fail("[입력] 시나리오를 넣어 주세요.");
  for (const [k, n] of [
    ["위험 발견 소요시간", v.t1Sec],
    ["재판단 소요시간", v.t2Sec],
    ["정확히 발견한 위험", v.correct],
    ["놓친 위험", v.missed],
    ["잘못 판단한 위험", v.wrong],
    ["정답 위험 수", v.expected],
  ] as const)
    if (n !== null && !(Number.isFinite(n) && n >= 0)) fail(`[입력] ${k}는 0 이상의 숫자이거나 비워 두세요.`);
}

const TRIAL_KEYS: (keyof TrialValues)[] = [
  "date", "participantId", "operatorId", "method", "scenarioType", "scenario", "pairKey", "t1Sec", "t2Sec", "t1Timeout", "t2Timeout",
  "stamps", "correct", "expected", "missed", "missedNote", "wrong", "wrongNote", "followUp", "followUpNote", "measureMethod", "rawRef",
  "issues", "confirmedByParticipant", "note",
];

export function trialValues(t: TrialValues): TrialValues {
  return Object.fromEntries(TRIAL_KEYS.map((k) => [k, t[k]])) as unknown as TrialValues;
}

export function addTrial(s: LabState, v: TrialValues, by: string, ctx: Ctx): { state: LabState; id: string } {
  checkTrial(s, v);
  const id = ctx.id();
  const run: TrialRun = { ...v, id, no: s.trials.length + 1, createdAt: ctx.now.toISOString(), createdBy: by, history: [], voided: null };
  return { state: touch({ ...s, trials: [...s.trials, run] }, ctx.now), id };
}

export function editTrial(s: LabState, id: string, v: TrialValues, by: string, ctx: Ctx): LabState {
  const t = s.trials.find((x) => x.id === id) ?? fail("[입력] 측정 기록을 찾을 수 없습니다.");
  if (t.voided) fail("[입력] 무효 처리된 기록은 고칠 수 없습니다.");
  checkTrial(s, v);
  const next: TrialRun = { ...t, ...v, history: [...t.history, { at: ctx.now.toISOString(), by, values: trialValues(t) }] };
  return touch({ ...s, trials: s.trials.map((x) => (x.id === id ? next : x)) }, ctx.now);
}

export function voidTrial(s: LabState, id: string, reason: string, by: string, ctx: Ctx): LabState {
  const t = s.trials.find((x) => x.id === id) ?? fail("[입력] 측정 기록을 찾을 수 없습니다.");
  if (t.voided) return s;
  if (!reason.trim()) fail("[입력] 무효 사유를 넣어 주세요.");
  return touch({ ...s, trials: s.trials.map((x) => (x.id === id ? { ...x, voided: { at: ctx.now.toISOString(), by, reason: reason.trim() } } : x)) }, ctx.now);
}

/* ── 문제·피드백 기록 ──────────────────────────────── */

export function addNote(s: LabState, v: NoteValues, by: string, ctx: Ctx): { state: LabState; id: string } {
  if (!v.text.trim()) fail("[입력] 내용을 넣어 주세요.");
  if (!NOTE_TYPES.includes(v.type)) fail("[입력] 종류를 고르세요.");
  const id = ctx.id();
  const n: Note = { ...v, text: v.text.trim(), id, no: s.notes.length + 1, at: ctx.now.toISOString(), recordedBy: by, history: [] };
  return { state: touch({ ...s, notes: [...s.notes, n] }, ctx.now), id };
}

export function editNote(s: LabState, id: string, v: NoteValues, by: string, ctx: Ctx): LabState {
  const n = s.notes.find((x) => x.id === id) ?? fail("[입력] 기록을 찾을 수 없습니다.");
  if (!v.text.trim()) fail("[입력] 내용을 넣어 주세요.");
  const old: NoteValues = { type: n.type, text: n.text, speakerId: n.speakerId, confirmation: n.confirmation, status: n.status, sessionId: n.sessionId, trialId: n.trialId };
  return touch({ ...s, notes: s.notes.map((x) => (x.id === id ? { ...x, ...v, text: v.text.trim(), history: [...x.history, { at: ctx.now.toISOString(), by, values: old }] } : x)) }, ctx.now);
}

export function setReportText(s: LabState, r: ReportText, ctx: Ctx): LabState {
  return touch({ ...s, report: r }, ctx.now);
}

/** 백업 표시 — changeCount 는 백업 파일에 담긴 기록 시점의 값 (그 사이 새 기록이 있으면 '백업 뒤 변경'으로 남는다) */
export function markBackup(s: LabState, file: string, ctx: Ctx, changeCount = s.changeCount): LabState {
  // 백업 표시 자체는 '바뀐 기록'으로 세지 않는다
  return { ...s, backup: { lastAt: ctx.now.toISOString(), lastChangeCount: changeCount, lastFile: file } };
}

export const unsavedChanges = (s: LabState) => s.changeCount - s.backup.lastChangeCount;

/* ── 회차 ──────────────────────────────────────────── */

/** 같은 참가자·같은 날짜 안에서 몇 번째인지 (세트·측정 공통) */
export function roundOf<T extends { id: string; createdAt: string }>(list: T[], item: T, key: (x: T) => string): number {
  const k = key(item);
  return list.filter((x) => key(x) === k && x.createdAt <= item.createdAt).length;
}

export const sessionRound = (s: LabState, x: Session) => roundOf(s.sessions, x, (o) => `${o.participantId}|${kst(o.createdAt).date}`);
export const trialRound = (s: LabState, x: TrialRun) => roundOf(s.trials, x, (o) => `${o.participantId}|${o.date}`);

/** 반복 회차 번호 — 원본 세트를 1회로 센다 */
export function repeatNo(s: LabState, x: Session): number {
  const root = x.basedOn ?? x.id;
  const family = s.sessions.filter((o) => o.id === root || o.basedOn === root).sort((a, b) => a.no - b.no);
  return family.findIndex((o) => o.id === x.id) + 1;
}

/* ── 화면용 도우미 ─────────────────────────────────── */

export type Phase = "예정" | "확인함" | "작업 중" | "작업 종료" | "취소";

export function labProgress(x: Snap, events: EventEntry[]) {
  const mine = activeLabEvents(events.filter((e) => e.scheduleId === x.id));
  const first = (k: PilotEventKind) => mine.find((e) => e.kind === k);
  const reports = mine.filter((e) => e.kind === "예상 종료 보고");
  const ack = first("업무 확인");
  const start = first("작업개시");
  const end = first("작업종료");
  const phase: Phase = x.status === "취소" ? "취소" : end ? "작업 종료" : start ? "작업 중" : ack ? "확인함" : "예정";
  return { phase, ack, start, end, report: reports.at(-1) };
}

/** 일정판 알림 — 취소 일정 때문에 이동 기준 재확인 필요(R7) · 이동시간 넣은 뒤 직전 일정이 바뀜 */
export function scheduleHints(s: LabState, sessionId: string) {
  const session = sessionOf(s, sessionId);
  const list = currentSchedules(s, sessionId);
  const rows = list.map((x) => toScheduleRow(session, x));
  const title = (id: string | null) => list.find((o) => o.id === id)?.siteName ?? null;
  return new Map(
    list.map((x, i) => [
      x.id,
      {
        cancelledBefore: cancelledBetween(rows[i], rows).map((o) => o.site_name),
        stale: travelBasisStale(rows[i], rows),
        fromTitle: title(x.travelFromId),
      },
    ]),
  );
}

/** 현장기사 화면용 — 이 일정 때문에 다음 현장이 늦거나, 앞 현장 때문에 이 현장이 늦는지 (계산값) */
export function delayNotes(result: PipelineResult, scheduleId: string): string[] {
  const out: string[] = [];
  for (const l of result.risk.links) {
    if (l.status !== "판정" || l.shortfall <= 0) continue;
    if (l.prev.id === scheduleId) out.push(`다음 현장 ${l.next.title}에 ${l.shortfall}분 늦게 도착할 것으로 계산됐습니다 (계산값 · ${gradeText(l)})`);
    if (l.next.id === scheduleId) out.push(`앞 현장 ${l.prev.title} 때문에 이 현장 도착이 ${l.shortfall}분 늦을 것으로 계산됐습니다 (계산값 · ${gradeText(l)})`);
  }
  return out;
}

export const labTitles = (s: LabState, sessionId: string) => Object.fromEntries(currentSchedules(s, sessionId).map((x) => [x.id, x.siteName]));
export const labNames = (s: LabState) => Object.fromEntries(s.people.map((p) => [p.id, p.name]));
