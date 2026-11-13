/**
 * 현장 문제 사건 — 공통 형식 · 소요시간(시각 근거별 품질) · 관리자 우선 확인 순서 (순수 함수)
 *
 * 기술 중심: 사건은 단순 접수 대장이 아니다. 사건의 '변경 예상 종료'가 기존 연쇄위험 엔진에 들어가고,
 * 엔진이 계산한 후속 현장 지연·위험이 관리자 우선 확인 순서와 조치 전후 비교의 기준이 된다.
 */
import type { PipelineResult } from "@/lib/state-events";

export const ISSUE_TYPES = ["기술적 장애", "예상과 다른 설치환경", "추가 장비 필요", "기술 지원 필요", "안전 위험", "기타"] as const;
export const PROGRESS = ["작업 시작 전", "분해·설치 시작 후", "작업 진행 중", "작업 중단"] as const;
export const NEEDS = ["원격 기술 지원", "숙련 기술자 지원", "장비 지원", "일정 조정", "보고만"] as const;
export const ACTIONS = ["원격 기술 지원", "숙련 직원 투입", "장비 지원", "일정 조정", "지원 불필요", "기타"] as const;
export const RESOLUTIONS = ["해결", "임시 조치", "해결 못 함"] as const;
export const EVIDENCE_CLASSES = ["실제 업무", "현장정보 재현", "가상 시나리오"] as const;
export const INFO_SOURCES = ["현장기사 앱", "전화", "메신저", "업무일지", "시험 시나리오"] as const;
export const BASES = ["현장 직원 진술", "원자료 기록", "기억에 의한 추정"] as const;
export type CaseStatus = "보고됨" | "접수됨" | "조치 중" | "현장 해결 보고" | "미해결" | "해결" | "무효";
export const OPEN: CaseStatus[] = ["보고됨", "접수됨", "조치 중", "현장 해결 보고", "미해결"];

export interface CaseRow {
  id: string;
  case_no: string;
  schedule_id: string;
  data_kind: string;
  evidence_class: (typeof EVIDENCE_CLASSES)[number];
  work_date: string;
  worker_id: string;
  reporter_id: string;
  source: "현장 직원" | "관리자";
  info_source: string;
  issue_type: (typeof ISSUE_TYPES)[number];
  type_note: string | null;
  progress: string;
  needs: string[];
  request: string | null;
  urgency: "긴급" | "보통";
  discovered_at: string | null;
  discovered_basis: string;
  reported_at: string;
  report_mode: string;
  report_basis: string;
  send_delay_seconds: number | null;
  recorded_at: string;
  expected_end: string | null;
  end_event_id: string | null;
  status: CaseStatus;
  handler_id: string | null;
  app_version: string;
  updated_at: string;
}

export interface StepRow {
  id: string;
  step_no: number;
  case_id: string;
  kind: string;
  action: string | null;
  resolution: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  message: string | null;
  occurred_at: string | null;
  occurred_mode: string;
  occurred_basis: string;
  recorded_at: string;
  actor_id: string;
  source: string;
  linked_seq: number | null;
  linked_job_id: string | null;
  app_version: string;
}

export interface PhotoRow {
  id: string;
  case_id: string | null;
  safety_check_id: string | null;
  owner_id: string;
  object_path: string;
  mime: string;
  size_bytes: number;
  sha256: string;
  caption: string | null;
  exif_removed: boolean;
  recorded_at: string;
  retain_until: string;
  deleted_at: string | null;
  delete_reason: string | null;
  app_version: string;
}

export const CASE_COLS =
  "id, case_no, schedule_id, data_kind, evidence_class, work_date, worker_id, reporter_id, source, info_source, issue_type, type_note, progress, needs, request, urgency, discovered_at, discovered_basis, reported_at, report_mode, report_basis, send_delay_seconds, recorded_at, expected_end, end_event_id, status, handler_id, app_version, updated_at";
export const STEP_COLS =
  "id, step_no, case_id, kind, action, resolution, assignee_id, assignee_name, message, occurred_at, occurred_mode, occurred_basis, recorded_at, actor_id, source, linked_seq, linked_job_id, app_version";
export const PHOTO_COLS =
  "id, case_id, safety_check_id, owner_id, object_path, mime, size_bytes, sha256, caption, exif_removed, recorded_at, retain_until, deleted_at, delete_reason, app_version";

export const isOpen = (c: Pick<CaseRow, "status">) => OPEN.includes(c.status);

/* ── 소요시간 · 품질 ───────────────────────────────── */

/** 값의 품질 — 시각 근거 중 약한 쪽. '추정'은 비교 통계에서 뺀다. 가상 시나리오는 '가상' */
export type Quality = "실측" | "원자료" | "진술" | "추정" | "가상";
const RANK: Record<Quality, number> = { 실측: 4, 원자료: 3, 진술: 2, 추정: 1, 가상: 0 };
const BASIS_Q: Record<string, Quality> = {
  "버튼 누른 시각": "실측",
  "원자료 기록": "원자료",
  "현장 직원 진술": "진술",
  "보고와 같은 시각": "진술",
  "기억에 의한 추정": "추정",
};

export interface Span {
  key: "발견→보고" | "보고→확인" | "확인→지원 결정" | "발생→해결" | "보고→해결";
  label: string;
  minutes: number | null;
  quality: Quality | null;
  missing: string | null;
}

const quality = (c: Pick<CaseRow, "evidence_class">, ...bases: string[]): Quality => {
  if (c.evidence_class === "가상 시나리오") return "가상";
  return bases.map((b) => BASIS_Q[b] ?? "진술").reduce((a, b) => (RANK[b] < RANK[a] ? b : a));
};

function span(c: CaseRow, key: Span["key"], label: string, a: { at: string | null; basis: string } | null, b: { at: string | null; basis: string } | null, none: string): Span {
  if (!a || !b) return { key, label, minutes: null, quality: null, missing: none };
  if (!a.at || !b.at) return { key, label, minutes: null, quality: null, missing: "시각 모름 (추정하지 않음)" };
  return { key, label, minutes: Math.round((Date.parse(b.at) - Date.parse(a.at)) / 60000), quality: quality(c, a.basis, b.basis), missing: null };
}

const firstStep = (steps: StepRow[], kinds: string[]) => steps.filter((s) => kinds.includes(s.kind)).sort((a, b) => a.step_no - b.step_no)[0];

/** 측정 항목 1~4 — 문제 발견→최초 보고 · 보고→관리자 확인 · 확인→지원 결정 · 발생→해결 (+ 보고→해결) */
export function caseSpans(c: CaseRow, steps: StepRow[]): Span[] {
  const mine = steps.filter((s) => s.case_id === c.id);
  const t = (s: StepRow | undefined) => (s ? { at: s.occurred_at, basis: s.occurred_basis } : null);
  const disc = { at: c.discovered_at, basis: c.discovered_basis };
  const rep = { at: c.reported_at, basis: c.report_basis };
  const ack = firstStep(mine, ["접수"]);
  const decide = firstStep(mine, ["지원 조치 결정", "일정 조정"]);
  const solved = firstStep(mine, ["해결 확인"]);
  return [
    span(c, "발견→보고", "문제 발견 → 최초 보고", disc, rep, ""),
    span(c, "보고→확인", "문제 보고 → 관리자 확인(접수)", rep, t(ack), "접수 기록 없음"),
    span(c, "확인→지원 결정", "관리자 확인 → 지원 결정", t(ack), t(decide), "지원 결정 기록 없음"),
    span(c, "발생→해결", "문제 발생(발견) → 해결 확인", disc, t(solved), "해결 확인 기록 없음"),
    span(c, "보고→해결", "문제 보고 → 해결 확인", rep, t(solved), "해결 확인 기록 없음"),
  ];
}

/* ── 엔진 결과로 본 후속 현장 영향 · 우선 확인 순서 ─────────── */

export interface Impact {
  /** 이 현장 이후 같은 작업자의 연결 중 위험(중간 이상) 수 */
  risky: number;
  /** 판단 보류 연결 수 (미확인 자료) */
  held: number;
  /** 가장 늦는 후속 현장 도착 (분, 계산값) */
  maxShortfall: number;
  /** 영향받는 후속 현장 이름 */
  sites: string[];
}

const RISKY = new Set(["중간", "높음", "매우 높음"]);

/** 엔진 판단 결과에서 이 사건 현장(포함) 이후 같은 작업자 연결의 위험 — 계산값 */
export function impactOf(result: PipelineResult, scheduleId: string, workerId: string, plannedStartOf: (id: string) => string | undefined): Impact {
  const from = plannedStartOf(scheduleId) ?? "00:00";
  const links = result.risk.links.filter((l) => l.workerId === workerId && (plannedStartOf(l.prev.id) ?? "") >= from);
  const risky = links.filter((l) => l.status === "판정" && RISKY.has(l.grade ?? ""));
  return {
    risky: risky.length,
    held: links.filter((l) => l.status !== "판정").length,
    maxShortfall: Math.max(0, ...risky.map((l) => l.shortfall)),
    sites: [...new Set(risky.map((l) => l.next.title))],
  };
}

export interface Ranked {
  c: CaseRow;
  impact: Impact | null;
  reasons: string[];
  score: number[];
}

/**
 * 관리자 우선 확인 순서 — ① 안전 위험·긴급 ② 엔진이 계산한 후속 현장 위험 수 ③ 가장 늦는 후속 현장 ④ 미접수 ⑤ 오래 기다린 순.
 * 점수는 정렬용 비교값이며 확률이 아니다.
 */
export function rankCases(cases: CaseRow[], impacts: Map<string, Impact | null>, now: Date): Ranked[] {
  return cases
    .map((c) => {
      const im = impacts.get(c.id) ?? null;
      const waited = Math.max(0, Math.round((now.getTime() - Date.parse(c.reported_at)) / 60000));
      const reasons: string[] = [];
      if (c.issue_type === "안전 위험") reasons.push("안전 위험 보고");
      if (c.urgency === "긴급") reasons.push("긴급");
      if (im && im.risky > 0) reasons.push(`후속 현장 ${im.risky}곳 위험(최대 ${im.maxShortfall}분 늦음, 계산값)`);
      if (im && im.held > 0) reasons.push(`판단 보류 ${im.held}건(자료 미확인)`);
      if (!c.expected_end && c.status !== "해결") reasons.push("예상 종료 미확인 — 엔진 판단에 반영 안 됨");
      if (c.status === "보고됨") reasons.push(`미접수 ${waited}분`);
      if (c.status === "미해결") reasons.push("미해결");
      return {
        c,
        impact: im,
        reasons,
        score: [c.issue_type === "안전 위험" ? 1 : 0, c.urgency === "긴급" ? 1 : 0, im?.risky ?? 0, im?.maxShortfall ?? 0, c.status === "보고됨" ? 1 : 0, waited],
      };
    })
    .sort((a, b) => {
      for (let i = 0; i < a.score.length; i++) if (a.score[i] !== b.score[i]) return b.score[i] - a.score[i];
      return a.c.case_no < b.c.case_no ? -1 : 1;
    });
}

/** 상태 문장 (현장기사 화면) */
export const STATUS_TEXT: Record<CaseStatus, string> = {
  보고됨: "본사 확인 전",
  접수됨: "본사 접수",
  "조치 중": "본사 지원 중",
  "현장 해결 보고": "해결 보고 · 본사 확인 대기",
  미해결: "미해결 — 본사가 계속 관리",
  해결: "해결 확인됨",
  무효: "무효 처리",
};
