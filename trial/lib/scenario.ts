/**
 * 비교시험 시나리오 → 실제 AX 엔진 입력 연결부 (시험 화면과 엔진 교차확인이 함께 쓴다)
 *
 * - 판단은 실제 프로그램의 엔진을 그대로 부른다. 통합일정 화면(chainRisk·opsPriority)과 같은 가정
 *   (OPS_ASSUMPTIONS.assumeDurationKept)을 쓰고, 기준시각만 시나리오 값으로 준다.
 * - 조치는 통합일정 화면의 '일정 시작 조정'과 같다: 시작 시각만 바꾸고 작업시간은 유지한다.
 * - 이 파일과 trial/ 폴더는 기존 프로그램 코드를 바꾸지 않는다.
 */
import { evaluateChainRisk, fmtHHMM, parseHHMM, type RiskResult, type SiteInput, type SiteStatus } from "@/lib/risk-engine";
import { rankResponses, type PriorityResult } from "@/lib/priority-engine";
import { OPS_ASSUMPTIONS } from "@/lib/ops-calc";
import data from "../data/scenarios.json";

export interface TrialSite {
  id: string;
  region: string;
  title: string;
  workerId: string;
  plannedStart: string;
  plannedEnd: string;
  status: SiteStatus;
  actualStart?: string;
  actualEnd?: string;
  expectedEnd?: string;
  travelMinutes?: number;
}

export interface TrialScenario {
  id: string;
  set: string;
  pair: number;
  date: string;
  asOf: string;
  sites: TrialSite[];
  action: { siteId: string; newStart: string };
}

export const TRIAL_VERSION: string = data.version;
export const WORKERS: Record<string, string> = data.workers;
export const SCENARIOS: TrialScenario[] = data.scenarios as TrialScenario[];

export const workerName = (id: string) => WORKERS[id] ?? id;

/** 현장 보고 문장 — 수기 시험지와 시험 화면에 같은 문장을 쓴다 */
export function reportsOf(sc: TrialScenario): string[] {
  const out: string[] = [];
  for (const s of sc.sites) {
    if (s.status === "완료" && s.actualEnd) out.push(`${s.region}: 작업개시 ${s.actualStart} · 완료 보고 ${s.actualEnd}`);
    else if (s.actualStart) out.push(`${s.region}: 작업개시 ${s.actualStart}${s.expectedEnd ? ` · 현장 보고 예상 종료 ${s.expectedEnd}` : ""}`);
  }
  return out;
}

export function toInputs(sc: TrialScenario, sites: TrialSite[] = sc.sites): SiteInput[] {
  return sites.map((s) => ({
    id: s.id,
    title: s.region,
    region: s.region,
    workerId: s.workerId,
    date: sc.date,
    plannedStart: s.plannedStart,
    plannedEnd: s.plannedEnd,
    status: s.status,
    actualStart: s.actualStart,
    actualStartSource: s.actualStart ? "현장 보고" : undefined,
    actualEnd: s.actualEnd,
    expectedEnd: s.expectedEnd,
    expectedEndSource: s.expectedEnd ? "현장 보고" : undefined,
    travelMinutes: s.travelMinutes,
    travelSource: s.travelMinutes === undefined ? undefined : "입력값",
  }));
}

/** 시작 시각만 바꾸고 작업시간은 유지 (통합일정 '일정 시작 조정'과 같은 방식). 잘못된 시각이면 null */
export function adjustStart(sc: TrialScenario, sites: TrialSite[], siteId: string, newStart: string): TrialSite[] | null {
  const t = parseHHMM(newStart);
  const s = sites.find((x) => x.id === siteId);
  if (t === null || !s) return null;
  const dur = parseHHMM(s.plannedEnd)! - parseHHMM(s.plannedStart)!;
  if (t + dur >= 24 * 60) return null;
  return sites.map((x) => (x.id === siteId ? { ...x, plannedStart: fmtHHMM(t), plannedEnd: fmtHHMM(t + dur) } : x));
}

export function judge(sc: TrialScenario, sites: TrialSite[] = sc.sites): { risk: RiskResult; priority: PriorityResult } {
  const asOf = `${sc.date}T${sc.asOf}`;
  const risk = evaluateChainRisk(toInputs(sc, sites), { asOf, assumeDurationKept: OPS_ASSUMPTIONS.assumeDurationKept });
  const priority = rankResponses(risk, { asOf, meta: sites.map((s) => ({ siteId: s.id, priority: "보통" as const })) });
  return { risk, priority };
}
