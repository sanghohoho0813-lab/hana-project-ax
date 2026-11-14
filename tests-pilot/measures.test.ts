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
    const c2: CaseRow = { ...base, id: "c2", case_no: "HT-1", evidence_class: "현장정보 재현", data_kind: "검증 시나리오", discovered_basis: "기억에 의한 추정", discovered_at: T("08:55"), end_event_id: null };
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
