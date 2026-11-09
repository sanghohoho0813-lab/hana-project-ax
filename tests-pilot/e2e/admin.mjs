// 3단계: 관리자 일정 등록 — 계정 활성화 · 일정 등록/수정/취소 · 판단 전후 기록 · 중복·충돌·재시도 · 데이터 구분
import { APP, PASSWORD, adminApi, psql, uniq, newBrowser, page, check, waitPath, shot, adminLogin, adminApiSession, kstDate } from "./common.mjs";

const bro = await newBrowser();
// 실행마다 다른 미래 날짜·이름 — 앞선 시험 기록과 섞이지 않게
const RUN = String(Date.now()).slice(-5);
const D = kstDate(2 + (Number(RUN) % 300));
const P1 = `박현장${RUN}`, P2 = `이현장${RUN}`;
const BOARD = `${APP}/pilot/admin?date=${D}&kind=scenario`;

// 현장 직원 2명 (초대 대신 발급 · 비활성으로 시작)
const f1 = uniq("field"), f2 = uniq("field");
for (const e of [f1, f2]) await adminApi.auth.admin.createUser({ email: e, password: PASSWORD, email_confirm: true });

const { p, email: adminEmail, secret } = await adminLogin(bro);
const adminId = psql(`select id from auth.users where email = '${adminEmail}';`);
const idOf = (e) => psql(`select id from auth.users where email = '${e}';`);
const F1 = idOf(f1), F2 = idOf(f2);
const q = (sql) => psql(sql);

// 1) 계정 활성화
await p.goto(`${APP}/pilot/admin/staff`);
for (const [e, name] of [[f1, P1], [f2, P2]]) {
  const row = p.locator(`form:has-text("${e}")`);
  await row.locator("input[name=display_name]").fill(name);
  await row.locator("input[name=active]").check();
  await row.locator('button:has-text("저장")').click();
  await row.locator("text=계정을 바꿨습니다.").waitFor();
}
check(q(`select string_agg(display_name || ':' || active, ',' order by display_name) from profiles where id in ('${F1}','${F2}');`) === `${P1}:true,${P2}:true`, "계정 화면에서 현장 직원 2명 활성화");
check(q(`select count(*) from profile_changes where profile_id in ('${F1}','${F2}') and changed_by = '${adminId}';`) === "2", "계정 변경 이력 2건 (바꾼 관리자 기록)");

// 2) 일정 등록 (검증 시나리오)
await p.goto(BOARD);
check((await p.locator("text=검증 시나리오 데이터 — 시스템 확인용 가상 일정").count()) === 1, "검증 시나리오 표시 띠");
const createForm = () => p.locator('form:has(button:has-text("일정 등록"))').first();
async function create({ who, site, start, end, travel = "", prio = "보통" }) {
  if ((await createForm().count()) === 0) await p.click('button:has-text("일정 등록")');
  const f = createForm();
  await f.locator("select[name=assignee_id]").selectOption({ label: who });
  await f.locator("input[name=site_name]").fill(site);
  await f.locator("input[name=planned_start]").fill(start);
  await f.locator("input[name=planned_end]").fill(end);
  await f.locator("input[name=travel_minutes]").fill(travel);
  await f.locator("select[name=priority]").selectOption(prio);
  await f.locator('button:has-text("일정 등록")').click();
  await f.locator("[role=status], [role=alert]").waitFor();
  const t = (await f.locator("[role=status], [role=alert]").innerText()).replace(/\s+/g, " ");
  return t;
}
let t = await create({ who: P1, site: "A현장", start: "09:00", end: "10:00", travel: "15" });
check(t.includes("[입력] 이 작업자의 그날 첫 일정이라") && !t.includes("다시 누르세요"), "첫 일정 이동시간 거부 (다시 보내도 같은 오류라 재시도 안내 없음)", t);
t = await create({ who: P1, site: "A현장", start: "09:00", end: "10:00" });
check(t.includes("일정을 등록했습니다.") && t.includes("위험 판단 전후 기록"), "A현장 등록 + 판단 전후 기록", t);
await p.locator("tr:has-text('A현장')").first().waitFor();
t = await create({ who: P1, site: "B현장", start: "10:30", end: "12:00", travel: "20" });
t = await create({ who: P1, site: "C현장", start: "12:30", end: "14:00", travel: "20", prio: "긴급" });
check(t.includes("일정을 등록했습니다."), "B·C현장 등록 (이동시간 20분)", t);
t = await create({ who: P2, site: "D현장", start: "09:30", end: "11:00" });
const n = q(`select count(*) from schedules where work_date = '${D}' and assignee_id in ('${F1}','${F2}');`);
check(n === "4", "일정 4건 저장", n);
check(q(`select count(*) from schedule_revisions r join schedules s on s.id = r.schedule_id where s.work_date = '${D}' and s.assignee_id in ('${F1}','${F2}');`) === "4", "수정본 4건 (등록)");
check(q(`select count(*) from risk_judgments j where j.work_date = '${D}' and j.data_kind = '검증 시나리오' and j.triggered_by = '${adminId}';`) === "4", "위험 판단 이력 4건 — 저장 1건마다 1건");
check(q(`select count(*) from judgment_jobs where work_date = '${D}' and status = '대기';`) === "0", "남은 대기 판단 없음");
check(q(`select travel_from_id = (select id from schedules where site_name = 'B현장' and work_date = '${D}' and assignee_id = '${F1}') from schedules where site_name = 'C현장' and work_date = '${D}' and assignee_id = '${F1}';`) === "t", "C현장 이동 출발 현장 = B현장 (DB가 직전 일정으로 기록)");

// 3) 수정 → 연쇄위험이 생긴다 (B 종료 12:00 → 12:20, 이동 20분 → C 도착 12:40 > 시작 12:30)
const rowB = p.locator("tr:has-text('B현장')").first();
await rowB.locator('button:has-text("고치기")').click();
const editForm = p.locator('form:has(button:has-text("고친 내용 저장"))');
// 다른 화면(두 번째 탭)에서 같은 일정을 미리 열어 둔다 — 충돌 시험
const p2 = await page(bro);
await p2.context().addCookies(await p.context().cookies());
await p2.goto(BOARD);
await p2.locator("tr:has-text('B현장')").first().locator('button:has-text("고치기")').click();
await editForm.locator("input[name=planned_end]").fill("12:20");
await editForm.locator('button:has-text("고친 내용 저장")').click();
await p.locator("text=일정을 고쳤습니다.").waitFor();
t = (await p.locator('[role=status]:has-text("일정을 고쳤습니다.")').innerText()).replace(/\s+/g, " ");
check(/위험 연결 0 → 1건/.test(t), "수정 저장 → 판단 전후: 위험 연결 0 → 1건", t);
await p.locator("text=[연쇄위험 감지]").first().waitFor();
check((await p.locator("text=[연쇄위험 감지]").count()) >= 1 && (await p.locator("text=1순위").count()) >= 1, "일정판 현재 판단에 연쇄위험·1순위 표시");
const e2 = p2.locator('form:has(button:has-text("고친 내용 저장"))');
await e2.locator("input[name=note]").fill("다른 화면에서 고침");
await e2.locator('button:has-text("고친 내용 저장")').click();
await e2.locator("[role=alert]").waitFor();
t = (await e2.locator("[role=alert]").innerText()).replace(/\s+/g, " ");
check(t.includes("[충돌]") && q(`select version from schedules where site_name = 'B현장' and work_date = '${D}';`) === "2", "다른 화면의 늦은 저장은 충돌로 거부 (덮어쓰지 않음)", t);
await p2.context().close();

// 4) 사이에 일정 추가 → C현장 이동 기준이 바뀜 (일정은 스스로 고치지 않고 알림만)
t = await create({ who: P1, site: "B2현장", start: "12:22", end: "12:28" });
await p.locator("text=직전 일정이 바뀜").first().waitFor();
check((await p.locator("tr:has-text('C현장') >> text=직전 일정이 바뀜").count()) === 1, "사이 일정 추가 → C현장에 '직전 일정이 바뀜' 알림");
check(q(`select travel_from_id = (select id from schedules where site_name = 'B현장' and work_date = '${D}') from schedules where site_name = 'C현장' and work_date = '${D}';`) === "t", "시스템이 C현장 일정을 바꾸지 않음");

// 5) 취소 → 기록은 남고 '취소'
const rowB2 = p.locator("tr:has-text('B2현장')").first();
await rowB2.locator('button:has-text("취소")').click();
await p.locator('form:has(button:has-text("일정 취소")) input[name=reason]').fill("고객 요청");
await p.click('button:has-text("일정 취소")');
await p.locator("text=일정을 취소했습니다").waitFor();
const cancelMsg = (await p.locator('[role=status]:has-text("일정을 취소했습니다")').innerText()).replace(/\s+/g, " ");
check(cancelMsg.includes("후속 현장 C현장의 실제 이동 출발지와 이동시간을 다시 확인해 주세요") && cancelMsg.includes("판단 보류"), "취소 직후 후속 현장 이동 출발지·이동시간 재확인 안내 (R7 유지)", cancelMsg);
check(
  (await p.locator("text=이동 기준 재확인 필요 1건").count()) === 1 && (await p.locator("tr:has-text('C현장') >> text=취소된 일정(B2현장) — 이동 출발지·이동시간 재확인 필요").count()) === 1,
  "일정판: '이동 기준 재확인 필요' 요약과 C현장 행 표시",
);
check(q(`select status || ':' || version from schedules where site_name = 'B2현장' and work_date = '${D}';`) === "취소:2" && (await p.locator("tr:has-text('B2현장') >> text=취소됨").count()) === 1, "B2현장 취소 (수정본 2 · 화면 '취소됨')");
check(q(`select count(*) from schedule_revisions r join schedules s on s.id = r.schedule_id where s.site_name = 'B2현장' and s.work_date = '${D}';`) === "2", "취소도 수정본으로 남음 (등록·취소 2건)");
check((await p.locator("text=사이 일정(B2현장 취소)").count()) >= 1 && (await p.locator("text=/[0-9a-f]{8}-[0-9a-f]{4}-/").count()) === 0, "취소 일정 사이 연결은 판단 보류(R7) · 화면에는 일정 번호 대신 현장 이름");

// 6) 응답이 끊겨도 다시 누르면 한 번만 저장 (같은 요청 번호)
let dropped = 0;
await p.route("**/pilot/admin**", async (route) => {
  if (route.request().method() === "POST" && dropped === 0) {
    dropped = 1;
    await route.fetch(); // 서버에는 도착해 저장된다
    await route.abort("connectionreset"); // 응답만 끊긴다
  } else await route.continue();
});
t = await create({ who: P2, site: "E현장", start: "11:30", end: "13:00", travel: "25" });
check(t.includes("서버에 연결하지 못했습니다") && t.includes("다시 누르세요"), "응답이 끊기면 '저장 여부 미확인 · 다시 누르기' 안내", t);
await createForm().locator('button:has-text("일정 등록")').click();
await createForm().locator("text=이미 저장된 요청입니다").waitFor();
check(q(`select count(*) from schedules where site_name = 'E현장' and work_date = '${D}';`) === "1", "다시 눌러도 E현장 일정은 1건 (중복 저장 없음)");
check(q(`select count(*) from risk_judgments j join schedule_revisions r on r.seq = j.seq join schedules s on s.id = r.schedule_id where s.site_name = 'E현장' and s.work_date = '${D}';`) === "1", "E현장 판단 기록도 1건");
await p.unroute("**/pilot/admin**");

// 7) 판단 기록이 실패해도 일정은 저장되고, 대기열에 남아 '다시 처리'로 기록된다
q(`update pilot_private.settings set value = 'wrong-secret-for-test-0123456789abcdef' where key = 'judge_secret';`);
t = await create({ who: P2, site: "F현장", start: "14:00", end: "15:00", travel: "10" });
check(t.includes("일정을 등록했습니다.") && t.includes("위험 판단 기록이 아직 저장되지 않았습니다"), "판단 기록 실패 → 일정은 저장 · 대기 안내", t);
check(q(`select status from judgment_jobs where work_date = '${D}' order by seq desc limit 1;`) === "대기", "판단 대기열은 남아 있음 (서명키가 틀리면 실패 표시도 서명이 필요해 기록되지 않음)");
await p.reload();
await p.click('button:has-text("다시 처리")');
await p.locator('[role=alert]:has-text("[서명]")').waitFor();
check(true, "설정이 틀린 채 다시 처리 → 관리자 화면에 원인([서명]) 표시");
q(`update pilot_private.settings set value = 'local-dev-only-judge-secret-0123456789abcdef' where key = 'judge_secret';`);
await p.reload();
await p.click('button:has-text("다시 처리")');
await p.locator("text=건을 기록했습니다").waitFor();
check(q(`select count(*) from judgment_jobs where status = '대기';`) === "0", "다시 처리 → 대기 판단 0건");

// 8) 화면을 거치지 않고 DB 에 직접 저장된 변경도 대기열에 남아 기록된다
const api = await adminApiSession(adminEmail, secret);
const r = await api.rpc("save_schedule", { p_op_id: crypto.randomUUID(), p_schedule_id: null, p_expected_version: null, p_data_kind: "검증 시나리오", p_work_date: D, p_assignee_id: F2, p_site_name: "G현장", p_region: "", p_planned_start: "16:00", p_planned_end: "17:00", p_travel_minutes: null, p_priority: "낮음", p_note: null });
check(!r.error && q(`select count(*) from judgment_jobs where status = '대기';`) === "1", "API로 저장된 변경 → 대기 판단 1건", r.error?.message);
await p.reload();
check((await p.locator("text=기록 대기 판단 1건 다시 처리").count()) === 1, "일정판에 대기 판단 표시");
await p.click('button:has-text("다시 처리")');
await p.locator("text=1건 중 1건을 기록했습니다").waitFor();
check(true, "다시 처리로 기록");

// 9) 데이터 구분: 실제 업무 화면에는 검증 시나리오 일정이 보이지 않는다
await p.goto(`${APP}/pilot/admin?date=${D}&kind=real`);
check((await p.locator("text=실제 업무 데이터 — 실제 현장 업무로 입력된").count()) === 1 && (await p.locator("tr:has-text('A현장')").count()) === 0, "실제 업무 화면에는 검증 시나리오 일정 없음");
await p.goto(BOARD);
await shot(p, "admin_board");
check(p.errs.length === 0, "관리자 화면 오류 없음", p.errs.join(" | "));

// 10) 현장 직원은 관리자 화면·계정 화면에 들어갈 수 없다
const fp = await page(bro);
await fp.goto(APP + "/pilot/login");
await fp.fill("input[name=email]", f1);
await fp.fill("input[name=password]", PASSWORD);
await fp.click('button:has-text("로그인")');
await waitPath(fp, "/pilot/field");
await fp.goto(`${APP}/pilot/admin/staff`);
check(!fp.url().includes("/admin"), "현장 직원은 계정 화면 차단", fp.url());
await bro.close();
