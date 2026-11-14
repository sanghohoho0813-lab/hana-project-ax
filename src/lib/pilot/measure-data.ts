import "server-only";
import type { PilotClient } from "./supabase";
import type { DataKind } from "./core";
import { CASE_COLS, STEP_COLS, type CaseRow, type StepRow } from "./cases";
import { TRIAL_COLS, caseMeasures, type JudgmentLite, type TrialRow } from "./measures";
import { endEventSeqs } from "./case-data";

export interface NoteRow {
  id: string;
  note_no: number;
  kind: string;
  text: string;
  speaker_id: string | null;
  speaker_name: string | null;
  confirmation: string;
  case_id: string | null;
  ref_note_id: string | null;
  dev_date: string | null;
  dev_version: string | null;
  recorded_at: string;
  actor_id: string;
  source: string;
  app_version: string;
}
export const NOTE_COLS = "id, note_no, kind, text, speaker_id, speaker_name, confirmation, case_id, ref_note_id, dev_date, dev_version, recorded_at, actor_id, source, app_version";

const startOf = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString();
const endOf = (d: string) => new Date(`${d}T23:59:59.999+09:00`).toISOString();

/** 기간의 측정 자료 — 사건(측정 1~6) · 수기 vs AX(측정 7) · 의견·오류·개선(측정 8·9) (관리자 세션) */
export async function loadMeasures(sb: PilotClient, from: string, to: string, kind: DataKind) {
  const classes = kind === "실제 업무" ? ["실제 업무"] : ["현장정보 재현", "가상 시나리오"];
  const [c, t, n] = await Promise.all([
    sb.from("field_cases").select(CASE_COLS).eq("data_kind", kind).gte("work_date", from).lte("work_date", to).order("reported_at"),
    sb.from("pilot_trials").select(TRIAL_COLS).in("evidence_class", classes).gte("recorded_at", startOf(from)).lte("recorded_at", endOf(to)).order("trial_no"),
    sb.from("pilot_notes").select(NOTE_COLS).gte("recorded_at", startOf(from)).lte("recorded_at", endOf(to)).order("note_no"),
  ]);
  for (const x of [c, t, n]) if (x.error) throw new Error(x.error.message);
  const cases = (c.data ?? []) as CaseRow[];
  const ids = cases.map((x) => x.id);
  const steps = ids.length ? (((await sb.from("case_steps").select(STEP_COLS).in("case_id", ids).order("step_no")).data ?? []) as StepRow[]) : [];
  const endSeq = await endEventSeqs(sb, cases.map((x) => x.end_event_id).filter((x): x is string => !!x));
  const seqs = [...endSeq.values(), ...steps.map((s) => s.linked_seq).filter((x): x is number => x !== null)];
  const js = new Map<number, JudgmentLite>();
  if (seqs.length) {
    const { data } = await sb.from("risk_judgments").select("seq, summary, changes").in("seq", seqs);
    for (const j of (data ?? []) as JudgmentLite[]) js.set(j.seq, j);
  }
  return { measures: caseMeasures(cases, steps, js, endSeq), trials: (t.data ?? []) as TrialRow[], notes: (n.data ?? []) as NoteRow[], cases };
}
