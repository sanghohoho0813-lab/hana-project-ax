/**
 * 상태이벤트 검증 시나리오 — 실제 작업상태 이벤트부터 관리자 조치 후 재판단까지
 *
 * - 데모 업무 데이터와 분리된 검증용 가상 데이터다. 실제 운영데이터가 아니다.
 * - 같은 데이터를 화면(/demo/verify)과 자동 테스트가 함께 쓴다.
 * - 각 단계는 기준시각(asOf)을 따로 고정해 결과를 재현한다.
 */
import type { SiteInput } from "./risk-engine";
import { runStatePipeline, type PipelineResult, type StateEvent, type WorkContext } from "./state-events";

export const FLOW_DATE = "2026-07-28";

const site = (p: Partial<SiteInput> & Pick<SiteInput, "id" | "title" | "workerId" | "plannedStart" | "plannedEnd">): SiteInput => ({
  date: FLOW_DATE,
  status: "예정",
  travelSource: "입력값",
  ...p,
});

/** 예정 일정 — 작업자 1: A → B → C, 작업자 2: D → E */
export const FLOW_PLANNED: SiteInput[] = [
  site({ id: "A", title: "A현장", region: "충남 서천", workerId: "W1", plannedStart: "09:00", plannedEnd: "11:00", travelMinutes: 0 }),
  site({ id: "B", title: "B현장", region: "충남 보령", workerId: "W1", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 }),
  site({ id: "C", title: "C현장", region: "충남 홍성", workerId: "W1", plannedStart: "12:55", plannedEnd: "14:00", travelMinutes: 20 }),
  site({ id: "D", title: "D현장", region: "전북 군산", workerId: "W2", plannedStart: "09:30", plannedEnd: "11:30", travelMinutes: 0 }),
  site({ id: "E", title: "E현장", region: "전북 익산", workerId: "W2", plannedStart: "12:00", plannedEnd: "13:00", travelMinutes: 35 }),
];

/** 일정별 업무 정보 (가상) — C현장은 연결 업무가 없다 */
export const FLOW_CONTEXTS: WorkContext[] = [
  { siteId: "A", taskId: "TA", assignedAt: "2026-07-27T17:00", dueAt: "2026-07-28T12:00", needsReport: true, priority: "보통" },
  { siteId: "B", taskId: "TB", assignedAt: "2026-07-28T07:00", dueAt: "2026-07-28T15:00", needsReport: true, priority: "긴급" },
  { siteId: "C" },
  { siteId: "D", taskId: "TD", assignedAt: "2026-07-27T16:00", dueAt: "2026-07-28T12:30", needsReport: true, priority: "보통" },
  { siteId: "E", taskId: "TE", assignedAt: "2026-07-27T16:00", dueAt: "2026-07-28T14:00", needsReport: false, priority: "보통" },
];

const ev = (id: string, kind: StateEvent["kind"], siteId: string, at: string | undefined, source: string, value?: string): StateEvent => ({
  id,
  kind,
  siteId,
  at,
  value,
  source,
  origin: "검증 시나리오",
});

/** 1단계 시점까지 있었던 이벤트 */
const EVENTS_0: StateEvent[] = [
  ev("e1", "업무 확인", "A", "2026-07-27T17:30", "업무 확인 버튼"),
  ev("e2", "업무 확인", "D", "2026-07-27T16:40", "업무 확인 버튼"),
  ev("e3", "업무 확인", "E", "2026-07-27T16:40", "업무 확인 버튼"),
];
/** 2단계에서 들어오는 실제 이벤트 */
export const EVENTS_STEP2: StateEvent[] = [
  ev("e4", "작업개시", "A", "2026-07-28T09:25", "작업 시작 버튼"),
  ev("e5", "업무 확인", "B", "2026-07-28T09:20", "업무 확인 버튼"),
  ev("e6", "작업개시", "D", "2026-07-28T09:30", "작업 시작 버튼"),
];

export interface FlowState {
  id: "S0" | "S1" | "S2" | "S3";
  asOf: string;
  planned: SiteInput[];
  events: StateEvent[];
  /** 이 상태에 반영된 관리자 조치 */
  actions: string[];
}

const move = (list: SiteInput[], id: string, start: string, end: string) => list.map((s) => (s.id === id ? { ...s, plannedStart: start, plannedEnd: end } : s));

export const FLOW_STATES: Record<FlowState["id"], FlowState> = {
  S0: { id: "S0", asOf: "2026-07-28T09:00", planned: FLOW_PLANNED, events: EVENTS_0, actions: [] },
  S1: { id: "S1", asOf: "2026-07-28T09:30", planned: FLOW_PLANNED, events: [...EVENTS_0, ...EVENTS_STEP2], actions: [] },
  S2: {
    id: "S2",
    asOf: "2026-07-28T09:35",
    planned: move(FLOW_PLANNED, "B", "12:10", "13:00"),
    events: [...EVENTS_0, ...EVENTS_STEP2],
    actions: ["B현장 시작 11:40 → 12:10 (작업시간 50분 유지)"],
  },
  S3: {
    id: "S3",
    asOf: "2026-07-28T09:40",
    planned: move(move(FLOW_PLANNED, "B", "12:10", "13:00"), "C", "13:25", "14:30"),
    events: [...EVENTS_0, ...EVENTS_STEP2],
    actions: ["B현장 시작 11:40 → 12:10 (작업시간 50분 유지)", "C현장 시작 12:55 → 13:25 (작업시간 65분 유지)"],
  },
};

/** 검증 화면과 테스트가 쓰는 가정 — 화면에 그대로 표시한다 */
export const FLOW_ASSUME_DURATION_KEPT = true;

export function runFlow(id: FlowState["id"]): PipelineResult {
  const s = FLOW_STATES[id];
  return runStatePipeline({
    planned: s.planned,
    events: s.events,
    contexts: FLOW_CONTEXTS,
    asOf: s.asOf,
    assumeDurationKept: FLOW_ASSUME_DURATION_KEPT,
  });
}

export type StepFocus = "상태" | "이벤트" | "편차" | "예상 종료" | "연쇄위험" | "우선순위" | "조치" | "재판단";

export interface FlowStep {
  n: number;
  title: string;
  desc: string;
  focus: StepFocus;
  /** 변경 전 / 변경 후 상태 */
  before: FlowState["id"] | null;
  after: FlowState["id"];
  rules: string[];
}

export const FLOW_STEPS: FlowStep[] = [
  { n: 1, title: "정상 업무 상태 및 일정 확인", desc: "09:00 기준. 작업자 1은 A → B → C, 작업자 2는 D → E 일정. 작업자 2는 예정 단계부터 이동시간이 5분 모자란다.", focus: "상태", before: null, after: "S0", rules: ["S2", "R1", "R3", "R4"] },
  { n: 2, title: "A현장 실제 작업개시 지연 이벤트 입력", desc: "09:25 A현장 작업 시작(예정 09:00), 09:20 B현장 업무 확인(기준 09:00), 09:30 D현장 작업 시작(정시).", focus: "이벤트", before: "S0", after: "S1", rules: ["S1"] },
  { n: 3, title: "기대상태와 실제상태 편차 확인", desc: "단계별로 따로 계산한다. A현장 작업개시 25분 늦음 / B현장 업무 확인 20분 늦음 — 합산하지 않는다.", focus: "편차", before: "S0", after: "S1", rules: ["S2", "S3"] },
  { n: 4, title: "A현장 예상 종료시각 갱신", desc: "작업개시 지연만 예상 종료에 반영한다 (작업시간 유지 가정). 업무 확인 지연은 반영하지 않는다.", focus: "예상 종료", before: "S0", after: "S1", rules: ["S4", "R2", "R2-2"] },
  { n: 5, title: "B·C현장 연쇄위험 재산출", desc: "A현장 예상 종료 11:25 → B현장 도착 11:55 (15분 부족) → B현장 종료 12:45 → C현장 도착 13:05 (10분 부족).", focus: "연쇄위험", before: "S0", after: "S1", rules: ["R3", "R4", "R5"] },
  { n: 6, title: "관리자 대응 우선순위 산출", desc: "같은 지연에서 나온 B·C현장 위험은 한 항목으로 묶고, 작업자 2의 이동시간 부족과 점수로 비교한다.", focus: "우선순위", before: "S0", after: "S1", rules: ["P1", "P2", "P3"] },
  { n: 7, title: "관리자 일정 조정", desc: "관리자가 1순위 B현장 시작을 12:10으로 조정한다 (작업시간 유지). 시스템은 일정을 스스로 바꾸지 않는다.", focus: "조치", before: "S1", after: "S2", rules: ["R9"] },
  { n: 8, title: "위험 재판단 및 우선순위 갱신", desc: "A→B 위험은 해소된다. 그러나 B현장이 13:00에 끝나 C현장(12:55 시작)과 예정 시간이 겹치게 되어 C현장이 새 1순위(일정 중복)로 올라온다.", focus: "재판단", before: "S1", after: "S2", rules: ["R4", "P1", "P3"] },
  { n: 9, title: "추가 조치 후 재판단", desc: "관리자가 C현장 시작을 13:25로 조정한다. 작업자 1의 위험이 모두 해소되고 작업자 2 항목만 남는다.", focus: "재판단", before: "S2", after: "S3", rules: ["R4", "P1"] },
];

/* ── 3단계 검증 예시 (A → B 두 현장) ─────────────────── */

const AB: SiteInput[] = [
  site({ id: "A", title: "A현장", workerId: "W1", plannedStart: "09:00", plannedEnd: "11:00", travelMinutes: 0 }),
  site({ id: "B", title: "B현장", workerId: "W1", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 }),
];

export interface AbCase {
  id: string;
  label: string;
  planned: SiteInput[];
  events: StateEvent[];
  asOf: string;
  expect: { aEnd: string; aEndSource: string; arrival: string; slack: number; grade: string };
}

export const AB_CASES: AbCase[] = [
  {
    id: "1",
    label: "정상 — A현장 정시 시작",
    planned: AB,
    events: [ev("a1", "작업개시", "A", "2026-07-28T09:00", "작업 시작 버튼")],
    asOf: "2026-07-28T09:05",
    expect: { aEnd: "11:00", aEndSource: "예정", arrival: "11:30", slack: 10, grade: "없음" },
  },
  {
    id: "2",
    label: "작업개시 지연 — A현장 09:25 시작",
    planned: AB,
    events: [ev("a1", "작업개시", "A", "2026-07-28T09:25", "작업 시작 버튼")],
    asOf: "2026-07-28T09:30",
    expect: { aEnd: "11:25", aEndSource: "작업개시 지연 추정", arrival: "11:55", slack: -15, grade: "높음" },
  },
  {
    id: "3",
    label: "현장 보고로 수정 — 예상 종료 11:10",
    planned: AB,
    events: [ev("a1", "작업개시", "A", "2026-07-28T09:25", "작업 시작 버튼"), ev("a2", "예상 종료 보고", "A", "2026-07-28T10:00", "현장 보고", "11:10")],
    asOf: "2026-07-28T10:00",
    expect: { aEnd: "11:10", aEndSource: "현장 보고", arrival: "11:40", slack: 0, grade: "주의" },
  },
  {
    id: "4",
    label: "관리자 일정 조정 — B현장 12:10 시작",
    planned: AB.map((s) => (s.id === "B" ? { ...s, plannedStart: "12:10", plannedEnd: "13:00" } : s)),
    events: [ev("a1", "작업개시", "A", "2026-07-28T09:25", "작업 시작 버튼"), ev("a2", "예상 종료 보고", "A", "2026-07-28T10:00", "현장 보고", "11:10")],
    asOf: "2026-07-28T10:05",
    expect: { aEnd: "11:10", aEndSource: "현장 보고", arrival: "11:40", slack: 30, grade: "없음" },
  },
];

export function runAbCase(c: AbCase): PipelineResult {
  return runStatePipeline({ planned: c.planned, events: c.events, asOf: c.asOf, assumeDurationKept: true });
}
