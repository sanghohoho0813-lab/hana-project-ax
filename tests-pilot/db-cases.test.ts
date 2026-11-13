/**
 * 현장 실사용 1차 — 현장 문제 사건 · 관리자 조치 · 현장 사진 · 엔진 연결 (로컬 Supabase 의 인증·DB·RLS·저장소를 그대로 거친다)
 *   npx supabase start && npx supabase db reset && PILOT_DB_TEST=1 npm run test:pilot:db
 */
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeJudgment, type EventRow, type JobRow, type RevisionRow } from "@/lib/pilot/core";
import { DB_TEST, kstToday, makeAdmin, makeField, op, psql, sha256, sign } from "./helpers/local";

const D = kstToday();
type Admin = Awaited<ReturnType<typeof makeAdmin>>;
type Field = Awaited<ReturnType<typeof makeField>>;
const msg = (e: { message?: string } | null) => e?.message ?? "";
const nowIso = () => new Date().toISOString();
// 1×1 JPEG
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

async function schedule(c: SupabaseClient, worker: string, site: string, a: string, b: string, travel: number | null) {
  const { data, error } = await c.rpc("save_schedule", {
    p_op_id: op(), p_schedule_id: null, p_expected_version: null, p_data_kind: "실제 업무", p_work_date: D, p_assignee_id: worker,
    p_site_name: site, p_region: "", p_planned_start: a, p_planned_end: b, p_travel_minutes: travel, p_priority: "보통", p_note: null,
  });
  if (error) throw error;
  return data as { schedule_id: string; version: number; seq: number; job_id: string };
}

/** 서버(Next.js)가 하는 판단 기록과 같은 절차 — 서명키로 입력을 읽고 실제 엔진으로 계산해 기록 */
async function judge(c: SupabaseClient, jobId: string) {
  const t1 = Math.floor(Date.now() / 1000);
  const { data, error } = await c.rpc("judge_inputs", { p_job_id: jobId, p_ts: t1, p_sig: sign("inputs", jobId, t1, "") });
  if (error) throw error;
  const x = data as { job: JobRow; revisions: RevisionRow[]; events: EventRow[] };
  const payload = computeJudgment(x.job, x.revisions, x.events, { appVersion: "db-test", computedAt: nowIso() });
  const text = JSON.stringify(payload);
  const t2 = Math.floor(Date.now() / 1000);
  const done = await c.rpc("judge_complete", { p_job_id: jobId, p_ts: t2, p_payload: text, p_sig: sign("complete", jobId, t2, sha256(text)) });
  if (done.error) throw done.error;
  return payload;
}

function report(c: SupabaseClient, p: Record<string, unknown>) {
  return c.rpc("report_case", {
    p_op_id: op(), p_issue_type: "예상과 다른 설치환경", p_type_note: null, p_progress: "분해·설치 시작 후", p_needs: ["숙련 기술자 지원"],
    p_request: "분해 후 배선 상태가 예상과 다름", p_urgency: "보통", p_discovered_basis: "현장 직원 진술", p_discovered_time: "09:20",
    p_report_mode: "사후", p_report_time: "09:25", p_report_basis: "현장 직원 진술", p_expected_end: null, p_info_source: "현장기사 앱",
    p_evidence_class: "실제 업무", p_client_pressed_at: nowIso(), p_client_sent_at: nowIso(), p_app_version: "db-test", ...p,
  });
}

function step(c: SupabaseClient, caseId: string, kind: string, p: Record<string, unknown> = {}) {
  return c.rpc("case_step", {
    p_op_id: op(), p_case_id: caseId, p_kind: kind, p_action: null, p_resolution: null, p_assignee_id: null, p_assignee_name: null,
    p_message: null, p_mode: "즉시", p_time: null, p_basis: null, p_client_pressed_at: nowIso(), p_client_sent_at: nowIso(), p_app_version: "db-test", ...p,
  });
}

describe.skipIf(!DB_TEST)("현장 문제 사건 · 조치 · 사진 (로컬 Supabase)", () => {
  let admin: Admin;
  let fa: Field;
  let fb: Field;
  let A: string;
  let B: { schedule_id: string; version: number };
  let X: string;
  let caseId = "";
  let caseNo = "";

  beforeAll(async () => {
    admin = await makeAdmin();
    fa = await makeField(admin.aal2, "현장기사 A");
    fb = await makeField(admin.aal2, "현장기사 B");
    A = (await schedule(admin.aal2, fa.id, "A현장", "09:00", "10:00", null)).schedule_id;
    B = await schedule(admin.aal2, fa.id, "B현장", "10:30", "12:00", 20);
    X = (await schedule(admin.aal2, fb.id, "X현장", "09:00", "11:00", null)).schedule_id;
  });

  it("기사 A 문제 보고 (예상 종료 모름) → 사건번호 · 발견/보고/서버 시각 분리 · 엔진 기록 없음", async () => {
    const events = Number(psql(`select count(*) from public.work_events where schedule_id = '${A}'`));
    const { data, error } = await report(fa.c, { p_schedule_id: A });
    expect(error).toBeNull();
    const r = data as { case_id: string; case_no: string; end_event_id: string | null; job_id: string | null; reported_at: string; recorded_at: string };
    expect(r.case_no).toMatch(new RegExp(`^HX-${D.replace(/-/g, "")}-\\d{3}$`));
    expect(r.end_event_id).toBeNull();
    expect(r.job_id).toBeNull();
    expect(Number(psql(`select count(*) from public.work_events where schedule_id = '${A}'`))).toBe(events);
    const row = psql(`select to_char(discovered_at at time zone 'Asia/Seoul','HH24:MI'), discovered_basis, to_char(reported_at at time zone 'Asia/Seoul','HH24:MI'), report_mode, report_basis, recorded_at > reported_at, status, source, info_source, app_version from public.field_cases where id = '${r.case_id}'`);
    expect(row).toBe("09:20|현장 직원 진술|09:25|사후 입력|현장 직원 진술|t|보고됨|현장 직원|현장기사 앱|db-test");
  });

  it("변경 예상 종료가 있으면 같은 트랜잭션에 '예상 종료 보고' 1건 + 판단 대기 → 엔진: A→B 30분 늦음(매우 높음)", async () => {
    const opId = op();
    const { data, error } = await report(fa.c, { p_op_id: opId, p_schedule_id: A, p_expected_end: "10:40", p_report_mode: "즉시", p_report_time: null, p_report_basis: null, p_discovered_basis: "보고와 같은 시각", p_discovered_time: null });
    expect(error).toBeNull();
    const r = data as { case_id: string; case_no: string; end_event_id: string; job_id: string; reported_at: string };
    caseId = r.case_id;
    caseNo = r.case_no;
    expect(r.end_event_id).toBeTruthy();
    expect(r.job_id).toBeTruthy();
    expect(psql(`select kind || '|' || to_char(expected_end,'HH24:MI') || '|' || entry_mode || '|' || source from public.work_events where id = '${r.end_event_id}'`)).toBe("예상 종료 보고|10:40|즉시 기록|현장 직원");
    expect(psql(`select discovered_at = reported_at from public.field_cases where id = '${caseId}'`)).toBe("t");
    const p = await judge(admin.aal2, r.job_id);
    const ab = p.result_after.risk.links.find((l) => l.prev.title === "A현장" && l.next.title === "B현장")!;
    expect([ab.grade, ab.shortfall, ab.arrival]).toEqual(["매우 높음", 30, "11:00"]);
    expect(p.summary.risky_after).toBeGreaterThan(p.summary.risky_before);
    // 같은 요청 번호가 다시 와도 사건·이벤트가 늘지 않는다
    const again = await report(fa.c, { p_op_id: opId, p_schedule_id: A, p_expected_end: "10:40", p_report_mode: "즉시", p_report_time: null, p_report_basis: null, p_discovered_basis: "보고와 같은 시각", p_discovered_time: null });
    expect((again.data as { duplicated: boolean; case_id: string }).duplicated).toBe(true);
    expect((again.data as { case_id: string }).case_id).toBe(caseId);
    expect(Number(psql(`select count(*) from public.field_cases where op_id = '${opId}'`))).toBe(1);
    expect(Number(psql(`select count(*) from public.work_events where schedule_id = '${A}' and kind = '예상 종료 보고'`))).toBe(1);
  });

  it("기사 B는 기사 A의 사건·조치를 볼 수 없고, A의 일정·사건에 기록할 수 없다", async () => {
    const seen = await fb.c.from("field_cases").select("id").eq("id", caseId);
    expect(seen.data).toEqual([]);
    const steps = await fb.c.from("case_steps").select("id").eq("case_id", caseId);
    expect(steps.data).toEqual([]);
    const r1 = await report(fb.c, { p_schedule_id: A });
    expect(msg(r1.error)).toMatch(/\[권한\]/);
    const r2 = await step(fb.c, caseId, "현장 해결 보고", { p_resolution: "해결" });
    expect(msg(r2.error)).toMatch(/\[권한\]/);
    const r3 = await report(fb.c, { p_schedule_id: X, p_evidence_class: "가상 시나리오" });
    expect(msg(r3.error)).toMatch(/자료 구분/);
    const own = await fa.c.from("field_cases").select("case_no").eq("id", caseId).single();
    expect(own.data?.case_no).toBe(caseNo);
  });

  it("관리자: 접수 전 결정 불가 → 접수 → 담당자 배정 → 지원 결정 → 현장 전달 · 2단계 인증 전(aal1)은 불가", async () => {
    expect(msg((await step(admin.aal1, caseId, "접수")).error)).toMatch(/\[권한\]/);
    expect(msg((await step(admin.aal2, caseId, "지원 조치 결정", { p_action: "숙련 직원 투입" })).error)).toMatch(/\[순서\]/);
    expect(msg((await step(fa.c, caseId, "접수")).error)).toMatch(/\[권한\]/);
    const r = await step(admin.aal2, caseId, "접수");
    expect(r.error).toBeNull();
    expect((r.data as { status: string }).status).toBe("접수됨");
    expect(msg((await step(admin.aal2, caseId, "접수")).error)).toMatch(/\[중복\]/);
    expect((await step(admin.aal2, caseId, "담당자 배정", { p_assignee_id: admin.id })).error).toBeNull();
    expect((await step(admin.aal2, caseId, "지원 조치 결정", { p_action: "숙련 직원 투입", p_message: "숙련 기술자 10:00 도착" })).error).toBeNull();
    expect(msg((await step(admin.aal2, caseId, "현장 전달")).error)).toMatch(/전달할 내용/);
    expect((await step(admin.aal2, caseId, "현장 전달", { p_message: "숙련 기술자가 10:00에 도착합니다. 분해 상태 그대로 두세요." })).error).toBeNull();
    const c = await fa.c.from("field_cases").select("status, handler_id").eq("id", caseId).single();
    expect(c.data).toEqual({ status: "조치 중", handler_id: admin.id });
    const seen = await fa.c.from("case_steps").select("kind, message").eq("case_id", caseId).order("step_no");
    expect(seen.data?.map((x) => x.kind)).toEqual(["접수", "담당자 배정", "지원 조치 결정", "현장 전달"]);
    expect(seen.data?.at(-1)?.message).toContain("숙련 기술자가 10:00에 도착");
  });

  it("관리자 일정 조정(B 11:00~12:30) → 기존 일정 수정본 + 판단 대기 → 재판단: A→B 위험 해소", async () => {
    const { data, error } = await admin.aal2.rpc("case_adjust_schedule", {
      p_op_id: op(), p_case_id: caseId, p_schedule_id: B.schedule_id, p_expected_version: B.version, p_planned_start: "11:00", p_planned_end: "12:30",
      p_message: "A현장 지원으로 B현장 시작 조정 (고객 연락)", p_app_version: "db-test",
    });
    expect(error).toBeNull();
    const r = data as { seq: number; job_id: string };
    expect(psql(`select change_kind || '|' || (snapshot->>'planned_start') from public.schedule_revisions where seq = ${r.seq}`)).toBe("수정|11:00:00");
    const p = await judge(admin.aal2, r.job_id);
    const ab = p.result_after.risk.links.find((l) => l.prev.title === "A현장" && l.next.title === "B현장")!;
    expect(["주의", "없음"]).toContain(ab.grade);
    expect(p.changes.changes.some((c) => c.kind === "해소")).toBe(true);
    const s = await fa.c.from("case_steps").select("kind, linked_seq").eq("case_id", caseId).eq("kind", "일정 조정").single();
    expect(s.data?.linked_seq).toBe(r.seq);
  });

  it("사진: 본인 폴더 업로드 → 등록 → 관리자 서명 주소 열람 · 기사 B 접근 불가 · 남의 폴더·덮어쓰기 불가 · 삭제 표시", async () => {
    const path = `${fa.id}/${caseId}/${op()}.jpg`;
    const up = await fa.c.storage.from("field-photos").upload(path, JPEG, { contentType: "image/jpeg", upsert: false });
    expect(up.error).toBeNull();
    const reg = await fa.c.rpc("attach_case_photo", { p_op_id: op(), p_case_id: caseId, p_object_path: path, p_mime: "image/jpeg", p_size: JPEG.length, p_sha256: createHash("sha256").update(JPEG).digest("hex"), p_caption: "분해 후 배선", p_exif_removed: true, p_app_version: "db-test" });
    expect(reg.error).toBeNull();
    // 등록 전 파일이 없는 경로는 거절
    const fake = await fa.c.rpc("attach_case_photo", { p_op_id: op(), p_case_id: caseId, p_object_path: `${fa.id}/${caseId}/none.jpg`, p_mime: "image/jpeg", p_size: 10, p_sha256: "0".repeat(64), p_caption: null, p_exif_removed: true, p_app_version: "db-test" });
    expect(msg(fake.error)).toMatch(/찾을 수 없습니다/);
    // 남의 폴더에는 올릴 수 없다
    const other = await fb.c.storage.from("field-photos").upload(`${fa.id}/${caseId}/b.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(other.error).not.toBeNull();
    // 덮어쓰기 불가
    const over = await fa.c.storage.from("field-photos").upload(path, JPEG, { contentType: "image/jpeg", upsert: true });
    expect(over.error).not.toBeNull();
    // 관리자: 서명 주소로 실제 파일을 연다
    const signed = await admin.aal2.storage.from("field-photos").createSignedUrl(path, 60);
    expect(signed.error).toBeNull();
    const res = await fetch(signed.data!.signedUrl);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(JPEG)).toBe(true);
    // 기사 B는 파일도 기록도 볼 수 없다
    const bSigned = await fb.c.storage.from("field-photos").createSignedUrl(path, 60);
    expect(bSigned.error).not.toBeNull();
    const bRow = await fb.c.from("case_photos").select("id").eq("case_id", caseId);
    expect(bRow.data).toEqual([]);
    // 공개 주소로는 열리지 않는다 (비공개 버킷)
    const pub = await fetch(admin.aal2.storage.from("field-photos").getPublicUrl(path).data.publicUrl);
    expect(pub.status).toBeGreaterThanOrEqual(400);
    // 보관 기한: 업무 날짜 + 365일
    expect(psql(`select retain_until - work_date from public.case_photos p join public.field_cases c on c.id = p.case_id where p.object_path = '${path}'`)).toBe("365");
    // 삭제는 관리자만 · 사유 필수 · 기록은 남는다
    const photoId = psql(`select id from public.case_photos where object_path = '${path}'`);
    expect(msg((await fa.c.rpc("mark_photo_deleted", { p_photo_id: photoId, p_reason: "x" })).error)).toMatch(/\[권한\]/);
    expect(msg((await admin.aal2.rpc("mark_photo_deleted", { p_photo_id: photoId, p_reason: " " })).error)).toMatch(/삭제 사유/);
    expect((await admin.aal2.rpc("mark_photo_deleted", { p_photo_id: photoId, p_reason: "시험 정리" })).error).toBeNull();
    expect((await admin.aal2.storage.from("field-photos").remove([path])).error).toBeNull();
    expect(psql(`select deleted_at is not null, delete_reason from public.case_photos where id = '${photoId}'`)).toBe("t|시험 정리");
  });

  it("기사 해결 보고 → '현장 해결 보고' → 관리자 해결 확인 → '해결' · 이후 단계 거부", async () => {
    expect((await step(fa.c, caseId, "현장 해결 보고", { p_resolution: "해결", p_message: "숙련 기술자와 배선 정리 완료" })).error).toBeNull();
    expect(psql(`select status from public.field_cases where id = '${caseId}'`)).toBe("현장 해결 보고");
    expect((await step(admin.aal2, caseId, "해결 확인")).error).toBeNull();
    expect(psql(`select status from public.field_cases where id = '${caseId}'`)).toBe("해결");
    expect(msg((await step(admin.aal2, caseId, "현장 전달", { p_message: "x" })).error)).toMatch(/이미 해결/);
  });

  it("해결 못 함 보고는 '미해결'로 관리자 화면에 남고, 무효 처리하면 연결된 예상 종료 기록도 무효", async () => {
    const { data } = await report(fa.c, { p_schedule_id: B.schedule_id, p_expected_end: "13:00", p_discovered_basis: "모름", p_discovered_time: null, p_report_time: "10:40" });
    const r = data as { case_id: string; end_event_id: string };
    expect(psql(`select discovered_at is null from public.field_cases where id = '${r.case_id}'`)).toBe("t");
    expect((await step(admin.aal2, r.case_id, "접수")).error).toBeNull();
    expect((await step(fa.c, r.case_id, "현장 해결 보고", { p_resolution: "해결 못 함", p_message: "부품 없음" })).error).toBeNull();
    expect(psql(`select status from public.field_cases where id = '${r.case_id}'`)).toBe("미해결");
    expect(msg((await step(admin.aal2, r.case_id, "무효 처리")).error)).toMatch(/무효 사유/);
    expect((await step(admin.aal2, r.case_id, "무효 처리", { p_message: "다른 현장 건을 잘못 보고" })).error).toBeNull();
    expect(psql(`select count(*) from public.work_events where voids_event_id = '${r.end_event_id}' and kind = '기록 무효'`)).toBe("1");
  });

  it("사후 입력 규칙: 보고보다 이른 조치 시각 · 미래 시각 · 근거 없는 사후 시각은 거절", async () => {
    const { data } = await report(fa.c, { p_schedule_id: A, p_report_time: "09:50", p_discovered_time: "09:40" });
    const id = (data as { case_id: string }).case_id;
    expect(msg((await step(admin.aal2, id, "접수", { p_mode: "사후", p_time: "09:30", p_basis: "원자료 기록" })).error)).toMatch(/이른 시각/);
    expect(msg((await step(admin.aal2, id, "접수", { p_mode: "사후", p_time: "09:55", p_basis: null })).error)).toMatch(/근거/);
    expect(msg((await report(fa.c, { p_schedule_id: A, p_report_time: "23:59" })).error)).toMatch(/아직 오지 않은|발견시각/);
    expect((await step(admin.aal2, id, "접수", { p_mode: "사후", p_time: "09:55", p_basis: "원자료 기록" })).error).toBeNull();
    expect(psql(`select occurred_mode || '|' || occurred_basis from public.case_steps where case_id = '${id}'`)).toBe("사후 입력|원자료 기록");
  });

  it("기록 보호: 조치 단계는 고치거나 지울 수 없고, 사건·사진 표는 함수로만 바뀐다", async () => {
    expect(() => psql(`update public.case_steps set message = 'x' where case_id = '${caseId}'`)).toThrow(/추가만/);
    expect(() => psql(`delete from public.case_steps where case_id = '${caseId}'`)).toThrow(/추가만/);
    expect(() => psql(`update public.field_cases set status = '보고됨' where id = '${caseId}'`)).toThrow(/함수로만/);
    expect(() => psql(`delete from public.case_photos`)).toThrow(/삭제할 수 없습니다/);
    const direct = await fa.c.from("field_cases").update({ status: "해결" }).eq("id", caseId).select();
    expect(direct.error !== null || (direct.data ?? []).length === 0).toBe(true);
  });
});
