-- ════════════════════════════════════════════════════════════════════════
-- 판단 기록 서명키 만들기 — 01_apply_all_migrations.sql 을 적용한 뒤 한 번만 실행
--
--  1) Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여 넣고 Run
--  2) 결과 칸의 64자 값을 복사해 Vercel → Settings → Environment Variables 의 PILOT_JUDGE_SECRET 값으로 붙여 넣습니다.
--  3) 이 값은 채팅 · 메일 · 메신저 · 문서 · GitHub 에 붙여 넣지 마세요. 값을 저장한 뒤 SQL Editor 탭을 닫습니다.
--
--  - 이미 서명키가 있으면 새로 만들지 않고 기존 값을 보여 줍니다 (Vercel 값과 맞추는 용도).
--  - 개발용 값(local-dev-only-…)이나 32자보다 짧은 값이 들어 있으면 운영용 무작위 값으로 바꿉니다 (seed.sql 이 실수로 들어간 경우 등).
--  - 이 키로 할 수 있는 일은 '판단 대기열 1건의 입력 읽기 · 결과 기록 · 실패 표시'뿐입니다.
-- ════════════════════════════════════════════════════════════════════════

insert into pilot_private.settings (key, value)
values ('judge_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do update
  set value = case when pilot_private.settings.value like 'local-dev-only%' or char_length(pilot_private.settings.value) < 32 then excluded.value
                    else pilot_private.settings.value end;

select value as "PILOT_JUDGE_SECRET 에 넣을 값", char_length(value) as "글자 수"
from pilot_private.settings
where key = 'judge_secret';
