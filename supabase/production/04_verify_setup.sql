-- ════════════════════════════════════════════════════════════════════════
-- 운영 DB 설정 점검 — 읽기만 합니다 (아무것도 바꾸지 않음). 설정 뒤 · 배포 전후에 언제든 다시 실행해도 됩니다.
-- Supabase 대시보드 → SQL Editor → New query → 붙여 넣고 Run → '결과'가 모두 '정상'인지 봅니다.
-- 서명키 값은 보여 주지 않습니다 (길이와 개발용 값 여부만).
-- ════════════════════════════════════════════════════════════════════════

with t(name) as (
  values ('profiles'), ('profile_changes'), ('schedules'), ('schedule_revisions'), ('work_events'), ('judgment_jobs'), ('risk_judgments'),
         ('export_log'), ('field_cases'), ('case_steps'), ('case_photos'), ('safety_checks'), ('safety_reviews'), ('pilot_trials'), ('pilot_notes')
),
f(name) as (
  values ('report_case'), ('report_case_with_source'), ('case_step'), ('case_adjust_schedule'), ('case_expected_end'), ('attach_case_photo'),
         ('mark_photo_deleted'), ('submit_safety_check'), ('safety_review'), ('attach_safety_photo'), ('add_trial'), ('void_trial'), ('add_note'),
         ('save_schedule'), ('record_work_event'), ('judge_inputs'), ('judge_complete'), ('judge_fail'), ('pilot_is_admin'), ('pilot_is_field')
),
checks(no, item, ok, detail) as (
  select 1, '적용된 묶음', exists (select 1 from pilot_private.settings where key = 'schema_bundle'),
         coalesce((select value from pilot_private.settings where key = 'schema_bundle'), '01_apply_all_migrations.sql 미적용')
  union all
  select 2, '표 15개', (select count(*) from t join pg_tables p on p.schemaname = 'public' and p.tablename = t.name) = 15,
         (select count(*) from t join pg_tables p on p.schemaname = 'public' and p.tablename = t.name)::text || ' / 15'
  union all
  select 3, '모든 public 표에 RLS 켜짐', not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
         coalesce((select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity), '꺼진 표 없음')
  union all
  select 4, '익명(anon)은 표를 읽거나 쓸 수 없음',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
                     where c.relkind = 'r' and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert'))),
         coalesce((select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
                   where c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select')), '없음')
  union all
  select 5, '쓰기 함수 20개', (select count(distinct f.name) from f join pg_proc pr on pr.proname = f.name join pg_namespace n on n.oid = pr.pronamespace and n.nspname = 'public') = 20,
         (select count(distinct f.name) from f join pg_proc pr on pr.proname = f.name join pg_namespace n on n.oid = pr.pronamespace and n.nspname = 'public')::text || ' / 20'
  union all
  select 6, '판단 서명키 (32자 이상 · 개발용 아님)',
         coalesce((select char_length(value) >= 32 and value not like 'local-dev-only%' from pilot_private.settings where key = 'judge_secret'), false),
         coalesce((select char_length(value)::text || '자' || case when value like 'local-dev-only%' then ' · 개발용 값! 02_set_judge_secret.sql 실행' else '' end
                   from pilot_private.settings where key = 'judge_secret'), '없음 — 02_set_judge_secret.sql 실행')
  union all
  select 7, '사진 저장소 field-photos 비공개 · 10MB · JPEG/PNG/WEBP',
         coalesce((select not public and file_size_limit = 10485760 and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp'] from storage.buckets where id = 'field-photos'), false),
         coalesce((select case when public then '공개(위험)' else '비공개' end || ' · ' || coalesce(file_size_limit::text, '제한 없음') from storage.buckets where id = 'field-photos'), '저장소 없음')
  union all
  select 8, '사진 접근 정책 3개 (올리기 본인 폴더 · 보기 · 지우기 관리자)',
         (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '현장 사진%') = 3,
         (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '현장 사진%')::text || ' / 3'
  union all
  select 9, '사진 보관기간(일)', exists (select 1 from pilot_private.settings where key = 'photo_retention_days' and value ~ '^[0-9]+$'),
         coalesce((select value || '일 (작업일 기준)' from pilot_private.settings where key = 'photo_retention_days'), '없음')
  union all
  select 10, '새 계정 → 실증 명단 자동 생성(가입 연결)', exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal),
         case when exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then '있음' else '없음' end
  union all
  select 11, '활성 관리자 1명 이상', (select count(*) from public.profiles where role = 'admin' and active) >= 1,
         (select count(*) from public.profiles where role = 'admin' and active)::text || '명 — 없으면 03_bootstrap_admin.sql'
  union all
  select 12, '활성 현장기사 (시험 A는 2명 이상)', (select count(*) from public.profiles where role = 'field' and active) >= 2,
         (select count(*) from public.profiles where role = 'field' and active)::text || '명'
  union all
  select 13, '기록 수 (참고 · 실제 업무 / 검증 시나리오)', true,
         '사건 ' || (select count(*) from public.field_cases where data_kind = '실제 업무') || ' / ' || (select count(*) from public.field_cases where data_kind <> '실제 업무')
         || ' · 일정 ' || (select count(*) from public.schedules where data_kind = '실제 업무') || ' / ' || (select count(*) from public.schedules where data_kind <> '실제 업무')
         || ' · 판단 대기 ' || (select count(*) from public.judgment_jobs where status <> '완료')
)
select no as "번호", item as "점검", case when ok then '정상' else '확인 필요' end as "결과", detail as "내용"
from checks
order by no;
