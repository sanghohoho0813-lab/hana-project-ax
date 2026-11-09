import "server-only";
import { createHash, createHmac } from "node:crypto";
import { appVersion } from "./config";
import { computeJudgment, type EventRow, type JobRow, type RevisionRow } from "./core";
import type { PilotClient } from "./supabase";

/**
 * 위험 판단 전후 기록 — 서버에서 실제 판단엔진으로 계산해 서버 전용 서명(HMAC)과 함께 DB 에 넘긴다.
 *
 * - 서명키(PILOT_JUDGE_SECRET)로 할 수 있는 일은 '판단 대기열 1건의 입력 읽기 · 결과 기록 · 실패 표시'뿐이다.
 *   일정·이벤트를 바꾸거나 다른 표를 읽을 수 없다. 브라우저는 이 키를 모르므로 판단 결과를 꾸며 넣을 수 없다.
 * - 실패해도 대기열(judgment_jobs)이 남아 다음 요청·재처리 버튼에서 다시 계산한다. 이미 기록된 건은 다시 넣지 않는다.
 */

function secret(): string {
  const s = process.env.PILOT_JUDGE_SECRET;
  if (!s || s.length < 32) throw new Error("[설정] PILOT_JUDGE_SECRET(32자 이상)이 설정되지 않았습니다.");
  return s;
}

export function signJudge(purpose: "inputs" | "complete" | "fail", jobId: string, ts: number, hash: string): string {
  return createHmac("sha256", secret()).update(`${purpose}|${jobId}|${ts}|${hash}`).digest("hex");
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const now = () => Math.floor(Date.now() / 1000);

export interface JudgeResult {
  jobId: string;
  ok: boolean;
  judgmentId?: string;
  duplicated?: boolean;
  error?: string;
}

export async function runJudgment(sb: PilotClient, jobId: string): Promise<JudgeResult> {
  try {
    const t1 = now();
    const { data, error } = await sb.rpc("judge_inputs", { p_job_id: jobId, p_ts: t1, p_sig: signJudge("inputs", jobId, t1, "") });
    if (error) throw new Error(error.message);
    const inputs = data as { job: JobRow; revisions: RevisionRow[]; events: EventRow[] };
    const payload = computeJudgment(inputs.job, inputs.revisions, inputs.events, {
      appVersion: appVersion(),
      computedAt: new Date().toISOString(),
    });
    const text = JSON.stringify(payload);
    const t2 = now();
    const done = await sb.rpc("judge_complete", { p_job_id: jobId, p_ts: t2, p_payload: text, p_sig: signJudge("complete", jobId, t2, sha256(text)) });
    if (done.error) throw new Error(done.error.message);
    const r = done.data as { judgment_id: string; duplicated: boolean };
    return { jobId, ok: true, judgmentId: r.judgment_id, duplicated: r.duplicated };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      const t3 = now();
      await sb.rpc("judge_fail", { p_job_id: jobId, p_ts: t3, p_error: message, p_sig: signJudge("fail", jobId, t3, sha256(message)) });
    } catch {
      // 실패 표시조차 못 해도 대기열은 남아 있어 다음에 다시 처리된다
    }
    return { jobId, ok: false, error: message };
  }
}

/** 이 사용자가 볼 수 있는 대기 중인 판단을 번호 순서대로 처리 (관리자: 전체 · 현장 직원: 본인이 만든 것) */
export async function processPending(sb: PilotClient, limit = 20): Promise<JudgeResult[]> {
  const { data, error } = await sb.from("judgment_jobs").select("id").eq("status", "대기").order("seq").limit(limit);
  if (error || !data) return [];
  const out: JudgeResult[] = [];
  for (const j of data as { id: string }[]) out.push(await runJudgment(sb, j.id));
  return out;
}
