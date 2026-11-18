/**
 * 성과 측정 집계 (순수) — 측정 항목 1~7 + 측정 10(안전점검 3단계 — 0.5.0 제출 · 0.6.0 시점 · 관리자 확인 시간). 측정한 값만 모으고, 없는 값·개선율은 만들지 않는다.
 *  - 실제 업무 · 현장정보 재현 · 가상 시나리오를 따로 집계한다 (섞지 않음).
 *  - 시각 근거가 '기억에 의한 추정'인 소요시간과 '기억 추정' 측정값은 통계에서 빼고 따로 보여 준다.
 *  - 비교값은 같은 자료 구분 안에서 수기·AX 실측이 모두 있을 때만 '이번 측정값'으로 낸다 (통계적 유의성 검정 아님).
 *  - 원자료 없이 '현장정보 재현'으로 저장된 기록은 재현 집계에 넣지 않고 '분류 확인 필요'로 따로 센다 (0.3.1).
 */
import type { LinkChange } from "@/lib/risk-engine";
import type { JudgmentSummary } from "./core";
import { EVIDENCE_CLASSES, caseSpans, classOf, type CaseRow, type Quality, type Span, type StepRow } from "./cases";
import { SAFETY_STAGES } from "./safety";
import { safetyTiming } from "./watch";

export interface Stat {
  n: number;
  median: number | null;
  min: number | null;
  max: number | null;
}
export function stat(values: (number | null | undefined)[]): Stat {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, median: null, min: null, max: null };
  const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return { n: v.length, median: Math.round(m * 10) / 10, min: v[0], max: v[v.length - 1] };
}
export const fmtStat = (s: Stat, unit = "") => (s.n === 0 ? "측정 없음" : `중앙값 ${s.median}${unit} (범위 ${s.min}~${s.max}${unit}, n=${s.n})`);

export interface JudgmentLite {
  seq: number;
  summary: JudgmentSummary;
  changes: { changes: LinkChange[] };
}

const RISKY = new Set(["중간", "높음", "매우 높음"]);
const isRisky = (x: LinkChange["after"]) => !!x && x.status === "판정" && RISKY.has(x.grade ?? "");

export interface EngineEffect {
  seq: number;
  /** 위험이 새로 생기거나 커진 연결 수 (계산값) */
  worsened: number;
  /** 위험이 풀린 연결 수 */
  resolved: number;
  /** 조치 뒤 새로 생긴 위험 연결 수 */
  newRisks: number;
  /** 예상 시작·종료가 바뀐 현장 수 */
  affectedSites: number;
  heldBefore: number;
  heldAfter: number;
}

export function effectOf(j: JudgmentLite): EngineEffect {
  const ch = j.changes?.changes ?? [];
  return {
    seq: j.seq,
    worsened: ch.filter((c) => (c.kind === "신규 위험" || c.kind === "악화") && isRisky(c.after)).length,
    resolved: ch.filter((c) => c.kind === "해소").length,
    newRisks: ch.filter((c) => c.kind === "신규 위험").length,
    affectedSites: j.summary.affected_sites,
    heldBefore: j.summary.held_before,
    heldAfter: j.summary.held_after,
  };
}

export interface CaseMeasure {
  c: CaseRow;
  spans: Span[];
  /** 측정 5 — 보고의 예상 종료가 엔진에 들어간 판단 (없으면 예상 종료 미확인) */
  report: EngineEffect | null;
  /** 측정 6 — 관리자 일정 조정·예상 종료 변경의 재판단 */
  actions: (EngineEffect & { kind: string })[];
}

export function caseMeasures(cases: CaseRow[], steps: StepRow[], judgments: Map<number, JudgmentLite>, endSeq: Map<string, number>): CaseMeasure[] {
  return cases.map((c) => {
    const mine = steps.filter((s) => s.case_id === c.id);
    const rj = c.end_event_id ? judgments.get(endSeq.get(c.end_event_id) ?? -1) : undefined;
    return {
      c,
      spans: caseSpans(c, mine),
      report: rj ? effectOf(rj) : null,
      actions: mine
        .filter((s) => s.linked_seq !== null && judgments.has(s.linked_seq))
        .map((s) => ({ kind: s.kind, ...effectOf(judgments.get(s.linked_seq!)!) })),
    };
  });
}

export interface SpanSummary {
  key: Span["key"];
  label: string;
  stat: Stat;
  qualities: Partial<Record<Quality, number>>;
  missing: number;
}

/** 측정 1~4 — 자료 구분별 · 품질별 (추정 제외) */
export function spanSummary(ms: CaseMeasure[]) {
  const keys: Span["key"][] = ["발견→보고", "보고→확인", "확인→지원 결정", "발생→해결", "보고→해결"];
  const byClass = Object.fromEntries(
    EVIDENCE_CLASSES.map((k) => {
      const mine = ms.filter((m) => classOf(m.c) === k && m.c.status !== "무효");
      const rows: SpanSummary[] = keys.map((key) => {
        const all = mine.map((m) => m.spans.find((s) => s.key === key)!);
        const used = all.filter((s) => s.minutes !== null && s.quality !== "추정");
        const qualities: Partial<Record<Quality, number>> = {};
        for (const s of used) qualities[s.quality!] = (qualities[s.quality!] ?? 0) + 1;
        return { key, label: all[0]?.label ?? key, stat: stat(used.map((s) => s.minutes)), qualities, missing: all.filter((s) => s.minutes === null).length };
      });
      const reported = mine.filter((m) => m.report);
      return [
        k,
        {
          cases: mine.length,
          spans: rows,
          withEngine: reported.length,
          affected: stat(reported.map((m) => m.report!.worsened)),
          actions: mine.flatMap((m) => m.actions),
        },
      ];
    }),
  ) as Record<(typeof EVIDENCE_CLASSES)[number], { cases: number; spans: SpanSummary[]; withEngine: number; affected: Stat; actions: (EngineEffect & { kind: string })[] }>;
  const estimates = ms.flatMap((m) => m.spans.filter((s) => s.quality === "추정").map((s) => ({ caseNo: m.c.case_no, cls: m.c.evidence_class, label: s.label, minutes: s.minutes })));
  const unclassified = ms.filter((m) => classOf(m.c) === "분류 확인 필요").map((m) => m.c.case_no);
  return { byClass, estimates, unclassified };
}

export interface TrialRow {
  id: string;
  trial_no: number;
  evidence_class: (typeof EVIDENCE_CLASSES)[number];
  method: "수기" | "AX";
  scenario: string;
  pair_key: string | null;
  case_id: string | null;
  participant_id: string;
  find_sec: number | null;
  rejudge_sec: number | null;
  correct: number | null;
  expected: number | null;
  missed: number | null;
  wrong: number | null;
  value_basis: "시험 실측" | "과거 기록" | "기억 추정";
  measure_method: string;
  started_at: string | null;
  ended_at: string | null;
  raw_ref: string | null;
  note: string | null;
  recorded_at: string;
  actor_id: string;
  app_version: string;
  voided_at: string | null;
  void_reason: string | null;
}
export const TRIAL_COLS =
  "id, trial_no, evidence_class, method, scenario, pair_key, case_id, participant_id, find_sec, rejudge_sec, correct, expected, missed, wrong, value_basis, measure_method, started_at, ended_at, raw_ref, note, recorded_at, actor_id, app_version, voided_at, void_reason";

const accuracy = (t: TrialRow) => (t.expected && t.correct !== null ? Math.round((t.correct / t.expected) * 1000) / 10 : null);

/** 측정 7 — 수기 vs AX (자료 구분별 · 무효·기억 추정 제외) */
export function trialComparison(trials: TrialRow[]) {
  const ok = trials.filter((t) => !t.voided_at && t.value_basis !== "기억 추정");
  const byClass = EVIDENCE_CLASSES.map((cls) => {
    const m = ok.filter((t) => classOf(t) === cls && t.method === "수기");
    const a = ok.filter((t) => classOf(t) === cls && t.method === "AX");
    const row = (pick: (t: TrialRow) => number | null) => {
      const x = stat(m.map(pick));
      const y = stat(a.map(pick));
      return { manual: x, ax: y, diff: x.median !== null && y.median !== null ? Math.round((y.median - x.median) * 10) / 10 : null };
    };
    return {
      cls,
      n: { manual: m.length, ax: a.length },
      find: row((t) => t.find_sec),
      rejudge: row((t) => t.rejudge_sec),
      accuracy: row(accuracy),
      missed: row((t) => t.missed),
      wrong: row((t) => t.wrong),
      note:
        m.length && a.length
          ? `이번 측정값 (수기 n=${m.length}, AX n=${a.length}) · 차이 = AX − 수기 중앙값 · 통계적 유의성 검정 아님`
          : "수기·AX 측정이 모두 있어야 비교합니다 (개선율을 만들지 않음)",
    };
  });
  return {
    byClass,
    estimated: trials.filter((t) => !t.voided_at && t.value_basis === "기억 추정"),
    voided: trials.filter((t) => t.voided_at).length,
    unclassified: trials.filter((t) => !t.voided_at && classOf(t) === "분류 확인 필요").length,
  };
}

/* ── 측정 10 — 안전점검 3단계 (0.5.0 제출 · 0.6.0 시점과 관리자 확인 시간, 안전 1순위) ── */

export interface SafetyCompletion {
  /** 작업 시작이 기록된 현장 수 · 그 가운데 시작 전 점검을 작업 시작 전에 낸 현장 수 */
  started: number;
  preOnTime: number;
  /** 작업 종료가 기록된 현장 수 (취소 제외) · 3단계를 모두 낸 현장 수 · 마무리 점검을 종료 전에 낸 현장 수 */
  ended: number;
  full: number;
  finalBeforeEnd: number;
  /** 단계별 제출 현장 수 (작업 종료 현장 기준) */
  byStage: { stage: (typeof SAFETY_STAGES)[number]; sites: number }[];
  /** 기간의 점검 제출 수 · 관리자 적합(육안 확인)·조치 완료 수 · 보완 진행 수 */
  checks: number;
  reviewed: number;
  supplement: number;
  /** 점검 제출 → 관리자 첫 확인(적합 확인 또는 보완 요청)까지 걸린 분 */
  reviewMinutes: Stat;
  /** 아직 관리자 확인이 없는 점검 수 */
  unreviewed: number;
  /** 사진이 올라가지 않은 점검 수 (업로드 실패 등 — 단계를 낸 것으로 세지 않음) */
  noPhoto: number;
}

/**
 * 안전점검 3단계 — 제출 여부 · 제출 시점 · 관리자 확인 시간만 센다 (적합 여부는 관리자 육안 확인 기록).
 * 시점은 작업 시작 · 종료 기록의 실제 발생시각과 점검의 실제 점검 시각(없으면 서버 기록 시각)을 비교한다 (watch.ts safetyTiming 과 같은 기준).
 */
export function safetyCompletion(
  schedules: { id: string; status: string }[],
  times: { starts: Map<string, string>; ends: Map<string, string> },
  checks: { id: string; schedule_id: string; stage: string; review_status: string; checked_at: string | null; recorded_at: string }[],
  reviews: { check_id: string; kind: string; source: string; occurred_at: string }[] = [],
  /** 사진이 올라간 점검 id — 주면 이 점검만 단계를 낸 것으로 센다 (안 주면 모든 점검) */
  withPhoto?: Set<string>,
): SafetyCompletion {
  const live = schedules.filter((s) => s.status !== "취소");
  const counted = withPhoto ? checks.filter((c) => withPhoto.has(c.id)) : checks;
  const of = (id: string) => counted.filter((c) => c.schedule_id === id);
  const started = live.filter((s) => times.starts.has(s.id));
  const done = live.filter((s) => times.ends.has(s.id));
  const has = (id: string, st: string) => of(id).some((c) => c.stage === st);
  const timing = (id: string) => safetyTiming({ startedAt: times.starts.get(id) ?? null, endedAt: times.ends.get(id) ?? null }, of(id));
  const firstReview = (c: (typeof checks)[number]) =>
    reviews
      .filter((r) => r.check_id === c.id && r.source === "관리자" && (r.kind === "관리자 확인" || r.kind === "보완 요청"))
      .map((r) => Date.parse(r.occurred_at))
      .sort((a, b) => a - b)[0];
  const waits = checks.map((c) => {
    const r = firstReview(c);
    return r === undefined ? null : Math.max(0, Math.round((r - Date.parse(c.recorded_at)) / 60000));
  });
  return {
    started: started.length,
    preOnTime: started.filter((s) => timing(s.id).pre === "제때").length,
    ended: done.length,
    full: done.filter((s) => SAFETY_STAGES.every((st) => has(s.id, st))).length,
    finalBeforeEnd: done.filter((s) => timing(s.id).final === "종료 전").length,
    byStage: SAFETY_STAGES.map((stage) => ({ stage, sites: done.filter((s) => has(s.id, stage)).length })),
    checks: checks.length,
    reviewed: checks.filter((c) => c.review_status === "적합(육안 확인)" || c.review_status === "조치 완료").length,
    supplement: checks.filter((c) => c.review_status === "보완 요청" || c.review_status === "보완 제출").length,
    reviewMinutes: stat(waits),
    unreviewed: waits.filter((w) => w === null).length,
    noPhoto: checks.length - counted.length,
  };
}
