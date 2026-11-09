/**
 * 쓰기 순서 보장 · 계정 이메일 · 계정 변경 이력 (supabase/migrations/20261109010000_pilot_writes_accounts.sql)
 *   npx supabase@2.122.0 db reset && npm run test:pilot:db
 */
import { spawn } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TEST, createUser, kstToday, makeAdmin, makeField, op, psql, signIn } from "./helpers/local";

const D = kstToday();
type Admin = Awaited<ReturnType<typeof makeAdmin>>;
type Field = Awaited<ReturnType<typeof makeField>>;

const save = (c: SupabaseClient, p: Record<string, unknown>) =>
  c.rpc("save_schedule", {
    p_op_id: op(),
    p_schedule_id: null,
    p_expected_version: null,
    p_data_kind: "검증 시나리오",
    p_work_date: D,
    p_region: "",
    p_travel_minutes: null,
    p_priority: "보통",
    p_note: null,
    ...p,
  });

const event = (c: SupabaseClient, p: Record<string, unknown>) => {
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
};

describe.skipIf(!DB_TEST)("쓰기 순서 보장 · 계정 이력", () => {
  let admin: Admin;
  let f1: Field;

  beforeAll(async () => {
    admin = await makeAdmin();
    f1 = await makeField(admin.aal2, "동시성 직원");
  });

  it("같은 요청 번호로 10번 동시에 보내도 기록은 1건이고, 모두 같은 결과를 받는다 (오류 없음)", async () => {
    const s = await save(admin.aal2, { p_assignee_id: f1.id, p_site_name: "동시 현장", p_planned_start: "09:00", p_planned_end: "10:00" });
    expect(s.error).toBeNull();
    const id = op();
    const rs = await Promise.all(Array.from({ length: 10 }, () => event(f1.c, { p_op_id: id, p_schedule_id: s.data.schedule_id, p_kind: "업무 확인" })));
    expect(rs.map((r) => r.error)).toEqual(Array(10).fill(null));
    expect(new Set(rs.map((r) => r.data.event_id)).size).toBe(1);
    expect(rs.filter((r) => r.data.duplicated === false)).toHaveLength(1);
    expect(psql(`select count(*) from work_events where op_id = '${id}';`)).toBe("1");
    expect(psql(`select count(*) from judgment_jobs j join work_events e on e.seq = j.seq where e.op_id = '${id}';`)).toBe("1");
  });

  it("같은 일정 저장 요청도 동시에 여러 번 와서 일정이 두 개 생기지 않는다", async () => {
    const id = op();
    const rs = await Promise.all(
      Array.from({ length: 6 }, () => save(admin.aal2, { p_op_id: id, p_assignee_id: f1.id, p_site_name: "동시 등록", p_planned_start: "11:00", p_planned_end: "12:00" })),
    );
    expect(rs.map((r) => r.error)).toEqual(Array(6).fill(null));
    expect(new Set(rs.map((r) => r.data.schedule_id)).size).toBe(1);
    expect(psql(`select count(*) from schedules where site_name = '동시 등록' and work_date = '${D}';`)).toBe("1");
  });

  it("기록 함수는 한 번에 하나씩 처리된다 — 다른 트랜잭션이 잠금을 쥐고 있으면 끝날 때까지 기다린다", async () => {
    const holder = spawn("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-X", "-At", "-c",
      "begin; select pg_advisory_xact_lock(7240311001); select pg_sleep(2); commit;"], { env: { ...process.env, PGPASSWORD: "postgres" } });
    const exited = new Promise((r) => holder.on("exit", r));
    await new Promise((r) => setTimeout(r, 500));
    const t = Date.now();
    const r = await save(admin.aal2, { p_assignee_id: f1.id, p_site_name: "잠금 대기", p_planned_start: "13:00", p_planned_end: "14:00" });
    const waited = Date.now() - t;
    await exited;
    expect(r.error).toBeNull();
    expect(waited).toBeGreaterThan(1000);
  });

  it("동시에 들어온 서로 다른 기록도 번호 순서대로 반영되고 각각 판단 대기열 1건을 가진다", async () => {
    const s = await save(admin.aal2, { p_assignee_id: f1.id, p_site_name: "순서 현장", p_planned_start: "15:00", p_planned_end: "16:00", p_data_kind: "검증 시나리오" });
    const before = Number(psql("select last_value from pilot_change_seq;"));
    const rs = await Promise.all([
      event(f1.c, { p_schedule_id: s.data.schedule_id, p_kind: "업무 확인" }),
      event(f1.c, { p_schedule_id: s.data.schedule_id, p_kind: "예상 종료 보고", p_expected_end: "16:30" }),
      event(admin.aal2, { p_schedule_id: s.data.schedule_id, p_kind: "예상 종료 보고", p_expected_end: "16:40" }),
    ]);
    expect(rs.map((r) => r.error)).toEqual([null, null, null]);
    const seqs = rs.map((r) => Number(r.data.seq)).sort((a, b) => a - b);
    expect(seqs[0]).toBeGreaterThan(before);
    // 기록시각(recorded_at)은 번호 순서와 같은 순서다 — 늦게 받은 번호가 먼저 반영되는 일이 없다
    const rows = psql(`select seq || '|' || recorded_at from work_events where schedule_id = '${s.data.schedule_id}' order by seq;`).split("\n");
    const times = rows.map((x) => x.split("|")[1]);
    expect([...times].sort()).toEqual(times);
    expect(psql(`select count(*) from judgment_jobs where seq in (${seqs.join(",")});`)).toBe("3");
  });

  it("프로필에 로그인 이메일이 함께 남아 관리자가 사람을 구분할 수 있다 (현장 직원은 본인 것만)", async () => {
    const u = await createUser("mail");
    const { data } = await admin.aal2.from("profiles").select("email").eq("id", u.id).single();
    expect(data?.email).toBe(u.email);
    const own = await f1.c.from("profiles").select("id, email");
    expect(own.data).toEqual([{ id: f1.id, email: f1.email }]);
  });

  it("계정 이름·역할·활성 변경은 누가 바꿨는지와 함께 이력으로 남고, 고치거나 지울 수 없다", async () => {
    const u = await createUser("hist");
    await admin.aal2.rpc("admin_set_profile", { p_user_id: u.id, p_display_name: "이력 직원", p_role: "field", p_active: true });
    await admin.aal2.rpc("admin_set_profile", { p_user_id: u.id, p_display_name: "이력 직원", p_role: "field", p_active: false });
    const { data } = await admin.aal2.from("profile_changes").select("changed_by, display_name, role, active, via").eq("profile_id", u.id).order("seq");
    expect(data).toEqual([
      { changed_by: admin.id, display_name: "이력 직원", role: "field", active: true, via: "관리자 화면" },
      { changed_by: admin.id, display_name: "이력 직원", role: "field", active: false, via: "관리자 화면" },
    ]);
    const boot = await admin.aal2.from("profile_changes").select("via, changed_by").eq("profile_id", admin.id);
    expect(boot.data).toEqual([{ via: "최초 관리자 지정", changed_by: null }]);
    expect(() => psql(`update profile_changes set active = true where profile_id = '${u.id}';`)).toThrow(/기록 보호/);
    expect(() => psql(`delete from profile_changes where profile_id = '${u.id}';`)).toThrow(/기록 보호/);
  });

  it("현장 직원·2단계 인증 전 관리자는 계정 이력을 볼 수 없다", async () => {
    const f = await f1.c.from("profile_changes").select("seq");
    expect(f.data).toEqual([]);
    const a1 = await admin.aal1.from("profile_changes").select("seq");
    expect(a1.data).toEqual([]);
  });

  it("옮긴 내부 함수(본문)는 로그인 사용자가 직접 부를 수 없다", async () => {
    const c = await signIn(f1.email);
    const r = await c.schema("pilot_private" as "public").rpc("record_work_event_body", {});
    expect(r.error).not.toBeNull();
    expect(psql("select count(*) from information_schema.role_routine_grants where routine_schema = 'pilot_private' and grantee in ('authenticated','anon','PUBLIC');")).toBe("0");
  });
});
