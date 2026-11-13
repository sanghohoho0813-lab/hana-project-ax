// 현장 실사용 2차 — 안전점검 기기 간 시험: 현장기사 A 휴대폰 · 본사 PC · 현장기사 B 휴대폰 (각자 로그인한 별도 브라우저 세션)
// 작업 전 점검(미흡 포함 · 사진) → 작업 중지·직접 연락 안내 → 관리자 육안 확인: 적합 불가 → 보완 요청 → A 보완 제출(사진)
// → 관리자 조치 완료 확인 · 작업 중 점검(전부 확인) → 적합(육안) · B 차단 · 사진만으로 자동 적합 없음
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, PASSWORD, adminApi, psql, uniq, newBrowser, mobilePage, check, waitPath, shot, adminLogin, activate, createSchedule, loginAs, kstHHMM, kstHour, kstDate } from "./common.mjs";

if (kstHour() >= 22 || kstHour() < 1) {
  console.log("SKIP  한국 시각 22시~01시에는 '지금' 기준 일정이 자정을 넘어 이 시험을 하지 않습니다");
  process.exit(0);
}
const RUN = String(Date.now()).slice(-5);
const D = kstDate(0);
const SA = `안전A${RUN}`, SX = `안전X${RUN}`, NA = `최기사${RUN}`, NB = `정기사${RUN}`;
const until = async (fn, ms = 25000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

const bro = await newBrowser();
const fa = uniq("safea"), fb = uniq("safeb");
for (const e of [fa, fb]) await adminApi.auth.admin.createUser({ email: e, password: PASSWORD, email_confirm: true });
const { p: admin } = await adminLogin(bro, `안전관리${RUN}`);
await activate(admin, fa, NA);
await activate(admin, fb, NB);
const A_ID = psql(`select id from auth.users where email = '${fa}';`);
await admin.goto(`${APP}/pilot/admin?date=${D}&kind=scenario`);
await createSchedule(admin, { who: NA, site: SA, start: kstHHMM(5), end: kstHHMM(60) });
await createSchedule(admin, { who: NB, site: SX, start: kstHHMM(5), end: kstHHMM(60) });
const PHOTO = join(tmpdir(), `safety-photo-${RUN}.jpg`);
writeFileSync(PHOTO, await admin.screenshot({ type: "jpeg", quality: 70 }));

const a = await mobilePage(bro);
await loginAs(a, fa);
await waitPath(a, "/pilot/field");
const b = await mobilePage(bro);
await loginAs(b, fb);
await waitPath(b, "/pilot/field");
const fieldUrl = `${APP}/pilot/field?date=${D}&kind=scenario`;
await a.goto(fieldUrl);
await b.goto(fieldUrl);
const card = a.locator(`section[aria-label="${SA} 일정"]`);
const panel = card.locator('[aria-label="안전점검"]');
await panel.waitFor();

// ── A: 작업 전 점검 (작업구역 미흡) ──
await panel.locator('button:has-text("시작 전 점검")').click();
const sheet = panel.locator('[aria-label="시작 전 점검"]');
const ans = (item, a2) => sheet.locator(`li[aria-label="${item}"] button:text-is("${a2}")`).click();
await ans("안전모 착용", "확인");
await ans("안전화 착용", "확인");
await ans("작업구역 표시·통제", "미흡");
check((await sheet.locator('[role=alert]:has-text("작업을 멈추고")').count()) === 1, "미흡 선택 → 프로그램 판단을 기다리지 말고 작업 중지·직접 연락 안내");
check(await sheet.locator('button:has-text("시작 전 점검 제출")').isDisabled(), "착용 사진 없이는 제출 불가");
check(await sheet.locator('li[aria-label="안전모 착용"] button:text-is("해당 없음")').isDisabled(), "필수 항목은 '해당 없음' 선택 불가");
await sheet.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
await sheet.locator('button:has-text("시작 전 점검 제출")').click();
await panel.locator('[role=status]:has-text("시작 전 점검")').waitFor();
const CHK = psql(`select id || '|' || check_no || '|' || array_to_string(deficient, ',') || '|' || review_status from safety_checks where worker_id = '${A_ID}' order by recorded_at desc limit 1;`).split("|");
check(CHK[2] === "zone" && CHK[3] === "확인 대기", "점검 저장 — 미흡 항목 기록 · 상태 '확인 대기' (사진 있어도 자동 적합 아님)", CHK.join(" "));
check(psql(`select count(*) from case_photos where safety_check_id = '${CHK[0]}' and exif_removed;`) === "1", "착용 사진 실제 업로드 (촬영정보 제거)");
await shot(a, "safety_1_field");

// ── 본사 PC: 육안 확인 ──
await admin.goto(`${APP}/pilot/admin/safety?date=${D}&kind=scenario`);
const item = admin.locator(`li[aria-label="안전점검 ${CHK[1]}"]`);
check(await until(async () => (await item.count()) === 1), "본사 안전점검 화면에 A의 점검 도착");
check(await item.locator('button:has-text("적합 (육안)")').isDisabled(), "미흡 항목이 있으면 적합 버튼 비활성");
const img = await item.locator('ul[aria-label="점검 사진"] img').evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false);
check(img, "관리자가 점검 사진을 실제로 열어 봄 (비공개 저장소 서명 주소)");
await item.locator('input[aria-label="보완할 내용"]').fill("작업구역 통제선 설치 후 사진 다시 보내 주세요");
await item.locator('button:text-is("보완 요청")').click();
await item.locator('[role=status]:has-text("보완 요청")').waitFor();
await shot(admin, "safety_2_admin");

// ── A: 보완 요청 확인 (자동 갱신) → 보완 제출 ──
const sup = panel.locator(`[aria-label="보완 요청 ${CHK[1]}"]`);
check(await until(async () => (await sup.count()) === 1, 25000), "A 휴대폰에 보완 요청 도착 (자동 갱신)");
await sup.locator('input[aria-label="보완 사진"]').setInputFiles(PHOTO);
await sup.locator('input[aria-label="보완한 내용"]').fill("통제선 설치 완료");
await sup.locator('button:has-text("보완 제출")').click();
await panel.locator('[role=status]:has-text("보완 제출")').waitFor();
check(await until(async () => (await item.innerText()).includes("보완 제출"), 20000), "본사 화면에 보완 제출 반영 (자동 갱신)");
await item.locator('button:has-text("조치 완료")').click();
await item.locator('[role=status]:has-text("조치 완료")').waitFor();
check(psql(`select review_status from safety_checks where id = '${CHK[0]}';`) === "조치 완료", "보완 확인 → 조치 완료");
check(psql(`select string_agg(kind || coalesce(':' || result, ''), ',' order by review_no) from safety_reviews where check_id = '${CHK[0]}';`) === "관리자 확인:보완 필요,보완 제출,조치 완료 확인", "보완 요청·재확인 이력 (추가만)");
check(psql(`select count(*) from case_photos where safety_check_id = '${CHK[0]}';`) === "2", "보완 사진까지 2장");

// ── A: 작업 중 점검 (모두 확인) → 관리자 적합(육안) ──
await a.reload();
await panel.locator('button:has-text("진행 중 점검")').click();
const s2 = panel.locator('[aria-label="진행 중 점검"]');
for (const it of ["안전모 착용", "안전화 착용", "작업구역 표시·통제"]) await s2.locator(`li[aria-label="${it}"] button:text-is("확인")`).click();
await s2.locator('li[aria-label="안전대 (고소작업)"] button:text-is("해당 없음")').click();
await s2.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
await s2.locator('button:has-text("진행 중 점검 제출")').click();
await panel.locator('[role=status]:has-text("진행 중 점검")').waitFor();
const C2 = psql(`select check_no from safety_checks where worker_id = '${A_ID}' and stage = '작업 중' order by recorded_at desc limit 1;`);
const item2 = admin.locator(`li[aria-label="안전점검 ${C2}"]`);
check(await until(async () => (await item2.count()) === 1), "작업 중 점검 도착");
await item2.locator('button:has-text("적합 (육안)")').click();
await item2.locator('[role=status]:has-text("적합(육안 확인)")').waitFor();
check(await until(async () => (await panel.innerText()).includes("적합(육안 확인)"), 25000), "A 휴대폰에 '적합(육안 확인)' 결과 반영");

// ── B 차단 ──
check((await b.locator(`section[aria-label="${SA} 일정"]`).count()) === 0, "B 휴대폰에는 A의 일정·점검이 보이지 않음");
await b.goto(`${APP}/pilot/admin/safety`);
check(!new URL(b.url()).pathname.startsWith("/pilot/admin"), "B는 관리자 안전점검 화면에 들어갈 수 없음", b.url());

for (const [n, pg] of [["관리자", admin], ["A", a], ["B", b]]) check(pg.errs.length === 0, `${n} 화면 오류 없음`, pg.errs.join(" | "));
await bro.close();
console.log(process.exitCode ? "실패 있음" : "모두 통과");
