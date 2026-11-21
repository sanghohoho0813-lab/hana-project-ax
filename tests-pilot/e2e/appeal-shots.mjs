// 이의신청 자료용 화면 촬영 — 핵심 사례(보령 → 홍성 → 예산)를 실제 프로그램으로 처음부터 끝까지 돌리며 찍는다 (회귀 시험 아님)
// 문제 1 보고 지연 · 문제 2 안전확인 지연 · 문제 3 다음 현장 지연 전파 — 각 문제를 프로그램이 어떤 절차로 다루는지 화면으로 남긴다.
// 실행: APPEAL_OUT=<폴더> node tests-pilot/e2e/appeal-shots.mjs   (약 45분 — '중간 확인'은 실제로 30분이 지나야 뜬다)
//       APPEAL_FAST=1 이면 30분 기다림과 중간 확인 화면을 건너뛴다 (선택자 점검용)
// 로컬 시험 DB · '검증 시나리오(가상)' 자료만 쓴다. 사람 · 현장 이름은 시험용이다. 같은 컴퓨터의 별도 브라우저 세션(관리자 PC · 기사 휴대폰)이다.
// 시각: 보령 지사 예정 시작 P(실행 시각 기준) — 핵심 사례(docs/VENTURE_CORE_CASE.md)의 09:00과 간격 · 이동시간이 같다.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, PASSWORD, adminApi, uniq, newBrowser, waitPath, adminLogin, activate, loginAs, kstDate, kstHour, psql } from "./common.mjs";

const OUT = process.env.APPEAL_OUT ?? join(tmpdir(), "appeal");
const FAST = process.env.APPEAL_FAST === "1";
mkdirSync(OUT, { recursive: true });
if (kstHour() < 5 || kstHour() >= 19) {
  // 일정이 P+290분(약 5시간)까지 이어진다 — 자정을 넘기지 않게
  console.log("한국 시각 05~19시에만 실행합니다");
  process.exit(0);
}
const D = kstDate(0);
const KIND = "scenario";
const steps = [];
let shotNo = 0;
const kst = (ms) => new Date(ms + 9 * 3600_000).toISOString().slice(11, 16);
const kstSec = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (ms) => {
  while (Date.now() < ms) await sleep(500);
};

async function step(pg, id, title, { el, top = false, full = false, wait = 600, toast = false, clip } = {}) {
  if (!toast) {
    const close = pg.locator('button[aria-label="알림 닫기"]');
    if (await close.count()) await close.first().click().catch(() => {});
  }
  // 위쪽 고정 머리띠(약 80px)에 가리지 않게 조금 더 내려 보인다
  if (el) await el.evaluate((e, t) => (e.scrollIntoView({ block: t ? "start" : "center" }), t && window.scrollBy(0, -96)), top).catch(() => {});
  await pg.evaluate(() => document.fonts.ready).catch(() => {});
  await pg.waitForTimeout(wait);
  const file = `${String(++shotNo).padStart(2, "0")}_${id}.jpg`;
  await pg.screenshot({ path: join(OUT, file), type: "jpeg", quality: 86, fullPage: full, ...(clip ? { clip } : {}) });
  steps.push({ id, title, img: file, device: pg.viewportSize().width < 600 ? "phone" : "pc", at: kstSec() });
  writeFileSync(join(OUT, "steps.json"), JSON.stringify({ date: D, P: P ? kst(P) : null, steps }, null, 1));
  console.log(`${kstSec()} [${id}] ${title}`);
}

const bro = await newBrowser();
const NAME = { admin: "김관리", w1: "김현장" };
const S = { A: "보령 지사", B: "홍성 물류센터", C: "예산 매장" };
let P = 0;

// ── 준비: 관리자(2단계 인증) · 현장기사 1명 ──
const e1 = uniq("appeal1");
await adminApi.auth.admin.createUser({ email: e1, password: PASSWORD, email_confirm: true });
const { p: a0 } = await adminLogin(bro, NAME.admin);
await activate(a0, e1, NAME.w1);
const actx = await bro.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, storageState: await a0.context().storageState() });
const admin = await actx.newPage();
const mctx = await bro.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m1 = await mctx.newPage();
const PHOTO = join(tmpdir(), "appeal-photo.jpg");
// 시험용 이미지 — 실제 현장사진이 아님
await a0.setContent(`<div style="width:640px;height:480px;background:linear-gradient(135deg,#c7d2fe,#e0e7ff);display:flex;align-items:center;justify-content:center;font:700 40px sans-serif;color:#3730a3">시험용 이미지</div>`);
writeFileSync(PHOTO, await a0.screenshot({ type: "jpeg", quality: 70, clip: { x: 0, y: 0, width: 640, height: 480 } }));

const board = `${APP}/pilot/admin/schedule?date=${D}&kind=${KIND}`;
const dash = `${APP}/pilot/admin?date=${D}&kind=${KIND}`;
const casesUrl = `${APP}/pilot/admin/cases?date=${D}&kind=${KIND}`;
const safetyUrl = `${APP}/pilot/admin/safety?date=${D}&kind=${KIND}`;
const fieldUrl = `${APP}/pilot/field?date=${D}&kind=${KIND}`;

// 보령 예정 시작 P = 지금부터 약 3분 뒤 정각 분 (기사가 시작 전 점검을 먼저 내고, P 분에 작업 시작을 누른다)
P = Math.ceil((Date.now() + 150_000) / 60_000) * 60_000;
const at = (min) => kst(P + min * 60_000);

async function addSchedule(site, start, end, travel = "") {
  const form = () => admin.locator('form:has(button:has-text("일정 등록"))').first();
  if ((await form().count()) === 0) await admin.click('button:has-text("일정 등록")');
  const f = form();
  await f.locator("select[name=assignee_id]").selectOption({ label: NAME.w1 });
  await f.locator("input[name=site_name]").fill(site);
  await f.locator("input[name=planned_start]").fill(start);
  await f.locator("input[name=planned_end]").fill(end);
  await f.locator("input[name=travel_minutes]").fill(travel);
  await f.locator('button:has-text("일정 등록")').click();
  await f.locator("[role=status], [role=alert]").waitFor();
  await admin.locator(`tr:has-text("${site}")`).first().waitFor();
}
const caseCard = () => admin.locator(`section[aria-label="처리 중 지원 요청"] li[aria-label^="사건 "]:has-text("${S.A}")`).first();
async function act(card, button, fill, shot) {
  await card.locator(`button:text-is("${button}")`).click();
  const f = card.locator('[aria-label$=" 입력"]');
  if (fill) await fill(f);
  if (shot) await step(admin, shot.id, shot.title, { el: f });
  await f.locator('button:text-is("기록")').click();
  await card.locator('[aria-label$=" 입력"]').waitFor({ state: "detached", timeout: 20000 });
  await admin.waitForTimeout(500);
}
const items3 = async (panel, bad = null) => {
  for (const it of ["안전모 착용", "안전화 착용", "작업구역 표시·통제"]) await panel.locator(`li[aria-label="${it}"] button:text-is("${it === bad ? "미흡" : "확인"}")`).click();
};

try {
  /* ═════ 준비: 일정 3건 (핵심 사례와 같은 간격) ═════ */
  await admin.goto(board);
  await addSchedule(S.A, at(0), at(60));
  await addSchedule(S.B, at(90), at(150), "20");
  await addSchedule(S.C, at(180), at(230), "25");
  await step(admin, "setup_board", "관리자 일정판 — 김현장 기사 하루 3곳", { el: admin.locator(`tr:has-text("${S.C}")`).first() });

  /* ═════ 문제 2 (작업 전): 안전점검이 먼저 ═════ */
  await loginAs(m1, e1);
  await waitPath(m1, "/pilot/field");
  await m1.goto(fieldUrl);
  await m1.locator('section[aria-label="지금 할 일"]').waitFor();
  await step(m1, "p2_field_first", "기사 첫 화면 — ① 시작 전 안전점검 → ② 작업 시작");
  const card = m1.locator(`section[aria-label="${S.A} 일정"]`);
  await card.locator('button:has-text("업무 확인")').click();
  await m1.locator(`[role=status]:has-text("${S.A} 업무 확인 기록됨")`).waitFor();
  await m1.waitForTimeout(700);
  await m1.locator('div.fixed button:has-text("작업 시작")').first().click();
  const gate = m1.locator('[role=dialog][aria-label="안전점검 확인"]');
  await gate.waitFor();
  await step(m1, "p2_gate_start", "점검 없이 '작업 시작'을 누르면 먼저 묻는다");
  await gate.locator('button:has-text("시작 전 점검 하기")').click();
  const pre = card.locator('[aria-label="시작 전 점검"]');
  await pre.waitFor();
  await items3(pre);
  await pre.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
  await pre.locator('ul[aria-label="첨부할 사진"] img').waitFor();
  await step(m1, "p2_pre_check", "시작 전 안전점검 — 항목 확인 + 착용 사진", { el: pre.locator('ul[aria-label="첨부할 사진"]') });
  await pre.locator('button:has-text("시작 전 점검 제출")').click();
  await card.locator('[aria-label="안전점검"] button:has-text("시작 전 점검") >> text=확인 대기').waitFor({ timeout: 30000 });

  // 예정 시작 분이 되면 작업 시작 (예정 시작 = 실제 시작 → 핵심 사례와 같은 계산)
  await until(P + 2000);
  await m1.locator('div.fixed button:has-text("작업 시작")').first().click();
  await m1.locator(`[role=status]:has-text("${S.A} 작업 시작 기록됨")`).waitFor();
  await m1.evaluate(() => window.scrollTo(0, 0));
  await step(m1, "p2_started", "점검을 낸 뒤 작업 시작 — 바로 기록", { toast: true });

  // 관리자: 시작 전 점검 사진 육안 확인
  await admin.goto(safetyUrl);
  const preLi = admin.locator(`li[aria-label^="안전점검 "]:has-text("${S.A}"):has(button:has-text("적합 (육안)"))`).first();
  await preLi.waitFor();
  await step(admin, "p2_admin_review", "안전관리 — 시작 전 점검 사진 확인 대기", { el: preLi, top: true });
  await admin.waitForTimeout(800);
  await preLi.locator('button:has-text("적합 (육안)")').click({ timeout: 15000 });
  await admin.locator('[role=status]:has-text("적합(육안 확인)")').first().waitFor();
  await admin.goto(safetyUrl);
  await step(admin, "p2_admin_stage1", "현장별 3단계 현황 — 시작 전 '적합(육안)'", { el: admin.locator('section[aria-label="현장별 3단계 현황"]'), top: true });

  /* ═════ 문제 1: 30분째 진행 보고가 없으면 시스템이 먼저 묻는다 ═════ */
  if (!FAST) {
    console.log(`${kstSec()} 중간 확인 시각(${at(30)})까지 기다림`);
    await until(P + 30 * 60_000 + 4000);
    await m1.goto(fieldUrl);
    const ask = m1.locator('[aria-label="진행 확인"]');
    await ask.waitFor({ timeout: 30000 });
    await m1.evaluate(() => window.scrollTo(0, 0));
    await step(m1, "p1_field_ask", "30분째 진행 보고 없음 — 휴대폰이 먼저 묻는다");
    await admin.goto(dash);
    const w = admin.locator('section[aria-label="연락 없이 늦어지는 현장"]');
    await w.waitFor();
    await step(admin, "p1_admin_watch", "관리자 대시보드 — 연락 없이 늦어지는 현장 (중간 확인)", { el: w, top: true });
    await step(admin, "p1_admin_watch_full", "관리자 대시보드 전체 — 안전 · 연락 없이 늦어짐이 맨 앞", { full: true });
    await ask.locator('button:has-text("막혔어요")').click();
  } else {
    await m1.evaluate(() => window.scrollTo(0, 0));
    await m1.locator('section[aria-label="지금 할 일"] button:has-text("문제 보고")').click();
  }

  /* ═════ 문제 1: 문제 보고 · 지원 요청 (터치로 6단계) ═════ */
  const sh = card.locator('[aria-label="현장 문제 보고"]');
  await sh.waitFor();
  await sh.locator('[aria-label="문제 유형"] button:text-is("예상과 다른 설치환경")').click();
  await step(m1, "p1_report_type", "문제 보고 ① 유형 — 예상과 다른 설치환경", { el: sh.locator('[aria-label="문제 유형"]') });
  await sh.locator('[aria-label="지금 작업 진행상황"] button:text-is("분해·설치 시작 후")').click();
  await sh.locator('[aria-label="문제 발견시각"] button:text-is("10분 전")').click();
  await step(m1, "p1_report_state", "② 지금 상태 · 문제를 처음 발견한 시각", { el: sh.locator('[aria-label="문제 발견시각"]') });
  await sh.locator('[aria-label="요청 (여러 개 가능)"] button:text-is("숙련 기술자 지원")').click();
  await sh.locator('[aria-label="변경 예상 종료"] button:text-is("+1시간")').click();
  await step(m1, "p1_report_need_end", "③ 필요한 지원 · ④ 바뀐 예상 종료", { el: sh.locator('[aria-label="변경 예상 종료"]') });
  await sh.locator('input[aria-label="현장 사진"]').setInputFiles(PHOTO);
  await sh.locator('ul[aria-label="첨부할 사진"] img').waitFor();
  await step(m1, "p1_report_photo", "⑤ 사진 (촬영정보 지우고 비공개 저장)", { el: sh.locator('ul[aria-label="첨부할 사진"]') });
  await sh.locator('button:has-text("보고 보내기")').click();
  await card.locator('[role=status]:has-text("보고됨")').waitFor({ timeout: 30000 });
  await step(m1, "p1_report_sent", "⑥ 보고 완료 — 사건번호 · 본사 확인 전", { el: card.locator('section[aria-label^="사건 "]').first() });

  /* ═════ 본사: 우선 확인 · 다음 현장 영향 (문제 1 · 3) ═════ */
  await admin.goto(dash);
  await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
  await step(admin, "p13_admin_dash", "관리자 대시보드 — 새 보고 · 다음 현장 지연 위험", { full: true });
  await admin.goto(casesUrl);
  const c1 = caseCard();
  await c1.waitFor();
  await step(admin, "p13_case_card", "문제·지원 — 우선 확인 이유(지원 요청 · 후속 현장 위험 계산값)", { el: c1, top: true });
  const detailHref = await c1.locator('a[href*="/pilot/admin/cases/"]').first().getAttribute("href");
  await admin.goto(`${APP}${detailHref}`);
  await admin.locator('section[aria-label="사건 한눈에"]').waitFor();
  await step(admin, "p3_chain_report", "사건 상세 — 보고 직후 연쇄 영향 (보령 → 홍성 → 예산)", { el: admin.locator('[aria-label="연쇄 영향 그림"]') });

  await admin.goto(casesUrl);
  await c1.waitFor();
  await act(c1, "접수");
  await act(c1, "지원 결정", (f) => f.locator('[aria-label="지원 조치"] button:text-is("숙련 직원 투입")').click(), { id: "p1_admin_support", title: "접수 → 지원 결정 (숙련 직원 투입)" });
  await act(c1, "현장 전달", (f) => f.locator('input[aria-label="내용"]').fill("숙련 기술자가 30분 안에 도착합니다. 분해 상태 그대로 두세요."), { id: "p1_admin_deliver", title: "현장 전달 — 기사에게 보낼 말" });
  await m1.goto(fieldUrl);
  await m1.locator('section[aria-label="본사 메시지"]').waitFor({ timeout: 30000 });
  await step(m1, "p1_field_hq", "기사 휴대폰 — 본사에서 온 소식", { el: m1.locator('section[aria-label="본사 메시지"]') });

  /* ═════ 문제 3: 일정 조정 → 재판단 (1차 · 2차) ═════ */
  await admin.goto(casesUrl);
  await c1.waitFor();
  await act(
    c1,
    "일정 조정",
    async (f) => {
      const opt = await f.locator('select[aria-label="조정할 일정"] option', { hasText: S.B }).getAttribute("value");
      await f.locator('select[aria-label="조정할 일정"]').selectOption(opt);
      await f.locator('input[aria-label="새 예정 시작"]').fill(at(145));
      await f.locator('input[aria-label="새 예정 종료"]').fill(at(205));
      await f.locator('input[aria-label="내용"]').fill("보령 지원으로 홍성 시작 조정 (고객 연락 완료)");
    },
    { id: "p3_adjust1_form", title: "1차 조치 — 홍성 물류센터 시작을 늦춤" },
  );
  await step(admin, "p3_adjust1_result", "1차 조치 직후 재판단 — 풀린 위험 · 남은 위험", { el: admin.locator('section[aria-label="처리 중 지원 요청"] [role=status]').first(), toast: true });
  await act(
    c1,
    "일정 조정",
    async (f) => {
      const opt = await f.locator('select[aria-label="조정할 일정"] option', { hasText: S.C }).getAttribute("value");
      await f.locator('select[aria-label="조정할 일정"]').selectOption(opt);
      await f.locator('input[aria-label="새 예정 시작"]').fill(at(240));
      await f.locator('input[aria-label="새 예정 종료"]').fill(at(290));
      await f.locator('input[aria-label="내용"]').fill("예산 매장 고객 연락 후 시작 조정");
    },
    { id: "p3_adjust2_form", title: "2차 조치 — 예산 매장 시작을 늦춤" },
  );
  await step(admin, "p3_adjust2_result", "2차 조치 직후 재판단 — 남은 위험 0", { el: admin.locator('section[aria-label="처리 중 지원 요청"] [role=status]').first(), toast: true });
  await admin.goto(`${APP}${detailHref}`);
  await admin.locator('section[aria-label="사건 한눈에"]').waitFor();
  await step(admin, "p3_case_summary", "사건 상세 — 조치로 풀린 위험 / 남은 위험", { el: admin.locator('section[aria-label="사건 한눈에"]'), top: true });
  await step(admin, "p3_chain_after", "연쇄 영향 그림 — 보고 직후 vs 조치 후", { el: admin.locator('[aria-label="연쇄 영향 그림"]') });
  await admin.goto(board);
  await admin.locator(`tr:has-text("${S.C}")`).first().waitFor();
  await step(admin, "p3_board_after", "일정판 — 조정된 시각과 다음 현장 판단", { el: admin.locator(`tr:has-text("${S.C}")`).first() });
  await m1.goto(fieldUrl);
  await m1.locator(`section[aria-label="${S.B} 일정"]`).waitFor();
  await step(m1, "p3_field_next", "기사 휴대폰 — 조정된 다음 현장 시각", { el: m1.locator(`section[aria-label="${S.B} 일정"]`), top: true });

  /* ═════ 문제 2 (작업 중): 진행 중 점검 '미흡' → 보완 요청 → 보완 → 조치 완료 ═════ */
  await m1.evaluate(() => window.scrollTo(0, 0));
  await card.locator('[aria-label="안전점검"] button:has-text("진행 중 점검")').click();
  const mid = card.locator('[aria-label="진행 중 점검"]');
  await mid.waitFor();
  await items3(mid, "작업구역 표시·통제");
  await step(m1, "p2_mid_deficient", "진행 중 점검 — '미흡'이면 작업 멈춤 · 직접 전화 안내", { el: mid.locator("[role=alert]").first() });
  await mid.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
  await mid.locator('ul[aria-label="첨부할 사진"] img').waitFor();
  await mid.locator('button:has-text("진행 중 점검 제출")').click();
  await card.locator('[aria-label="안전점검"] [role=status]').first().waitFor({ timeout: 30000 });
  await m1.waitForTimeout(1500);
  const midNo = psql(`select c.check_no from safety_checks c join schedules s on s.id = c.schedule_id where s.site_name = '${S.A}' and s.work_date = '${D}' and c.stage = '작업 중' order by c.recorded_at desc limit 1;`);
  await admin.goto(dash);
  await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
  await step(admin, "p2_admin_dash_safety", "관리자 대시보드 — 안전 확인 필요(1순위)에 미흡", { el: admin.locator('section[aria-label="안전 확인 필요"]'), top: true });
  await admin.goto(safetyUrl);
  const midLi = admin.locator(`li[aria-label="안전점검 ${midNo}"]`);
  await midLi.waitFor();
  await midLi.locator('input[aria-label="보완할 내용"]').fill("작업구역 통제선 설치 후 사진 다시 보내 주세요");
  await step(admin, "p2_admin_supp_req", "미흡 점검 — '적합'은 막히고 보완 요청만", { el: midLi });
  await midLi.locator('button:text-is("보완 요청")').click();
  await midLi.locator('[role=status]:has-text("보완 요청")').waitFor();
  await m1.goto(fieldUrl);
  await m1.locator('section[aria-label="본사 메시지"]').waitFor({ timeout: 30000 });
  const sup = card.locator('[aria-label^="보완 요청 "]').first();
  await sup.waitFor();
  await sup.locator('input[aria-label="보완 사진"]').setInputFiles(PHOTO);
  await sup.locator('input[aria-label="보완한 내용"]').fill("통제선 설치 완료");
  await sup.locator('ul[aria-label="첨부할 사진"] img').waitFor();
  await step(m1, "p2_field_supp", "보완 요청 도착 → 보완 사진 · 내용 제출", { el: sup });
  await sup.locator('button:has-text("보완 제출")').click();
  await card.locator('[aria-label="안전점검"] [role=status]:has-text("보완 제출")').waitFor({ timeout: 30000 });
  await admin.goto(safetyUrl);
  await midLi.waitFor();
  await midLi.locator('button:has-text("조치 완료")').click();
  await midLi.locator('[role=status]:has-text("조치 완료")').waitFor();
  await step(admin, "p2_admin_supp_done", "보완 확인 → 조치 완료 (확인 이력이 남음)", { el: midLi });

  /* ═════ 마무리: 해결 보고 · 마무리 점검 · 작업 종료 · 해결 확인 ═════ */
  await m1.goto(fieldUrl);
  const my = card.locator('section[aria-label^="사건 "]').first();
  await my.waitFor();
  await my.locator('button:has-text("해결 보고")').click();
  await my.locator('[aria-label="해결 여부"] button:text-is("해결")').click();
  await my.locator('input[aria-label="해결 내용"]').fill("숙련 기술자와 함께 배선 경로 변경, 설치 완료");
  await my.locator('button:has-text("해결 보고 보내기")').click();
  await card.locator('[role=status]:has-text("해결 보고됨")').waitFor();
  const m0 = new Date().getUTCMinutes();
  while (new Date().getUTCMinutes() === m0) await sleep(500);
  await sleep(1500);
  await m1.locator('div.fixed button:has-text("작업 종료")').first().click();
  await gate.waitFor();
  await step(m1, "p2_gate_end", "마무리 점검 없이 '작업 종료'를 누르면 먼저 묻는다");
  await gate.locator('button:has-text("마무리 점검 하기")').click();
  const fin = card.locator('[aria-label="마친 뒤 점검"]');
  await fin.waitFor();
  await items3(fin);
  await fin.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
  await fin.locator('ul[aria-label="첨부할 사진"] img').waitFor();
  await fin.locator('button:has-text("마친 뒤 점검 제출")').click();
  await card.locator('[aria-label="안전점검"] button:has-text("마친 뒤 점검") >> text=확인 대기').waitFor({ timeout: 30000 });
  await m1.locator('div.fixed button:has-text("작업 종료")').first().click();
  await m1.locator(`[role=status]:has-text("${S.A} 작업 종료 기록됨")`).waitFor();
  await m1.evaluate(() => window.scrollTo(0, 0));
  await step(m1, "p2_ended", "마무리 점검 → 작업 종료", { toast: true });

  await admin.goto(casesUrl);
  await c1.waitFor();
  await act(c1, "해결 확인");
  for (let k = 0; k < 3; k++) {
    await admin.goto(safetyUrl);
    const next = admin.locator(`li[aria-label^="안전점검 "]:has-text("${S.A}"):has(button:has-text("적합 (육안)"))`).first();
    if ((await next.count()) === 0) break;
    const label = await next.getAttribute("aria-label");
    await admin.waitForTimeout(800);
    await admin.locator(`li[aria-label="${label}"] button:has-text("적합 (육안)")`).click({ timeout: 15000 });
    await admin.locator(`li[aria-label="${label}"] [role=status]:has-text("적합(육안 확인)")`).waitFor();
  }
  await admin.goto(safetyUrl);
  await step(admin, "p2_admin_stage3", "현장별 3단계 현황 — 시작 전 · 진행 중 · 마친 뒤", { el: admin.locator('section[aria-label="현장별 3단계 현황"]'), top: true });

  await admin.goto(`${APP}${detailHref}`);
  await admin.locator('section[aria-label="사건 한눈에"]').waitFor();
  await step(admin, "ev_case_top", "사건 상세 — 처리 흐름(시각 기록)", { el: admin.locator('section[aria-label="사건 한눈에"]'), top: true });
  await step(admin, "ev_case_print", "사건 증빙 — 핵심 흐름 요약", { el: admin.locator('section[aria-label="핵심 흐름 요약"]'), top: true });
  await admin.goto(`${APP}/pilot/admin/measures?kind=${KIND}`);
  await admin.waitForLoadState("domcontentloaded");
  await step(admin, "ev_measures", "성과 측정 — 측정 항목 (이 시험 기록 기준)", { full: true });
  await admin.goto(dash);
  await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
  await step(admin, "ev_dash_end", "하루 마감 대시보드", { full: true });
} catch (e) {
  console.log("오류:", e.message);
  for (const [n, pg] of [["admin", admin], ["phone", m1]]) await pg.screenshot({ path: join(OUT, `zz_error_${n}.jpg`), type: "jpeg", fullPage: true }).catch(() => {});
  process.exitCode = 1;
}
writeFileSync(join(OUT, "steps.json"), JSON.stringify({ date: D, P: kst(P), steps, cases: psql(`select string_agg(case_no || ':' || status, ',' order by case_no) from field_cases where work_date = '${D}' and data_kind = '검증 시나리오';`) }, null, 1));
await bro.close();
console.log("완료", OUT, steps.length, "장");
