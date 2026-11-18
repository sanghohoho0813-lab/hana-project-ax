// 0.6.1 안정화 — Supabase 운영 연결 전 점검 (로컬 DB · 한 컴퓨터의 브라우저 세션 · 실제 휴대폰 시험 아님)
// B 사진: 촬영정보를 지울 수 없는 형식(HEIC 흉내)은 올리지 않음 · 사진 없는 점검은 '낸 것'으로 세지 않음 ·
//         저장소 실패 → 응답 끊김 → 다시 올리기에도 사진 한 건 · 올라간 파일에 촬영정보(Exif) 없음
// C 안전: 시작 전 점검에 '미흡'이 남아 있으면 작업 시작 전에 한 번 더 묻는다
// A 연결: 자동 갱신 확인 실패(서버 오류 · 로그인 만료 · 오프라인)를 숨기지 않고 보여 주고, '지금 확인'으로 복구
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP, PASSWORD, adminApi, psql, uniq, newBrowser, check, waitPath, adminLogin, mobilePage, kstHHMM, kstHour, kstDate, createSchedule, activate, loginAs } from "./common.mjs";

if (kstHour() < 4 || kstHour() >= 21) {
  console.log("SKIP  한국 시각 04~21시에만 실행합니다 (지금 " + kstHHMM() + ")");
  process.exit(0);
}
const bro = await newBrowser();
const RUN = String(Date.now()).slice(-5);
const P = `안정${RUN}`;
const S1 = `사진현장${RUN}`, S2 = `미흡현장${RUN}`;
const D = kstDate(0);
const KIND = "scenario";
const until = async (fn, ms = 20000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

// ── 준비 ──
const f = uniq("stable");
await adminApi.auth.admin.createUser({ email: f, password: PASSWORD, email_confirm: true });
const { p: admin } = await adminLogin(bro, `본사${RUN}`);
await activate(admin, f, P);
await admin.goto(`${APP}/pilot/admin/schedule?date=${D}&kind=${KIND}`);
await createSchedule(admin, { who: P, site: S1, start: kstHHMM(10), end: kstHHMM(60) });
await createSchedule(admin, { who: P, site: S2, start: kstHHMM(90), end: kstHHMM(140), travel: "10" });

// 시험 사진: 실제 JPEG(화면 캡처)에 촬영정보(Exif · GPS 글자) 구간을 끼워 넣은 것
const shot = await admin.screenshot({ type: "jpeg", quality: 60, clip: { x: 0, y: 0, width: 320, height: 240 } });
const exifBody = Buffer.concat([Buffer.from("Exif\0\0"), Buffer.from("MM\0*GPSLatitude 36.33N GPSLongitude 126.61E")]);
const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exifBody.length + 2) >> 8, (exifBody.length + 2) & 0xff]), exifBody]);
const PHOTO = join(tmpdir(), `stable-exif-${RUN}.jpg`);
writeFileSync(PHOTO, Buffer.concat([shot.subarray(0, 2), app1, shot.subarray(2)]));
check(Buffer.concat([shot.subarray(0, 2), app1, shot.subarray(2)]).includes("GPSLatitude"), "준비: 촬영정보(GPS 글자)가 든 시험 JPEG");
const HEIC = join(tmpdir(), `stable-${RUN}.heic`);
writeFileSync(HEIC, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheicmif1heic"), Buffer.alloc(64, 7)]));

const m = await mobilePage(bro);
await loginAs(m, f);
await waitPath(m, "/pilot/field");
await m.goto(`${APP}/pilot/field?date=${D}&kind=${KIND}`);
const card = (s) => m.locator(`section[aria-label="${s} 일정"]`);
const panel = (s) => card(s).locator('[aria-label="안전점검"]');
const gate = m.locator('[role=dialog][aria-label="안전점검 확인"]');
await card(S1).waitFor();

// ── B-1: 촬영정보를 지울 수 없는 사진은 올리지 않는다 (원본 업로드 금지) ──
await panel(S1).locator('button:has-text("시작 전 점검")').click();
const pre = panel(S1).locator('[aria-label="시작 전 점검"]');
for (const it of ["안전모 착용", "안전화 착용", "작업구역 표시·통제"]) await pre.locator(`li[aria-label="${it}"] button:text-is("확인")`).click();
await pre.locator('input[aria-label="안전점검 사진"]').setInputFiles({ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheicmif1heic"), Buffer.alloc(64, 7)]) });
await pre.locator('button:has-text("시작 전 점검 제출")').click();
check(await until(async () => (await pre.locator("text=점검은 저장됐지만 사진을 올리지 못했습니다").count()) === 1), "HEIC 등 촬영정보를 지울 수 없는 사진 → 점검은 저장, 사진은 올리지 않음 · 다시 올리라고 안내");
const reason = await pre.locator('[aria-label="사진 실패 이유"]').innerText().catch(() => "");
check(reason.includes("촬영정보(위치 등)를 지울 수 없어 올리지 않았습니다"), "사진별 실패 이유 표시 (다른 사진 · 카메라 설정 안내)", reason.replace(/\s+/g, " ").slice(0, 120));
const CHK1 = psql(`select c.id from safety_checks c join schedules s on s.id = c.schedule_id where s.site_name = '${S1}' and c.stage = '작업 전';`);
const photoRows = () => psql(`select count(*) from case_photos where safety_check_id = '${CHK1}' and deleted_at is null;`);
const objects = () => psql(`select count(*) from storage.objects where bucket_id = 'field-photos' and name like '%/safety-${CHK1}/%';`);
check(photoRows() === "0" && objects() === "0", "DB · 저장소에 사진 없음 (원본이 올라가지 않음)", `${photoRows()} / ${objects()}`);

// ── B-2: 사진 없는 점검은 '낸 것'으로 세지 않는다 ──
await pre.locator('button:has-text("닫기")').click();
await m.reload();
await card(S1).waitFor();
check((await panel(S1).locator('button:has-text("시작 전 점검")').innerText()).includes("사진 없음"), "현장: 시작 전 점검 칸에 '사진 없음'");
const retry = panel(S1).locator('[aria-label^="사진 없는 점검 "]');
check((await retry.count()) === 1, "현장: 사진만 다시 올리는 칸이 나타남 (점검을 다시 하지 않음)");
await card(S1).locator('button:has-text("작업 시작")').first().click();
check(await until(async () => (await gate.innerText()).includes("시작 전 안전점검을 먼저 보내 주세요")), "사진 없는 점검만 있으면 작업 시작 전에 여전히 점검을 권함");
await m.mouse.click(8, 8); // 창 바깥 — 닫기
await gate.waitFor({ state: "detached" });
await admin.goto(`${APP}/pilot/admin?date=${D}&kind=${KIND}`);
const safeItems = (await admin.locator(`section[aria-label="안전 확인 필요"] li[aria-label="안전 ${S1}"]`).allInnerTexts()).join(" / ").replace(/\s+/g, " ");
check(safeItems.includes("사진 없음") && safeItems.includes("사진이 올라가지 않음"), "관리자 대시보드: '사진 없음' (업로드 실패 가능 · 다시 올리기 요청)", safeItems.slice(0, 160));
await admin.goto(`${APP}/pilot/admin/safety?date=${D}&kind=${KIND}`);
const row1 = (await admin.locator(`section[aria-label="현장별 3단계 현황"] tr:has-text("${S1}")`).innerText()).replace(/\s+/g, " ");
check(row1.includes("사진 없음"), "관리자 안전관리 표: '사진 없음'", row1);

// ── B-3: 저장소 실패 → 응답 끊김 → 다시 올리기 = 사진 한 건 · 촬영정보 없음 ──
await retry.locator('input[aria-label="다시 올릴 착용 사진"]').setInputFiles(PHOTO);
await retry.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await m.route("**/storage/v1/object/**", (r) => r.abort("connectionreset"));
await retry.locator('button:has-text("사진 올리기")').click();
check(await until(async () => (await retry.locator("text=사진을 올리지 못했습니다").count()) >= 1), "1차: 저장소 연결 실패 → 실패 안내");
check(photoRows() === "0", "1차 뒤 사진 기록 0건");
await m.unroute("**/storage/v1/object/**");
let dropped = 0;
await m.route("**/pilot/field**", async (route) => {
  if (route.request().method() === "POST" && dropped === 0) {
    dropped = 1;
    await route.fetch(); // 서버에서는 기록됨
    await route.abort("connectionreset"); // 응답만 끊김
  } else await route.continue();
});
await retry.locator('button:has-text("사진 올리기")').click();
check(await until(async () => dropped === 1 && (await retry.locator("text=사진을 올리지 못했습니다").count()) >= 1), "2차: 올라가고 기록됐지만 응답이 끊김 → 화면은 실패로 안내");
await m.unroute("**/pilot/field**");
await retry.locator('button:has-text("사진 올리기")').click();
check(await until(async () => (await panel(S1).locator('[role=status]:has-text("사진 1장 올림")').count()) === 1), "3차: 다시 올리기 성공");
check(photoRows() === "1" && objects() === "1", "세 번 눌러도 사진 기록 1건 · 저장소 파일 1개 (같은 위치 · 같은 요청 번호)", `${photoRows()} / ${objects()}`);
const ph = psql(`select object_path || '|' || exif_removed from case_photos where safety_check_id = '${CHK1}';`).split("|");
const { data: blob } = await adminApi.storage.from("field-photos").download(ph[0]);
const bytes = Buffer.from(await blob.arrayBuffer());
check(ph[1] === "true" && !bytes.includes("GPSLatitude") && !bytes.includes("Exif"), "올라간 파일에 촬영정보(Exif · GPS) 없음 · 기록도 '촬영정보 제거'", `exif_removed=${ph[1]} · ${bytes.length}바이트`);
await m.reload();
await card(S1).waitFor();
check((await panel(S1).locator('button:has-text("시작 전 점검")').innerText()).includes("확인 대기") && (await panel(S1).locator('[aria-label^="사진 없는 점검 "]').count()) === 0, "사진이 올라가면 '확인 대기'로 바뀌고 다시 올리기 칸이 사라짐");
await card(S1).locator('button:has-text("작업 시작")').first().click();
await m.locator(`[role=status]:has-text("${S1} 작업 시작 기록됨")`).waitFor();
check((await gate.count()) === 0, "사진이 있는 시작 전 점검 뒤에는 묻지 않고 작업 시작");

// ── C: 시작 전 점검에 '미흡'이 남아 있으면 작업 시작 전에 한 번 더 묻는다 ──
await panel(S2).locator('button:has-text("시작 전 점검")').click();
const pre2 = panel(S2).locator('[aria-label="시작 전 점검"]');
await pre2.locator('li[aria-label="안전모 착용"] button:text-is("확인")').click();
await pre2.locator('li[aria-label="안전화 착용"] button:text-is("확인")').click();
await pre2.locator('li[aria-label="작업구역 표시·통제"] button:text-is("미흡")').click();
await pre2.locator('input[aria-label="안전점검 사진"]').setInputFiles(PHOTO);
await pre2.locator('ul[aria-label="첨부할 사진"] img').waitFor();
await pre2.locator('button:has-text("시작 전 점검 제출")').click();
await panel(S2).locator('[role=status]:has-text("시작 전 점검")').waitFor({ timeout: 30000 });
await m.waitForTimeout(800);
await card(S2).locator('button:has-text("작업 시작")').first().click();
check(await until(async () => (await gate.innerText()).includes("미흡") && (await gate.innerText()).includes("작업구역 표시·통제")), "미흡이 남은 채 작업 시작 → '미흡이 남아 있습니다' (미흡 항목 · 바로 전화 안내)");
await gate.locator('button:has-text("작업 시작 안 함")').click();
check(psql(`select count(*) from work_events e join schedules s on s.id = e.schedule_id where s.site_name = '${S2}' and e.kind = '작업개시';`) === "0", "'작업 시작 안 함' → 작업 시작이 기록되지 않음");

// ── A: 자동 갱신 연결 상태 ──
await admin.goto(`${APP}/pilot/admin?date=${D}&kind=${KIND}`);
const ar = admin.locator("[data-auto-refresh]").first();
check(await until(async () => (await ar.getAttribute("data-conn")) === "ok"), "관리자: 첫 확인 성공 → 정상 표시", (await ar.innerText()).replace(/\s+/g, " "));
check((await ar.innerText()).includes("초마다 확인"), "주기 확인이라는 표시 (실시간 감시라고 쓰지 않음)");
await admin.route("**/pilot/changes", (r) => r.fulfill({ status: 500, body: "{}" }));
await ar.locator('button:has-text("지금 확인")').click();
check(await until(async () => (await ar.getAttribute("data-conn")) === "error"), "서버 확인 실패 → 숨기지 않고 표시");
const errText = (await ar.innerText()).replace(/\s+/g, " ");
check(errText.includes("서버 확인 실패 1번") && errText.includes("마지막 정상 확인") && errText.includes("늦게 보일 수 있습니다"), "실패 횟수 · 마지막 정상 확인 시각 · '늦게 보일 수 있음' 안내", errText.slice(0, 160));
await admin.unroute("**/pilot/changes");
await admin.route("**/pilot/changes", (r) => r.fulfill({ status: 401, contentType: "application/json", body: '{"v":null}' }));
await ar.locator('button:has-text("지금 확인")').click();
check(await until(async () => (await ar.getAttribute("data-conn")) === "auth" && (await ar.locator('a:has-text("다시 로그인")').count()) === 1), "로그인 만료(401) → '다시 로그인' 안내");
await admin.unroute("**/pilot/changes");
await admin.context().setOffline(true);
check(await until(async () => (await ar.getAttribute("data-conn")) === "offline" && (await ar.innerText()).includes("인터넷 연결 끊김")), "인터넷 끊김 → '인터넷 연결 끊김'");
await admin.context().setOffline(false);
check(await until(async () => (await ar.getAttribute("data-conn")) === "ok", 30000), "연결이 돌아오면 자동으로 다시 확인 → 정상", (await ar.innerText()).replace(/\s+/g, " "));

check(m.errs.length === 0 && admin.errs.length === 0, "화면 오류 없음", [...m.errs, ...admin.errs].join(" / "));
await bro.close();
