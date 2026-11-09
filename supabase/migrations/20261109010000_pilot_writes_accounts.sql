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
