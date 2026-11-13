/**
 * 안전점검 — 항목 정의(초안) · 형식 (순수)
 * 항목은 회사 안전기준으로 확정해 바꾼다. 필수 항목은 DB 함수도 같은 키로 검사한다.
 * 사진이 있다고 적합으로 보지 않는다 — 적합은 관리자 육안 확인 기록으로만 정해진다.
 */
export const SAFETY_STAGES = ["작업 전", "작업 중", "작업 종료"] as const;
export type SafetyStage = (typeof SAFETY_STAGES)[number];
/** 화면 표시 이름 — 같은 카드의 '작업 시작·작업 종료' 버튼과 헷갈리지 않게 다른 말로 쓴다 (DB 값은 단계 이름 그대로) */
export const STAGE_LABEL: Record<SafetyStage, string> = { "작업 전": "시작 전 점검", "작업 중": "진행 중 점검", "작업 종료": "마친 뒤 점검" };
export const SAFETY_ANSWERS = ["확인", "해당 없음", "미흡"] as const;
export type SafetyAnswer = (typeof SAFETY_ANSWERS)[number];

export const SAFETY_ITEMS: { key: string; label: string; required: boolean; stages: SafetyStage[] }[] = [
  { key: "helmet", label: "안전모 착용", required: true, stages: ["작업 전", "작업 중", "작업 종료"] },
  { key: "shoes", label: "안전화 착용", required: true, stages: ["작업 전", "작업 중", "작업 종료"] },
  { key: "zone", label: "작업구역 표시·통제", required: true, stages: ["작업 전", "작업 중", "작업 종료"] },
  { key: "harness", label: "안전대 (고소작업)", required: false, stages: ["작업 전", "작업 중"] },
  { key: "gloves", label: "절연장갑 (전기작업)", required: false, stages: ["작업 전", "작업 중"] },
  { key: "ladder", label: "사다리·작업대 상태", required: false, stages: ["작업 전", "작업 중"] },
  { key: "power", label: "전원 차단·잠금 (해당 작업)", required: false, stages: ["작업 전", "작업 중"] },
  { key: "cleanup", label: "작업 후 정리·전원 복구", required: false, stages: ["작업 종료"] },
];
export const itemLabel = (key: string) => SAFETY_ITEMS.find((x) => x.key === key)?.label ?? key;

export type ReviewStatus = "확인 대기" | "적합(육안 확인)" | "보완 요청" | "보완 제출" | "조치 완료";

export interface SafetyCheckRow {
  id: string;
  check_no: string;
  schedule_id: string;
  data_kind: string;
  work_date: string;
  worker_id: string;
  reporter_id: string;
  source: string;
  stage: SafetyStage;
  items: { key: string; answer: SafetyAnswer }[];
  deficient: string[];
  note: string | null;
  checked_at: string | null;
  check_mode: string;
  check_basis: string;
  recorded_at: string;
  review_status: ReviewStatus;
  app_version: string;
  updated_at: string;
}

export interface SafetyReviewRow {
  id: string;
  review_no: number;
  check_id: string;
  kind: "관리자 확인" | "보완 요청" | "보완 제출" | "조치 완료 확인";
  result: string | null;
  message: string | null;
  occurred_at: string;
  recorded_at: string;
  actor_id: string;
  source: string;
  app_version: string;
}

export const SAFETY_COLS =
  "id, check_no, schedule_id, data_kind, work_date, worker_id, reporter_id, source, stage, items, deficient, note, checked_at, check_mode, check_basis, recorded_at, review_status, app_version, updated_at";
export const REVIEW_COLS = "id, review_no, check_id, kind, result, message, occurred_at, recorded_at, actor_id, source, app_version";
export const PENDING_REVIEW: ReviewStatus[] = ["확인 대기", "보완 제출"];
