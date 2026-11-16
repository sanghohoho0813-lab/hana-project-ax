// 화면 흐름 둘러보기 — 시험 사례 2개를 처음부터 끝까지 실제로 돌리며 단계마다 화면을 찍는다 (회귀 시험 아님)
// 실행: WALK_OUT=<폴더> node tests-pilot/e2e/walkthrough.mjs  →  <폴더>/*.jpg · steps.json
// 로컬 시험 DB · '검증 시나리오(가상)' 자료만 쓴다. 사람 · 현장 이름은 시험용이다.
// 같은 컴퓨터의 별도 브라우저 세션(관리자 PC 1 · 기사 휴대폰 2)이며 실제 휴대폰 시험이 아니다.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, PASSWORD, adminApi, uniq, newBrowser, mobilePage, waitPath, adminLogin, activate, loginAs, kstHHMM, kstDate, psql } from "./common.mjs";

const OUT = process.env.WALK_OUT ?? join(tmpdir(), "walkthrough");
mkdirSync(OUT, { recursive: true });
const D = kstDate(0);
const KIND = "scenario";
const steps = [];
let shotNo = 0;

/** 단계 하나 — 화면을 찍고 설명을 남긴다 */
async function step(pg, s, { el, top = false, full = false, wait = 500, toast = false } = {}) {
  // 결과 알림(아래 검은 띠)이 화면을 가리지 않게 닫는다 — 알림 자체를 보여 줄 단계만 남긴다
  if (!toast) {
    const close = pg.locator('button[aria-label="알림 닫기"]');
    if (await close.count()) await close.first().click().catch(() => {});
  }
  if (el) await el.evaluate((e, t) => e.scrollIntoView({ block: t ? "start" : "center" }), top).catch(() => {});
  await pg.waitForTimeout(wait);
  const file = `${String(++shotNo).padStart(2, "0")}_${s.scenario}.jpg`;
  await pg.screenshot({ path: join(OUT, file), type: "jpeg", quality: 82, fullPage: full });
  steps.push({ ...s, img: file, device: pg.viewportSize().width < 600 ? "phone" : "pc" });
  console.log(`[${s.scenario}] ${s.title}`);
}

/**
 * 엔진은 분 단위로 계산한다. 자동 실행은 몇 초 만에 지나가므로, 실제 현장처럼 분이 바뀐 뒤에 다음 기록을 남겨야 하는 곳에서 기다린다:
 * 작업 시작과 같은 분의 작업 종료는 '시간 역행'으로 쓰지 않고, 같은 분의 예상 종료 보고 두 건은 어느 쪽을 쓸지 정해지지 않는다.
 */
async function nextMinute() {
  const m = new Date().getUTCMinutes();
  while (new Date().getUTCMinutes() === m) await new Promise((r) => setTimeout(r, 500));
  await new Promise((r) => setTimeout(r, 1500));
}

const bro = await newBrowser();
const NAME = { admin: "김관리", w1: "김현장", w2: "이현장" };
const S = { A: "보령 지사", B: "홍성 물류센터", C: "예산 매장", D: "청주 사옥", E: "증평 매장" };

// ── 준비: 관리자 계정(2단계 인증) · 현장기사 2명 활성화 ──
const e1 = uniq("walk1"), e2 = uniq("walk2");
for (const e of [e1, e2]) await adminApi.auth.admin.createUser({ email: e, password: PASSWORD, email_confirm: true });
const { p: a0 } = await adminLogin(bro, NAME.admin);
await activate(a0, e1, NAME.w1);
await activate(a0, e2, NAME.w2);
const state = await a0.context().storageState();
const actx = await bro.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, storageState: state });
await actx.route(/jsdelivr/, (r) => r.abort());
const admin = await actx.newPage();
const PHOTO = join(tmpdir(), `walk-photo.jpg`);
// 시험용 이미지 — 실제 현장사진이 아님 (단색 배경에 글자)
await a0.setContent(`<div style="width:640px;height:480px;background:linear-gradient(135deg,#c7d2fe,#e0e7ff);display:flex;align-items:center;justify-content:center;font:700 40px sans-serif;color:#3730a3">시험용 이미지</div>`);
writeFileSync(PHOTO, await a0.screenshot({ type: "jpeg", quality: 70, clip: { x: 0, y: 0, width: 640, height: 480 } }));

const board = `${APP}/pilot/admin/schedule?date=${D}&kind=${KIND}`;
const dash = `${APP}/pilot/admin?date=${D}&kind=${KIND}`;
const casesUrl = `${APP}/pilot/admin/cases?date=${D}&kind=${KIND}`;
const safetyUrl = `${APP}/pilot/admin/safety?date=${D}&kind=${KIND}`;
const fieldUrl = `${APP}/pilot/field?date=${D}&kind=${KIND}`;

async function addSchedule(who, site, start, end, travel = "", { shot } = {}) {
  const form = () => admin.locator('form:has(button:has-text("일정 등록"))').first();
  if ((await form().count()) === 0) await admin.click('button:has-text("일정 등록")');
  const f = form();
  await f.locator("select[name=assignee_id]").selectOption({ label: who });
  await f.locator("input[name=site_name]").fill(site);
  await f.locator("input[name=planned_start]").fill(start);
  await f.locator("input[name=planned_end]").fill(end);
  await f.locator("input[name=travel_minutes]").fill(travel);
  if (shot) await step(admin, shot, { el: f });
  await f.locator('button:has-text("일정 등록")').click();
  await f.locator("[role=status], [role=alert]").waitFor();
  await admin.locator(`tr:has-text("${site}")`).first().waitFor();
}
const caseCard = (site) => admin.locator(`section[aria-label="처리 중 지원 요청"] li[aria-label^="사건 "]:has-text("${site}")`).first();
async function act(card, button, fill, shot) {
  await card.locator(`button:text-is("${button}")`).click();
  const f = card.locator('[aria-label$=" 입력"]');
  if (fill) await fill(f);
  if (shot) await step(admin, shot, { el: f });
  await f.locator('button:text-is("기록")').click();
  await card.locator('[aria-label$=" 입력"]').waitFor({ state: "detached", timeout: 20000 });
  await admin.waitForTimeout(400);
}

/* ═══════════════ 사례 1 — 설치환경 문제 → 숙련 기술자 지원 → 다음 현장 일정 조정 ═══════════════ */
const T1 = "s1";
await admin.goto(dash);
await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
await step(admin, { scenario: T1, who: "관리자 PC", title: "관리자 첫 화면 — 대시보드", action: "로그인 → 2단계 인증(인증 앱 6자리) 확인", result: "오늘 운영 현황이 열립니다. 아직 일정이 없어 숫자가 모두 0입니다. 위쪽 회청 점선 띠는 '검증 시나리오(가상)' 자료라는 표시입니다." });

await admin.goto(board);
// 지금 시각에 맞춰 시작하는 일정 (늦게 시작한 효과가 섞이지 않게) · 예정 간격 30분 > 이동시간
await addSchedule(NAME.w1, S.A, kstHHMM(-1), kstHHMM(59), "", {
  shot: { scenario: T1, who: "관리자 PC", title: "일정 등록", action: "왼쪽 메뉴 '현장·일정' → '일정 등록' → 기사 · 현장 · 예정 시작/종료 · 이동시간 입력", result: `${NAME.w1} 기사의 오늘 첫 현장(${S.A})을 넣는 모습입니다. 이어서 ${S.B}(이동 20분) · ${S.C}(이동 25분)도 등록합니다.` },
});
await addSchedule(NAME.w1, S.B, kstHHMM(89), kstHHMM(149), "20");
await addSchedule(NAME.w1, S.C, kstHHMM(179), kstHHMM(229), "25");
await step(admin, { scenario: T1, who: "관리자 PC", title: "일정 3건 등록 완료 · 위험 판단", action: "등록할 때마다 기존 연쇄위험 엔진이 다시 계산", result: "A→B→C 연결마다 '이동해서 제때 도착하는지'를 계산합니다. 지금은 여유가 있어 큰 위험이 없습니다." }, { el: admin.locator(`tr:has-text("${S.C}")`).first() });

// 기사 휴대폰
const m1 = await mobilePage(bro);
await loginAs(m1, e1);
await waitPath(m1, "/pilot/field");
await m1.goto(fieldUrl);
await m1.locator('section[aria-label="지금 할 일"]').waitFor();
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "기사 첫 화면 — 오늘 일정", action: "휴대폰에서 이메일 · 비밀번호로 로그인", result: "맨 위 '지금 할 일'에 1번째 현장과 다음 행동이 나옵니다. 아래쪽에는 '작업 시작' 버튼과 하단 메뉴 4개가 늘 고정돼 있습니다." });

const card1 = m1.locator(`section[aria-label="${S.A} 일정"]`);
await card1.locator('button:has-text("업무 확인")').click();
await m1.locator(`[role=status]:has-text("${S.A} 업무 확인 기록됨")`).waitFor();
await m1.waitForTimeout(700);
await m1.locator('div.fixed button:has-text("작업 시작")').first().click();
await m1.locator('[role=dialog][aria-label="안전점검 확인"] button:has-text("점검 없이 시작")').click({ timeout: 5000 }).catch(() => {}); // 0.6.0 안전 1순위 확인
await m1.locator(`[role=status]:has-text("${S.A} 작업 시작 기록됨")`).waitFor();
await m1.evaluate(() => window.scrollTo(0, 0));
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "업무 확인 → 작업 시작", action: "카드의 '업무 확인' → 화면 아래 고정 버튼 '작업 시작'", result: "누른 시각이 바로 기록됩니다(서버 시각 함께 저장). 아래 알림에 실제 시각 · 서버 기록 · 입력 방식이 나오고, 상태가 '작업 중'으로 바뀝니다." }, { toast: true });

// 안전점검
await m1.locator('section[aria-label="지금 할 일"] button:has-text("안전점검")').click();
const sp1 = card1.locator('[aria-label="시작 전 점검"]');
await sp1.waitFor();
for (const it of ["안전모 착용", "안전화 착용", "작업구역 표시·통제"]) await sp1.locator(`li[aria-label="${it}"] button:text-is("확인")`).click();
await sp1.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
await sp1.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "시작 전 안전점검", action: "'지금 할 일'의 '안전점검' → 항목마다 확인 → 착용 사진(촬영 또는 앨범)", result: "필수 항목과 사진이 있어야 제출됩니다. 관리자가 사진을 눈으로 확인하기 전까지는 '확인 대기'입니다." }, { el: sp1.locator('ul[aria-label="첨부할 사진"]') });
await sp1.locator('button:has-text("시작 전 점검 제출")').click();
await card1.locator('[aria-label="안전점검"] [role=status]').waitFor({ timeout: 30000 });

// 문제 보고
await m1.evaluate(() => window.scrollTo(0, 0));
await m1.locator('section[aria-label="지금 할 일"] button:has-text("문제 보고")').click();
const sh1 = card1.locator('[aria-label="현장 문제 보고"]');
await sh1.waitFor();
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "문제 보고 1단계 — 문제 유형", action: "'지금 할 일'의 '문제 보고' → 전체 화면 보고 열림", result: "맨 위 막대가 6단계(유형 → 상태 → 지원 → 예상 종료 → 사진 → 보내기) 중 어디인지 보여 줍니다. 고르기만 하면 되고 글자 입력은 필요 없습니다." });
await sh1.locator('[aria-label="문제 유형"] button:text-is("예상과 다른 설치환경")').click();
await sh1.locator('[aria-label="지금 작업 진행상황"] button:text-is("분해·설치 시작 후")').click();
await sh1.locator('[aria-label="요청 (여러 개 가능)"] button:text-is("숙련 기술자 지원")').click();
await sh1.locator('[aria-label="변경 예상 종료"] button:text-is("+1시간")').click();
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "2~4단계 — 상태 · 필요한 지원 · 예상 종료", action: "'분해·설치 시작 후' → '숙련 기술자 지원' → 예상 종료 '+1시간'", result: "바뀐 예상 종료가 연쇄위험 엔진에 들어가 다음 현장 도착과 위험을 다시 계산한다는 안내가 바로 나옵니다." }, { el: sh1.locator('[aria-label="변경 예상 종료"]') });
await sh1.locator('input[aria-label="현장 사진"]').setInputFiles(PHOTO);
await sh1.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "5단계 — 사진 첨부", action: "'촬영'(카메라) 또는 '앨범'에서 고르기", result: "미리보기와 장별 상태(대기 · 올리는 중 · 완료 · 실패)가 보입니다. 실패한 사진만 다시 올릴 수 있습니다. 사진은 촬영정보를 지우고 비공개로 저장됩니다." }, { el: sh1.locator('ul[aria-label="첨부할 사진"]') });
await sh1.locator('button:has-text("보고 보내기")').click();
await card1.locator('[role=status]:has-text("보고됨")').waitFor({ timeout: 30000 });
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "보고 완료", action: "맨 아래 '보고 보내기'", result: "사건번호가 생기고 카드에 '본사 확인 전'으로 남습니다. 본사가 조치하면 이 자리에 결과가 나타납니다." }, { el: card1.locator('section[aria-label^="사건 "]').first() });

// 관리자
await admin.goto(dash);
await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
await step(admin, { scenario: T1, who: "관리자 PC", title: "대시보드에 새 보고 · 위험 현장", action: "(새로 고침 없이 15초 자동 갱신)", result: "신규 문제 보고 1건, 위험도 높은 현장이 늘어납니다. '우선 처리할 사건'에 엔진이 계산한 후속 현장 위험과 '다음 조치'가 함께 나옵니다." });
await admin.goto(casesUrl);
const c1 = caseCard(S.A);
await c1.waitFor();
await step(admin, { scenario: T1, who: "관리자 PC", title: "문제·지원 — 사건 카드", action: "왼쪽 메뉴 '문제·지원'", result: "우선 확인 이유(후속 현장 몇 곳이 몇 분 늦는지 — 계산값)와 이 사건 때문에 새로 생긴 위험이 보입니다. 그날 전체 위험 수는 참고로 따로 둡니다." }, { el: c1, top: true });
await act(c1, "접수");
await act(c1, "지원 결정", (f) => f.locator('[aria-label="지원 조치"] button:text-is("숙련 직원 투입")').click(), { scenario: T1, who: "관리자 PC", title: "접수 → 지원 결정", action: "'접수' → '지원 결정' → '숙련 직원 투입' → '기록'", result: "조치마다 누가 · 언제 했는지 이력에 쌓입니다(지우지 않음)." });
await act(c1, "현장 전달", (f) => f.locator('input[aria-label="내용"]').fill("숙련 기술자가 30분 안에 도착합니다. 분해 상태 그대로 두세요."));
await act(
  c1,
  "일정 조정",
  async (f) => {
    const opt = await f.locator('select[aria-label="조정할 일정"] option', { hasText: S.B }).getAttribute("value");
    await f.locator('select[aria-label="조정할 일정"]').selectOption(opt);
    await f.locator('input[aria-label="새 예정 시작"]').fill(kstHHMM(150));
    await f.locator('input[aria-label="새 예정 종료"]').fill(kstHHMM(210));
    await f.locator('input[aria-label="내용"]').fill("보령 지원으로 홍성 시작 조정 (고객 연락 완료)");
  },
  { scenario: T1, who: "관리자 PC", title: "현장 전달 → 다음 현장 일정 조정", action: "'현장 전달'(기사에게 보낼 말) → '일정 조정' → 홍성 물류센터 시작을 늦춤", result: "조정하면 엔진이 바로 다시 판단합니다." },
);
await step(admin, { scenario: T1, who: "관리자 PC", title: "재판단 결과", action: "(일정 조정 '기록' 직후)", result: "이 사건 관련 위험 중 풀린 것과 남은 것이 따로 나옵니다. 보령→홍성은 해소, 홍성→예산는 여전히 늦어 '남음'입니다. 남은 위험을 숨기지 않습니다." }, { el: admin.locator('section[aria-label="처리 중 지원 요청"] [role=status]').first() });

// 기사: 본사 소식
await m1.goto(fieldUrl);
await m1.locator('section[aria-label="본사 메시지"]').waitFor({ timeout: 30000 });
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "기사 휴대폰에 본사 조치 도착", action: "(자동 갱신 — 누를 것 없음)", result: "'본사에서 온 소식'에 마지막 조치가 뜹니다. 조정된 홍성 물류센터 시각도 카드에 바로 반영됩니다." }, { el: m1.locator('section[aria-label="본사 메시지"]') });
const my1 = card1.locator('section[aria-label^="사건 "]').first();
await my1.locator('button:has-text("해결 보고")').click();
await my1.locator('[aria-label="해결 여부"] button:text-is("해결")').click();
await my1.locator('input[aria-label="해결 내용"]').fill("숙련 기술자와 함께 배선 경로 변경, 설치 완료");
await step(m1, { scenario: T1, who: `${NAME.w1} 휴대폰`, title: "해결 보고", action: "사건 카드 '해결 보고' → '해결' → (선택) 내용", result: "본사 조치 이력이 카드 안에 시간순으로 보입니다. '해결 보고 보내기'를 누르면 본사가 확인한 뒤 종결합니다." }, { el: my1 });
await my1.locator('button:has-text("해결 보고 보내기")').click();
await card1.locator('[role=status]:has-text("해결 보고됨")').waitFor();
await nextMinute();
await m1.locator('div.fixed button:has-text("작업 종료")').first().click();
await m1.locator('[role=dialog][aria-label="안전점검 확인"] button:has-text("점검 없이 종료")').click({ timeout: 5000 }).catch(() => {}); // 0.6.0 안전 1순위 확인
await m1.locator(`[role=status]:has-text("${S.A} 작업 종료 기록됨")`).waitFor();

// 관리자: 해결 확인 · 증빙 · 안전 확인
await admin.goto(casesUrl);
await c1.waitFor();
await act(c1, "해결 확인");
const closed = admin.locator('section[aria-label="끝난 사건"]');
await closed.waitFor();
const href1 = await closed.locator(`li:has-text("${S.A}") a:has-text("사건 증빙")`).first().getAttribute("href");
await admin.goto(`${APP}${href1}`);
await admin.locator('section[aria-label="사건 한눈에"]').waitFor();
await step(admin, { scenario: T1, who: "관리자 PC", title: "사건 상세 — 한눈에", action: "'끝난 사건' → '사건 증빙'", result: "문제 개요 → 현장 사진 → 관리자 조치 타임라인 순서로 보입니다. 보고부터 몇 초 뒤에 무엇을 했는지 남습니다." });
await step(admin, { scenario: T1, who: "관리자 PC", title: "연쇄 영향 그림 — 조치 전후", action: "(같은 화면 아래)", result: "사건 현장 → 다음 현장 → 그다음 현장의 위험을 '보고 직후'와 '조치 후'로 나란히 보여 줍니다. 아래 인쇄 증빙(PDF)은 그대로 이어집니다." }, { el: admin.locator('[aria-label="연쇄 영향 그림"]'), top: false });
await admin.goto(safetyUrl);
const chk1 = admin.locator(`li[aria-label^="안전점검 "]:has-text("${S.A}")`).first();
await chk1.waitFor();
await chk1.locator('button:has-text("적합 (육안)")').click();
await chk1.locator('[role=status]:has-text("적합(육안 확인)")').waitFor();
await step(admin, { scenario: T1, who: "관리자 PC", title: "안전관리 — 사진 눈으로 확인", action: "왼쪽 메뉴 '안전관리' → 사진 확인 → '적합 (육안)'", result: "사진만으로 자동 판정하지 않습니다. 관리자가 눈으로 본 결과만 기록하고, 기사 휴대폰에도 결과가 갑니다." }, { el: chk1 });

/* ═══════════════ 사례 2 — 안전 미흡 보완 · 연결 끊김 보고 · 장비 지원 · 미해결 유지 ═══════════════ */
const T2 = "s2";
await admin.goto(board);
await addSchedule(NAME.w2, S.D, kstHHMM(-3), kstHHMM(57));
await addSchedule(NAME.w2, S.E, kstHHMM(87), kstHHMM(147), "15");
await step(admin, { scenario: T2, who: "관리자 PC", title: "다른 기사 일정 2건 등록", action: "'현장·일정' → '일정 등록' 두 번", result: `${NAME.w2} 기사: ${S.D} → ${S.E}(이동 15분). 기사별로 표가 나뉩니다.` }, { el: admin.locator(`tr:has-text("${S.E}")`).first() });

const m2 = await mobilePage(bro);
await loginAs(m2, e2);
await waitPath(m2, "/pilot/field");
await m2.goto(fieldUrl);
const card2 = m2.locator(`section[aria-label="${S.D} 일정"]`);
await card2.waitFor();
await card2.locator('button:has-text("업무 확인")').click();
await m2.locator(`[role=status]:has-text("${S.D} 업무 확인 기록됨")`).waitFor();
await m2.waitForTimeout(700);
await m2.locator('section[aria-label="지금 할 일"] button:has-text("안전점검")').click();
const sp2 = card2.locator('[aria-label="시작 전 점검"]');
await sp2.waitFor();
await sp2.locator('li[aria-label="안전모 착용"] button:text-is("확인")').click();
await sp2.locator('li[aria-label="안전화 착용"] button:text-is("확인")').click();
await sp2.locator('li[aria-label="작업구역 표시·통제"] button:text-is("미흡")').click();
await step(m2, { scenario: T2, who: `${NAME.w2} 휴대폰`, title: "시작 전 점검 — '미흡' 선택", action: "업무 확인 → '안전점검' → 작업구역 표시·통제 '미흡'", result: "빨간 경고가 바로 뜹니다: 프로그램 확인을 기다리지 말고 작업을 멈추고 관리자에게 직접 전화. 이 점검은 기록용입니다." }, { el: sp2.locator("[role=alert]") });
await sp2.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
await sp2.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await sp2.locator('button:has-text("시작 전 점검 제출")').click();
await card2.locator('[aria-label="안전점검"] [role=status]').waitFor({ timeout: 30000 });

await admin.goto(safetyUrl);
const chk2 = admin.locator(`li[aria-label^="안전점검 "]:has-text("${S.D}")`).first();
await chk2.waitFor();
await chk2.locator('input[aria-label="보완할 내용"]').fill("작업구역 통제선 설치 후 사진 다시 보내 주세요");
await step(admin, { scenario: T2, who: "관리자 PC", title: "안전관리 — 미흡 점검", action: "'안전관리' → 미흡 표시된 점검 → 보완할 내용 입력", result: "미흡 항목이 있으면 '적합' 버튼이 눌리지 않습니다. 보완 요청만 보낼 수 있습니다." }, { el: chk2 });
await chk2.locator('button:text-is("보완 요청")').click();
await chk2.locator('[role=status]:has-text("보완 요청")').waitFor();

await m2.goto(fieldUrl);
await m2.locator('section[aria-label="본사 메시지"]').waitFor({ timeout: 30000 });
await step(m2, { scenario: T2, who: `${NAME.w2} 휴대폰`, title: "보완 요청 도착", action: "(자동 갱신)", result: "'본사에서 온 소식'에 빨간 테두리로 보완 요청이 뜨고, 하단 '안전점검' 메뉴에 빨간 숫자가 붙습니다." }, { el: m2.locator('section[aria-label="본사 메시지"]') });
const sup = card2.locator('[aria-label^="보완 요청 "]').first();
await sup.locator('input[aria-label="보완 사진"]').setInputFiles(PHOTO);
await sup.locator('input[aria-label="보완한 내용"]').fill("통제선 설치 완료");
await sup.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await step(m2, { scenario: T2, who: `${NAME.w2} 휴대폰`, title: "보완 제출", action: "보완 사진 + 보완한 내용 → '보완 제출'", result: "보완 이력이 처음 점검에 덧붙습니다(원래 기록은 그대로)." }, { el: sup });
await sup.locator('button:has-text("보완 제출")').click();
await card2.locator('[aria-label="안전점검"] [role=status]:has-text("보완 제출")').waitFor({ timeout: 30000 });

await admin.goto(safetyUrl);
await chk2.waitFor();
await chk2.locator('button:has-text("조치 완료")').click();
await chk2.locator('[role=status]:has-text("조치 완료")').waitFor();
await step(admin, { scenario: T2, who: "관리자 PC", title: "보완 확인 → 조치 완료", action: "보완 사진 확인 → '보완 확인 — 조치 완료'", result: "확인 이력: 관리자 확인(보완 필요) → 보완 제출 → 조치 완료 확인. 모두 시각 · 입력자와 함께 남습니다." }, { el: chk2 });

// 작업 시작 · 연결 끊김 속 보고
await m2.goto(fieldUrl);
await card2.waitFor();
await m2.locator('div.fixed button:has-text("작업 시작")').first().click();
await m2.locator('[role=dialog][aria-label="안전점검 확인"] button:has-text("점검 없이 시작")').click({ timeout: 5000 }).catch(() => {}); // 0.6.0 안전 1순위 확인
await m2.locator(`[role=status]:has-text("${S.D} 작업 시작 기록됨")`).waitFor();
await m2.waitForTimeout(800);
await card2.locator('button:has-text("현장 문제 보고 · 지원 요청")').click();
const sh2 = card2.locator('[aria-label="현장 문제 보고"]');
await sh2.waitFor();
await sh2.locator('[aria-label="문제 유형"] button:text-is("추가 장비 필요")').click();
await sh2.locator('[aria-label="지금 작업 진행상황"] button:text-is("작업 진행 중")').click();
await sh2.locator('[aria-label="요청 (여러 개 가능)"] button:text-is("장비 지원")').click();
await sh2.locator('[aria-label="변경 예상 종료"] button:text-is("+30분")').click();
await sh2.locator('input[aria-label="현장 사진"]').setInputFiles(PHOTO);
await sh2.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await m2.context().setOffline(true);
await sh2.locator('button:has-text("보고 보내기")').click();
await sh2.locator('button:has-text("다시 보내기")').waitFor({ timeout: 20000 });
await step(m2, { scenario: T2, who: `${NAME.w2} 휴대폰`, title: "연결이 끊긴 채 보고", action: "추가 장비 필요 → 작업 진행 중 → 장비 지원 → +30분 → 사진 → '보고 보내기' (전파 끊김)", result: "저장되지 않았다는 안내와 함께 '다시 보내기'가 나옵니다. 입력한 내용과 사진은 그대로 남아 있습니다." }, { el: sh2.locator("[role=alert]").first() });
await m2.context().setOffline(false);
await sh2.locator('button:has-text("다시 보내기")').click();
await card2.locator('[role=status]:has-text("보고됨")').waitFor({ timeout: 30000 });
await step(m2, { scenario: T2, who: `${NAME.w2} 휴대폰`, title: "연결 회복 → 다시 보내기", action: "'다시 보내기'", result: "같은 요청 번호로 보내 한 건만 저장됩니다(두 번 저장되지 않음)." }, { el: card2.locator('section[aria-label^="사건 "]').first() });

await admin.goto(casesUrl);
const c2 = caseCard(S.D);
await c2.waitFor();
await step(admin, { scenario: T2, who: "관리자 PC", title: "두 번째 사건 도착", action: "'문제·지원'", result: "청주 사옥 30분 지연 → 증평 매장 도착이 늦어지는지 엔진이 계산해 우선 확인 이유에 붙입니다." }, { el: c2, top: true });
await act(c2, "접수");
await act(c2, "지원 결정", (f) => f.locator('[aria-label="지원 조치"] button:text-is("장비 지원")').click());
await nextMinute();
await act(c2, "예상 종료 변경", (f) => f.locator('input[aria-label="변경 예상 종료"]').fill(kstHHMM(60)), {
  scenario: T2,
  who: "관리자 PC",
  title: "예상 종료 변경 (일정은 그대로)",
  action: "'예상 종료 변경' → 장비 전달 시각을 반영해 다시 입력",
  result: "다음 현장 일정은 옮기지 않고 예상 종료만 고쳐 엔진이 다시 판단합니다. 사례 1(일정 조정)과 다른 대응입니다.",
});
await c2.locator('[aria-label="조치 이력"]').waitFor();
await step(admin, { scenario: T2, who: "관리자 PC", title: "재판단 — 위험 해소", action: "(예상 종료 변경 '기록' 직후)", result: "장비가 빨리 와서 청주 사옥이 일찍 끝나면 증평 매장에 제때 도착합니다. 조치 이력에 '재판단: 청주 사옥 → 증평 매장 해소'가 붙습니다(계산값)." }, { el: c2.locator('[aria-label="조치 이력"]') });

await m2.goto(fieldUrl);
const my2 = card2.locator('section[aria-label^="사건 "]').first();
await my2.waitFor();
await my2.locator('button:has-text("해결 보고")').click();
await my2.locator('[aria-label="해결 여부"] button:text-is("임시 조치")').click();
await my2.locator('input[aria-label="해결 내용"]').fill("예비 장비로 임시 연결 — 정품 교체 필요");
await step(m2, { scenario: T2, who: `${NAME.w2} 휴대폰`, title: "임시 조치로 보고", action: "'해결 보고' → '임시 조치' → 내용", result: "완전히 해결되지 않았다는 것도 그대로 보고합니다." }, { el: my2 });
await my2.locator('button:has-text("해결 보고 보내기")').click();
await card2.locator('[role=status]:has-text("임시 조치 보고됨")').waitFor();

await admin.goto(casesUrl);
await c2.waitFor();
await act(c2, "미해결 유지", (f) => f.locator('input[aria-label="내용"]').fill("정품 장비 내일 도착 — 재방문 필요"), {
  scenario: T2,
  who: "관리자 PC",
  title: "미해결 유지 (재방문)",
  action: "'미해결 유지' → 사유 입력",
  result: "사건이 닫히지 않고 '처리 중' 목록에 계속 남아, 날짜가 바뀌어도 대시보드 '조치 대기'에 보입니다.",
});

await m2.goto(fieldUrl);
await card2.waitFor();
await nextMinute();
await m2.locator('div.fixed button:has-text("작업 종료")').first().click();
await m2.locator('[role=dialog][aria-label="안전점검 확인"] button:has-text("점검 없이 종료")').click({ timeout: 5000 }).catch(() => {}); // 0.6.0 안전 1순위 확인
await m2.locator(`[role=status]:has-text("${S.D} 작업 종료 기록됨")`).waitFor();
await m2.locator('nav[aria-label="현장 메뉴"] button:has-text("내 기록")').click();
await step(m2, { scenario: T2, who: `${NAME.w2} 휴대폰`, title: "작업 종료 · 내 기록", action: "아래 고정 '작업 종료' → 하단 메뉴 '내 기록'", result: "오늘 남긴 기록(시각 · 입력 방식 · 서버 기록), 문제 보고 상태, 안전점검 결과를 한곳에서 봅니다. 프로그램 의견 · 오류도 여기서 보냅니다." });

await admin.goto(dash);
await admin.locator('[aria-label="오늘 핵심 숫자"]').waitFor();
await step(admin, { scenario: T2, who: "관리자 PC", title: "하루 마감 — 대시보드", action: "'대시보드'", result: "사례 1은 해결(최근 처리 결과), 사례 2는 미해결 유지(조치 대기)로 남습니다. 안전점검은 둘 다 확인을 마쳤습니다." });

writeFileSync(join(OUT, "steps.json"), JSON.stringify({ date: D, kind: KIND, steps, names: NAME, sites: S, cases: psql(`select string_agg(case_no || ':' || status, ',' order by case_no) from field_cases where work_date = '${D}' and data_kind = '검증 시나리오';`) }, null, 1));
await bro.close();
console.log("완료", OUT, steps.length, "단계");
