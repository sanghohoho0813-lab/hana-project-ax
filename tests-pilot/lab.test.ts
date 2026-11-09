/**
 * 로컬 실증(브라우저 저장) 기록 모델 — DB 없이 순수 함수
 * 핵심: 출처·시각 구분, 중복·정정, 판단 전후, 비교시험 정답표와 같은 엔진 결과, 백업·CSV 왕복
 */
import { describe, expect, it } from "vitest";
import {
  activeLabEvents,
  addNote,
  addPerson,
  addTrial,
  cancelSchedule,
  createSession,
  currentSchedules,
  editTrial,
  emptyState,
  judgeSession,
  LabError,
  markBackup,
  recordEvent,
  repeatNo,
  repeatSession,
  saveSchedule,
  sessionEvents,
  trialRound,
  unsavedChanges,
  voidTrial,
  type Ctx,
  type LabState,
  type TrialValues,
} from "@/lib/lab/model";
import { checkBackup, eventsCsv, judgmentsCsv, makeBackup, parseCsv, trialsCsv } from "@/lib/lab/exporting";
import { loadTrialScenario, TRIAL_SCENARIOS } from "@/lib/lab/trialData";
import { buildReport } from "@/lib/lab/report";
import { gradeRank } from "@/lib/risk-engine";

let n = 0;
const ctxAt = (iso: string): Ctx => ({ now: new Date(iso), id: () => `id-${++n}` });
const KST = (date: string, hhmm: string) => `${date}T${hhmm}:00+09:00`;
const ME = "p-consultant";
const KOO = "p-koo";
const prov = { enteredBy: ME, informantId: KOO, source: "현장기사 구두 전달", sourceRef: "11/09 업무일지" };

/** 사후 재현 세트: 기사 1명 · A(09:00~10:00) → B(10:30~12:00, 이동 20) → C(12:30~14:00, 이동 20) */
function replaySet(): { s: LabState; sid: string; w: string; A: string; B: string; C: string } {
  const c = ctxAt("2026-11-10T03:00:00Z");
  let s = emptyState(c.now);
  const p = addPerson(s, { name: "김기사", code: "T01", role: "현장기사", org: "" }, c);
  s = p.state;
  const made = createSession(
    s,
    { title: "11/09 재현", kind: "사후 재현", workDate: "2026-11-09", participantId: KOO, informantId: KOO, source: "현장기사 구두 전달", sourceRef: "", clock: "08:30", note: "", createdBy: ME },
    c,
  );
  s = made.state;
  const add = (site: string, a: string, b: string, travel: number | null) => {
    const r = saveSchedule(
      s,
      { opId: `op-${site}`, sessionId: made.id, scheduleId: null, expectedVersion: null, workerId: p.id, siteName: site, region: "", plannedStart: a, plannedEnd: b, travelMinutes: travel, priority: "보통", note: "", reason: "", prov },
      c,
    );
    s = r.state;
    return currentSchedules(s, made.id).find((x) => x.siteName === site)!.id;
  };
  const A = add("A현장", "09:00", "10:00", null);
  const B = add("B현장", "10:30", "12:00", 20);
  const C = add("C현장", "12:30", "14:00", 20);
  return { s, sid: made.id, w: p.id, A, B, C };
}

describe("로컬 실증 — 출처·시각", () => {
  it("일정 3건 등록 → 기록 3건·판단 3건, 이동 출발 현장은 직전 일정으로 자동 기록", () => {
    const { s, sid, A, B, C } = replaySet();
    expect(s.entries).toHaveLength(3);
    expect(s.judgments).toHaveLength(3);
    const now = currentSchedules(s, sid);
    expect(now.find((x) => x.id === B)!.travelFromId).toBe(A);
    expect(now.find((x) => x.id === C)!.travelFromId).toBe(B);
  });

  it("대리 입력: 입력자(컨설턴트)와 정보 제공자(구본석)를 따로 남기고, 실제 시각은 입력값 · 프로그램 입력시각은 따로", () => {
    const { s, sid, A } = replaySet();
    const c = ctxAt("2026-11-10T04:00:00Z");
    const r = recordEvent(s, { opId: "e1", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "입력", time: "09:20", timeBasis: "정보 제공자 진술", via: "현장기사 화면", prov }, c);
    const e = sessionEvents(r.state, sid)[0];
    expect(e).toMatchObject({ enteredBy: ME, informantId: KOO, source: "현장기사 구두 전달", enteredTime: "09:20", timeBasis: "정보 제공자 진술" });
    expect(e.occurredAt).toBe(new Date(KST("2026-11-09", "09:20")).toISOString());
    expect(e.enteredAt).toBe("2026-11-10T04:00:00.000Z");
  });

  it("실제 시각을 모르면 비워 두고(추정하지 않음) 엔진은 '이벤트 시각 누락'으로 판단에 쓰지 않는다", () => {
    const { s, sid, A } = replaySet();
    const r = recordEvent(s, { opId: "e1", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "모름", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:00:00Z"));
    const e = sessionEvents(r.state, sid)[0];
    expect(e.occurredAt).toBeNull();
    expect(e.timeBasis).toBe("모름");
    const { result } = judgeSession(r.state, sid, new Date());
    expect(result.eventIssues.some((x) => x.kind === "이벤트 시각 누락")).toBe(true);
    expect(r.state.judgments.at(-1)!.story[0]).toContain("실제 시각 모름");
  });

  it("'지금' 시각 기록은 실제 업무 세트(오늘)에서만 — 재현 세트에서는 거부", () => {
    const { s, sid, A } = replaySet();
    expect(() => recordEvent(s, { opId: "e1", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "지금", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:00:00Z"))).toThrow(/실제 업무/);
    const c = ctxAt("2026-11-10T01:00:00Z"); // KST 10:00
    let st = createSession(s, { title: "", kind: "실제 업무", workDate: "2026-11-10", participantId: KOO, informantId: KOO, source: "현장기사 실시간 입력", sourceRef: "", clock: null, note: "", createdBy: KOO }, c);
    expect(() => createSession(s, { title: "", kind: "실제 업무", workDate: "2026-11-09", participantId: KOO, informantId: null, source: "", sourceRef: "", clock: null, note: "", createdBy: ME }, c)).toThrow(/오늘 날짜만/);
    const sched = saveSchedule(st.state, { opId: "x", sessionId: st.id, scheduleId: null, expectedVersion: null, workerId: KOO, siteName: "실제 현장", region: "", plannedStart: "09:30", plannedEnd: "11:00", travelMinutes: null, priority: "보통", note: "", reason: "", prov: { ...prov, enteredBy: KOO } }, c);
    st = { state: sched.state, id: st.id };
    const sid2 = currentSchedules(st.state, st.id)[0].id;
    const r = recordEvent(st.state, { opId: "go", sessionId: st.id, scheduleId: sid2, kind: "작업개시", timeMode: "지금", via: "현장기사 화면", prov: { ...prov, enteredBy: KOO, informantId: KOO, source: "현장기사 실시간 입력" } }, c);
    expect(sessionEvents(r.state, st.id)[0]).toMatchObject({ occurredAt: "2026-11-10T01:00:00.000Z", timeBasis: "버튼 누른 시각(실시간)", enteredBy: KOO });
    expect(r.state.judgments.at(-1)!.asOfBasis).toBe("실제 현재 시각");
  });
});

describe("로컬 실증 — 중복·정정·판단 전후", () => {
  it("같은 요청 번호는 한 번만 · 같은 단계를 다른 요청으로 또 누르면 거부", () => {
    const { s, sid, A } = replaySet();
    const c = ctxAt("2026-11-10T04:00:00Z");
    const ev = { sessionId: sid, scheduleId: A, kind: "작업개시" as const, timeMode: "입력" as const, time: "09:20", via: "현장기사 화면" as const, prov };
    const a = recordEvent(s, { ...ev, opId: "same" }, c);
    const b = recordEvent(a.state, { ...ev, opId: "same" }, c);
    expect(b.duplicated).toBe(true);
    expect(b.state).toBe(a.state);
    expect(() => recordEvent(a.state, { ...ev, opId: "other" }, c)).toThrow(/\[중복\]/);
  });

  it("예상 종료 보고를 같은 값으로 연달아 누르면(10초 안) 한 번만 기록", () => {
    const { s, sid, A } = replaySet();
    const r1 = recordEvent(s, { opId: "r1", sessionId: sid, scheduleId: A, kind: "예상 종료 보고", timeMode: "모름", expectedEnd: "10:30", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:00:00Z"));
    const r2 = recordEvent(r1.state, { opId: "r2", sessionId: sid, scheduleId: A, kind: "예상 종료 보고", timeMode: "모름", expectedEnd: "10:30", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:00:05Z"));
    expect(r2.duplicated).toBe(true);
    expect(sessionEvents(r2.state, sid)).toHaveLength(1);
  });

  it("정정: 원래 기록은 남고 정정 기록이 대체 · 무효 처리도 기록으로 남음", () => {
    const { s, sid, A } = replaySet();
    const c = ctxAt("2026-11-10T04:00:00Z");
    let st = recordEvent(s, { opId: "a", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "입력", time: "09:20", via: "현장기사 화면", prov }, c).state;
    const first = sessionEvents(st, sid)[0].seq;
    st = recordEvent(st, { opId: "b", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "입력", time: "09:15", voidsSeq: first, via: "현장기사 화면", prov }, c).state;
    const evs = sessionEvents(st, sid);
    expect(evs).toHaveLength(2);
    expect(activeLabEvents(evs).map((e) => e.enteredTime)).toEqual(["09:15"]);
    st = recordEvent(st, { opId: "c", sessionId: sid, scheduleId: A, kind: "기록 무효", timeMode: "모름", voidsSeq: evs[1].seq, via: "현장기사 화면", prov }, c).state;
    expect(sessionEvents(st, sid)).toHaveLength(3);
    expect(activeLabEvents(sessionEvents(st, sid))).toHaveLength(0);
  });

  it("A현장 20분 늦은 작업 시작 → B현장 도착 계산 → 위험 판단 → 관리자 일정 조정 → 재판단 (계산 흐름 문장)", () => {
    const { s, sid, A, B } = replaySet();
    let st = recordEvent(s, { opId: "a", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "입력", time: "09:20", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:00:00Z")).state;
    const j1 = st.judgments.at(-1)!;
    expect(j1.story[0]).toContain("예정 09:00보다 20분 늦음");
    // A 예상 종료 10:20(작업시간 유지 가정) + 이동 20 → B 도착 10:40 > 10:30 → 10분 늦음
    expect(j1.story.some((l) => l.includes("B현장 도착 10:40(계산값)") && l.includes("10분 늦음"))).toBe(true);
    expect(j1.changes.some((c) => c.kind === "신규 위험")).toBe(true);
    // 관리자 조정: B 10:40~12:10 → A→B 여유 0분(주의) · B→C 여유 0분(주의) → 위험 해소
    // (10:50 으로 미루면 B→C 가 새로 위험해진다 — 엔진이 연쇄 영향을 함께 계산)
    const b = currentSchedules(st, sid).find((x) => x.id === B)!;
    st = saveSchedule(
      st,
      { opId: "adj", sessionId: sid, scheduleId: B, expectedVersion: b.version, workerId: b.workerId, siteName: b.siteName, region: "", plannedStart: "10:40", plannedEnd: "12:10", travelMinutes: 20, priority: "보통", note: "", reason: "A 지연으로 조정", prov },
      ctxAt("2026-11-10T04:05:00Z"),
    ).state;
    const j2 = st.judgments.at(-1)!;
    expect(j2.story[0]).toContain("일정 조정: B현장");
    expect(j2.changes.some((c) => c.kind === "해소")).toBe(true);
    expect([j2.summary.risky_before, j2.summary.risky_after]).toEqual([1, 0]);
  });

  it("동시 수정 충돌은 거부 · 취소는 수정본으로 남고 R7 판단 보류는 그대로", () => {
    const { s, sid, B, C } = replaySet();
    const b = currentSchedules(s, sid).find((x) => x.id === B)!;
    expect(() =>
      saveSchedule(s, { opId: "x", sessionId: sid, scheduleId: B, expectedVersion: b.version - 1, workerId: b.workerId, siteName: "B현장", region: "", plannedStart: "10:30", plannedEnd: "12:00", travelMinutes: 20, priority: "보통", note: "", reason: "", prov }, ctxAt("2026-11-10T04:00:00Z")),
    ).toThrow(/\[충돌\]/);
    const st = cancelSchedule(s, { opId: "cx", sessionId: sid, scheduleId: B, expectedVersion: b.version, reason: "고객 요청", prov }, ctxAt("2026-11-10T04:00:00Z")).state;
    expect(currentSchedules(st, sid).find((x) => x.id === B)!.status).toBe("취소");
    const { result } = judgeSession(st, sid, new Date());
    const link = result.risk.links.find((l) => l.next.id === C)!;
    expect(link.status).toBe("판단 보류");
    expect(link.rules).toContain("R7");
  });

  it("데이터 구분은 세트 단위 — 다른 세트의 일정은 판단 입력에 들어가지 않음", () => {
    const { s, sid } = replaySet();
    const c = ctxAt("2026-11-10T03:00:00Z");
    const v = createSession(s, { title: "가상", kind: "가상 시나리오", workDate: "2026-11-09", participantId: KOO, informantId: null, source: "", sourceRef: "", clock: "09:00", note: "", createdBy: ME }, c);
    const st = saveSchedule(v.state, { opId: "v1", sessionId: v.id, scheduleId: null, expectedVersion: null, workerId: KOO, siteName: "가상 현장", region: "", plannedStart: "09:00", plannedEnd: "10:00", travelMinutes: null, priority: "보통", note: "", reason: "", prov }, c).state;
    expect(judgeSession(st, sid, new Date()).result.risk.sites.map((x) => x.title)).toEqual(["A현장", "B현장", "C현장"]);
    expect(st.sessions.find((x) => x.id === v.id)!.source).toBe("가상 시나리오");
  });

  it("반복 회차: 같은 일정을 새 세트로 복사 (작업 기록은 옮기지 않음) · 반복 번호", () => {
    const { s, sid, A } = replaySet();
    const st0 = recordEvent(s, { opId: "a", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "입력", time: "09:20", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:00:00Z")).state;
    const r = repeatSession(st0, sid, ME, ctxAt("2026-11-11T03:00:00Z"));
    expect(currentSchedules(r.state, r.id).map((x) => x.siteName)).toEqual(["A현장", "B현장", "C현장"]);
    expect(sessionEvents(r.state, r.id)).toHaveLength(0);
    expect(repeatNo(r.state, r.state.sessions.find((x) => x.id === r.id)!)).toBe(2);
    expect(r.state.sessions.find((x) => x.id === r.id)!.clock).toBe("08:30");
  });
});

describe("비교시험 시나리오 재사용 — 정답표와 같은 엔진 결과", () => {
  it("12개 시나리오를 가상 시나리오 세트로 불러오면 위험 연결 수가 고정 정답표와 같다", () => {
    for (const info of TRIAL_SCENARIOS) {
      const c = ctxAt("2026-11-10T03:00:00Z");
      const { state, sessionId } = loadTrialScenario(emptyState(c.now), info.id, ME, KOO, c);
      const { result } = judgeSession(state, sessionId, c.now);
      const risky = result.risk.links.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2).length;
      expect([info.id, risky]).toEqual([info.id, info.risks]);
    }
  });
});

describe("비교시험 측정 기록", () => {
  const base = (s: LabState): TrialValues => ({
    date: "2026-11-12",
    participantId: KOO,
    operatorId: ME,
    method: "수기",
    scenarioType: "가상 시나리오",
    scenario: "A1",
    pairKey: "비교시험 쌍 1 (A1·B1)",
    t1Sec: 185,
    t2Sec: 60,
    t1Timeout: false,
    t2Timeout: false,
    stamps: {},
    correct: 1,
    expected: 1,
    missed: 0,
    missedNote: "",
    wrong: 0,
    wrongNote: "",
    followUp: "파악함",
    followUpNote: "",
    measureMethod: "스톱워치",
    rawRef: "기록지 P01-1",
    issues: "",
    confirmedByParticipant: false,
    note: "",
    ...(s ? {} : {}),
  });

  it("같은 참가자의 같은 날 반복은 회차로 구분 · 정정은 이력으로 · 무효는 사유와 함께", () => {
    const c = ctxAt("2026-11-12T01:00:00Z");
    let s = emptyState(c.now);
    const a = addTrial(s, base(s), ME, c);
    s = a.state;
    const b = addTrial(s, { ...base(s), method: "AX", scenario: "B1", t1Sec: 70 }, ME, ctxAt("2026-11-12T01:30:00Z"));
    s = b.state;
    expect(s.trials.map((t) => trialRound(s, t))).toEqual([1, 2]);
    s = editTrial(s, a.id, { ...base(s), t1Sec: 190 }, ME, c);
    expect(s.trials[0].t1Sec).toBe(190);
    expect(s.trials[0].history[0].values.t1Sec).toBe(185);
    expect(() => voidTrial(s, b.id, "", ME, c)).toThrow(/사유/);
    s = voidTrial(s, b.id, "시나리오 잘못 고름", ME, c);
    expect(s.trials[1].voided?.reason).toBe("시나리오 잘못 고름");
    expect(() => addTrial(s, { ...base(s), t1Sec: -1 }, ME, c)).toThrow(LabError);
  });

  it("보고서: 수기·AX 실측이 모두 있어야 비교값을 내고, 없으면 '측정 없음'으로 둔다", () => {
    const c = ctxAt("2026-11-12T01:00:00Z");
    let s = emptyState(c.now);
    s = addTrial(s, base(s), ME, c).state;
    let r = buildReport(s, c.now);
    expect(r.comparison.rows[0].difference).toBeNull();
    expect(r.comparison.note).toMatch(/AX 방식 측정이 없어/);
    s = addTrial(s, { ...base(s), method: "AX", scenario: "B1", t1Sec: 70, t2Sec: 20 }, ME, c).state;
    r = buildReport(s, c.now);
    const t1 = r.comparison.rows.find((x) => x.measure === "위험 발견 소요시간(초)")!;
    expect(t1).toMatchObject({ manual: { n: 1, median: 185 }, ax: { n: 1, median: 70 }, difference: -115 });
    expect(r.measured.trials).toBe(2);
    expect(r.expected.text).toBe("");
  });
});

describe("백업·CSV", () => {
  it("JSON 백업 → 불러오기: 지문 일치 · 다시 계산한 판단이 저장된 판단과 같음 · 바뀐 파일은 지문 불일치", async () => {
    const { s, sid, A } = replaySet();
    let st = recordEvent(s, { opId: "a", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "입력", time: "09:20", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:00:00Z")).state;
    st = addNote(st, { type: "참여자 피드백", text: "이동시간은 실제로 더 걸림", speakerId: KOO, confirmation: "미확인 (입력자 기록)", status: "열림", sessionId: sid, trialId: null }, ME, ctxAt("2026-11-10T04:10:00Z")).state;
    expect(unsavedChanges(st)).toBeGreaterThan(0);
    const file = await makeBackup(st, "컨설턴트", new Date("2026-11-10T05:00:00Z"));
    const text = JSON.stringify(file);
    const back = await checkBackup(text, new Date());
    expect(back.checksumOk).toBe(true);
    expect(back.recompute).toEqual({ same: st.judgments.length, differ: [] });
    expect(back.state).toEqual(st);
    const tampered = JSON.parse(text);
    tampered.data.entries[3].enteredTime = "09:00";
    expect((await checkBackup(JSON.stringify(tampered), new Date())).checksumOk).toBe(false);
    await expect(checkBackup("{}", new Date())).rejects.toThrow(/백업 파일이 아닙니다/);
    expect(unsavedChanges(markBackup(st, "x.json", ctxAt("2026-11-10T05:00:00Z")))).toBe(0);
  });

  it("CSV: 작업 기록·판단·측정이 같은 값으로 다시 읽힌다 (출처·대리 입력·시각 근거 포함)", () => {
    const { s, sid, A } = replaySet();
    let st = recordEvent(s, { opId: "a", sessionId: sid, scheduleId: A, kind: "작업개시", timeMode: "입력", time: "09:20", via: "현장기사 화면", prov, note: "전화로 들음, 쉼표, \"따옴표\"" }, ctxAt("2026-11-10T04:00:00Z")).state;
    st = recordEvent(st, { opId: "b", sessionId: sid, scheduleId: A, kind: "작업종료", timeMode: "모름", via: "현장기사 화면", prov }, ctxAt("2026-11-10T04:01:00Z")).state;
    const ev = parseCsv(eventsCsv(st));
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ 기록: "작업개시", 실제발생시각: "2026-11-09 09:20:00", 발생시각근거: "정보 제공자 진술", 입력자: "컨설턴트", 정보제공자: "구본석", 대리입력: "대리 입력", 데이터구분: "사후 재현", 비고: '전화로 들음, 쉼표, "따옴표"' });
    expect(ev[1]).toMatchObject({ 기록: "작업종료", 실제발생시각: "", 발생시각근거: "모름" });
    const jd = parseCsv(judgmentsCsv(st));
    expect(jd).toHaveLength(st.judgments.length);
    expect(jd.at(-1)!.계산흐름).toContain("실제 시각 모름");
    expect(parseCsv(trialsCsv(st))).toEqual([]);
  });
});
