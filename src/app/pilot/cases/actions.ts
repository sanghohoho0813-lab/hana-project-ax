"use server";

import { revalidatePath } from "next/cache";
import { getPilotSession, type PilotSession } from "@/lib/pilot/session";
import { processPending, runJudgment } from "@/lib/pilot/judge";
import { friendlyError, isFinalError } from "@/lib/pilot/errors";
import { UUID_RE } from "@/lib/pilot/op-id";
import { appVersion } from "@/lib/pilot/config";
import { ACTIONS, BASES, EVIDENCE_CLASSES, INFO_SOURCES, ISSUE_TYPES, NEEDS, PROGRESS, RESOLUTIONS } from "@/lib/pilot/cases";

/**
 * 현장 문제 사건 — 현장 직원(본인 담당)과 2단계 인증 관리자의 세션으로 DB 함수를 부른다.
 * 엔진에 들어가는 기록(예상 종료 보고 · 일정 조정)이 생기면 같은 요청 안에서 판단 전후를 기록한다 (실패하면 대기열에 남음).
 * 현장 직원에게는 다른 직원 정보가 담긴 판단 내용을 돌려주지 않는다.
 */

export type CaseResult<T = unknown> = ({ ok: true; duplicated: boolean; judged?: boolean } & T) | { ok: false; error: string; retry: boolean };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isoOk = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const fail = (m: string | undefined | null) => ({ ok: false as const, error: friendlyError(m), retry: !isFinalError(m) });

async function session(): Promise<PilotSession | null> {
  const s = await getPilotSession();
  if (!s || s === "unconfigured") return null;
  const p = s.profile;
  if (!p?.active) return null;
  if (p.role === "admin" && s.aal !== "aal2") return null;
  return s;
}

async function judge(s: PilotSession, jobId: string | null | undefined): Promise<boolean> {
  const j = jobId ? await runJudgment(s.sb, jobId) : undefined;
  await processPending(s.sb, 10);
  return !!j?.ok;
}

function done() {
  revalidatePath("/pilot/field");
  revalidatePath("/pilot/admin");
  revalidatePath("/pilot/admin/cases");
}

type Moment = { mode: "즉시" | "사후" | "모름"; time?: string; basis?: string; pressedAt: string; sentAt: string };
function checkMoment(m: Moment, allowUnknown: boolean): string | null {
  if (!m || !["즉시", "사후", "모름"].includes(m.mode)) return "[입력] 기록 방식을 확인해 주세요.";
  if (m.mode === "모름" && !allowUnknown) return "[입력] 이 기록은 시각이 필요합니다.";
  if (m.mode === "사후" && (!TIME_RE.test(m.time ?? "") || !(BASES as readonly string[]).includes(m.basis ?? ""))) return "[입력] 실제 시각(HH:MM)과 시각 근거를 넣어 주세요.";
  if (!isoOk(m.pressedAt) || !isoOk(m.sentAt)) return "[입력] 기기 시각 정보가 없습니다.";
  return null;
}

/* ── 문제 보고 ─────────────────────────────────────── */

export interface ReportInput {
  opId: string;
  scheduleId: string;
  issueType: string;
  typeNote?: string;
  progress: string;
  needs: string[];
  request?: string;
  urgency: "긴급" | "보통";
  discovered: { basis: "보고와 같은 시각" | "현장 직원 진술" | "원자료 기록" | "기억에 의한 추정" | "모름"; time?: string };
  report: Moment;
  expectedEnd?: string | null;
  infoSource: string;
  evidenceClass: string;
}

export async function reportCaseAction(x: ReportInput): Promise<CaseResult<{ caseId: string; caseNo: string; engine: boolean }>> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다 (관리자는 2단계 인증).");
  if (!UUID_RE.test(x?.opId ?? "") || !UUID_RE.test(x?.scheduleId ?? "")) return fail("[입력] 요청 번호 또는 일정 번호가 올바르지 않습니다.");
  if (!(ISSUE_TYPES as readonly string[]).includes(x.issueType)) return fail("[입력] 문제 유형을 고르세요.");
  if (!(PROGRESS as readonly string[]).includes(x.progress)) return fail("[입력] 작업 진행상황을 고르세요.");
  if (!Array.isArray(x.needs) || x.needs.some((n) => !(NEEDS as readonly string[]).includes(n))) return fail("[입력] 지원 요청을 확인해 주세요.");
  if (x.expectedEnd && !TIME_RE.test(x.expectedEnd)) return fail("[입력] 변경 예상 종료(HH:MM)를 확인해 주세요.");
  if (x.discovered?.basis !== "보고와 같은 시각" && x.discovered?.basis !== "모름" && !TIME_RE.test(x.discovered?.time ?? "")) return fail("[입력] 문제 발견시각을 넣거나 모름을 고르세요.");
  if (!(INFO_SOURCES as readonly string[]).includes(x.infoSource) || !(EVIDENCE_CLASSES as readonly string[]).includes(x.evidenceClass)) return fail("[입력] 자료 출처·구분을 확인해 주세요.");
  const bad = checkMoment(x.report, false);
  if (bad) return fail(bad);
  const { data, error } = await s.sb.rpc("report_case", {
    p_op_id: x.opId,
    p_schedule_id: x.scheduleId,
    p_issue_type: x.issueType,
    p_type_note: x.typeNote ?? null,
    p_progress: x.progress,
    p_needs: x.needs,
    p_request: x.request ?? null,
    p_urgency: x.urgency === "긴급" ? "긴급" : "보통",
    p_discovered_basis: x.discovered.basis,
    p_discovered_time: x.discovered.time || null,
    p_report_mode: x.report.mode,
    p_report_time: x.report.mode === "사후" ? x.report.time : null,
    p_report_basis: x.report.mode === "사후" ? x.report.basis : null,
    p_expected_end: x.expectedEnd || null,
    p_info_source: x.infoSource,
    p_evidence_class: x.evidenceClass,
    p_client_pressed_at: x.report.pressedAt,
    p_client_sent_at: x.report.sentAt,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  const r = data as { case_id: string; case_no: string; job_id: string | null; end_event_id: string | null; duplicated: boolean };
  const judged = await judge(s, r.job_id);
  done();
  return { ok: true, duplicated: r.duplicated, caseId: r.case_id, caseNo: r.case_no, engine: !!r.end_event_id, judged };
}

/* ── 조치 · 해결 단계 ──────────────────────────────── */

export interface StepInput {
  opId: string;
  caseId: string;
  kind: "접수" | "담당자 배정" | "지원 조치 결정" | "현장 전달" | "현장 해결 보고" | "해결 확인" | "미해결 유지" | "무효 처리";
  action?: string | null;
  resolution?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  message?: string | null;
  moment: Moment;
}

export async function caseStepAction(x: StepInput): Promise<CaseResult<{ status: string }>> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다 (관리자는 2단계 인증).");
  if (!UUID_RE.test(x?.opId ?? "") || !UUID_RE.test(x?.caseId ?? "")) return fail("[입력] 요청 번호 또는 사건 번호가 올바르지 않습니다.");
  if (x.action && !(ACTIONS as readonly string[]).includes(x.action)) return fail("[입력] 지원 조치를 확인해 주세요.");
  if (x.resolution && !(RESOLUTIONS as readonly string[]).includes(x.resolution)) return fail("[입력] 해결 여부를 확인해 주세요.");
  if (x.assigneeId && !UUID_RE.test(x.assigneeId)) return fail("[입력] 담당자를 확인해 주세요.");
  const bad = checkMoment(x.moment, true);
  if (bad) return fail(bad);
  const { data, error } = await s.sb.rpc("case_step", {
    p_op_id: x.opId,
    p_case_id: x.caseId,
    p_kind: x.kind,
    p_action: x.action ?? null,
    p_resolution: x.resolution ?? null,
    p_assignee_id: x.assigneeId || null,
    p_assignee_name: x.assigneeName || null,
    p_message: x.message ?? null,
    p_mode: x.moment.mode,
    p_time: x.moment.mode === "사후" ? x.moment.time : null,
    p_basis: x.moment.mode === "사후" ? x.moment.basis : null,
    p_client_pressed_at: x.moment.pressedAt,
    p_client_sent_at: x.moment.sentAt,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  // 무효 처리로 예상 종료 기록이 무효가 되면 판단 대기열이 생긴다
  const judged = x.kind === "무효 처리" ? await judge(s, null) : undefined;
  done();
  const r = data as { status: string; duplicated: boolean };
  return { ok: true, duplicated: r.duplicated, status: r.status, judged };
}

/* ── 일정 조정 → 재판단 (관리자) ─────────────────────── */

export async function caseAdjustAction(x: {
  opId: string;
  caseId: string;
  scheduleId: string;
  expectedVersion: number;
  plannedStart: string;
  plannedEnd: string;
  message: string;
}): Promise<CaseResult<{ seq: number; before: number | null; after: number | null }>> {
  const s = await session();
  if (!s || s.profile?.role !== "admin") return fail("[권한] 관리자(2단계 인증 완료)만 일정을 조정할 수 있습니다.");
  if (![x?.opId, x?.caseId, x?.scheduleId].every((v) => UUID_RE.test(v ?? ""))) return fail("[입력] 번호가 올바르지 않습니다.");
  if (!TIME_RE.test(x.plannedStart) || !TIME_RE.test(x.plannedEnd)) return fail("[입력] 새 예정 시작·종료(HH:MM)를 넣어 주세요.");
  const { data, error } = await s.sb.rpc("case_adjust_schedule", {
    p_op_id: x.opId,
    p_case_id: x.caseId,
    p_schedule_id: x.scheduleId,
    p_expected_version: x.expectedVersion,
    p_planned_start: x.plannedStart,
    p_planned_end: x.plannedEnd,
    p_message: x.message,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  const r = data as { seq: number; job_id: string; duplicated: boolean };
  const j = await runJudgment(s.sb, r.job_id);
  await processPending(s.sb, 10);
  done();
  return { ok: true, duplicated: r.duplicated, seq: r.seq, judged: j.ok, before: j.summary?.risky_before ?? null, after: j.summary?.risky_after ?? null };
}

/* ── 예상 종료 변경 (현장 직원 · 관리자) ─────────────── */

export async function caseEndAction(x: { opId: string; caseId: string; expectedEnd: string; moment: Moment }): Promise<CaseResult> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다 (관리자는 2단계 인증).");
  if (!UUID_RE.test(x?.opId ?? "") || !UUID_RE.test(x?.caseId ?? "")) return fail("[입력] 번호가 올바르지 않습니다.");
  if (!TIME_RE.test(x.expectedEnd ?? "")) return fail("[입력] 변경 예상 종료(HH:MM)를 넣어 주세요.");
  const bad = checkMoment(x.moment, false);
  if (bad) return fail(bad);
  const { data, error } = await s.sb.rpc("case_expected_end", {
    p_op_id: x.opId,
    p_case_id: x.caseId,
    p_expected_end: x.expectedEnd,
    p_mode: x.moment.mode,
    p_time: x.moment.mode === "사후" ? x.moment.time : null,
    p_basis: x.moment.mode === "사후" ? x.moment.basis : null,
    p_client_pressed_at: x.moment.pressedAt,
    p_client_sent_at: x.moment.sentAt,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  const r = data as { job_id: string | null; duplicated: boolean };
  const judged = await judge(s, r.job_id);
  done();
  return { ok: true, duplicated: r.duplicated, judged };
}

/* ── 사진 ──────────────────────────────────────────── */

export async function attachPhotoAction(x: {
  opId: string;
  caseId: string;
  path: string;
  mime: string;
  size: number;
  sha256: string;
  caption?: string;
  exifRemoved: boolean;
}): Promise<CaseResult<{ photoId: string }>> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다.");
  if (!UUID_RE.test(x?.opId ?? "") || !UUID_RE.test(x?.caseId ?? "")) return fail("[입력] 번호가 올바르지 않습니다.");
  if (!/^[0-9a-f]{64}$/.test(x.sha256 ?? "")) return fail("[입력] 사진 지문이 올바르지 않습니다.");
  const { data, error } = await s.sb.rpc("attach_case_photo", {
    p_op_id: x.opId,
    p_case_id: x.caseId,
    p_object_path: x.path,
    p_mime: x.mime,
    p_size: x.size,
    p_sha256: x.sha256,
    p_caption: x.caption ?? null,
    p_exif_removed: !!x.exifRemoved,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  done();
  const r = data as { photo_id: string; duplicated: boolean };
  return { ok: true, duplicated: r.duplicated, photoId: r.photo_id };
}

/** 사진 삭제 (관리자) — 기록에 삭제 사유를 남긴 뒤 저장소 파일을 지운다 */
export async function deletePhotoAction(photoId: string, reason: string): Promise<CaseResult> {
  const s = await session();
  if (!s || s.profile?.role !== "admin") return fail("[권한] 관리자(2단계 인증 완료)만 사진을 지울 수 있습니다.");
  if (!UUID_RE.test(photoId ?? "")) return fail("[입력] 사진 번호가 올바르지 않습니다.");
  const { data, error } = await s.sb.rpc("mark_photo_deleted", { p_photo_id: photoId, p_reason: reason });
  if (error) return fail(error.message);
  const r = data as { object_path: string };
  const rm = await s.sb.storage.from("field-photos").remove([r.object_path]);
  done();
  if (rm.error) return fail("삭제 사유는 기록됐지만 파일을 지우지 못했습니다. 다시 시도해 주세요.");
  return { ok: true, duplicated: false };
}
