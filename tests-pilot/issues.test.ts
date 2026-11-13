/**
 * 현장 문제 보고 · 지원 요청 (2026-11-13 인터뷰 근거) — 순수 함수 시험
 * 핵심: 보고 자체는 판단을 만들지 않음 · 예상 종료가 있을 때만 엔진 전달 · 관리자 조치 = 재판단 ·
 *       시각 근거별 소요시간 품질 · 시나리오 정답(손 계산) = 엔진 결과 · 예전 기록 호환 · 백업·CSV 왕복
 */
import { describe, expect, it } from "vitest";
import {
  addNote,
  addOutcome,
  createSession,
  currentSchedules,
  emptyState,
  judgeSession,
  judgmentsMatch,
  LabError,
  linkNoteChange,
  normalizeState,
  recomputeJudgments,
  recordEvent,
  saveSchedule,
  sessionEvents,
  setTestMode,
  type Ctx,
  type LabState,
} from "@/lib/lab/model";
import { adjustForIssue, editIssue, issueEnd, issueFlow, issueMetrics, issueRiskChange, issueStatus, issueStep, qualityOf, reportIssue, sessionIssues, stageAround, voidIssue } from "@/lib/lab/issues";
import { ISSUE_SCENARIOS, keyRisks, loadIssueScenario, runIssueScenario } from "@/lib/lab/issueScenarios";
import { checkBackup, issuesCsv, makeBackup, parseCsv } from "@/lib/lab/exporting";
import { buildReport } from "@/lib/lab/report";

let n = 0;
const ctxAt = (iso: string, appVersion = "0.1.0+test"): Ctx => ({ now: new Date(iso), id: () => `iss-${++n}`, appVersion });
const KST = (date: string, hhmm: string) => `${date}T${hhmm}:00+09:00`;
const ME = "p-consultant";
const KOO = "p-koo";
const PROV = { enteredBy: ME, informantId: KOO, source: "현장기사 구두 전달", sourceRef: "11/12 통화" };

/** 사후 재현 세트: A 09:00~10:00 · B 10:30~12:00(이동 20) — A 작업개시 09:00 */
function replaySet(clock = "09:00") {
  let s = emptyState(new Date(KST("2026-11-13", "08:00")));
  const c = ctxAt(KST("2026-11-13", "08:00"));
  const made = createSession(s, { title: "재현", kind: "사후 재현", workDate: "2026-11-12", participantId: KOO, informantId: KOO, source: "현장기사 구두 전달", sourceRef: "", clock, note: "", createdBy: ME, testMode: "과거 현장정보 재현시험" }, c);
  s = made.state;
  const add = (site: string, a: string, b: string, travel: number | null) =>
    (s = saveSchedule(s, { opId: c.id(), sessionId: made.id, scheduleId: null, expectedVersion: null, workerId: KOO, siteName: site, region: "", plannedStart: a, plannedEnd: b, travelMinutes: travel, priority: "보통", note: "", reason: "", prov: PROV }, c).state);
  add("A현장", "09:00", "10:00", null);
  add("B현장", "10:30", "12:00", 20);
  const [a, b] = currentSchedules(s, made.id);
  s = recordEvent(s, { opId: c.id(), sessionId: made.id, scheduleId: a.id, kind: "작업개시", timeMode: "입력", time: "09:00", timeBasis: "원자료 기록", via: "관리자 화면", prov: PROV }, c).state;
  return { s, sid: made.id, a, b, c };
}

describe("현장 문제 보고 — 보고 자체는 위험 판단을 만들지 않는다", () => {
  it("예상 종료를 모르면 문제 기록만 남고 엔진 입력·판단 기록은 늘지 않는다", () => {
    const { s, sid, a, c } = replaySet();
    const before = { entries: s.entries.length, judgments: s.judgments.length, risky: judgeSession(s, sid, c.now).result.risk.links.filter((l) => l.grade && l.grade !== "없음" && l.grade !== "주의").length };
    const r = reportIssue(s, { opId: "op-1", sessionId: sid, scheduleId: a.id, type: "추가 장비 필요", progress: "작업 진행 중", needs: ["추가 장비"], request: "케이블 부족", discovered: { mode: "입력", time: "09:20", basis: "정보 제공자 진술" }, reported: { mode: "입력", time: "09:25", basis: "원자료 기록" }, expectedEnd: null, via: "현장기사 화면", prov: PROV }, c);
    expect(r.seq).toBeNull();
    expect(r.state.entries.length).toBe(before.entries);
    expect(r.state.judgments.length).toBe(before.judgments);
    expect(r.state.issues).toHaveLength(1);
    expect(r.state.issues[0]).toMatchObject({ no: 1, type: "추가 장비 필요", progress: "작업 진행 중", workerId: KOO, enteredBy: ME, informantId: KOO, source: "현장기사 구두 전달", appVersion: "0.1.0+test", linkedSeq: null });
    // 재현 기준시각은 보고 시각으로 옮겨진다 (가정값 · 이력 남음)
    expect(r.state.sessions[0].clock).toBe("09:25");
    // 같은 요청이 다시 와도 한 번만
    const again = reportIssue(r.state, { opId: "op-1", sessionId: sid, scheduleId: a.id, type: "기타", progress: "작업 중단", needs: [], request: "", discovered: { mode: "모름" }, reported: { mode: "모름" }, expectedEnd: null, via: "현장기사 화면", prov: PROV }, c);
    expect(again.duplicated).toBe(true);
    expect(again.state.issues).toHaveLength(1);
    expect(issueFlow(r.state, r.state.issues[0]).find((x) => x.step === "예상 종료시간 변경")?.text).toContain("엔진에 전달하지 않음");
    expect(before.risky).toBe(0);
  });

  it("변경 예상 종료가 있으면 기존 '예상 종료 보고' 기록 1건만 엔진에 전달하고 판단 전후가 남는다", () => {
    const { s, sid, a, c } = replaySet();
    const r = reportIssue(s, { opId: "op-2", sessionId: sid, scheduleId: a.id, type: "기술적 장애", progress: "분해·설치 시작 후", needs: ["원격 기술 지원"], request: "", discovered: { mode: "입력", time: "09:20", basis: "정보 제공자 진술" }, reported: { mode: "입력", time: "09:25", basis: "정보 제공자 진술" }, expectedEnd: "10:40", via: "현장기사 화면", prov: PROV }, c);
    expect(r.state.entries.length).toBe(s.entries.length + 1);
    const e = r.state.entries.at(-1)!;
    expect(e).toMatchObject({ type: "event", kind: "예상 종료 보고", expectedEnd: "10:40", issueId: r.state.issues[0].id, timeBasis: "정보 제공자 진술", appVersion: "0.1.0+test" });
    expect(r.state.issues[0].linkedSeq).toBe(e.seq);
    const j = r.state.judgments.at(-1)!;
    expect(j.seq).toBe(e.seq);
    expect(j.summary.risky_before).toBe(0);
    expect(j.summary.risky_after).toBe(1);
    expect(j.story[0]).toContain("현장 문제 보고 #1(기술적 장애)에서 전달된 값");
    // 저장된 판단을 다시 계산해도 같다 (엔진 변경 없음)
    expect(judgmentsMatch(r.state.judgments, recomputeJudgments(r.state, c.now)).differ).toEqual([]);
    // 저장된 판단의 위험 수와 연결별 재계산이 같다
    const st = stageAround(r.state, j, KOO);
    expect([st.before.risky, st.after.risky]).toEqual([0, 1]);
    expect(st.after.links[0]).toMatchObject({ grade: "위험 매우 높음", shortfall: 30, arrival: "11:00" });
  });

  it("입력 규칙: 발견이 보고보다 늦으면 거절 · 실제 업무가 아니면 '지금' 거절 · 시각을 모르면 비운다", () => {
    const { s, sid, a, c } = replaySet();
    const base = { opId: "x", sessionId: sid, scheduleId: a.id, type: "기타" as const, progress: "작업 진행 중" as const, needs: [], request: "", expectedEnd: null, via: "현장기사 화면" as const, prov: PROV };
    expect(() => reportIssue(s, { ...base, discovered: { mode: "입력", time: "09:40" }, reported: { mode: "입력", time: "09:30" } }, c)).toThrow(/문제 발견시각보다 이른/);
    expect(() => reportIssue(s, { ...base, discovered: { mode: "지금" }, reported: { mode: "모름" } }, c)).toThrow(LabError);
    expect(() => reportIssue(s, { ...base, type: "없음" as never, discovered: { mode: "모름" }, reported: { mode: "모름" } }, c)).toThrow(/문제 유형/);
    const r = reportIssue(s, { ...base, discovered: { mode: "모름" }, reported: { mode: "입력", time: "09:30", basis: "기억에 의한 추정" } }, c);
    expect(r.state.issues[0].discovered).toEqual({ at: null, basis: "모름", entered: null });
    const m = issueMetrics(r.state, r.state.issues[0]);
    expect(m[0]).toMatchObject({ key: "발견→보고", minutes: null, missing: "시각 모름 (추정하지 않음)" });
  });

  it("실제 업무: 버튼 누른 시각 = 실측, 미래 시각은 거절", () => {
    const now = new Date(KST("2026-11-13", "10:00"));
    let s = emptyState(now);
    const c = ctxAt(now.toISOString());
    const made = createSession(s, { title: "실제", kind: "실제 업무", workDate: "2026-11-13", participantId: KOO, informantId: null, source: "현장기사 실시간 입력", sourceRef: "", clock: null, note: "", createdBy: KOO, testMode: "구본석 이사 직접 수행" }, c);
    s = saveSchedule(made.state, { opId: "s1", sessionId: made.id, scheduleId: null, expectedVersion: null, workerId: KOO, siteName: "A", region: "", plannedStart: "09:00", plannedEnd: "11:00", travelMinutes: null, priority: "보통", note: "", reason: "", prov: { ...PROV, enteredBy: KOO } }, c).state;
    const a = currentSchedules(s, made.id)[0];
    const p = { ...PROV, enteredBy: KOO, informantId: null, source: "현장기사 실시간 입력" };
    expect(() => reportIssue(s, { opId: "f", sessionId: made.id, scheduleId: a.id, type: "기타", progress: "작업 진행 중", needs: [], request: "", discovered: { mode: "입력", time: "10:30" }, reported: { mode: "지금" }, expectedEnd: null, via: "현장기사 화면", prov: p }, c)).toThrow(/아직 오지 않은/);
    const r = reportIssue(s, { opId: "r", sessionId: made.id, scheduleId: a.id, type: "기타", progress: "작업 진행 중", needs: [], request: "", discovered: { mode: "입력", time: "09:50", basis: "정보 제공자 진술" }, reported: { mode: "지금" }, expectedEnd: null, via: "현장기사 화면", prov: p }, c);
    const s2 = issueStep(r.state, { opId: "k", issueId: r.id, kind: "지원 요청 접수", moment: { mode: "지금" }, via: "관리자 화면", prov: { ...PROV } }, ctxAt(KST("2026-11-13", "10:04"))).state;
    const m = issueMetrics(s2, s2.issues[0]);
    expect(m[0]).toMatchObject({ minutes: 10, quality: "진술" });
    expect(m[1]).toMatchObject({ key: "보고→접수", minutes: 4, quality: "실측" });
    expect(issueStatus(s2.issues[0])).toBe("접수됨");
  });
});

describe("관리자 조치 → 재판단 · 소요시간 · 고치기·무효", () => {
  it("접수·지원 결정·일정 조정·해결이 기록되고, 일정 조정은 기존 일정 조정 기록(판단 전후)으로 남는다", () => {
    const { s, sid, a, b, c } = replaySet();
    let st = reportIssue(s, { opId: "r1", sessionId: sid, scheduleId: a.id, type: "추가 장비 필요", progress: "작업 진행 중", needs: ["추가 장비", "일정 조정"], request: "장비 추가", discovered: { mode: "입력", time: "09:20", basis: "원자료 기록" }, reported: { mode: "입력", time: "09:25", basis: "원자료 기록" }, expectedEnd: "10:40", via: "현장기사 화면", prov: PROV }, c).state;
    const id = st.issues[0].id;
    st = issueStep(st, { opId: "s1", issueId: id, kind: "지원 요청 접수", moment: { mode: "입력", time: "09:31", basis: "원자료 기록" }, via: "관리자 화면", prov: PROV }, c).state;
    expect(() => issueStep(st, { opId: "s2", issueId: id, kind: "지원 조치 결정", moment: { mode: "입력", time: "09:40" }, via: "관리자 화면", prov: PROV }, c)).toThrow(/지원 조치를 고르세요/);
    expect(() => issueStep(st, { opId: "s2", issueId: id, kind: "지원 요청 접수", moment: { mode: "입력", time: "09:10" }, via: "관리자 화면", prov: PROV }, c)).toThrow(/문제 보고 시각보다 이른/);
    st = issueStep(st, { opId: "s2", issueId: id, kind: "지원 조치 결정", moment: { mode: "입력", time: "09:40", basis: "정보 제공자 진술" }, action: "추가 장비 전달", text: "본사에서 장비 전달", via: "관리자 화면", prov: PROV }, c).state;
    const judgedBefore = st.judgments.length;
    const r = adjustForIssue(st, { opId: "s3", issueId: id, moment: { mode: "입력", time: "09:45", basis: "정보 제공자 진술" }, schedule: { scheduleId: b.id, expectedVersion: b.version, workerId: b.workerId, siteName: b.siteName, region: "", plannedStart: "11:00", plannedEnd: "12:30", travelMinutes: 20, priority: "보통", note: "", reason: "A현장 장비 대기" }, prov: PROV }, c);
    st = r.state;
    expect(st.judgments.length).toBe(judgedBefore + 1);
    const j = st.judgments.at(-1)!;
    expect(j.trigger).toBe("일정 수정");
    expect([j.summary.risky_before, j.summary.risky_after]).toEqual([1, 0]);
    expect(kstTime(j.asOf)).toBe("09:45");
    // 같은 조정 요청이 두 번 와도 한 번만
    expect(adjustForIssue(st, { opId: "s3", issueId: id, moment: { mode: "모름" }, schedule: { scheduleId: b.id, expectedVersion: 99, workerId: b.workerId, siteName: "", region: "", plannedStart: "11:00", plannedEnd: "12:30", travelMinutes: 20, priority: "보통", note: "", reason: "x" }, prov: PROV }, c).duplicated).toBe(true);
    st = issueStep(st, { opId: "s4", issueId: id, kind: "해결 여부", moment: { mode: "입력", time: "10:40", basis: "원자료 기록" }, resolution: "해결", via: "현장기사 화면", prov: PROV }, c).state;
    expect(() => issueStep(st, { opId: "s5", issueId: id, kind: "해결 여부", moment: { mode: "모름" }, resolution: "해결", via: "현장기사 화면", prov: PROV }, c)).toThrow(/이미 '해결'/);
    const issue = st.issues[0];
    expect(issueStatus(issue)).toBe("해결");
    expect(issue.steps.map((o) => o.kind)).toEqual(["지원 요청 접수", "지원 조치 결정", "일정 조정", "해결 여부"]);
    const m = issueMetrics(st, issue);
    expect(m.map((x) => [x.key, x.minutes, x.quality])).toEqual([
      ["발견→보고", 5, "원자료"],
      ["보고→접수", 6, "원자료"],
      ["보고→지원 결정", 15, "진술"],
      ["지원 요청→해결", 75, "원자료"],
    ]);
    const rc = issueRiskChange(st, issue);
    expect([rc.before?.risky, rc.reported?.risky, rc.afterActions?.risky]).toEqual([0, 1, 0]);
    const flow = issueFlow(st, issue);
    expect(flow.map((x) => `${x.step}/${x.value}`)).toEqual([
      "현장 문제 발견/입력값",
      "문제 보고 · 지원 요청/입력값",
      "예상 종료시간 변경/입력값",
      "후속 현장 위험 계산/계산값",
      "관리자 조치/입력값",
      "관리자 조치/입력값",
      "관리자 조치/입력값",
      "재판단/계산값",
      "해결 여부/입력값",
    ]);
    expect(flow[3].text).toContain("위험 연결 0 → 1건");
    expect(flow[7].text).toContain("위험 연결 1 → 0건");
    expect(judgmentsMatch(st.judgments, recomputeJudgments(st, c.now)).differ).toEqual([]);
  });

  it("예상 종료 다시 알림은 새 '예상 종료 보고' 기록으로 엔진에 들어가고 문제에 연결된다", () => {
    const { s, sid, a, c } = replaySet();
    let st = reportIssue(s, { opId: "r", sessionId: sid, scheduleId: a.id, type: "기술 지원 필요", progress: "작업 진행 중", needs: ["원격 기술 지원"], request: "", discovered: { mode: "입력", time: "09:20" }, reported: { mode: "입력", time: "09:25" }, expectedEnd: null, via: "현장기사 화면", prov: PROV }, c).state;
    const id = st.issues[0].id;
    const r = issueEnd(st, { opId: "e", issueId: id, expectedEnd: "10:50", moment: { mode: "입력", time: "09:50" }, via: "현장기사 화면", prov: PROV }, c);
    st = r.state;
    expect(st.entries.at(-1)).toMatchObject({ kind: "예상 종료 보고", expectedEnd: "10:50", issueId: id });
    expect(st.issues[0].steps[0]).toMatchObject({ kind: "예상 종료 변경", linkedSeq: r.seq });
    expect(st.judgments.at(-1)!.summary.risky_after).toBe(1);
  });

  it("고치기는 엔진과 무관한 항목만, 이전 값이 남는다 · 무효는 연결된 예상 종료 기록도 무효 처리한다", () => {
    const { s, sid, a, c } = replaySet();
    let st = reportIssue(s, { opId: "r", sessionId: sid, scheduleId: a.id, type: "기타", progress: "작업 진행 중", needs: [], request: "", discovered: { mode: "입력", time: "09:20" }, reported: { mode: "입력", time: "09:25" }, expectedEnd: "10:40", via: "현장기사 화면", prov: PROV }, c).state;
    const id = st.issues[0].id;
    st = editIssue(st, id, { type: "기술적 장애", typeNote: "", progress: "작업 중단", needs: ["숙련 기술자"], request: "고침", discovered: { mode: "입력", time: "09:15" } }, ME, c);
    expect(st.issues[0]).toMatchObject({ type: "기술적 장애", progress: "작업 중단" });
    expect(st.issues[0].history[0].values.type).toBe("기타");
    expect(judgeSession(st, sid, c.now).result.risk.links.filter((l) => l.grade === "매우 높음")).toHaveLength(1);
    expect(() => voidIssue(st, id, " ", PROV, c)).toThrow(/무효 사유/);
    st = voidIssue(st, id, "다른 현장 문제를 잘못 입력", PROV, c);
    expect(st.issues[0].voided?.reason).toBe("다른 현장 문제를 잘못 입력");
    expect(issueStatus(st.issues[0])).toBe("무효");
    const last = sessionEvents(st, sid).at(-1)!;
    expect(last).toMatchObject({ kind: "기록 무효", voidsSeq: st.issues[0].linkedSeq });
    expect(judgeSession(st, sid, c.now).result.risk.links.filter((l) => l.grade === "매우 높음")).toHaveLength(0);
    expect(() => issueStep(st, { opId: "z", issueId: id, kind: "지원 요청 접수", moment: { mode: "모름" }, via: "관리자 화면", prov: PROV }, c)).toThrow(/무효 처리된/);
  });

  it("소요시간 품질은 두 시각 근거 중 약한 쪽 · 가상 시나리오는 '가상' · 시각 모름은 값 없음", () => {
    const m = (basis: Parameters<typeof qualityOf>[1]["basis"]) => ({ at: "2026-11-12T00:00:00Z", basis, entered: "09:00" });
    expect(qualityOf("실제 업무", m("버튼 누른 시각(실시간)"), m("버튼 누른 시각(실시간)"))).toBe("실측");
    expect(qualityOf("사후 재현", m("원자료 기록"), m("기억에 의한 추정"))).toBe("추정");
    expect(qualityOf("사후 재현", m("원자료 기록"), m("정보 제공자 진술"))).toBe("진술");
    expect(qualityOf("가상 시나리오", m("가상 시각"), m("가상 시각"))).toBe("가상");
    expect(qualityOf("사후 재현", m("원자료 기록"), { at: null, basis: "모름", entered: null })).toBeNull();
  });
});

describe("시험 시나리오 — 손으로 계산한 정답 = 엔진 결과 (정상 · 조기 지원 요청 · 지원 요청 지연)", () => {
  for (const sc of ISSUE_SCENARIOS) {
    it(`${sc.id} ${sc.name}: 단계별 위험 수·연결 등급이 정답표와 같다 (3회 반복해도 같음)`, () => {
      const results: string[] = [];
      for (let round = 1; round <= 3; round++) {
        const c = ctxAt(KST("2026-11-13", `1${round}:00`));
        let s = emptyState(c.now);
        const loaded = loadIssueScenario(s, sc.id, ME, KOO, c, { testMode: "컨설턴트 진행" });
        s = loaded.state;
        const session = s.sessions.find((x) => x.id === loaded.sessionId)!;
        expect(session).toMatchObject({ kind: "가상 시나리오", scenarioId: sc.id, testMode: "컨설턴트 진행", clock: "09:00" });
        const run = runIssueScenario(s, loaded.sessionId, ME, c);
        s = run.state;
        const worker = currentSchedules(s, loaded.sessionId)[0].workerId;
        const got = sc.answer.map((a) => {
          const seq = run.seqs[a.step]!;
          const j = s.judgments.find((x) => x.seq === seq)!;
          const st = stageAround(s, j, worker)[a.when];
          expect(st.risky).toBe(a.when === "before" ? j.summary.risky_before : j.summary.risky_after);
          const links = Object.fromEntries(st.links.map((l) => [l.key.split(">").map((id) => currentSchedules(s, loaded.sessionId).find((x) => x.id === id)!.siteName[0]).join(">"), `${l.grade} (${l.shortfall > 0 ? `${l.shortfall}분 늦음` : `여유 ${l.slack}분`})`]));
          return { label: a.label, risks: st.risky, links };
        });
        expect(got).toEqual(sc.answer.map((a) => ({ label: a.label, risks: a.risks, links: a.links })));
        if (sc.id !== "I1") {
          const issue = sessionIssues(s, loaded.sessionId)[0];
          expect(issueStatus(issue)).toBe("해결");
          const m = issueMetrics(s, issue);
          expect(m.every((x) => x.quality === "가상")).toBe(true);
          results.push(m.map((x) => x.minutes).join(","));
        } else {
          expect(sessionIssues(s, loaded.sessionId)).toHaveLength(0);
        }
        expect(judgmentsMatch(s.judgments, recomputeJudgments(s, c.now)).differ).toEqual([]);
      }
      if (sc.id === "I2") expect(results).toEqual(["5,2,5,75", "5,2,5,75", "5,2,5,75"]);
      if (sc.id === "I3") expect(results).toEqual(["60,2,10,50", "60,2,10,50", "60,2,10,50"]);
    });
  }

  it("비교시험 정답(찾아야 할 위험 수): 정상 0 · 조기 1 · 지연 2", () => {
    expect(ISSUE_SCENARIOS.map((x) => [x.id, keyRisks(x)])).toEqual([
      ["I1", 0],
      ["I2", 1],
      ["I3", 2],
    ]);
  });
});

describe("예전 기록 호환 · 시험 방식 · 피드백 → 개발 연결 · 백업·CSV·보고서", () => {
  it("이전 형식(issues·testMode·devLinks 없음)을 읽으면 빈 값으로 채우고, 저장된 판단은 그대로 다시 계산된다", () => {
    const { s, c } = replaySet();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown> & LabState;
    delete (old as Partial<LabState>).issues;
    for (const x of old.sessions as unknown as Record<string, unknown>[]) for (const k of ["testMode", "scenarioId", "appVersion", "outcomes", "changes"]) delete x[k];
    for (const e of old.entries as unknown as Record<string, unknown>[]) delete e.appVersion;
    const st = normalizeState(old);
    expect(st.issues).toEqual([]);
    expect(st.sessions[0]).toMatchObject({ testMode: null, scenarioId: null, outcomes: [], changes: [] });
    expect(judgmentsMatch(st.judgments, recomputeJudgments(st, c.now)).differ).toEqual([]);
  });

  it("시험 방식 변경 이력 · 예상과 다른 결과도 남김 · 피드백 → 요구사항/프로그램 변경 날짜 기록", () => {
    const set = replaySet();
    const { sid, c } = set;
    let s = set.s;
    s = setTestMode(s, sid, "구본석 이사 직접 수행", ME, c);
    expect(s.sessions[0].changes.at(-1)).toMatchObject({ field: "시험 방식", from: "과거 현장정보 재현시험", to: "구본석 이사 직접 수행" });
    expect(() => addOutcome(s, sid, { match: "예상과 다름", text: "" }, ME, c)).toThrow(/어떻게 달랐는지/);
    s = addOutcome(s, sid, { match: "예상과 다름", text: "보고 직전부터 엔진이 높음으로 표시" }, ME, c);
    s = addOutcome(s, sid, { match: "예상대로", text: "" }, ME, c);
    expect(s.sessions[0].outcomes.map((o) => o.match)).toEqual(["예상과 다름", "예상대로"]);
    const note = addNote(s, { type: "참여자 피드백", text: "작업 전·중·후 안전장비 사진 확인이 있으면 좋겠다", speakerId: KOO, confirmation: "참여자가 직접 확인", status: "보류", sessionId: null, trialId: null }, ME, c);
    s = linkNoteChange(note.state, note.id, { kind: "요구사항 반영", date: "2026-11-13", text: "안전장비 사진 확인 — 후속 요구사항으로 문서화 (이번 범위 제외)", version: "" }, ME, c);
    expect(s.notes[0].devLinks[0]).toMatchObject({ kind: "요구사항 반영", date: "2026-11-13", version: "0.1.0+test" });
    expect(() => linkNoteChange(s, note.id, { kind: "프로그램 수정", date: "", text: "x", version: "" }, ME, c)).toThrow(/바뀐 날짜/);
  });

  it("백업에 문제 기록이 들어가고 지문·재계산이 맞으며, 예전 백업(issues 없음)도 읽는다 · 문제 CSV 왕복", async () => {
    const c = ctxAt(KST("2026-11-13", "15:00"));
    let s = emptyState(c.now);
    const loaded = loadIssueScenario(s, "I3", ME, KOO, c, { testMode: "컨설턴트 진행" });
    s = runIssueScenario(loaded.state, loaded.sessionId, ME, c).state;
    const file = await makeBackup(s, ME, c.now);
    expect(file.counts.issues).toBe(1);
    const back = await checkBackup(JSON.stringify(file), c.now);
    expect(back.checksumOk).toBe(true);
    expect(back.recompute.differ).toEqual([]);
    expect(back.state.issues[0].steps.map((o) => o.kind)).toEqual(["지원 요청 접수", "지원 조치 결정", "일정 조정", "일정 조정", "해결 여부"]);
    // 예전 백업: issues 없이 만든 파일 (지문은 그 내용으로)
    const { s: plain } = replaySet();
    const oldData = JSON.parse(JSON.stringify(plain));
    delete oldData.issues;
    const oldFile = { ...(await makeBackup(oldData, ME, c.now)) };
    const oldBack = await checkBackup(JSON.stringify(oldFile), c.now);
    expect(oldBack.checksumOk).toBe(true);
    expect(oldBack.state.issues).toEqual([]);
    const rows = parseCsv(issuesCsv(s));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ 문제번호: "1", 데이터구분: "가상 시나리오", 시험방식: "컨설턴트 진행", 문제유형: "예상과 다른 현장상황", 변경예상종료: "11:10", 발견시각: "09:20", 보고시각: "10:20", "발견→보고_분": "60", "보고→지원결정_분": "10", "지원요청→해결_분": "50", 소요시간품질: "가상", 위험연결_보고전: "1", 위험연결_보고후: "2", 위험연결_조치후: "0", 최대지연분_보고후: "60", 최대지연분_조치후: "0", 상태: "해결" });
  });

  it("보고서: 실측·재현·가상·예상 효과를 나누고, 기억 추정 값은 비교 통계에서 뺀다", () => {
    const c = ctxAt(KST("2026-11-13", "16:00"));
    let s = emptyState(c.now);
    for (const id of ["I2", "I3"]) {
      const l = loadIssueScenario(s, id, ME, KOO, c, { testMode: "컨설턴트 진행" });
      s = runIssueScenario(l.state, l.sessionId, ME, c).state;
    }
    const { s: rs, sid, a, c: c2 } = replaySet();
    void rs;
    let st: LabState = { ...s, sessions: s.sessions };
    // 사후 재현: 기억에 의한 추정 시각 → '추정'
    const made = createSession(st, { title: "재현", kind: "사후 재현", workDate: "2026-11-12", participantId: KOO, informantId: KOO, source: "현장기사 구두 전달", sourceRef: "", clock: "09:00", note: "", createdBy: ME, testMode: "과거 현장정보 재현시험" }, c2);
    st = saveSchedule(made.state, { opId: "q1", sessionId: made.id, scheduleId: null, expectedVersion: null, workerId: KOO, siteName: "A현장", region: "", plannedStart: "09:00", plannedEnd: "10:00", travelMinutes: null, priority: "보통", note: "", reason: "", prov: PROV }, c2).state;
    const aa = currentSchedules(st, made.id)[0];
    st = reportIssue(st, { opId: "q2", sessionId: made.id, scheduleId: aa.id, type: "기술적 장애", progress: "작업 진행 중", needs: [], request: "", discovered: { mode: "입력", time: "09:10", basis: "기억에 의한 추정" }, reported: { mode: "입력", time: "09:40", basis: "원자료 기록" }, expectedEnd: null, via: "관리자 화면", prov: PROV }, c2).state;
    void sid;
    void a;
    const r = buildReport(st, c.now);
    expect(r.issues.byKind["가상 시나리오"].count).toBe(2);
    expect(r.issues.byKind["사후 재현"].count).toBe(1);
    expect(r.issues.byKind["실제 업무"].count).toBe(0);
    const est = r.issues.estimates;
    expect(est).toHaveLength(1);
    expect(est[0]).toMatchObject({ key: "발견→보고", minutes: 30, quality: "추정" });
    // 추정 값은 재현 통계에 들어가지 않는다
    expect(r.issues.byKind["사후 재현"].spans.find((x) => x.key === "발견→보고")!.stat.n).toBe(0);
    expect(r.issues.byKind["가상 시나리오"].spans.find((x) => x.key === "발견→보고")!.stat).toMatchObject({ n: 2, min: 5, max: 60 });
  });
});

const kstTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
