// 운영 Supabase 적용용 SQL 묶음을 만든다 — supabase/migrations/*.sql 을 이름 순서대로 하나의 트랜잭션으로 묶는다.
//  - 대시보드 SQL Editor 에 한 번 붙여 넣어 실행하면 전부 적용되거나, 하나라도 실패하면 아무것도 적용되지 않는다.
//  - 개발용 seed.sql(로컬 서명키)은 넣지 않는다.
//  - 실행: node scripts/build-production-sql.mjs   (결과: supabase/production/01_apply_all_migrations.sql)
//  - tests-pilot/production-sql.test.ts 가 이 파일이 마이그레이션과 같은지 확인한다 (낡은 묶음 방지).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function buildProductionSql(root = ROOT) {
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort();
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const parts = [
    "-- ════════════════════════════════════════════════════════════════════════",
    `-- 하나 프로젝트 AX ${pkg.version} — 운영 Supabase 최초 적용용 (자동 생성 · 직접 고치지 마세요)`,
    "-- 사용: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여 넣고 Run (한 번만).",
    "-- 전체가 하나의 트랜잭션입니다: 중간에 오류가 나면 아무것도 적용되지 않습니다. 오류 문구를 그대로 알려 주세요.",
    "-- 개발용 seed.sql 은 들어 있지 않습니다. 판단 서명키는 02_set_judge_secret.sql 로 따로 만듭니다.",
    `-- 포함 마이그레이션 ${files.length}개: ${files.join(", ")}`,
    "-- ════════════════════════════════════════════════════════════════════════",
    "",
    "begin;",
    "",
  ];
  for (const f of files) {
    parts.push(`-- ┌── ${f} ──────────────────────────────────────────`, readFileSync(join(dir, f), "utf8").trimEnd(), `-- └── ${f} 끝`, "");
  }
  parts.push(
    "-- 적용 표시 — 04_verify_setup.sql 이 어떤 묶음이 적용됐는지 보여 준다",
    `insert into pilot_private.settings (key, value) values ('schema_bundle', '${pkg.version} · 마이그레이션 ${files.length}개 · 마지막 ${files[files.length - 1]}')`,
    "on conflict (key) do update set value = excluded.value;",
    "",
    "commit;",
    "",
  );
  return { files, sql: parts.join("\n") };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, sql } = buildProductionSql();
  const out = join(ROOT, "supabase", "production", "01_apply_all_migrations.sql");
  if (process.argv.includes("--check")) {
    // 시험용: 저장된 묶음이 지금 마이그레이션으로 만든 것과 같은지만 본다 (파일을 쓰지 않음)
    let saved = "";
    try {
      saved = readFileSync(out, "utf8");
    } catch {
      // 없으면 다르다고 본다
    }
    if (saved !== sql) {
      console.error("supabase/production/01_apply_all_migrations.sql 이 마이그레이션과 다릅니다 — node scripts/build-production-sql.mjs 로 다시 만드세요.");
      process.exit(1);
    }
    console.log(`묶음 최신 — 마이그레이션 ${files.length}개`);
    process.exit(0);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, sql);
  console.log(`${out} — 마이그레이션 ${files.length}개 · ${Buffer.byteLength(sql)}바이트`);
}
