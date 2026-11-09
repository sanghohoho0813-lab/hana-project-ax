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
  if (process.env.PILOT_E2E_OUT) await p.screenshot({ path: `${process.env.PILOT_E2E_OUT}/${name}.png`, fullPage: true });
}

/** 다음 30초 구간까지 기다린다 — 같은 인증 코드를 두 번 쓰지 않게 */
export async function nextTotpWindow() {
  const ms = 30000 - (Date.now() % 30000) + 1000;
  await sleep(ms);
}

/** 관리자 발급 → 최초 관리자 지정 → 화면 로그인 → 2단계 인증 등록까지 */
export async function adminLogin(bro, name = "김관리") {
  const email = uniq("admin");
  await adminApi.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  psql(`select pilot_private.bootstrap_admin('${email}', '${name}');`);
  const p = await page(bro);
  await p.goto(APP + "/pilot/login");
  await p.fill("input[name=email]", email);
  await p.fill("input[name=password]", PASSWORD);
  await p.click('button:has-text("로그인")');
  await waitPath(p, "/pilot/account/mfa");
  await p.click('button:has-text("2단계 인증 등록 시작")');
  await p.waitForSelector('img[alt="2단계 인증 등록 QR 코드"]');
  const secret = (await p.locator("text=설정 키:").innerText()).replace("설정 키:", "").trim();
  await p.fill("input[name=code]", totp(secret));
  await p.click('button:has-text("확인")');
  await waitPath(p, "/pilot/admin");
  return { p, email, secret };
}

/** 관리자 API 세션(aal2) — 화면을 거치지 않는 요청을 흉내 낼 때 */
export async function adminApiSession(email, secret) {
  const c = await userClient(email);
  const { data } = await c.auth.mfa.listFactors();
  await nextTotpWindow();
  const { error } = await c.auth.mfa.challengeAndVerify({ factorId: data.totp[0].id, code: totp(secret) });
  if (error) throw error;
  return c;
}

/** 한국 날짜 + n일 */
export const kstDate = (n = 0) => new Date(Date.now() + 9 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);

/** 휴대폰 화면 (390×844 · 터치) */
export async function mobilePage(bro) {
  const ctx = await bro.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(/jsdelivr/, (r) => r.abort());
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  return p;
}

/** 한국 시각 HH:MM (지금 + n분) */
export const kstHHMM = (plusMin = 0) => new Date(Date.now() + 9 * 3600_000 + plusMin * 60_000).toISOString().slice(11, 16);
export const kstHour = () => new Date(Date.now() + 9 * 3600_000).getUTCHours();

/** 관리자 일정판에서 일정 등록 (화면 그대로) */
export async function createSchedule(p, { who, site, start, end, travel = "", prio = "보통" }) {
  const form = () => p.locator('form:has(button:has-text("일정 등록"))').first();
  if ((await form().count()) === 0) await p.click('button:has-text("일정 등록")');
  const f = form();
  await f.locator("select[name=assignee_id]").selectOption({ label: who });
  await f.locator("input[name=site_name]").fill(site);
  await f.locator("input[name=planned_start]").fill(start);
  await f.locator("input[name=planned_end]").fill(end);
  await f.locator("input[name=travel_minutes]").fill(travel);
  await f.locator("select[name=priority]").selectOption(prio);
  await f.locator('button:has-text("일정 등록")').click();
  const msg = f.locator("[role=status], [role=alert]");
  await msg.waitFor();
  const t = (await msg.innerText()).replace(/\s+/g, " ");
  if (!t.includes("일정을 등록했습니다")) throw new Error(`일정 등록 실패: ${t}`);
  await p.locator(`tr:has-text("${site}")`).first().waitFor();
  return t;
}

/** 관리자 계정 화면에서 활성화 */
export async function activate(p, email, name) {
  await p.goto(APP + "/pilot/admin/staff");
  const row = p.locator(`form:has-text("${email}")`);
  await row.locator("input[name=display_name]").fill(name);
  await row.locator("input[name=active]").check();
  await row.locator('button:has-text("저장")').click();
  await row.locator("text=계정을 바꿨습니다.").waitFor();
}

export async function loginAs(p, email, password = PASSWORD) {
  await p.goto(APP + "/pilot/login");
  await p.fill("input[name=email]", email);
  await p.fill("input[name=password]", password);
  await p.click('button:has-text("로그인")');
}
