"use server";

import { revalidatePath } from "next/cache";
import { getPilotSession } from "@/lib/pilot/session";
import { friendlyError, isFinalError } from "@/lib/pilot/errors";
import { UUID_RE } from "@/lib/pilot/op-id";
import { appVersion } from "@/lib/pilot/config";

type Res = { ok: true; no: number; duplicated: boolean } | { ok: false; error: string; retry: boolean };
const fail = (m: string | undefined | null): Res => ({ ok: false, error: friendlyError(m), retry: !isFinalError(m) });
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

async function session() {
  const s = await getPilotSession();
  if (!s || s === "unconfigured" || !s.profile?.active) return null;
  if (s.profile.role === "admin" && s.aal !== "aal2") return null;
  return s;
}

export async function addTrialAction(x: Record<string, string | number | null>): Promise<Res> {
  const s = await session();
  if (!s || s.profile?.role !== "admin") return fail("[권한] 관리자(2단계 인증 완료)만 측정을 기록할 수 있습니다.");
  if (!UUID_RE.test(String(x.opId)) || !UUID_RE.test(String(x.participantId))) return fail("[입력] 참가자를 고르세요.");
  for (const k of ["findSec", "rejudgeSec", "correct", "expected", "missed", "wrong"]) {
    const v = num(x[k]);
    if (v !== null && !(Number.isFinite(v) && v >= 0)) return fail(`[입력] 숫자는 0 이상이거나 비워 두세요.`);
  }
  const { data, error } = await s.sb.rpc("add_trial", {
    p_op_id: x.opId,
    p_evidence_class: x.evidenceClass,
    p_method: x.method,
    p_scenario: x.scenario,
    p_pair_key: x.pairKey || null,
    p_case_id: x.caseId || null,
    p_participant_id: x.participantId,
    p_find_sec: num(x.findSec),
    p_rejudge_sec: num(x.rejudgeSec),
    p_correct: num(x.correct),
    p_expected: num(x.expected),
    p_missed: num(x.missed),
    p_wrong: num(x.wrong),
    p_value_basis: x.valueBasis,
    p_measure_method: x.measureMethod,
    p_started_at: x.startedAt || null,
    p_ended_at: x.endedAt || null,
    p_raw_ref: x.rawRef || null,
    p_note: x.note || null,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  revalidatePath("/pilot/admin/measures");
  const r = data as { trial_no: number; duplicated: boolean };
  return { ok: true, no: r.trial_no, duplicated: r.duplicated };
}

export async function voidTrialAction(id: string, reason: string): Promise<Res> {
  const s = await session();
  if (!s || s.profile?.role !== "admin") return fail("[권한] 관리자만 무효 처리할 수 있습니다.");
  if (!UUID_RE.test(id)) return fail("[입력] 번호가 올바르지 않습니다.");
  const { error } = await s.sb.rpc("void_trial", { p_trial_id: id, p_reason: reason });
  if (error) return fail(error.message);
  revalidatePath("/pilot/admin/measures");
  return { ok: true, no: 0, duplicated: false };
}

/** 의견·오류·개선 — 현장 직원은 의견·오류만 (본인 이름으로), 관리자는 전부 */
export async function addNoteAction(x: Record<string, string | null>): Promise<Res> {
  const s = await session();
  if (!s) return fail("[권한] 로그인이 필요합니다.");
  if (!UUID_RE.test(String(x.opId))) return fail("[입력] 요청 번호가 올바르지 않습니다.");
  if (!x.text?.trim()) return fail("[입력] 내용을 넣어 주세요.");
  const { data, error } = await s.sb.rpc("add_note", {
    p_op_id: x.opId,
    p_kind: x.kind,
    p_text: x.text,
    p_speaker_id: x.speakerId || null,
    p_speaker_name: x.speakerName || null,
    p_confirmation: x.confirmation || "입력자 기록 (본인 미확인)",
    p_case_id: x.caseId || null,
    p_ref_note_id: x.refNoteId || null,
    p_dev_date: x.devDate || null,
    p_dev_version: x.devVersion || null,
    p_app_version: appVersion(),
  });
  if (error) return fail(error.message);
  revalidatePath("/pilot/admin/measures");
  revalidatePath("/pilot/field");
  const r = data as { note_no: number; duplicated: boolean };
  return { ok: true, no: r.note_no, duplicated: r.duplicated };
}
