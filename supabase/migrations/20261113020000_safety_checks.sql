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
