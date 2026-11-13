/**
 * 현장 문제 시험 시나리오 (가상) — 2026-11-13 구본석 이사 인터뷰에서 확인한 문제 유형을 바탕으로 만든 시험용 가정값
 *
 * - 시각·작업시간·이동시간은 모두 시험용 가정값이다. 실제 발생빈도·실제 지연시간이 아니다.
 * - 정답(위험 연결 수·등급)은 엔진 규칙(여유 10분 미만 주의, 1~9분 늦음 중간, 10~29분 높음, 30분 이상 매우 높음,
 *   진행 중인데 예정 종료가 지나고 종료 보고가 없으면 최소 기준시각까지 작업한다고 봄)으로 손으로 계산했고,
 *   단위시험(tests-pilot/issues.test.ts)에서 엔진 결과와 맞는지 확인한다.
 * - 시험할 때 결과가 정답과 달라도 지우지 않고 '예상과 다름'으로 남긴다.
 */
import { addPerson, createSession, recordEvent, saveSchedule, type Ctx, type IssueProgress, type IssueType, type LabState, type SupportAction, type SupportNeed, type TestMode } from "./model";
import { adjustForIssue, issueStep, reportIssue, sessionIssues } from "./issues";
import { currentSchedules } from "./model";

export const ISSUE_SCENARIO_VERSION = "issue-scenarios-2026-11-13";
const DATE = "2026-11-16";

type SiteKey = "A" | "B" | "C";
export type ScriptStep =
  | { do: "report"; site: SiteKey; discovered: string; reported: string; type: IssueType; progress: IssueProgress; needs: SupportNeed[]; request: string; expectedEnd: string | null }
  | { do: "receive"; at: string }
  | { do: "decide"; at: string; action: SupportAction; text: string }
  | { do: "adjust"; at: string; site: SiteKey; start: string; end: string; reason: string }
  | { do: "finish"; site: SiteKey; at: string }
  | { do: "resolve"; at: string };

export interface AnswerStage {
  /** 이 단계 직전/직후의 엔진 판단 */
  label: string;
  /** script 의 몇 번째 단계(0부터) 기록의 판단 전(before)·후(after)인지 */
  step: number;
  when: "before" | "after";
  /** 위험(중간 이상) 연결 수 */
  risks: number;
  links: Record<"A>B" | "B>C", string>;
  /** 비교시험의 '찾아야 할 위험 수'로 쓰는 단계 */
  key?: boolean;
}

export interface IssueScenario {
  id: "I1" | "I2" | "I3";
  name: "정상 작업" | "조기 지원 요청" | "지원 요청 지연";
  /** 인터뷰 근거 (사실만) */
  basis: string;
  /** 진행요원이 읽어 주는 상황 — 이 값을 입력한다 */
  card: string[];
  clock: string;
  sites: { key: SiteKey; title: string; start: string; end: string; travel: number | null }[];
  script: ScriptStep[];
  answer: AnswerStage[];
}

const SITES: IssueScenario["sites"] = [
  { key: "A", title: "A현장", start: "09:00", end: "10:00", travel: null },
  { key: "B", title: "B현장", start: "10:30", end: "12:00", travel: 20 },
  { key: "C", title: "C현장", start: "13:00", end: "14:30", travel: 30 },
];

export const ISSUE_SCENARIOS: IssueScenario[] = [
  {
    id: "I1",
    name: "정상 작업",
    basis: "비교 기준 — 문제 없이 예정대로 끝나는 경우",
    card: ["09:00 A현장 작업 시작 (이미 기록됨)", "10:00 A현장 작업 종료 — 문제 보고 없음"],
    clock: "09:00",
    sites: SITES,
    script: [{ do: "finish", site: "A", at: "10:00" }],
    answer: [{ label: "A현장 작업 종료 기록 후", step: 0, when: "after", risks: 0, links: { "A>B": "위험 없음 (여유 10분)", "B>C": "위험 없음 (여유 30분)" }, key: true }],
  },
  {
    id: "I2",
    name: "조기 지원 요청",
    basis: "인터뷰: 분해·설치 시작 후 예상과 다른 상황 확인 · 일찍 알렸다면 본사 지원이 빨랐을 것이라는 의견",
    card: [
      "09:00 A현장 작업 시작 (이미 기록됨)",
      "09:20 분해 후 예상과 다른 현장상황 발견 (숙련 기술자 필요)",
      "09:25 현장기사가 본사에 바로 보고 · 지원 요청 — 변경 예상 종료 10:40",
      "09:27 관리자 접수 → 09:30 지원 조치 결정(숙련 기술자 파견) · B현장 시작을 11:00으로 조정(11:00~12:30)",
      "10:40 해결",
    ],
    clock: "09:00",
    sites: SITES,
    script: [
      { do: "report", site: "A", discovered: "09:20", reported: "09:25", type: "예상과 다른 현장상황", progress: "분해·설치 시작 후", needs: ["숙련 기술자"], request: "분해 후 배선 상태가 예상과 다름", expectedEnd: "10:40" },
      { do: "receive", at: "09:27" },
      { do: "decide", at: "09:30", action: "숙련 기술자 파견", text: "숙련 기술자 원격 지원 후 필요 시 파견" },
      { do: "adjust", at: "09:30", site: "B", start: "11:00", end: "12:30", reason: "A현장 문제로 B현장 시작 조정 (고객 연락 후)" },
      { do: "resolve", at: "10:40" },
    ],
    answer: [
      { label: "보고 직전 (09:25 기준)", step: 0, when: "before", risks: 0, links: { "A>B": "위험 없음 (여유 10분)", "B>C": "위험 없음 (여유 30분)" } },
      { label: "문제 보고 직후 (예상 종료 10:40 전달)", step: 0, when: "after", risks: 1, links: { "A>B": "위험 매우 높음 (30분 늦음)", "B>C": "위험 주의 (여유 0분)" }, key: true },
      { label: "관리자 일정 조정 후 (B 11:00 시작)", step: 3, when: "after", risks: 0, links: { "A>B": "위험 주의 (여유 0분)", "B>C": "위험 주의 (여유 0분)" } },
    ],
  },
  {
    id: "I3",
    name: "지원 요청 지연",
    basis: "인터뷰: 기사가 혼자 해결하려다 본사 지원 요청이 늦어짐 · 일부 지연으로 다음 현장을 계획한 날 방문하지 못한 사례",
    card: [
      "09:00 A현장 작업 시작 (이미 기록됨)",
      "09:20 분해 후 예상과 다른 현장상황 발견 — 기사가 혼자 해결 시도",
      "10:20 본사에 보고 · 지원 요청 — 변경 예상 종료 11:10",
      "10:22 관리자 접수 → 10:30 지원 조치 결정(숙련 기술자 파견) · B현장 11:30 시작(11:30~13:00) · 10:32 C현장 13:30 시작(13:30~15:00)",
      "11:10 해결",
    ],
    clock: "09:00",
    sites: SITES,
    script: [
      { do: "report", site: "A", discovered: "09:20", reported: "10:20", type: "예상과 다른 현장상황", progress: "분해·설치 시작 후", needs: ["숙련 기술자"], request: "혼자 해결하려다 안 돼서 지원 요청", expectedEnd: "11:10" },
      { do: "receive", at: "10:22" },
      { do: "decide", at: "10:30", action: "숙련 기술자 파견", text: "숙련 기술자 파견" },
      { do: "adjust", at: "10:30", site: "B", start: "11:30", end: "13:00", reason: "A현장 지연으로 B현장 시작 조정" },
      { do: "adjust", at: "10:32", site: "C", start: "13:30", end: "15:00", reason: "B현장 조정에 따라 C현장 시작 조정" },
      { do: "resolve", at: "11:10" },
    ],
    answer: [
      { label: "보고 직전 (10:20 기준 · 예정 종료가 지났는데 종료 보고 없음 → 엔진 추정 규칙)", step: 0, when: "before", risks: 1, links: { "A>B": "위험 높음 (10분 늦음)", "B>C": "위험 없음 (여유 20분)" } },
      { label: "문제 보고 직후 (예상 종료 11:10 전달)", step: 0, when: "after", risks: 2, links: { "A>B": "위험 매우 높음 (60분 늦음)", "B>C": "위험 매우 높음 (30분 늦음)" }, key: true },
      { label: "B현장 조정 후", step: 3, when: "after", risks: 1, links: { "A>B": "위험 주의 (여유 0분)", "B>C": "위험 매우 높음 (30분 늦음)" } },
      { label: "C현장 조정 후", step: 4, when: "after", risks: 0, links: { "A>B": "위험 주의 (여유 0분)", "B>C": "위험 주의 (여유 0분)" } },
    ],
  },
];

export const issueScenarioOf = (id: string | null | undefined) => ISSUE_SCENARIOS.find((x) => x.id === id);
/** 비교시험에서 찾아야 할 위험 수 (정답) */
export const keyRisks = (sc: IssueScenario) => sc.answer.find((a) => a.key)?.risks ?? null;

/** 시나리오를 '가상 시나리오' 세트로 불러온다 — 일정 A·B·C와 A현장 작업 시작(09:00)까지만 넣고, 문제 보고·조치는 참여자가 화면에서 입력한다 */
export function loadIssueScenario(
  s: LabState,
  id: string,
  by: string,
  participantId: string,
  ctx: Ctx,
  opts: { testMode?: TestMode | null; basedOn?: string | null; workDate?: string } = {},
): { state: LabState; sessionId: string } {
  const sc = issueScenarioOf(id);
  if (!sc) throw new Error(`현장 문제 시나리오 ${id}가 없습니다.`);
  let st = s;
  const name = "가상 작업자 1";
  let worker = st.people.find((p) => p.name === name && p.role === "시험용 가상 기사")?.id;
  if (!worker) {
    const r = addPerson(st, { name, code: "", role: "시험용 가상 기사", org: "현장 문제 시나리오" }, ctx);
    st = r.state;
    worker = r.id;
  }
  const made = createSession(
    st,
    {
      title: `현장 문제 ${sc.id} ${sc.name}`,
      kind: "가상 시나리오",
      workDate: opts.workDate ?? DATE,
      participantId,
      informantId: null,
      source: "가상 시나리오",
      sourceRef: `${ISSUE_SCENARIO_VERSION} · ${sc.id}`,
      clock: sc.clock,
      note: `시험용 가정값 · 근거: ${sc.basis}`,
      createdBy: by,
      testMode: opts.testMode ?? null,
      scenarioId: sc.id,
    },
    ctx,
  );
  st = made.state;
  if (opts.basedOn) st = { ...st, sessions: st.sessions.map((x) => (x.id === made.id ? { ...x, basedOn: opts.basedOn! } : x)) };
  const prov = { enteredBy: by, informantId: null, source: "가상 시나리오", sourceRef: sc.id };
  for (const x of sc.sites) {
    st = saveSchedule(
      st,
      { opId: ctx.id(), sessionId: made.id, scheduleId: null, expectedVersion: null, workerId: worker, siteName: x.title, region: "", plannedStart: x.start, plannedEnd: x.end, travelMinutes: x.travel, priority: "보통", note: "", reason: "현장 문제 시나리오에서 불러옴", prov },
      ctx,
    ).state;
  }
  const a = currentSchedules(st, made.id).find((x) => x.siteName === "A현장")!;
  st = recordEvent(st, { opId: ctx.id(), sessionId: made.id, scheduleId: a.id, kind: "작업개시", timeMode: "입력", time: "09:00", via: "관리자 화면", note: "시나리오 시작 상태", prov }, ctx).state;
  return { state: st, sessionId: made.id };
}

/** 시나리오 카드대로 입력 — 단위시험·검산용 (화면 시험에서는 참여자가 직접 입력) */
export function runIssueScenario(s: LabState, sessionId: string, by: string, ctx: Ctx): { state: LabState; seqs: (number | null)[] } {
  const session = s.sessions.find((x) => x.id === sessionId);
  const sc = issueScenarioOf(session?.scenarioId);
  if (!session || !sc) throw new Error("현장 문제 시나리오 세트가 아닙니다.");
  let st = s;
  const prov = { enteredBy: by, informantId: null, source: "가상 시나리오", sourceRef: sc.id };
  const site = (k: SiteKey) => currentSchedules(st, sessionId).find((x) => x.siteName === `${k}현장`)!;
  const issueId = () => sessionIssues(st, sessionId).at(-1)!.id;
  const at = (t: string) => ({ mode: "입력" as const, time: t });
  const seqs: (number | null)[] = [];
  for (const step of sc.script) {
    if (step.do === "report") {
      const r = reportIssue(st, { opId: ctx.id(), sessionId, scheduleId: site(step.site).id, type: step.type, progress: step.progress, needs: step.needs, request: step.request, discovered: at(step.discovered), reported: at(step.reported), expectedEnd: step.expectedEnd, via: "현장기사 화면", prov }, ctx);
      st = r.state;
      seqs.push(r.seq);
    } else if (step.do === "receive") {
      st = issueStep(st, { opId: ctx.id(), issueId: issueId(), kind: "지원 요청 접수", moment: at(step.at), via: "관리자 화면", prov }, ctx).state;
      seqs.push(null);
    } else if (step.do === "decide") {
      st = issueStep(st, { opId: ctx.id(), issueId: issueId(), kind: "지원 조치 결정", moment: at(step.at), action: step.action, text: step.text, via: "관리자 화면", prov }, ctx).state;
      seqs.push(null);
    } else if (step.do === "adjust") {
      const x = site(step.site);
      const r = adjustForIssue(
        st,
        {
          opId: ctx.id(),
          issueId: issueId(),
          moment: at(step.at),
          schedule: { scheduleId: x.id, expectedVersion: x.version, workerId: x.workerId, siteName: x.siteName, region: x.region, plannedStart: step.start, plannedEnd: step.end, travelMinutes: x.travelMinutes, priority: x.priority, note: x.note, reason: step.reason },
          prov,
        },
        ctx,
      );
      st = r.state;
      seqs.push(r.seq);
    } else if (step.do === "finish") {
      const r = recordEvent(st, { opId: ctx.id(), sessionId, scheduleId: site(step.site).id, kind: "작업종료", timeMode: "입력", time: step.at, via: "현장기사 화면", prov }, ctx);
      st = r.state;
      seqs.push(r.seq);
    } else {
      st = issueStep(st, { opId: ctx.id(), issueId: issueId(), kind: "해결 여부", moment: at(step.at), resolution: "해결", via: "현장기사 화면", prov }, ctx).state;
      seqs.push(null);
    }
  }
  return { state: st, seqs };
}
