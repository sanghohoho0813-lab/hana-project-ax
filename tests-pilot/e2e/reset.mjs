import { APP, PASSWORD, adminApi, uniq, mailLink, newBrowser, page, check, waitPath } from './common.mjs';
const bro = await newBrowser();
const email = uniq('reset');
await adminApi.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
const p = await page(bro);
await p.goto(APP + '/pilot/login'); await p.click('button:has-text("비밀번호를 잊었어요")');
await p.fill('input[placeholder="계정 이메일"]', email); await p.click('button:has-text("재설정 메일 받기")');
await p.waitForSelector('text=등록된 주소라면 재설정 메일을 보냈습니다'); check(true, '재설정 요청 안내 (가입 여부 비공개)');
// 없는 주소도 같은 문장
await p.fill('input[placeholder="계정 이메일"]', uniq('nobody')); await p.click('button:has-text("재설정 메일 받기")');
await p.waitForSelector('text=등록된 주소라면 재설정 메일을 보냈습니다'); check(true, '없는 주소에도 같은 안내');
const { href, subject } = await mailLink(email, 'recovery'); check(href.startsWith(APP + '/pilot/auth/confirm?token_hash='), '재설정 메일 링크 형식', subject);
await p.goto(href); await waitPath(p, '/pilot/account/password'); check(true, '재설정 링크 → 비밀번호 정하기');
await p.fill('input[name=password]', 'Reset-Pass-2026'); await p.fill('input[name=confirm]', 'Reset-Pass-2026'); await p.click('button:has-text("비밀번호 저장")');
await p.waitForSelector('text=계정이 아직 활성화되지 않았습니다'); check(true, '새 비밀번호 저장');
await p.click('button:has-text("로그아웃")'); await waitPath(p, '/pilot/login');
await p.fill('input[name=email]', email); await p.fill('input[name=password]', PASSWORD); await p.click('button:has-text("로그인")');
await p.waitForSelector('text=이메일 또는 비밀번호가 맞지 않습니다'); check(true, '옛 비밀번호 거부');
await p.fill('input[name=password]', 'Reset-Pass-2026'); await p.click('button:has-text("로그인")');
await p.waitForSelector('text=계정이 아직 활성화되지 않았습니다'); check(true, '새 비밀번호로 로그인 (이메일 칸 유지)');
{ const q = await page(bro); await q.goto(href); await waitPath(q, '/pilot/login'); check(q.url().includes('error=link') && (await q.locator('text=이미 쓴 링크').count()) > 0, '한 번 쓴 링크 재사용 거부 (새 브라우저)', q.url()); }
check(p.errs.length === 0, '화면 오류 없음', p.errs.join(' | '));
await bro.close();
