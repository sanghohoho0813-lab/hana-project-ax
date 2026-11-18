/** 성과 측정 집계 — 추정 제외 · 자료 구분 분리 · 엔진 효과(측정 5·6) · 수기 vs AX (측정 7) */
import { describe, expect, it } from "vitest";
import { caseMeasures, effectOf, spanSummary, stat, trialComparison, type JudgmentLite, type TrialRow } from "@/lib/pilot/measures";
import type { CaseRow, StepRow } from "@/lib/pilot/cases";

const T = (hhmm: string) => `2026-11-13T${hhmm}:00+09:00`;
const base: CaseRow = {
  id: "c1", case_no: "HX-20261113-001", schedule_id: "s1", data_kind: "실제 업무", evidence_class: "실제 업무", work_date: "2026-11-13", worker_id: "w", reporter_id: "w",
  source: "현장 직원", info_source: "현장기사 앱", issue_type: "기술적 장애", type_note: null, progress: "작업 진행 중", needs: [], request: null, urgency: "보통",
  discovered_at: T("09:20"), discovered_basis: "현장 직원 진술", reported_at: T("09:25"), report_mode: "즉시 기록", report_basis: "버튼 누른 시각", send_delay_seconds: 0,
  recorded_at: T("09:25"), expected_end: "10:40", end_event_id: "e1", status: "해결", handler_id: null, app_version: "t", updated_at: T("10:00"),
};
const step = (id: string, case_id: string, kind: string, hhmm: string, basis = "버튼 누른 시각", linked: number | null = null): StepRow => ({
  id, step_no: Number(id.replace(/\D/g, "")), case_id, kind, action: null, resolution: null, assignee_id: null, assignee_name: null, message: null,
  occurred_at: T(hhmm), occurred_mode: "즉시 기록", occurred_basis: basis, recorded_at: T(hhmm), actor_id: "a", source: "관리자", linked_seq: linked, linked_job_id: null, app_version: "t",
});
const J = (seq: number, changes: { kind: string; grade: string | null }[], affected = 1): JudgmentLite => ({
  seq,
  summary: { risky_before: 0, risky_after: 1, held_before: 1, held_after: 0, changed_links: changes.length, affected_sites: affected, priority_before: [], priority_after: [], event_issues_after: 0, schedules: 3, events: 2 },
  changes: { changes: changes.map((c, i) => ({ key: `k${i}`, kind: c.kind as never, before: null, after: c.grade ? { status: "판정", grade: c.grade as never, slack: -30 } : null })) },
});

describe("성과 측정 집계", () => {
  it("측정 1~4: 품질 구분 · 추정은 통계에서 빼고 따로 · 자료 구분 분리", () => {
    // 0.3.1: 실제 과거 현장정보 재현은 원자료 이름이 있어야 재현으로 센다 (시험 픽스처)
    const c2: CaseRow = { ...base, id: "c2", case_no: "HT-1", evidence_class: "현장정보 재현", source_ref: "업무일지 (시험 픽스처)", data_kind: "검증 시나리오", discovered_basis: "기억에 의한 추정", discovered_at: T("08:55"), end_event_id: null };
    const steps = [step("1", "c1", "접수", "09:27"), step("2", "c1", "지원 조치 결정", "09:30"), step("3", "c1", "일정 조정", "09:31", "버튼 누른 시각", 7), step("4", "c1", "해결 확인", "10:45"), step("5", "c2", "접수", "09:40")];
    const js = new Map<number, JudgmentLite>([[5, J(5, [{ kind: "신규 위험", grade: "매우 높음" }, { kind: "악화", grade: "주의" }])], [7, J(7, [{ kind: "해소", grade: "없음" }, { kind: "신규 위험", grade: "높음" }])]]);
    const ms = caseMeasures([base, c2], steps, js, new Map([["e1", 5]]));
    expect(ms[0].spans.map((s) => [s.key, s.minutes, s.quality])).toEqual([
      ["발견→보고", 5, "진술"],
      ["보고→확인", 2, "실측"],
      ["확인→지원 결정", 3, "실측"],
      ["발생→해결", 85, "진술"],
      ["보고→해결", 80, "실측"],
    ]);
    expect(ms[0].report).toMatchObject({ worsened: 1, resolved: 0, newRisks: 1, affectedSites: 1 });
    expect(ms[0].actions[0]).toMatchObject({ kind: "일정 조정", resolved: 1, newRisks: 1 });
    const s = spanSummary(ms);
    expect(s.byClass["실제 업무"].spans[0].stat).toMatchObject({ n: 1, median: 5 });
    expect(s.byClass["현장정보 재현"].spans[0].stat.n).toBe(0);
    expect(s.estimates).toEqual([{ caseNo: "HT-1", cls: "현장정보 재현", label: "문제 발견 → 최초 보고", minutes: 30 }]);
    expect(s.byClass["가상 시나리오"].cases).toBe(0);
  });

  it("측정 7: 같은 자료 구분 안에서 수기·AX가 모두 있을 때만 비교 · 무효·기억 추정 제외", () => {
    const tr = (p: Partial<TrialRow>): TrialRow => ({
      id: Math.random().toString(), trial_no: 1, evidence_class: "가상 시나리오", method: "수기", scenario: "I3", pair_key: "I3", case_id: null, participant_id: "p",
      find_sec: 100, rejudge_sec: 50, correct: 1, expected: 2, missed: 1, wrong: 0, value_basis: "시험 실측", measure_method: "앱 측정기", started_at: null, ended_at: null,
      raw_ref: null, note: null, recorded_at: T("10:00"), actor_id: "a", app_version: "t", voided_at: null, void_reason: null, ...p,
    });
    const r = trialComparison([tr({}), tr({ find_sec: 140 }), tr({ method: "AX", find_sec: 30, correct: 2 }), tr({ method: "AX", find_sec: 10, value_basis: "기억 추정" }), tr({ method: "AX", find_sec: 1, voided_at: T("11:00") })]);
    const v = r.byClass.find((x) => x.cls === "가상 시나리오")!;
    expect(v.n).toEqual({ manual: 2, ax: 1 });
    expect(v.find).toMatchObject({ diff: -90 });
    expect(v.accuracy.manual.median).toBe(50);
    expect(v.accuracy.ax.median).toBe(100);
    expect(r.estimated).toHaveLength(1);
    expect(r.voided).toBe(1);
    expect(r.byClass.find((x) => x.cls === "실제 업무")!.note).toMatch(/모두 있어야/);
    expect(stat([])).toEqual({ n: 0, median: null, min: null, max: null });
    expect(effectOf(J(1, [])).worsened).toBe(0);
  });
});

describe("0.3.1 증빙 표시 — 자료 구분 · 초 단위 · 이 사건 관련 위험", () => {
  it("원자료 없는 '현장정보 재현'은 '분류 확인 필요' — 재현 집계에서 빠지고 따로 센다", async () => {
    const { classOf, isTestOnly, CLASS_LABEL } = await import("@/lib/pilot/cases");
    expect(classOf({ evidence_class: "현장정보 재현", source_ref: null })).toBe("분류 확인 필요");
    expect(classOf({ evidence_class: "현장정보 재현", source_ref: "10월 2일 업무일지" })).toBe("현장정보 재현");
    expect(classOf({ evidence_class: "현장정보 재현", raw_ref: "기록지 3" })).toBe("현장정보 재현");
    expect(isTestOnly({ evidence_class: "가상 시나리오" })).toBe(true);
    expect(isTestOnly({ evidence_class: "실제 업무" })).toBe(false);
    expect(CLASS_LABEL["현장정보 재현"]).toBe("실제 과거 현장정보 재현");
    const c2: CaseRow = { ...base, id: "c2", case_no: "HT-2", evidence_class: "현장정보 재현", data_kind: "검증 시나리오", source_ref: null };
    const c3: CaseRow = { ...base, id: "c3", case_no: "HT-3", evidence_class: "현장정보 재현", data_kind: "검증 시나리오", source_ref: "10월 2일 업무일지" };
    const s = spanSummary(caseMeasures([c2, c3], [], new Map(), new Map()));
    expect(s.byClass["현장정보 재현"].cases).toBe(1);
    expect(s.unclassified).toEqual(["HT-2"]);
  });

  it("두 시각이 모두 버튼 시각이면 초 단위 — 같은 초는 0초, 진술이 섞이면 분만", async () => {
    const { caseSpans, fmtSpan } = await import("@/lib/pilot/cases");
    const at = (hhmmss: string) => `2026-11-13T${hhmmss}+09:00`;
    const c: CaseRow = { ...base, reported_at: at("09:25:10"), discovered_at: at("09:20:00") };
    const st = (kind: string, t: string, basis = "버튼 누른 시각"): StepRow => ({ ...step("9", "c1", kind, "09:00"), occurred_at: at(t), occurred_basis: basis });
    const sp = caseSpans(c, [st("접수", "09:25:10"), st("지원 조치 결정", "09:26:52")]);
    expect(fmtSpan(sp[1])).toBe("0초 (실측 · 초 단위)");
    expect(fmtSpan(sp[2])).toBe("1분 42초 (실측 · 초 단위)");
    expect(fmtSpan(sp[0])).toBe("5분 (진술)");
    expect(sp[1].minutes).toBe(0);
  });

  it("판단 변화 중 이 사건 담당 기사의 사건 현장부터만 '이 사건 관련' — 그날 전체 수와 나눔", async () => {
    const { caseChanges, tally } = await import("@/lib/pilot/cases");
    const sch = [
      { id: "a", workerId: "w", start: "09:00" },
      { id: "b", workerId: "w", start: "11:00" },
      { id: "c", workerId: "w", start: "13:00" },
      { id: "z0", workerId: "w", start: "07:00" },
      { id: "x", workerId: "v", start: "09:00" },
      { id: "y", workerId: "v", start: "11:00" },
    ];
    const ch = (key: string, kind: string, grade: string | null) => ({ key, kind: kind as never, before: null, after: grade ? { status: "판정" as const, grade: grade as never, slack: -10 } : null });
    const all = [ch("a>b", "신규 위험", "매우 높음"), ch("b>c", "유지", "높음"), ch("z0>a", "해소", "없음"), ch("x>y", "신규 위험", "높음")];
    const r = caseChanges(all, sch, "a", "w");
    expect(r.mine.map((x) => x.key)).toEqual(["a>b", "b>c"]);
    expect(r.others.map((x) => x.key)).toEqual(["z0>a", "x>y"]);
    expect(tally(r.mine)).toEqual({ newRisk: 1, worse: 0, resolved: 0, kept: 1 });
  });
});

describe("0.3.1 원자료 없는 재현 기록의 소요시간 품질", () => {
  it("분류 확인 필요 기록은 실측·진술이 아니라 '가상'으로 표시", async () => {
    const { caseSpans } = await import("@/lib/pilot/cases");
    const c: CaseRow = { ...base, evidence_class: "현장정보 재현", source_ref: null, data_kind: "검증 시나리오" };
    expect(caseSpans(c, [step("1", "c1", "접수", "09:27")]).map((s) => s.quality).slice(0, 2)).toEqual(["가상", "가상"]);
  });
});

describe("측정 10 — 안전점검 3단계 (0.5.0 제출 · 0.6.0 시점과 관리자 확인 시간)", () => {
  const K = (hm: string) => `2026-11-16T${hm}:00+09:00`;
  it("시작 · 종료한 현장만 세고, 제때 낸 시작 전 점검 · 종료 전 마무리 점검 · 3단계 · 관리자 확인 시간을 센다 (취소 제외)", async () => {
    const { safetyCompletion } = await import("@/lib/pilot/measures");
    const schedules = [
      { id: "a", status: "예정" },
      { id: "b", status: "예정" },
      { id: "c", status: "예정" }, // 아직 작업 중
      { id: "d", status: "취소" },
    ];
    const starts = new Map([["a", K("09:00")], ["b", K("10:00")], ["c", K("11:00")], ["d", K("12:00")]]);
    const ends = new Map([["a", K("09:50")], ["b", K("10:40")], ["d", K("12:30")]]);
    const chk = (id: string, schedule_id: string, stage: string, review_status: string, at: string) => ({ id, schedule_id, stage, review_status, checked_at: K(at), recorded_at: K(at) });
    const checks = [
      chk("1", "a", "작업 전", "적합(육안 확인)", "08:55"),
      chk("2", "a", "작업 중", "확인 대기", "09:25"),
      chk("3", "a", "작업 종료", "조치 완료", "09:48"),
      chk("4", "b", "작업 전", "보완 요청", "10:05"), // 시작 뒤 제출
      chk("5", "c", "작업 전", "확인 대기", "10:58"),
    ];
    const reviews = [
      { check_id: "1", kind: "관리자 확인", source: "관리자", occurred_at: K("09:01") }, // 6분
      { check_id: "3", kind: "관리자 확인", source: "관리자", occurred_at: K("09:52") }, // 4분
      { check_id: "3", kind: "조치 완료 확인", source: "관리자", occurred_at: K("09:59") },
      { check_id: "4", kind: "보완 요청", source: "관리자", occurred_at: K("10:15") }, // 10분
      { check_id: "4", kind: "보완 제출", source: "현장 직원", occurred_at: K("10:20") },
    ];
    const r = safetyCompletion(schedules, { starts, ends }, checks, reviews);
    expect(r).toMatchObject({
      started: 3,
      preOnTime: 2,
      ended: 2,
      full: 1,
      finalBeforeEnd: 1,
      byStage: [
        { stage: "작업 전", sites: 2 },
        { stage: "작업 중", sites: 1 },
        { stage: "작업 종료", sites: 1 },
      ],
      checks: 5,
      reviewed: 2,
      supplement: 1,
      unreviewed: 2,
    });
    expect(r.reviewMinutes).toMatchObject({ n: 3, median: 6, min: 4, max: 10 });
  });

  it("사진이 올라가지 않은 점검은 단계를 낸 것으로 세지 않는다 (0.6.1 안정화)", async () => {
    const { safetyCompletion } = await import("@/lib/pilot/measures");
    const starts = new Map([["a", K("09:00")]]);
    const ends = new Map([["a", K("09:50")]]);
    const chk = (id: string, stage: string, at: string) => ({ id, schedule_id: "a", stage, review_status: "확인 대기", checked_at: K(at), recorded_at: K(at) });
    const checks = [chk("1", "작업 전", "08:55"), chk("2", "작업 중", "09:20"), chk("3", "작업 종료", "09:45")];
    const all = safetyCompletion([{ id: "a", status: "예정" }], { starts, ends }, checks, [], new Set(["1", "2", "3"]));
    expect(all).toMatchObject({ full: 1, preOnTime: 1, finalBeforeEnd: 1, noPhoto: 0 });
    const missing = safetyCompletion([{ id: "a", status: "예정" }], { starts, ends }, checks, [], new Set(["2", "3"])); // 시작 전 점검 사진 실패
    expect(missing).toMatchObject({ full: 0, preOnTime: 0, finalBeforeEnd: 1, noPhoto: 1, checks: 3 });
    expect(missing.byStage[0]).toEqual({ stage: "작업 전", sites: 0 });
  });
});
