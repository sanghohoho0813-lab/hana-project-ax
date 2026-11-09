// 실증 화면 E2E 공용 — 로컬 Supabase(`npx -y supabase@2.122.0 start`) + `next start -p 3197` 에서만 돈다.
// 시험 계정 생성에만 로컬 Supabase 의 관리자 키를 쓴다 (앱 코드는 이 키를 쓰지 않는다).
// 실행: npm run test:pilot:e2e   (Playwright 는 저장소 의존성에 넣지 않았다 — 전역 설치본을 찾아 쓴다)
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const APP = process.env.PILOT_E2E_APP ?? "http://localhost:3197";
const st = (() => {
  const o = execSync("npx -y supabase@2.122.0 status -o json", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(o.slice(o.indexOf("{")));
})();
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(st.API_URL)) throw new Error("로컬 Supabase 에서만 실행합니다");
export const API = st.API_URL, PUB = st.PUBLISHABLE_KEY, SECRET = st.SECRET_KEY;
export const PASSWORD = "Pilot-Test-2026a";
export const adminApi = createClient(API, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
export const userClient = async (email, pw = PASSWORD) => {
  const c = createClient(API, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  return c;
};
export const psql = (sql) =>
  execSync("psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -X -At -v ON_ERROR_STOP=1", {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: "postgres" },
  }).trim();
export const uniq = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@pilot.test`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** RFC 6238 TOTP (30초 · 6자리) — 시험에서 인증 앱 대신 쓴다 */
export function totp(secret, at = Date.now()) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) bits += A.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", key).update(c).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}

/** 로컬 메일 수신함(Mailpit)에서 초대·재설정 링크를 꺼낸다 */
export async function mailLink(to, type) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent("to:" + to)}`).then((x) => x.json());
    const m = r.messages?.[0];
    if (m) {
      const full = await fetch(`http://127.0.0.1:54324/api/v1/message/${m.ID}`).then((x) => x.json());
      const href = (full.HTML.match(/href="([^"]+)"/) || [])[1]?.replace(/&amp;/g, "&");
      if (href && href.includes(`type=${type}`)) return { href, subject: m.Subject };
    }
    await sleep(500);
  }
  throw new Error("메일 없음 " + to);
}

export async function newBrowser() {
  const require = createRequire(import.meta.url);
  let pw;
  try {
    pw = require("playwright");
  } catch {
    pw = require(execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright");
  }
  const exe = process.env.PILOT_E2E_CHROMIUM ?? "/opt/pw-browsers/chromium";
  return pw.chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
}
export async function page(bro, viewport = { width: 1280, height: 900 }) {
  const ctx = await bro.newContext({ viewport });
  await ctx.route(/jsdelivr/, (r) => r.abort()); // 외부 글꼴은 막는다 (시험 결과와 무관)
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  return p;
}
export const check = (ok, label, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!ok) process.exitCode = 1;
};
/** 서버 함수 뒤 화면 전환은 소프트 내비게이션이라 load 이벤트가 없다 — 주소를 직접 기다린다 */
export async function waitPath(p, suffix, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (new URL(p.url()).pathname.endsWith(suffix)) {
      await p.waitForLoadState("domcontentloaded").catch(() => {});
      await p.waitForTimeout(300);
      return;
    }
    await p.waitForTimeout(150);
  }
  throw new Error(`주소 ${suffix} 대기 시간 초과 (현재 ${p.url()})`);
}
/** 화면 사진은 PILOT_E2E_OUT 이 있을 때만 남긴다 */
export async function shot(p, name) {
  if (process.env.PILOT_E2E_OUT) await p.screenshot({ path: `${process.env.PILOT_E2E_OUT}/${name}.png` });
}
