-- 로컬 개발 전용 (supabase db reset 때만 실행 — 운영 프로젝트에는 쓰지 않는다)
-- 판단 기록 서명키: 운영에서는 길고 무작위인 값을 따로 넣고 Vercel 의 PILOT_JUDGE_SECRET 과 같게 맞춘다.
insert into pilot_private.settings (key, value)
values ('judge_secret', 'local-dev-only-judge-secret-0123456789abcdef')
on conflict (key) do update set value = excluded.value;
