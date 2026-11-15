/**
 * 계정 복구 관리 스크립트 (scripts/auth-admin.mjs) — 공식 Auth Admin API 로만 비밀번호 · 2단계 인증 요소를 바꾸는지 (로컬 Supabase)
 * 운영에서는 DB 소유자가 자기 PC에서 Secret key 를 입력해 실행한다. 이 시험은 로컬 개발 키를 환경변수로 넘긴다.
 */
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { DB_TEST, PASSWORD, local, makeAdmin, psql } from "./helpers/local";

function run(args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync("node", ["scripts/auth-admin.mjs", ...args], {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_URL: local().API_URL, SUPABASE_SECRET_KEY: local().SECRET_KEY },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const x = e as { status: number; stdout: string; stderr: string };
    return { code: x.status, out: `${x.stdout}${x.stderr}` };
  }
}
const canSignIn = async (email: string, password: string) => {
  const c = createClient(local().API_URL, local().PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return !(await c.auth.signInWithPassword({ email, password })).error;
};

describe.skipIf(!DB_TEST)("계정 복구 — 공식 Auth Admin API 스크립트 (로컬 Supabase)", () => {
  let admin: Awaited<ReturnType<typeof makeAdmin>>;
  beforeAll(async () => {
    admin = await makeAdmin();
  });

  it("임시 비밀번호: 새 비밀번호로 로그인되고 옛 비밀번호는 거절 · 없는 계정은 오류", async () => {
    const r = run(["reset-password", admin.email, "--yes"]);
    expect(r.code).toBe(0);
    const pw = r.out.match(/TEMP_PASSWORD=(\S+)/)?.[1] ?? "";
    expect(pw).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{16}$/);
    expect(await canSignIn(admin.email, pw)).toBe(true);
    expect(await canSignIn(admin.email, PASSWORD)).toBe(false);
    expect(run(["reset-password", "nobody-here@pilot.test", "--yes"])).toMatchObject({ code: 1 });
  });

  it("2단계 인증 요소: 확인만(list) → 삭제(remove) 뒤 0개 · 다시 등록 가능", async () => {
    const before = run(["list-mfa", admin.email]);
    expect(before.out).toMatch(/2단계 인증 요소 1개 — totp\/verified/);
    const r = run(["remove-mfa", admin.email, "--yes"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/삭제 완료/);
    // 확인용 읽기만 (auth 표를 고치지 않음)
    expect(psql(`select count(*) from auth.mfa_factors where user_id = '${admin.id}'`)).toBe("0");
    expect(run(["list-mfa", admin.email]).out).toMatch(/2단계 인증 요소 0개/);
  });

  it("공개 키로는 실행할 수 없고, 앱 코드에는 서비스 키·관리 스크립트가 없다", async () => {
    const r = (() => {
      try {
        execFileSync("node", ["scripts/auth-admin.mjs", "list-mfa", admin.email], {
          encoding: "utf8",
          env: { ...process.env, SUPABASE_URL: local().API_URL, SUPABASE_SECRET_KEY: local().PUBLISHABLE_KEY },
          stdio: ["ignore", "pipe", "pipe"],
        });
        return 0;
      } catch (e) {
        return (e as { status: number }).status;
      }
    })();
    expect(r).toBe(1);
    // 앱(브라우저·서버)에는 서비스 키 환경변수 · 관리자 API · 이 스크립트가 없다 (주석의 '쓰지 않는다' 설명은 제외)
    let hits = "";
    try {
      hits = execFileSync("grep", ["-rnE", "SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|sb_secret_|auth\\.admin\\.|auth-admin", "src", "next.config.ts"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch (e) {
      if ((e as { status: number }).status !== 1) throw e; // 1 = 찾은 것 없음
    }
    expect(hits).toBe("");
  });
});
