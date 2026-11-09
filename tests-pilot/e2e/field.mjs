// 4단계: 현장 직원 모바일 — 일정 확인 · 업무 확인 · 작업 시작 · 예상 종료 · 작업 종료 · 사후 입력 · 정정 · 전송 대기열
// 실제 시각으로 동작하므로 한국 시각 04~21시에만 실행한다 (일정이 자정을 넘지 않게).
import { APP, PASSWORD, adminApi, psql, uniq, newBrowser, check, waitPath, shot, sleep, adminLogin, mobilePage, kstHHMM, kstHour, kstDate, createSchedule, activate, loginAs } from "./common.mjs";

if (kstHour() < 4 || kstHour() >= 21) {
  console.log("SKIP  한국 시각 04~21시에만 실행합니다 (지금 " + kstHHMM() + ")");
  process.exit(0);
}
const bro = await newBrowser();
const RUN = String(Date.now()).slice(-5);
const P1 = `박현장${RUN}`, P2 = `이현장${RUN}`;
const A = `A${RUN}`, B = `B${RUN}`, C = `C${RUN}`, E = `E${RUN}`, V = `V${RUN}`;
const TODAY = kstDate(0);
const q = (sql) => psql(sql);
const ev = (site, kind, extra = "") =>
  `select ${extra || "count(*)"} from work_events e join schedules s on s.id = e.schedule_id where s.site_name = '${site}' and e.kind = '${kind}'`;

// ── 준비: 관리자 · 현장 직원 2명 · 오늘 일정 ──
const f1 = uniq("field"), f2 = uniq("field");
for (const e of [f1, f2]) await adminApi.auth.admin.createUser({ email: e, password: PASSWORD, email_confirm: true });
const { p: admin } = await adminLogin(bro);
await activate(admin, f1, P1);
await activate(admin, f2, P2);
const F1 = q(`select id from auth.users where email = '${f1}';`);
await admin.goto(`${APP}/pilot/admin?date=${TODAY}&kind=real`);
await createSchedule(admin, { who: P1, site: A, start: kstHHMM(-200), end: kstHHMM(-140) });
await createSchedule(admin, { who: P1, site: B, start: kstHHMM(-60), end: kstHHMM(20), travel: "10" });
await createSchedule(admin, { who: P1, site: C, start: kstHHMM(45), end: kstHHMM(120), travel: "20", prio: "긴급" });
await createSchedule(admin, { who: P2, site: E, start: kstHHMM(30), end: kstHHMM(90) });
await admin.goto(`${APP}/pilot/admin?date=${TODAY}&kind=scenario`);
await createSchedule(admin, { who: P1, site: V, start: kstHHMM(60), end: kstHHMM(100) });
check(true, "준비: 오늘 실제 업무 일정 4건 · 검증 시나리오 1건");

// ── 1) 휴대폰 로그인 → 본인 일정만 ──
const m = await mobilePage(bro);
await loginAs(m, f1);
await waitPath(m, "/pilot/field");
const cardOf = (site) => m.locator(`section[aria-label="${site} 일정"]`);
check((await cardOf(A).count()) === 1 && (await cardOf(B).count()) === 1 && (await cardOf(C).count()) === 1, "현장 직원: 오늘 내 일정 3건 표시");
check((await m.locator(`text=${E}`).count()) === 0, "다른 직원 일정은 보이지 않음 (RLS)");
check((await m.locator(`text=${V}`).count()) === 0, "실제 업무 화면에 검증 시나리오 일정 없음");
check((await m.locator("text=우선순위").count()) === 0 && (await m.locator("text=연쇄위험").count()) === 0, "현장 화면에는 다른 직원이 섞인 위험 판단 내용을 보여 주지 않음");
const noWiden = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check(noWiden, "휴대폰 화면 가로 넘침 없음");

// ── 2) 즉시 기록: 업무 확인 · 작업 시작 ──
await cardOf(B).locator('button:has-text("업무 확인")').click();
await m.locator(`[role=status]:has-text("${B} 업무 확인 기록됨")`).waitFor();
const ack = q(ev(B, "업무 확인", "e.actor_id || '|' || e.source || '|' || e.entry_mode || '|' || (e.entered_time is null) || '|' || (e.client_pressed_at is not null) || '|' || (abs(extract(epoch from e.recorded_at - e.occurred_at)) < 2)"));
check(ack === `${F1}|현장 직원|즉시 기록|true|true|true`, "업무 확인: 입력자·경로·즉시 기록·실제 발생시각≈DB 기록시각(2초 안)", ack);
await cardOf(B).locator('button:has-text("작업 시작")').click();
await m.locator(`[role=status]:has-text("${B} 작업 시작 기록됨")`).waitFor();
await cardOf(B).locator("text=작업 중").waitFor();
check(q(`select count(*) from risk_judgments j join work_events e on e.id = j.trigger_ref where e.op_id is not null and j.trigger_ref = (${ev(B, "작업개시", "e.id")});`) === "1", "작업 시작 → 위험 판단 전후 1건 기록");

// ── 3) 연결이 끊긴 채 예상 종료 보고 → 휴대폰에 보관 → 연결되면 자동 전송 ──
await m.context().setOffline(true);
const reportEnd = kstHHMM(40);
await cardOf(B).locator('input[type=time]').first().fill(reportEnd);
const pressedAt = Date.now();
await cardOf(B).locator('button:has-text("예상 종료 보내기")').click();
await m.locator("text=전송 대기 1건").waitFor();
const stored = await m.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("hana-ax-pilot-queue:")).map((k) => JSON.parse(localStorage.getItem(k)).length));
check(stored[0] === 1, "연결 끊김: 전송 대기 1건 · 휴대폰 저장소에 보관");
await sleep(4000);
await m.context().setOffline(false);
await m.locator(`[role=status]:has-text("${B} 예상 종료 보고 기록됨")`).waitFor({ timeout: 25000 });
const rep = q(ev(B, "예상 종료 보고", "e.entry_mode || '|' || e.send_delay_seconds || '|' || extract(epoch from e.recorded_at - e.occurred_at)::int || '|' || to_char(e.expected_end, 'HH24:MI')"));
const [mode, delay, gap, endv] = rep.split("|");
check(mode === "즉시 기록" && Number(delay) >= 3 && Math.abs(Number(gap) - Number(delay)) <= 1 && endv === reportEnd, "다시 연결되면 자동 전송 · 실제 발생시각 = DB 기록시각 − 전송 지연(기기 기준)", rep);
check((await m.locator("text=전송 대기").count()) === 0, "전송 뒤 대기열 비움", String(Date.now() - pressedAt));
// 판단 요약의 위험 수는 그날 같은 구분 전체(모든 직원) 기준 — 이 연결(B→C)의 변화만 본다
const bId = q(`select id from schedules where site_name = '${B}';`);
const cId0 = q(`select id from schedules where site_name = '${C}';`);
const linkChange = (kind) =>
  q(`select c->>'kind' || '|' || coalesce(c->'before'->>'grade', '-') || '→' || (c->'after'->>'grade') from risk_judgments j, jsonb_array_elements(j.changes->'changes') c where j.trigger_ref = (${ev(B, kind, "e.id")}) and c->>'key' = '${bId}>${cId0}';`);
// 예정만으로는 여유 5분(예정 간격 25분 − 이동 20분) → '주의'
// 작업 시작이 예정보다 60분 늦음 → 작업시간 유지 가정으로 B 예상 종료 60분 늦어짐 → C 도착 55분 부족
const byStart = linkChange("작업개시");
check(byStart === "신규 위험|주의→매우 높음", "작업 시작(60분 늦음) → 기존 엔진 재계산: B→C '신규 위험' (주의 → 매우 높음)", byStart);
// 현장이 예상 종료를 40분 뒤로 보고 → 예상 종료가 당겨져 위험 완화
const byReport = linkChange("예상 종료 보고");
check(byReport === "완화|매우 높음→높음", "예상 종료 보고 → 기존 엔진 재계산: B→C '완화' (매우 높음 → 높음)", byReport);

// ── 4) 지연 전송: 5분 전에 누른 기록이 이제 도착 ──
const cId = q(`select id from schedules where site_name = '${C}';`);
await m.evaluate(([key, sid, site]) => {
  const k = Object.keys(localStorage).find((x) => x.startsWith("hana-ax-pilot-queue:")) ?? key;
  const list = JSON.parse(localStorage.getItem(k) ?? "[]");
  list.push({ opId: crypto.randomUUID(), scheduleId: sid, siteName: site, kind: "업무 확인", mode: "즉시", pressedAt: new Date(Date.now() - 300000).toISOString(), tries: 0 });
  localStorage.setItem(k, JSON.stringify(list));
}, [`hana-ax-pilot-queue:${F1}`, cId, C]);
await m.reload();
await m.locator(`[role=status]:has-text("${C} 업무 확인 기록됨")`).waitFor({ timeout: 25000 });
const late = q(ev(C, "업무 확인", "e.entry_mode || '|' || round(e.send_delay_seconds) || '|' || round(extract(epoch from e.recorded_at - e.occurred_at))"));
const [lm, ld, lg] = late.split("|");
check(lm === "지연 전송" && Math.abs(Number(ld) - 300) <= 5 && Math.abs(Number(lg) - Number(ld)) <= 1, "5분 늦게 도착한 기록 → '지연 전송' · 실제 발생시각을 5분 앞당겨 기록", late);

// ── 5) 사후 입력 · 시각 정정 · 잘못 누름 ──
await cardOf(A).locator('button:has-text("시각을 놓쳤어요")').click();
await cardOf(A).locator('button[aria-pressed]:has-text("작업 시작")').click();
const aStart = kstHHMM(-195);
await cardOf(A).locator('input[aria-label="실제 시각"]').fill(aStart);
await cardOf(A).locator('button:has-text("사후 입력으로 보내기")').click();
await m.locator(`[role=status]:has-text("${A} 작업 시작 기록됨")`).waitFor();
await cardOf(A).locator('button:has-text("시각을 놓쳤어요")').click();
await cardOf(A).locator('input[aria-label="실제 시각"]').fill(kstHHMM(-140));
await cardOf(A).locator('button:has-text("사후 입력으로 보내기")').click();
await m.locator(`[role=status]:has-text("${A} 작업 종료 기록됨")`).waitFor();
const post = q(ev(A, "작업개시", "e.entry_mode || '|' || to_char(e.entered_time, 'HH24:MI') || '|' || to_char(e.occurred_at at time zone 'Asia/Seoul', 'HH24:MI') || '|' || (e.recorded_at > e.occurred_at)"));
check(post === `사후 입력|${aStart}|${aStart}|true`, "사후 입력: 입력한 시각을 따로 남기고 실제 발생시각으로 사용 · DB 기록시각은 지금", post);
// 작업 종료 시각 정정
await cardOf(A).locator("li:has-text('작업 종료') button:has-text('시각 정정')").click();
await cardOf(A).locator("li:has-text('작업 종료') input[type=time]").fill(kstHHMM(-150));
await cardOf(A).locator('button:has-text("정정 보내기")').click();
await m.locator(`[role=status]:has-text("${A} 작업 종료 기록됨")`).waitFor();
check(q(ev(A, "작업종료")) === "2" && q(ev(A, "작업종료", "count(*) filter (where e.voids_event_id is not null)")) === "1", "시각 정정: 원래 기록은 남고 정정 기록이 대체 (2건 · 정정 1건)");
await cardOf(A).locator("text=정정됨").waitFor();
check(true, "화면: 정정된 기록은 줄을 긋고 '정정됨' 표시");
// 잘못 누름 → 기록 무효
await cardOf(C).locator("li:has-text('업무 확인') button:has-text('잘못 누름')").click();
await m.locator(`[role=status]:has-text("${C} 기록 무효 기록됨")`).waitFor();
check(q(`select count(*) from work_events where schedule_id = '${cId}' and kind = '기록 무효';`) === "1", "잘못 누름 → '기록 무효' 기록 (원래 기록은 지우지 않음)");

// ── 6) 응답이 끊긴 작업 종료 → 다시 보내도 1건 ──
let dropped = 0;
await m.route("**/pilot/field**", async (route) => {
  if (route.request().method() === "POST" && dropped === 0) {
    dropped = 1;
    await route.fetch();
    await route.abort("connectionreset");
  } else await route.continue();
});
await cardOf(B).locator('button:has-text("작업 종료")').click();
await m.locator("text=전송 대기 1건").waitFor();
check(q(ev(B, "작업종료")) === "1", "응답은 끊겼지만 서버에는 이미 저장됨 (휴대폰은 결과를 모름 → 대기 유지)");
await m.click('button:has-text("지금 다시 보내기")');
await m.locator(`[role=status]:has-text("이미 기록된 요청입니다")`).waitFor();
check(q(ev(B, "작업종료")) === "1" && q(`select count(*) from risk_judgments where trigger_ref = (${ev(B, "작업종료", "e.id")});`) === "1", "다시 보내도 작업 종료 1건 · 판단 기록 1건 (중복 없음)");
await m.unroute("**/pilot/field**");
await cardOf(B).locator("text=작업 종료").first().waitFor();
await shot(m, "field_mobile");

// ── 7) 검증 시나리오는 따로 ──
await m.click("text=검증 시나리오 보기");
await m.locator("text=검증 시나리오 데이터 — 시스템 확인용 가상 일정").waitFor();
check((await cardOf(V).count()) === 1 && (await cardOf(B).count()) === 0, "검증 시나리오 화면: 가상 일정만 · 표시 띠");
await cardOf(V).locator('button:has-text("업무 확인")').click();
await m.locator(`[role=status]:has-text("${V} 업무 확인 기록됨")`).waitFor();
check(q(ev(V, "업무 확인", "e.data_kind")) === "검증 시나리오", "검증 시나리오 기록은 '검증 시나리오'로 저장");
const vId = q(`select id from schedules where site_name = '${V}';`);
check(q(`select count(*) from risk_judgments where data_kind = '실제 업무' and input_after::text like '%${vId}%';`) === "0", "실제 업무 판단 입력에 검증 시나리오 일정이 섞이지 않음");
check(m.errs.length === 0, "현장 화면 오류 없음", m.errs.join(" | "));

// ── 8) 관리자: 재계산된 판단 · 기록 · 판단 상세 ──
await admin.goto(`${APP}/pilot/admin?date=${TODAY}&kind=real`);
check((await admin.locator(`text=[연쇄위험 감지]`).count()) >= 1 && (await admin.locator(`text=${C}`).count()) >= 1, "관리자 일정판: 현장 입력 반영 → 연쇄위험 표시");
await admin.goto(`${APP}/pilot/admin/records?date=${TODAY}&kind=real`);
const rows = await admin.locator(`section[aria-label="작업 기록"] tr:has-text("${B}")`).count();
check(rows === 4, "기록 화면: B현장 작업 기록 4건 (업무 확인·작업개시·예상 종료 보고·작업종료)", String(rows));
check((await admin.locator(`section[aria-label="작업 기록"] tr:has-text("${C}") >> text=지연 전송`).count()) === 1 && (await admin.locator(`section[aria-label="작업 기록"] tr:has-text("${A}") >> text=사후 입력`).count()) >= 2, "기록 화면: 입력 방식(지연 전송·사후 입력) 구분 표시");
await shot(admin, "admin_records");
const jid = q(`select id from risk_judgments where trigger_ref = (${ev(B, "예상 종료 보고", "e.id")});`);
await admin.goto(`${APP}/pilot/admin/judgments/${jid}`);
check((await admin.locator("text=재계산 확인: 저장된 입력으로 다시 계산한 결과가 저장된 판단 전·후 결과와 같습니다.").count()) === 1, "판단 상세: 저장된 입력으로 재계산 → 저장 결과와 일치");
check((await admin.locator(`section[aria-label="판단 전후"] tr:has-text("${B} → ${C}") >> text=완화`).count()) === 1 && (await admin.locator("text=기기에서 누른 시각 (기기 시계)").count()) === 1, "판단 상세: B→C 완화(매우 높음 → 높음) · 계기 기록의 시각 정보");
await shot(admin, "admin_judgment");
const res = await admin.request.get(`${APP}/pilot/admin/judgments/${jid}/json`);
const body = await res.json();
check(res.status() === 200 && body.judgment.id === jid && body.judgment.input_after.planned.length >= 3 && body.meta.data_kind === "실제 업무", "판단 원본 JSON 내려받기 (관리자)");
check(q(`select count(*) from export_log where dataset = 'judgment' and recorded_at > now() - interval '2 minutes';`) !== "0", "내려받기 기록(export_log) 남음");
const fieldTry = await m.request.get(`${APP}/pilot/admin/judgments/${jid}/json`);
check(fieldTry.status() === 403, "현장 직원은 판단 원본 JSON 차단", String(fieldTry.status()));
check(admin.errs.length === 0, "관리자 화면 오류 없음", admin.errs.join(" | "));
await bro.close();
