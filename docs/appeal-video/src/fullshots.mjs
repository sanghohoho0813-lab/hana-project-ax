// 영상용: 실제 화면 전체 길이 캡처 (2배 해상도) — 스크롤 장면에 쓴다
import { join } from "node:path";
import { writeFileSync } from "node:fs";
const POS = {};
const KEYS = { f_judg: ["판단 정보", "판단 전 → 판단 후", "바뀐 연결의 판단 근거", "계산 과정", "대응 우선순위 (판단 후", "계기 현장의 작업상태 편차", "판단 입력"], f_case: ["후속 현장 위험", "사건 증빙", "핵심 흐름 요약", "관리자 조치"], f_records: ["작업 기록", "위험 판단 이력", "일정 변경 이력"], f_safety: ["현장별 3단계 현황", "안전점검 확인"] };
import { APP, newBrowser, adminLogin } from "/home/user/hana-project-ax/tests-pilot/e2e/common.mjs";
const OUT = process.argv[2];
const CASE = process.argv[3];
const J1 = "aafe94a3-c1aa-4306-af3f-63f0df4da901";
const bro = await newBrowser();
const { p } = await adminLogin(bro, "김관리");
const ctx = await bro.newContext({ storageState: await p.context().storageState(), viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const a = await ctx.newPage();
const q = "?date=2026-11-22&kind=scenario";
async function full(name, path, before) {
  await a.goto(APP + path);
  await a.waitForLoadState("networkidle").catch(() => {});
  await a.evaluate(() => document.fonts.ready);
  await a.waitForTimeout(900);
  if (before) await before();
  // 고정 띠 숨김 (스크롤 연출에서 겹치지 않게)
  await a.evaluate(() => { for (const e of document.querySelectorAll("body *")) { const s = getComputedStyle(e).position; if (s === "fixed" || s === "sticky") e.style.position = "static"; } });
  await a.screenshot({ path: join(OUT, name + ".jpg"), type: "jpeg", quality: 90, fullPage: true });
  const pos = await a.evaluate((keys) => {
    const out = { _w: document.documentElement.scrollWidth, _h: document.documentElement.scrollHeight };
    const m = document.querySelector("main"); if (m) { const r = m.getBoundingClientRect(); out._main = [r.left + scrollX, r.width]; }
    for (const k of keys) {
      const el = [...document.querySelectorAll("h1,h2,h3,p,span,div,summary,button")].find((e) => e.children.length < 4 && e.textContent.trim().startsWith(k));
      if (el) { const r = el.getBoundingClientRect(); out[k] = r.top + scrollY; }
    }
    return out;
  }, KEYS[name] ?? []);
  POS[name] = pos;
  writeFileSync(join(OUT, "pos.json"), JSON.stringify(POS, null, 1));
  console.log("ok", name, JSON.stringify(pos));
}
await full("f_judg", `/pilot/admin/judgments/${J1}`, async () => { await a.locator("text=점수 계산 근거").first().click().catch(() => {}); await a.waitForTimeout(500); });
await full("f_case", `/pilot/admin/cases/${CASE}`);
await full("f_records", `/pilot/admin/records${q}`);
await full("f_safety", `/pilot/admin/safety${q}`);
await bro.close();
