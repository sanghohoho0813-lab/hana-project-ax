"use server";

import { revalidatePath } from "next/cache";
import { getPilotSession } from "@/lib/pilot/session";
import { friendlyError, isFinalError } from "@/lib/pilot/errors";
import { UUID_RE } from "@/lib/pilot/op-id";
import { appVersion } from "@/lib/pilot/config";
import { SAFETY_ANSWERS, SAFETY_ITEMS, SAFETY_STAGES } from "@/lib/pilot/safety";

/** 안전점검 — 현장 직원(본인 일정)과 2단계 인증 관리자의 세션으로 DB 함수를 부른다. 적합 판정은 관리자 육안 확인 기록뿐 */

type Res<T = unknown> = ({ ok: true; duplicated: boolean } & T) | { ok: false; error: string; retry: boolean };
const fail = (m: string | undefined | null) => ({ ok: false as const, error: friendlyError(m), retry: !isFinalError(m) });
const isoOk = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

async function session() {
  const s = await getPilotSession();
  if (!s || s === "unconfigured" || !s.profile?.active) return null;
  if (s.profile.role === "admin" && s.aal !== "aal2") return null;
  return s;
}
function done() {
  revalidatePath("/pilot/field");
  revalidatePath("/pilot/admin/safety");
}

export async function submitSafetyAction(x: {
  opId: string;
  scheduleId: string;
  stage: string;
  items: { key: string; answer: string }[];
  note?: string;
  pressedAt: string;
  sentAt: string;
}): Promise<Res<{ checkId: string; checkNo: string; deficient: string[] }>> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다 (관리자는 2단계 인증).");
  if (!UUID_RE.test(x?.opId ?? "") || !UUID_RE.test(x?.scheduleId ?? "")) return fail("[입력] 번호가 올바르지 않습니다.");
  if (!(SAFETY_STAGES as readonly string[]).includes(x.stage)) return fail("[입력] 점검 단계를 고르세요.");
  if (!Array.isArray(x.items) || x.items.some((i) => !SAFETY_ITEMS.some((d) => d.key === i.key) || !(SAFETY_ANSWERS as readonly string[]).includes(i.answer)))
    return fail("[입력] 점검 항목·답을 확인해 주세요.");
  if (!isoOk(x.pressedAt) || !isoOk(x.sentAt)) return fail("[입력] 기기 시각 정보가 없습니다.");
  const { data, error } = await s.sb.rpc("submit_safety_check", {
    p_op_id: x.opId,
    p_schedule_id: x.scheduleId,
    p_stage: x.stage,
    p_items: x.items,
    p_note: x.note ?? null,
    p_mode: "즉시",
    p_time: null,
    p_basis: null,
    p_client_pressed_at: x.pressedAt,
    p_client_sent_at: x.sentAt,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  done();
  const r = data as { check_id: string; check_no: string; deficient: string[]; duplicated: boolean };
  return { ok: true, duplicated: r.duplicated, checkId: r.check_id, checkNo: r.check_no, deficient: r.deficient };
}

export async function safetyReviewAction(x: { opId: string; checkId: string; kind: string; result?: string | null; message?: string | null }): Promise<Res<{ status: string }>> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다 (관리자는 2단계 인증).");
  if (!UUID_RE.test(x?.opId ?? "") || !UUID_RE.test(x?.checkId ?? "")) return fail("[입력] 번호가 올바르지 않습니다.");
  const t = new Date().toISOString();
  const { data, error } = await s.sb.rpc("safety_review", {
    p_op_id: x.opId,
    p_check_id: x.checkId,
    p_kind: x.kind,
    p_result: x.result ?? null,
    p_message: x.message ?? null,
    p_client_pressed_at: t,
    p_client_sent_at: t,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  done();
  const r = data as { status: string; duplicated: boolean };
  return { ok: true, duplicated: r.duplicated, status: r.status };
}

export async function attachSafetyPhotoAction(x: { opId: string; checkId: string; path: string; mime: string; size: number; sha256: string; exifRemoved: boolean }): Promise<Res<{ photoId: string }>> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다.");
  if (!UUID_RE.test(x?.opId ?? "") || !UUID_RE.test(x?.checkId ?? "") || !/^[0-9a-f]{64}$/.test(x.sha256 ?? "")) return fail("[입력] 사진 정보가 올바르지 않습니다.");
  const { data, error } = await s.sb.rpc("attach_safety_photo", {
    p_op_id: x.opId,
    p_check_id: x.checkId,
    p_object_path: x.path,
    p_mime: x.mime,
    p_size: x.size,
    p_sha256: x.sha256,
    p_caption: null,
    p_exif_removed: !!x.exifRemoved,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  done();
  const r = data as { photo_id: string; duplicated: boolean };
  return { ok: true, duplicated: r.duplicated, photoId: r.photo_id };
}
