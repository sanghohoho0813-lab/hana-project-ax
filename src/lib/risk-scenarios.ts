/**
 * 기술검증 시나리오 — 연쇄위험 판단엔진 시험용 가상 입력값
 *
 * - 데모 업무 데이터(ops-data)와 분리된 검증 전용 데이터다. 실제 운영데이터가 아니다.
 * - 같은 데이터를 화면(/demo/verify)과 자동 테스트(tests/)가 함께 쓴다.
 * - 이동시간은 시나리오에 적은 입력값이며 실시간 교통정보가 아니다.
 */
import { evaluateChainRisk, riskyLinks, type RiskGrade, type RiskResult, type SiteInput } from "./risk-engine";
import { findConflicts } from "./ops-calc";
import type { ScheduleItem } from "./ops-types";

export const SCENARIO_DATE = "2026-07-28";
/** 시나리오 기준시각 — 데모 기준시각과 같게 둔다 (재현 가능) */
export const SCENARIO_AS_OF = "2026-07-28T10:40";

export const SCENARIO_WORKERS: Record<string, string> = {
  W1: "작업자 1 (예시)",
  W2: "작업자 2 (예시)",
};

const site = (p: Partial<SiteInput> & Pick<SiteInput, "id" | "title" | "plannedStart" | "plannedEnd">): SiteInput => ({
  workerId: "W1",
  date: SCENARIO_DATE,
  status: "예정",
  travelSource: "입력값",
  ...p,
});

const A = (p: Partial<SiteInput> = {}) =>
  site({ id: "A", title: "A현장", region: "충남 서천", plannedStart: "09:00", plannedEnd: "11:00", status: "진행 중", travelMinutes: 0, ...p });
const B = (p: Partial<SiteInput> = {}) =>
  site({ id: "B", title: "B현장", region: "충남 보령", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30, ...p });
const C = (p: Partial<SiteInput> = {}) =>
  site({ id: "C", title: "C현장", region: "충남 홍성", plannedStart: "12:55", plannedEnd: "14:00", travelMinutes: 20, ...p });

export interface ScenarioCase {
  id: string;
  label: string;
  inputs: SiteInput[];
  /** 기대 결과 — 화면과 테스트가 같은 기준으로 확인한다 */
  expect: {
    /** 연결별 기대값 (key = "A>B") */
    links?: Record<string, { status?: "판정" | "판단 보류" | "해당 없음"; grade?: RiskGrade; slack?: number; arrival?: string }>;
    /** '중간' 이상 위험 연결 수 */
    risky: number;
    /** 판정에서 빠져야 하는 일정 */
    excluded?: string[];
    /** 있어야 하는 데이터 문제 종류 */
    issues?: string[];
  };
  note: string;
}

export interface Scenario {
  id: "A" | "B" | "C" | "D" | "E";
  title: string;
  summary: string;
  cases: ScenarioCase[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "A",
    title: "정상",
    summary: "A현장이 예정대로 11:00에 끝나면 이동 30분 뒤 11:30 도착 — B현장 11:40 시작까지 10분 여유",
    cases: [
      {
        id: "A",
        label: "예정대로 종료",
        inputs: [A(), B()],
        expect: { links: { "A>B": { status: "판정", grade: "없음", slack: 10, arrival: "11:30" } }, risky: 0 },
        note: "후속 현장 위험 없음",
      },
    ],
  },
  {
    id: "B",
    title: "선행 현장 지연",
    summary: "A현장 종료 예상이 11:25로 25분 늦어짐 (현장 보고)",
    cases: [
      {
        id: "B",
        label: "A현장 예상 종료 11:25",
        inputs: [A({ expectedEnd: "11:25", expectedEndSource: "현장 보고" }), B()],
        expect: { links: { "A>B": { status: "판정", grade: "높음", slack: -15, arrival: "11:55" } }, risky: 1 },
        note: "B현장은 아직 시작 전이지만 15분 지연 위험을 먼저 감지",
      },
    ],
  },
  {
    id: "C",
    title: "일정 조정",
    summary: "시나리오 B 상태에서 B현장 시작을 12:10으로 조정",
    cases: [
      {
        id: "C",
        label: "B현장 12:10 시작",
        inputs: [A({ expectedEnd: "11:25", expectedEndSource: "현장 보고" }), B({ plannedStart: "12:10", plannedEnd: "13:00" })],
        expect: { links: { "A>B": { status: "판정", grade: "없음", slack: 15, arrival: "11:55" } }, risky: 0 },
        note: "이동 가능 여부를 다시 계산해 위험 해소",
      },
    ],
  },
  {
    id: "D",
    title: "복수 현장 연쇄",
    summary: "같은 작업자가 A → B → C 현장을 차례로 담당. A현장 25분 지연",
    cases: [
      {
        id: "D",
        label: "A 11:25 종료 → B → C",
        inputs: [A({ expectedEnd: "11:25", expectedEndSource: "현장 보고" }), B(), C()],
        expect: {
          links: {
            "A>B": { status: "판정", grade: "높음", slack: -15, arrival: "11:55" },
            "B>C": { status: "판정", grade: "높음", slack: -10, arrival: "13:05" },
          },
          risky: 2,
        },
        note: "B현장이 15분 늦게 시작해 12:45에 끝나고, C현장 12:55 시작에 10분 늦게 도착 — 예정값만 보면 둘 다 문제없음",
      },
    ],
  },
  {
    id: "E",
    title: "예외상황",
    summary: "담당자 변경 · 일정 취소 · 이동시간 누락 · 잘못된 시각·날짜 · 중복 입력",
    cases: [
      {
        id: "E1",
        label: "담당자 변경",
        inputs: [A({ expectedEnd: "11:25", expectedEndSource: "현장 보고" }), B({ workerId: "W2" })],
        expect: { links: {}, risky: 0 },
        note: "B현장이 작업자 2에게 넘어가 A→B 연결이 사라짐 — 위험 해소, 오판정 없음",
      },
      {
        id: "E2",
        label: "중간 일정 취소",
        inputs: [A({ expectedEnd: "11:25", expectedEndSource: "현장 보고" }), B({ status: "취소" }), C()],
        expect: { links: { "A>C": { status: "판단 보류" } }, risky: 0, excluded: ["B"], issues: ["이동 기준 불일치"] },
        note: "C현장의 이동시간 20분은 B현장 출발 기준이라 A→C에 그대로 쓰지 않고 '판단 보류'로 표시",
      },
      {
        id: "E3",
        label: "이동시간 누락",
        inputs: [A({ expectedEnd: "11:25", expectedEndSource: "현장 보고" }), B({ travelMinutes: null })],
        expect: { links: { "A>B": { status: "판단 보류" } }, risky: 0, issues: ["이동시간 누락"] },
        note: "이동시간을 0분으로 가정하지 않고 판단을 보류 — '정상'으로 잘못 보이지 않게 한다",
      },
      {
        id: "E4",
        label: "잘못된 시각 (25:70)",
        inputs: [A(), B({ plannedStart: "25:70" }), C()],
        expect: { links: { "A>C": { status: "판단 보류" } }, risky: 0, excluded: ["B"], issues: ["시각 형식 오류"] },
        note: "시각을 읽을 수 없는 일정은 빼고, 연결 순서를 확정할 수 없으니 같은 날 연결은 보류",
      },
      {
        id: "E5",
        label: "시간 역전 (12:30~11:40)",
        inputs: [A(), B({ plannedStart: "12:30", plannedEnd: "11:40" }), C()],
        expect: { links: { "A>C": { status: "판단 보류" } }, risky: 0, excluded: ["B"], issues: ["시간 역전", "이동 기준 불일치"] },
        note: "종료가 시작보다 빠른 일정은 빼고, 그 뒤 연결은 이동 기준이 맞지 않아 보류",
      },
      {
        id: "E6",
        label: "잘못된 날짜 (2026-02-30)",
        inputs: [A(), B({ date: "2026-02-30" })],
        expect: { links: {}, risky: 0, excluded: ["B"], issues: ["날짜 오류"] },
        note: "없는 날짜의 일정은 판정에서 빼고 데이터 오류로 알림",
      },
      {
        id: "E7",
        label: "같은 일정 중복 입력",
        inputs: [A({ expectedEnd: "11:25", expectedEndSource: "현장 보고" }), B(), B()],
        expect: { links: { "A>B": { status: "판정", grade: "높음", slack: -15 } }, risky: 1, excluded: ["B"], issues: ["중복 데이터"] },
        note: "중복된 B현장은 한 번만 계산 — 위험이 두 번 잡히지 않음",
      },
    ],
  },
];

export function runCase(c: ScenarioCase): RiskResult {
  return evaluateChainRisk(c.inputs, { asOf: SCENARIO_AS_OF });
}

/** 기대 결과와 실제 결과를 대조한다 — 어긋난 항목 목록 (비어 있으면 일치) */
export function checkCase(c: ScenarioCase, r: RiskResult = runCase(c)): string[] {
  const bad: string[] = [];
  const e = c.expect;
  if (riskyLinks(r).length !== e.risky) bad.push(`위험 연결 수 기대 ${e.risky} · 실제 ${riskyLinks(r).length}`);
  if (e.links) {
    const keys = Object.keys(e.links);
    if (keys.length === 0 && r.links.length > 0) bad.push(`연결이 없어야 하는데 ${r.links.map((l) => l.key).join(", ")} 이(가) 있음`);
    for (const k of keys) {
      const l = r.links.find((x) => x.key === k);
      const x = e.links[k];
      if (!l) {
        bad.push(`${k} 연결 없음`);
        continue;
      }
      if (x.status && l.status !== x.status) bad.push(`${k} 상태 기대 ${x.status} · 실제 ${l.status}`);
      if (x.grade && l.grade !== x.grade) bad.push(`${k} 등급 기대 ${x.grade} · 실제 ${l.grade}`);
      if (x.slack !== undefined && l.slack !== x.slack) bad.push(`${k} 여유 기대 ${x.slack} · 실제 ${l.slack}`);
      if (x.arrival && l.arrival !== x.arrival) bad.push(`${k} 도착 기대 ${x.arrival} · 실제 ${l.arrival}`);
    }
  }
  for (const id of e.excluded ?? []) if (!r.excluded.some((x) => x.id === id)) bad.push(`${id} 제외 안 됨`);
  for (const k of e.issues ?? []) if (!r.issues.some((x) => x.kind === k)) bad.push(`데이터 문제 '${k}' 없음`);
  return bad;
}

/* ── 기준 방식(기존 정적 충돌 검사)과 비교 ───────────────── */

/** 시나리오 입력을 기존 일정 형식으로 바꾼다 — 기존 findConflicts 에 그대로 넣기 위함 */
export function toScheduleItem(s: SiteInput): ScheduleItem {
  return {
    id: s.id,
    title: s.title,
    region: s.region ?? "",
    assigneeId: s.workerId,
    date: s.date,
    start: s.plannedStart,
    end: s.plannedEnd,
    travelMinutes: typeof s.travelMinutes === "number" ? s.travelMinutes : 0,
    status: s.status,
  };
}

export interface BaselineComparison {
  caseId: string;
  label: string;
  /** 기존 정적 충돌 검사(findConflicts)가 잡은 연결 */
  baseline: string[];
  /** 연쇄위험 엔진이 '중간' 이상으로 잡은 연결 */
  engine: string[];
  /** 엔진이 판단 보류로 표시한 연결 */
  held: string[];
  /** 엔진만 잡은 연결 */
  engineOnly: string[];
  /** 기준 방식만 잡은 연결 */
  baselineOnly: string[];
}

export function compareWithBaseline(c: ScenarioCase): BaselineComparison {
  const date = c.inputs[0]?.date ?? SCENARIO_DATE;
  const baseline = findConflicts(c.inputs.map(toScheduleItem), date).map((x) => `${x.a.id}>${x.b.id}`);
  const r = runCase(c);
  const engine = riskyLinks(r).map((l) => l.key);
  const held = r.links.filter((l) => l.status === "판단 보류").map((l) => l.key);
  return {
    caseId: c.id,
    label: c.label,
    baseline: [...new Set(baseline)].sort(),
    engine: engine.sort(),
    held: held.sort(),
    engineOnly: engine.filter((k) => !baseline.includes(k)).sort(),
    baselineOnly: [...new Set(baseline)].filter((k) => !engine.includes(k)).sort(),
  };
}

export const ALL_CASES: ScenarioCase[] = SCENARIOS.flatMap((s) => s.cases);
