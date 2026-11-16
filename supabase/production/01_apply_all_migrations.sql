-- ════════════════════════════════════════════════════════════════════════
-- 하나 프로젝트 AX 0.4.2 — 운영 Supabase 최초 적용용 (자동 생성 · 직접 고치지 마세요)
-- 사용: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여 넣고 Run (한 번만).
-- 전체가 하나의 트랜잭션입니다: 중간에 오류가 나면 아무것도 적용되지 않습니다. 오류 문구를 그대로 알려 주세요.
-- 개발용 seed.sql 은 들어 있지 않습니다. 판단 서명키는 02_set_judge_secret.sql 로 따로 만듭니다.
-- 포함 마이그레이션 6개: 20261109000000_pilot_schema.sql, 20261109010000_pilot_writes_accounts.sql, 20261113010000_field_cases.sql, 20261113020000_safety_checks.sql, 20261113030000_measures.sql, 20261115010000_evidence_class_rules.sql
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ┌── 20261109000000_pilot_schema.sql ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
-- 하나 프로젝트 AX 실증 — 최소 스키마 (현장 일정 · 작업상태 이벤트 · 위험 판단 이력)
--
-- 원칙
--  1. 클라이언트(anon·authenticated)에는 테이블 쓰기 권한이 없다. 모든 쓰기는 권한을 검사하는
--     SECURITY DEFINER 함수로만 한다. 읽기는 RLS 로 역할별 제한.
--  2. 변경은 모두 추가만 하는 기록(일정 수정본·작업 이벤트)으로 남고, 하나의 증가 번호(seq)를 받는다.
--     위험 판단 전후는 '그 번호 직전까지'와 '그 번호까지'의 기록으로 계산하므로 늦게·다시 처리해도 같다.
--  3. 시각은 세 가지를 구분한다: 실제 작업 발생시각(occurred_at) · 사용자 입력 시각(entered_time) ·
--     DB 서버 기록시각(recorded_at, 서버가 강제). 입력 방식(즉시 기록·지연 전송·사후 입력)도 남긴다.
--  4. '실제 업무'와 '검증 시나리오' 데이터는 data_kind 로 나누고, 판단 입력에서 절대 섞지 않는다.
--  5. 위험 판단 결과는 서버(Next.js)가 실제 판단엔진으로 계산해 서버 전용 서명(HMAC)과 함께 기록한다.
--     서명키는 '대기 중인 판단 1건 읽기·기록'만 할 수 있다 — Supabase 관리자 키(service_role)는 쓰지 않는다.
--  6. 관리자 권한은 활성 관리자 + 2단계 인증(aal2) 세션에서만 인정한다.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- Data API 에 노출되지 않는 내부 스키마 (서명키·도우미 함수)
create schema if not exists pilot_private;
revoke all on schema pilot_private from public, anon, authenticated;

create sequence public.pilot_change_seq;
revoke all on sequence public.pilot_change_seq from public, anon, authenticated;

-- ── 테이블 ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null default 'field' check (role in ('admin', 'field')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is '실증 사용자 — 역할은 이 표에만 둔다 (user_metadata 는 사용자가 바꿀 수 있어 권한에 쓰지 않음). 새 계정은 field·비활성으로 시작';

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  data_kind text not null check (data_kind in ('실제 업무', '검증 시나리오')),
  work_date date not null,
  assignee_id uuid not null references public.profiles (id),
  site_name text not null check (char_length(site_name) between 1 and 60),
  region text not null default '' check (char_length(region) <= 40),
  planned_start time not null,
  planned_end time not null,
  travel_minutes int check (travel_minutes between 0 and 600),
  travel_from_id uuid references public.schedules (id),
  priority text not null default '보통' check (priority in ('긴급', '보통', '낮음')),
  status text not null default '예정' check (status in ('예정', '취소')),
  note text check (char_length(note) <= 200),
  version int not null default 1,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles (id),
  updated_at timestamptz not null default now(),
  check (planned_end > planned_start)
);
create index schedules_day on public.schedules (work_date, data_kind, assignee_id, planned_start);
comment on column public.schedules.travel_minutes is '직전 현장에서 이동 필요시간(분, 입력값 — 실시간 교통정보 아님). 없으면 판단 보류';
comment on column public.schedules.travel_from_id is '이동시간을 입력할 때의 직전 일정 — 순서가 바뀌면 엔진이 이동 기준 불일치로 판단 보류(R7)';

create table public.schedule_revisions (
  seq bigint primary key default nextval('public.pilot_change_seq'),
  op_id uuid not null unique,
  schedule_id uuid not null references public.schedules (id),
  revision int not null,
  change_kind text not null check (change_kind in ('등록', '수정', '취소')),
  snapshot jsonb not null,
  data_kind text not null,
  work_date date not null,
  actor_id uuid not null references public.profiles (id),
  recorded_at timestamptz not null default now(),
  unique (schedule_id, revision)
);
create index schedule_revisions_day on public.schedule_revisions (work_date, data_kind, seq);

create table public.work_events (
  seq bigint primary key default nextval('public.pilot_change_seq'),
  id uuid not null unique default gen_random_uuid(),
  op_id uuid not null unique,
  schedule_id uuid not null references public.schedules (id),
  data_kind text not null,
  work_date date not null,
  kind text not null check (kind in ('업무 확인', '작업개시', '예상 종료 보고', '작업종료', '기록 무효')),
  occurred_at timestamptz not null,
  entered_time time,
  expected_end time,
  entry_mode text not null check (entry_mode in ('즉시 기록', '지연 전송', '사후 입력')),
  recorded_at timestamptz not null default now(),
  client_pressed_at timestamptz,
  client_sent_at timestamptz,
  send_delay_seconds numeric(10, 1),
  source text not null check (source in ('현장 직원', '관리자')),
  actor_id uuid not null references public.profiles (id),
  voids_event_id uuid references public.work_events (id),
  note text check (char_length(note) <= 200)
);
create index work_events_day on public.work_events (work_date, data_kind, seq);
create index work_events_schedule on public.work_events (schedule_id, kind);
comment on column public.work_events.occurred_at is '실제 작업 발생시각 — 즉시 기록: 서버 기록시각에서 기기 기준 전송 지연을 뺀 값 · 사후 입력: 사용자가 입력한 시각';
comment on column public.work_events.entered_time is '사용자가 직접 입력한 시각 (사후 입력일 때만)';
comment on column public.work_events.recorded_at is 'DB 서버 기록시각 — 서버가 정하며 클라이언트가 바꿀 수 없음';
comment on column public.work_events.send_delay_seconds is '버튼을 누른 뒤 전송까지 걸린 시간(기기 기준 상대값 — 기기 시계가 틀려도 영향 없음)';

create table public.judgment_jobs (
  id uuid primary key default gen_random_uuid(),
  seq bigint not null unique,
  trigger_kind text not null,
  trigger_ref uuid not null,
  data_kind text not null,
  work_date date not null,
  as_of timestamptz not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  status text not null default '대기' check (status in ('대기', '완료')),
  attempts int not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  done_at timestamptz
);
create index judgment_jobs_pending on public.judgment_jobs (status, seq);
comment on table public.judgment_jobs is '판단 기록 대기열 — 일정 변경·작업 이벤트와 같은 트랜잭션에서 만들어져 누락되지 않는다';

create table public.risk_judgments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.judgment_jobs (id),
  seq bigint not null unique,
  data_kind text not null,
  work_date date not null,
  as_of timestamptz not null,
  trigger_kind text not null,
  trigger_ref uuid not null,
  triggered_by uuid not null references public.profiles (id),
  rule_version text not null,
  state_version text not null,
  priority_version text not null,
  app_version text not null,
  input_before jsonb not null,
  input_after jsonb not null,
  result_before jsonb not null,
  result_after jsonb not null,
  changes jsonb not null,
  priority_changes jsonb not null,
  summary jsonb not null,
  payload_sha256 text not null,
  computed_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
create index risk_judgments_day on public.risk_judgments (work_date, data_kind, seq);

create table public.export_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles (id),
  recorded_at timestamptz not null default now(),
  dataset text not null,
  format text not null,
  data_kind text,
  date_from date,
  date_to date,
  row_count int not null
);

create table pilot_private.settings (
  key text primary key,
  value text not null
);

-- ── 권한: 클라이언트는 읽기만 (RLS), 쓰기는 함수로만 ─────────────────────────

revoke all on table public.profiles, public.schedules, public.schedule_revisions, public.work_events,
  public.judgment_jobs, public.risk_judgments, public.export_log from public, anon, authenticated;
grant select on table public.profiles, public.schedules, public.schedule_revisions, public.work_events,
  public.judgment_jobs, public.risk_judgments, public.export_log to authenticated;
revoke all on table pilot_private.settings from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_revisions enable row level security;
alter table public.work_events enable row level security;
alter table public.judgment_jobs enable row level security;
alter table public.risk_judgments enable row level security;
alter table public.export_log enable row level security;
alter table pilot_private.settings enable row level security;

-- ── 역할 확인 ──────────────────────────────────────────────────────────────

create function public.pilot_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active);
$$;

create function public.pilot_is_field() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'field' and p.active);
$$;

-- ── 읽기 정책 (RLS) ────────────────────────────────────────────────────────

create policy "본인 또는 관리자" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.pilot_is_admin()));

create policy "관리자 전체 · 현장 직원은 본인 담당" on public.schedules for select to authenticated
  using ((select public.pilot_is_admin()) or (assignee_id = (select auth.uid()) and (select public.pilot_is_field())));

create policy "관리자만" on public.schedule_revisions for select to authenticated
  using ((select public.pilot_is_admin()));

create policy "관리자 전체 · 현장 직원은 본인 담당 일정" on public.work_events for select to authenticated
  using ((select public.pilot_is_admin())
      or ((select public.pilot_is_field())
          and exists (select 1 from public.schedules s where s.id = schedule_id and s.assignee_id = (select auth.uid()))));

create policy "관리자 전체 · 현장 직원은 본인이 만든 것" on public.judgment_jobs for select to authenticated
  using ((select public.pilot_is_admin()) or (created_by = (select auth.uid()) and (select public.pilot_is_field())));

create policy "관리자만" on public.risk_judgments for select to authenticated
  using ((select public.pilot_is_admin()));

create policy "관리자만" on public.export_log for select to authenticated
  using ((select public.pilot_is_admin()));

-- ── 기록 보호: 추가만 · 함수로만 ───────────────────────────────────────────

create function pilot_private.append_only() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception '[기록 보호] %은(는) 추가만 할 수 있습니다 (수정·삭제 불가).', tg_table_name;
end $$;

create trigger append_only before update or delete on public.schedule_revisions
  for each row execute function pilot_private.append_only();
create trigger append_only before update or delete on public.work_events
  for each row execute function pilot_private.append_only();
create trigger append_only before update or delete on public.risk_judgments
  for each row execute function pilot_private.append_only();
create trigger append_only before update or delete on public.export_log
  for each row execute function pilot_private.append_only();

-- 일정·판단 대기열·프로필은 함수 안에서만 바뀐다 (대시보드 SQL 로 직접 고치면 이력이 빠지므로 막는다)
create function pilot_private.via_function_only() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '[기록 보호] %은(는) 삭제할 수 없습니다.', tg_table_name;
  end if;
  if coalesce(current_setting('pilot.via_function', true), '') <> 'on' then
    raise exception '[기록 보호] %은(는) 실증 함수로만 바꿀 수 있습니다 (이력 누락 방지).', tg_table_name;
  end if;
  return new;
end $$;

create trigger via_function_only before insert or update or delete on public.schedules
  for each row execute function pilot_private.via_function_only();
create trigger via_function_only before insert or update or delete on public.judgment_jobs
  for each row execute function pilot_private.via_function_only();
create trigger via_function_only before insert or update or delete on public.profiles
  for each row execute function pilot_private.via_function_only();

-- 새 로그인 계정 → 프로필 (현장 직원 · 비활성으로 시작, 관리자가 활성화)
create function pilot_private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('pilot.via_function', 'on', true);
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), '사용자'), 40))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function pilot_private.on_auth_user_created();

-- ── 도우미 ────────────────────────────────────────────────────────────────

create function pilot_private.kst_date(t timestamptz) returns date
language sql immutable set search_path = ''
as $$ select (t at time zone 'Asia/Seoul')::date $$;

-- 이벤트가 무효·정정되지 않았는지
create function pilot_private.event_active(p_event uuid) returns boolean
language sql stable set search_path = ''
as $$ select not exists (select 1 from public.work_events v where v.voids_event_id = p_event) $$;

create function pilot_private.new_job(p_seq bigint, p_trigger text, p_ref uuid, p_kind text, p_date date, p_actor uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  perform set_config('pilot.via_function', 'on', true);
  insert into public.judgment_jobs (seq, trigger_kind, trigger_ref, data_kind, work_date, as_of, created_by)
  values (p_seq, p_trigger, p_ref, p_kind, p_date, now(), p_actor)
  returning id into v_id;
  return v_id;
end $$;

-- ── 일정 저장 (관리자) ─────────────────────────────────────────────────────

create function public.save_schedule(
  p_op_id uuid,
  p_schedule_id uuid,
  p_expected_version int,
  p_data_kind text,
  p_work_date date,
  p_assignee_id uuid,
  p_site_name text,
  p_region text,
  p_planned_start time,
  p_planned_end time,
  p_travel_minutes int,
  p_priority text,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rev public.schedule_revisions;
  v_row public.schedules;
  v_from uuid;
  v_kind text;
  v_seq bigint;
  v_job uuid;
begin
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 일정을 저장할 수 있습니다.';
  end if;
  if p_op_id is null then
    raise exception '[입력] 요청 번호(op_id)가 없습니다.';
  end if;
  -- 같은 요청이 다시 오면(재시도·두 번 누름) 처음 결과를 돌려준다
  select * into v_rev from public.schedule_revisions where op_id = p_op_id;
  if found then
    return jsonb_build_object('schedule_id', v_rev.schedule_id, 'version', v_rev.revision, 'seq', v_rev.seq,
      'job_id', (select j.id from public.judgment_jobs j where j.seq = v_rev.seq), 'duplicated', true);
  end if;

  if p_data_kind not in ('실제 업무', '검증 시나리오') then
    raise exception '[입력] 데이터 구분은 실제 업무 또는 검증 시나리오입니다.';
  end if;
  if coalesce(btrim(p_site_name), '') = '' then
    raise exception '[입력] 현장 이름을 넣어 주세요.';
  end if;
  if p_planned_start is null or p_planned_end is null or p_planned_end <= p_planned_start then
    raise exception '[입력] 예정 종료는 예정 시작보다 늦어야 합니다.';
  end if;
  if p_priority not in ('긴급', '보통', '낮음') then
    raise exception '[입력] 업무 중요도는 긴급·보통·낮음 중 하나입니다.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_assignee_id and p.role = 'field' and p.active) then
    raise exception '[입력] 담당자는 활성 상태의 현장 직원이어야 합니다.';
  end if;

  perform set_config('pilot.via_function', 'on', true);
  if p_schedule_id is null then
    insert into public.schedules (data_kind, work_date, assignee_id, site_name, region, planned_start, planned_end,
      travel_minutes, priority, note, created_by, updated_by)
    values (p_data_kind, p_work_date, p_assignee_id, btrim(p_site_name), coalesce(btrim(p_region), ''), p_planned_start,
      p_planned_end, p_travel_minutes, p_priority, nullif(btrim(coalesce(p_note, '')), ''), v_uid, v_uid)
    returning * into v_row;
    v_kind := '등록';
  else
    select * into v_row from public.schedules where id = p_schedule_id for update;
    if not found then
      raise exception '[입력] 일정을 찾을 수 없습니다.';
    end if;
    if v_row.version <> coalesce(p_expected_version, -1) then
      raise exception '[충돌] 다른 화면에서 이 일정이 먼저 바뀌었습니다. 새로 불러온 뒤 다시 저장해 주세요.';
    end if;
    if v_row.status = '취소' then
      raise exception '[입력] 취소된 일정은 고칠 수 없습니다.';
    end if;
    if v_row.work_date <> p_work_date or v_row.data_kind <> p_data_kind then
      raise exception '[입력] 날짜와 데이터 구분은 바꿀 수 없습니다 (취소 후 새로 등록).';
    end if;
    update public.schedules set
      assignee_id = p_assignee_id, site_name = btrim(p_site_name), region = coalesce(btrim(p_region), ''),
      planned_start = p_planned_start, planned_end = p_planned_end, travel_minutes = p_travel_minutes,
      priority = p_priority, note = nullif(btrim(coalesce(p_note, '')), ''),
      version = version + 1, updated_by = v_uid, updated_at = now()
    where id = p_schedule_id
    returning * into v_row;
    v_kind := '수정';
  end if;

  -- 이동시간은 '지금 이 작업자의 직전 일정'에서 출발하는 값으로 기록한다
  select s.id into v_from from public.schedules s
  where s.assignee_id = v_row.assignee_id and s.work_date = v_row.work_date and s.data_kind = v_row.data_kind
    and s.status = '예정' and s.id <> v_row.id and s.planned_start < v_row.planned_start
  order by s.planned_start desc, s.id desc limit 1;
  if v_row.travel_minutes is not null and v_from is null then
    raise exception '[입력] 이 작업자의 그날 첫 일정이라 직전 현장에서의 이동시간을 넣을 수 없습니다.';
  end if;
  update public.schedules set travel_from_id = case when v_row.travel_minutes is null then null else v_from end
  where id = v_row.id returning * into v_row;

  insert into public.schedule_revisions (op_id, schedule_id, revision, change_kind, snapshot, data_kind, work_date, actor_id)
  values (p_op_id, v_row.id, v_row.version, v_kind, to_jsonb(v_row), v_row.data_kind, v_row.work_date, v_uid)
  returning seq into v_seq;
  v_job := pilot_private.new_job(v_seq, '일정 ' || v_kind, v_row.id, v_row.data_kind, v_row.work_date, v_uid);

  return jsonb_build_object('schedule_id', v_row.id, 'version', v_row.version, 'seq', v_seq, 'job_id', v_job, 'duplicated', false);
end $$;

create function public.cancel_schedule(p_op_id uuid, p_schedule_id uuid, p_expected_version int, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rev public.schedule_revisions;
  v_row public.schedules;
  v_seq bigint;
  v_job uuid;
begin
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 일정을 취소할 수 있습니다.';
  end if;
  if p_op_id is null then
    raise exception '[입력] 요청 번호(op_id)가 없습니다.';
  end if;
  select * into v_rev from public.schedule_revisions where op_id = p_op_id;
  if found then
    return jsonb_build_object('schedule_id', v_rev.schedule_id, 'version', v_rev.revision, 'seq', v_rev.seq,
      'job_id', (select j.id from public.judgment_jobs j where j.seq = v_rev.seq), 'duplicated', true);
  end if;
  select * into v_row from public.schedules where id = p_schedule_id for update;
  if not found then
    raise exception '[입력] 일정을 찾을 수 없습니다.';
  end if;
  if v_row.version <> coalesce(p_expected_version, -1) then
    raise exception '[충돌] 다른 화면에서 이 일정이 먼저 바뀌었습니다. 새로 불러온 뒤 다시 시도해 주세요.';
  end if;
  if v_row.status = '취소' then
    raise exception '[입력] 이미 취소된 일정입니다.';
  end if;
  perform set_config('pilot.via_function', 'on', true);
  update public.schedules set status = '취소', note = left(coalesce(nullif(btrim(coalesce(p_reason, '')), ''), note), 200),
    version = version + 1, updated_by = v_uid, updated_at = now()
  where id = p_schedule_id returning * into v_row;
  insert into public.schedule_revisions (op_id, schedule_id, revision, change_kind, snapshot, data_kind, work_date, actor_id)
  values (p_op_id, v_row.id, v_row.version, '취소', to_jsonb(v_row), v_row.data_kind, v_row.work_date, v_uid)
  returning seq into v_seq;
  v_job := pilot_private.new_job(v_seq, '일정 취소', v_row.id, v_row.data_kind, v_row.work_date, v_uid);
  return jsonb_build_object('schedule_id', v_row.id, 'version', v_row.version, 'seq', v_seq, 'job_id', v_job, 'duplicated', false);
end $$;

-- ── 작업상태 이벤트 기록 (현장 직원 · 관리자) ─────────────────────────────────

create function public.record_work_event(
  p_op_id uuid,
  p_schedule_id uuid,
  p_kind text,
  p_mode text,
  p_entered_time time,
  p_expected_end time,
  p_client_pressed_at timestamptz,
  p_client_sent_at timestamptz,
  p_voids_event_id uuid,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.pilot_is_admin();
  v_field boolean := public.pilot_is_field();
  v_now timestamptz := now();
  v_ev public.work_events;
  v_s public.schedules;
  v_target public.work_events;
  v_occurred timestamptz;
  v_entry text;
  v_delay numeric;
  v_start timestamptz;
  v_job uuid;
begin
  if not (v_admin or v_field) then
    raise exception '[권한] 활성화된 실증 계정만 기록할 수 있습니다 (관리자는 2단계 인증 필요).';
  end if;
  if p_op_id is null then
    raise exception '[입력] 요청 번호(op_id)가 없습니다.';
  end if;
  -- 같은 요청이 다시 오면(재시도·두 번 누름) 새 기록을 만들지 않고 처음 결과를 돌려준다
  select * into v_ev from public.work_events where op_id = p_op_id;
  if found then
    if v_ev.actor_id <> v_uid then
      raise exception '[권한] 다른 사용자의 요청 번호입니다.';
    end if;
    return jsonb_build_object('event_id', v_ev.id, 'seq', v_ev.seq, 'job_id', (select j.id from public.judgment_jobs j where j.seq = v_ev.seq),
      'recorded_at', v_ev.recorded_at, 'occurred_at', v_ev.occurred_at, 'entry_mode', v_ev.entry_mode, 'duplicated', true);
  end if;

  select * into v_s from public.schedules where id = p_schedule_id for update;
  if not found then
    raise exception '[입력] 일정을 찾을 수 없습니다.';
  end if;
  if not v_admin and v_s.assignee_id <> v_uid then
    raise exception '[권한] 본인 담당 일정에만 기록할 수 있습니다.';
  end if;
  if p_kind not in ('업무 확인', '작업개시', '예상 종료 보고', '작업종료', '기록 무효') then
    raise exception '[입력] 알 수 없는 기록 종류입니다.';
  end if;
  if v_s.status = '취소' and p_kind <> '기록 무효' then
    raise exception '[입력] 취소된 일정입니다.';
  end if;

  -- 시각: 실제 발생시각 · 사용자 입력 시각 · 서버 기록시각을 나눈다
  if p_mode = '사후' then
    if p_entered_time is null then
      raise exception '[입력] 사후 입력은 실제 시각을 넣어야 합니다.';
    end if;
    v_occurred := (v_s.work_date + p_entered_time) at time zone 'Asia/Seoul';
    if v_occurred > v_now + interval '1 minute' then
      raise exception '[입력] 아직 오지 않은 시각은 기록할 수 없습니다.';
    end if;
    v_entry := '사후 입력';
  elsif p_mode = '즉시' then
    if p_entered_time is not null then
      raise exception '[입력] 즉시 기록에는 시각을 넣지 않습니다.';
    end if;
    -- 기기 기준 상대 지연(전송 − 누름)만 쓴다 — 기기 시계가 틀려도 영향이 없다
    v_delay := greatest(0, coalesce(extract(epoch from (p_client_sent_at - p_client_pressed_at)), 0));
    if v_delay > 12 * 3600 then
      raise exception '[입력] 12시간이 지난 기록은 사후 입력으로 넣어 주세요.';
    end if;
    v_occurred := v_now - make_interval(secs => v_delay);
    v_entry := case when v_delay <= 120 then '즉시 기록' else '지연 전송' end;
  else
    raise exception '[입력] 기록 방식은 즉시 또는 사후입니다.';
  end if;

  if p_kind in ('작업개시', '작업종료', '예상 종료 보고') and pilot_private.kst_date(v_occurred) <> v_s.work_date then
    raise exception '[입력] 일정 날짜(%)와 다른 날의 기록입니다.', v_s.work_date;
  end if;

  if p_kind = '예상 종료 보고' then
    if p_expected_end is null or p_expected_end <= v_s.planned_start then
      raise exception '[입력] 예상 종료 시각은 예정 시작(%)보다 늦어야 합니다.', v_s.planned_start;
    end if;
  elsif p_expected_end is not null then
    raise exception '[입력] 예상 종료 시각은 예상 종료 보고에만 넣습니다.';
  end if;

  if p_voids_event_id is not null then
    select * into v_target from public.work_events where id = p_voids_event_id for update;
    if not found or v_target.schedule_id <> v_s.id then
      raise exception '[입력] 정정할 기록이 이 일정에 없습니다.';
    end if;
    if v_target.kind = '기록 무효' or not pilot_private.event_active(v_target.id) then
      raise exception '[입력] 이미 정정·무효 처리된 기록입니다.';
    end if;
    if not v_admin and v_target.actor_id <> v_uid then
      raise exception '[권한] 본인이 남긴 기록만 정정할 수 있습니다.';
    end if;
    if p_kind <> '기록 무효' and p_kind <> v_target.kind then
      raise exception '[입력] 같은 종류의 기록으로만 정정할 수 있습니다.';
    end if;
    if p_kind = '기록 무효' and v_target.kind = '작업개시'
       and exists (select 1 from public.work_events e where e.schedule_id = v_s.id and e.kind = '작업종료' and pilot_private.event_active(e.id)) then
      raise exception '[입력] 작업 종료 기록이 남아 있어 작업 시작 기록만 무효로 할 수 없습니다 (종료부터 무효 처리).';
    end if;
  elsif p_kind = '기록 무효' then
    raise exception '[입력] 무효 처리할 기록을 지정해 주세요.';
  end if;

  if p_kind in ('업무 확인', '작업개시', '작업종료') and p_voids_event_id is null
     and exists (select 1 from public.work_events e where e.schedule_id = v_s.id and e.kind = p_kind and pilot_private.event_active(e.id)) then
    raise exception '[중복] 이미 기록된 단계입니다. 시각이 틀렸다면 정정해 주세요.';
  end if;
  if p_kind = '작업종료' then
    select e.occurred_at into v_start from public.work_events e
    where e.schedule_id = v_s.id and e.kind = '작업개시' and pilot_private.event_active(e.id)
    order by e.occurred_at limit 1;
    if v_start is null then
      raise exception '[입력] 작업 시작 기록이 먼저 있어야 합니다 (시작을 놓쳤다면 사후 입력).';
    end if;
    if v_occurred <= v_start then
      raise exception '[입력] 작업 종료가 작업 시작보다 빠를 수 없습니다.';
    end if;
  end if;

  insert into public.work_events (op_id, schedule_id, data_kind, work_date, kind, occurred_at, entered_time, expected_end,
    entry_mode, client_pressed_at, client_sent_at, send_delay_seconds, source, actor_id, voids_event_id, note)
  values (p_op_id, v_s.id, v_s.data_kind, v_s.work_date, p_kind, v_occurred, p_entered_time, p_expected_end,
    v_entry, p_client_pressed_at, p_client_sent_at, v_delay, case when v_admin then '관리자' else '현장 직원' end,
    v_uid, p_voids_event_id, nullif(btrim(coalesce(p_note, '')), ''))
  returning * into v_ev;
  v_job := pilot_private.new_job(v_ev.seq, '작업 이벤트 · ' || p_kind, v_ev.id, v_s.data_kind, v_s.work_date, v_uid);

  return jsonb_build_object('event_id', v_ev.id, 'seq', v_ev.seq, 'job_id', v_job, 'recorded_at', v_ev.recorded_at,
    'occurred_at', v_ev.occurred_at, 'entry_mode', v_ev.entry_mode, 'duplicated', false);
end $$;

-- ── 판단 기록 (서버 전용 서명으로만) ────────────────────────────────────────

create function pilot_private.verify_sig(p_purpose text, p_job uuid, p_ts bigint, p_hash text, p_sig text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_secret text;
begin
  select s.value into v_secret from pilot_private.settings s where s.key = 'judge_secret';
  if v_secret is null or char_length(v_secret) < 32 then
    raise exception '[설정] 판단 기록 서명키가 설정되지 않았습니다.';
  end if;
  if p_ts is null or abs(extract(epoch from now()) - p_ts) > 300 then
    raise exception '[서명] 요청 시각이 서버 시각과 5분 넘게 다릅니다.';
  end if;
  if p_sig is null or lower(p_sig) <> encode(extensions.hmac(p_purpose || '|' || p_job::text || '|' || p_ts::text || '|' || coalesce(p_hash, ''),
                                               v_secret, 'sha256'), 'hex') then
    raise exception '[서명] 판단 기록 서명이 맞지 않습니다.';
  end if;
end $$;

-- 판단 입력: 그 판단 대상 번호(seq)까지의 같은 날짜·같은 데이터 구분 기록 전부
create function public.judge_inputs(p_job_id uuid, p_ts bigint, p_sig text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_job public.judgment_jobs;
begin
  perform pilot_private.verify_sig('inputs', p_job_id, p_ts, '', p_sig);
  select * into v_job from public.judgment_jobs where id = p_job_id;
  if not found then
    raise exception '[입력] 판단 대기열에 없는 번호입니다.';
  end if;
  return jsonb_build_object(
    'job', to_jsonb(v_job),
    'revisions', (select coalesce(jsonb_agg(jsonb_build_object('seq', r.seq, 'schedule_id', r.schedule_id, 'revision', r.revision,
                     'change_kind', r.change_kind, 'snapshot', r.snapshot, 'recorded_at', r.recorded_at, 'actor_id', r.actor_id) order by r.seq), '[]'::jsonb)
                  from public.schedule_revisions r
                  where r.work_date = v_job.work_date and r.data_kind = v_job.data_kind and r.seq <= v_job.seq),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.seq), '[]'::jsonb)
               from public.work_events e
               where e.work_date = v_job.work_date and e.data_kind = v_job.data_kind and e.seq <= v_job.seq),
    'db_now', now());
end $$;

create function public.judge_complete(p_job_id uuid, p_ts bigint, p_payload text, p_sig text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.judgment_jobs;
  v_p jsonb;
  v_id uuid;
  v_hash text := encode(extensions.digest(p_payload, 'sha256'), 'hex');
begin
  perform pilot_private.verify_sig('complete', p_job_id, p_ts, v_hash, p_sig);
  select * into v_job from public.judgment_jobs where id = p_job_id for update;
  if not found then
    raise exception '[입력] 판단 대기열에 없는 번호입니다.';
  end if;
  if v_job.status = '완료' then
    return jsonb_build_object('judgment_id', (select j.id from public.risk_judgments j where j.job_id = p_job_id), 'duplicated', true);
  end if;
  v_p := p_payload::jsonb;
  if (v_p ->> 'seq')::bigint is distinct from v_job.seq or (v_p ->> 'job_id')::uuid is distinct from v_job.id then
    raise exception '[입력] 판단 결과가 대기열 번호와 맞지 않습니다.';
  end if;
  insert into public.risk_judgments (job_id, seq, data_kind, work_date, as_of, trigger_kind, trigger_ref, triggered_by,
    rule_version, state_version, priority_version, app_version, input_before, input_after, result_before, result_after,
    changes, priority_changes, summary, payload_sha256, computed_at)
  values (v_job.id, v_job.seq, v_job.data_kind, v_job.work_date, v_job.as_of, v_job.trigger_kind, v_job.trigger_ref, v_job.created_by,
    v_p ->> 'rule_version', v_p ->> 'state_version', v_p ->> 'priority_version', v_p ->> 'app_version',
    v_p -> 'input_before', v_p -> 'input_after', v_p -> 'result_before', v_p -> 'result_after',
    v_p -> 'changes', v_p -> 'priority_changes', v_p -> 'summary', v_hash, (v_p ->> 'computed_at')::timestamptz)
  returning id into v_id;
  perform set_config('pilot.via_function', 'on', true);
  update public.judgment_jobs set status = '완료', done_at = now(), attempts = attempts + 1, last_attempt_at = now(), last_error = null
  where id = v_job.id;
  return jsonb_build_object('judgment_id', v_id, 'duplicated', false);
end $$;

create function public.judge_fail(p_job_id uuid, p_ts bigint, p_error text, p_sig text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform pilot_private.verify_sig('fail', p_job_id, p_ts, encode(extensions.digest(coalesce(p_error, ''), 'sha256'), 'hex'), p_sig);
  perform set_config('pilot.via_function', 'on', true);
  update public.judgment_jobs set attempts = attempts + 1, last_attempt_at = now(), last_error = left(coalesce(p_error, ''), 500)
  where id = p_job_id and status = '대기';
end $$;

-- ── 계정 관리 · 내보내기 기록 (관리자) ──────────────────────────────────────

create function public.admin_set_profile(p_user_id uuid, p_display_name text, p_role text, p_active boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 계정을 바꿀 수 있습니다.';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'admin' or not p_active) then
    raise exception '[입력] 본인의 관리자 권한은 여기서 내리거나 끌 수 없습니다.';
  end if;
  if p_role not in ('admin', 'field') or coalesce(btrim(p_display_name), '') = '' or char_length(btrim(p_display_name)) > 40 then
    raise exception '[입력] 이름(1~40자)과 역할(admin·field)을 확인해 주세요.';
  end if;
  perform set_config('pilot.via_function', 'on', true);
  update public.profiles set display_name = btrim(p_display_name), role = p_role, active = p_active, updated_at = now()
  where id = p_user_id;
  if not found then
    raise exception '[입력] 계정을 찾을 수 없습니다.';
  end if;
end $$;

create function public.log_export(p_dataset text, p_format text, p_data_kind text, p_from date, p_to date, p_rows int) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 내보낼 수 있습니다.';
  end if;
  insert into public.export_log (actor_id, dataset, format, data_kind, date_from, date_to, row_count)
  values (auth.uid(), p_dataset, p_format, p_data_kind, p_from, p_to, coalesce(p_rows, 0));
end $$;

-- 최초 관리자 지정 — DB 소유자만 실행 (대시보드 SQL 편집기: select pilot_private.bootstrap_admin('관리자 이메일', '이름');)
create function pilot_private.bootstrap_admin(p_email text, p_display_name text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_id is null then
    raise exception '[입력] % 계정이 없습니다. 먼저 Authentication 에서 사용자를 만들거나 초대하세요.', p_email;
  end if;
  perform set_config('pilot.via_function', 'on', true);
  update public.profiles set role = 'admin', active = true, display_name = left(btrim(coalesce(p_display_name, '관리자')), 40), updated_at = now()
  where id = v_id;
end $$;

-- ── 함수 실행 권한: 로그인 사용자만 (함수 안에서 다시 역할 검사) ─────────────────

revoke execute on all functions in schema pilot_private from public, anon, authenticated;
revoke execute on function public.pilot_is_admin(), public.pilot_is_field(),
  public.save_schedule(uuid, uuid, int, text, date, uuid, text, text, time, time, int, text, text),
  public.cancel_schedule(uuid, uuid, int, text),
  public.record_work_event(uuid, uuid, text, text, time, time, timestamptz, timestamptz, uuid, text),
  public.judge_inputs(uuid, bigint, text), public.judge_complete(uuid, bigint, text, text), public.judge_fail(uuid, bigint, text, text),
  public.admin_set_profile(uuid, text, text, boolean), public.log_export(text, text, text, date, date, int)
  from public, anon;
grant execute on function public.pilot_is_admin(), public.pilot_is_field(),
  public.save_schedule(uuid, uuid, int, text, date, uuid, text, text, time, time, int, text, text),
  public.cancel_schedule(uuid, uuid, int, text),
  public.record_work_event(uuid, uuid, text, text, time, time, timestamptz, timestamptz, uuid, text),
  public.judge_inputs(uuid, bigint, text), public.judge_complete(uuid, bigint, text, text), public.judge_fail(uuid, bigint, text, text),
  public.admin_set_profile(uuid, text, text, boolean), public.log_export(text, text, text, date, date, int)
  to authenticated;
-- └── 20261109000000_pilot_schema.sql 끝

-- ┌── 20261109010000_pilot_writes_accounts.sql ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
-- 실증 보완 — 쓰기 순서 보장 · 계정 이메일 · 계정 변경 이력
--
-- 1. 일정 저장·취소·작업 이벤트 기록을 한 번에 하나씩 처리한다 (트랜잭션 잠금).
--    번호(seq)를 받는 순서와 DB 반영 순서가 같아져서, 판단이 '그 번호 직전까지의 기록'을
--    빠뜨리지 않는다 (동시에 들어온 다른 기록이 늦게 반영되어 판단 입력이 달라지는 일을 막는다).
--    같은 요청 번호(op_id)가 동시에 두 번 와도 두 번째는 첫 결과를 그대로 돌려받는다.
--    실증 규모(관리자 1명 · 현장 담당자 1~2명)에서는 대기 시간이 거의 없다.
-- 2. 관리자 계정 화면에서 사람을 구분할 수 있도록 로그인 이메일을 프로필에 둔다
--    (auth.users 는 앱 사용자가 읽을 수 없다).
-- 3. 이름·역할·활성 상태 변경을 추가만 하는 이력으로 남긴다 (누가 언제 누구를 활성화했는지).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. 쓰기 순서 보장 ──────────────────────────────────────────────────────

create function pilot_private.serialize_writes() returns void
language sql volatile set search_path = ''
as $$ select pg_advisory_xact_lock(7240311001) $$;

-- 기존 함수 본문은 그대로 내부 스키마로 옮기고, 같은 이름의 공개 함수는 잠금 후 본문을 부른다
alter function public.save_schedule(uuid, uuid, int, text, date, uuid, text, text, time, time, int, text, text) rename to save_schedule_body;
alter function public.save_schedule_body(uuid, uuid, int, text, date, uuid, text, text, time, time, int, text, text) set schema pilot_private;
alter function public.cancel_schedule(uuid, uuid, int, text) rename to cancel_schedule_body;
alter function public.cancel_schedule_body(uuid, uuid, int, text) set schema pilot_private;
alter function public.record_work_event(uuid, uuid, text, text, time, time, timestamptz, timestamptz, uuid, text) rename to record_work_event_body;
alter function public.record_work_event_body(uuid, uuid, text, text, time, time, timestamptz, timestamptz, uuid, text) set schema pilot_private;
revoke execute on all functions in schema pilot_private from public, anon, authenticated;

create function public.save_schedule(
  p_op_id uuid, p_schedule_id uuid, p_expected_version int, p_data_kind text, p_work_date date, p_assignee_id uuid,
  p_site_name text, p_region text, p_planned_start time, p_planned_end time, p_travel_minutes int, p_priority text, p_note text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform pilot_private.serialize_writes();
  return pilot_private.save_schedule_body(p_op_id, p_schedule_id, p_expected_version, p_data_kind, p_work_date, p_assignee_id,
    p_site_name, p_region, p_planned_start, p_planned_end, p_travel_minutes, p_priority, p_note);
end $$;

create function public.cancel_schedule(p_op_id uuid, p_schedule_id uuid, p_expected_version int, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform pilot_private.serialize_writes();
  return pilot_private.cancel_schedule_body(p_op_id, p_schedule_id, p_expected_version, p_reason);
end $$;

create function public.record_work_event(
  p_op_id uuid, p_schedule_id uuid, p_kind text, p_mode text, p_entered_time time, p_expected_end time,
  p_client_pressed_at timestamptz, p_client_sent_at timestamptz, p_voids_event_id uuid, p_note text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform pilot_private.serialize_writes();
  return pilot_private.record_work_event_body(p_op_id, p_schedule_id, p_kind, p_mode, p_entered_time, p_expected_end,
    p_client_pressed_at, p_client_sent_at, p_voids_event_id, p_note);
end $$;

-- DB 기록시각은 잠금을 얻은 뒤 실제로 쓰는 순간의 서버 시각으로 정한다.
-- (now() 는 트랜잭션 시작 시각이라, 잠금을 기다린 요청은 번호가 뒤인데 기록시각이 앞설 수 있다)
-- 함수가 어떤 값을 넘겨도 서버 시각으로 덮어쓴다.
create function pilot_private.stamp_recorded_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.recorded_at := clock_timestamp();
  return new;
end $$;

create trigger stamp_recorded_at before insert on public.schedule_revisions
  for each row execute function pilot_private.stamp_recorded_at();
create trigger stamp_recorded_at before insert on public.work_events
  for each row execute function pilot_private.stamp_recorded_at();

-- ── 2. 계정 이메일 ─────────────────────────────────────────────────────────

alter table public.profiles add column email text not null default '';
comment on column public.profiles.email is '로그인 이메일 사본 — 관리자 화면에서 사람을 구분하는 용도 (권한 판단에는 쓰지 않음)';

do $$
begin
  perform set_config('pilot.via_function', 'on', true);
  update public.profiles p set email = coalesce(u.email, '') from auth.users u where u.id = p.id;
end $$;

create or replace function pilot_private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('pilot.via_function', 'on', true);
  insert into public.profiles (id, display_name, email)
  values (new.id, left(coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), '사용자'), 40), coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

create function pilot_private.on_auth_user_email_changed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('pilot.via_function', 'on', true);
  update public.profiles set email = coalesce(new.email, ''), updated_at = now() where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function pilot_private.on_auth_user_email_changed();

-- ── 3. 계정 변경 이력 (추가만) ─────────────────────────────────────────────

create table public.profile_changes (
  seq bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id),
  changed_by uuid references public.profiles (id),
  display_name text not null,
  role text not null,
  active boolean not null,
  via text not null check (via in ('관리자 화면', '최초 관리자 지정')),
  recorded_at timestamptz not null default now()
);
comment on table public.profile_changes is '계정 이름·역할·활성 상태 변경 이력 — 실증 기록의 사용자 권한을 사후 확인하는 근거';
comment on column public.profile_changes.changed_by is '바꾼 관리자 (최초 관리자 지정은 DB 소유자가 실행해 비어 있음)';

revoke all on public.profile_changes from public, anon, authenticated;
grant select on public.profile_changes to authenticated;
alter table public.profile_changes enable row level security;
create policy "관리자만" on public.profile_changes for select to authenticated using ((select public.pilot_is_admin()));
create trigger append_only before update or delete on public.profile_changes
  for each row execute function pilot_private.append_only();

create or replace function public.admin_set_profile(p_user_id uuid, p_display_name text, p_role text, p_active boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_row public.profiles;
begin
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 계정을 바꿀 수 있습니다.';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'admin' or not p_active) then
    raise exception '[입력] 본인의 관리자 권한은 여기서 내리거나 끌 수 없습니다.';
  end if;
  if p_role not in ('admin', 'field') or coalesce(btrim(p_display_name), '') = '' or char_length(btrim(p_display_name)) > 40 then
    raise exception '[입력] 이름(1~40자)과 역할(admin·field)을 확인해 주세요.';
  end if;
  perform set_config('pilot.via_function', 'on', true);
  update public.profiles set display_name = btrim(p_display_name), role = p_role, active = p_active, updated_at = now()
  where id = p_user_id
  returning * into v_row;
  if not found then
    raise exception '[입력] 계정을 찾을 수 없습니다.';
  end if;
  insert into public.profile_changes (profile_id, changed_by, display_name, role, active, via)
  values (v_row.id, auth.uid(), v_row.display_name, v_row.role, v_row.active, '관리자 화면');
end $$;

create or replace function pilot_private.bootstrap_admin(p_email text, p_display_name text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_row public.profiles;
begin
  select p.* into v_row from public.profiles p join auth.users u on u.id = p.id where lower(u.email) = lower(btrim(p_email));
  if not found then
    raise exception '[입력] % 계정이 없습니다. 먼저 Authentication 에서 사용자를 만들거나 초대하세요.', p_email;
  end if;
  perform set_config('pilot.via_function', 'on', true);
  update public.profiles set role = 'admin', active = true, display_name = left(btrim(coalesce(p_display_name, '관리자')), 40), updated_at = now()
  where id = v_row.id
  returning * into v_row;
  insert into public.profile_changes (profile_id, changed_by, display_name, role, active, via)
  values (v_row.id, null, v_row.display_name, v_row.role, v_row.active, '최초 관리자 지정');
end $$;

-- ── 함수 실행 권한 ─────────────────────────────────────────────────────────

revoke execute on all functions in schema pilot_private from public, anon, authenticated;
revoke execute on function
  public.save_schedule(uuid, uuid, int, text, date, uuid, text, text, time, time, int, text, text),
  public.cancel_schedule(uuid, uuid, int, text),
  public.record_work_event(uuid, uuid, text, text, time, time, timestamptz, timestamptz, uuid, text),
  public.admin_set_profile(uuid, text, text, boolean)
  from public, anon;
grant execute on function
  public.save_schedule(uuid, uuid, int, text, date, uuid, text, text, time, time, int, text, text),
  public.cancel_schedule(uuid, uuid, int, text),
  public.record_work_event(uuid, uuid, text, text, time, time, timestamptz, timestamptz, uuid, text),
  public.admin_set_profile(uuid, text, text, boolean)
  to authenticated;
-- └── 20261109010000_pilot_writes_accounts.sql 끝

-- ┌── 20261113010000_field_cases.sql ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
-- 현장 실사용 1차 — 현장 문제 사건 · 관리자 조치 · 현장 사진 (2026-11-13 구본석 이사 인터뷰 근거)
--
-- 연쇄위험 AX 엔진과의 연결 (엔진 코드는 바꾸지 않음)
--  - 문제 보고 자체는 위험 판단을 만들지 않는다. 변경 예상 종료가 있을 때만 기존 work_events 의
--    '예상 종료 보고' 1건을 같은 트랜잭션에서 남기고 → 기존 판단 대기열(judgment_jobs) → 서버가 엔진으로 판단 전후 기록.
--  - 관리자 일정 조정은 기존 일정 수정본(schedule_revisions)으로 남아 → 같은 대기열 → 재판단.
--  - 사건(field_cases) · 조치 단계(case_steps) · 사진(case_photos)은 그 기록 번호(seq)로 연결된다 = 하나의 사건번호.
--
-- 기록 원칙 (기존과 같음)
--  - 쓰기는 권한을 검사하는 함수로만 · 같은 요청 번호(op_id)는 한 번만 · 한 번에 하나씩(serialize_writes).
--  - 시각 구분: 실제 발생(발견)시각 · 보고 시각 · 서버 기록시각(recorded_at, 서버가 강제) · 입력 방식.
--  - 현장 직원은 본인 담당 사건·사진만 본다 (RLS). 관리자는 활성 + 2단계 인증(aal2).
--  - 사진은 비공개 버킷 'field-photos' — 공개 주소 없음. 관리자 화면은 짧은 서명 주소로만 연다.
-- ════════════════════════════════════════════════════════════════════════

insert into pilot_private.settings (key, value) values ('photo_retention_days', '365') on conflict (key) do nothing;

-- ── 표 ────────────────────────────────────────────────────────────────────

create table public.field_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  op_id uuid not null unique,
  schedule_id uuid not null references public.schedules (id),
  data_kind text not null,
  evidence_class text not null check (evidence_class in ('실제 업무', '현장정보 재현', '가상 시나리오')),
  work_date date not null,
  worker_id uuid not null references public.profiles (id),
  reporter_id uuid not null references public.profiles (id),
  source text not null check (source in ('현장 직원', '관리자')),
  info_source text not null check (info_source in ('현장기사 앱', '전화', '메신저', '업무일지', '시험 시나리오')),
  issue_type text not null check (issue_type in ('기술적 장애', '예상과 다른 설치환경', '추가 장비 필요', '기술 지원 필요', '안전 위험', '기타')),
  type_note text check (char_length(type_note) <= 100),
  progress text not null check (progress in ('작업 시작 전', '분해·설치 시작 후', '작업 진행 중', '작업 중단')),
  needs text[] not null default '{}' check (needs <@ array['원격 기술 지원', '숙련 기술자 지원', '장비 지원', '일정 조정', '보고만']::text[]),
  request text check (char_length(request) <= 500),
  urgency text not null default '보통' check (urgency in ('긴급', '보통')),
  discovered_at timestamptz,
  discovered_basis text not null check (discovered_basis in ('보고와 같은 시각', '현장 직원 진술', '원자료 기록', '기억에 의한 추정', '모름')),
  discovered_entered time,
  reported_at timestamptz not null,
  report_mode text not null check (report_mode in ('즉시 기록', '지연 전송', '사후 입력')),
  report_basis text not null check (report_basis in ('버튼 누른 시각', '현장 직원 진술', '원자료 기록', '기억에 의한 추정')),
  client_pressed_at timestamptz,
  client_sent_at timestamptz,
  send_delay_seconds numeric(10, 1),
  recorded_at timestamptz not null default now(),
  expected_end time,
  end_event_id uuid references public.work_events (id),
  status text not null default '보고됨' check (status in ('보고됨', '접수됨', '조치 중', '현장 해결 보고', '미해결', '해결', '무효')),
  handler_id uuid references public.profiles (id),
  app_version text not null check (char_length(app_version) <= 80),
  updated_at timestamptz not null default now(),
  check (discovered_at is null or discovered_at <= reported_at)
);
create index field_cases_open on public.field_cases (status, data_kind, reported_at);
create index field_cases_worker on public.field_cases (worker_id, work_date);
comment on table public.field_cases is '현장 문제 사건 — 사건번호(HX-실제 업무 · HT-검증 시나리오)로 사진·조치·엔진 기록을 묶는다. 상태는 함수로만 바뀌고, 이력은 case_steps 에 추가만 한다';
comment on column public.field_cases.discovered_at is '실제 문제 발견시각 — 모르면 비움(추정해 채우지 않음). 근거는 discovered_basis';
comment on column public.field_cases.reported_at is '보고 시각 — 즉시: 서버 수신 시각 − 기기 기준 전송 지연 · 사후: 입력한 시각';
comment on column public.field_cases.end_event_id is '엔진에 전달한 예상 종료 보고(work_events) — 예상 종료를 모르면 비어 있고 판단도 생기지 않는다';

create table public.case_steps (
  id uuid primary key default gen_random_uuid(),
  step_no bigint generated always as identity unique,
  op_id uuid not null unique,
  case_id uuid not null references public.field_cases (id),
  kind text not null check (kind in ('접수', '담당자 배정', '지원 조치 결정', '현장 전달', '일정 조정', '예상 종료 변경', '현장 해결 보고', '해결 확인', '미해결 유지', '무효 처리')),
  action text check (action in ('원격 기술 지원', '숙련 직원 투입', '장비 지원', '일정 조정', '지원 불필요', '기타')),
  resolution text check (resolution in ('해결', '임시 조치', '해결 못 함')),
  assignee_id uuid references public.profiles (id),
  assignee_name text check (char_length(assignee_name) <= 40),
  message text check (char_length(message) <= 500),
  occurred_at timestamptz,
  occurred_mode text not null check (occurred_mode in ('즉시 기록', '지연 전송', '사후 입력')),
  occurred_basis text not null check (occurred_basis in ('버튼 누른 시각', '현장 직원 진술', '원자료 기록', '기억에 의한 추정', '모름')),
  client_pressed_at timestamptz,
  client_sent_at timestamptz,
  recorded_at timestamptz not null default now(),
  actor_id uuid not null references public.profiles (id),
  source text not null check (source in ('현장 직원', '관리자')),
  linked_seq bigint,
  linked_job_id uuid,
  app_version text not null check (char_length(app_version) <= 80)
);
create index case_steps_case on public.case_steps (case_id, step_no);
comment on column public.case_steps.linked_seq is '엔진 입력 기록 번호 — 일정 조정(schedule_revisions.seq) · 예상 종료 변경(work_events.seq). 그 번호의 판단 전후가 재판단';

create table public.case_photos (
  id uuid primary key default gen_random_uuid(),
  op_id uuid not null unique,
  case_id uuid references public.field_cases (id),
  safety_check_id uuid,
  owner_id uuid not null references public.profiles (id),
  object_path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  caption text check (char_length(caption) <= 200),
  exif_removed boolean not null,
  recorded_at timestamptz not null default now(),
  retain_until date not null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  delete_reason text check (char_length(delete_reason) <= 200),
  app_version text not null check (char_length(app_version) <= 80),
  check (case_id is not null or safety_check_id is not null)
);
create index case_photos_case on public.case_photos (case_id);
comment on table public.case_photos is '현장 사진 — 파일은 비공개 버킷 field-photos/{올린 사람}/{사건}/{번호}.jpg · 지문(SHA-256)·크기 기록 · 보관 기한이 지나면 관리자가 사유와 함께 삭제(기록은 남음)';

-- ── 권한: 읽기만 (RLS) · 쓰기는 함수로만 ────────────────────────────────────

revoke all on table public.field_cases, public.case_steps, public.case_photos from public, anon, authenticated;
grant select on table public.field_cases, public.case_steps, public.case_photos to authenticated;
alter table public.field_cases enable row level security;
alter table public.case_steps enable row level security;
alter table public.case_photos enable row level security;

create policy "관리자 전체 · 현장 직원은 본인 사건" on public.field_cases for select to authenticated
  using ((select public.pilot_is_admin()) or (worker_id = (select auth.uid()) and (select public.pilot_is_field())));
create policy "관리자 전체 · 현장 직원은 본인 사건" on public.case_steps for select to authenticated
  using ((select public.pilot_is_admin())
      or ((select public.pilot_is_field()) and exists (select 1 from public.field_cases c where c.id = case_id and c.worker_id = (select auth.uid()))));
create policy "관리자 전체 · 현장 직원은 본인 사건·본인 사진" on public.case_photos for select to authenticated
  using ((select public.pilot_is_admin())
      or ((select public.pilot_is_field()) and (owner_id = (select auth.uid())
          or exists (select 1 from public.field_cases c where c.id = case_id and c.worker_id = (select auth.uid())))));

create trigger append_only before update or delete on public.case_steps
  for each row execute function pilot_private.append_only();
create trigger via_function_only before insert or update or delete on public.field_cases
  for each row execute function pilot_private.via_function_only();
create trigger via_function_only before insert or update or delete on public.case_photos
  for each row execute function pilot_private.via_function_only();
create trigger stamp_recorded_at before insert on public.field_cases
  for each row execute function pilot_private.stamp_recorded_at();
create trigger stamp_recorded_at before insert on public.case_steps
  for each row execute function pilot_private.stamp_recorded_at();
create trigger stamp_recorded_at before insert on public.case_photos
  for each row execute function pilot_private.stamp_recorded_at();

-- ── 사진 저장소 (비공개) ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('field-photos', 'field-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "현장 사진 올리기 — 본인 폴더만" on storage.objects for insert to authenticated
  with check (bucket_id = 'field-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select public.pilot_is_field()) or (select public.pilot_is_admin())));
create policy "현장 사진 보기 — 관리자 · 본인이 올린 것 · 본인 사건" on storage.objects for select to authenticated
  using (bucket_id = 'field-photos' and (
    (select public.pilot_is_admin())
    or ((select public.pilot_is_field()) and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.case_photos p join public.field_cases c on c.id = p.case_id
                 where p.object_path = name and c.worker_id = (select auth.uid()))))));
create policy "현장 사진 지우기 — 관리자만" on storage.objects for delete to authenticated
  using (bucket_id = 'field-photos' and (select public.pilot_is_admin()));
-- 덮어쓰기(update) 정책은 두지 않는다 — 한 번 올린 사진은 바꿀 수 없다

-- ── 도우미 ────────────────────────────────────────────────────────────────

-- 즉시: 서버 수신 시각 − 기기 기준 전송 지연 · 사후: 업무 날짜 + 입력 시각
create function pilot_private.case_time(p_date date, p_mode text, p_time time, p_pressed timestamptz, p_sent timestamptz,
  out o_at timestamptz, out o_entry text, out o_delay numeric)
language plpgsql stable set search_path = ''
as $$
begin
  if p_mode = '즉시' then
    o_delay := greatest(0, coalesce(extract(epoch from (p_sent - p_pressed)), 0));
    if o_delay > 12 * 3600 then
      raise exception '[입력] 12시간이 지난 기록은 사후 입력으로 넣어 주세요.';
    end if;
    o_at := now() - make_interval(secs => o_delay);
    o_entry := case when o_delay <= 120 then '즉시 기록' else '지연 전송' end;
  elsif p_mode = '사후' then
    if p_time is null then
      raise exception '[입력] 사후 입력은 실제 시각을 넣어야 합니다.';
    end if;
    o_at := (p_date + p_time) at time zone 'Asia/Seoul';
    if o_at > now() + interval '1 minute' then
      raise exception '[입력] 아직 오지 않은 시각은 기록할 수 없습니다.';
    end if;
    o_entry := '사후 입력';
    o_delay := null;
  elsif p_mode = '모름' then
    o_at := null;
    o_entry := '사후 입력';
    o_delay := null;
  else
    raise exception '[입력] 기록 방식은 즉시 · 사후 · 모름 중 하나입니다.';
  end if;
end $$;

create function pilot_private.case_access(p_case uuid, p_need_admin boolean) returns public.field_cases
language plpgsql stable security definer set search_path = ''
as $$
declare v public.field_cases;
begin
  select * into v from public.field_cases where id = p_case;
  if not found then
    raise exception '[입력] 사건을 찾을 수 없습니다.';
  end if;
  if public.pilot_is_admin() then
    return v;
  end if;
  if p_need_admin then
    raise exception '[권한] 관리자(2단계 인증 완료)만 할 수 있습니다.';
  end if;
  if not (public.pilot_is_field() and v.worker_id = auth.uid()) then
    raise exception '[권한] 본인 담당 사건만 다룰 수 있습니다.';
  end if;
  return v;
end $$;

create function pilot_private.set_case(p_case uuid, p_status text, p_handler uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('pilot.via_function', 'on', true);
  update public.field_cases set status = coalesce(p_status, status), handler_id = coalesce(p_handler, handler_id), updated_at = now()
  where id = p_case;
end $$;

-- ── 문제 보고 (현장 직원 · 관리자 대리) ─────────────────────────────────────

create function public.report_case(
  p_op_id uuid,
  p_schedule_id uuid,
  p_issue_type text,
  p_type_note text,
  p_progress text,
  p_needs text[],
  p_request text,
  p_urgency text,
  p_discovered_basis text,
  p_discovered_time time,
  p_report_mode text,
  p_report_time time,
  p_report_basis text,
  p_expected_end time,
  p_info_source text,
  p_evidence_class text,
  p_client_pressed_at timestamptz,
  p_client_sent_at timestamptz,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.pilot_is_admin();
  v_case public.field_cases;
  v_s public.schedules;
  v_t record;
  v_disc timestamptz;
  v_no text;
  v_ev jsonb;
  v_end_event uuid;
begin
  perform pilot_private.serialize_writes();
  if not (v_admin or public.pilot_is_field()) then
    raise exception '[권한] 활성화된 실증 계정만 보고할 수 있습니다 (관리자는 2단계 인증 필요).';
  end if;
  if p_op_id is null then
    raise exception '[입력] 요청 번호(op_id)가 없습니다.';
  end if;
  select * into v_case from public.field_cases where op_id = p_op_id;
  if found then
    if v_case.reporter_id <> v_uid then
      raise exception '[권한] 다른 사용자의 요청 번호입니다.';
    end if;
    return jsonb_build_object('case_id', v_case.id, 'case_no', v_case.case_no, 'end_event_id', v_case.end_event_id,
      'job_id', (select j.id from public.judgment_jobs j join public.work_events e on e.seq = j.seq where e.id = v_case.end_event_id),
      'duplicated', true);
  end if;

  select * into v_s from public.schedules where id = p_schedule_id for update;
  if not found then
    raise exception '[입력] 일정을 찾을 수 없습니다.';
  end if;
  if not v_admin and v_s.assignee_id <> v_uid then
    raise exception '[권한] 본인 담당 일정에만 보고할 수 있습니다.';
  end if;
  if v_s.status = '취소' then
    raise exception '[입력] 취소된 일정입니다.';
  end if;
  if (v_s.data_kind = '실제 업무') <> (p_evidence_class = '실제 업무') or p_evidence_class not in ('실제 업무', '현장정보 재현', '가상 시나리오') then
    raise exception '[입력] 자료 구분이 일정의 데이터 구분(%)과 맞지 않습니다.', v_s.data_kind;
  end if;
  if p_info_source not in ('현장기사 앱', '전화', '메신저', '업무일지', '시험 시나리오') then
    raise exception '[입력] 자료 출처를 고르세요.';
  end if;
  if not v_admin and p_info_source <> '현장기사 앱' then
    raise exception '[입력] 현장 직원 보고의 출처는 현장기사 앱입니다.';
  end if;

  -- 보고 시각
  select * into v_t from pilot_private.case_time(v_s.work_date, p_report_mode, p_report_time, p_client_pressed_at, p_client_sent_at);
  if v_t.o_at is null then
    raise exception '[입력] 보고 시각이 필요합니다.';
  end if;
  if p_report_mode = '즉시' and coalesce(p_report_basis, '버튼 누른 시각') <> '버튼 누른 시각' then
    raise exception '[입력] 즉시 보고의 시각 근거는 버튼 누른 시각입니다.';
  end if;
  if p_report_mode = '사후' and coalesce(p_report_basis, '') not in ('현장 직원 진술', '원자료 기록', '기억에 의한 추정') then
    raise exception '[입력] 사후 입력한 보고 시각의 근거를 고르세요.';
  end if;

  -- 발견시각 (모르면 비움)
  if p_discovered_basis = '보고와 같은 시각' then
    v_disc := v_t.o_at;
  elsif p_discovered_basis = '모름' then
    v_disc := null;
  elsif p_discovered_basis in ('현장 직원 진술', '원자료 기록', '기억에 의한 추정') then
    if p_discovered_time is null then
      raise exception '[입력] 문제 발견시각을 넣거나 모름을 고르세요.';
    end if;
    v_disc := (v_s.work_date + p_discovered_time) at time zone 'Asia/Seoul';
    if v_disc > v_t.o_at then
      raise exception '[입력] 문제 발견시각이 보고 시각보다 늦을 수 없습니다.';
    end if;
  else
    raise exception '[입력] 발견시각 근거를 고르세요.';
  end if;

  if coalesce(cardinality(p_needs), 0) > 5 then
    raise exception '[입력] 지원 요청 항목이 너무 많습니다.';
  end if;

  -- 엔진 연결: 변경 예상 종료가 있을 때만 기존 '예상 종료 보고' 1건 (같은 트랜잭션)
  if p_expected_end is not null then
    v_ev := pilot_private.record_work_event_body(
      extensions.gen_random_uuid(), v_s.id, '예상 종료 보고',
      case when p_report_mode = '즉시' then '즉시' else '사후' end,
      case when p_report_mode = '즉시' then null else p_report_time end,
      p_expected_end, p_client_pressed_at, p_client_sent_at, null, '현장 문제 보고');
    v_end_event := (v_ev ->> 'event_id')::uuid;
  end if;

  v_no := case when v_s.data_kind = '실제 업무' then 'HX-' else 'HT-' end || to_char(v_s.work_date, 'YYYYMMDD') || '-'
       || lpad((select count(*) + 1 from public.field_cases c where c.work_date = v_s.work_date and c.data_kind = v_s.data_kind)::text, 3, '0');

  perform set_config('pilot.via_function', 'on', true);
  insert into public.field_cases (case_no, op_id, schedule_id, data_kind, evidence_class, work_date, worker_id, reporter_id, source, info_source,
    issue_type, type_note, progress, needs, request, urgency, discovered_at, discovered_basis, discovered_entered,
    reported_at, report_mode, report_basis, client_pressed_at, client_sent_at, send_delay_seconds, expected_end, end_event_id, app_version)
  values (v_no, p_op_id, v_s.id, v_s.data_kind, p_evidence_class, v_s.work_date, v_s.assignee_id, v_uid,
    case when v_admin then '관리자' else '현장 직원' end, p_info_source,
    p_issue_type, nullif(btrim(coalesce(p_type_note, '')), ''), p_progress, coalesce(p_needs, '{}'), nullif(btrim(coalesce(p_request, '')), ''),
    coalesce(p_urgency, '보통'), v_disc, p_discovered_basis, case when p_discovered_basis in ('현장 직원 진술', '원자료 기록', '기억에 의한 추정') then p_discovered_time end,
    v_t.o_at, v_t.o_entry, case when p_report_mode = '즉시' then '버튼 누른 시각' else p_report_basis end,
    p_client_pressed_at, p_client_sent_at, v_t.o_delay, p_expected_end, v_end_event, left(coalesce(p_app_version, '미상'), 80))
  returning * into v_case;

  return jsonb_build_object('case_id', v_case.id, 'case_no', v_case.case_no, 'end_event_id', v_end_event,
    'job_id', v_ev ->> 'job_id', 'reported_at', v_case.reported_at, 'recorded_at', v_case.recorded_at, 'duplicated', false);
end $$;

-- ── 조치·해결 단계 ─────────────────────────────────────────────────────────

create function public.case_step(
  p_op_id uuid,
  p_case_id uuid,
  p_kind text,
  p_action text,
  p_resolution text,
  p_assignee_id uuid,
  p_assignee_name text,
  p_message text,
  p_mode text,
  p_time time,
  p_basis text,
  p_client_pressed_at timestamptz,
  p_client_sent_at timestamptz,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_case public.field_cases;
  v_step public.case_steps;
  v_t record;
  v_status text;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_handler uuid;
  r record;
begin
  perform pilot_private.serialize_writes();
  if p_op_id is null then
    raise exception '[입력] 요청 번호(op_id)가 없습니다.';
  end if;
  select * into v_step from public.case_steps where op_id = p_op_id;
  if found then
    return jsonb_build_object('step_id', v_step.id, 'status', (select c.status from public.field_cases c where c.id = v_step.case_id), 'duplicated', true);
  end if;
  v_case := pilot_private.case_access(p_case_id, p_kind <> '현장 해결 보고');
  v_admin := public.pilot_is_admin();
  if p_kind = '현장 해결 보고' and not v_admin and v_case.worker_id <> v_uid then
    raise exception '[권한] 본인 담당 사건만 보고할 수 있습니다.';
  end if;
  if v_case.status in ('해결', '무효') then
    raise exception '[입력] 이미 % 처리된 사건입니다.', v_case.status;
  end if;

  select * into v_t from pilot_private.case_time(v_case.work_date, p_mode, p_time, p_client_pressed_at, p_client_sent_at);
  if p_mode = '사후' and coalesce(p_basis, '') not in ('현장 직원 진술', '원자료 기록', '기억에 의한 추정') then
    raise exception '[입력] 사후 입력한 시각의 근거를 고르세요.';
  end if;
  if v_t.o_at is not null and v_t.o_at < v_case.reported_at - interval '1 minute' then
    raise exception '[입력] 문제 보고 시각(%)보다 이른 시각입니다.', to_char(v_case.reported_at at time zone 'Asia/Seoul', 'HH24:MI');
  end if;

  -- 단계별 규칙과 상태
  if p_kind = '접수' then
    if v_case.status <> '보고됨' then
      raise exception '[중복] 이미 접수된 사건입니다.';
    end if;
    v_status := '접수됨';
  elsif p_kind = '담당자 배정' then
    if v_case.status = '보고됨' then
      raise exception '[순서] 먼저 접수해 주세요 (보고 → 관리자 확인 시간을 따로 잽니다).';
    end if;
    if p_assignee_id is null and nullif(btrim(coalesce(p_assignee_name, '')), '') is null then
      raise exception '[입력] 담당자를 고르거나 이름을 넣어 주세요.';
    end if;
    if p_assignee_id is not null and not exists (select 1 from public.profiles p where p.id = p_assignee_id and p.active) then
      raise exception '[입력] 활성 계정만 담당자로 배정할 수 있습니다.';
    end if;
    v_handler := p_assignee_id;
  elsif p_kind in ('지원 조치 결정', '현장 전달') then
    if v_case.status = '보고됨' then
      raise exception '[순서] 먼저 접수해 주세요 (보고 → 관리자 확인 시간을 따로 잽니다).';
    end if;
    if p_kind = '지원 조치 결정' and p_action is null then
      raise exception '[입력] 지원 조치를 고르세요.';
    end if;
    if p_kind = '현장 전달' and v_msg is null then
      raise exception '[입력] 현장에 전달할 내용을 넣어 주세요.';
    end if;
    v_status := '조치 중';
  elsif p_kind = '현장 해결 보고' then
    if p_resolution is null then
      raise exception '[입력] 해결 여부를 고르세요.';
    end if;
    v_status := case when p_resolution = '해결' then '현장 해결 보고' else '미해결' end;
  elsif p_kind = '해결 확인' then
    if v_case.status = '보고됨' then
      raise exception '[순서] 먼저 접수해 주세요.';
    end if;
    v_status := '해결';
  elsif p_kind = '미해결 유지' then
    if v_msg is null then
      raise exception '[입력] 미해결로 두는 이유를 넣어 주세요.';
    end if;
    v_status := '미해결';
  elsif p_kind = '무효 처리' then
    if v_msg is null then
      raise exception '[입력] 무효 사유를 넣어 주세요.';
    end if;
    v_status := '무효';
    -- 이 사건에서 엔진에 넘긴 예상 종료 기록도 무효 (관리자가 바꾼 일정은 실제 조치이므로 그대로)
    for r in select e.id from public.work_events e
             where e.id in (select v_case.end_event_id union select we.id from public.case_steps cs join public.work_events we on we.seq = cs.linked_seq
                            where cs.case_id = v_case.id and cs.kind = '예상 종료 변경')
               and e.kind = '예상 종료 보고' and pilot_private.event_active(e.id) loop
      perform pilot_private.record_work_event_body(extensions.gen_random_uuid(), v_case.schedule_id, '기록 무효', '즉시', null, null,
        now(), now(), r.id, left('사건 ' || v_case.case_no || ' 무효', 200));
    end loop;
  else
    raise exception '[입력] 이 기능으로 기록할 수 없는 단계입니다 (일정 조정·예상 종료 변경은 전용 기능).';
  end if;

  insert into public.case_steps (op_id, case_id, kind, action, resolution, assignee_id, assignee_name, message, occurred_at, occurred_mode, occurred_basis,
    client_pressed_at, client_sent_at, actor_id, source, app_version)
  values (p_op_id, v_case.id, p_kind, case when p_kind = '지원 조치 결정' then p_action end, case when p_kind = '현장 해결 보고' then p_resolution end,
    p_assignee_id, nullif(btrim(coalesce(p_assignee_name, '')), ''), v_msg, v_t.o_at, v_t.o_entry,
    case when p_mode = '즉시' then '버튼 누른 시각' when p_mode = '모름' then '모름' else p_basis end,
    p_client_pressed_at, p_client_sent_at, v_uid, case when v_admin then '관리자' else '현장 직원' end, left(coalesce(p_app_version, '미상'), 80))
  returning * into v_step;
  perform pilot_private.set_case(v_case.id, v_status, v_handler);
  return jsonb_build_object('step_id', v_step.id, 'status', coalesce(v_status, v_case.status), 'recorded_at', v_step.recorded_at, 'duplicated', false);
end $$;

-- ── 관리자 일정 조정 → 재판단 (기존 일정 수정본 · 판단 대기열 그대로) ─────────

create function public.case_adjust_schedule(
  p_op_id uuid,
  p_case_id uuid,
  p_schedule_id uuid,
  p_expected_version int,
  p_planned_start time,
  p_planned_end time,
  p_message text,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_case public.field_cases;
  v_step public.case_steps;
  v_s public.schedules;
  v_r jsonb;
begin
  perform pilot_private.serialize_writes();
  select * into v_step from public.case_steps where op_id = p_op_id;
  if found then
    return jsonb_build_object('step_id', v_step.id, 'seq', v_step.linked_seq, 'job_id', v_step.linked_job_id, 'duplicated', true);
  end if;
  v_case := pilot_private.case_access(p_case_id, true);
  if v_case.status in ('해결', '무효') then
    raise exception '[입력] 이미 % 처리된 사건입니다.', v_case.status;
  end if;
  if v_case.status = '보고됨' then
    raise exception '[순서] 먼저 접수해 주세요.';
  end if;
  if nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception '[입력] 조정 사유를 넣어 주세요.';
  end if;
  select * into v_s from public.schedules where id = p_schedule_id;
  if not found or v_s.work_date <> v_case.work_date or v_s.data_kind <> v_case.data_kind then
    raise exception '[입력] 같은 날짜·같은 데이터 구분의 일정만 조정할 수 있습니다.';
  end if;
  -- 시스템이 일정을 정하지 않는다 — 관리자가 넣은 시작·종료만 바꾸고 나머지는 그대로 둔다
  v_r := pilot_private.save_schedule_body(extensions.gen_random_uuid(), v_s.id, p_expected_version, v_s.data_kind, v_s.work_date, v_s.assignee_id,
    v_s.site_name, v_s.region, p_planned_start, p_planned_end, v_s.travel_minutes, v_s.priority, v_s.note);
  insert into public.case_steps (op_id, case_id, kind, message, occurred_at, occurred_mode, occurred_basis, actor_id, source, linked_seq, linked_job_id, app_version)
  values (p_op_id, v_case.id, '일정 조정', left(v_s.site_name || ' ' || to_char(p_planned_start, 'HH24:MI') || '~' || to_char(p_planned_end, 'HH24:MI') || ' · ' || btrim(p_message), 500),
    now(), '즉시 기록', '버튼 누른 시각', auth.uid(), '관리자', (v_r ->> 'seq')::bigint, (v_r ->> 'job_id')::uuid, left(coalesce(p_app_version, '미상'), 80))
  returning * into v_step;
  perform pilot_private.set_case(v_case.id, '조치 중', null);
  return jsonb_build_object('step_id', v_step.id, 'seq', v_step.linked_seq, 'job_id', v_step.linked_job_id, 'duplicated', false);
end $$;

-- ── 예상 종료 변경 (현장 직원 · 관리자) → 엔진 ───────────────────────────────

create function public.case_expected_end(
  p_op_id uuid,
  p_case_id uuid,
  p_expected_end time,
  p_mode text,
  p_time time,
  p_basis text,
  p_client_pressed_at timestamptz,
  p_client_sent_at timestamptz,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_case public.field_cases;
  v_step public.case_steps;
  v_ev jsonb;
  v_admin boolean;
begin
  perform pilot_private.serialize_writes();
  select * into v_step from public.case_steps where op_id = p_op_id;
  if found then
    return jsonb_build_object('step_id', v_step.id, 'seq', v_step.linked_seq, 'job_id', v_step.linked_job_id, 'duplicated', true);
  end if;
  v_case := pilot_private.case_access(p_case_id, false);
  v_admin := public.pilot_is_admin();
  if v_case.status in ('해결', '무효') then
    raise exception '[입력] 이미 % 처리된 사건입니다.', v_case.status;
  end if;
  if p_expected_end is null then
    raise exception '[입력] 변경 예상 종료 시각을 넣어 주세요.';
  end if;
  if p_mode = '사후' and coalesce(p_basis, '') not in ('현장 직원 진술', '원자료 기록', '기억에 의한 추정') then
    raise exception '[입력] 사후 입력한 시각의 근거를 고르세요.';
  end if;
  v_ev := pilot_private.record_work_event_body(extensions.gen_random_uuid(), v_case.schedule_id, '예상 종료 보고', p_mode,
    case when p_mode = '사후' then p_time end, p_expected_end, p_client_pressed_at, p_client_sent_at, null, left('사건 ' || v_case.case_no, 200));
  insert into public.case_steps (op_id, case_id, kind, message, occurred_at, occurred_mode, occurred_basis, client_pressed_at, client_sent_at,
    actor_id, source, linked_seq, linked_job_id, app_version)
  values (p_op_id, v_case.id, '예상 종료 변경', '변경 예상 종료 ' || to_char(p_expected_end, 'HH24:MI'), (v_ev ->> 'occurred_at')::timestamptz,
    (v_ev ->> 'entry_mode'), case when p_mode = '즉시' then '버튼 누른 시각' else p_basis end, p_client_pressed_at, p_client_sent_at,
    auth.uid(), case when v_admin then '관리자' else '현장 직원' end, (v_ev ->> 'seq')::bigint, (v_ev ->> 'job_id')::uuid, left(coalesce(p_app_version, '미상'), 80))
  returning * into v_step;
  if v_case.status = '보고됨' then
    null; -- 보고만 갱신 — 관리자 확인 전이므로 상태 그대로
  end if;
  return jsonb_build_object('step_id', v_step.id, 'seq', v_step.linked_seq, 'job_id', v_step.linked_job_id, 'duplicated', false);
end $$;

-- ── 사진 등록 · 삭제 ───────────────────────────────────────────────────────

create function public.attach_case_photo(
  p_op_id uuid,
  p_case_id uuid,
  p_object_path text,
  p_mime text,
  p_size int,
  p_sha256 text,
  p_caption text,
  p_exif_removed boolean,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_case public.field_cases;
  v_p public.case_photos;
  v_days int;
begin
  perform pilot_private.serialize_writes();
  select * into v_p from public.case_photos where op_id = p_op_id;
  if found then
    return jsonb_build_object('photo_id', v_p.id, 'duplicated', true);
  end if;
  v_case := pilot_private.case_access(p_case_id, false);
  if v_case.status = '무효' then
    raise exception '[입력] 무효 처리된 사건입니다.';
  end if;
  if p_object_path is null or p_object_path not like v_uid::text || '/' || v_case.id::text || '/%' then
    raise exception '[입력] 사진 위치가 이 사건·본인 폴더가 아닙니다.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'field-photos' and o.name = p_object_path and o.owner_id = v_uid::text) then
    raise exception '[입력] 올린 사진 파일을 찾을 수 없습니다 (업로드가 끝나지 않았습니다).';
  end if;
  select coalesce(nullif(s.value, '')::int, 365) into v_days from pilot_private.settings s where s.key = 'photo_retention_days';
  perform set_config('pilot.via_function', 'on', true);
  insert into public.case_photos (op_id, case_id, owner_id, object_path, mime, size_bytes, sha256, caption, exif_removed, retain_until, app_version)
  values (p_op_id, v_case.id, v_uid, p_object_path, p_mime, p_size, lower(p_sha256), nullif(btrim(coalesce(p_caption, '')), ''), coalesce(p_exif_removed, false),
    v_case.work_date + coalesce(v_days, 365), left(coalesce(p_app_version, '미상'), 80))
  returning * into v_p;
  return jsonb_build_object('photo_id', v_p.id, 'recorded_at', v_p.recorded_at, 'retain_until', v_p.retain_until, 'duplicated', false);
end $$;

-- 사진 삭제 표시 (관리자) — 파일 삭제는 서버가 이어서 저장소에서 지운다. 기록 행은 남는다
create function public.mark_photo_deleted(p_photo_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_p public.case_photos;
begin
  perform pilot_private.serialize_writes();
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 사진을 지울 수 있습니다.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception '[입력] 삭제 사유를 넣어 주세요.';
  end if;
  select * into v_p from public.case_photos where id = p_photo_id for update;
  if not found then
    raise exception '[입력] 사진을 찾을 수 없습니다.';
  end if;
  if v_p.deleted_at is null then
    perform set_config('pilot.via_function', 'on', true);
    update public.case_photos set deleted_at = now(), deleted_by = auth.uid(), delete_reason = left(btrim(p_reason), 200) where id = p_photo_id
    returning * into v_p;
  end if;
  return jsonb_build_object('photo_id', v_p.id, 'object_path', v_p.object_path, 'deleted_at', v_p.deleted_at);
end $$;

-- ── 함수 실행 권한 ─────────────────────────────────────────────────────────

revoke execute on all functions in schema pilot_private from public, anon, authenticated;
revoke execute on function
  public.report_case(uuid, uuid, text, text, text, text[], text, text, text, time, text, time, text, time, text, text, timestamptz, timestamptz, text),
  public.case_step(uuid, uuid, text, text, text, uuid, text, text, text, time, text, timestamptz, timestamptz, text),
  public.case_adjust_schedule(uuid, uuid, uuid, int, time, time, text, text),
  public.case_expected_end(uuid, uuid, time, text, time, text, timestamptz, timestamptz, text),
  public.attach_case_photo(uuid, uuid, text, text, int, text, text, boolean, text),
  public.mark_photo_deleted(uuid, text)
  from public, anon;
grant execute on function
  public.report_case(uuid, uuid, text, text, text, text[], text, text, text, time, text, time, text, time, text, text, timestamptz, timestamptz, text),
  public.case_step(uuid, uuid, text, text, text, uuid, text, text, text, time, text, timestamptz, timestamptz, text),
  public.case_adjust_schedule(uuid, uuid, uuid, int, time, time, text, text),
  public.case_expected_end(uuid, uuid, time, text, time, text, timestamptz, timestamptz, text),
  public.attach_case_photo(uuid, uuid, text, text, int, text, text, boolean, text),
  public.mark_photo_deleted(uuid, text)
  to authenticated;
-- └── 20261113010000_field_cases.sql 끝

-- ┌── 20261113020000_safety_checks.sql ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
-- 현장 실사용 2차 — 작업 전·중·종료 안전점검 (2026-11-13 구본석 이사 요청)
--
--  - 현장 직원: 단계별 필수 안전항목 체크(확인 · 해당 없음 · 미흡) + 착용 사진(1장 이상) 제출
--  - 관리자: 사진과 체크 내용을 눈으로 확인한 결과만 기록 (적합(육안 확인) · 보완 요청 · 조치 완료 확인)
--  - 사진이 있다고 착용·기준 충족으로 자동 처리하지 않는다. 사진 인식(AI)은 쓰지 않는다.
--  - 미흡 항목이 있으면 화면이 작업 중지·직접 연락을 안내한다 (프로그램 판단을 기다리지 않음)
--  - 점검 항목은 초안이다 — 회사 안전기준으로 확정해 바꾼다 (항목 키는 아래 safety_item_keys)
--  - 이력은 safety_reviews 에 추가만 한다. 사진은 현장 사진과 같은 비공개 버킷·같은 보관 기준
-- ════════════════════════════════════════════════════════════════════════

create function pilot_private.safety_item_keys() returns text[]
language sql immutable set search_path = ''
as $$ select array['helmet', 'shoes', 'harness', 'gloves', 'zone', 'ladder', 'power', 'cleanup']::text[] $$;

create table public.safety_checks (
  id uuid primary key default gen_random_uuid(),
  check_no text not null unique,
  op_id uuid not null unique,
  schedule_id uuid not null references public.schedules (id),
  data_kind text not null,
  work_date date not null,
  worker_id uuid not null references public.profiles (id),
  reporter_id uuid not null references public.profiles (id),
  source text not null check (source in ('현장 직원', '관리자')),
  stage text not null check (stage in ('작업 전', '작업 중', '작업 종료')),
  items jsonb not null,
  deficient text[] not null default '{}',
  note text check (char_length(note) <= 500),
  checked_at timestamptz,
  check_mode text not null check (check_mode in ('즉시 기록', '지연 전송', '사후 입력')),
  check_basis text not null check (check_basis in ('버튼 누른 시각', '현장 직원 진술', '원자료 기록', '기억에 의한 추정', '모름')),
  recorded_at timestamptz not null default now(),
  review_status text not null default '확인 대기' check (review_status in ('확인 대기', '적합(육안 확인)', '보완 요청', '보완 제출', '조치 완료')),
  app_version text not null check (char_length(app_version) <= 80),
  updated_at timestamptz not null default now()
);
create index safety_checks_day on public.safety_checks (work_date, data_kind, review_status);
comment on table public.safety_checks is '안전점검 — 체크 결과와 사진은 현장 직원 입력값이고, 적합 여부는 관리자의 육안 확인 기록(safety_reviews)으로만 정해진다';
comment on column public.safety_checks.deficient is '미흡으로 체크한 항목 키 — 있으면 작업 중지·직접 연락 안내 대상';

create table public.safety_reviews (
  id uuid primary key default gen_random_uuid(),
  review_no bigint generated always as identity unique,
  op_id uuid not null unique,
  check_id uuid not null references public.safety_checks (id),
  kind text not null check (kind in ('관리자 확인', '보완 요청', '보완 제출', '조치 완료 확인')),
  result text check (result in ('적합(육안 확인)', '보완 필요')),
  message text check (char_length(message) <= 500),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor_id uuid not null references public.profiles (id),
  source text not null check (source in ('현장 직원', '관리자')),
  app_version text not null check (char_length(app_version) <= 80)
);
create index safety_reviews_check on public.safety_reviews (check_id, review_no);

alter table public.case_photos add constraint case_photos_safety_fk foreign key (safety_check_id) references public.safety_checks (id);

revoke all on table public.safety_checks, public.safety_reviews from public, anon, authenticated;
grant select on table public.safety_checks, public.safety_reviews to authenticated;
alter table public.safety_checks enable row level security;
alter table public.safety_reviews enable row level security;

create policy "관리자 전체 · 현장 직원은 본인 점검" on public.safety_checks for select to authenticated
  using ((select public.pilot_is_admin()) or (worker_id = (select auth.uid()) and (select public.pilot_is_field())));
create policy "관리자 전체 · 현장 직원은 본인 점검" on public.safety_reviews for select to authenticated
  using ((select public.pilot_is_admin())
      or ((select public.pilot_is_field()) and exists (select 1 from public.safety_checks c where c.id = check_id and c.worker_id = (select auth.uid()))));
-- 안전점검 사진도 본인 점검이면 볼 수 있다 (기존 사진 정책은 사건 기준 — 점검 기준을 더한다)
create policy "현장 직원은 본인 안전점검 사진" on public.case_photos for select to authenticated
  using ((select public.pilot_is_field()) and exists (select 1 from public.safety_checks c where c.id = safety_check_id and c.worker_id = (select auth.uid())));

create trigger append_only before update or delete on public.safety_reviews
  for each row execute function pilot_private.append_only();
create trigger via_function_only before insert or update or delete on public.safety_checks
  for each row execute function pilot_private.via_function_only();
create trigger stamp_recorded_at before insert on public.safety_checks
  for each row execute function pilot_private.stamp_recorded_at();
create trigger stamp_recorded_at before insert on public.safety_reviews
  for each row execute function pilot_private.stamp_recorded_at();

-- ── 점검 제출 (현장 직원 · 관리자 대리) ─────────────────────────────────────

create function public.submit_safety_check(
  p_op_id uuid,
  p_schedule_id uuid,
  p_stage text,
  p_items jsonb,
  p_note text,
  p_mode text,
  p_time time,
  p_basis text,
  p_client_pressed_at timestamptz,
  p_client_sent_at timestamptz,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.pilot_is_admin();
  v_c public.safety_checks;
  v_s public.schedules;
  v_t record;
  v_item jsonb;
  v_keys text[] := '{}';
  v_def text[] := '{}';
  v_no text;
begin
  perform pilot_private.serialize_writes();
  if not (v_admin or public.pilot_is_field()) then
    raise exception '[권한] 활성화된 실증 계정만 점검을 제출할 수 있습니다 (관리자는 2단계 인증 필요).';
  end if;
  select * into v_c from public.safety_checks where op_id = p_op_id;
  if found then
    return jsonb_build_object('check_id', v_c.id, 'check_no', v_c.check_no, 'deficient', to_jsonb(v_c.deficient), 'duplicated', true);
  end if;
  select * into v_s from public.schedules where id = p_schedule_id;
  if not found then
    raise exception '[입력] 일정을 찾을 수 없습니다.';
  end if;
  if not v_admin and v_s.assignee_id <> v_uid then
    raise exception '[권한] 본인 담당 일정만 점검할 수 있습니다.';
  end if;
  if v_s.status = '취소' then
    raise exception '[입력] 취소된 일정입니다.';
  end if;
  if p_stage not in ('작업 전', '작업 중', '작업 종료') then
    raise exception '[입력] 점검 단계를 고르세요.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '[입력] 점검 항목이 없습니다.';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if not ((v_item ->> 'key') = any (pilot_private.safety_item_keys())) or (v_item ->> 'answer') not in ('확인', '해당 없음', '미흡') then
      raise exception '[입력] 점검 항목·답을 확인해 주세요 (확인 · 해당 없음 · 미흡).';
    end if;
    if (v_item ->> 'key') = any (v_keys) then
      raise exception '[입력] 같은 항목이 두 번 있습니다.';
    end if;
    v_keys := v_keys || (v_item ->> 'key');
    if (v_item ->> 'answer') = '미흡' then
      v_def := v_def || (v_item ->> 'key');
    end if;
  end loop;
  if not (array['helmet', 'shoes', 'zone'] <@ v_keys) then
    raise exception '[입력] 필수 항목(안전모 · 안전화 · 작업구역 통제)에 모두 답해 주세요.';
  end if;
  select * into v_t from pilot_private.case_time(v_s.work_date, p_mode, p_time, p_client_pressed_at, p_client_sent_at);
  if p_mode = '사후' and coalesce(p_basis, '') not in ('현장 직원 진술', '원자료 기록', '기억에 의한 추정') then
    raise exception '[입력] 사후 입력한 시각의 근거를 고르세요.';
  end if;
  v_no := case when v_s.data_kind = '실제 업무' then 'SX-' else 'ST-' end || to_char(v_s.work_date, 'YYYYMMDD') || '-'
       || lpad((select count(*) + 1 from public.safety_checks c where c.work_date = v_s.work_date and c.data_kind = v_s.data_kind)::text, 3, '0');
  perform set_config('pilot.via_function', 'on', true);
  insert into public.safety_checks (check_no, op_id, schedule_id, data_kind, work_date, worker_id, reporter_id, source, stage, items, deficient, note,
    checked_at, check_mode, check_basis, app_version)
  values (v_no, p_op_id, v_s.id, v_s.data_kind, v_s.work_date, v_s.assignee_id, v_uid, case when v_admin then '관리자' else '현장 직원' end, p_stage,
    p_items, v_def, nullif(btrim(coalesce(p_note, '')), ''), v_t.o_at, v_t.o_entry,
    case when p_mode = '즉시' then '버튼 누른 시각' when p_mode = '모름' then '모름' else p_basis end, left(coalesce(p_app_version, '미상'), 80))
  returning * into v_c;
  return jsonb_build_object('check_id', v_c.id, 'check_no', v_c.check_no, 'deficient', to_jsonb(v_c.deficient), 'recorded_at', v_c.recorded_at, 'duplicated', false);
end $$;

-- ── 확인 · 보완 요청 · 보완 제출 · 조치 완료 확인 ─────────────────────────────

create function public.safety_review(
  p_op_id uuid,
  p_check_id uuid,
  p_kind text,
  p_result text,
  p_message text,
  p_client_pressed_at timestamptz,
  p_client_sent_at timestamptz,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.pilot_is_admin();
  v_c public.safety_checks;
  v_r public.safety_reviews;
  v_t record;
  v_status text;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
begin
  perform pilot_private.serialize_writes();
  select * into v_r from public.safety_reviews where op_id = p_op_id;
  if found then
    return jsonb_build_object('review_id', v_r.id, 'status', (select c.review_status from public.safety_checks c where c.id = v_r.check_id), 'duplicated', true);
  end if;
  select * into v_c from public.safety_checks where id = p_check_id for update;
  if not found then
    raise exception '[입력] 안전점검을 찾을 수 없습니다.';
  end if;
  if p_kind = '보완 제출' then
    if not (public.pilot_is_field() and v_c.worker_id = v_uid) and not v_admin then
      raise exception '[권한] 본인 점검만 보완 제출할 수 있습니다.';
    end if;
    if v_c.review_status <> '보완 요청' then
      raise exception '[순서] 관리자 보완 요청이 있을 때만 보완 제출합니다.';
    end if;
    if v_msg is null then
      raise exception '[입력] 보완한 내용을 넣어 주세요.';
    end if;
    v_status := '보완 제출';
  else
    if not v_admin then
      raise exception '[권한] 관리자(2단계 인증 완료)만 확인 결과를 기록할 수 있습니다.';
    end if;
    if p_kind = '관리자 확인' then
      if v_c.review_status <> '확인 대기' then
        raise exception '[중복] 이미 확인한 점검입니다 (보완은 보완 요청으로).';
      end if;
      if p_result = '적합(육안 확인)' then
        if cardinality(v_c.deficient) > 0 then
          raise exception '[입력] 미흡 항목이 있는 점검은 적합으로 둘 수 없습니다 — 보완 요청하세요.';
        end if;
        if not exists (select 1 from public.case_photos p where p.safety_check_id = v_c.id and p.deleted_at is null) then
          raise exception '[입력] 착용 사진이 없는 점검은 눈으로 확인할 수 없습니다 — 보완 요청하세요.';
        end if;
        v_status := '적합(육안 확인)';
      elsif p_result = '보완 필요' then
        if v_msg is null then
          raise exception '[입력] 보완할 내용을 넣어 주세요.';
        end if;
        v_status := '보완 요청';
      else
        raise exception '[입력] 확인 결과를 고르세요.';
      end if;
    elsif p_kind = '보완 요청' then
      if v_msg is null then
        raise exception '[입력] 보완할 내용을 넣어 주세요.';
      end if;
      if v_c.review_status = '조치 완료' then
        raise exception '[입력] 이미 조치 완료된 점검입니다.';
      end if;
      v_status := '보완 요청';
    elsif p_kind = '조치 완료 확인' then
      if v_c.review_status <> '보완 제출' then
        raise exception '[순서] 현장의 보완 제출이 있어야 조치 완료로 확인합니다.';
      end if;
      v_status := '조치 완료';
    else
      raise exception '[입력] 알 수 없는 단계입니다.';
    end if;
  end if;
  select * into v_t from pilot_private.case_time(v_c.work_date, '즉시', null, p_client_pressed_at, p_client_sent_at);
  insert into public.safety_reviews (op_id, check_id, kind, result, message, occurred_at, actor_id, source, app_version)
  values (p_op_id, v_c.id, p_kind, case when p_kind = '관리자 확인' then p_result end, v_msg, v_t.o_at, v_uid,
    case when v_admin then '관리자' else '현장 직원' end, left(coalesce(p_app_version, '미상'), 80))
  returning * into v_r;
  perform set_config('pilot.via_function', 'on', true);
  update public.safety_checks set review_status = v_status, updated_at = now() where id = v_c.id;
  return jsonb_build_object('review_id', v_r.id, 'status', v_status, 'duplicated', false);
end $$;

-- ── 안전점검 사진 등록 ─────────────────────────────────────────────────────

create function public.attach_safety_photo(
  p_op_id uuid,
  p_check_id uuid,
  p_object_path text,
  p_mime text,
  p_size int,
  p_sha256 text,
  p_caption text,
  p_exif_removed boolean,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.safety_checks;
  v_p public.case_photos;
  v_days int;
begin
  perform pilot_private.serialize_writes();
  select * into v_p from public.case_photos where op_id = p_op_id;
  if found then
    return jsonb_build_object('photo_id', v_p.id, 'duplicated', true);
  end if;
  select * into v_c from public.safety_checks where id = p_check_id;
  if not found then
    raise exception '[입력] 안전점검을 찾을 수 없습니다.';
  end if;
  if not public.pilot_is_admin() and not (public.pilot_is_field() and v_c.worker_id = v_uid) then
    raise exception '[권한] 본인 점검에만 사진을 올릴 수 있습니다.';
  end if;
  if p_object_path is null or p_object_path not like v_uid::text || '/safety-' || v_c.id::text || '/%' then
    raise exception '[입력] 사진 위치가 이 점검·본인 폴더가 아닙니다.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'field-photos' and o.name = p_object_path and o.owner_id = v_uid::text) then
    raise exception '[입력] 올린 사진 파일을 찾을 수 없습니다 (업로드가 끝나지 않았습니다).';
  end if;
  select coalesce(nullif(s.value, '')::int, 365) into v_days from pilot_private.settings s where s.key = 'photo_retention_days';
  perform set_config('pilot.via_function', 'on', true);
  insert into public.case_photos (op_id, safety_check_id, owner_id, object_path, mime, size_bytes, sha256, caption, exif_removed, retain_until, app_version)
  values (p_op_id, v_c.id, v_uid, p_object_path, p_mime, p_size, lower(p_sha256), nullif(btrim(coalesce(p_caption, '')), ''), coalesce(p_exif_removed, false),
    v_c.work_date + coalesce(v_days, 365), left(coalesce(p_app_version, '미상'), 80))
  returning * into v_p;
  return jsonb_build_object('photo_id', v_p.id, 'recorded_at', v_p.recorded_at, 'duplicated', false);
end $$;

revoke execute on all functions in schema pilot_private from public, anon, authenticated;
revoke execute on function
  public.submit_safety_check(uuid, uuid, text, jsonb, text, text, time, text, timestamptz, timestamptz, text),
  public.safety_review(uuid, uuid, text, text, text, timestamptz, timestamptz, text),
  public.attach_safety_photo(uuid, uuid, text, text, int, text, text, boolean, text)
  from public, anon;
grant execute on function
  public.submit_safety_check(uuid, uuid, text, jsonb, text, text, time, text, timestamptz, timestamptz, text),
  public.safety_review(uuid, uuid, text, text, text, timestamptz, timestamptz, text),
  public.attach_safety_photo(uuid, uuid, text, text, int, text, text, boolean, text)
  to authenticated;
-- └── 20261113020000_safety_checks.sql 끝

-- ┌── 20261113030000_measures.sql ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
-- 현장 실사용 3차 — 성과 측정 기록: 수기 vs AX 판단 시험 · 현장기사·관리자 의견 · 오류·개선 이력
--
--  - 측정하지 않은 개선율·절감효과는 만들지 않는다. 값이 없으면 비워 두고, 기억에 의한 값은 '기억 추정'으로 따로 둔다.
--  - 실제 업무 · 현장정보 재현 · 가상 시나리오를 기록마다 구분한다.
--  - 기록마다 참가자 · 입력자 · 실제 시각 · 서버 기록시각 · 자료 출처 · 프로그램 버전을 남긴다.
--  - 의견·오류·개선 이력은 추가만 한다. '개선 반영'은 원래 의견을 가리키고 반영 날짜·버전을 남긴다.
-- ════════════════════════════════════════════════════════════════════════

create table public.pilot_trials (
  id uuid primary key default gen_random_uuid(),
  trial_no bigint generated always as identity unique,
  op_id uuid not null unique,
  evidence_class text not null check (evidence_class in ('실제 업무', '현장정보 재현', '가상 시나리오')),
  method text not null check (method in ('수기', 'AX')),
  scenario text not null check (char_length(scenario) between 1 and 100),
  pair_key text check (char_length(pair_key) <= 60),
  case_id uuid references public.field_cases (id),
  participant_id uuid not null references public.profiles (id),
  find_sec numeric(8, 1) check (find_sec >= 0),
  rejudge_sec numeric(8, 1) check (rejudge_sec >= 0),
  correct int check (correct >= 0),
  expected int check (expected >= 0),
  missed int check (missed >= 0),
  wrong int check (wrong >= 0),
  value_basis text not null check (value_basis in ('시험 실측', '과거 기록', '기억 추정')),
  measure_method text not null check (measure_method in ('앱 측정기', '스톱워치', '기록지', '화면 녹화', '원자료')),
  started_at timestamptz,
  ended_at timestamptz,
  raw_ref text check (char_length(raw_ref) <= 200),
  note text check (char_length(note) <= 500),
  recorded_at timestamptz not null default now(),
  actor_id uuid not null references public.profiles (id),
  app_version text not null check (char_length(app_version) <= 80),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text check (char_length(void_reason) <= 200)
);
comment on table public.pilot_trials is '수기 vs AX 판단 시험 — 같은 시나리오(대응 묶음)의 위험 파악 시간·정확도. 기억 추정 값은 비교 통계에서 뺀다';

create table public.pilot_notes (
  id uuid primary key default gen_random_uuid(),
  note_no bigint generated always as identity unique,
  op_id uuid not null unique,
  kind text not null check (kind in ('현장기사 의견', '관리자 의견', '오류', '개선 요청', '개선 반영')),
  text text not null check (char_length(text) between 1 and 1000),
  speaker_id uuid references public.profiles (id),
  speaker_name text check (char_length(speaker_name) <= 40),
  confirmation text not null check (confirmation in ('본인이 직접 입력', '입력자 기록 (본인 미확인)', '본인이 확인함')),
  case_id uuid references public.field_cases (id),
  ref_note_id uuid references public.pilot_notes (id),
  dev_date date,
  dev_version text check (char_length(dev_version) <= 80),
  recorded_at timestamptz not null default now(),
  actor_id uuid not null references public.profiles (id),
  source text not null check (source in ('현장 직원', '관리자')),
  app_version text not null check (char_length(app_version) <= 80),
  check (kind <> '개선 반영' or (ref_note_id is not null and dev_date is not null and dev_version is not null))
);
comment on table public.pilot_notes is '의견·오류·개선 이력 (추가만) — 개선 반영은 원래 기록(ref_note_id)과 바뀐 날짜·프로그램 버전을 남긴다';

revoke all on table public.pilot_trials, public.pilot_notes from public, anon, authenticated;
grant select on table public.pilot_trials, public.pilot_notes to authenticated;
alter table public.pilot_trials enable row level security;
alter table public.pilot_notes enable row level security;
create policy "관리자만" on public.pilot_trials for select to authenticated using ((select public.pilot_is_admin()));
create policy "관리자 전체 · 현장 직원은 본인이 남긴 것" on public.pilot_notes for select to authenticated
  using ((select public.pilot_is_admin()) or (actor_id = (select auth.uid()) and (select public.pilot_is_field())));

create trigger append_only before update or delete on public.pilot_notes
  for each row execute function pilot_private.append_only();
create trigger via_function_only before insert or update or delete on public.pilot_trials
  for each row execute function pilot_private.via_function_only();
create trigger stamp_recorded_at before insert on public.pilot_trials
  for each row execute function pilot_private.stamp_recorded_at();
create trigger stamp_recorded_at before insert on public.pilot_notes
  for each row execute function pilot_private.stamp_recorded_at();

create function public.add_trial(
  p_op_id uuid,
  p_evidence_class text,
  p_method text,
  p_scenario text,
  p_pair_key text,
  p_case_id uuid,
  p_participant_id uuid,
  p_find_sec numeric,
  p_rejudge_sec numeric,
  p_correct int,
  p_expected int,
  p_missed int,
  p_wrong int,
  p_value_basis text,
  p_measure_method text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_raw_ref text,
  p_note text,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v public.pilot_trials;
begin
  perform pilot_private.serialize_writes();
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 측정을 기록할 수 있습니다.';
  end if;
  select * into v from public.pilot_trials where op_id = p_op_id;
  if found then
    return jsonb_build_object('trial_id', v.id, 'trial_no', v.trial_no, 'duplicated', true);
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_participant_id and p.active) then
    raise exception '[입력] 참가자를 고르세요.';
  end if;
  if p_correct is not null and p_expected is not null and p_correct > p_expected then
    raise exception '[입력] 정확히 찾은 위험 수가 정답 위험 수보다 많을 수 없습니다.';
  end if;
  if p_ended_at is not null and p_started_at is not null and p_ended_at < p_started_at then
    raise exception '[입력] 측정 끝이 시작보다 빠를 수 없습니다.';
  end if;
  perform set_config('pilot.via_function', 'on', true);
  insert into public.pilot_trials (op_id, evidence_class, method, scenario, pair_key, case_id, participant_id, find_sec, rejudge_sec, correct, expected, missed, wrong,
    value_basis, measure_method, started_at, ended_at, raw_ref, note, actor_id, app_version)
  values (p_op_id, p_evidence_class, p_method, btrim(p_scenario), nullif(btrim(coalesce(p_pair_key, '')), ''), p_case_id, p_participant_id, p_find_sec, p_rejudge_sec,
    p_correct, p_expected, p_missed, p_wrong, p_value_basis, p_measure_method, p_started_at, p_ended_at, nullif(btrim(coalesce(p_raw_ref, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), left(coalesce(p_app_version, '미상'), 80))
  returning * into v;
  return jsonb_build_object('trial_id', v.id, 'trial_no', v.trial_no, 'duplicated', false);
end $$;

create function public.void_trial(p_trial_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform pilot_private.serialize_writes();
  if not public.pilot_is_admin() then
    raise exception '[권한] 관리자(2단계 인증 완료)만 무효 처리할 수 있습니다.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception '[입력] 무효 사유를 넣어 주세요.';
  end if;
  perform set_config('pilot.via_function', 'on', true);
  update public.pilot_trials set voided_at = now(), voided_by = auth.uid(), void_reason = left(btrim(p_reason), 200)
  where id = p_trial_id and voided_at is null;
end $$;

create function public.add_note(
  p_op_id uuid,
  p_kind text,
  p_text text,
  p_speaker_id uuid,
  p_speaker_name text,
  p_confirmation text,
  p_case_id uuid,
  p_ref_note_id uuid,
  p_dev_date date,
  p_dev_version text,
  p_app_version text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.pilot_notes;
  v_admin boolean := public.pilot_is_admin();
  v_field boolean := public.pilot_is_field();
begin
  perform pilot_private.serialize_writes();
  if not (v_admin or v_field) then
    raise exception '[권한] 활성화된 실증 계정만 기록할 수 있습니다.';
  end if;
  select * into v from public.pilot_notes where op_id = p_op_id;
  if found then
    return jsonb_build_object('note_id', v.id, 'note_no', v.note_no, 'duplicated', true);
  end if;
  if not v_admin then
    if p_kind not in ('현장기사 의견', '오류') then
      raise exception '[권한] 현장 직원은 의견·오류만 남길 수 있습니다.';
    end if;
    if p_case_id is not null and not exists (select 1 from public.field_cases c where c.id = p_case_id and c.worker_id = auth.uid()) then
      raise exception '[권한] 본인 사건에만 의견을 연결할 수 있습니다.';
    end if;
  end if;
  if p_kind = '개선 반영' and (p_ref_note_id is null or p_dev_date is null or nullif(btrim(coalesce(p_dev_version, '')), '') is null) then
    raise exception '[입력] 개선 반영은 원래 기록 · 바뀐 날짜 · 프로그램 버전이 필요합니다.';
  end if;
  insert into public.pilot_notes (op_id, kind, text, speaker_id, speaker_name, confirmation, case_id, ref_note_id, dev_date, dev_version, actor_id, source, app_version)
  values (p_op_id, p_kind, btrim(p_text), case when v_admin then p_speaker_id else auth.uid() end, nullif(btrim(coalesce(p_speaker_name, '')), ''),
    case when v_admin then p_confirmation else '본인이 직접 입력' end, p_case_id, p_ref_note_id, p_dev_date, nullif(btrim(coalesce(p_dev_version, '')), ''),
    auth.uid(), case when v_admin then '관리자' else '현장 직원' end, left(coalesce(p_app_version, '미상'), 80))
  returning * into v;
  return jsonb_build_object('note_id', v.id, 'note_no', v.note_no, 'duplicated', false);
end $$;

revoke execute on all functions in schema pilot_private from public, anon, authenticated;
revoke execute on function
  public.add_trial(uuid, text, text, text, text, uuid, uuid, numeric, numeric, int, int, int, int, text, text, timestamptz, timestamptz, text, text, text),
  public.void_trial(uuid, text),
  public.add_note(uuid, text, text, uuid, text, text, uuid, uuid, date, text, text)
  from public, anon;
grant execute on function
  public.add_trial(uuid, text, text, text, text, uuid, uuid, numeric, numeric, int, int, int, int, text, text, timestamptz, timestamptz, text, text, text),
  public.void_trial(uuid, text),
  public.add_note(uuid, text, text, uuid, text, text, uuid, uuid, date, text, text)
  to authenticated;
-- └── 20261113030000_measures.sql 끝

-- ┌── 20261115010000_evidence_class_rules.sql ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
-- 0.3.1 — 자료 구분 규칙: '현장정보 재현'은 실제 과거 현장의 원자료가 있을 때만
--
--  - 실제 업무 / 실제 과거 현장정보 재현 / 가상 시나리오를 섞지 않는다.
--  - '현장정보 재현'(화면 표시: 실제 과거 현장정보 재현)은 원자료(업무일지·통화기록·메신저·일정표 등)의
--    이름이 있어야 새로 저장된다. 원자료가 없는 시험은 '가상 시나리오'로 저장한다.
--  - 이미 저장된 기록은 고치지 않는다 (추가만 · 서명 기록 보존). 원자료 없이 '현장정보 재현'으로 저장됐던
--    기존 시험 기록은 화면·내보내기에서 '분류 확인 필요'로 표시하고 재현 집계에서 뺀다 (프로그램 쪽 처리).
--  - 엔진·판단 기록 구조는 바꾸지 않는다.
-- ════════════════════════════════════════════════════════════════════════

alter table public.field_cases add column source_ref text check (char_length(source_ref) <= 200);
comment on column public.field_cases.source_ref is '원자료 이름·위치 (예: 2026-10-02 업무일지 A현장) — 실제 과거 현장정보 재현의 근거. 원자료 본문은 회사가 보관';

-- 새로 저장되는 기록만 검사한다 (기존 기록을 다시 검사하지 않도록 INSERT 에만 건다)
create function pilot_private.require_reproduction_source() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'field_cases' then
    if new.source_ref is null then
      new.source_ref := nullif(btrim(coalesce(current_setting('pilot.source_ref', true), '')), '');
    end if;
    if new.evidence_class = '현장정보 재현' and (new.source_ref is null or new.info_source = '시험 시나리오') then
      raise exception '[입력] 실제 과거 현장정보 재현은 원자료(업무일지·통화기록·메신저·일정표 등)의 이름이 있어야 합니다. 원자료가 없는 시험은 가상 시나리오로 고르세요.';
    end if;
  elsif tg_table_name = 'pilot_trials' then
    if new.evidence_class = '현장정보 재현' and nullif(btrim(coalesce(new.raw_ref, '')), '') is null then
      raise exception '[입력] 현장정보 재현 측정은 원자료(과거 기록) 이름이 있어야 합니다. 원자료가 없는 시험은 가상 시나리오로 고르세요.';
    end if;
  end if;
  return new;
end $$;

create trigger require_reproduction_source before insert on public.field_cases
  for each row execute function pilot_private.require_reproduction_source();
create trigger require_reproduction_source before insert on public.pilot_trials
  for each row execute function pilot_private.require_reproduction_source();

-- 원자료 이름을 함께 받는 보고 — 같은 트랜잭션 안에서 기존 report_case 를 그대로 부른다 (기존 검사·기록 절차 유지)
create function public.report_case_with_source(
  p_source_ref text,
  p_op_id uuid,
  p_schedule_id uuid,
  p_issue_type text,
  p_type_note text,
  p_progress text,
  p_needs text[],
  p_request text,
  p_urgency text,
  p_discovered_basis text,
  p_discovered_time time,
  p_report_mode text,
  p_report_time time,
  p_report_basis text,
  p_expected_end time,
  p_info_source text,
  p_evidence_class text,
  p_client_pressed_at timestamptz,
  p_client_sent_at timestamptz,
  p_app_version text
) returns jsonb
language plpgsql set search_path = ''
as $$
begin
  if char_length(coalesce(p_source_ref, '')) > 200 then
    raise exception '[입력] 원자료 이름은 200자까지입니다.';
  end if;
  perform set_config('pilot.source_ref', coalesce(btrim(p_source_ref), ''), true);
  return public.report_case(p_op_id, p_schedule_id, p_issue_type, p_type_note, p_progress, p_needs, p_request, p_urgency, p_discovered_basis,
    p_discovered_time, p_report_mode, p_report_time, p_report_basis, p_expected_end, p_info_source, p_evidence_class, p_client_pressed_at,
    p_client_sent_at, p_app_version);
end $$;

revoke execute on all functions in schema pilot_private from public, anon, authenticated;
revoke execute on function public.report_case_with_source(text, uuid, uuid, text, text, text, text[], text, text, text, time, text, time, text, time, text, text, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.report_case_with_source(text, uuid, uuid, text, text, text, text[], text, text, text, time, text, time, text, time, text, text, timestamptz, timestamptz, text)
  to authenticated;
-- └── 20261115010000_evidence_class_rules.sql 끝

-- 적용 표시 — 04_verify_setup.sql 이 어떤 묶음이 적용됐는지 보여 준다
insert into pilot_private.settings (key, value) values ('schema_bundle', '0.4.2 · 마이그레이션 6개 · 마지막 20261115010000_evidence_class_rules.sql')
on conflict (key) do update set value = excluded.value;

commit;
