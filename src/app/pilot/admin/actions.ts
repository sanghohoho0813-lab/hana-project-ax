"use server";

import { revalidatePath } from "next/cache";
import { getPilotSession, type PilotSession } from "@/lib/pilot/session";
import { processPending, runJudgment, type JudgeResult } from "@/lib/pilot/judge";
import { friendlyError, isFinalError } from "@/lib/pilot/errors";
import { UUID_RE } from "@/lib/pilot/op-id";
import { DATA_KINDS, type DataKind, type JudgmentSummary } from "@/lib/pilot/core";

/**
 * 관리자 서버 함수 — 로그인한 관리자 세션으로 DB 함수를 부른다 (권한은 DB 가 다시 검사).
 * 저장이 끝나면 같은 요청 안에서 위험 판단 전후를 기록하고, 남아 있던 대기 판단도 처리한다.
 * 판단 기록이 실패해도 일정 저장은 취소되지 않으며, 대기열에 남아 '다시 처리'로 기록된다.
 */

export interface JudgeBrief {
  recorded: boolean;
  summary?: JudgmentSummary;
  /** 이 요청 뒤에도 기록되지 않고 남은 판단 수 */
  pending: number;
}

export type OpResult =
  | { ok: true; message: string; duplicated: boolean; /** 일정·기록 변경일 때만 — 그 변경의 위험 판단 기록 결과 */ judge?: JudgeBrief }
  | { ok: false; error: string; /** 같은 요청 번호로 다시 보내도 되는 오류(연결 문제 등)인지 */ retry: boolean };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const fail = (message: string | undefined | null): OpResult => ({ ok: false, error: friendlyError(message), retry: !isFinalError(message) });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function adminSession(): Promise<PilotSession | OpResult> {
  const s = await getPilotSession();
  if (!s || s === "unconfigured") return fail("[권한] 로그인이 필요합니다.");
  if (s.profile?.role !== "admin" || !s.profile.active || s.aal !== "aal2") return fail("[권한] 관리자(2단계 인증 완료)만 할 수 있습니다.");
  return s;
}

async function afterWrite(s: PilotSession, jobId: string | null): Promise<JudgeBrief> {
  let mine: JudgeResult | undefined;
  if (jobId) mine = await runJudgment(s.sb, jobId);
  await processPending(s.sb);
  const { count } = await s.sb.from("judgment_jobs").select("id", { count: "exact", head: true }).eq("status", "대기");
  revalidatePath("/pilot/admin", "layout");
  return { recorded: !!mine?.ok, summary: mine?.summary, pending: count ?? 0 };
}

export async function saveScheduleAction(fd: FormData): Promise<OpResult> {
  const s = await adminSession();
  if ("ok" in s) return s;
  const opId = text(fd, "op_id");
  const scheduleId = text(fd, "schedule_id");
  const kind = text(fd, "data_kind") as DataKind;
  const date = text(fd, "work_date");
  const start = text(fd, "planned_start");
  const end = text(fd, "planned_end");
  const travel = text(fd, "travel_minutes");
  if (!UUID_RE.test(opId)) return fail("[입력] 요청 번호가 없습니다. 화면을 새로 고쳐 주세요.");
  if (scheduleId && !UUID_RE.test(scheduleId)) return fail("[입력] 일정 번호가 올바르지 않습니다.");
  if (!DATA_KINDS.includes(kind)) return fail("[입력] 데이터 구분은 실제 업무 또는 검증 시나리오입니다.");
  if (!DATE_RE.test(date)) return fail("[입력] 날짜를 확인해 주세요.");
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return fail("[입력] 예정 시작·종료 시각(HH:MM)을 넣어 주세요.");
  if (travel && !/^\d{1,3}$/.test(travel)) return fail("[입력] 이동시간은 0~600 사이 분 단위 숫자입니다.");
  const assignee = text(fd, "assignee_id");
  if (!UUID_RE.test(assignee)) return fail("[입력] 담당자를 고르세요.");

  const { data, error } = await s.sb.rpc("save_schedule", {
    p_op_id: opId,
    p_schedule_id: scheduleId || null,
    p_expected_version: scheduleId ? Number(text(fd, "expected_version")) : null,
    p_data_kind: kind,
    p_work_date: date,
    p_assignee_id: assignee,
    p_site_name: text(fd, "site_name"),
    p_region: text(fd, "region"),
    p_planned_start: start,
    p_planned_end: end,
    p_travel_minutes: travel === "" ? null : Number(travel),
    p_priority: text(fd, "priority") || "보통",
    p_note: text(fd, "note") || null,
  });
  if (error) return fail(error.message);
  const r = data as { job_id: string | null; duplicated: boolean };
  const judge = await afterWrite(s, r.job_id);
  return {
    ok: true,
    duplicated: r.duplicated,
    message: r.duplicated ? "이미 저장된 요청입니다 (처음 보낸 내용으로 저장되어 있습니다)." : scheduleId ? "일정을 고쳤습니다." : "일정을 등록했습니다.",
    judge,
  };
}

export async function cancelScheduleAction(fd: FormData): Promise<OpResult> {
  const s = await adminSession();
  if ("ok" in s) return s;
  const opId = text(fd, "op_id");
  const scheduleId = text(fd, "schedule_id");
  if (!UUID_RE.test(opId) || !UUID_RE.test(scheduleId)) return fail("[입력] 요청 번호 또는 일정 번호가 없습니다.");
  const { data, error } = await s.sb.rpc("cancel_schedule", {
    p_op_id: opId,
    p_schedule_id: scheduleId,
    p_expected_version: Number(text(fd, "expected_version")),
    p_reason: text(fd, "reason") || null,
  });
  if (error) return fail(error.message);
  const r = data as { job_id: string | null; duplicated: boolean };
  const judge = await afterWrite(s, r.job_id);
  return { ok: true, duplicated: r.duplicated, message: r.duplicated ? "이미 취소된 요청입니다." : "일정을 취소했습니다 (기록은 지워지지 않습니다).", judge };
}

/** 기록되지 않고 남은 판단을 다시 계산해 기록 */
export async function reprocessAction(): Promise<OpResult> {
  const s = await adminSession();
  if ("ok" in s) return s;
  const results = await processPending(s.sb, 50);
  const { count } = await s.sb.from("judgment_jobs").select("id", { count: "exact", head: true }).eq("status", "대기");
  revalidatePath("/pilot/admin", "layout");
  const done = results.filter((r) => r.ok).length;
  if (results.length > 0 && done === 0) return fail(results[0].error);
  return { ok: true, duplicated: false, message: `대기 판단 ${results.length}건 중 ${done}건을 기록했습니다.`, judge: { recorded: true, pending: count ?? 0 } };
}

export async function setProfileAction(fd: FormData): Promise<OpResult> {
  const s = await adminSession();
  if ("ok" in s) return s;
  const id = text(fd, "user_id");
  if (!UUID_RE.test(id)) return fail("[입력] 계정 번호가 올바르지 않습니다.");
  const { error } = await s.sb.rpc("admin_set_profile", {
    p_user_id: id,
    p_display_name: text(fd, "display_name"),
    p_role: text(fd, "role"),
    p_active: text(fd, "active") === "on" || text(fd, "active") === "true",
  });
  if (error) return fail(error.message);
  revalidatePath("/pilot/admin", "layout");
  return { ok: true, duplicated: false, message: "계정을 바꿨습니다." };
}
