// 현장 실사용 3차 — 성과 측정 화면: 사건 측정(1~6) 표시 · 수기/AX 측정(앱 측정기) · 현장기사 의견 → 관리자 개선 반영 연결 · CSV
// (같은 날 사건 시험(cases.mjs)이 남긴 검증 시나리오 사건이 있으면 그 측정값을 보여 준다 — 없으면 '측정 없음')
import { APP, PASSWORD, adminApi, psql, uniq, newBrowser, mobilePage, check, waitPath, adminLogin, activate, loginAs, kstDate } from "./common.mjs";

const RUN = String(Date.now()).slice(-5);
const D = kstDate(0);
const bro = await newBrowser();
const fa = uniq("measure");
await adminApi.auth.admin.createUser({ email: fa, password: PASSWORD, email_confirm: true });
const { p: admin } = await adminLogin(bro, `측정관리${RUN}`);
await activate(admin, fa, `측정기사${RUN}`);

// 현장기사 의견 보내기 (휴대폰)
const f = await mobilePage(bro);
await loginAs(f, fa);
await waitPath(f, "/pilot/field");
const fb = f.locator('[aria-label="의견·오류 보내기"]');
await fb.locator('button:has-text("프로그램 의견 · 오류 보내기")').click();
await fb.locator('textarea[aria-label="의견 내용"]').fill(`사진 버튼을 더 크게 해 주세요 ${RUN}`);
await fb.locator('button:has-text("보내기")').last().click();
await fb.locator('[role=status]:has-text("보냈습니다")').waitFor();
check(psql(`select kind || '|' || confirmation || '|' || source from pilot_notes where text like '%${RUN}';`) === "현장기사 의견|본인이 직접 입력|현장 직원", "현장기사 의견 저장 (본인 입력 · 출처 현장 직원)");

// 관리자 성과 측정 화면
await admin.goto(`${APP}/pilot/admin/measures?kind=scenario&from=${D}&to=${D}`);
const page = await admin.locator("main").innerText();
for (const h of ["현장정보 재현시험 결과", "가상 시나리오 결과 (실제 효과 아님)", "사건별 측정 (측정 1~6)", "측정 7 — 수기 방식 vs AX 방식", "측정 8·9"]) check(page.includes(h), `성과 측정 화면: ${h}`);
check(page.includes("개선율·절감효과를 계산해 만들지 않습니다"), "측정값만 · 개선율을 만들지 않는다는 안내");
const nCases = Number(psql(`select count(*) from field_cases where data_kind = '검증 시나리오' and work_date = '${D}';`));
const rows = await admin.locator('section[aria-label="사건별 측정"] tbody tr').count();
check(rows === nCases, "사건별 측정: 그날 검증 시나리오 사건 수와 같음", `${rows}/${nCases}`);

// 수기 측정 (앱 측정기) — 같은 묶음 AX 측정
const tf = admin.locator('[aria-label="수기·AX 측정 입력"]');
async function trial(method, waitMs) {
  await tf.locator(`[aria-label="자료 구분"] button:text-is("${method === "수기" ? "수기 (기존 방식)" : "AX 시스템"}")`).click();
  await tf.locator('button:text-is("시작")').click();
  await admin.waitForTimeout(waitMs);
  await tf.locator('button:text-is("위험 파악 끝")').click();
  await tf.locator('input[aria-label="시나리오"]').fill(`I3 지원 요청 지연 ${RUN}`);
  await tf.locator('input[aria-label="대응 묶음"]').fill(`I3-${RUN}`);
  await tf.locator('input[aria-label="정확히 찾은 위험"]').fill(method === "수기" ? "1" : "2");
  await tf.locator('input[aria-label="정답 위험 수"]').fill("2");
  await tf.locator('button:has-text("측정 저장")').click();
  await tf.locator('[role=status]:has-text("측정 #")').waitFor();
  await admin.waitForTimeout(500);
}
await trial("수기", 2200);
await trial("AX", 1100);
const tr = psql(`select string_agg(method || ':' || find_sec || ':' || correct || '/' || expected || ':' || measure_method, ',' order by trial_no) from pilot_trials where scenario like '%${RUN}';`);
check(/^수기:2\.\d:1\/2:앱 측정기,AX:1\.\d:2\/2:앱 측정기$/.test(tr), "수기·AX 측정 저장 (앱 측정기 초 · 정확/정답)", tr);
await admin.reload();
const cmp = await admin.locator('section[aria-label="수기 대 AX"]').innerText();
check(cmp.includes("이번 측정값") && cmp.includes("통계적 유의성 검정 아님"), "같은 자료 구분에서 수기·AX가 모두 있을 때만 비교 · 유의성 검정 아님 표시");

// 개선 반영 — 현장기사 의견에 연결
const nf = admin.locator('[aria-label="의견·오류·개선 입력"]');
await nf.locator('[aria-label="종류"] button:text-is("개선 반영")').click();
await nf.locator('textarea[aria-label="내용"]').fill(`사진 버튼 크기 키움 ${RUN}`);
const opt = await nf.locator('select[aria-label="원래 기록"] option', { hasText: `사진 버튼을 더 크게 해 주세요 ${RUN}` }).getAttribute("value");
await nf.locator('select[aria-label="원래 기록"]').selectOption(opt);
await nf.locator('input[aria-label="바뀐 날짜"]').fill(D);
await nf.locator('button:has-text("기록 저장")').click();
await nf.locator('[role=status]:has-text("기록 #")').waitFor();
check(psql(`select (ref_note_id = (select id from pilot_notes where text = '사진 버튼을 더 크게 해 주세요 ${RUN}'))::text || '|' || dev_date || '|' || (dev_version like '0.3.0+%')::text from pilot_notes where text = '사진 버튼 크기 키움 ${RUN}';`) === `true|${D}|true`, "개선 반영: 원래 의견 · 반영 날짜 · 프로그램 버전 연결");

// CSV
for (const t of ["cases", "trials", "notes"]) {
  const r = await admin.request.get(`${APP}/pilot/admin/measures/export?type=${t}&kind=scenario&from=${D}&to=${D}`);
  const body = await r.text();
  check(r.status() === 200 && body.startsWith("﻿") && body.split("\r\n").length > 2, `CSV 내보내기 (${t})`, `${r.status()} · ${body.split("\r\n").length - 2}행`);
}
const denied = await f.request.get(`${APP}/pilot/admin/measures/export?type=notes`);
check(denied.status() === 403, "현장기사는 측정 CSV를 받을 수 없음 (403)");
for (const [n, pg] of [["관리자", admin], ["현장기사", f]]) check(pg.errs.length === 0, `${n} 화면 오류 없음`, pg.errs.join(" | "));
await bro.close();
console.log(process.exitCode ? "실패 있음" : "모두 통과");
