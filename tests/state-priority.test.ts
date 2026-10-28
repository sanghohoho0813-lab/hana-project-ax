/**
 * 2차 고도화 자동 테스트 — 작업상태 이벤트 · 편차 · 예상 종료 갱신 · 대응 우선순위 · 조치 후 재판단
 * 기대값은 각 테스트 안에 손으로 계산해 적었다 (엔진 출력을 그대로 복사하지 않음).
 * 실행: npm test
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { RISK_RULE_VERSION, diffRisk, evaluateChainRisk, riskyLinks, type SiteInput } from "@/lib/risk-engine";
import { DEFAULT_PRIORITY_CONFIG, PRIORITY_VERSION, diffPriority, rankResponses, type PriorityConfig } from "@/lib/priority-engine";
import { runStatePipeline, type StateEvent, type WorkContext } from "@/lib/state-events";
import { AB_CASES, FLOW_STATES, runAbCase, runFlow } from "@/lib/state-scenarios";
import { buildAlerts, chainRisk, chainRiskAll, findConflicts, opsPipeline, opsPriority } from "@/lib/ops-calc";
import { SCHEDULES, TASKS, WORK_REPORTS } from "@/lib/ops-data";

const D = "2026-07-28";
const site = (p: Partial<SiteInput> & Pick<SiteInput, "id" | "plannedStart" | "plannedEnd">): SiteInput => ({
  title: `${p.id}현장`,
  workerId: "W1",
  date: D,
  status: "예정",
  travelSource: "입력값",
  ...p,
});
const ev = (id: string, kind: StateEvent["kind"], siteId: string, at?: string, value?: string, source = "작업 시작 버튼"): StateEvent => ({
  id,
  kind,
  siteId,
  at,
  value,
  source,
  origin: "검증 시나리오",
});
const AB = [site({ id: "A", plannedStart: "09:00", plannedEnd: "11:00", travelMinutes: 0 }), site({ id: "B", plannedStart: "11:40", plannedEnd: "12:30", travelMinutes: 30 })];
const run = (events: StateEvent[], asOf: string, extra: { contexts?: WorkContext[]; assume?: boolean; planned?: SiteInput[] } = {}) =>
  runStatePipeline({ planned: extra.planned ?? AB, events, contexts: extra.contexts, asOf, assumeDurationKept: extra.assume ?? true });
const dev = (r: ReturnType<typeof run>, id: string) => r.deviations.find((d) => d.siteId === id)!;
const stage = (r: ReturnType<typeof run>, id: string, s: string) => dev(r, id).stages.find((x) => x.stage === s)!;
const link = (r: { links: { key: string }[] }, key: string) => r.links.find((l) => l.key === key) as ReturnType<typeof evaluateChainRisk>["links"][number];

afterEach(() => {
  vi.useRealTimers();
});

describe("1. 정상 이벤트 처리", () => {
  it("A현장 09:00 정시 시작 → 편차 0분·정시, 예상 종료 11:00(예정), B현장 도착 11:30·여유 10분·위험 없음, 이벤트 문제 없음", () => {
    const r = runAbCase(AB_CASES[0]);
    expect(stage(r, "A", "작업개시")).toMatchObject({ minutes: 0, status: "정시", affectsEnd: false });
    expect(dev(r, "A").end).toMatchObject({ time: "11:00", source: "예정", determined: true });
    expect(link(r.risk, "A>B")).toMatchObject({ arrival: "11:30", slack: 10, grade: "없음" });
    expect(r.eventIssues).toEqual([]);
  });
});

describe("2. 업무확인 지연 계산", () => {
  it("업무 전달 07:00 + 120분 = 확인 기준 09:00, 실제 확인 09:20 → 20분 지연 · 예상 종료 미반영", () => {
    const r = runFlow("S1");
    expect(stage(r, "B", "업무 확인")).toMatchObject({ due: "2026-07-28T09:00", actual: "2026-07-28T09:20", minutes: 20, status: "지연", affectsEnd: false });
  });
  it("확인 기록이 없고 기준이 지났으면 '미발생 · 기한 경과'와 경과 분 — 업무 전달 08:00 → 기준 10:00, 기준시각 10:40 → 40분", () => {
    const r = run([], "2026-07-28T10:40", { contexts: [{ siteId: "A", assignedAt: "2026-07-28T08:00" }] });
    expect(stage(r, "A", "업무 확인")).toMatchObject({ minutes: 40, status: "미발생 · 기한 경과" });
  });
  it("기준 전에 확인하면 '기한 내' (음수 편차)", () => {
    const r = run([ev("x", "업무 확인", "A", "2026-07-28T08:30", undefined, "업무 확인 버튼")], "2026-07-28T10:40", {
      contexts: [{ siteId: "A", assignedAt: "2026-07-28T08:00" }],
    });
    expect(stage(r, "A", "업무 확인")).toMatchObject({ minutes: -90, status: "기한 내" });
  });
});

describe("3. 실제 작업개시 지연 계산", () => {
  it("A현장 예정 09:00 · 실제 09:25 → 25분 지연, 작업시간 유지 가정으로 예상 종료에 반영 / D현장 09:30 정시", () => {
    const r = runFlow("S1");
    expect(stage(r, "A", "작업개시")).toMatchObject({ actual: "2026-07-28T09:25", minutes: 25, status: "지연", affectsEnd: true, source: "작업 시작 버튼" });
    expect(stage(r, "D", "작업개시")).toMatchObject({ minutes: 0, status: "정시", affectsEnd: false });
  });
  it("일찍 시작해도 예상 종료를 앞당기지 않는다 (08:50 시작 → 10분 이름, 종료 11:00 예정)", () => {
    const r = run([ev("x", "작업개시", "A", "2026-07-28T08:50")], "2026-07-28T09:00");
    expect(stage(r, "A", "작업개시")).toMatchObject({ minutes: -10, status: "이름", affectsEnd: false });
    expect(dev(r, "A").end).toMatchObject({ time: "11:00", source: "예정" });
  });
});

describe("4. 완료보고 지연 계산", () => {
  const ctx: WorkContext[] = [{ siteId: "A", needsReport: true, dueAt: "2026-07-28T12:00" }];
  it("완료기한 12:00 · 완료보고 12:40 → 40분 지연, 예상 종료 미반영", () => {
    const r = run([ev("x", "완료보고", "A", "2026-07-28T12:40", undefined, "완료보고 제출")], "2026-07-28T13:00", { contexts: ctx });
    expect(stage(r, "A", "결과보고")).toMatchObject({ minutes: 40, status: "지연", affectsEnd: false });
  });
  it("11:50 보고 → 기한 내 (−10분)", () => {
    const r = run([ev("x", "완료보고", "A", "2026-07-28T11:50", undefined, "완료보고 제출")], "2026-07-28T13:00", { contexts: ctx });
    expect(stage(r, "A", "결과보고")).toMatchObject({ minutes: -10, status: "기한 내" });
  });
  it("보고가 없고 기준시각 13:00 → 미발생 · 기한 경과 60분", () => {
    const r = run([], "2026-07-28T13:00", { contexts: ctx });
    expect(stage(r, "A", "결과보고")).toMatchObject({ minutes: 60, status: "미발생 · 기한 경과" });
  });
  it("결과보고가 필요 없는 업무는 '해당 없음'", () => {
    const r = run([], "2026-07-28T13:00", { contexts: [{ siteId: "A", needsReport: false, dueAt: "2026-07-28T12:00" }] });
    expect(stage(r, "A", "결과보고").status).toBe("해당 없음");
  });
});

describe("5. 확인 지연과 작업개시 지연의 구분", () => {
  const ctx: WorkContext[] = [{ siteId: "A", assignedAt: "2026-07-28T06:40" }]; // 확인 기준 08:40
  it("확인이 20분 늦어도(09:00) 작업을 정시(09:00)에 시작하면 예상 종료·후속 위험은 그대로", () => {
    const r = run([ev("c", "업무 확인", "A", "2026-07-28T09:00", undefined, "업무 확인 버튼"), ev("s", "작업개시", "A", "2026-07-28T09:00")], "2026-07-28T09:05", { contexts: ctx });
    expect(stage(r, "A", "업무 확인")).toMatchObject({ minutes: 20, status: "지연" });
    expect(stage(r, "A", "작업개시")).toMatchObject({ minutes: 0, status: "정시" });
    expect(dev(r, "A").end.time).toBe("11:00");
    expect(link(r.risk, "A>B").slack).toBe(10);
  });
  it("작업개시가 20분 늦으면(09:20) 예상 종료 11:20 → B현장 여유 −10분 · 높음", () => {
    const r = run([ev("c", "업무 확인", "A", "2026-07-28T08:30", undefined, "업무 확인 버튼"), ev("s", "작업개시", "A", "2026-07-28T09:20")], "2026-07-28T09:25", { contexts: ctx });
    expect(stage(r, "A", "업무 확인").status).toBe("기한 내");
    expect(dev(r, "A").end.time).toBe("11:20");
    expect(link(r.risk, "A>B")).toMatchObject({ slack: -10, grade: "높음" });
  });
  it("업무 확인 이벤트는 엔진 입력을 바꾸지 않는다 (확인 이벤트 유무와 무관하게 엔진 입력이 같음)", () => {
    const a = run([ev("s", "작업개시", "A", "2026-07-28T09:20")], "2026-07-28T09:25");
    const b = run([ev("s", "작업개시", "A", "2026-07-28T09:20"), ev("c", "업무 확인", "A", "2026-07-28T09:15", undefined, "업무 확인 버튼")], "2026-07-28T09:25");
    expect(b.sites).toEqual(a.sites);
    expect(JSON.stringify(b.risk)).toBe(JSON.stringify(a.risk));
  });
});

describe("6. 중복 이벤트 처리", () => {
  it.each([
    ["늦은 기록이 먼저", ["s2", "s1"]],
    ["늦은 기록이 나중", ["s1", "s2"]],
  ])("같은 단계 작업개시가 두 번(09:25, 09:40)이면 들어온 순서와 관계없이 가장 이른 09:25만 쓰고 나머지는 '중복 이벤트' — %s", (_n, order) => {
    const all = { s1: ev("s1", "작업개시", "A", "2026-07-28T09:25"), s2: ev("s2", "작업개시", "A", "2026-07-28T09:40") };
    const r = run(order.map((k) => all[k as "s1" | "s2"]), "2026-07-28T09:45");
    expect(r.sites.find((s) => s.id === "A")!.actualStart).toBe("09:25");
    expect(r.eventIssues).toEqual([expect.objectContaining({ eventId: "s2", kind: "중복 이벤트" })]);
    expect(link(r.risk, "A>B").slack).toBe(-15);
  });
  it("같은 id 이벤트가 두 번 들어와도 한 번만 반영 — 단일 이벤트와 결과가 같다", () => {
    const one = run([ev("s1", "작업개시", "A", "2026-07-28T09:25")], "2026-07-28T09:30");
    const two = run([ev("s1", "작업개시", "A", "2026-07-28T09:25"), ev("s1", "작업개시", "A", "2026-07-28T09:25")], "2026-07-28T09:30");
    expect(JSON.stringify(two.risk)).toBe(JSON.stringify(one.risk));
    expect(two.eventIssues.map((i) => i.kind)).toEqual(["중복 이벤트"]);
  });
  it("예상 종료 보고가 여러 번이면 가장 늦게 보고된 값을 쓴다", () => {
    const r = run(
      [ev("p1", "예상 종료 보고", "A", "2026-07-28T09:50", "11:30", "현장 보고"), ev("p2", "예상 종료 보고", "A", "2026-07-28T10:10", "11:10", "현장 보고")],
      "2026-07-28T10:15",
    );
    expect(r.sites.find((s) => s.id === "A")!.expectedEnd).toBe("11:10");
  });
});

describe("7. 이벤트 시각 누락 처리", () => {
  it("발생시각 없는 작업개시는 쓰지 않고 '이벤트 시각 누락' — 시각을 만들어 넣지 않는다", () => {
    const r = run([ev("s", "작업개시", "A", undefined)], "2026-07-28T09:30");
    expect(r.eventIssues).toEqual([expect.objectContaining({ kind: "이벤트 시각 누락" })]);
    expect(r.sites.find((s) => s.id === "A")!.actualStart).toBeUndefined();
    // 예정 시작이 지났는데 시작 기록이 없음 → 예상 종료 미확정
    expect(dev(r, "A").end).toMatchObject({ determined: false, time: "11:00" });
    expect(stage(r, "A", "작업개시")).toMatchObject({ status: "미발생 · 기한 경과", minutes: 30 });
  });
  it("형식이 틀린 시각(09:7)·없는 일정 이벤트도 쓰지 않는다", () => {
    const r = run([ev("s", "작업개시", "A", "2026-07-28T09:7"), ev("z", "작업개시", "Z", "2026-07-28T09:10")], "2026-07-28T09:30");
    expect(r.eventIssues.map((i) => i.kind).sort()).toEqual(["연결 대상 없음", "이벤트 시각 형식 오류"]);
  });
});

describe("8. 예상 종료시간 갱신", () => {
  it("작업개시 09:25 + 작업시간 120분(가정) = 11:25, 출처 '작업개시 지연 추정', 규칙 R2-2", () => {
    const r = runAbCase(AB_CASES[1]);
    expect(dev(r, "A").end).toMatchObject({ time: "11:25", source: "작업개시 지연 추정", determined: true, delay: 25 });
    expect(link(r.risk, "A>B").rules).toContain("R2-2");
    expect(link(r.risk, "A>B").formula).toContain("근거: 실제 시작 09:25 (25분 늦음) + 예정 작업시간 120분 — 가정: 늦게 시작해도 작업시간 유지");
  });
  it("현장 보고 예상 종료(11:10)가 들어오면 추정값(11:25) 대신 보고값을 쓴다", () => {
    const r = runAbCase(AB_CASES[2]);
    expect(dev(r, "A").end).toMatchObject({ time: "11:10", source: "현장 보고" });
  });
  it("가정이 없으면 예상 종료를 단정하지 않는다 — 미확정 · 예정 종료 기준 · 확인 권고 (R2-3)", () => {
    const r = run([ev("s", "작업개시", "A", "2026-07-28T09:25")], "2026-07-28T09:30", { assume: false });
    expect(dev(r, "A").end).toMatchObject({ time: "11:00", source: "예정", determined: false });
    const l = link(r.risk, "A>B");
    expect(l.slack).toBe(10);
    expect(l.rules).toContain("R2-3");
    expect(l.actions).toContain("선행 현장 종료 예상시각 확인");
    expect(l.reason).toContain("예상 종료가 확정되지 않아");
  });
});

describe("9. 후속 현장 위험 재계산", () => {
  it("정상 → 작업개시 지연: A>B 여유 10 → −15, '신규 위험' / 현장 보고 11:10: −15 → 0, 높음 → 주의, '해소'", () => {
    const [c1, c2, c3] = AB_CASES.map(runAbCase);
    expect(diffRisk(c1.risk, c2.risk).changes).toEqual([
      { key: "A>B", kind: "신규 위험", before: { status: "판정", grade: "없음", slack: 10 }, after: { status: "판정", grade: "높음", slack: -15 } },
    ]);
    expect(diffRisk(c2.risk, c3.risk).changes).toEqual([
      { key: "A>B", kind: "해소", before: { status: "판정", grade: "높음", slack: -15 }, after: { status: "판정", grade: "주의", slack: 0 } },
    ]);
    expect(link(c3.risk, "A>B").arrival).toBe("11:40");
  });
  it("3단계 검증 예시 4가지가 모두 기대값과 일치", () => {
    for (const c of AB_CASES) {
      const r = runAbCase(c);
      const l = link(r.risk, "A>B");
      expect([l.prev.expectedEnd, l.prev.endSource, l.arrival, l.slack, l.grade]).toEqual([c.expect.aEnd, c.expect.aEndSource, c.expect.arrival, c.expect.slack, c.expect.grade]);
    }
  });
});

describe("10. A → B → C 연쇄 영향", () => {
  it("A 09:25 시작 → 11:25 종료 → B 11:55~12:45 → C 13:05 도착 (12:55 시작 대비 10분 부족 · 연쇄 지연)", () => {
    const r = runFlow("S1");
    expect(link(r.risk, "A>B")).toMatchObject({ slack: -15, grade: "높음", cause: "선행 현장 지연", downstream: ["B", "C"] });
    expect(link(r.risk, "B>C")).toMatchObject({ arrival: "13:05", slack: -10, grade: "높음", cause: "연쇄 지연", rootId: "A" });
    expect(r.risk.sites.find((s) => s.id === "C")!.expectedStart).toBe("13:05");
  });
});

describe("11. 여러 위험업무의 우선순위 산출", () => {
  it("1순위 B현장 작업지연(B·C 2곳, 75점) > 2순위 E현장 이동시간 부족(25점) — 요소별 점수가 설명과 일치", () => {
    const p = runFlow("S1").priority;
    expect(p.items.map((i) => [i.rank, i.title, i.score])).toEqual([
      [1, "B현장 작업지연 위험", 75],
      [2, "E현장 이동시간 부족", 25],
    ]);
    // 40(높음) + 15(지연 15분) + 10(추가 영향 1곳) + 0(시작까지 130분) + 10(B 업무 '긴급')
    expect(p.items[0].breakdown.map((b) => [b.factor, b.points])).toEqual([
      ["위험등급", 40],
      ["예상 지연", 15],
      ["후속 현장 영향", 10],
      ["대응 시한", 0],
      ["업무 중요도", 10],
    ]);
    // 20(중간) + 5(지연 5분) + 0 + 0(시작까지 150분) + 0('보통')
    expect(p.items[1].breakdown.map((b) => b.points)).toEqual([20, 5, 0, 0, 0]);
    expect(p.version).toBe(PRIORITY_VERSION);
  });
  it("연결 업무가 없는 요소는 0점 — 데이터 없음을 높게 평가하지 않는다", () => {
    const p = runFlow("S2").priority; // 1순위 C현장 — 연결 업무 없음
    expect(p.items[0].title).toBe("C현장 일정 중복");
    expect(p.items[0].breakdown.find((b) => b.factor === "업무 중요도")).toMatchObject({ points: 0, value: "연결 업무 없음" });
  });
  it("가중치를 설정으로 바꾸면 점수와 순위가 설정을 따른다 — 설정값으로 관리", () => {
    const flat: PriorityConfig = { ...DEFAULT_PRIORITY_CONFIG, gradePoints: { 중간: 0, 높음: 0, "매우 높음": 0 }, perShortfallMin: 0, perExtraSite: 0, taskPriorityPoints: { 긴급: 0, 보통: 0, 낮음: 0 }, urgency: [{ withinMin: 140, points: 50 }] };
    const r = runFlow("S1");
    const p = rankResponses(r.risk, { asOf: FLOW_STATES.S1.asOf, config: flat });
    // B현장 시작까지 130분(≤140 → 50점), E현장 150분(0점)
    expect(p.items.map((i) => [i.title, i.score])).toEqual([
      ["B현장 작업지연 위험", 50],
      ["E현장 이동시간 부족", 0],
    ]);
    // 업무 중요도 '보통'에만 점수를 주는 설정 → E현장(보통) 30점이 B현장(긴급) 0점보다 앞선다
    const swap: PriorityConfig = { ...flat, urgency: [], taskPriorityPoints: { 긴급: 0, 보통: 30, 낮음: 0 } };
    const meta = FLOW_CONTEXTS.map((c) => ({ siteId: c.siteId, priority: c.priority }));
    expect(rankResponses(r.risk, { asOf: FLOW_STATES.S1.asOf, meta, config: swap }).items.map((i) => [i.rank, i.title, i.score])).toEqual([
      [1, "E현장 이동시간 부족", 30],
      [2, "B현장 작업지연 위험", 0],
    ]);
  });
});

describe("12. 동점 우선순위 정렬 재현성", () => {
  // 서로 다른 작업자의 같은 조건 위험 3건 — 점수가 같다
  const three = (order: string[]) =>
    order.flatMap((w) => {
      const start = w === "X" ? "12:00" : "11:40";
      return [
        site({ id: `${w}1`, workerId: w, plannedStart: "09:00", plannedEnd: "11:00", travelMinutes: 0 }),
        site({ id: `${w}2`, workerId: w, plannedStart: start, plannedEnd: "13:00", travelMinutes: start === "12:00" ? 65 : 45 }),
      ];
    });
  it("점수가 같으면 가장 이른 영향 현장 시작 → 항목 키 순으로 정렬하고, 입력 순서를 바꿔도 같은 결과", () => {
    const rank = (order: string[]) => rankResponses(evaluateChainRisk(three(order), { asOf: "2026-07-28T08:00" }), { asOf: "2026-07-28T08:00" });
    const a = rank(["X", "Y", "Z"]);
    expect(new Set(a.items.map((i) => i.score)).size).toBe(1);
    // Y·Z 는 11:40 시작(같은 시각) → 키 순, X 는 12:00 시작
    expect(a.items.map((i) => i.key)).toEqual(["link:Y1>Y2", "link:Z1>Z2", "link:X1>X2"]);
    for (const o of [["Z", "Y", "X"], ["Y", "X", "Z"]]) expect(JSON.stringify(rank(o).items)).toBe(JSON.stringify(a.items));
  });
});

describe("13. 데이터 부족 시 판단 보류", () => {
  it("이동시간이 없는 연결은 점수를 매기지 않고 '데이터 확인 대상'으로 따로 둔다 (위험 없음으로 분류하지 않음)", () => {
    const r = run([ev("s", "작업개시", "A", "2026-07-28T09:25")], "2026-07-28T09:30", {
      planned: [AB[0], { ...AB[1], travelMinutes: null }],
    });
    expect(r.priority.items).toEqual([]);
    expect(r.priority.held.map((h) => h.key)).toEqual(["A>B"]);
    expect(r.priority.watch).toEqual([]);
  });
});

describe("14. 동일 위험 중복 점수 방지", () => {
  it("A 지연에서 나온 B·C 위험은 한 항목 — C현장은 다른 항목에 다시 들어가지 않고, 추가 영향 점수는 1곳분만", () => {
    const p = runFlow("S1").priority;
    const allSites = p.items.flatMap((i) => i.sites.map((s) => s.id));
    expect(allSites).toEqual(["B", "C", "E"]);
    expect(new Set(allSites).size).toBe(allSites.length);
    expect(p.items[0].linkKeys).toEqual(["A>B", "B>C"]);
    expect(p.items[0].breakdown.find((b) => b.factor === "후속 현장 영향")!.points).toBe(10);
  });
});

describe("15. 관리자 조치 후 위험 해소", () => {
  it("B현장 시작 12:10 조정 → A>B 여유 −15 → 15, '해소'", () => {
    const d = diffRisk(runFlow("S1").risk, runFlow("S2").risk);
    expect(d.changes.find((c) => c.key === "A>B")).toEqual({
      key: "A>B",
      kind: "해소",
      before: { status: "판정", grade: "높음", slack: -15 },
      after: { status: "판정", grade: "없음", slack: 15 },
    });
  });
  it("추가로 C현장 13:25 조정 → 작업자 1 위험 0건", () => {
    const r = runFlow("S3");
    expect(riskyLinks(r.risk).map((l) => l.key)).toEqual(["D>E"]);
  });
});

describe("16. 관리자 조치 후 우선순위 갱신", () => {
  it("B 조정: B현장 항목 해소, C현장 일정 중복이 새 1순위, E는 2순위 유지", () => {
    const c = diffPriority(runFlow("S1").priority, runFlow("S2").priority);
    expect(c.map((x) => [x.title, x.before, x.after, x.kind])).toEqual([
      ["C현장 일정 중복", null, 1, "신규"],
      ["E현장 이동시간 부족", 2, 2, "유지"],
      ["B현장 작업지연 위험", 1, null, "해소"],
    ]);
  });
  it("C 조정: C현장 항목 해소, E현장 2순위 → 1순위로 상승", () => {
    const c = diffPriority(runFlow("S2").priority, runFlow("S3").priority);
    expect(c.map((x) => [x.title, x.before, x.after, x.kind])).toEqual([
      ["E현장 이동시간 부족", 2, 1, "상승"],
      ["C현장 일정 중복", 1, null, "해소"],
    ]);
  });
});

describe("17. 데모 기준시각 재현성", () => {
  it("실제 시계를 2030년으로 바꿔도 데모 화면 흐름과 검증 흐름 결과가 같다 (시계를 읽지 않음)", () => {
    const a = JSON.stringify([opsPipeline(SCHEDULES, TASKS, WORK_REPORTS), runFlow("S1"), opsPriority(SCHEDULES, TASKS)]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T05:00:00Z"));
    const b = JSON.stringify([opsPipeline(SCHEDULES, TASKS, WORK_REPORTS), runFlow("S1"), opsPriority(SCHEDULES, TASKS)]);
    expect(b).toBe(a);
  });
  it("결과에 규칙 버전이 남는다", () => {
    expect(runFlow("S1").risk.ruleVersion).toBe(RISK_RULE_VERSION);
    expect(runFlow("S1").priority.ruleVersion).toBe(RISK_RULE_VERSION);
  });
});

describe("18. 기존 기능 회귀", () => {
  it("데모 데이터 알림 13건이 고도화 전(커밋 87adc37)과 같다 — id·규칙·심각도", () => {
    // 87adc37 코드로 같은 데이터를 계산해 얻은 목록 (테스트 작성 시 별도로 확인해 적음)
    expect(buildAlerts(TASKS, SCHEDULES).map((x) => `${x.id}|${x.rule}|${x.severity}`)).toEqual([
      "a-unack-t1|미확인 업무|danger",
      "a-over-t2|기한 초과|danger",
      "a-over-t7|기한 초과|danger",
      "a-unack-t8|미확인 업무|danger",
      "a-conf-s1-s2|일정 충돌|danger",
      "a-soon-t1|기한 임박|warning",
      "a-report-t3|결과보고 미제출|warning",
      "a-report-t5|결과보고 미제출|warning",
      "a-report-t9|결과보고 미제출|warning",
      "a-sunack-s1|당일 일정 미확인|warning",
      "a-sunack-s2|당일 일정 미확인|warning",
      "a-sunack-s6|당일 일정 미확인|warning",
      "a-nostart-s1|시작 미등록|warning",
    ]);
  });
  it("데모 일정의 연결 판정 3건이 고도화 전과 같다", () => {
    expect(chainRisk(SCHEDULES).links.map((l) => [l.key, l.status, l.grade, l.slack, l.arrival, l.cause].join("/"))).toEqual([
      "s1>s2/판정/높음/-25/11:55/이동시간 부족",
      "s3>s4/판정/없음/85/13:35/정상",
      "s5>s6/판정/없음/90/12:00/정상",
    ]);
    expect(findConflicts(SCHEDULES).map((c) => `${c.a.id}>${c.b.id}`)).toEqual(["s1>s2"]);
  });
  it("이벤트 경로(eventsFromOps → 정규화 → 반영)와 일정 직접 경로(toSiteInput)가 같은 위험 결과를 낸다 — 엔진 하나", () => {
    const withEvents = SCHEDULES.map((s) =>
      s.id === "s3" ? { ...s, actualStart: "09:20", actualStartSource: "현장 보고" as const } : s.id === "s5" ? { ...s, expectedEnd: "11:30", expectedEndSource: "현장 보고" as const } : s,
    );
    const a = opsPipeline(withEvents, TASKS, WORK_REPORTS).risk;
    const b = chainRisk(withEvents);
    expect(JSON.stringify(a.links)).toBe(JSON.stringify(b.links));
    expect(JSON.stringify(a.sites)).toBe(JSON.stringify(b.sites));
  });
  it("데모 데이터의 '시작 보고'(t4, 09:10)는 15:00 일정의 작업개시로 쓰지 않는다 — 정확히 연결되지 않는 이벤트", () => {
    const r = opsPipeline(SCHEDULES, TASKS, WORK_REPORTS);
    expect(r.accepted.some((e) => e.kind === "작업개시")).toBe(false);
    expect(r.deviations.find((d) => d.siteId === "s4")!.stages.find((x) => x.stage === "작업개시")!.status).toBe("기한 전");
  });
  it("모든 날짜 판단(chainRiskAll)에 데모 일정 10건이 들어가고 오류가 없다", () => {
    const r = chainRiskAll(SCHEDULES);
    expect(r.sites).toHaveLength(10);
    expect(r.issues).toEqual([]);
  });
});

/* ── 비교실험 · 증빙 기록 ─────────────────────────────── */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toScheduleItem } from "@/lib/risk-scenarios";
import { FLOW_CONTEXTS, FLOW_STEPS } from "@/lib/state-scenarios";
import { PRIORITY_RULES } from "@/lib/priority-engine";
import { STATE_RULES } from "@/lib/state-events";

const OUT = join(process.cwd(), "docs", "evidence");
const write = (name: string, data: unknown) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
};

/** 같은 조건에서 세 방식 비교 — 기존 정적 검사 / 이벤트 미반영 엔진 / 이벤트 반영 흐름 */
function compare(planned: SiteInput[], events: StateEvent[], asOf: string) {
  const baseline = findConflicts(planned.map(toScheduleItem), D).map((c) => `${c.a.id}>${c.b.id}`);
  const noEvents = riskyLinks(evaluateChainRisk(planned, { asOf, assumeDurationKept: true })).map((l) => l.key);
  const flow = runStatePipeline({ planned, events, contexts: FLOW_CONTEXTS, asOf, assumeDurationKept: true });
  return { baseline, noEvents, withEvents: riskyLinks(flow.risk).map((l) => l.key), priority: flow.priority.items.map((i) => `${i.rank}. ${i.title} (${i.score}점)`) };
}

describe("비교실험 4 — 실제 상태이벤트 반영 여부", () => {
  const rows = (["S0", "S1", "S2", "S3"] as const).map((id) => ({ state: id, asOf: FLOW_STATES[id].asOf, ...compare(FLOW_STATES[id].planned, FLOW_STATES[id].events, FLOW_STATES[id].asOf) }));

  it("작업개시 지연(S1)에서 B·C 위험은 이벤트를 반영한 흐름만 감지한다", () => {
    const s1 = rows.find((r) => r.state === "S1")!;
    expect(s1.baseline).toEqual(["D>E"]);
    expect(s1.noEvents).toEqual(["D>E"]);
    expect(s1.withEvents).toEqual(["A>B", "B>C", "D>E"]);
  });
  it("관리자 조치 후(S2)에는 세 방식 모두 새로 생긴 B>C 일정 중복을 감지한다 — 예정값 문제이기 때문", () => {
    const s2 = rows.find((r) => r.state === "S2")!;
    expect(s2.baseline).toEqual(["B>C", "D>E"]);
    expect(s2.withEvents).toEqual(["B>C", "D>E"]);
  });
  it("결과를 docs/evidence/state-flow-comparison.json · state-flow-results.json 으로 남긴다", () => {
    write("state-flow-comparison.json", {
      note: "검증용 가상 시나리오에서 같은 조건으로 세 방식을 비교한 결과입니다. 기존 코드 대비 기능검증이며 외부 제품 비교가 아닙니다.",
      methods: {
        baseline: "기존 정적 충돌 검사 findConflicts (예정값만)",
        noEvents: "연쇄위험 엔진 — 실제 상태이벤트 미반영 (예정값 + 연쇄 전파)",
        withEvents: "상태이벤트 → 편차 → 예상 종료 → 연쇄위험 (이번 고도화)",
      },
      ruleVersion: RISK_RULE_VERSION,
      rows,
      abCases: AB_CASES.map((c) => ({ id: c.id, label: c.label, asOf: c.asOf, ...compare(c.planned, c.events, c.asOf) })),
    });
    write("state-flow-results.json", {
      note: "상태이벤트 연속 검증(STEP 1~9)과 3단계 검증 예시의 입력값·결과 전체입니다. 검증용 가상 데이터이며 실제 운영데이터가 아닙니다. 우선순위 점수는 관리자 판단 보조용 규칙 점수이며 사고 확률이 아닙니다.",
      ruleVersion: RISK_RULE_VERSION,
      priorityVersion: PRIORITY_VERSION,
      stateRules: STATE_RULES,
      priorityRules: PRIORITY_RULES,
      priorityConfig: DEFAULT_PRIORITY_CONFIG,
      contexts: FLOW_CONTEXTS,
      steps: FLOW_STEPS,
      states: Object.values(FLOW_STATES).map((s) => ({ ...s, result: runFlow(s.id) })),
      abCases: AB_CASES.map((c) => ({ ...c, result: runAbCase(c) })),
    });
    write("demo-state-deviations.json", {
      note: "하나 프로젝트 AX 데모 데이터(src/lib/ops-data.ts)를 데모 기준시각(2026-07-28 10:40)으로 분석한 작업상태 편차·우선순위입니다. 실제 운영데이터가 아닙니다.",
      result: opsPipeline(SCHEDULES, TASKS, WORK_REPORTS),
    });
  });
});
