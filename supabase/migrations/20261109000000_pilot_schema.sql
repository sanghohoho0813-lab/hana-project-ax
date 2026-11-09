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
