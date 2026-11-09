/**
 * DB · 인증 · 권한 통합 시험 — 실제 Supabase(로컬)의 로그인 서버·DB API·RLS 를 그대로 거친다.
 *   npx supabase@2.122.0 start && npx supabase@2.122.0 db reset && npm run test:pilot:db
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeJudgment, type EventRow, type JobRow, type RevisionRow } from "@/lib/pilot/core";
import { DB_TEST, anonClient, createUser, kstToday, makeAdmin, makeField, op, psql, sha256, sign, signIn } from "./helpers/local";

const D = kstToday();

type Admin = Awaited<ReturnType<typeof makeAdmin>>;
type Field = Awaited<ReturnType<typeof makeField>>;

function schedule(c: SupabaseClient, p: Record<string, unknown>) {
  return c.rpc("save_schedule", {
    p_op_id: op(),
    p_schedule_id: null,
    p_expected_version: null,
    p_data_kind: "실제 업무",
    p_work_date: D,
    p_region: "",
    p_travel_minutes: null,
    p_priority: "보통",
    p_note: null,
    ...p,
  });
}

function event(c: SupabaseClient, p: Record<string, unknown>) {
  const now = new Date().toISOString();
  return c.rpc("record_work_event", {
    p_op_id: op(),
    p_mode: "즉시",
    p_entered_time: null,
    p_expected_end: null,
    p_client_pressed_at: now,
    p_client_sent_at: now,
    p_voids_event_id: null,
    p_note: null,
    ...p,
  });
}

const msg = (e: { message?: string } | null) => e?.message ?? "";

describe.skipIf(!DB_TEST)("실증 DB · 인증 · 권한 (로컬 Supabase)", () => {
  let admin: Admin;
  let f1: Field;
  let f2: Field;
  let s1: string; // f1 첫 일정
  let s2: string; // f1 둘째 일정
  let s3: string; // f2 일정

  beforeAll(async () => {
    admin = await makeAdmin();
    f1 = await makeField(admin.aal2, "현장 직원 1");
    f2 = await makeField(admin.aal2, "현장 직원 2");
  });

  describe("인증과 역할", () => {
    it("비로그인은 표를 읽거나 기록 함수를 부를 수 없다", async () => {
      const a = anonClient();
      const r1 = await a.from("schedules").select("id");
      expect(r1.error?.message ?? "").toMatch(/permission denied/);
      const r2 = await event(a, { p_schedule_id: "00000000-0000-0000-0000-000000000000", p_kind: "작업개시" });
      expect(msg(r2.error)).toMatch(/permission denied/);
    });

    it("공개 회원가입은 막혀 있다", async () => {
      const { error } = await anonClient().auth.signUp({ email: `x-${Date.now()}@pilot.test`, password: "Pilot-Test-2026a" });
      expect(msg(error)).toMatch(/[Ss]ignups not allowed/);
    });

    it("새 계정은 현장 직원 · 비활성으로 시작하고, 활성화 전에는 아무것도 기록할 수 없다", async () => {
      const u = await createUser("new");
      const c = await signIn(u.email);
      const { data } = await c.from("profiles").select("role, active").eq("id", u.id).single();
      expect(data).toEqual({ role: "field", active: false });
      const r = await event(c, { p_schedule_id: "00000000-0000-0000-0000-000000000000", p_kind: "작업개시" });
      expect(msg(r.error)).toMatch(/\[권한\]/);
    });

    it("관리자도 2단계 인증 전(aal1)에는 관리자 권한이 없다", async () => {
      const r = await schedule(admin.aal1, { p_assignee_id: f1.id, p_site_name: "x", p_planned_start: "09:00", p_planned_end: "10:00" });
      expect(msg(r.error)).toMatch(/\[권한\]/);
      const { data } = await admin.aal1.from("profiles").select("id");
      expect(data!.map((p) => p.id)).toEqual([admin.id]);
    });

    it("본인의 관리자 권한은 내릴 수 없다 (잠김 방지)", async () => {
      const { error } = await admin.aal2.rpc("admin_set_profile", { p_user_id: admin.id, p_display_name: "관리자", p_role: "field", p_active: true });
      expect(msg(error)).toMatch(/본인의 관리자 권한/);
    });

    it("사용자 메타데이터에 role=admin 을 넣어도 권한이 오르지 않는다", async () => {
      await f1.c.auth.updateUser({ data: { role: "admin" } });
      const r = await schedule(f1.c, { p_assignee_id: f1.id, p_site_name: "x", p_planned_start: "09:00", p_planned_end: "10:00" });
      expect(msg(r.error)).toMatch(/\[권한\]/);
      const p = await f1.c.rpc("admin_set_profile", { p_user_id: f1.id, p_display_name: "x", p_role: "admin", p_active: true });
      expect(msg(p.error)).toMatch(/\[권한\]/);
    });

    it("표에 직접 쓰기는 누구도 할 수 없다 (함수로만)", async () => {
      const w1 = await f1.c.from("work_events").insert({ op_id: op(), schedule_id: f1.id, kind: "작업개시" });
      expect(msg(w1.error)).toMatch(/permission denied/);
      const w2 = await admin.aal2.from("schedules").insert({ site_name: "x" });
      expect(msg(w2.error)).toMatch(/permission denied/);
      const w3 = await f1.c.from("profiles").update({ role: "admin" }).eq("id", f1.id);
      expect(msg(w3.error)).toMatch(/permission denied/);
    });
  });

  describe("일정 등록 (관리자)", () => {
    it("첫 일정에는 이동시간을 넣을 수 없다", async () => {
      const r = await schedule(admin.aal2, { p_assignee_id: f1.id, p_site_name: "천안", p_planned_start: "09:00", p_planned_end: "11:00", p_travel_minutes: 30 });
      expect(msg(r.error)).toMatch(/첫 일정이라/);
    });

    it("일정을 등록하면 수정본과 판단 대기열이 함께 생기고, 이동시간은 직전 일정 기준으로 기록된다", async () => {
      const a = await schedule(admin.aal2, { p_assignee_id: f1.id, p_site_name: "천안", p_planned_start: "09:00", p_planned_end: "11:00" });
      expect(a.error).toBeNull();
      s1 = a.data.schedule_id;
      const b = await schedule(admin.aal2, { p_assignee_id: f1.id, p_site_name: "아산", p_planned_start: "11:40", p_planned_end: "12:30", p_travel_minutes: 30 });
      expect(b.error).toBeNull();
      s2 = b.data.schedule_id;
      const c = await schedule(admin.aal2, { p_assignee_id: f2.id, p_site_name: "서산", p_planned_start: "09:30", p_planned_end: "11:30" });
      s3 = c.data.schedule_id;
      const { data } = await admin.aal2.from("schedules").select("id, travel_from_id, version").eq("id", s2).single();
      expect(data).toEqual({ id: s2, travel_from_id: s1, version: 1 });
      const jobs = await admin.aal2.from("judgment_jobs").select("trigger_kind").in("trigger_ref", [s1, s2, s3]);
      expect(jobs.data!.length).toBe(3);
    });

    it("같은 요청(op_id)을 다시 보내면 새로 만들지 않고 처음 결과를 돌려준다", async () => {
      const id = op();
      const args = { p_op_id: id, p_assignee_id: f2.id, p_site_name: "홍성", p_planned_start: "12:00", p_planned_end: "13:00", p_travel_minutes: 25 };
      const first = await schedule(admin.aal2, args);
      const again = await schedule(admin.aal2, args);
      expect(first.data.duplicated).toBe(false);
      expect(again.data.duplicated).toBe(true);
      expect(again.data.schedule_id).toBe(first.data.schedule_id);
      const revs = await admin.aal2.from("schedule_revisions").select("seq").eq("op_id", id);
      expect(revs.data!.length).toBe(1);
    });

    it("동시 수정 충돌은 거부하고, 날짜는 바꿀 수 없다", async () => {
      const base = { p_schedule_id: s2, p_assignee_id: f1.id, p_site_name: "아산", p_planned_start: "12:10", p_planned_end: "13:00", p_travel_minutes: 30 };
      const stale = await schedule(admin.aal2, { ...base, p_expected_version: 0 });
      expect(msg(stale.error)).toMatch(/\[충돌\]/);
      const moved = await schedule(admin.aal2, { ...base, p_expected_version: 1, p_work_date: "2026-01-01" });
      expect(msg(moved.error)).toMatch(/날짜와 데이터 구분은 바꿀 수 없습니다/);
    });

    it("현장 직원은 본인 일정만 보고, 수정본·판단 이력은 볼 수 없다", async () => {
      const own = await f1.c.from("schedules").select("id");
      expect(own.data!.map((x) => x.id).sort()).toEqual([s1, s2].sort());
      const other = await f2.c.from("schedules").select("id").in("id", [s1, s2]);
      expect(other.data).toEqual([]);
      expect((await f1.c.from("schedule_revisions").select("seq")).data).toEqual([]);
      expect((await f1.c.from("risk_judgments").select("id")).data).toEqual([]);
      const r = await schedule(f1.c, { p_assignee_id: f1.id, p_site_name: "x", p_planned_start: "09:00", p_planned_end: "10:00" });
      expect(msg(r.error)).toMatch(/\[권한\]/);
    });
  });

  describe("작업상태 기록 (현장 직원) — 세 가지 시각", () => {
    let start1: string;

    it("즉시 기록: 실제 발생시각 = 서버 기록시각 (기기 기준 전송 지연 0)", async () => {
      const r = await event(f1.c, { p_schedule_id: s1, p_kind: "작업개시" });
      expect(r.error).toBeNull();
      expect(r.data.entry_mode).toBe("즉시 기록");
      start1 = r.data.event_id;
      const { data } = await f1.c.from("work_events").select("occurred_at, recorded_at, entered_time, source, actor_id").eq("id", start1).single();
      expect(Math.abs(Date.parse(data!.occurred_at) - Date.parse(data!.recorded_at))).toBeLessThan(1000);
      expect(data!.entered_time).toBeNull();
      expect(data!.source).toBe("현장 직원");
      expect(data!.actor_id).toBe(f1.id);
    });

    it("같은 요청을 다시 보내면(재시도) 한 건만 남고, 다른 요청으로 같은 단계를 또 기록하면 거부한다", async () => {
      const id = op();
      const a = await event(f1.c, { p_op_id: id, p_schedule_id: s1, p_kind: "업무 확인" });
      const b = await event(f1.c, { p_op_id: id, p_schedule_id: s1, p_kind: "업무 확인" });
      expect([a.data.duplicated, b.data.duplicated]).toEqual([false, true]);
      expect(b.data.event_id).toBe(a.data.event_id);
      const c = await event(f1.c, { p_schedule_id: s1, p_kind: "작업개시" });
      expect(msg(c.error)).toMatch(/\[중복\]/);
    });

    it("다른 사람 일정에는 기록할 수 없고, 남의 요청 번호를 재사용할 수 없다", async () => {
      const r = await event(f2.c, { p_schedule_id: s1, p_kind: "업무 확인" });
      expect(msg(r.error)).toMatch(/\[권한\]/);
      const id = op();
      await event(f1.c, { p_op_id: id, p_schedule_id: s1, p_kind: "예상 종료 보고", p_expected_end: "11:20" });
      const reuse = await event(f2.c, { p_op_id: id, p_schedule_id: s3, p_kind: "업무 확인" });
      expect(msg(reuse.error)).toMatch(/다른 사용자의 요청 번호/);
    });

    it("지연 전송: 기기에서 누른 뒤 5분 늦게 도착하면 발생시각을 5분 앞당겨 기록하고 '지연 전송'으로 표시한다", async () => {
      const sent = new Date();
      const pressed = new Date(sent.getTime() - 300_000);
      const r = await event(f1.c, { p_schedule_id: s2, p_kind: "업무 확인", p_client_pressed_at: pressed.toISOString(), p_client_sent_at: sent.toISOString() });
      expect(r.data.entry_mode).toBe("지연 전송");
      const gap = Date.parse(r.data.recorded_at) - Date.parse(r.data.occurred_at);
      expect(gap).toBeGreaterThan(299_000);
      expect(gap).toBeLessThan(301_000);
    });

    it("기기 시계가 2시간 틀려도 발생시각은 서버 시각 기준으로 정해진다", async () => {
      const skew = 2 * 3600_000;
      const sent = new Date(Date.now() + skew);
      const pressed = new Date(sent.getTime() - 60_000);
      const r = await event(f2.c, { p_schedule_id: s3, p_kind: "업무 확인", p_client_pressed_at: pressed.toISOString(), p_client_sent_at: sent.toISOString() });
      expect(r.data.entry_mode).toBe("즉시 기록");
      expect(Math.abs(Date.parse(r.data.recorded_at) - Date.parse(r.data.occurred_at) - 60_000)).toBeLessThan(1000);
    });

    it("사후 입력: 사용자가 입력한 시각을 따로 남기고, 아직 오지 않은 시각은 거부한다", async () => {
      const future = await event(f2.c, { p_schedule_id: s3, p_kind: "작업개시", p_mode: "사후", p_entered_time: "23:59" });
      expect(msg(future.error)).toMatch(/아직 오지 않은 시각/);
      const r = await event(f2.c, { p_schedule_id: s3, p_kind: "작업개시", p_mode: "사후", p_entered_time: "00:01" });
      expect(r.error).toBeNull();
      expect(r.data.entry_mode).toBe("사후 입력");
      const { data } = await f2.c.from("work_events").select("entered_time, occurred_at, recorded_at").eq("id", r.data.event_id).single();
      expect(data!.entered_time).toBe("00:01:00");
      expect(new Date(data!.occurred_at).toISOString()).toBe(new Date(`${D}T00:01:00+09:00`).toISOString());
      expect(Date.parse(data!.recorded_at)).toBeGreaterThan(Date.parse(data!.occurred_at));
    });

    it("작업 시작 없이 종료할 수 없고, 예상 종료 보고에는 시각이 필요하다", async () => {
      const end = await event(f1.c, { p_schedule_id: s2, p_kind: "작업종료" });
      expect(msg(end.error)).toMatch(/작업 시작 기록이 먼저/);
      const rep = await event(f1.c, { p_schedule_id: s1, p_kind: "예상 종료 보고" });
      expect(msg(rep.error)).toMatch(/예상 종료 시각/);
      const ok = await event(f1.c, { p_schedule_id: s1, p_kind: "예상 종료 보고", p_expected_end: "11:30" });
      expect(ok.error).toBeNull();
    });

    it("정정: 본인 기록만 같은 종류로 정정할 수 있고, 정정된 기록은 다시 정정할 수 없다", async () => {
      const other = await event(f2.c, { p_schedule_id: s3, p_kind: "기록 무효", p_voids_event_id: start1 });
      expect(msg(other.error)).toMatch(/정정할 기록이 이 일정에 없습니다/);
      const fix = await event(f1.c, { p_schedule_id: s1, p_kind: "작업개시", p_mode: "사후", p_entered_time: "00:02", p_voids_event_id: start1 });
      expect(fix.error).toBeNull();
      const again = await event(f1.c, { p_schedule_id: s1, p_kind: "작업개시", p_mode: "사후", p_entered_time: "00:03", p_voids_event_id: start1 });
      expect(msg(again.error)).toMatch(/이미 정정·무효 처리된 기록/);
    });
  });

  describe("판단 기록 — 서버 전용 서명", () => {
    let job: JobRow;

    it("모든 일정 변경·작업 기록에는 판단 대기열이 1건씩 붙는다", async () => {
      const revs = (await admin.aal2.from("schedule_revisions").select("seq").eq("work_date", D)).data!.map((r) => r.seq);
      const evs = (await admin.aal2.from("work_events").select("seq").eq("work_date", D)).data!.map((r) => r.seq);
      const jobs = (await admin.aal2.from("judgment_jobs").select("seq").in("seq", [...revs, ...evs])).data!.map((r) => r.seq);
      expect(jobs.sort()).toEqual([...revs, ...evs].sort());
    });

    it("서명이 없거나 틀리면 판단 입력을 읽을 수 없다 (현장 직원·관리자 모두)", async () => {
      const { data } = await admin.aal2.from("judgment_jobs").select("*").eq("trigger_ref", s1).eq("trigger_kind", "일정 등록").single();
      job = data as JobRow;
      const ts = Math.floor(Date.now() / 1000);
      const r1 = await f1.c.rpc("judge_inputs", { p_job_id: job.id, p_ts: ts, p_sig: "00" });
      expect(msg(r1.error)).toMatch(/\[서명\]/);
      const r2 = await admin.aal2.rpc("judge_inputs", { p_job_id: job.id, p_ts: ts, p_sig: sign("inputs", job.id, ts, "", "wrong-secret-wrong-secret-wrong-secret") });
      expect(msg(r2.error)).toMatch(/\[서명\]/);
      const old = ts - 600;
      const r3 = await admin.aal2.rpc("judge_inputs", { p_job_id: job.id, p_ts: old, p_sig: sign("inputs", job.id, old, "") });
      expect(msg(r3.error)).toMatch(/5분/);
    });

    it("올바른 서명이면 실제 엔진으로 계산한 전후 결과가 기록되고, 같은 건을 다시 기록해도 한 건만 남는다", async () => {
      const ts = Math.floor(Date.now() / 1000);
      const inp = await f1.c.rpc("judge_inputs", { p_job_id: job.id, p_ts: ts, p_sig: sign("inputs", job.id, ts, "") });
      expect(inp.error).toBeNull();
      const d = inp.data as { job: JobRow; revisions: RevisionRow[]; events: EventRow[] };
      expect(new Set(d.revisions.map((r) => r.snapshot.data_kind))).toEqual(new Set(["실제 업무"]));
      expect(d.revisions.every((r) => r.seq <= job.seq) && d.events.every((e) => e.seq <= job.seq)).toBe(true);
      const payload = JSON.stringify(computeJudgment(d.job, d.revisions, d.events, { appVersion: "test", computedAt: new Date().toISOString() }));
      const t2 = Math.floor(Date.now() / 1000);
      const c1 = await f1.c.rpc("judge_complete", { p_job_id: job.id, p_ts: t2, p_payload: payload, p_sig: sign("complete", job.id, t2, sha256(payload)) });
      expect(c1.error).toBeNull();
      expect(c1.data.duplicated).toBe(false);
      const c2 = await f1.c.rpc("judge_complete", { p_job_id: job.id, p_ts: t2, p_payload: payload, p_sig: sign("complete", job.id, t2, sha256(payload)) });
      expect(c2.data.duplicated).toBe(true);
      const j = await admin.aal2.from("risk_judgments").select("seq, rule_version, payload_sha256, triggered_by").eq("job_id", job.id);
      expect(j.data!.length).toBe(1);
      expect(j.data![0]).toMatchObject({ seq: job.seq, rule_version: "chain-risk/1.1.0", payload_sha256: sha256(payload), triggered_by: admin.id });
      expect((await f1.c.from("risk_judgments").select("id")).data).toEqual([]);
    });

    it("내용을 바꾼 판단 결과는 서명이 맞지 않아 기록되지 않는다", async () => {
      const { data } = await admin.aal2.from("judgment_jobs").select("*").eq("trigger_ref", s2).eq("trigger_kind", "일정 등록").single();
      const ts = Math.floor(Date.now() / 1000);
      const good = JSON.stringify({ job_id: data!.id, seq: data!.seq });
      const r = await admin.aal2.rpc("judge_complete", { p_job_id: data!.id, p_ts: ts, p_payload: good.replace("}", ',"x":1}'), p_sig: sign("complete", data!.id, ts, sha256(good)) });
      expect(msg(r.error)).toMatch(/\[서명\]/);
    });
  });

  describe("기록 보호 · 데이터 구분", () => {
    it("DB 관리자 계정으로도 작업 기록·판단 이력·수정본은 고치거나 지울 수 없다", () => {
      for (const sql of ["update public.work_events set note = 'x';", "delete from public.risk_judgments;", "update public.schedule_revisions set change_kind = '수정';"]) {
        expect(() => psql(sql)).toThrow(/기록 보호/);
      }
    });

    it("검증 시나리오 일정은 실제 업무 판단 입력에 섞이지 않는다", async () => {
      const sc = await schedule(admin.aal2, { p_data_kind: "검증 시나리오", p_assignee_id: f1.id, p_site_name: "가상 현장", p_planned_start: "14:00", p_planned_end: "15:00" });
      expect(sc.error).toBeNull();
      const { data } = await admin.aal2.from("judgment_jobs").select("*").eq("data_kind", "실제 업무").eq("work_date", D).order("seq", { ascending: false }).limit(1).single();
      const ts = Math.floor(Date.now() / 1000);
      const inp = await admin.aal2.rpc("judge_inputs", { p_job_id: data!.id, p_ts: ts, p_sig: sign("inputs", data!.id, ts, "") });
      const ids = (inp.data.revisions as RevisionRow[]).map((r) => r.schedule_id);
      expect(ids).not.toContain(sc.data.schedule_id);
    });
  });
});
