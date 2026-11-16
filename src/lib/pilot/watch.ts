/**
 * 조기 확인 규칙 — '현장에서 혼자 붙잡고 있는' 상황을 본사가 먼저 알아채기 위한 표시 (순수 · 규칙 기반, AI 예측 아님)
 *
 * 배경 (2026-11-13 구본석 이사 통화, docs/FOCUS_0.5.0.md):
 *   작업이 원하는 방향으로 안 풀릴 때 현장 직원(특히 신규)이 본사에 연락하지 않고 혼자 해결하려다 지체된다.
 *   본사가 실시간으로 알았다면 숙련 직원 · 장비를 먼저 보냈을 것이다.
 *
 * 여기서는 이미 있는 기록(작업 시작 · 예상 종료 보고 · 작업 종료 · 문제 보고)만 본다. 새 DB 기록을 만들지 않는다.
 *   - 예정 넘김 : 작업 중인데 지금 시각이 예상 종료를 지났고, 새 예상 종료 보고도 문제 보고도 없다.
 *                예상 종료 = 작업 시작 뒤 마지막 예상 종료 보고, 없으면 '예정 소요시간 유지' 가정(늦게 시작했으면 그만큼 뒤로) —
 *                판단엔진의 가정(PILOT_ASSUMPTIONS.assumeDurationKept)과 같다.
 *   - 중간 확인 : 예정 소요시간의 절반(최소 MIN_CHECK_MINUTES분)이 지났는데 작업 시작 뒤 진행 보고(예상 종료 보고)가 없다.
 *   - 지원 중   : 처리 중인 문제 보고가 있다 (이미 본사가 알고 있음).
 * 기준 분(절반 · 20분)은 초안이다 — 회사 운영 기준으로 확정해 바꾼다. 정확도 · 개선 효과를 주장하지 않는다.
 */
import type { ScheduleProgress } from "./core";
import { SAFETY_STAGES, type SafetyStage } from "./safety";
import { hhmm, kst } from "./time";

export const WATCH_RULE_VERSION = "조기 확인 규칙 0.1 (2026-11-16 초안)";
/** 중간 확인을 묻기 시작하는 최소 경과 시간(분) — 짧은 작업에서 너무 일찍 묻지 않게 */
export const MIN_CHECK_MINUTES = 20;

export type WatchLevel = "예정 넘김" | "중간 확인" | "지원 중" | "정상" | "해당 없음";

export interface WatchInput {
  /** HH:MM */
  plannedStart: string;
  plannedEnd: string;
  /** 실제 작업 시작 (HH:MM) — 없으면 아직 시작 전 */
  startedAt: string | null;
  ended: boolean;
  cancelled?: boolean;
  /** 작업 시작 뒤 마지막 예상 종료 보고 — at: 보고 시각, end: 보고한 예상 종료 (HH:MM) */
  lastReport: { at: string; end: string } | null;
  /** 처리 중인 문제 보고가 있는가 */
  openCase: boolean;
}

export interface Watch {
  level: WatchLevel;
  /** 지금 기준 예상 종료 (HH:MM) */
  expectedEnd: string | null;
  /** 예상 종료를 넘긴 분 (예정 넘김일 때) */
  overBy: number;
  /** 작업 시작 뒤 지난 분 */
  elapsed: number;
  /** 예정 소요시간(분) */
  planned: number;
  /** 중간 확인을 묻는 시각 (HH:MM) */
  checkAt: string | null;
  /** 화면 문장 — 무엇을 보고 이렇게 판단했는지 */
  reason: string;
}

const min = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (m: number) => {
  const x = Math.max(0, Math.min(24 * 60 - 1, m));
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

/** 한 현장의 조기 확인 상태 — now 는 한국 시각 HH:MM */
export function watchOf(x: WatchInput, now: string): Watch {
  const planned = Math.max(1, min(x.plannedEnd) - min(x.plannedStart));
  const none = (level: WatchLevel, reason: string): Watch => ({ level, expectedEnd: null, overBy: 0, elapsed: 0, planned, checkAt: null, reason });
  if (x.cancelled) return none("해당 없음", "취소된 일정");
  if (x.ended) return none("해당 없음", "작업 종료");
  if (!x.startedAt) return none("해당 없음", "작업 시작 전");
  const elapsed = Math.max(0, min(now) - min(x.startedAt));
  const expectedEnd = x.lastReport ? x.lastReport.end : fmt(Math.max(min(x.plannedEnd), min(x.startedAt) + planned));
  const checkAt = fmt(min(x.startedAt) + Math.max(MIN_CHECK_MINUTES, Math.ceil(planned / 2)));
  const base = { expectedEnd, elapsed, planned, checkAt };
  if (x.openCase) return { level: "지원 중", overBy: 0, reason: "처리 중인 문제 보고가 있습니다", ...base };
  const overBy = min(now) - min(expectedEnd);
  if (overBy > 0)
    return {
      level: "예정 넘김",
      overBy,
      reason: x.lastReport ? `보고한 예상 종료 ${expectedEnd}를 ${overBy}분 넘김 · 새 보고 없음` : `예상 종료 ${expectedEnd}를 ${overBy}분 넘김 · 진행 보고 없음`,
      ...base,
    };
  if (!x.lastReport && min(now) >= min(checkAt)) return { level: "중간 확인", overBy: 0, reason: `작업 시작 ${elapsed}분째 · 진행 보고 없음`, ...base };
  return { level: "정상", overBy: 0, reason: x.lastReport ? `${x.lastReport.at}에 예상 종료 ${x.lastReport.end} 보고` : "예정 시간 안", ...base };
}

/** DB 기록(progressOf 결과)에서 입력 만들기 — 작업 시작 뒤에 보낸 예상 종료 보고만 진행 보고로 본다 */
export function watchInputOf(
  s: { planned_start: string; planned_end: string; status: string },
  p: Pick<ScheduleProgress, "started" | "ended" | "expectedEnd">,
  openCase: boolean,
): WatchInput {
  const startedAt = p.started ? kst(p.started.occurred_at).time : null;
  const r = p.expectedEnd && p.expectedEnd.expected_end && p.started && p.expectedEnd.seq > p.started.seq ? p.expectedEnd : null;
  return {
    plannedStart: hhmm(s.planned_start)!,
    plannedEnd: hhmm(s.planned_end)!,
    startedAt,
    ended: !!p.ended,
    cancelled: s.status === "취소",
    lastReport: r ? { at: kst(r.occurred_at).time, end: hhmm(r.expected_end)! } : null,
    openCase,
  };
}

/* ── 안전점검 단계 빠짐 ─────────────────────────────── */

export type SafetyGap = { stage: SafetyStage; state: "누락" | "지금 낼 차례" };

/**
 * 안전점검 3단계(작업 전 · 작업 중 · 작업 종료) 가운데 빠진 단계 — 사진 포함 제출 여부만 본다 (적합 여부는 관리자 육안 확인)
 *   - 작업 전 : 작업을 시작했는데 없음 → 누락 / 시작 전이면 '지금 낼 차례'
 *   - 작업 중 : 작업 종료했는데 없음 → 누락 / 작업 중이고 중간 확인 시각이 지났으면 '지금 낼 차례'
 *   - 작업 종료 : 작업 종료했는데 없음 → 누락
 */
export function safetyGaps(x: { started: boolean; ended: boolean; midDue: boolean; cancelled?: boolean }, stages: Iterable<string>): SafetyGap[] {
  if (x.cancelled) return [];
  const has = new Set(stages);
  const out: SafetyGap[] = [];
  for (const stage of SAFETY_STAGES) {
    if (has.has(stage)) continue;
    if (stage === "작업 전") out.push({ stage, state: x.started ? "누락" : "지금 낼 차례" });
    else if (stage === "작업 중") {
      if (x.ended) out.push({ stage, state: "누락" });
      else if (x.started && x.midDue) out.push({ stage, state: "지금 낼 차례" });
    } else if (x.ended) out.push({ stage, state: "누락" });
  }
  return out;
}
