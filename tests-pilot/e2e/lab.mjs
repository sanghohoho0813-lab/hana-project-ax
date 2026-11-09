// 로컬 실증(브라우저 저장) 12단계 반복시험 — `next start -p 3197` 만 필요 (Supabase 불필요)
//   node tests-pilot/e2e/lab.mjs            결과만
//   PILOT_E2E_OUT=폴더 node tests-pilot/e2e/lab.mjs   화면 캡처도 남김
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
async function context(viewport = { width: 1440, height: 1000 }, extra = {}) {
  const ctx = await bro.newContext({ viewport, acceptDownloads: true, ...extra });
  await ctx.route(/jsdelivr/, (r) => r.abort());
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  return p;
}
const lab = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("hana-ax-lab:v1") ?? "null"));
const kstDate = (n = 0) => new Date(Date.now() + 9 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
const until = async (fn, ms = 8000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

const p = await context();
const DAY = kstDate(-1); // 어제 업무를 사후 재현

// ── 1) 관리자 시점: 세트 · 시험용 기사 · 현장 A·B·C 일정 ──
await p.goto(APP + "/field");
await p.locator('a[role=tab]:has-text("관리자 시점")').waitFor();
check((await p.locator('a[role=tab][aria-selected=true]:has-text("관리자 시점")').count()) === 1, "1 현장 실증 — PC 기본은 관리자 시점");
await p.click('button:has-text("새 세트")');
await p.click('[aria-label="데이터 구분"] button:has-text("사후 재현")');
await p.fill("input[name=title]", "E2E 재현 — 구본석 이사 전달 일정");
await p.fill("input[name=workDate]", DAY);
await p.fill("input[name=clock]", "08:30");
await p.fill("input[name=sourceRef]", "업무일지 사본");
await p.click('button:has-text("세트 만들기")');
await p.locator("select[aria-label=\"실증 세트 고르기\"]").waitFor();
await p.locator("text=재현 기준시각(가정값)").waitFor();
await p.click('button:has-text("시험용 기사 추가")');
await p.fill('input[aria-label="기사 이름"]', "김기사");
await p.fill('input[aria-label="참가자 코드"]', "T01");
await p.click('form:has(input[aria-label="기사 이름"]) button:has-text("추가")');
await p.locator("text=현장기사를 추가했습니다").waitFor();
await p.locator('section[aria-label="일정"] button:has-text("일정 등록")').first().click();
const form = p.locator("form:has(input[name=site])");
for (const [site, a, b, travel] of [
  ["A현장", "09:00", "10:00", ""],
  ["B현장", "10:30", "12:00", "20"],
  ["C현장", "12:30", "14:00", "20"],
]) {
  await form.locator("select[name=worker]").selectOption({ label: "김기사 (T01)" });
  await form.locator("input[name=site]").fill(site);
  await form.locator("input[name=start]").fill(a);
  await form.locator("input[name=end]").fill(b);
  await form.locator("input[name=travel]").fill(travel);
  await form.locator('button:has-text("일정 등록")').click();
  await form.locator(`text=${site} 일정을 등록했습니다`).waitFor();
}
let st = await lab(p);
check(st.entries.length === 3 && st.judgments.length === 3, "1 관리자: A·B·C 일정 3건 등록 → 기록 3 · 판단 3", `${st.entries.length}/${st.judgments.length}`);
check(st.entries[2].snapshot.travelFromId === st.entries[1].snapshot.id, "1 C현장 이동 출발 현장 = B현장 (자동)");
check(st.sessions[0].kind === "사후 재현" && st.entries.every((e) => e.enteredBy === "p-consultant" && e.informantId === "p-koo"), "1 입력자(컨설턴트)·정보 제공자(구본석) 분리 저장");
await shot(p, "lab_1_admin_pc");

// ── 2) 현장기사 시점으로 ──
await p.click('a[role=tab]:has-text("현장기사 시점")');
await p.click('button:has-text("김기사")');
await p.locator('section[aria-label="A현장 일정"]').waitFor();
check((await p.locator("text=시험용 전환").count()) >= 1 && (await p.locator("text=대리 입력").count()) >= 1, "2 현장기사 시점 — 시험용 전환 표시 · 대리 입력 표시");

// ── 3) Mobile 모드: 실제 390px 화면에서 작업 시작 · 예상 종료 입력 ──
await p.click('[aria-label="화면 보기"] button >> text="Mobile"');
const frameEl = p.locator('iframe[title^="모바일 화면"]');
await frameEl.waitFor();
const fr = p.frameLocator('iframe[title^="모바일 화면"]');
await fr.locator('section[aria-label="A현장 일정"]').waitFor();
const frame = () => p.frames().find((f) => f.parentFrame() === p.mainFrame());
const fw = await frame().evaluate(() => window.innerWidth);
check(fw === 390, "3 Mobile 모드 — 실제 390px 화면(iframe 뷰포트)", `innerWidth ${fw}`);
check((await fr.locator('[aria-label="화면 보기"]').count()) === 0 && (await fr.locator("iframe").count()) === 0, "3 iframe 안에는 보기 전환·iframe 없음 (재귀 방지)");
const A = fr.locator('section[aria-label="A현장 일정"]');
await A.locator('button:has-text("작업 시작")').click();
await A.locator('input[aria-label="실제 시각"]').fill("09:20");
await A.locator('button:has-text("이 시각으로 기록")').click();
await A.locator("text=작업 시작 기록됨").waitFor();
await p.waitForTimeout(600); // 사람이 다음 버튼을 누르는 간격 (기록 직후 0.45초는 두 번 누름 방지로 받지 않음)
await A.locator('button:has-text("예상 종료시간 변경")').click();
await A.locator('input[aria-label="새 예상 종료시간"]').fill("10:40");
await A.locator('input[aria-label="실제 시각"]').fill("09:50");
await A.locator('button:has-text("이 시각으로 기록")').click();
await A.locator("text=예상 종료 10:40 기록됨").waitFor();
st = await lab(p);
const evs = st.entries.filter((e) => e.type === "event");
check(evs.length === 2 && evs[0].occurredAt === new Date(`${DAY}T09:20:00+09:00`).toISOString() && evs[0].timeBasis === "정보 제공자 진술" && evs[0].via === "현장기사 화면", "3 모바일 입력: 실제 발생시각 09:20(제공자 진술) · 입력 화면 기록");
check(evs[0].enteredAt > evs[0].occurredAt && evs[1].expectedEnd === "10:40", "3 프로그램 입력시각은 실제 시각과 따로 · 예상 종료 10:40");
await shot(p, "lab_3_mobile_390");
await p.click('[aria-label="모바일 화면 폭"] button:has-text("430px")');
await until(async () => (await frame()?.evaluate(() => window.innerWidth).catch(() => 0)) === 430);
check((await frame().evaluate(() => window.innerWidth)) === 430 && (await frame().evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), "3 430px 화면 — 가로 넘침 없음");
await shot(p, "lab_3_mobile_430");
await p.click('[aria-label="모바일 화면 폭"] button:has-text("390px")');

// ── 4) PC+Mobile 동시보기: 같은 데이터 · 양방향 반영 ──
await p.click('[aria-label="화면 보기"] button >> text="PC+Mobile"');
const left = p.locator('[data-pane="pc"]');
// 시점은 창마다 — PC 쪽은 관리자, 모바일 쪽은 현장기사로 같은 데이터를 본다
await left.locator('a[role=tab]:has-text("관리자 시점")').click();
await left.locator("table").first().waitFor();
await fr.locator('section[aria-label="A현장 일정"]').waitFor();
const leftW = await left.evaluate((el) => el.getBoundingClientRect().width);
const rightW = await p.locator('[data-pane="mobile"]').evaluate((el) => el.getBoundingClientRect().width);
check(Math.abs(leftW / (leftW + rightW) - 0.667) < 0.02, "4 동시보기 — 왼쪽 PC 약 67% · 오른쪽 모바일 약 33%", `${Math.round(leftW)} : ${Math.round(rightW)}`);
check((await left.locator("tr:has-text('A현장') >> text=작업 중").count()) === 1 && (await fr.locator('section[aria-label="A현장 일정"] >> text=작업 중').count()) === 1, "4 양쪽 같은 데이터 — A현장 '작업 중'");
// 모바일 → PC
const B = fr.locator('section[aria-label="B현장 일정"]');
await B.locator('button:has-text("업무 확인")').click();
await B.locator('button:has-text("시각 모름")').click();
await B.locator("text=업무 확인 기록됨").waitFor();
check(await until(async () => (await left.locator("tr:has-text('B현장') >> text=확인함").count()) === 1), "4 모바일에서 누른 업무 확인 → PC 화면에 바로 반영 (새로 고침 없이)");
st = await lab(p);
check(st.entries.at(-1).occurredAt === null && st.entries.at(-1).timeBasis === "모름", "4 시각 모름 → 실제 발생시각 비움 (추정하지 않음)");

// ── 5) 지연 입력 → 위험 판단 변화 ──
await left.locator("text=[연쇄위험 감지]").first().waitFor();
const hist = left.locator('section[aria-label="판단 전후 기록"] li');
const texts = await hist.allInnerTexts();
check(texts.some((t) => t.includes("A현장 예상 종료 보고: 10:40")), "5 판단 이력: A현장 예상 종료 10:40 보고");
const allJ = st.judgments;
const startJ = allJ.find((j) => j.story[0].includes("작업 시작"));
check(!!startJ && startJ.story.some((l) => l.includes("B현장 도착 10:40(계산값)") && l.includes("10분 늦음")) && startJ.changes.some((c) => c.kind === "신규 위험"), "5 A 20분 늦은 시작 → B 도착 10:40(계산값) · 10분 늦음 → 신규 위험", startJ?.story.join(" / "));
const repJ = allJ.find((j) => j.story[0].includes("예상 종료 보고: 10:40"));
check(!!repJ && repJ.story.some((l) => l.includes("B현장 도착 11:00(계산값)") && l.includes("30분 늦음")) && repJ.changes.some((c) => c.kind === "악화"), "5 예상 종료 10:40 보고 → B 도착 11:00 · 30분 늦음 → 악화");
check(await until(async () => (await fr.locator('section[aria-label="B현장 일정"] >> text=앞 현장 A현장 때문에 이 현장 도착이 30분 늦을').count()) === 1), "5 현장기사 화면에도 지연 결과 표시 (계산값)");
await shot(p, "lab_4_pc_mobile");

// ── 6) 관리자 일정 조정 → 다시 판단 (PC → 모바일 반영) ──
await left.locator('tr:has(b:text-is("B현장")) button:has-text("조정")').click();
const ef = left.locator("form:has(input[name=reason])");
await ef.locator("input[name=start]").fill("11:00");
await ef.locator("input[name=end]").fill("12:00");
await ef.locator("input[name=reason]").fill("A현장 지연으로 B현장 시작 조정");
await ef.locator('button:has-text("조정하고 다시 판단")').click();
await left.locator("text=일정을 조정했습니다").waitFor();
st = await lab(p);
const adj = st.judgments.at(-1);
check(adj.story[0].includes("일정 조정: B현장") && adj.changes.some((c) => c.kind === "해소") && adj.summary.risky_after === 0, "6 관리자 조정(B 11:00~12:00) → 다시 판단: 위험 해소 · 위험 0건", adj.story.join(" / "));
check(await until(async () => (await fr.locator('section[aria-label="B현장 일정"] >> text=11:00 ~ 12:00').count()) === 1), "6 PC에서 조정한 일정이 모바일에 바로 반영");
check(st.entries.at(-1).reason === "A현장 지연으로 B현장 시작 조정", "6 조정 사유 저장");
// 경로 동기화: PC → 모바일, 모바일 → PC
await p.locator('header nav a:has-text("실증 기록·내보내기")').click();
check(await until(() => frame()?.url().includes("/records")), "4 경로 동기화: PC 메뉴 이동 → 모바일도 같은 경로");
await fr.locator('nav[aria-label="실증 하단 메뉴"] a:has-text("현장")').click();
check(await until(() => new URL(p.url()).pathname === "/field"), "4 경로 동기화: 모바일 메뉴 이동 → PC도 같은 경로 (반복 이동 없음)");
await new Promise((r) => setTimeout(r, 1500));
check(new URL(p.url()).pathname === "/field" && frame().url().includes("/field"), "4 동기화가 반복되지 않고 멈춤");

// ── 7) 새로 고침 → 기록 유지 ──
const before = await lab(p);
await p.reload();
await p.locator('[data-pane="pc"]').waitFor();
const after = await lab(p);
check(after.entries.length === before.entries.length && after.judgments.length === before.judgments.length && after.entries.length === 7, "7 새로 고침 뒤에도 기록 유지 (일정 3 · 시작·보고·확인 3 · 조정 1 = 7건)", String(after.entries.length));

// ── 8) 같은 입력 반복 → 중복 저장 없음 ──
await fr.locator('section[aria-label="A현장 일정"]').waitFor();
const A2 = fr.locator('section[aria-label="A현장 일정"]');
await A2.locator('button:has-text("예상 종료시간 변경")').click();
await A2.locator('input[aria-label="새 예상 종료시간"]').fill("10:50");
await A2.locator('input[aria-label="실제 시각"]').fill("09:55");
await A2.locator('button:has-text("이 시각으로 기록")').dblclick();
await A2.locator("text=예상 종료 10:50 기록됨").waitFor();
await p.waitForTimeout(600);
await new Promise((r) => setTimeout(r, 500));
st = await lab(p);
check(st.entries.length === 8 && st.entries.at(-1).expectedEnd === "10:50" && (await A2.locator('input[aria-label="실제 시각"]').count()) === 0, "8 '이 시각으로 기록'을 두 번 눌러도 1건만 저장 · 두 번째 누름이 다른 버튼을 누르지 않음", String(st.entries.length));
await A2.locator('li:has-text("작업 시작") button:has-text("정정")').click();
check((await A2.locator('button:has-text("작업 시작")').count()) === 0, "8 이미 기록한 작업 시작은 다시 누를 버튼이 없음 (정정만)");
await A2.locator('button:has-text("닫기")').click();
const r8 = await p.evaluate(() => {
  // 같은 요청 번호로 한 번 더 저장 시도 (전송 재시도와 같은 상황) — 모델 규칙 확인
  const s = JSON.parse(localStorage.getItem("hana-ax-lab:v1"));
  return s.entries.map((e) => e.opId).length === new Set(s.entries.map((e) => e.opId)).size;
});
check(r8, "8 저장된 기록의 요청 번호가 모두 다름 (중복 기록 없음)");

// ── 9) JSON · CSV 내려받기 → 데이터 일치 ──
await p.click('[aria-label="화면 보기"] button >> text="PC"');
await p.goto(APP + "/records");
const [dl] = await Promise.all([p.waitForEvent("download"), p.click('button:has-text("지금 JSON 백업 받기")')]);
const jsonPath = await dl.path();
const backup = JSON.parse(readFileSync(jsonPath, "utf8"));
st = await lab(p);
check(backup.format === "hana-ax-lab-backup" && backup.data.entries.length === st.entries.length && backup.counts.judgments === st.judgments.length, "9 JSON 백업 = 브라우저 기록 (기록·판단 수 같음)");
check(st.backup.lastAt && (await p.locator("text=그 뒤 바뀐 기록 없음").count()) === 1, "9 백업 상태 표시 — 그 뒤 바뀐 기록 없음");
const [dl2] = await Promise.all([p.waitForEvent("download"), p.click('section[aria-label="CSV 내보내기"] button:has-text("작업 기록")')]);
const csv = readFileSync(await dl2.path(), "utf8").replace(/^﻿/, "");
const lines = csv.trim().split(/\r?\n/);
const head = lines[0].split(",");
const col = (row, name) => row.split(",")[head.indexOf(name)];
const evRows = lines.slice(1);
check(evRows.length === st.entries.filter((e) => e.type === "event").length, "9 작업 기록 CSV 행 수 = 저장된 작업 기록 수", String(evRows.length));
check(col(evRows[0], "실제발생시각") === `${DAY} 09:20:00` && col(evRows[0], "입력자") === "컨설턴트" && col(evRows[0], "정보제공자") === "구본석" && col(evRows[0], "대리입력") === "대리 입력" && col(evRows[0], "데이터구분") === "사후 재현", "9 CSV — 실제 시각·입력자·정보 제공자·대리 입력·데이터 구분 일치");
check(col(evRows[2], "발생시각근거") === "모름" && col(evRows[2], "실제발생시각") === "", "9 CSV — 시각 모름은 빈칸 그대로");

// ── 10) JSON 다시 불러와 이전 시험 재현 (새 브라우저) ──
const q = await context();
await q.goto(APP + "/records");
await q.setInputFiles('input[aria-label="백업 JSON 파일"]', jsonPath);
await q.locator("text=파일 지문 일치").waitFor();
check((await q.locator(`text=다시 계산한 위험 판단 ${st.judgments.length}건이 저장된 판단과 모두 같습니다`).count()) === 1, "10 불러올 기록으로 판단을 다시 계산 → 저장된 판단과 모두 같음 (재현 확인)");
q.once("dialog", (d) => d.accept());
await q.click('button:has-text("이 백업으로 바꾸고 이어 하기")');
await q.locator("text=불러왔습니다").waitFor();
const restored = await lab(q);
check(restored.entries.length === st.entries.length && JSON.stringify(restored.judgments) === JSON.stringify(st.judgments), "10 다른 브라우저에서 불러오기 → 기록·판단 그대로");
await q.goto(APP + "/field");
check((await q.locator("tr:has-text('B현장') >> text=11:00~12:00").count()) === 1, "10 불러온 뒤 현장 실증 화면에서 이어서 시험 가능");
await q.context().close();

// ── 11) 실제 데이터 · 대리 입력 · 가상 데이터 구분 ──
await p.goto(APP + "/field");
await p.click('button:has-text("비교시험 시나리오 불러오기")');
await p.click('button:has-text("A1 (A세트)")');
await p.locator("text=비교시험 A1 시나리오를 가상 시나리오 세트로 불러왔습니다").waitFor();
st = await lab(p);
const v = st.sessions.at(-1);
check(v.kind === "가상 시나리오" && st.entries.filter((e) => e.sessionId === v.id).every((e) => e.source === "가상 시나리오"), "11 가상 시나리오 세트는 따로 (출처 '가상 시나리오')");
const realJ = st.judgments.filter((j) => j.sessionId === st.sessions[0].id);
check(realJ.every((j) => !j.story.join(" ").includes("가상 작업자")), "11 사후 재현 판단에 가상 시나리오 일정이 섞이지 않음");
check((await p.locator("text=위험 판단과 대응 우선순위").count()) >= 1 && (await p.locator("text=재현 기준시각 · 가정값").count()) >= 1, "11 가상 세트의 판단 기준시각은 '가정값'으로 표시");
await p.goto(APP + "/records");
await p.selectOption('select[aria-label="데이터 구분 거르기"]', "사후 재현");
const rowsReal = await p.locator('section[aria-label="입력 이력"] tbody tr').count();
check(rowsReal === 8, "11 입력 이력을 사후 재현만 거르면 그 세트 기록만 (8건)", String(rowsReal));
check((await p.locator('section[aria-label="입력 이력"] tbody >> text=대리').count()) >= 3, "11 대리 입력 표시");

// ── 전후 비교시험 기록 · 보고서 ──
await p.goto(APP + "/compare");
await p.click('button:has-text("새 측정 기록")');
await p.fill('input[list="scenario-options"]', "A1");
await p.click('button:has-text("1부 시작")');
await new Promise((r) => setTimeout(r, 1200));
await p.click('button:has-text("1부 끝")');
await p.fill('input[aria-label="정확히 발견한 위험"]', "1");
await p.click('button:has-text("정답표 값")');
await p.fill('input[aria-label="놓친 위험"]', "0");
await p.click('section[aria-label="측정 입력"] button:has-text("저장")');
await p.locator("text=측정 기록을 저장했습니다").waitFor();
st = await lab(p);
const t1 = st.trials[0];
check(t1.method === "수기" && t1.t1Sec >= 1 && t1.stamps.part1Start && t1.expected === 1 && t1.pairKey.includes("쌍 1"), "비교시험: 앱 측정기로 수기 측정 1회 저장 (원시 시각 포함)", `t1 ${t1.t1Sec}초`);
check((await p.locator("text=AX 방식 측정이 없어 비교값을 내지 않습니다").count()) >= 1, "비교시험: AX 측정이 없으면 비교값을 만들지 않음");
await p.goto(APP + "/records/report");
check((await p.locator("text=비교시험 1회 (수기 1 · AX 0").count()) === 1 && (await p.locator("text=예상 (이번 시험에서 측정한 값이 아님)").count()) === 1, "보고서 정리: 실측 횟수 · 예상 효과는 따로 표시");
await shot(p, "lab_report");

// ── 12) 기존 데모 화면 ──
await p.goto(APP + "/today");
check((await p.locator("h1:has-text('오늘의 업무')").count()) === 1, "12 기존 홈(오늘의 업무)은 /today 로 그대로");
await p.goto(APP + "/schedule");
check((await p.locator("text=위험 판단과 대응 우선순위").count()) >= 1, "12 기존 통합일정 위험 판단 화면 그대로");
check(p.errs.length === 0, "화면 오류 없음", p.errs.join(" | "));

// ── 실제 휴대폰 크기(390·430)에서 현장기사 화면 ──
for (const w of [390, 430]) {
  const m = await context({ width: w, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await m.goto(APP + "/records");
  await m.setInputFiles('input[aria-label="백업 JSON 파일"]', jsonPath);
  await m.locator("text=파일 지문 일치").waitFor();
  m.once("dialog", (d) => d.accept());
  await m.click('button:has-text("이 백업으로 바꾸고 이어 하기")');
  await m.locator("text=불러왔습니다").waitFor();
  await m.goto(APP + "/field?view=worker");
  await m.locator('button:has-text("김기사")').click().catch(() => {});
  await m.locator('section[aria-label="C현장 일정"]').waitFor();
  const ok = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(ok && (await m.locator('[aria-label="화면 보기"]:visible').count()) === 0, `실제 ${w}px 휴대폰: 가로 넘침 없음 · 보기 전환 버튼 없음`);
  await shot(m, `lab_phone_${w}`);
  await m.context().close();
}

await bro.close();
console.log(fails === 0 ? "모두 통과" : `실패 ${fails}건`);
process.exitCode = fails ? 1 : 0;
