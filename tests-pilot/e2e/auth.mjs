import { APP, PASSWORD, adminApi, psql, uniq, totp, mailLink, newBrowser, page, check, userClient, waitPath, shot } from './common.mjs';
const bro = await newBrowser();
// 1) 비로그인 차단 · 보안 헤더 · 데모 영향 없음
{ const p = await page(bro);
  const r = await p.goto(APP + '/pilot/admin'); check(p.url().endsWith('/pilot/login'), '비로그인으로 관리자 화면 → 로그인 화면', p.url());
  const h = r.headers(); check(h['cache-control']?.includes('no-store') && h['x-frame-options'] === 'DENY', '실증 화면 보안 헤더', `${h['cache-control']} · ${h['x-frame-options']}`);
  const d = await p.goto(APP + '/schedule'); check(d.status() === 200 && (await p.locator('text=위험 판단과 대응 우선순위').count()) > 0, '데모 통합일정 화면 그대로');
  check(!('x-frame-options' in d.headers()), '데모 화면에는 실증 헤더를 붙이지 않음');
  await p.context().close(); }
// 2) 관리자: 발급 계정 → 최초 관리자 지정 → 로그인 → 2단계 인증 등록 → 관리자 화면
const adminEmail = uniq('admin');
await adminApi.auth.admin.createUser({ email: adminEmail, password: PASSWORD, email_confirm: true });
psql(`select pilot_private.bootstrap_admin('${adminEmail}', '김관리');`);
let adminSecret;
{ const p = await page(bro);
  await p.goto(APP + '/pilot/login'); await p.fill('input[name=email]', adminEmail); await p.fill('input[name=password]', 'Wrong-Pass-123');
  await p.click('button:has-text("로그인")'); await p.waitForSelector('text=이메일 또는 비밀번호가 맞지 않습니다'); check(true, '틀린 비밀번호 안내');
  await p.fill('input[name=password]', PASSWORD); await p.click('button:has-text("로그인")');
  await waitPath(p, '/pilot/account/mfa'); check(true, '관리자 비밀번호 로그인 → 2단계 인증 화면');
  await p.goto(APP + '/pilot/admin'); check(p.url().endsWith('/pilot/account/mfa'), '2단계 인증 전에는 관리자 화면 대신 인증 화면');
  await p.click('button:has-text("2단계 인증 등록 시작")'); await p.waitForSelector('img[alt="2단계 인증 등록 QR 코드"]');
  adminSecret = (await p.locator('text=설정 키:').innerText()).replace('설정 키:', '').trim();
  await p.fill('input[name=code]', '000000'); await p.click('button:has-text("확인")'); await p.waitForSelector('text=인증 코드가 맞지 않거나'); check(true, '틀린 인증 코드 거부');
  await p.fill('input[name=code]', totp(adminSecret)); await p.click('button:has-text("확인")');
  await waitPath(p, '/pilot/admin'); check((await p.locator('h1').innerText()).includes('관리자 일정판'), '인증 코드 확인 → 관리자 일정판');
  await shot(p, 'auth_admin');
  // 로그아웃 후 다시 로그인하면 등록된 인증 앱 코드만 묻는다
  await p.click('button:has-text("로그아웃")'); await waitPath(p, '/pilot/login');
  await p.fill('input[name=email]', adminEmail); await p.fill('input[name=password]', PASSWORD); await p.click('button:has-text("로그인")');
  await waitPath(p, '/pilot/account/mfa'); check((await p.locator('button:has-text("2단계 인증 등록 시작")').count()) === 0, '재로그인 시 등록 없이 코드만 확인');
  await new Promise((r) => setTimeout(r, 31000)); // 같은 30초 코드 재사용을 피한다
  await p.fill('input[name=code]', totp(adminSecret)); await p.click('button:has-text("확인")'); await waitPath(p, '/pilot/admin'); check(true, '재로그인 2단계 인증 통과');
  check(p.errs.length === 0, '관리자 흐름 화면 오류 없음', p.errs.join(' | '));
  await p.context().close(); }
// 3) 현장 직원: 초대 메일 → 링크 → 비밀번호 → 비활성 안내 → 활성화 → 현장 화면 · 관리자 화면 차단
const fieldEmail = uniq('field');
const inv = await adminApi.auth.admin.inviteUserByEmail(fieldEmail); check(!inv.error, '관리자가 현장 직원 초대 (대시보드와 같은 기능)', inv.error?.message);
const { href, subject } = await mailLink(fieldEmail, 'invite'); check(href.startsWith(APP + '/pilot/auth/confirm?token_hash='), '초대 메일 링크 형식', subject);
{ const p = await page(bro);
  await p.goto(href); await waitPath(p, '/pilot/account/password'); check(true, '초대 링크 → 비밀번호 정하기');
  await p.fill('input[name=password]', 'short'); await p.fill('input[name=confirm]', 'short');
  await p.locator('form:has(input[name=confirm])').evaluate((f) => f.noValidate = true); await p.click('button:has-text("비밀번호 저장")');
  await p.waitForSelector('p.text-danger:has-text("비밀번호는 10자 이상이며")'); check(true, '약한 비밀번호 거부 (서버 정책)');
  await p.fill('input[name=password]', 'Field-Pass-2026'); await p.fill('input[name=confirm]', 'Field-Pass-2026'); await p.click('button:has-text("비밀번호 저장")');
  await p.waitForSelector('text=계정이 아직 활성화되지 않았습니다'); check(true, '비밀번호 설정 → 비활성 안내 (관리자 활성화 전)');
  await p.goto(APP + '/pilot/field'); check(p.url().endsWith('/pilot'), '비활성 계정은 현장 화면 불가');
  // 관리자가 활성화 (관리자 화면 기능은 다음 단계 — 여기서는 같은 DB 함수를 관리자 세션으로 호출)
  const ac = await userClient(adminEmail); const { data: f } = await ac.auth.mfa.listFactors();
  await new Promise((r) => setTimeout(r, 31000));
  await ac.auth.mfa.challengeAndVerify({ factorId: f.totp[0].id, code: totp(adminSecret) });
  const { data: u } = await adminApi.auth.admin.listUsers(); const fid = u.users.find((x) => x.email === fieldEmail).id;
  const r = await ac.rpc('admin_set_profile', { p_user_id: fid, p_display_name: '박현장', p_role: 'field', p_active: true }); check(!r.error, '관리자 활성화', r.error?.message);
  await p.goto(APP + '/pilot'); await waitPath(p, '/pilot/field'); check((await p.locator('h1').innerText()).includes('박현장'), '활성화 후 현장 화면');
  await p.goto(APP + '/pilot/admin'); check(p.url().endsWith('/pilot/field') || p.url().endsWith('/pilot'), '현장 직원은 관리자 화면 차단', p.url());
  check(p.errs.length === 0, '현장 흐름 화면 오류 없음', p.errs.join(' | '));
  await p.context().close(); }
await bro.close();
