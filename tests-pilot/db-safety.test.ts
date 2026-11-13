/**
 * 현장 실사용 2차 — 작업 전·중·종료 안전점검 · 착용 사진 · 관리자 육안 확인 · 보완 요청·재확인 (로컬 Supabase)
 * 사진이 있다고 자동으로 적합 처리되지 않고, 관리자 확인 기록으로만 적합이 된다.
 */
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TEST, kstToday, makeAdmin, makeField, op, psql } from "./helpers/local";

const D = kstToday();
const msg = (e: { message?: string } | null) => e?.message ?? "";
const now = () => new Date().toISOString();
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);
const ALL_OK = [
  { key: "helmet", answer: "확인" },
  { key: "shoes", answer: "확인" },
  { key: "zone", answer: "확인" },
  { key: "harness", answer: "해당 없음" },
];

function submit(c: SupabaseClient, p: Record<string, unknown>) {
  return c.rpc("submit_safety_check", {
    p_op_id: op(), p_stage: "작업 전", p_items: ALL_OK, p_note: null, p_mode: "즉시", p_time: null, p_basis: null,
    p_client_pressed_at: now(), p_client_sent_at: now(), p_app_version: "db-test", ...p,
  });
}
function review(c: SupabaseClient, checkId: string, kind: string, p: Record<string, unknown> = {}) {
  return c.rpc("safety_review", { p_op_id: op(), p_check_id: checkId, p_kind: kind, p_result: null, p_message: null, p_client_pressed_at: now(), p_client_sent_at: now(), p_app_version: "db-test", ...p });
}
async function photo(c: SupabaseClient, uid: string, checkId: string) {
  const path = `${uid}/safety-${checkId}/${op()}.jpg`;
  const up = await c.storage.from("field-photos").upload(path, JPEG, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  return c.rpc("attach_safety_photo", { p_op_id: op(), p_check_id: checkId, p_object_path: path, p_mime: "image/jpeg", p_size: JPEG.length, p_sha256: createHash("sha256").update(JPEG).digest("hex"), p_caption: "안전모·안전화", p_exif_removed: true, p_app_version: "db-test" });
}

describe.skipIf(!DB_TEST)("안전점검 (로컬 Supabase)", () => {
  let admin: Awaited<ReturnType<typeof makeAdmin>>;
  let fa: Awaited<ReturnType<typeof makeField>>;
  let fb: Awaited<ReturnType<typeof makeField>>;
  let S = "";

  beforeAll(async () => {
    admin = await makeAdmin();
    fa = await makeField(admin.aal2, "안전 기사 A");
    fb = await makeField(admin.aal2, "안전 기사 B");
    const { data, error } = await admin.aal2.rpc("save_schedule", {
      p_op_id: op(), p_schedule_id: null, p_expected_version: null, p_data_kind: "검증 시나리오", p_work_date: D, p_assignee_id: fa.id,
      p_site_name: "안전 현장", p_region: "", p_planned_start: "09:00", p_planned_end: "10:00", p_travel_minutes: null, p_priority: "보통", p_note: null,
    });
    if (error) throw error;
    S = (data as { schedule_id: string }).schedule_id;
  });

  it("필수 항목(안전모·안전화·작업구역)에 답해야 제출 · 잘못된 항목 거절 · 같은 요청은 한 번만", async () => {
    expect(msg((await submit(fa.c, { p_schedule_id: S, p_items: [{ key: "helmet", answer: "확인" }] })).error)).toMatch(/필수 항목/);
    expect(msg((await submit(fa.c, { p_schedule_id: S, p_items: [...ALL_OK, { key: "x", answer: "확인" }] })).error)).toMatch(/항목·답/);
    expect(msg((await submit(fa.c, { p_schedule_id: S, p_items: [...ALL_OK.slice(0, 3), { key: "harness", answer: "아마도" }] })).error)).toMatch(/항목·답/);
    const id = op();
    const r1 = await submit(fa.c, { p_op_id: id, p_schedule_id: S });
    expect(r1.error).toBeNull();
    const r2 = await submit(fa.c, { p_op_id: id, p_schedule_id: S });
    expect((r2.data as { duplicated: boolean }).duplicated).toBe(true);
    expect(psql(`select count(*) from public.safety_checks where op_id = '${id}'`)).toBe("1");
    expect((r1.data as { check_no: string }).check_no).toMatch(/^ST-\d{8}-\d{3}$/);
  });

  it("사진이 없으면 관리자도 적합으로 둘 수 없고, 사진을 올린 뒤 관리자 육안 확인으로만 적합", async () => {
    const r = await submit(fa.c, { p_schedule_id: S, p_stage: "작업 중" });
    const id = (r.data as { check_id: string }).check_id;
    expect(psql(`select review_status from public.safety_checks where id = '${id}'`)).toBe("확인 대기");
    expect(msg((await review(admin.aal2, id, "관리자 확인", { p_result: "적합(육안 확인)" })).error)).toMatch(/사진이 없는/);
    expect((await photo(fa.c, fa.id, id)).error).toBeNull();
    // 사진만으로 상태가 바뀌지 않는다
    expect(psql(`select review_status from public.safety_checks where id = '${id}'`)).toBe("확인 대기");
    expect(msg((await review(fa.c, id, "관리자 확인", { p_result: "적합(육안 확인)" })).error)).toMatch(/\[권한\]/);
    expect(msg((await review(admin.aal1, id, "관리자 확인", { p_result: "적합(육안 확인)" })).error)).toMatch(/\[권한\]/);
    expect((await review(admin.aal2, id, "관리자 확인", { p_result: "적합(육안 확인)" })).error).toBeNull();
    expect(psql(`select review_status from public.safety_checks where id = '${id}'`)).toBe("적합(육안 확인)");
  });

  it("미흡 항목 → 적합 불가 → 보완 요청 → 기사 보완 제출(사진) → 관리자 조치 완료 확인 · 이력은 추가만", async () => {
    const r = await submit(fa.c, { p_schedule_id: S, p_stage: "작업 전", p_items: [...ALL_OK.slice(0, 2), { key: "zone", answer: "미흡" }] });
    const x = r.data as { check_id: string; deficient: string[] };
    expect(x.deficient).toEqual(["zone"]);
    await photo(fa.c, fa.id, x.check_id);
    expect(msg((await review(admin.aal2, x.check_id, "관리자 확인", { p_result: "적합(육안 확인)" })).error)).toMatch(/미흡 항목/);
    expect(msg((await review(fa.c, x.check_id, "보완 제출", { p_message: "통제선 설치" })).error)).toMatch(/\[순서\]/);
    expect(msg((await review(admin.aal2, x.check_id, "관리자 확인", { p_result: "보완 필요" })).error)).toMatch(/보완할 내용/);
    expect((await review(admin.aal2, x.check_id, "관리자 확인", { p_result: "보완 필요", p_message: "작업구역 통제선 설치 후 사진 다시" })).error).toBeNull();
    expect(msg((await review(admin.aal2, x.check_id, "조치 완료 확인")).error)).toMatch(/\[순서\]/);
    await photo(fa.c, fa.id, x.check_id);
    expect((await review(fa.c, x.check_id, "보완 제출", { p_message: "통제선 설치 완료" })).error).toBeNull();
    expect((await review(admin.aal2, x.check_id, "조치 완료 확인")).error).toBeNull();
    expect(psql(`select review_status from public.safety_checks where id = '${x.check_id}'`)).toBe("조치 완료");
    expect(psql(`select string_agg(kind || coalesce(':' || result, ''), ',' order by review_no) from public.safety_reviews where check_id = '${x.check_id}'`)).toBe(
      "관리자 확인:보완 필요,보완 제출,조치 완료 확인",
    );
    expect(() => psql(`update public.safety_reviews set message = 'x' where check_id = '${x.check_id}'`)).toThrow(/추가만/);
    expect(() => psql(`update public.safety_checks set review_status = '확인 대기' where id = '${x.check_id}'`)).toThrow(/함수로만/);
    const seen = await fa.c.from("safety_reviews").select("kind").eq("check_id", x.check_id);
    expect(seen.data).toHaveLength(3);
  });

  it("기사 B는 A의 점검·사진을 볼 수 없고 A 일정에 제출·사진 등록 불가", async () => {
    const r = await submit(fa.c, { p_schedule_id: S, p_stage: "작업 종료" });
    const id = (r.data as { check_id: string }).check_id;
    await photo(fa.c, fa.id, id);
    expect((await fb.c.from("safety_checks").select("id").eq("id", id)).data).toEqual([]);
    expect((await fb.c.from("case_photos").select("id").eq("safety_check_id", id)).data).toEqual([]);
    expect(msg((await submit(fb.c, { p_schedule_id: S })).error)).toMatch(/\[권한\]/);
    const path = `${fb.id}/safety-${id}/x.jpg`;
    await fb.c.storage.from("field-photos").upload(path, JPEG, { contentType: "image/jpeg" });
    const att = await fb.c.rpc("attach_safety_photo", { p_op_id: op(), p_check_id: id, p_object_path: path, p_mime: "image/jpeg", p_size: JPEG.length, p_sha256: "0".repeat(64), p_caption: null, p_exif_removed: true, p_app_version: "t" });
    expect(msg(att.error)).toMatch(/\[권한\]/);
    // A는 본인 점검 사진 기록을 읽는다
    expect((await fa.c.from("case_photos").select("id").eq("safety_check_id", id)).data).toHaveLength(1);
  });
});
