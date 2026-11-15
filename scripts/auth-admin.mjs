#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// 계정 복구 관리 스크립트 — DB 소유자의 PC에서만 실행 (Supabase 공식 Auth Admin API)
//
//  - 앱 · Vercel · 브라우저에는 넣지 않는다. 앱은 이 스크립트를 쓰지 않고, 서비스 키도 쓰지 않는다.
//  - 서비스 키(Supabase → Project Settings → API Keys → Secret key)는 실행할 때 입력하고 어디에도 저장하지 않는다.
//    채팅 · 메일 · 문서 · GitHub 에 붙여 넣지 않는다. 쓴 뒤 터미널 창을 닫는다.
//  - auth 스키마 표를 SQL 로 직접 고치지 않는다. 공식 함수만 쓴다:
//      auth.admin.updateUserById(id, { password })  — 임시 비밀번호 설정
//      auth.admin.mfa.listFactors / deleteFactor     — 2단계 인증 요소 확인 · 삭제 (삭제하면 그 사용자의 로그인이 모두 끊김)
//
// 사용 (저장소 폴더에서, 처음 한 번 npm install):
//   node scripts/auth-admin.mjs reset-password 이메일   임시 비밀번호를 새로 만들어 화면에 한 번 보여 준다
//   node scripts/auth-admin.mjs list-mfa 이메일         등록된 2단계 인증 요소만 본다 (바꾸지 않음)
//   node scripts/auth-admin.mjs remove-mfa 이메일       2단계 인증 요소를 지운다 → 다음 로그인 때 다시 등록
//   --yes  확인 질문 없이 실행 (자동 시험용)
// 프로젝트 주소 · 키: 환경변수 SUPABASE_URL · SUPABASE_SECRET_KEY 가 없으면 물어본다 (키는 화면에 표시하지 않음).
// ════════════════════════════════════════════════════════════════════════
import { randomInt } from "node:crypto";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const [cmd, email, ...flags] = process.argv.slice(2);
const YES = flags.includes("--yes");
const COMMANDS = ["reset-password", "list-mfa", "remove-mfa"];

function fail(msg) {
  console.error(`오류: ${msg}`);
  process.exit(1);
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
    if (hidden && process.stdin.isTTY) {
      // 입력한 키를 화면에 그리지 않는다
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(question);
      };
    }
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a.trim());
    });
  });
}

/** 임시 비밀번호 — 16자 · 소문자 · 대문자 · 숫자 포함 (프로젝트 비밀번호 규칙: 10자 이상 · 대소문자·숫자) */
function tempPassword() {
  const sets = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 16) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function findUser(admin, mail) {
  const want = mail.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`사용자 목록을 읽지 못했습니다 — ${error.message} (주소·키를 확인하세요)`);
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === want);
    if (u) return u;
    if (data.users.length < 1000) break;
  }
  fail(`${mail} 계정이 없습니다.`);
}

async function main() {
  if (!COMMANDS.includes(cmd) || !email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
    console.log("사용: node scripts/auth-admin.mjs <reset-password | list-mfa | remove-mfa> 이메일 [--yes]");
    process.exit(cmd ? 1 : 0);
  }
  const url = process.env.SUPABASE_URL || (await ask("Supabase 프로젝트 주소 (https://….supabase.co): "));
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(url)) fail("프로젝트 주소 형식이 아닙니다.");
  const key = process.env.SUPABASE_SECRET_KEY || (await ask("Secret key (화면에 표시되지 않음): ", true));
  if (!key || key.startsWith("sb_publishable_")) fail("Secret key가 필요합니다 (Publishable key가 아님).");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = await findUser(admin, email);
  const label = `${user.email} (${user.id.slice(0, 8)}…)`;

  if (cmd === "list-mfa" || cmd === "remove-mfa") {
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    if (error) fail(`2단계 인증 요소를 읽지 못했습니다 — ${error.message}`);
    const factors = data?.factors ?? [];
    console.log(`${label}: 2단계 인증 요소 ${factors.length}개${factors.length ? " — " + factors.map((f) => `${f.factor_type}/${f.status}`).join(", ") : ""}`);
    if (cmd === "list-mfa" || factors.length === 0) return;
    if (!YES && (await ask(`정말 ${factors.length}개를 지울까요? 이 사용자의 로그인이 모두 끊깁니다. (yes 입력): `)) !== "yes") fail("취소했습니다.");
    for (const f of factors) {
      const r = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
      if (r.error) fail(`삭제하지 못했습니다 — ${r.error.message}`);
    }
    console.log(`삭제 완료 — ${label} 은(는) 다음 로그인 때 2단계 인증을 다시 등록합니다. (실행 일시를 운영 기록에 남기세요)`);
    return;
  }

  // reset-password
  if (!YES && (await ask(`${label} 의 비밀번호를 새 임시 비밀번호로 바꿀까요? (yes 입력): `)) !== "yes") fail("취소했습니다.");
  const pw = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: pw });
  if (error) fail(`비밀번호를 바꾸지 못했습니다 — ${error.message}`);
  console.log("임시 비밀번호 (한 번만 표시 · 본인에게 직접 전달 · 첫 로그인 뒤 '계정 → 비밀번호 바꾸기'):");
  console.log(`TEMP_PASSWORD=${pw}`);
  console.log("전달한 뒤 이 터미널 창을 닫으세요. 실행 일시를 운영 기록에 남기세요.");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
