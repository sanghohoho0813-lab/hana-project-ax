// 0.5.0 조기 확인 (2026-11-13 현장 책임자 통화 반영) — 연락 없이 혼자 붙잡고 있는 현장을 본사가 먼저 알아챈다
// 흐름: 작업 시작 40분째 · 진행 보고 없음 → 휴대폰 '예정대로 되고 있나요?' · 관리자 대시보드 '확인 필요(중간 확인)'
//       → '예정대로' (예상 종료 보고로 기록) → 양쪽에서 사라짐
//       → 다른 현장: 예상 종료를 넘김 · 보고 없음 → '예정 넘김' → '막혔어요' → 문제 보고 → '지원 중'으로 바뀌어 확인 필요에서 빠짐
//       → 작업 종료했는데 안전점검을 안 냄 → 휴대폰 '안전점검 빠짐' · 관리자 안전관리 '현장별 3단계 현황'에 누락
// 기존 기록(작업 시작 · 예상 종료 보고 · 문제 보고)만 쓴다 — 새 DB 기록 종류 없음. 실제 시각으로 동작하므로 한국 시각 04~21시에만 실행한다.
import { APP, PASSWORD, adminApi, psql, uniq, newBrowser, check, waitPath, shot, adminLogin, mobilePage, kstHHMM, kstHour, kstDate, createSchedule, activate, loginAs } from "./common.mjs";

if (kstHour() < 4 || kstHour() >= 21) {
  console.log("SKIP  한국 시각 04~21시에만 실행합니다 (지금 " + kstHHMM() + ")");
  process.exit(0);
}
const bro = await newBrowser();
const RUN = String(Date.now()).slice(-5);
const P = `조현장${RUN}`;
const M = `M현장${RUN}`, O = `O현장${RUN}`;
const TODAY = kstDate(0);
const until = async (fn, ms = 25000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

// ── 준비: 관리자 · 현장 직원 · 오늘 일정 2건 (O: 이미 끝났어야 할 현장, M: 진행 중이어야 할 현장) ──
const f = uniq("field");
await adminApi.auth.admin.createUser({ email: f, password: PASSWORD, email_confirm: true });
const { p: admin } = await adminLogin(bro, `본사${RUN}`);
await activate(admin, f, P);
await admin.goto(`${APP}/pilot/admin/schedule?date=${TODAY}&kind=real`);
const mStart = kstHHMM(-40), mEnd = kstHHMM(20);
await createSchedule(admin, { who: P, site: O, start: kstHHMM(-130), end: kstHHMM(-70) });
await createSchedule(admin, { who: P, site: M, start: mStart, end: mEnd });
check(true, `준비: ${O} 예정 ${kstHHMM(-130)}~${kstHHMM(-70)} · ${M} 예정 ${mStart}~${mEnd}`);

const m = await mobilePage(bro);
await loginAs(m, f);
await waitPath(m, "/pilot/field");
const card = (site) => m.locator(`section[aria-label="${site} 일정"]`);
const ask = m.locator('[aria-label="진행 확인"]');
const lateStart = async (site, at) => {
  await card(site).locator('button:has-text("시각을 놓쳤어요")').click();
  await card(site).locator('button[aria-pressed]:has-text("작업 시작")').click();
  await card(site).locator('input[aria-label="실제 시각"]').fill(at);
  await card(site).locator('button:has-text("사후 입력으로 보내기")').click();
  await m.locator(`[role=status]:has-text("${site} 작업 시작 기록됨")`).waitFor();
};
const closeToast = async () => {
  const b = m.locator('button[aria-label="알림 닫기"]');
  if (await b.count()) await b.click();
};
const dash = async () => {
  await admin.goto(`${APP}/pilot/admin?date=${TODAY}&kind=real`);
  return admin.locator('section[aria-label="확인 필요 현장"]');
};

// ── 1) M: 예정대로 시작했지만 40분째 진행 보고 없음 → 중간 확인 ──
await lateStart(M, mStart);
check(await until(async () => (await ask.innerText()).includes("작업 시작 40분째") || (await ask.innerText()).includes("작업 시작 41분째")), "휴대폰: 작업 시작 40분째 · 진행 보고 없음 → '예정대로 되고 있나요?'", (await ask.innerText().catch(() => "")).replace(/\s+/g, " "));
await closeToast();
await m.evaluate(() => window.scrollTo(0, 0));
await shot(m, "w01_field_mid_check");
check((await ask.locator('button:has-text("막혔어요")').count()) === 1 && (await ask.locator('button:has-text("예정대로")').count()) === 1 && (await ask.locator('button:has-text("늦어져요")').count()) === 1, "버튼 3개: 막혔어요 · 예정대로 · 늦어져요");
let w = await dash();
let wt = (await w.innerText()).replace(/\s+/g, " ");
await shot(admin, "w02_admin_watch_mid");
check(wt.includes(M) && wt.includes("중간 확인") && wt.includes("진행 보고 없음"), "관리자 대시보드 '확인 필요'에 M (중간 확인 · 진행 보고 없음)", wt.slice(0, 160));

// ── 2) '예정대로' → 예상 종료 보고(예정 종료 시각)로 기록 → 양쪽에서 사라짐 ──
await ask.locator('button:has-text("예정대로")').click();
await m.locator(`[role=status]:has-text("${M} 예상 종료 보고 기록됨")`).waitFor();
const rep = psql(`select e.entry_mode || '|' || to_char(e.expected_end, 'HH24:MI') || '|' || e.source from work_events e join schedules s on s.id = e.schedule_id where s.site_name = '${M}' and e.kind = '예상 종료 보고';`);
check(rep === `즉시 기록|${mEnd}|현장 직원`, "'예정대로' = 예상 종료 보고(예정 종료 시각) 즉시 기록 — 본사가 '언제 확인했는지' 남음", rep);
check(await until(async () => (await ask.count()) === 0), "휴대폰: 응답 뒤 진행 확인 사라짐");
w = await dash();
wt = (await w.innerText()).replace(/\s+/g, " ");
check(!wt.includes(M), "관리자 대시보드: 응답한 M은 확인 필요에서 빠짐", wt.slice(0, 160));

// ── 3) O: 예상 종료를 70분 넘김 · 보고 없음 → 예정 넘김 ──
await lateStart(O, kstHHMM(-130));
check(await until(async () => /예상 종료 \d{2}:\d{2}가 (69|70|71)분 지났어요/.test(await ask.innerText())), "휴대폰: '예상 종료 HH:MM가 70분 지났어요' (예정 넘김)", (await ask.innerText().catch(() => "")).replace(/\s+/g, " "));
await closeToast();
await m.evaluate(() => window.scrollTo(0, 0));
await shot(m, "w03_field_overdue");
check((await ask.locator('button:has-text("예정대로")').count()) === 0, "예정을 넘긴 뒤에는 '예정대로' 대신 막혔어요 · 늦어져요만");
w = await dash();
wt = (await w.innerText()).replace(/\s+/g, " ");
await shot(admin, "w04_admin_watch_overdue");
check(wt.includes(O) && /예정 넘김 (69|70|71)분/.test(wt), "관리자 대시보드 '확인 필요'에 O (예정 넘김 70분)", wt.slice(0, 200));
check((await w.locator('a:has-text("전화 확인")').count()) >= 1, "관리자: '전화 확인 → 대리 보고' 바로가기");

// ── 4) '막혔어요' → 문제 보고 → 지원 중 (확인 필요에서 빠짐) ──
await ask.locator('button:has-text("막혔어요")').click();
const sheet = card(O).locator('[aria-label="현장 문제 보고"]');
await sheet.waitFor();
check(true, "'막혔어요' → 이 현장의 문제 보고 바로 열림");
await sheet.locator('[aria-label="문제 유형"] button:text-is("예상과 다른 설치환경")').click();
await sheet.locator('[aria-label="지금 작업 진행상황"] button:text-is("분해·설치 시작 후")').click();
await sheet.locator('[aria-label="요청 (여러 개 가능)"] button:text-is("숙련 기술자 지원")').click();
await sheet.locator('[aria-label="문제 발견시각"] button:text-is("10분 전")').click();
await sheet.locator('button:has-text("보고 보내기")').click();
check(await until(async () => (await card(O).locator('[role=status]:has-text("보고됨")').count()) === 1), "문제 보고 저장");
check(await until(async () => (await ask.count()) === 0), "휴대폰: 보고 뒤 진행 확인 사라짐 (본사가 알고 있음)");
w = await dash();
wt = (await w.innerText()).replace(/\s+/g, " ");
check(!wt.includes(O), "관리자 대시보드: 보고된 O는 확인 필요에서 빠지고 '우선 처리할 사건'으로", wt.slice(0, 160));
const pri = (await admin.locator('section[aria-label="우선 처리할 사건"]').innerText()).replace(/\s+/g, " ");
await shot(admin, "w05_admin_after_report");
check(pri.includes(O) && pri.includes("숙련 기술자 지원"), "우선 처리할 사건에 O · 요청 지원(숙련 기술자)", pri.slice(0, 200));

// ── 5) M 작업 종료 (안전점검 없이) → 빠진 단계 표시 ──
await card(M).locator('button:has-text("작업 종료")').first().click();
await m.locator(`[role=status]:has-text("${M} 작업 종료 기록됨")`).waitFor();
const news = m.locator('section[aria-label="본사 메시지"]');
check(await until(async () => (await news.locator(`button:has-text("${M} · 안전점검 빠짐")`).count()) === 3), "휴대폰: 마친 M의 안전점검 3단계가 빠졌다고 알림 (시작 전 · 진행 중 · 마친 뒤)");
await closeToast();
await m.evaluate(() => window.scrollTo(0, 0));
await shot(m, "w06_field_safety_missing");
await admin.goto(`${APP}/pilot/admin/safety?date=${TODAY}&kind=real`);
const row = admin.locator(`section[aria-label="현장별 3단계 현황"] tr:has-text("${M}")`);
const rt = (await row.innerText()).replace(/\s+/g, " ");
await shot(admin, "w07_admin_safety_stages");
check((rt.match(/누락/g) ?? []).length === 3, "관리자 안전관리: M 3단계 모두 누락", rt);
await admin.goto(`${APP}/pilot/admin?date=${TODAY}&kind=real`);
const st = (await admin.locator('[aria-label="오늘 핵심 숫자"]').innerText()).replace(/\s+/g, " ");
check(/단계 누락 [1-9]/.test(st) && st.includes("확인 필요 현장") && st.includes("후속 일정 영향"), "대시보드 숫자: 확인 필요 현장 · 안전 단계 누락 · 후속 일정 영향(보조)", st);

await admin.goto(`${APP}/pilot/admin/measures?kind=real`);
await shot(admin, "w08_admin_measures_focus");
check((await admin.locator('section[aria-label="핵심 지표"]').count()) === 1 && /작업을 마친 현장 \d+곳 가운데 3단계를 모두 낸 현장 \d+곳/.test(await admin.locator('section[aria-label="안전점검 3단계 제출"]').innerText()), "성과 측정: 핵심 지표 안내 · 측정 10 안전점검 3단계 제출");
const noWiden = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check(noWiden && m.errs.length === 0, "휴대폰 가로 넘침 없음 · 화면 오류 없음", m.errs.join(" / "));
await bro.close();
