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
