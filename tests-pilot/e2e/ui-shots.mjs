// 0.4.0 UI 개편 — 화면 사진 만들기 (회귀 시험이 아님 · 로컬 시험 DB의 '검증 시나리오' 데이터로만 찍는다)
// 실행: node tests-pilot/e2e/ui-shots.mjs  →  docs/evidence/ui-0.4.0/*.png
// 사람·현장 이름은 모두 시험용이다. 같은 컴퓨터의 별도 브라우저 세션이며 실제 휴대폰 시험이 아니다.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, PASSWORD, adminApi, uniq, newBrowser, mobilePage, page, waitPath, adminLogin, activate, createSchedule, loginAs, kstHHMM, kstDate } from "./common.mjs";

const OUT = process.env.UI_SHOTS_OUT ?? "docs/evidence/ui-0.4.0";
mkdirSync(OUT, { recursive: true });
const RUN = String(Date.now()).slice(-4);
const D = kstDate(0);
const SA = `보령 지사 ${RUN}`, SB = `홍성 물류센터 ${RUN}`, SC = `예산 매장 ${RUN}`;
const NA = `박현장${RUN}`;
const snap = async (p, name, full = false) => {
  await p.waitForTimeout(450);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("shot", name);
};

const bro = await newBrowser();
const fa = uniq("shota");
await adminApi.auth.admin.createUser({ email: fa, password: PASSWORD, email_confirm: true });
const { p: admin0 } = await adminLogin(bro, `본사${RUN}`);
await activate(admin0, fa, NA);
await admin0.goto(`${APP}/pilot/admin/schedule?date=${D}&kind=scenario`);
await createSchedule(admin0, { who: NA, site: SA, start: kstHHMM(-20), end: kstHHMM(40) });
await createSchedule(admin0, { who: NA, site: SB, start: kstHHMM(55), end: kstHHMM(115), travel: "20" });
await createSchedule(admin0, { who: NA, site: SC, start: kstHHMM(135), end: kstHHMM(185), travel: "25", prio: "긴급" });
// PC 화면은 1440 폭 · 2배율로 다시 연다 (같은 세션 쿠키)
const state = await admin0.context().storageState();
const actx = await bro.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, storageState: state });
await actx.route(/jsdelivr/, (r) => r.abort());
const admin = await actx.newPage();

const PHOTO = join(tmpdir(), `ui-shot-${RUN}.jpg`);
writeFileSync(PHOTO, await admin0.screenshot({ type: "jpeg", quality: 60, clip: { x: 0, y: 0, width: 640, height: 480 } }));

// ── 현장기사 휴대폰 ──
const m = await mobilePage(bro);
await loginAs(m, fa);
await waitPath(m, "/pilot/field");
const fieldUrl = `${APP}/pilot/field?date=${D}&kind=scenario`;
await m.goto(fieldUrl);
await m.locator('section[aria-label="지금 할 일"]').waitFor();
await snap(m, "m01_field_today");
const cardA = m.locator(`section[aria-label="${SA} 일정"]`);
await cardA.locator('button:has-text("업무 확인")').click();
await m.locator(`[role=status]:has-text("${SA} 업무 확인 기록됨")`).waitFor();
await cardA.locator('button:has-text("작업 시작")').click();
await m.locator('[role=dialog][aria-label="안전점검 확인"] button:has-text("점검 없이 시작")').click({ timeout: 5000 }).catch(() => {}); // 0.6.0 안전 1순위 확인
await m.locator(`[role=status]:has-text("${SA} 작업 시작 기록됨")`).waitFor();
await m.waitForTimeout(1200);
await m.evaluate(() => window.scrollTo(0, 0));
await snap(m, "m02_field_working");
await snap(m, "m02_field_today_full", true);

// 문제 보고 — 첫 화면 빠른 버튼 → 단계형 보고
await m.locator('section[aria-label="지금 할 일"] button:has-text("문제 보고")').click();
const sheet = cardA.locator('[aria-label="현장 문제 보고"]');
await sheet.waitFor();
await snap(m, "m03_report_step1");
await sheet.locator('[aria-label="문제 유형"] button:text-is("예상과 다른 설치환경")').click();
await sheet.locator('[aria-label="지금 작업 진행상황"] button:text-is("분해·설치 시작 후")').click();
await sheet.locator('[aria-label="요청 (여러 개 가능)"] button:text-is("숙련 기술자 지원")').click();
await sheet.locator('[aria-label="변경 예상 종료"] button:text-is("+1시간")').click();
await sheet.locator('input[aria-label="현장 사진"]').setInputFiles(PHOTO);
await sheet.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await sheet.locator('ul[aria-label="첨부할 사진"]').scrollIntoViewIfNeeded();
await snap(m, "m04_report_photo");
await sheet.locator('button:has-text("보고 보내기")').click();
await cardA.locator('[role=status]:has-text("보고됨")').waitFor({ timeout: 30000 });
await m.waitForTimeout(800);

// 안전점검 — 첫 화면 빠른 버튼 → 시작 전 점검
await m.evaluate(() => window.scrollTo(0, 0));
await m.locator('section[aria-label="지금 할 일"] button:has-text("안전점검")').click();
const sp = cardA.locator('[aria-label="시작 전 점검"]');
await sp.waitFor();
for (const it of ["안전모 착용", "안전화 착용", "작업구역 표시·통제"]) await sp.locator(`li[aria-label="${it}"] button:text-is("확인")`).click();
await sp.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
await sp.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await sp.scrollIntoViewIfNeeded();
await snap(m, "m05_safety_check");
await sp.locator('button:has-text("시작 전 점검 제출")').click();
await cardA.locator('[aria-label="안전점검"] [role=status]').waitFor({ timeout: 30000 });

// ── 본사 PC ──
await admin.goto(`${APP}/pilot/admin?date=${D}&kind=scenario`);
await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
await snap(admin, "pc01_dashboard");
await admin.goto(`${APP}/pilot/admin/cases?date=${D}&kind=scenario`);
const caseCard = admin.locator(`section[aria-label="처리 중 지원 요청"] li[aria-label^="사건 "]:has-text("${SA}")`).first();
await caseCard.waitFor();
await snap(admin, "pc02_cases");
async function act(button, fill) {
  await caseCard.locator(`button:text-is("${button}")`).click();
  const f = caseCard.locator('[aria-label$=" 입력"]');
  if (fill) await fill(f);
  await f.locator('button:text-is("기록")').click();
  await caseCard.locator('[aria-label$=" 입력"]').waitFor({ state: "detached", timeout: 15000 });
}
await act("접수");
await act("지원 결정", (f) => f.locator('[aria-label="지원 조치"] button:text-is("숙련 직원 투입")').click());
await act("현장 전달", (f) => f.locator('input[aria-label="내용"]').fill("숙련 기술자가 30분 안에 도착합니다. 분해 상태 그대로 두세요."));
await act("일정 조정", async (f) => {
  const opt = await f.locator('select[aria-label="조정할 일정"] option', { hasText: SB }).getAttribute("value");
  await f.locator('select[aria-label="조정할 일정"]').selectOption(opt);
  await f.locator('input[aria-label="새 예정 시작"]').fill(kstHHMM(120));
  await f.locator('input[aria-label="새 예정 종료"]').fill(kstHHMM(170));
  await f.locator('input[aria-label="내용"]').fill("지원으로 다음 현장 시작 조정 (고객 연락)");
});
await admin.waitForTimeout(1500);
const href = await caseCard.locator('a:has-text("사건 증빙")').getAttribute("href");
await admin.goto(`${APP}${href.split("?")[0]}`);
await admin.locator('section[aria-label="사건 한눈에"]').waitFor();
await snap(admin, "pc03_case_detail");
await admin.locator('[aria-label="연쇄 영향 그림"]').scrollIntoViewIfNeeded();
await admin.locator('section[aria-label="사건 한눈에"] > div').last().screenshot({ path: `${OUT}/pc03b_risk_chain.png` });
await snap(admin, "pc03_case_detail_full", true);
await admin.goto(`${APP}/pilot/admin/safety?date=${D}&kind=scenario`);
await snap(admin, "pc04_safety");
await admin.goto(`${APP}/pilot/admin/schedule?date=${D}&kind=scenario`);
await snap(admin, "pc05_schedule");
await admin.goto(`${APP}/pilot/admin/measures?kind=scenario`);
await snap(admin, "pc06_measures");
await admin.goto(`${APP}/pilot/admin?date=${D}&kind=scenario`);
await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
await snap(admin, "pc07_dashboard_after");

// ── 현장 휴대폰: 본사 조치 반영 · 탭 ──
await m.goto(fieldUrl);
await m.locator('section[aria-label="본사 메시지"]').waitFor({ timeout: 30000 });
await snap(m, "m06_field_hq_message");
for (const [tab, name] of [["문제 보고", "m07_tab_report"], ["안전점검", "m08_tab_safety"], ["내 기록", "m09_tab_records"]]) {
  await m.locator(`nav[aria-label="현장 메뉴"] button:has-text("${tab}")`).click();
  await snap(m, name);
}

// ── 관리자 모바일 폭 ──
const am = await bro.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: state });
const amp = await am.newPage();
await amp.goto(`${APP}/pilot/admin?date=${D}&kind=scenario`);
await amp.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
await snap(amp, "m10_admin_dashboard_mobile");

// ── 브라우저 저장 실증판: PC+Mobile 동시보기 (같은 브라우저 안 두 화면 — 실제 다른 기기 시험 아님) ──
const lab = await page(bro, { width: 1600, height: 1000 });
await lab.goto(`${APP}/field`);
await lab.locator('[aria-label="화면 보기"]').waitFor();
await lab.click('[aria-label="화면 보기"] button >> text="PC+Mobile"');
await lab.locator('[data-pane="pc"]').waitFor();
await lab.waitForTimeout(2500);
await snap(lab, "pc09_lab_pc_mobile");

// ── 로그인 화면 ──
const lp = await page(bro, { width: 1280, height: 800 });
await lp.goto(`${APP}/pilot/login`);
await snap(lp, "pc08_login");
const lm = await mobilePage(bro);
await lm.goto(`${APP}/pilot/login`);
await snap(lm, "m11_login");

await bro.close();
console.log("완료", OUT);
