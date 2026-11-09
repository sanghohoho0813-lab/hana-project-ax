"use server";

import { revalidatePath } from "next/cache";
import { getPilotSession } from "@/lib/pilot/session";
import { processPending, runJudgment } from "@/lib/pilot/judge";
import { friendlyError, isFinalError } from "@/lib/pilot/errors";
import { UUID_RE } from "@/lib/pilot/op-id";
import type { PilotEventKind } from "@/lib/pilot/core";

/**
 * 작업상태 기록 — 현장 직원(또는 2단계 인증한 관리자)의 세션으로 DB 함수를 부른다.
 * 시각은 서버(DB)가 정한다: 즉시 기록은 '서버 수신 시각 − (보낸 시각 − 누른 시각)', 사후 입력은 사용자가 넣은 시각.
 * 기록 뒤 같은 요청 안에서 위험 판단 전후를 기록한다. 현장 직원에게는 다른 직원 정보가 담긴 판단 내용을 돌려주지 않는다.
 */

export interface EventInput {
  opId: string;
  scheduleId: string;
  kind: PilotEventKind;
  mode: "즉시" | "사후";
  enteredTime?: string;
  expectedEnd?: string;
  voidsEventId?: string;
  pressedAt: string;
  sentAt: string;
}

export type EventResult =
  | {
      ok: true;
      duplicated: boolean;
      eventId: string;
      occurredAt: string;
      recordedAt: string;
      entryMode: string;
      /** 이 기록의 위험 판단 전후가 저장됐는지 (안 됐으면 대기열에 남아 관리자 화면에서 다시 처리) */
      judged: boolean;
    }
  | { ok: false; error: string; retry: boolean };

const KINDS: PilotEventKind[] = ["업무 확인", "작업개시", "예상 종료 보고", "작업종료", "기록 무효"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const fail = (m: string | undefined | null): EventResult => ({ ok: false, error: friendlyError(m), retry: !isFinalError(m) });
const isoOk = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

export async function recordEventAction(input: EventInput): Promise<EventResult> {
  const s = await getPilotSession();
  if (!s || s === "unconfigured") return fail("[권한] 로그인이 필요합니다. 다시 로그인하면 보관된 기록을 이어서 보냅니다.");
  const p = s.profile;
  const allowed = !!p?.active && (p.role === "field" || (p.role === "admin" && s.aal === "aal2"));
  if (!allowed) return fail("[권한] 활성화된 실증 계정만 기록할 수 있습니다.");

  const x = input ?? ({} as EventInput);
  if (!UUID_RE.test(x.opId ?? "") || !UUID_RE.test(x.scheduleId ?? "")) return fail("[입력] 요청 번호 또는 일정 번호가 올바르지 않습니다.");
  if (!KINDS.includes(x.kind)) return fail("[입력] 알 수 없는 기록 종류입니다.");
  if (x.mode !== "즉시" && x.mode !== "사후") return fail("[입력] 기록 방식은 즉시 또는 사후입니다.");
  if (x.mode === "사후" && !TIME_RE.test(x.enteredTime ?? "")) return fail("[입력] 실제 시각(HH:MM)을 넣어 주세요.");
  if (x.expectedEnd && !TIME_RE.test(x.expectedEnd)) return fail("[입력] 예상 종료 시각(HH:MM)을 확인해 주세요.");
  if (x.voidsEventId && !UUID_RE.test(x.voidsEventId)) return fail("[입력] 정정할 기록 번호가 올바르지 않습니다.");
  if (!isoOk(x.pressedAt) || !isoOk(x.sentAt)) return fail("[입력] 기기 시각 정보가 없습니다.");

  const { data, error } = await s.sb.rpc("record_work_event", {
    p_op_id: x.opId,
    p_schedule_id: x.scheduleId,
    p_kind: x.kind,
    p_mode: x.mode,
    p_entered_time: x.mode === "사후" ? x.enteredTime : null,
    p_expected_end: x.expectedEnd || null,
    p_client_pressed_at: x.pressedAt,
    p_client_sent_at: x.sentAt,
    p_voids_event_id: x.voidsEventId || null,
    p_note: null,
  });
  if (error) return fail(error.message);
  const r = data as { event_id: string; job_id: string | null; occurred_at: string; recorded_at: string; entry_mode: string; duplicated: boolean };
  const j = r.job_id ? await runJudgment(s.sb, r.job_id) : undefined;
  await processPending(s.sb, 10);
  revalidatePath("/pilot/field");
  return {
    ok: true,
    duplicated: r.duplicated,
    eventId: r.event_id,
    occurredAt: r.occurred_at,
    recordedAt: r.recorded_at,
    entryMode: r.entry_mode,
    judged: !!j?.ok,
  };
}
