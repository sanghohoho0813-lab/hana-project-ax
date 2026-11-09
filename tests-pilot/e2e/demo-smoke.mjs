// 기존 데모 화면 회귀 확인 — 모든 경로 200 · 화면 오류 없음 · 기술검증 시뮬레이션 값 그대로 (`next start -p 3197` 필요)
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const B = process.env.PILOT_E2E_APP ?? "http://localhost:3197";
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright");
}
const exe = process.env.PILOT_E2E_CHROMIUM ?? "/opt/pw-browsers/chromium";
const bro = await pw.chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const ctx = await bro.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("hana-ax-guide-dismissed", "1");
    sessionStorage.setItem("hana-ax-guide-seen", "1");
  } catch {}
});
await ctx.route(/pretendard|jsdelivr/, (r) => r.abort());
const p = await ctx.newPage();
let bad = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!ok) bad++;
};
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));

// 실증 메뉴 + 기존 메뉴(기타 · 기존 기능) 전체
const routes = [
  "/", "/field", "/compare", "/records", "/records/report",
  "/today", "/brief", "/tasks", "/schedule", "/reports", "/comms", "/projects", "/logs", "/change-orders", "/closeout", "/profit", "/inquiries",
  "/customers", "/insight", "/documents", "/procurement", "/performance", "/approvals", "/videos/inspection", "/videos/guide", "/demo", "/demo/verify",
  "/store", "/store/process", "/store/request", "/store/services",
];
for (const r of routes) {
  errs.length = 0;
  const res = await p.goto(B + r, { waitUntil: "networkidle" });
  check(res.status() === 200 && errs.length === 0, `${r}`, errs.join(" | "));
}

// 기존 통합일정 위험 판단 패널
await p.goto(B + "/schedule", { waitUntil: "networkidle" });
const panel = (await p.locator('[data-tour="chainrisk"] h3').first().innerText()).replace(/\s+/g, " ");
check(panel.includes("위험 판단과 대응 우선순위") && panel.includes("위험 1건 · 연결 3건 확인"), "통합일정 위험 판단 패널 그대로", panel);

// 기술검증 시뮬레이션 단계별 우선순위 (이전과 같은 값)
await p.goto(B + "/demo/verify", { waitUntil: "networkidle" });
const steps = p.locator('ol[aria-label="검증 단계"] button');
const expect = {
  2: "우선순위: 1. B현장 작업지연 위험(75점) · 2. E현장 이동시간 부족(25점)",
  8: "우선순위: 1. C현장 일정 중복(85점) · 2. E현장 이동시간 부족(25점)",
  9: "우선순위: 1. E현장 이동시간 부족(25점)",
};
for (const [n, want] of Object.entries(expect)) {
  await steps.nth(Number(n) - 1).click();
  await p.waitForTimeout(250);
  const t = await p.locator('ol[aria-label="검증 단계"]').locator("xpath=ancestor::section[1]").innerText();
  const got = [...t.matchAll(/우선순위: [^\n]*/g)].map((m) => m[0]);
  check(got.at(-1) === want, `기술검증 STEP ${n} 판단 후 우선순위`, got.at(-1));
}

// 기존 메뉴는 '기타 · 기존 기능' 안에 접혀 있고, 펼치면 모두 보인다
await p.goto(B + "/", { waitUntil: "networkidle" });
const aside = p.locator("aside");
check((await aside.locator('a[href="/schedule"]').count()) === 0, "실증 화면에서는 기존 메뉴가 접혀 있음");
await aside.locator('button:has-text("기타 · 기존 기능")').click();
check((await aside.locator('a[href="/schedule"]').count()) === 1 && (await aside.locator('a[href="/today"]').count()) === 1, "'기타 · 기존 기능'을 펼치면 기존 메뉴 접근 가능");

await bro.close();
console.log(bad ? `실패 ${bad}건` : "모두 통과");
process.exitCode = bad ? 1 : 0;
