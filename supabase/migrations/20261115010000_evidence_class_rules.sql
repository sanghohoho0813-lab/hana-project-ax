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
