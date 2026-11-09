/**
 * 통합 시험 도우미 — 로컬 Supabase(npx supabase@2.122.0 start)에서만 쓴다.
 * 로컬 관리자 키는 시험 계정을 만드는 데만 쓰며, 앱 코드는 이 키를 쓰지 않는다.
 */
import { execSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DB_TEST = process.env.PILOT_DB_TEST === "1";
/** supabase/seed.sql 의 로컬 개발 전용 값 */
export const LOCAL_JUDGE_SECRET = "local-dev-only-judge-secret-0123456789abcdef";
export const PASSWORD = "Pilot-Test-2026a";

let status: { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string } | null = null;
export function local() {
  if (!status) {
    const out = execSync("npx -y supabase@2.122.0 status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    status = JSON.parse(out.slice(out.indexOf("{")));
  }
  return status!;
}

export function psql(sql: string): string {
  return execSync(`psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -X -At -v ON_ERROR_STOP=1`, {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: "postgres" },
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export function anonClient(): SupabaseClient {
  return createClient(local().API_URL, local().PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createUser(prefix: string): Promise<{ id: string; email: string }> {
  const admin = createClient(local().API_URL, local().SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@pilot.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return { id: data.user!.id, email };
}

export async function signIn(email: string, password = PASSWORD): Promise<SupabaseClient> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

/** RFC 6238 TOTP (30초 · 6자리 · SHA-1) */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

/** 관리자: 계정 생성 → 최초 관리자 지정(DB 소유자) → 비밀번호 로그인(aal1) → TOTP 등록·확인(aal2) */
export async function makeAdmin(): Promise<{ id: string; email: string; aal1: SupabaseClient; aal2: SupabaseClient; totpSecret: string }> {
  const u = await createUser("admin");
  psql(`select pilot_private.bootstrap_admin('${u.email}', '시험 관리자');`);
  const aal1 = await signIn(u.email);
  const aal2 = await signIn(u.email);
  const { data: f, error } = await aal2.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw error;
  const { error: e2 } = await aal2.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(f.totp.secret) });
  if (e2) throw e2;
  return { ...u, aal1, aal2, totpSecret: f.totp.secret };
}

export async function makeField(admin: SupabaseClient, name: string): Promise<{ id: string; email: string; c: SupabaseClient }> {
  const u = await createUser("field");
  const { error } = await admin.rpc("admin_set_profile", { p_user_id: u.id, p_display_name: name, p_role: "field", p_active: true });
  if (error) throw error;
  return { ...u, c: await signIn(u.email) };
}

export const sha256 = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
export function sign(purpose: string, jobId: string, ts: number, hash: string, secret = LOCAL_JUDGE_SECRET) {
  return createHmac("sha256", secret).update(`${purpose}|${jobId}|${ts}|${hash}`).digest("hex");
}
export const op = () => randomUUID();

/** 한국 날짜 (YYYY-MM-DD) */
export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
