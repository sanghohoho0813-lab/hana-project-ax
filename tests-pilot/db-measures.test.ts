/**
 * 현장 실사용 3차 — 수기 vs AX 측정 · 의견·오류·개선 이력 (로컬 Supabase)
 */
import { beforeAll, describe, expect, it } from "vitest";
import { DB_TEST, makeAdmin, makeField, op, psql } from "./helpers/local";

const msg = (e: { message?: string } | null) => e?.message ?? "";

describe.skipIf(!DB_TEST)("성과 측정 기록 (로컬 Supabase)", () => {
  let admin: Awaited<ReturnType<typeof makeAdmin>>;
  let f: Awaited<ReturnType<typeof makeField>>;
  let g: Awaited<ReturnType<typeof makeField>>;
  beforeAll(async () => {
    admin = await makeAdmin();
    f = await makeField(admin.aal2, "측정 기사");
    g = await makeField(admin.aal2, "다른 기사");
  });
  const trial = (c = admin.aal2, p: Record<string, unknown> = {}) =>
    c.rpc("add_trial", {
      p_op_id: op(), p_evidence_class: "가상 시나리오", p_method: "수기", p_scenario: "I3 지원 요청 지연", p_pair_key: "I3", p_case_id: null,
      p_participant_id: f.id, p_find_sec: 95, p_rejudge_sec: 40, p_correct: 1, p_expected: 2, p_missed: 1, p_wrong: 0, p_value_basis: "시험 실측",
      p_measure_method: "앱 측정기", p_started_at: null, p_ended_at: null, p_raw_ref: null, p_note: null, p_app_version: "db-test", ...p,
    });
  const note = (c = admin.aal2, p: Record<string, unknown> = {}) =>
    c.rpc("add_note", { p_op_id: op(), p_kind: "관리자 의견", p_text: "의견", p_speaker_id: null, p_speaker_name: null, p_confirmation: "입력자 기록 (본인 미확인)", p_case_id: null, p_ref_note_id: null, p_dev_date: null, p_dev_version: null, p_app_version: "db-test", ...p });

  it("수기·AX 측정은 관리자만 · 정확 수가 정답보다 많으면 거절 · 같은 요청은 한 번만 · 무효는 사유와 함께", async () => {
    expect(msg((await trial(f.c)).error)).toMatch(/\[권한\]/);
    expect(msg((await trial(admin.aal2, { p_correct: 3 })).error)).toMatch(/정답 위험 수보다/);
    const id = op();
    const r = await trial(admin.aal2, { p_op_id: id });
    expect(r.error).toBeNull();
    expect((await trial(admin.aal2, { p_op_id: id })).data).toMatchObject({ duplicated: true });
    const t = (r.data as { trial_id: string }).trial_id;
    expect(msg((await admin.aal2.rpc("void_trial", { p_trial_id: t, p_reason: " " })).error)).toMatch(/무효 사유/);
    expect((await admin.aal2.rpc("void_trial", { p_trial_id: t, p_reason: "시나리오 잘못 읽어 줌" })).error).toBeNull();
    expect(psql(`select void_reason from public.pilot_trials where id = '${t}'`)).toBe("시나리오 잘못 읽어 줌");
    expect((await f.c.from("pilot_trials").select("id")).data).toEqual([]);
  });

  it("현장기사는 의견·오류만 남기고 본인 것만 보며, 개선 반영은 원래 기록·날짜·버전이 필요 · 이력은 추가만", async () => {
    expect(msg((await note(f.c, { p_kind: "개선 요청" })).error)).toMatch(/\[권한\]/);
    const n = await note(f.c, { p_kind: "현장기사 의견", p_text: "사진 올리는 버튼이 작다" });
    expect(n.error).toBeNull();
    const nid = (n.data as { note_id: string }).note_id;
    expect(psql(`select confirmation || '|' || source || '|' || (speaker_id = actor_id) from public.pilot_notes where id = '${nid}'`)).toBe("본인이 직접 입력|현장 직원|true");
    expect((await g.c.from("pilot_notes").select("id").eq("id", nid)).data).toEqual([]);
    expect(msg((await note(admin.aal2, { p_kind: "개선 반영", p_text: "버튼 키움", p_ref_note_id: nid })).error)).toMatch(/원래 기록/);
    expect((await note(admin.aal2, { p_kind: "개선 반영", p_text: "사진 버튼 크기 키움", p_ref_note_id: nid, p_dev_date: "2026-11-13", p_dev_version: "0.3.0+abc1234" })).error).toBeNull();
    expect(() => psql(`update public.pilot_notes set text = 'x' where id = '${nid}'`)).toThrow(/추가만/);
  });
});
