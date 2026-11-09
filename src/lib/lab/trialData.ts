/**
 * 기존 비교시험(trial/) 시나리오·정답표 재사용
 *
 * - 시나리오(A1~A5·B1~B5·연습 R1·R2)와 정답표는 trial/data 의 고정 파일을 그대로 읽는다 (시험 전 지문 고정).
 * - 정답 위험 수는 진행요원용이다 — 화면에서는 '정답 수 보기'를 눌러야 보인다.
 * - AX 방식 시험은 시나리오를 현장 실증 화면에 '가상 시나리오' 세트로 불러와 같은 엔진으로 푼다.
 */
import scenarios from "../../../trial/data/scenarios.json";
import answerKey from "../../../trial/data/answer-key.json";
import { addPerson, createSession, recordEvent, saveSchedule, type Ctx, type LabState } from "./model";

interface RawSite {
  id: string;
  region: string;
  title: string;
  workerId: string;
  plannedStart: string;
  plannedEnd: string;
  status: string;
  actualStart?: string;
  actualEnd?: string;
  expectedEnd?: string;
  travelMinutes?: number;
}
interface RawScenario {
  id: string;
  set: string;
  pair: number;
  date: string;
  asOf: string;
  sites: RawSite[];
  action: { siteId: string; newStart: string };
}
interface KeyLink {
  key: string;
  grade: string;
}
interface KeyScenario {
  links: KeyLink[];
  affected: Record<string, number>;
  after: { links: KeyLink[]; affected: Record<string, number>; resolved: string[]; new: string[]; remaining: string[] };
}

const RISKY = new Set(["중간", "높음", "매우 높음"]);
const SC = (scenarios as { scenarios: RawScenario[] }).scenarios;
const KEY = (answerKey as { scenarios: Record<string, KeyScenario> }).scenarios;

export const TRIAL_SET_VERSION = (scenarios as { version: string }).version;
export const TRIAL_KEY_VERSION = (answerKey as { version: string }).version;

export interface TrialScenarioInfo {
  id: string;
  set: string;
  /** A·B 세트에서 같은 번호끼리 같은 유형 (대응 묶음) */
  pair: number;
  label: string;
  date: string;
  asOf: string;
  sites: number;
  /** 정답표 — 조치 전 위험 연결 수 · 늦어지는 현장 수 · 조치 후 위험 수 */
  risks: number;
  affected: number;
  risksAfter: number;
  action: string;
}

export const TRIAL_SCENARIOS: TrialScenarioInfo[] = SC.map((s) => {
  const k = KEY[s.id];
  const act = s.sites.find((x) => x.id === s.action.siteId);
  return {
    id: s.id,
    set: s.set,
    pair: s.pair,
    label: `${s.id} (${s.set === "연습" ? "연습" : `${s.set}세트`})`,
    date: s.date,
    asOf: s.asOf,
    sites: s.sites.length,
    risks: k.links.filter((l) => RISKY.has(l.grade)).length,
    affected: Object.keys(k.affected).length,
    risksAfter: k.after.links.filter((l) => RISKY.has(l.grade)).length,
    action: `${act?.title ?? s.action.siteId} 시작을 ${s.action.newStart}로 조정`,
  };
});

export const pairKeyOf = (id: string) => {
  const s = TRIAL_SCENARIOS.find((x) => x.id === id);
  return s && s.pair > 0 ? `비교시험 쌍 ${s.pair} (A${s.pair}·B${s.pair})` : s ? `연습 ${s.id}` : "";
};

/**
 * 비교시험 시나리오를 '가상 시나리오' 세트로 불러온다 — AX 방식 시험을 앱 화면에서 풀 때.
 * 현장 보고(작업개시·완료·예상 종료)는 시나리오에 적힌 값만 '가상 시각' 기록으로 넣는다 (보고 시각이 없으면 비움).
 */
export function loadTrialScenario(s: LabState, id: string, by: string, participantId: string, ctx: Ctx): { state: LabState; sessionId: string } {
  const sc = SC.find((x) => x.id === id);
  if (!sc) throw new Error(`비교시험 시나리오 ${id}가 없습니다.`);
  let st = s;
  // 시나리오의 가상 작업자 (없으면 만든다)
  const workers = new Map<string, string>();
  for (const w of [...new Set(sc.sites.map((x) => x.workerId))]) {
    const name = `가상 작업자 ${w.replace("w", "")}`;
    const found = st.people.find((p) => p.name === name && p.role === "시험용 가상 기사");
    if (found) workers.set(w, found.id);
    else {
      const r = addPerson(st, { name, code: "", role: "시험용 가상 기사", org: "비교시험 시나리오" }, ctx);
      st = r.state;
      workers.set(w, r.id);
    }
  }
  const made = createSession(
    st,
    {
      title: `비교시험 ${sc.id} (${sc.set === "연습" ? "연습" : `${sc.set}세트`})`,
      kind: "가상 시나리오",
      workDate: sc.date,
      participantId,
      informantId: null,
      source: "가상 시나리오",
      sourceRef: `trial/data/scenarios.json ${TRIAL_SET_VERSION} · ${sc.id}`,
      clock: sc.asOf,
      note: `조치 카드: ${TRIAL_SCENARIOS.find((x) => x.id === id)?.action ?? ""}`,
      createdBy: by,
    },
    ctx,
  );
  st = made.state;
  const prov = { enteredBy: by, informantId: null, source: "가상 시나리오", sourceRef: `${sc.id}` };
  const ids = new Map<string, string>();
  for (const x of [...sc.sites].sort((a, b) => (a.plannedStart < b.plannedStart ? -1 : 1))) {
    const newId = ctx.id();
    ids.set(x.id, newId);
    st = saveSchedule(
      st,
      {
        opId: ctx.id(),
        sessionId: made.id,
        scheduleId: null,
        expectedVersion: null,
        workerId: workers.get(x.workerId)!,
        siteName: x.title,
        region: x.region,
        plannedStart: x.plannedStart,
        plannedEnd: x.plannedEnd,
        travelMinutes: x.travelMinutes ?? null,
        priority: "보통",
        note: "",
        reason: "비교시험 시나리오에서 불러옴",
        prov,
        newId,
      },
      ctx,
    ).state;
  }
  const ev = (scheduleId: string, kind: "작업개시" | "작업종료" | "예상 종료 보고", time?: string, expectedEnd?: string) =>
    (st = recordEvent(
      st,
      {
        opId: ctx.id(),
        sessionId: made.id,
        scheduleId,
        kind,
        timeMode: time ? "입력" : "모름",
        time,
        timeBasis: "가상 시각",
        expectedEnd: expectedEnd ?? null,
        via: "관리자 화면",
        note: "비교시험 시나리오 현장 보고",
        prov,
      },
      ctx,
    ).state);
  for (const x of sc.sites) {
    const sid = ids.get(x.id)!;
    if (x.actualStart) ev(sid, "작업개시", x.actualStart);
    if (x.status === "완료" && x.actualEnd) ev(sid, "작업종료", x.actualEnd);
    if (x.expectedEnd) ev(sid, "예상 종료 보고", undefined, x.expectedEnd);
  }
  // 불러오는 동안 기준시각이 바뀌지 않게 시나리오 기준시각으로 둔다 (보고 시각이 기준시각보다 늦은 경우 없음)
  return { state: st, sessionId: made.id };
}
