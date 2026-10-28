/**
 * 비교실험 — 기존 정적 일정충돌 검사(findConflicts) vs 연쇄위험 판단엔진
 *
 * 같은 시험 데이터에서 두 방식이 감지한 위험을 비교하고, 결과를 docs/evidence/ 에 JSON으로 남긴다.
 * 이 결과는 '기존 코드 대비 기능검증'이다. 외부 상용 제품과 비교한 것이 아니다.
 * 출력 내용에 실행 시각을 넣지 않아, 같은 코드에서는 항상 같은 파일이 만들어진다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RISK_RULE_VERSION, RISK_RULES, THRESHOLDS, evaluateChainRisk, riskyLinks, type SiteInput } from "@/lib/risk-engine";
import { ALL_CASES, SCENARIO_AS_OF, compareWithBaseline, runCase, toScheduleItem } from "@/lib/risk-scenarios";
import { chainRisk, findConflicts } from "@/lib/ops-calc";
import { SCHEDULES } from "@/lib/ops-data";

const OUT = join(process.cwd(), "docs", "evidence");
const write = (name: string, data: unknown) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
};

describe("비교실험 1 — 검증 시나리오 A~E", () => {
  const rows = ALL_CASES.map(compareWithBaseline);

  it("선행 지연·연쇄 지연은 엔진만 감지한다 (기준 방식은 예정값만 본다)", () => {
    const by = Object.fromEntries(rows.map((r) => [r.caseId, r]));
    expect(by.B.baseline).toEqual([]);
    expect(by.B.engine).toEqual(["A>B"]);
    expect(by.D.baseline).toEqual([]);
    expect(by.D.engine).toEqual(["A>B", "B>C"]);
    expect(by.A.baseline).toEqual([]);
    expect(by.A.engine).toEqual([]);
    expect(by.C.engine).toEqual([]);
  });

  it("데이터 오류는 엔진이 '판단 보류'로 표시하고, 기준 방식은 오류를 구분하지 못한다", () => {
    const by = Object.fromEntries(rows.map((r) => [r.caseId, r]));
    for (const id of ["E2", "E3", "E4", "E5"]) {
      expect(by[id].engine).toEqual([]);
      expect(by[id].held.length).toBeGreaterThan(0);
    }
    // 중복 입력: 기준 방식은 같은 일정끼리 '겹침'으로 잘못 잡는다. 엔진은 중복을 걸러내고 실제 지연 위험만 잡는다
    expect(by.E7.baseline).toEqual(["B>B"]);
    expect(by.E7.engine).toEqual(["A>B"]);
  });

  it("결과를 docs/evidence/baseline-comparison.json 으로 남긴다", () => {
    write("baseline-comparison.json", {
      note: "기존 코드(findConflicts) 대비 기능검증 결과입니다. 외부 상용 제품과의 비교가 아닙니다. 입력은 검증용 가상 시나리오입니다.",
      ruleVersion: RISK_RULE_VERSION,
      asOf: SCENARIO_AS_OF,
      rows,
      totals: {
        cases: rows.length,
        baselineDetected: rows.reduce((n, r) => n + r.baseline.length, 0),
        engineDetected: rows.reduce((n, r) => n + r.engine.length, 0),
        engineOnly: rows.reduce((n, r) => n + r.engineOnly.length, 0),
        baselineOnly: rows.reduce((n, r) => n + r.baselineOnly.length, 0),
        engineHeld: rows.reduce((n, r) => n + r.held.length, 0),
      },
    });
  });
});

describe("비교실험 2 — 선행 현장 예상 종료를 5분씩 늦출 때", () => {
  const ends = ["11:00", "11:05", "11:10", "11:15", "11:20", "11:25", "11:30", "11:35", "11:40", "11:45"];
  const inputsFor = (end: string): SiteInput[] => [
    { id: "A", title: "A현장", workerId: "W1", date: "2026-07-28", plannedStart: "09:00", plannedEnd: "11:00", status: "진행 중", expectedEnd: end, expectedEndSource: "관리자 입력" },
    { id: "B", title: "B현장", workerId: "W1", date: "2026-07-28", plannedStart: "11:40", plannedEnd: "12:30", status: "예정", travelMinutes: 30, travelSource: "입력값" },
  ];
  const sweep = ends.map((end) => {
    const inputs = inputsFor(end);
    const l = evaluateChainRisk(inputs, { asOf: SCENARIO_AS_OF }).links[0];
    return {
      expectedEnd: end,
      baselineDetected: findConflicts(inputs.map(toScheduleItem), "2026-07-28").length > 0,
      arrival: l.arrival,
      slack: l.slack,
      grade: l.grade,
      engineDetected: riskyLinks({ ...evaluateChainRisk(inputs, { asOf: SCENARIO_AS_OF }) }).length > 0,
    };
  });

  it("기준 방식은 예상 종료가 바뀌어도 결과가 그대로이고, 엔진은 여유가 0분 아래로 내려가는 11:15부터 감지한다", () => {
    expect(sweep.every((x) => !x.baselineDetected)).toBe(true);
    expect(sweep.filter((x) => x.engineDetected).map((x) => x.expectedEnd)).toEqual(["11:15", "11:20", "11:25", "11:30", "11:35", "11:40", "11:45"]);
    expect(sweep.map((x) => x.grade)).toEqual(["없음", "주의", "주의", "중간", "높음", "높음", "높음", "높음", "매우 높음", "매우 높음"]);
  });

  it("결과를 docs/evidence/delay-sweep.json 으로 남긴다", () => {
    write("delay-sweep.json", {
      note: "같은 A→B 일정(이동 30분 · B 11:40 시작)에서 A현장 예상 종료만 바꿔 본 결과입니다.",
      ruleVersion: RISK_RULE_VERSION,
      thresholds: THRESHOLDS,
      rows: sweep,
    });
  });
});

describe("비교실험 3 — 데모 일정 데이터 (화면에 나오는 일정)", () => {
  it("현재 데모 일정에서는 두 방식이 같은 1건(s1→s2)을 감지한다 — 데모 일정에는 예상 종료 보고가 없기 때문", () => {
    const r = chainRisk(SCHEDULES);
    expect(riskyLinks(r).map((l) => l.key)).toEqual(["s1>s2"]);
    expect(findConflicts(SCHEDULES).map((c) => `${c.a.id}>${c.b.id}`)).toEqual(["s1>s2"]);
  });

  it("데모 일정 판단 결과 전체를 docs/evidence/demo-schedule-risk.json 으로 남긴다", () => {
    const r = chainRisk(SCHEDULES);
    write("demo-schedule-risk.json", {
      note: "하나 프로젝트 AX 데모 일정 데이터(src/lib/ops-data.ts)를 데모 기준시각으로 판단한 결과입니다. 실제 운영데이터가 아닙니다.",
      baseline: findConflicts(SCHEDULES).map((c) => ({ key: `${c.a.id}>${c.b.id}`, reason: c.reason, gap: c.gap })),
      engine: r,
    });
  });
});

describe("시나리오 입력·결과 기록", () => {
  it("모든 시나리오의 입력값과 판단 결과를 docs/evidence/scenario-results.json 으로 남긴다", () => {
    write("scenario-results.json", {
      note: "검증용 가상 시나리오의 입력값과 엔진 판단 결과입니다. 실제 운영데이터가 아닙니다.",
      ruleVersion: RISK_RULE_VERSION,
      rules: RISK_RULES,
      thresholds: THRESHOLDS,
      asOf: SCENARIO_AS_OF,
      cases: ALL_CASES.map((c) => ({ id: c.id, label: c.label, note: c.note, expect: c.expect, inputs: c.inputs, result: runCase(c) })),
    });
    expect(true).toBe(true);
  });
});
