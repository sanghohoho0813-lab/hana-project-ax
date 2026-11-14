// 현장 실사용 1차 — 기기 사이 연동 시험: 본사 PC(관리자) · 현장기사 A 휴대폰 · 현장기사 B 휴대폰이 각자 로그인한 별도 브라우저 세션
// 흐름: A 작업 시작 → 문제 보고(사진 첨부 · 예상 종료 변경) → 관리자 화면 자동 갱신으로 도착 → 엔진 판단(후속 현장 위험)
//       → 접수 · 배정 · 지원 결정 · 현장 전달 · 일정 조정(재판단) → A 휴대폰에 조치 반영 → A 해결 보고 → 관리자 해결 확인
//       · B는 A의 사건·사진을 볼 수 없음 · 연결 끊김 뒤 다시 보내도 한 건 · 사건 증빙(JSON)
// 주의: 같은 컴퓨터의 별도 브라우저 세션이다 (실제 휴대폰 2대·PC 1대 시험은 배포 후 별도로 한다)
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, PASSWORD, adminApi, psql, uniq, newBrowser, mobilePage, check, waitPath, shot, adminLogin, activate, createSchedule, loginAs, kstHHMM, kstHour, kstDate } from "./common.mjs";

if (kstHour() >= 21 || kstHour() < 1) {
  console.log("SKIP  한국 시각 21시~01시에는 '지금' 기준 일정이 자정을 넘어 이 시험을 하지 않습니다");
  process.exit(0);
}
const RUN = String(Date.now()).slice(-5);
const D = kstDate(0);
const KIND = "scenario";
const SA = `A현장${RUN}`, SB = `B현장${RUN}`, SC = `C현장${RUN}`, SX = `X현장${RUN}`;
const NA = `김기사${RUN}`, NB = `이기사${RUN}`;
const until = async (fn, ms = 25000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

const bro = await newBrowser();
// ── 준비: 본사 PC — 관리자 로그인(2단계 인증) · 현장기사 2명 활성화 · 오늘 일정 (검증 시나리오) ──
const fa = uniq("fielda"), fb = uniq("fieldb");
for (const e of [fa, fb]) await adminApi.auth.admin.createUser({ email: e, password: PASSWORD, email_confirm: true });
const { p: admin } = await adminLogin(bro, `본사${RUN}`);
await activate(admin, fa, NA);
await activate(admin, fb, NB);
const A_ID = psql(`select id from auth.users where email = '${fa}';`);
await admin.goto(`${APP}/pilot/admin?date=${D}&kind=${KIND}`);
// A는 지금 시작 예정 (늦게 시작하면 엔진의 '작업개시 지연 추정'이 먼저 위험을 잡으므로 보고 효과만 보려고 제때 시작)
const t0 = kstHHMM(1), aEnd = kstHHMM(20), bStart = kstHHMM(50), bEnd = kstHHMM(110), cStart = kstHHMM(150), cEnd = kstHHMM(200);
await createSchedule(admin, { who: NA, site: SA, start: t0, end: aEnd });
await createSchedule(admin, { who: NA, site: SB, start: bStart, end: bEnd, travel: "20" });
await createSchedule(admin, { who: NA, site: SC, start: cStart, end: cEnd, travel: "30" });
await createSchedule(admin, { who: NB, site: SX, start: t0, end: bEnd });

// 사진 파일 — 실제 JPEG (화면 캡처를 JPEG 로 저장)
const PHOTO = join(tmpdir(), `case-photo-${RUN}.jpg`);
writeFileSync(PHOTO, await admin.screenshot({ type: "jpeg", quality: 70 }));

// ── 현장기사 A 휴대폰 · B 휴대폰 (각자 로그인) ──
const a = await mobilePage(bro);
await loginAs(a, fa);
await waitPath(a, "/pilot/field");
const b = await mobilePage(bro);
await loginAs(b, fb);
await waitPath(b, "/pilot/field");
const fieldUrl = `${APP}/pilot/field?date=${D}&kind=${KIND}`;
await a.goto(fieldUrl);
await b.goto(fieldUrl);
const cardA = a.locator(`section[aria-label="${SA} 일정"]`);
await cardA.waitFor();
check((await b.locator(`section[aria-label="${SA} 일정"]`).count()) === 0 && (await b.locator(`section[aria-label="${SX} 일정"]`).count()) === 1, "B 휴대폰에는 B 일정만 보임 (A 일정 안 보임)");

// A: 작업 시작
await cardA.locator('button:has-text("작업 시작")').click();
await cardA.locator("text=작업 시작 기록됨").or(a.locator("text=작업 시작 기록됨")).first().waitFor();
await a.waitForTimeout(800);

// A: 문제 보고 (버튼 위주) — 연결 끊긴 상태에서 먼저 눌러 본다
await cardA.locator('button:has-text("현장 문제 보고 · 지원 요청")').click();
const sheet = cardA.locator('[aria-label="현장 문제 보고"]');
let taps = 1;
const tap = async (loc) => (await loc.click(), taps++);
await tap(sheet.locator('[aria-label="문제 유형"] button:text-is("예상과 다른 설치환경")'));
await tap(sheet.locator('[aria-label="지금 작업 진행상황"] button:text-is("분해·설치 시작 후")'));
await tap(sheet.locator('[aria-label="요청 (여러 개 가능)"] button:text-is("숙련 기술자 지원")'));
await tap(sheet.locator('[aria-label="변경 예상 종료"] button:text-is("+1시간")'));
await tap(sheet.locator('[aria-label="문제 발견시각"] button:text-is("10분 전")'));
// 검증 시나리오 날짜 — 자료 구분: 이번 시험은 '현장정보 재현'으로 둔다 (기본값은 가상 시나리오)
await tap(sheet.locator('[aria-label="자료 구분 (검증 시나리오)"] button:text-is("현장정보 재현")'));
await sheet.locator('input[aria-label="현장 사진"]').setInputFiles(PHOTO);
taps++;
await sheet.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await a.context().setOffline(true);
await sheet.locator('button:has-text("보고 보내기")').click();
check(await until(async () => (await sheet.locator('button:has-text("다시 보내기")').count()) === 1, 10000), "연결 끊김 — 보고가 저장되지 않고 '다시 보내기' 안내 (입력 내용 유지)");
const before = Number(psql(`select count(*) from field_cases where worker_id = '${A_ID}';`));
await a.context().setOffline(false);
await sheet.locator('button:has-text("다시 보내기")').click();
taps++;
check(await until(async () => (await cardA.locator('[role=status]:has-text("보고됨")').count()) === 1), "연결 복구 후 다시 보내기 → 보고 저장 · 사진 업로드");
const caseRow = psql(`select id || '|' || case_no || '|' || coalesce(to_char(expected_end,'HH24:MI'),'') || '|' || discovered_basis || '|' || report_mode || '|' || (end_event_id is not null) from field_cases where worker_id = '${A_ID}' order by recorded_at desc limit 1;`).split("|");
const [CASE, CASE_NO] = caseRow;
check(Number(psql(`select count(*) from field_cases where worker_id = '${A_ID}';`)) === before + 1, "같은 보고는 한 건만 저장 (끊김 전·후 같은 요청 번호)");
check(caseRow[3] === "현장 직원 진술" && caseRow[4] === "즉시 기록" && caseRow[5] === "true" && caseRow[2] === kstHHMM(80).slice(0, 2) + caseRow[2].slice(2), "발견시각(10분 전 · 현장 직원 진술)과 보고 시각(즉시 기록) 분리 · 예상 종료 엔진 전달", caseRow.join(" "));
check(taps <= 9, `보고에 누른 버튼 ${taps}번 (자료 구분·사진·재전송 포함 · 시각 입력 0칸)`);
const photo = psql(`select size_bytes || '|' || exif_removed || '|' || mime || '|' || (retain_until - '${D}'::date) from case_photos where case_id = '${CASE}';`);
check(photo.split("|")[1] === "true" && photo.split("|")[2] === "image/jpeg" && photo.split("|")[3] === "365", "사진 실제 업로드·등록 (휴대폰에서 줄여 촬영정보 제거 · 보관 365일)", photo);
await shot(a, "cases_1_field_report");

// ── 본사 PC: 새로 고침 없이 자동 갱신으로 도착 ──
await admin.goto(`${APP}/pilot/admin/cases?date=${D}&kind=${KIND}`);
const caseCard = admin.locator(`li[aria-label="사건 ${CASE_NO}"]`);
check(await until(async () => (await caseCard.count()) === 1), "본사 화면에 A의 보고 도착");
const ctext = await caseCard.innerText();
check(ctext.includes("우선 확인 이유") && /후속 현장 \d곳 위험/.test(ctext), "우선 확인 이유에 엔진이 계산한 후속 현장 위험 표시", ctext.match(/우선 확인 이유[^\n]*/)?.[0]);
// 판단 요약의 위험 수는 그날 전체(앞선 시험 회차 포함)라서, 이 회차 현장의 연결 변화로 확인한다
check(ctext.includes(`${SA} → ${SB} 신규 위험(없음→매우 높음)`) && ctext.includes(`${SB} → ${SC} 신규 위험(없음→매우 높음)`), "보고의 예상 종료 → 엔진 판단: 후속 B·C현장 신규 위험(매우 높음)", ctext.match(/엔진 판단[^\n]*/)?.[0]);
const imgOk = await caseCard.locator('ul[aria-label="현장 사진"] img').evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
check(imgOk, "관리자 화면에서 현장 사진 실제 열람 (비공개 저장소 서명 주소)");
await shot(admin, "cases_2_admin_inbox");

// 자동 갱신 확인: 관리자 화면을 열어 둔 채 B가 새 보고를 보내면 새로 고침 없이 나타난다
const cardX = b.locator(`section[aria-label="${SX} 일정"]`);
await cardX.locator('button:has-text("현장 문제 보고 · 지원 요청")').click();
const sb = cardX.locator('[aria-label="현장 문제 보고"]');
await sb.locator('[aria-label="문제 유형"] button:text-is("추가 장비 필요")').click();
await sb.locator('button:has-text("보고 보내기")').click();
await cardX.locator('[role=status]:has-text("보고됨")').waitFor();
const X_NO = psql(`select case_no from field_cases where worker_id <> '${A_ID}' and work_date = '${D}' and data_kind = '검증 시나리오' order by recorded_at desc limit 1;`);
const t1 = Date.now();
check(await until(async () => (await admin.locator(`li[aria-label="사건 ${X_NO}"]`).count()) === 1, 20000), "열어 둔 관리자 화면에 B의 새 보고가 자동 갱신으로 나타남 (새로 고침 없음)", `${Math.round((Date.now() - t1) / 1000)}초`);
check(!(await admin.locator(`li[aria-label="사건 ${X_NO}"]`).innerText()).includes("엔진 판단: 위험") && (await admin.locator(`li[aria-label="사건 ${X_NO}"]`).innerText()).includes("예상 종료 미확인 — 엔진에 전달하지 않음"), "예상 종료 없는 보고는 위험 판단에 반영하지 않음");

// ── 관리자 조치 ──
const NB_START = kstHHMM(110), NB_END = kstHHMM(170);
async function act(button, fill) {
  await caseCard.locator(`button:text-is("${button}")`).click();
  const f = caseCard.locator('[aria-label$=" 입력"]');
  if (fill) await fill(f);
  await f.locator('button:text-is("기록")').click();
  await caseCard.locator('[aria-label$=" 입력"]').waitFor({ state: "detached", timeout: 15000 });
}
await act("접수");
await act("담당자 배정", (f) => f.locator('input[aria-label="담당자 이름"]').fill("숙련기술자 박"));
await act("지원 결정", (f) => f.locator('[aria-label="지원 조치"] button:text-is("숙련 직원 투입")').click());
await act("현장 전달", (f) => f.locator('input[aria-label="내용"]').fill("숙련 기술자가 곧 도착합니다. 분해 상태 그대로 두세요."));
await act("일정 조정", async (f) => {
  const opt = await f.locator('select[aria-label="조정할 일정"] option', { hasText: SB }).getAttribute("value");
  await f.locator('select[aria-label="조정할 일정"]').selectOption(opt);
  await f.locator('input[aria-label="새 예정 시작"]').fill(NB_START);
  await f.locator('input[aria-label="새 예정 종료"]').fill(NB_END);
  await f.locator('input[aria-label="내용"]').fill("A현장 지원으로 B현장 시작 조정 (고객 연락)");
});
const notice = await admin.locator('section[aria-label="처리 중 지원 요청"] [role=status]').first().innerText();
const [rb, ra] = (notice.match(/재판단: 위험 연결 (\d+) → (\d+)건/) ?? []).slice(1).map(Number);
check(rb - ra === 1, "관리자 일정 조정(B) → 기존 엔진으로 재판단: 위험 1건 해소", notice);
await until(async () => (await caseCard.locator('[aria-label="조치 이력"]').innerText()).includes("재판단"), 15000);
const adjText = await caseCard.locator('[aria-label="조치 이력"]').innerText();
check(adjText.includes(`${SA} → ${SB} 해소`) && !adjText.includes(`${SB} → ${SC} 해소`), "재판단: A→B 해소 · B→C 위험은 남음 (조치 후 남은 위험을 숨기지 않음)", adjText.replace(/\s+/g, " "));
const steps = psql(`select string_agg(kind, ',' order by step_no) from case_steps where case_id = '${CASE}';`);
check(steps === "접수,담당자 배정,지원 조치 결정,현장 전달,일정 조정", "조치 이력 순서대로 저장 (중복 없음)", steps);
check(psql(`select count(*) from risk_judgments r join case_steps s on s.linked_seq = r.seq where s.case_id = '${CASE}';`) === "1", "일정 조정의 판단 전후가 서명 기록됨");

// ── A 휴대폰: 조치 반영 (자동 갱신) ──
check(await until(async () => (await cardA.locator('[aria-label="본사 조치"]').innerText()).includes("숙련 기술자가 곧 도착합니다"), 25000), "A 휴대폰에 관리자 현장 전달 내용 반영 (자동 갱신)");
check(await until(async () => (await a.locator(`section[aria-label="${SB} 일정"]`).innerText()).includes(`${NB_START} ~ ${NB_END}`), 25000), "A 휴대폰에 조정된 B현장 일정 반영");
await shot(a, "cases_3_field_after_admin");
check((await b.locator(`text=${CASE_NO}`).count()) === 0, "B 휴대폰에는 A의 사건이 보이지 않음");
// B가 관리자 화면·A 사건 증빙에 직접 접근
await b.goto(`${APP}/pilot/admin/cases/${CASE}`);
check(!new URL(b.url()).pathname.startsWith("/pilot/admin"), "B는 관리자 사건 증빙 화면에 들어갈 수 없음", b.url());
const exp = await b.request.get(`${APP}/pilot/admin/cases/${CASE}/export?format=json`);
check(exp.status() === 403, "B는 사건 증빙 내보내기 불가 (403)", String(exp.status()));
await b.goto(fieldUrl);

// ── A 해결 보고 → 관리자 해결 확인 ──
const myCase = cardA.locator(`section[aria-label="사건 ${CASE_NO}"]`);
await myCase.locator('button:has-text("해결 보고")').click();
await myCase.locator('[aria-label="해결 여부"] button:text-is("해결")').click();
await myCase.locator('button:has-text("해결 보고 보내기")').click();
await cardA.locator('[role=status]:has-text("해결 보고됨")').waitFor();
check(await until(async () => (await caseCard.innerText()).includes("현장 해결 보고"), 20000), "관리자 화면에 A의 해결 보고 반영 (자동 갱신)");
await act("해결 확인");
check(psql(`select status from field_cases where id = '${CASE}';`) === "해결", "관리자 해결 확인 → 해결");
check(await until(async () => (await admin.locator('section[aria-label="끝난 사건"]').innerText()).includes(CASE_NO), 15000), "해결된 사건은 '끝난 사건'으로 이동");
check(await until(async () => (await admin.locator(`li[aria-label="사건 ${X_NO}"]`).count()) === 1), "B의 미처리 요청은 계속 표시");

// ── 사건 증빙 (PDF용 화면 · JSON) ──
await admin.goto(`${APP}/pilot/admin/cases/${CASE}`);
const ev = await admin.locator('article[aria-label="사건 증빙"]').innerText();
for (const h of ["1. 사건 · 참가자 · 출처", "2. 시각", "3. 현장 사진 (1장)", "4. 관리자 조치", "5. 연쇄위험 엔진 입력", "6. 측정"]) check(ev.includes(h), `사건 증빙 항목: ${h}`);
check(/문제 발견 → 최초 보고: \d+분 \(진술\)/.test(ev) && /문제 보고 → 관리자 확인\(접수\): \d+분 \(실측\)/.test(ev), "측정: 발견→보고(진술) · 보고→확인(실측) 품질 구분", ev.match(/문제 발견 → 최초 보고[^\n]*/)?.[0]);
await shot(admin, "cases_4_evidence");
// 인쇄(PDF) — 공용 인쇄 규칙은 .print-area 만 보이게 하므로, 본문이 실제로 인쇄되는지 본다 (빈 PDF 방지)
async function printable(pg, sel, label) {
  await pg.emulateMedia({ media: "print" });
  const vis = await pg.locator(sel).first().evaluate((el) => [el, el.querySelector("h1"), el.querySelector("table, section, dl")].every((x) => x && getComputedStyle(x).visibility === "visible"));
  const pdf = await pg.pdf({ format: "A4" });
  await pg.emulateMedia({ media: "screen" });
  check(vis && pdf.length > 30000, `${label} 인쇄(PDF): 본문이 보이고 PDF가 비어 있지 않음`, `${Math.round(pdf.length / 1024)}KB`);
}
await printable(admin, 'article[aria-label="사건 증빙"]', "사건 증빙");
const JUDGE_ID = psql(`select id from risk_judgments where seq = (select linked_seq from case_steps where case_id = '${CASE}' and kind = '일정 조정');`);
await admin.goto(`${APP}/pilot/admin/judgments/${JUDGE_ID}`);
await printable(admin, '[aria-label="위험 판단 기록"]', "위험 판단 기록");
await admin.goto(`${APP}/pilot/admin/cases/${CASE}`);
const js = await admin.request.get(`${APP}/pilot/admin/cases/${CASE}/export?format=json`);
const J = await js.json();
check(js.status() === 200 && J.case.case_no === CASE_NO && J.photos.length === 1 && /^[0-9a-f]{64}$/.test(J.photos[0].sha256) && !("url" in J.photos[0]) && J.judgments.length >= 2 && J.steps.length === 7, "사건 증빙 JSON: 사건·사진 지문·조치 7건·판단 전후 (서명 주소는 담지 않음)", `steps ${J.steps?.length} · judgments ${J.judgments?.length}`);
check(/^hana-project-ax@\d+\.\d+\.\d+\+[0-9a-f]{7}/.test(J.case.app_version), "기록마다 프로그램 버전", J.case.app_version);

for (const [n, pg] of [["관리자", admin], ["A", a], ["B", b]]) check(pg.errs.length === 0, `${n} 화면 오류 없음`, pg.errs.join(" | "));
await bro.close();
console.log(process.exitCode ? "실패 있음" : "모두 통과");
