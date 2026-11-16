/**
 * 연쇄위험 판단엔진 자동 테스트 — 필수 검증 12항목 + 보조 검증
 * 실행: npm test
 */
import { describe, expect, it } from "vitest";
import {
  RISK_RULE_VERSION,
  diffRisk,
  evaluateChainRisk,
  riskyLinks,
  type SiteInput,
} from "@/lib/risk-engine";
import { ALL_CASES, SCENARIO_AS_OF, SCENARIOS, checkCase, runCase } from "@/lib/risk-scenarios";
import { chainRisk, findConflicts } from "@/lib/ops-calc";
import { SCHEDULES } from "@/lib/ops-data";

const AS_OF = SCENARIO_AS_OF;
const site = (p: Partial<SiteInput> & Pick<SiteInput, "id" | "plannedStart" | "plannedEnd">): SiteInput => ({
  title: `${p.id}현장`,
  workerId: "W1",
  date: "2026-07-28",
  status: "예정",
  travelSource: "입력값",
  ...p,
});
const run = (inputs: SiteInput[]) => evaluateChainRisk(inputs, { asOf: AS_OF });
const link = (r: ReturnType<typeof run>, key: string) => {
  const l = r.links.find((x) => x.key === key);
  if (!l) throw new Error(`연결 ${key} 없음 — ${r.links.map((x) => x.key).join(", ")}`);
  return l;
};
const caseOf = (id: string) => ALL_CASES.find((c) => c.id === id)!;

describe("1. 정상 일정 판정", () => {
  it("A현장 예정 종료 11:00 + 이동 30분 = 11:30 도착, B현장 11:40 시작 → 10분 여유, 위험 없음", () => {
    const r = runCase(caseOf("A"));
    const l = link(r, "A>B");
    expect(l.status).toBe("판정");
    expect(l.arrival).toBe("11:30");
    expect(l.slack).toBe(10);
    expect(l.grade).toBe("없음");
    expect(l.cause).toBe("정상");
    expect(l.actions).toEqual([]);
    expect(riskyLinks(r)).toHaveLength(0);
  });

  it("여유가 10분 미만이면 '주의'로만 보고 위험으로 세지 않는다", () => {
    const r = run([site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00" }), site({ id: "B", plannedStart: "11:35", plannedEnd: "12:30", travelMinutes: 30 })]);
    expect(link(r, "A>B").grade).toBe("주의");
    expect(riskyLinks(r)).toHaveLength(0);
  });
});

describe("2. 동일 작업자 일정 중복", () => {
  it("예정 시간이 겹치면 '시간 중복' · 매우 높음, 정적 검사에서도 걸리는 문제로 표시", () => {
    const r = run([site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00" }), site({ id: "B", plannedStart: "10:30", plannedEnd: "12:00", travelMinutes: 0 })]);
    const l = link(r, "A>B");
    expect(l.cause).toBe("시간 중복");
    expect(l.grade).toBe("매우 높음");
    expect(l.staticConflict).toBe(true);
    expect(l.rules).toContain("R6");
    expect(l.actions).toContain("중복 배정 확인");
  });
});

describe("3. 현장 간 이동시간 부족", () => {
  it("예정대로 끝나도 이동시간이 모자라면 '이동시간 부족' — 서천 11:00 종료, 이동 55분, 보령 11:30 시작 → 25분 부족", () => {
    const r = run([
      site({ id: "s1", plannedStart: "10:00", plannedEnd: "11:00" }),
      site({ id: "s2", plannedStart: "11:30", plannedEnd: "13:00", travelMinutes: 55 }),
    ]);
    const l = link(r, "s1>s2");
    expect(l.cause).toBe("이동시간 부족");
    expect(l.arrival).toBe("11:55");
    expect(l.shortfall).toBe(25);
    expect(l.grade).toBe("높음");
    expect(l.staticConflict).toBe(true);
  });
});

describe("4. 선행 현장 지연에 따른 후속 위험", () => {
  it("A현장 예상 종료 11:25 + 이동 30분 = 11:55 도착 → B현장 11:40 대비 15분 부족, 높음 (B현장은 시작 전)", () => {
    const r = runCase(caseOf("B"));
    const l = link(r, "A>B");
    expect(l.prev.plannedEnd).toBe("11:00");
    expect(l.prev.expectedEnd).toBe("11:25");
    expect(l.prev.endSource).toBe("현장 보고");
    expect(l.prev.delay).toBe(25);
    expect(l.next.plannedStart).toBe("11:40");
    expect(l.next.status).toBe("예정");
    expect(l.travel).toEqual({ minutes: 30, source: "입력값" });
    expect(l.arrival).toBe("11:55");
    expect(l.slack).toBe(-15);
    expect(l.shortfall).toBe(15);
    expect(l.grade).toBe("높음");
    expect(l.cause).toBe("선행 현장 지연");
    // 예정값만 보면 문제없는 일정 — 기존 정적 검사로는 잡히지 않는다
    expect(l.staticConflict).toBe(false);
    expect(l.actions).toEqual(["선행 현장 진행상황 확인", "후속 현장 일정 조정 검토", "대체 작업자 가능 여부 확인", "후속 현장 고객에게 지연 가능성 안내 검토"]);
    // 후속 현장 예상 시작·종료 (작업시간 50분 유지)
    const b = r.sites.find((s) => s.id === "B")!;
    expect(b.expectedStart).toBe("11:55");
    expect(b.expectedEnd).toBe("12:45");
    expect(b.startDelay).toBe(15);
    expect(b.delayRootId).toBe("A");
  });
});

describe("5. 지연시간 변경 시 위험 재계산", () => {
  const withEnd = (end: string) =>
    run([
      site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00", status: "진행 중", expectedEnd: end, expectedEndSource: "관리자 입력" }),
      site({ id: "B", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 }),
    ]);
  it.each([
    ["11:00", 10, "없음"],
    ["11:05", 5, "주의"],
    ["11:15", -5, "중간"],
    ["11:25", -15, "높음"],
    ["11:45", -35, "매우 높음"],
  ] as const)("A현장 예상 종료 %s → 여유 %i분 · %s", (end, slack, grade) => {
    const l = link(withEnd(end), "A>B");
    expect(l.slack).toBe(slack);
    expect(l.grade).toBe(grade);
  });
  it("11:00 → 11:25 변경을 판단 이력(diff)으로 추적하면 '신규 위험'과 영향받은 B현장이 나온다", () => {
    const d = diffRisk(withEnd("11:00"), withEnd("11:25"));
    expect(d.changes).toEqual([
      { key: "A>B", kind: "신규 위험", before: { status: "판정", grade: "없음", slack: 10 }, after: { status: "판정", grade: "높음", slack: -15 } },
    ]);
    expect(d.affectedSites.map((s) => s.id)).toEqual(["A", "B"]);
    expect(d.ruleVersion).toBe(RISK_RULE_VERSION);
  });
  it("11:25 → 11:45 로 더 늦어지면 '악화'", () => {
    expect(diffRisk(withEnd("11:25"), withEnd("11:45")).changes[0].kind).toBe("악화");
  });
});

describe("6. 위험 해소 후 상태 갱신", () => {
  it("B현장을 12:10 시작으로 조정하면 11:55 도착 · 15분 여유로 '해소'", () => {
    const before = runCase(caseOf("B"));
    const after = runCase(caseOf("C"));
    expect(link(after, "A>B").grade).toBe("없음");
    expect(link(after, "A>B").slack).toBe(15);
    expect(riskyLinks(after)).toHaveLength(0);
    const d = diffRisk(before, after);
    expect(d.changes.map((c) => c.kind)).toEqual(["해소"]);
    const b = d.affectedSites.find((s) => s.id === "B")!;
    expect(b.before).toEqual({ start: "11:55", end: "12:45" });
    expect(b.after).toEqual({ start: "12:10", end: "13:00" });
  });
});

describe("7. 3개 이상 현장의 연쇄 영향", () => {
  it("A 25분 지연 → B 15분 늦게 시작·12:45 종료 → C 12:55 시작에 10분 늦게 도착", () => {
    const r = runCase(caseOf("D"));
    const ab = link(r, "A>B");
    const bc = link(r, "B>C");
    expect(ab.grade).toBe("높음");
    expect(ab.downstream).toEqual(["B", "C"]);
    expect(bc.prev.expectedEnd).toBe("12:45");
    expect(bc.prev.endSource).toBe("연쇄 계산");
    expect(bc.arrival).toBe("13:05");
    expect(bc.slack).toBe(-10);
    expect(bc.grade).toBe("높음");
    expect(bc.cause).toBe("연쇄 지연");
    expect(bc.rootId).toBe("A");
    expect(bc.staticConflict).toBe(false);
    const c = r.sites.find((s) => s.id === "C")!;
    expect(c.expectedStart).toBe("13:05");
    expect(c.delayRootId).toBe("A");
  });
});

describe("8. 담당자 변경", () => {
  it("B현장을 다른 작업자에게 넘기면 A→B 연결이 사라지고 위험이 '연결 해제'로 기록된다", () => {
    const before = runCase(caseOf("B"));
    const after = runCase(caseOf("E1"));
    expect(after.links).toHaveLength(0);
    expect(riskyLinks(after)).toHaveLength(0);
    expect(diffRisk(before, after).changes).toEqual([
      { key: "A>B", kind: "연결 해제", before: { status: "판정", grade: "높음", slack: -15 }, after: null },
    ]);
  });
  it("넘겨받은 작업자의 일정과 새로 이어지면 그 연결을 새로 판단한다", () => {
    const r = run([
      site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00" }),
      site({ id: "X", workerId: "W2", plannedStart: "10:00", plannedEnd: "11:20" }),
      site({ id: "B", workerId: "W2", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 }),
    ]);
    expect(link(r, "X>B").shortfall).toBe(10);
    expect(link(r, "X>B").grade).toBe("높음");
  });
});

describe("9. 취소된 일정 제외", () => {
  it("취소 일정은 판정에서 빼고, 그 뒤 일정의 이동시간 기준이 맞지 않으면 판단 보류", () => {
    const r = runCase(caseOf("E2"));
    expect(r.excluded).toContainEqual({ id: "B", reason: "취소" });
    expect(r.links.map((l) => l.key)).toEqual(["A>C"]);
    expect(link(r, "A>C").status).toBe("판단 보류");
    expect(link(r, "A>C").grade).toBeNull();
    expect(riskyLinks(r)).toHaveLength(0);
  });
  it("마지막 일정이 취소되면 연결이 없다", () => {
    const r = run([site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00" }), site({ id: "B", plannedStart: "10:30", plannedEnd: "12:00", status: "취소" })]);
    expect(r.links).toHaveLength(0);
  });
});

describe("10. 입력 데이터 누락", () => {
  it("이동시간이 없으면 0분으로 가정하지 않고 판단 보류", () => {
    const r = runCase(caseOf("E3"));
    const l = link(r, "A>B");
    expect(l.status).toBe("판단 보류");
    expect(l.travel).toEqual({ minutes: null, source: "누락" });
    expect(l.arrival).toBeNull();
    expect(r.issues.map((i) => i.kind)).toContain("이동시간 누락");
  });
  it.each([undefined, null, Number.NaN, -10])("이동시간 %s 도 누락으로 처리", (v) => {
    const r = run([site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00" }), site({ id: "B", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: v as number })]);
    expect(link(r, "A>B").status).toBe("판단 보류");
  });
  it("담당 작업자가 비어 있으면 연결하지 않고 데이터 문제로 알린다", () => {
    const r = run([site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00" }), site({ id: "B", workerId: "", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 })]);
    expect(r.links).toHaveLength(0);
    expect(r.issues).toContainEqual(expect.objectContaining({ siteId: "B", kind: "작업자 누락" }));
  });
});

describe("11. 잘못된 날짜·시각", () => {
  it.each(["E4", "E5", "E6"])("시나리오 %s — 기대 결과와 일치하고 위험을 잘못 만들지 않는다", (id) => {
    expect(checkCase(caseOf(id))).toEqual([]);
    expect(riskyLinks(runCase(caseOf(id)))).toHaveLength(0);
  });
  it("예상 종료가 잘못되면 그 값을 버리고 예정 종료로 계산한다", () => {
    const r = run([
      site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00", status: "진행 중", expectedEnd: "11:7" }),
      site({ id: "B", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 }),
    ]);
    expect(link(r, "A>B").prev.endSource).toBe("예정");
    expect(link(r, "A>B").slack).toBe(10);
    expect(r.issues.map((i) => i.kind)).toContain("예상 종료 오류");
  });
  it("24:00 · 9:30 같은 형식은 읽지 않는다", () => {
    const r = run([site({ id: "A", plannedStart: "9:30", plannedEnd: "24:00" })]);
    expect(r.issues.map((i) => i.kind)).toEqual(["시각 형식 오류"]);
  });
});

describe("12. 같은 입력에서 같은 결과 (재현성)", () => {
  it.each(ALL_CASES.map((c) => [c.id, c] as const))("시나리오 %s — 두 번 계산해도, 입력 순서를 뒤집어도 같은 결과", (_id, c) => {
    const a = runCase(c);
    const b = runCase(c);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const reversed = evaluateChainRisk([...c.inputs].reverse(), { asOf: AS_OF });
    // 중복 입력(E7)은 순서에 따라 '어느 것이 중복인지'만 달라질 수 있어 연결 결과로 비교
    expect(JSON.stringify(reversed.links)).toBe(JSON.stringify(a.links));
    expect(JSON.stringify(reversed.sites)).toBe(JSON.stringify(a.sites));
  });
  it("입력 객체를 바꾸지 않는다 (엔진은 일정을 자동 변경하지 않음)", () => {
    const c = caseOf("D");
    const snapshot = JSON.stringify(c.inputs);
    runCase(c);
    expect(JSON.stringify(c.inputs)).toBe(snapshot);
  });
  it("판단 결과에 규칙 버전이 함께 남는다", () => {
    expect(runCase(caseOf("B")).ruleVersion).toBe(RISK_RULE_VERSION);
  });
});

/* ── 보조 검증 ──────────────────────────────────────── */

describe("보조: 모든 검증 시나리오가 기대 결과와 일치", () => {
  it.each(SCENARIOS.flatMap((s) => s.cases.map((c) => [`${s.id}·${c.id} ${c.label}`, c] as const)))("%s", (_n, c) => {
    expect(checkCase(c)).toEqual([]);
  });
});

describe("보조: 추정 규칙 (R2-1)", () => {
  it("진행 중인데 기준시각 10:40이 예정 종료 10:30을 지났고 보고가 없으면 종료를 최소 10:40으로 본다", () => {
    const r = run([
      site({ id: "A", plannedStart: "09:30", plannedEnd: "10:30", status: "진행 중" }),
      site({ id: "B", plannedStart: "11:00", plannedEnd: "12:00", travelMinutes: 30 }),
    ]);
    const l = link(r, "A>B");
    expect(l.prev.endSource).toBe("추정 규칙");
    expect(l.prev.expectedEnd).toBe("10:40");
    expect(l.slack).toBe(-10);
    expect(l.rules).toContain("R2-1");
    expect(l.actions[0]).toBe("현장에 종료 예상시각 보고 요청");
  });
  it("기준시각이 없으면 추정 규칙을 쓰지 않는다", () => {
    const r = evaluateChainRisk([
      site({ id: "A", plannedStart: "09:30", plannedEnd: "10:30", status: "진행 중" }),
      site({ id: "B", plannedStart: "11:00", plannedEnd: "12:00", travelMinutes: 30 }),
    ]);
    expect(link(r, "A>B").prev.endSource).toBe("예정");
  });
  it("실제 종료가 있으면 그 값을 가장 먼저 쓴다", () => {
    const r = run([
      site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00", status: "완료", actualEnd: "10:50", expectedEnd: "11:25" }),
      site({ id: "B", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 }),
    ]);
    expect(link(r, "A>B").prev.endSource).toBe("실제 종료");
    expect(link(r, "A>B").slack).toBe(20);
  });
  it("이미 시작된 후속 일정은 사전 판정에서 뺀다 (해당 없음)", () => {
    const r = run([
      site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00", expectedEnd: "11:25" }),
      site({ id: "B", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30, status: "진행 중" }),
    ]);
    expect(link(r, "A>B").status).toBe("해당 없음");
  });
});

describe("보조: 기존 일정 화면과 일관성 (데모 일정 데이터)", () => {
  it("데모 일정에서 엔진의 '예정값 기준 문제'는 기존 findConflicts 결과와 정확히 같다", () => {
    const r = chainRisk(SCHEDULES);
    const engineStatic = r.links.filter((l) => l.staticConflict).map((l) => l.key).sort();
    const baseline = findConflicts(SCHEDULES).map((c) => `${c.a.id}>${c.b.id}`).sort();
    expect(engineStatic).toEqual(baseline);
    expect(baseline).toEqual(["s1>s2"]);
  });
  it("데모 일정 s1→s2: 서천 11:00 종료 + 이동 55분(데모 가정값) = 11:55 도착, 보령 11:30 시작 대비 25분 부족", () => {
    const l = link(chainRisk(SCHEDULES), "s1>s2");
    expect(l.travel).toEqual({ minutes: 55, source: "데모 가정값" });
    expect(l.arrival).toBe("11:55");
    expect(l.shortfall).toBe(25);
    expect(l.grade).toBe("높음");
    expect(l.cause).toBe("이동시간 부족");
  });
});

describe("보조: 판단 이력 기록 (데모 세션)", () => {
  it("데모 일정에서 군산 현장 예상 종료를 13:40으로 바꾸면 홍성 현장 '신규 위험'과 영향 일정이 기록된다", async () => {
    const { buildRiskLogEntry } = await import("@/lib/risk-log");
    const before = SCHEDULES;
    const after = SCHEDULES.map((s) => (s.id === "s3" ? { ...s, expectedEnd: "13:40", expectedEndSource: "현장 보고" as const } : s));
    const e = buildRiskLogEntry(1, { kind: "예상 종료 입력", scheduleId: "s3", title: "군산", field: "예상 종료", before: "12:00 (예정)", after: "13:40 (현장 보고)", actorId: "u2" }, before, after);
    expect(e.demoAt).toBe("2026-07-28T10:40");
    expect(e.scope).toBe("데모 세션");
    expect(e.ruleVersion).toBe(RISK_RULE_VERSION);
    expect(e.changes).toEqual([
      { key: "s3>s4", kind: "신규 위험", before: { status: "판정", grade: "없음", slack: 85 }, after: { status: "판정", grade: "높음", slack: -15 } },
    ]);
    expect(e.after[0]).toMatchObject({ arrival: "15:15", cause: "선행 현장 지연" });
    expect(e.affectedSites.map((x) => x.id)).toEqual(["s3", "s4"]);
  });
});
