// 현장 문제 보고 · 지원 요청 화면 시험 (2026-11-13 인터뷰 근거) — `next start -p 3197` 만 필요 (Supabase 불필요)
//   node tests-pilot/e2e/issues.mjs                      결과만
//   PILOT_E2E_OUT=폴더 node tests-pilot/e2e/issues.mjs    화면 캡처도 남김
// 흐름: 현장 문제 발견 → (모바일) 보고 · 예상 종료 변경 → 후속 현장 위험 계산 → (PC) 관리자 접수·지원 결정·일정 조정 → 재판단 → 해결
// 시나리오 3종(조기 지원 요청 · 지원 요청 지연 · 정상 작업)을 PC+Mobile 동시보기에서 반복한다.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const APP = process.env.PILOT_E2E_APP ?? "http://localhost:3197";
const OUT = process.env.PILOT_E2E_OUT;
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright");
}
const exe = process.env.PILOT_E2E_CHROMIUM ?? "/opt/pw-browsers/chromium";
const bro = await pw.chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
let fails = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
};
const shot = async (p, name) => OUT && p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const ctx = await bro.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.route(/jsdelivr/, (r) => r.abort());
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
const lab = () => p.evaluate(() => JSON.parse(localStorage.getItem("hana-ax-lab:v1") ?? "null"));
const until = async (fn, ms = 8000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

// ── 준비: PC+Mobile 동시보기 · PC 쪽 관리자 시점 ──
await p.goto(APP + "/field");
await p.locator('a[role=tab]:has-text("관리자 시점")').waitFor();
await p.click('[aria-label="화면 보기"] button >> text="PC+Mobile"');
const left = p.locator('[data-pane="pc"]');
const fr = p.frameLocator('iframe[title^="모바일 화면"]');
await left.locator('a[role=tab]:has-text("관리자 시점")').click();

async function load(id, name) {
  await left.locator('button:has-text("현장 문제 시나리오")').click();
  await left.locator(`button:has-text("${id} ${name}")`).click();
  await left.locator(`text=현장 문제 시나리오 ${id} ${name}를 가상 시나리오 세트로 불러왔습니다`).waitFor();
  await left.locator('select[aria-label="시험 방식"]').selectOption({ label: "컨설턴트 진행" });
  await left.locator("text=시험 방식을 '컨설턴트 진행'").waitFor();
  // 모바일: 가상 작업자 화면
  await fr.locator('button:has-text("가상 작업자 1")').click();
  await fr.locator('section[aria-label="A현장 일정"]').waitFor();
}

/** 모바일 A현장 카드에서 문제 보고 — 누른 버튼 수를 센다 */
async function report({ type, progress, need, end, found, told }) {
  const A = fr.locator('section[aria-label="A현장 일정"]');
  let taps = 0;
  const tap = async (loc) => (await loc.click(), taps++);
  await tap(A.locator('button:has-text("현장 문제 보고 · 지원 요청")'));
  const sheet = A.locator('[aria-label="현장 문제 보고"]');
  await tap(sheet.locator(`[aria-label="문제 유형"] button:text-is("${type}")`));
  await tap(sheet.locator(`[aria-label="작업 진행상황"] button:text-is("${progress}")`));
  if (need) await tap(sheet.locator(`[aria-label="지원 요청"] button:text-is("${need}")`));
  if (end) {
    await tap(sheet.locator('[aria-label="변경 예상 종료"] button:text-is("직접 입력")'));
    await sheet.locator('input[aria-label="변경 예상 종료 직접 입력"]').fill(end);
  }
  await sheet.locator('input[aria-label="문제 발견시각 직접 입력"]').fill(found);
  await sheet.locator('input[aria-label="본사에 보고한 시각 직접 입력"]').fill(told);
  await tap(sheet.locator('button:has-text("보고 보내기")'));
  await A.locator("text=보고됨").first().waitFor();
  await p.waitForTimeout(500);
  return taps;
}

const card = (no) => left.locator(`li[aria-label="현장 문제 ${no}"]`);
async function step(no, button, sheetLabel, { time, choice } = {}) {
  await card(no).locator(`button:text-is("${button}")`).click();
  const sh = card(no).locator(`[aria-label="${sheetLabel} 기록"]`);
  if (choice) await sh.locator(`button:text-is("${choice}")`).click();
  await sh.locator("input[type=time]").first().fill(time);
  await sh.locator('button:text-is("기록")').click();
  await card(no).locator(`text=${sheetLabel} 기록됨`).waitFor();
}
async function adjust(no, site, start, end, time) {
  await card(no).locator('button:text-is("일정 조정")').click();
  const sh = card(no).locator('[aria-label="일정 조정 기록"]');
  const opt = await sh.locator('select[aria-label="조정할 일정"] option', { hasText: site }).getAttribute("value");
  await sh.locator('select[aria-label="조정할 일정"]').selectOption(opt);
  await sh.locator('input[aria-label="새 예정 시작"]').fill(start);
  await sh.locator('input[aria-label="새 예정 종료"]').fill(end);
  await sh.locator('input[aria-label="조치한 시각 직접 입력"]').fill(time);
  await sh.locator('button:has-text("조정하고 다시 판단")').click();
  const msg = card(no).locator(`text=${site} 일정을 ${start}~${end}로 조정`);
  await msg.waitFor();
  return (await msg.innerText()).match(/위험 연결 (\d+) → (\d+)건/)?.slice(1).map(Number);
}
async function resolve(time) {
  const li = fr.locator('section[aria-label="A현장 일정"] [aria-label="이 현장의 문제 보고"] li').last();
  await li.locator('button:has-text("해결 여부 기록")').click();
  const sh = li.locator('[aria-label="해결 여부 기록"]');
  await sh.locator('button:text-is("해결")').click();
  await sh.locator("input[type=time]").first().fill(time);
  await sh.locator('button:text-is("기록")').click();
  await fr.locator("text=해결 여부 기록됨").waitFor();
}
const sessionNow = async () => {
  const st = await lab();
  const sid = await p.evaluate(() => localStorage.getItem("hana-ax-pref:session"));
  return { st, sid, session: st.sessions.find((x) => x.id === sid) };
};
const riskyNow = async () => {
  const t = await left.locator("text=/위험 \\d+건 · 연결 \\d+건 확인/").first().innerText().catch(() => "");
  return Number(t.match(/위험 (\d+)건/)?.[1] ?? -1);
};

// ── A) 조기 지원 요청 (I2) ──
await load("I2", "조기 지원 요청");
let { st, sid } = await sessionNow();
const j0 = st.judgments.length;
const taps = await report({ type: "예상과 다른 현장상황", progress: "분해·설치 시작 후", need: "숙련 기술자", end: "10:40", found: "09:20", told: "09:25" });
({ st } = await sessionNow());
let issue = st.issues.find((i) => i.sessionId === sid);
check(!!issue && issue.type === "예상과 다른 현장상황" && issue.progress === "분해·설치 시작 후" && issue.needs.join() === "숙련 기술자" && issue.via === "현장기사 화면", "A1 모바일 문제 보고 저장 (유형·진행상황·지원 요청·입력 화면)");
check(taps <= 6, `A1 보고에 누른 버튼 ${taps}번 (시각 2칸·예상 종료 1칸 입력 별도)`);
check(issue.discovered.entered === "09:20" && issue.discovered.basis === "가상 시각" && issue.reported.entered === "09:25" && issue.expectedEnd === "10:40", "A1 발견 09:20 · 보고 09:25 (가상 시각) · 변경 예상 종료 10:40");
const ev = st.entries.find((e) => e.seq === issue.linkedSeq);
check(ev?.kind === "예상 종료 보고" && ev.expectedEnd === "10:40" && ev.issueId === issue.id && st.judgments.length === j0 + 1, "A2 예상 종료만 기존 '예상 종료 보고' 1건으로 엔진 전달 · 판단 1건 추가");
const jr = st.judgments.find((j) => j.seq === issue.linkedSeq);
check(jr.summary.risky_before === 0 && jr.summary.risky_after === 1 && jr.story.some((l) => l.includes("B현장 도착 11:00(계산값)") && l.includes("30분 늦음")), "A2 후속 현장 위험 계산: 0 → 1건 · B현장 도착 11:00(계산값) · 30분 늦음", jr.story.join(" / "));
check(await until(async () => (await card(1).count()) === 1 && (await card(1).innerText()).includes("보고됨")), "A3 PC 관리자 화면에 문제 현장 바로 표시 (새로 고침 없이)");
check((await left.locator('tr:has(b:text-is("A현장")) >> text=⚠ 문제 #').count()) === 1, "A3 일정판 A현장에 문제 표시");
await shot(p, "issue_1_reported");
await step(1, "접수", "지원 요청 접수", { time: "09:27" });
await step(1, "지원 결정", "지원 조치 결정", { time: "09:30", choice: "숙련 기술자 파견" });
const ad = await adjust(1, "B현장", "11:00", "12:30", "09:30");
check(ad?.join("→") === "1→0", "A4 관리자 일정 조정(B 11:00~12:30) → 재판단: 위험 연결 1 → 0건", String(ad));
check(await until(async () => (await fr.locator('section[aria-label="A현장 일정"] >> text=본사: 일정 조정').count()) === 1), "A4 현장기사 화면에 본사 조치 표시");
check(await until(async () => (await fr.locator('section[aria-label="B현장 일정"] >> text=11:00 ~ 12:30').count()) === 1), "A4 조정된 B현장 일정이 모바일에 반영");
await resolve("10:40");
({ st } = await sessionNow());
issue = st.issues.find((i) => i.sessionId === sid);
check(issue.steps.map((o) => o.kind).join(",") === "지원 요청 접수,지원 조치 결정,일정 조정,해결 여부" && issue.steps.at(-1).resolution === "해결", "A5 접수·지원 결정·일정 조정·해결 순서대로 기록");
await left.locator('button:has-text("해결·무효 포함 전체")').click();
await card(1).locator('button:has-text("처리 흐름")').click();
const flow = card(1).locator('[aria-label="현장 문제 1 처리 흐름"] > li');
const ftext = await flow.allInnerTexts();
check(ftext.length === 9 && ftext[0].startsWith("입력값") && ftext[3].startsWith("계산값") && ftext[3].includes("위험 연결 0 → 1건") && ftext[7].startsWith("계산값") && ftext[7].includes("재판단") && ftext[7].includes("위험 연결 1 → 0건"), "A6 처리 흐름: 발견 → 예상 종료 변경 → 후속 현장 위험 계산(계산값) → 관리자 조치 → 재판단(계산값)", ftext.map((x) => x.split("\n")[0]).join(" | "));
check((await card(1).innerText()).includes("문제 발견 → 첫 보고 5분(가상)") && (await card(1).innerText()).includes("지원 요청 → 해결 75분(가상)"), "A6 소요시간 표시 — 가상 시나리오 값은 '가상'으로");
await shot(p, "issue_2_flow");
if (OUT) await card(1).screenshot({ path: `${OUT}/issue_2_card.png` });
// 예상 대비 결과
await left.locator('[aria-label="예상 대비 결과"] button:text-is("예상대로")').click();
await left.locator("text='예상대로'으로 기록했습니다").waitFor();
const i2sid = sid;

// ── B) 지원 요청 지연 (I3) — 같은 흐름 반복 ──
await load("I3", "지원 요청 지연");
({ st, sid } = await sessionNow());
await report({ type: "예상과 다른 현장상황", progress: "분해·설치 시작 후", need: "숙련 기술자", end: "11:10", found: "09:20", told: "10:20" });
({ st } = await sessionNow());
issue = st.issues.find((i) => i.sessionId === sid);
const jl = st.judgments.find((j) => j.seq === issue.linkedSeq);
check(jl.summary.risky_before === 1 && jl.summary.risky_after === 2, "B1 늦은 보고(10:20): 보고 직전 이미 1건(엔진 추정 규칙) → 보고 후 2건", `${jl.summary.risky_before}→${jl.summary.risky_after}`);
check(st.sessions.find((x) => x.id === sid).clock === "10:20", "B1 재현 기준시각이 보고 시각 10:20으로 옮겨짐 (가정값 · 이력 남음)");
await step(1 + 1, "접수", "지원 요청 접수", { time: "10:22" });
await step(2, "지원 결정", "지원 조치 결정", { time: "10:30", choice: "숙련 기술자 파견" });
const b1 = await adjust(2, "B현장", "11:30", "13:00", "10:30");
const b2 = await adjust(2, "C현장", "13:30", "15:00", "10:32");
check(b1?.join("→") === "2→1" && b2?.join("→") === "1→0", "B2 B현장 조정 2→1 · C현장 조정 1→0 (재판단마다)", `${b1} / ${b2}`);
await resolve("11:10");
({ st } = await sessionNow());
issue = st.issues.find((i) => i.sessionId === sid);
check(issue.steps.length === 5 && st.sessions.find((x) => x.id === sid).clock === "11:10", "B3 단계 5건 기록 · 기준시각 11:10");
await left.locator('[aria-label="예상 대비 결과"] input').fill("보고 직전부터 엔진이 A→B를 높음으로 표시 (예정 종료가 지나 추정 규칙 적용)");
await left.locator('[aria-label="예상 대비 결과"] button:text-is("예상과 다름")').click();
await left.locator("text='예상과 다름'으로 기록했습니다").waitFor();
const i3sid = sid;

// ── C) 정상 작업 (I1) — 문제 보고 없음 ──
await load("I1", "정상 작업");
({ st, sid } = await sessionNow());
const A = fr.locator('section[aria-label="A현장 일정"]');
await A.locator('button:has-text("작업 종료")').click();
await A.locator('input[aria-label="실제 시각"]').fill("10:00");
await A.locator('button:has-text("이 시각으로 기록")').click();
await A.locator("text=작업 종료 기록됨").waitFor();
({ st } = await sessionNow());
check(st.issues.filter((i) => i.sessionId === sid).length === 0 && st.judgments.filter((j) => j.sessionId === sid).every((j) => j.summary.risky_after === 0), "C1 정상 작업: 문제 보고 없음 · 위험 0건");
check(await until(async () => (await riskyNow()) === 0), "C1 관리자 화면 지금 판단 위험 0건");

// ── D) 예상 종료 미확인 보고 — 판단이 생기지 않는다 ──
await load("I2", "조기 지원 요청");
({ st, sid } = await sessionNow());
const jBefore = st.judgments.length;
const eBefore = st.entries.length;
await report({ type: "추가 장비 필요", progress: "작업 진행 중", need: "추가 장비", end: null, found: "09:40", told: "09:45" });
({ st } = await sessionNow());
check(st.judgments.length === jBefore && st.entries.length === eBefore && st.issues.at(-1).expectedEnd === null && st.issues.at(-1).linkedSeq === null, "D1 예상 종료 '아직 모름' 보고 — 문제 기록만 · 엔진 입력·판단 기록 없음");
check((await card(3).innerText()).includes("보고 때 예상 종료 미확인 — 엔진에 전달하지 않음"), "D1 관리자 화면에 '엔진 전달 안 함' 표시");
// 같은 보고 버튼을 두 번 눌러도 한 건 (보고 보내기 후 시트가 닫힘)
check(st.issues.filter((i) => i.sessionId === sid).length === 1, "D2 보고 1건만 저장");

// ── E) 증거 기록 · CSV · 보고서 ──
await p.goto(`${APP}/records/evidence?s=${i2sid}`);
await p.locator('article[aria-label="시험 증거 기록"]').waitFor();
const evText = await p.locator('article[aria-label="시험 증거 기록"]').innerText();
for (const h of ["1. 시험번호 · 날짜", "2. 프로그램 버전", "3. 현장 문제 원자료 · 출처", "4. 입력값", "5. 엔진 처리 과정 · 결과", "6. 관리자 조치", "7. 조치 전후 변화", "8. 실제 측정 시간", "9. 발견 문제 · 수정사항", "10. 참여자 실제 피드백", "11. 예상 대비 결과"]) check(evText.includes(h), `E1 증거 기록 항목: ${h}`);
check(evText.includes("컨설턴트 진행") && evText.includes("보고 전 0 → 보고 후 1 → 관리자 조치 후 0") && evText.includes("5분 (가상)") && evText.includes("예상대로"), "E1 증거 기록 내용: 시험 방식 · 조치 전후 · 측정 시간(가상) · 예상 대비");
check(/세트를 만든 버전 \d+\.\d+\.\d+\+[0-9a-f]{7}/.test(evText), "E1 프로그램 버전 기록 (package 버전 + 커밋)", evText.match(/세트를 만든 버전 [^ ]+/)?.[0]);
await shot(p, "issue_3_evidence");
await p.goto(`${APP}/records`);
const [dl] = await Promise.all([p.waitForEvent("download"), p.click('button:has-text("현장 문제·지원 요청")')]);
const csv = readFileSync(await dl.path(), "utf8");
check(csv.split("\n").filter((l) => l.trim()).length === 1 + 3 && csv.includes("예상과 다른 현장상황") && csv.includes("미확인(엔진 전달 안 함)") && csv.includes("가상"), "E2 현장 문제 CSV — 3건 · 엔진 전달 여부 · 품질");
await p.goto(`${APP}/records/report`);
const rep = await p.locator("article").innerText();
check(rep.includes("③-1 실측 결과 (실제 업무)") && rep.includes("③-2 현장정보 재현 결과 (사후 재현)") && rep.includes("③-3 가상 시나리오 결과 (가상 시나리오)") && rep.includes("⑥ 향후 예상 효과"), "E3 보고서: 실측 · 현장정보 재현 · 가상 시나리오 · 예상 효과를 나눔");
check(rep.includes("현장 문제 보고 3건 · 예상 종료 엔진 전달 2건") && rep.includes("예상과 다름: 보고 직전부터"), "E3 보고서: 가상 시나리오 현장 문제 3건 · 예상과 다른 결과도 기록");
await shot(p, "issue_4_report");

// ── F) Mobile 390px: 보고 시트 가로 넘침 없음 ──
await p.goto(APP + "/field");
await p.click('[aria-label="화면 보기"] button >> text="Mobile"');
await fr.locator('section[aria-label="A현장 일정"]').waitFor();
await fr.locator('section[aria-label="A현장 일정"] button:has-text("현장 문제 보고 · 지원 요청")').click();
await fr.locator('[aria-label="현장 문제 보고"]').waitFor();
const frame = () => p.frames().find((f) => f.parentFrame() === p.mainFrame());
const fit = await frame().evaluate(() => ({ w: window.innerWidth, sw: document.documentElement.scrollWidth }));
check(fit.w === 390 && fit.sw <= fit.w + 1, "F1 390px 모바일 화면 — 보고 시트 가로 넘침 없음", JSON.stringify(fit));
await shot(p, "issue_5_mobile_390");
if (OUT) await fr.locator('[aria-label="현장 문제 보고"]').screenshot({ path: `${OUT}/issue_5_sheet.png` });
await p.click('[aria-label="화면 보기"] button >> text="PC"');

// 엔진 결과 다시 계산 = 저장된 판단 (백업 검사와 같은 방식은 단위시험에서) · 화면 오류 없음
st = await lab();
check(st.judgments.every((j) => typeof j.summary.risky_after === "number") && [i2sid, i3sid].every((x) => st.issues.some((i) => i.sessionId === x && i.steps.at(-1).resolution === "해결")), "G1 두 시나리오 모두 해결로 끝남");
check(errs.length === 0, "G2 화면 오류 없음", errs.join(" | "));

await bro.close();
console.log(fails ? `실패 ${fails}건` : "모두 통과");
process.exitCode = fails ? 1 : 0;
