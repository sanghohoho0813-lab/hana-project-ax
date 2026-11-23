// 이의신청 보완 패키지용 추가 화면 촬영 — appeal-shots.mjs로 만든 사례(같은 날짜 · 검증 시나리오)를 관리자 화면에서 다시 연다 (회귀 시험 아님)
// 판단 기록 상세(입력값 · 규칙 버전 · 계산 과정 · 판단 전후) · 기록·판단 이력 · 안전관리 · 계정 · 로그인 · 데모 기술검증 화면(기존 정적 검사와 비교)
// 실행: APPEAL_OUT=<폴더> APPEAL_DATE=2026-11-22 node tests-pilot/e2e/appeal-extra-shots.mjs
//   APPEAL_J1 · APPEAL_J2 · APPEAL_J3 = 판단 기록 id (보고 직후 · 1차 조치 · 2차 조치) — 없으면 그 날짜 기록에서 찾는다
// 화면마다 전체 화면(fullPage)과, 지정한 부분만 2배 해상도로 자른 jpg를 남기고 목록을 extra.json에 적는다.
//   부분 지정: ["이름", 요소 선택자] 또는 ["이름", { from: 시작 글자, to: 끝 글자 }] — 두 글자 사이를 본문 폭으로 자른다
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, newBrowser, adminLogin, psql } from "./common.mjs";

const OUT = process.env.APPEAL_OUT ?? join(tmpdir(), "appeal-extra");
const DATE = process.env.APPEAL_DATE;
if (!DATE) throw new Error("APPEAL_DATE(YYYY-MM-DD)를 주세요");
mkdirSync(OUT, { recursive: true });
const q = `?date=${DATE}&kind=scenario`;
const rows = psql(`select id || '|' || trigger_kind from public.risk_judgments where work_date='${DATE}' and data_kind='검증 시나리오' order by seq;`)
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("|"));
const pick = (k, word, n) => process.env[k] ?? rows.filter(([, t]) => t.includes(word))[n]?.[0];
const J1 = pick("APPEAL_J1", "예상 종료", 0);
const J2 = pick("APPEAL_J2", "일정 수정", 0);
const J3 = pick("APPEAL_J3", "일정 수정", 1);
const shots = [];
const kstSec = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 19);

/** 고정 · 붙박이 띠(머리띠 · 하단 메뉴 · 옆 메뉴 머리)를 숨긴다 — 잘라 찍을 때 겹치지 않게 */
const hideFixed = (pg) =>
  pg.evaluate(() => {
    window.__hid = [];
    for (const e of document.querySelectorAll("body *")) {
      const p = getComputedStyle(e).position;
      if (p === "fixed" || p === "sticky") {
        window.__hid.push([e, e.style.visibility]);
        e.style.visibility = "hidden";
      }
    }
  });
const showFixed = (pg) => pg.evaluate(() => (window.__hid ?? []).forEach(([e, v]) => (e.style.visibility = v)));

/** 문서 기준 상자 */
const docBox = (loc) =>
  loc.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
  });

async function snap(pg, id, path, parts = []) {
  await pg.goto(APP + path);
  await pg.waitForLoadState("networkidle").catch(() => {});
  await pg.evaluate(() => document.fonts.ready).catch(() => {});
  await pg.waitForTimeout(1000);
  const rec = { id, path, img: `${id}.jpg`, at: kstSec(), parts: [] };
  await pg.screenshot({ path: join(OUT, rec.img), type: "jpeg", quality: 85, fullPage: true });
  await hideFixed(pg);
  const main = (await pg.locator("main").count()) ? await docBox(pg.locator("main").first()) : null;
  for (const [name, spec] of parts) {
    let clip;
    if (typeof spec === "string") {
      const t = pg.locator(spec).first();
      if (!(await t.count())) {
        console.log(`  (없음) ${id}/${name}: ${spec}`);
        continue;
      }
      clip = await docBox(t);
    } else {
      const a = pg.getByText(spec.from, { exact: false }).nth(spec.fromN ?? 0);
      const b = spec.to ? pg.getByText(spec.to, { exact: false }).nth(spec.toN ?? 0) : null;
      if (!(await a.count()) || (b && !(await b.count()))) {
        console.log(`  (없음) ${id}/${name}: ${spec.from} → ${spec.to}`);
        continue;
      }
      const A = await docBox(a);
      const B = b ? await docBox(b) : null;
      const box = spec.box ? await docBox(pg.locator(spec.box).first()) : main;
      const top = A.y - (spec.padTop ?? 14);
      const bottom = B ? B.y - (spec.padBottom ?? 14) : A.y + (spec.height ?? 600);
      clip = { x: box ? box.x : 0, y: top, width: box ? box.width : pg.viewportSize().width, height: bottom - top };
    }
    const f = `${id}__${name}.jpg`;
    const pad = 6;
    await pg.screenshot({
      path: join(OUT, f),
      type: "jpeg",
      quality: 90,
      fullPage: true,
      clip: { x: Math.max(0, clip.x - pad), y: Math.max(0, clip.y - pad), width: clip.width + 2 * pad, height: clip.height + 2 * pad },
    });
    rec.parts.push({ name, img: f });
  }
  await showFixed(pg);
  shots.push(rec);
  writeFileSync(join(OUT, "extra.json"), JSON.stringify({ date: DATE, judgments: { J1, J2, J3 }, shots }, null, 1));
  console.log(`${kstSec()} [${id}] ${path} (${rec.parts.length}/${parts.length}개 부분)`);
}

const bro = await newBrowser();
const { p } = await adminLogin(bro, "김관리");
// 같은 로그인으로 2배 해상도 창을 연다 — 문서에 넣을 글자가 또렷하게
const ctx = await bro.newContext({ storageState: await p.context().storageState(), viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const a = await ctx.newPage();

const JUD = [
  ["info", 'section[aria-label="판단 정보"]'],
  ["trigger", 'section[aria-label="계기 기록"]'],
  ["ba", 'section[aria-label="판단 전후"]'],
  ["input", 'section[aria-label="판단 입력"]'],
];
if (J1)
  await snap(a, "x_judg_report", `/pilot/admin/judgments/${J1}`, [
    ...JUD,
    ["basis1", { from: "바뀐 연결의 판단 근거", to: "[연쇄위험 감지]", toN: 1 }],
    ["basis2", { from: "[연쇄위험 감지]", fromN: 1, to: "대응 우선순위 (판단 후" }],
    ["prio", { from: "대응 우선순위 (판단 후", to: "계기 현장의 작업상태 편차" }],
    ["dev", { from: "계기 현장의 작업상태 편차", to: "판단 입력 (판단 후" , padBottom: 30 }],
  ]);
if (J2) await snap(a, "x_judg_adjust1", `/pilot/admin/judgments/${J2}`, JUD);
if (J3) await snap(a, "x_judg_adjust2", `/pilot/admin/judgments/${J3}`, JUD);
await snap(a, "x_records", `/pilot/admin/records${q}`, [
  ["events", 'section[aria-label="작업 기록"]'],
  ["judgments", 'section[aria-label="위험 판단 이력"]'],
  ["revisions", 'section[aria-label="일정 변경 이력"]'],
]);
await snap(a, "x_safety", `/pilot/admin/safety${q}`, [["top", { from: "현장별 3단계 현황", to: "ST-", padBottom: 24 }]]);
await snap(a, "x_staff", `/pilot/admin/staff`, [["top", "main"]]);

// 데모(브라우저 저장 · 로그인 없음) — 기술검증 시뮬레이션 · 기존 정적 검사와 비교
const d = await ctx.newPage();
await snap(d, "x_demo_verify", "/demo/verify", [
  ["compare", 'div.card:has(p:has-text("기존 정적 충돌 검사와 비교"))'],
  ["flowrun", 'div.card:has(p:has-text("연속 시험 — 정상"))'],
  ["steps", { from: "상태이벤트 연속 검증", to: "기본 시나리오 A~E" }],
]);
await snap(d, "x_login", "/pilot/login", [["form", "main"]]);
await bro.close();
console.log("끝", OUT);
