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
