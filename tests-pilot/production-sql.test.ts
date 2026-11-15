/**
 * 운영 Supabase 적용용 SQL (supabase/production) — 대시보드 SQL Editor 에 붙여 넣는 묶음이 낡거나 개발용 값을 담지 않았는지
 * (실제 적용 모의시험은 seed 없는 별도 로컬 Supabase 에서 했다: docs/FIELD_SYSTEM_OPERATIONS_READINESS.md)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = "supabase/production";
const read = (f: string) => readFileSync(`${dir}/${f}`, "utf8");

describe("운영 적용용 SQL 묶음", () => {
  it("01 묶음은 지금 마이그레이션 전부를 이름 순서대로 담고 있다 (낡은 묶음 방지)", () => {
    expect(execFileSync("node", ["scripts/build-production-sql.mjs", "--check"], { encoding: "utf8" })).toMatch(/묶음 최신/);
    const sql = read("01_apply_all_migrations.sql");
    const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    const at = migrations.map((f) => sql.indexOf(`-- ┌── ${f}`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(sql.trimStart().startsWith("--")).toBe(true);
    expect(sql).toMatch(/\nbegin;\n/);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("개발용 seed(로컬 서명키)는 어느 운영 파일에도 없다 · 서명키는 무작위로 만든다", () => {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
      expect(read(f)).not.toContain("local-dev-only-judge-secret-0123456789abcdef");
    }
    expect(read("02_set_judge_secret.sql")).toContain("gen_random_bytes(32)");
    // 점검 SQL 은 읽기만 한다 — 바꾸는 문장으로 시작하는 줄이 없다
    expect(read("04_verify_setup.sql")).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|grant|revoke|truncate)\b/im);
  });
});
