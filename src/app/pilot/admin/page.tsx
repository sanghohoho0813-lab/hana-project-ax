import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Clock, HardHat, PhoneCall, Route } from "lucide-react";
import { requireAdmin } from "@/lib/pilot/session";
import { kindParam, loadStaff, parseDay } from "@/lib/pilot/board";
import { judgeAt, progressOf, type EventRow } from "@/lib/pilot/core";
import { loadRankedInbox } from "@/lib/pilot/case-rank";
import { loadSafetyInbox } from "@/lib/pilot/case-data";
import { impactOf, isOpen, NEXT_ADMIN_ACTION, type CaseStatus } from "@/lib/pilot/cases";
import { itemLabel, STAGE_LABEL } from "@/lib/pilot/safety";
import { safetyGaps, safetyTiming, watchInputOf, watchOf, WATCH_RULE_VERSION } from "@/lib/pilot/watch";
import { gradeRank, RISK_RULE_VERSION } from "@/lib/risk-engine";
import { hhmm, kst, kstLabel } from "@/lib/pilot/time";
import { DayBar, KindBanner } from "./AdminNav";
import { AutoRefresh } from "../_ui/AutoRefresh";
import { cx, Empty, PageHead, Pill, SectionHead, Stat, type PillTone } from "../_ui/ds";

const STATUS_TONE: Record<CaseStatus, PillTone> = { 보고됨: "danger", 접수됨: "warning", "조치 중": "info", "현장 해결 보고": "info", 미해결: "danger", 해결: "success", 무효: "neutral" };
const GRADE_TONE = (g: string | null): PillTone => (g === "매우 높음" || g === "높음" ? "danger" : g === "중간" ? "warning" : "neutral");

/** rank 0: 미흡 · 안전 위험 보고 · 보완 중 (항상 맨 위) · 1: 점검 없이 시작/종료 · 2: 그 밖 — 같은 rank 안에서는 최근 것부터 */
type SafetyItem = { key: string; tone: "danger" | "warning"; rank: 0 | 1 | 2; at: string; site: string; worker: string; what: string; pill: string };

/**
 * 관리자 대시보드 — 오늘 운영 현황 한 화면.
 * 0.6.0 순서 (2026-11-16 사용자 지시 · 11-13 현장 책임자 통화):
 *   1순위 안전 확인 필요 (미흡 · 안전 위험 보고 · 보완 요청 · 점검 없이 시작/종료 · 단계 누락)
 *   공동 1순위 연락 없이 늦어지는 현장 (조기 확인 규칙) → 우선 처리할 사건
 *   2순위 다음 현장 지연 위험 (연쇄위험 판단엔진)
 * 숫자는 모두 DB 기록과 규칙 · 엔진 계산(지금 시각 기준)에서 바로 센 값이다. 개선율 · 절감 시간 같은 추정치는 보여 주지 않는다.
 */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ date?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const { date, kind } = parseDay(await searchParams);
  const now = new Date();
  const [{ inbox, today, results, ranked, closed, titleOf }, staff, safety] = await Promise.all([loadRankedInbox(s.sb, date, kind, now), loadStaff(s.sb), loadSafetyInbox(s.sb, date, kind)]);
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));
  const q = `date=${date}&kind=${kindParam(kind)}`;

  // 오늘 현장
  const active = today.schedules.filter((x) => x.status === "예정");
  const isToday = date === kst(now).date;
  const nowHM = kst(now).time;
  const openSites = new Set(inbox.cases.filter(isOpen).map((c) => c.schedule_id));
  const sites = active.map((x) => {
    const p = progressOf(x, today.events);
    // 조기 확인은 오늘 날짜에서만 계산한다 (지난 날짜는 '지금 시각'과 비교할 수 없음)
    const w = isToday ? watchOf(watchInputOf(x, p, openSites.has(x.id)), nowHM) : null;
    const mine = safety.checks.filter((c) => c.schedule_id === x.id);
    const gaps = safetyGaps({ started: !!p.started, ended: !!p.ended, midDue: !!w?.checkAt && nowHM >= w.checkAt }, mine.map((c) => c.stage)).filter((g) => g.state === "누락");
    const timing = safetyTiming({ startedAt: p.started?.occurred_at ?? null, endedAt: p.ended?.occurred_at ?? null }, mine);
    return { x, p, w, gaps, timing };
  });
  const working = sites.filter((v) => v.p.phase === "작업 중").length;
  const finished = sites.filter((v) => v.p.phase === "작업 종료").length;
  const who = (id: string) => names[id] ?? "직원";

  // ── 1순위: 안전 확인 필요 ──
  const pendingReview = safety.checks.filter((c) => c.review_status === "확인 대기" || c.review_status === "보완 제출");
  const supplement = safety.checks.filter((c) => c.review_status === "보완 요청");
  const site = (id: string) => titleOf.get(id) ?? "현장";
  const safetyItems: SafetyItem[] = [
    ...pendingReview.filter((c) => c.deficient.length > 0).map((c) => ({ key: `d-${c.id}`, tone: "danger" as const, rank: 0 as const, at: c.recorded_at, site: site(c.schedule_id), worker: who(c.worker_id), what: `${STAGE_LABEL[c.stage]} 미흡: ${c.deficient.map(itemLabel).join(", ")} — 작업 중지 여부를 전화로 확인`, pill: "미흡" })),
    ...ranked.filter((r) => r.c.issue_type === "안전 위험").map((r) => ({ key: `c-${r.c.id}`, tone: "danger" as const, rank: 0 as const, at: r.c.reported_at, site: site(r.c.schedule_id), worker: who(r.c.worker_id), what: `안전 위험 보고 ${r.c.case_no} · ${r.c.status}`, pill: "안전 위험" })),
    ...supplement.map((c) => ({ key: `s-${c.id}`, tone: "danger" as const, rank: 0 as const, at: c.updated_at, site: site(c.schedule_id), worker: who(c.worker_id), what: `${STAGE_LABEL[c.stage]} 보완 요청 — 보완 사진 대기`, pill: "보완 중" })),
    ...sites.filter((v) => v.timing.pre === "없음").map((v) => ({ key: `p-${v.x.id}`, tone: "danger" as const, rank: 1 as const, at: v.p.started!.occurred_at, site: v.x.site_name, worker: who(v.x.assignee_id), what: "시작 전 점검(착용 사진) 없이 작업 시작", pill: "점검 전 시작" })),
    ...sites.filter((v) => v.timing.final === "없음").map((v) => ({ key: `f-${v.x.id}`, tone: "danger" as const, rank: 1 as const, at: v.p.ended!.occurred_at, site: v.x.site_name, worker: who(v.x.assignee_id), what: "마무리 점검(착용 사진) 없이 작업 종료", pill: "마무리 점검 없음" })),
    ...sites.flatMap((v) => v.gaps.filter((g) => g.stage === "작업 중").map(() => ({ key: `m-${v.x.id}`, tone: "warning" as const, rank: 2 as const, at: v.p.ended?.occurred_at ?? "", site: v.x.site_name, worker: who(v.x.assignee_id), what: "진행 중 점검(착용 사진) 없이 작업 종료", pill: "단계 누락" }))),
    ...sites.filter((v) => v.timing.pre === "시작 뒤 제출").map((v) => ({ key: `pl-${v.x.id}`, tone: "warning" as const, rank: 2 as const, at: v.p.started!.occurred_at, site: v.x.site_name, worker: who(v.x.assignee_id), what: "시작 전 점검을 작업 시작 뒤에 제출", pill: "시작 뒤 제출" })),
    ...sites.filter((v) => v.timing.final === "종료 뒤 제출").map((v) => ({ key: `fl-${v.x.id}`, tone: "warning" as const, rank: 2 as const, at: v.p.ended!.occurred_at, site: v.x.site_name, worker: who(v.x.assignee_id), what: "마무리 점검을 작업 종료 뒤에 제출", pill: "종료 뒤 제출" })),
    ...pendingReview.filter((c) => c.deficient.length === 0).map((c) => ({ key: `r-${c.id}`, tone: "warning" as const, rank: 2 as const, at: c.recorded_at, site: site(c.schedule_id), worker: who(c.worker_id), what: `${STAGE_LABEL[c.stage]} 사진 확인 대기 · ${kst(c.recorded_at).time} 제출`, pill: c.review_status })),
  ];
  safetyItems.sort((a, b) => a.rank - b.rank || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const safetyDanger = safetyItems.filter((i) => i.tone === "danger").length;

  // ── 공동 1순위: 연락 없이 늦어지는 현장 (조기 확인 규칙) ──
  const over = sites.filter((v) => v.w?.level === "예정 넘김").sort((a, b) => b.w!.overBy - a.w!.overBy);
  const mid = sites.filter((v) => v.w?.level === "중간 확인").sort((a, b) => b.w!.elapsed - a.w!.elapsed);
  const watch = [...over, ...mid];
  // 예정을 넘긴 현장 → '지금 끝나도' 다음 현장 영향 — 기존 엔진에 가정 기록(지금 예상 종료 보고) 하나를 더해 계산한다 (DB에 저장하지 않음)
  const startOf = (id: string) => hhmm(today.schedules.find((y) => y.id === id)?.planned_start);
  const nextOf = new Map<string, { risky: number; text: string }>();
  for (const v of over) {
    const later = active.some((y) => y.assignee_id === v.x.assignee_id && y.planned_start > v.x.planned_start);
    if (!later) {
      nextOf.set(v.x.id, { risky: 0, text: "오늘 마지막 현장 — 다음 현장 영향 없음" });
      continue;
    }
    const synth: EventRow = {
      seq: Number.MAX_SAFE_INTEGER,
      id: `what-if-${v.x.id}`,
      schedule_id: v.x.id,
      data_kind: kind,
      work_date: date,
      kind: "예상 종료 보고",
      occurred_at: now.toISOString(),
      entered_time: null,
      expected_end: `${nowHM}:00`,
      entry_mode: "즉시 기록",
      recorded_at: now.toISOString(),
      source: "관리자",
      actor_id: "what-if",
      voids_event_id: null,
    };
    const im = impactOf(judgeAt(today.schedules, [...today.events, synth], now.toISOString()), v.x.id, v.x.assignee_id, startOf);
    nextOf.set(v.x.id, {
      risky: im.risky,
      text: im.risky > 0 ? `다음 현장 ${im.sites.join(", ")} — 지금 끝나도 도착 ${im.maxShortfall}분 부족 (계산값) · 고객 연락 검토` : "지금 끝나면 다음 현장 영향 없음 (계산값)",
    });
  }

  // ── 2순위: 다음 현장 지연 위험 — 오늘 일정 전체에 대한 지금 시각 기준 엔진 판단 ──
  const risk = results.get(date)!.risk;
  const riskyLinks = risk.links.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2).sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || b.shortfall - a.shortfall);
  const highSites = new Set(riskyLinks.filter((l) => gradeRank(l.grade) >= 3).map((l) => l.next.id));
  const held = risk.links.filter((l) => l.status === "판단 보류").length;

  // 문제·지원
  const fresh = ranked.filter((r) => r.c.status === "보고됨");
  const recent = closed
    .slice()
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 5);
  const resolved = closed.filter((c) => c.status === "해결").length;
  const hm = (iso: string | null) => (iso ? kst(iso).time : "모름");
  const hm2 = (t: string) => t.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="관리자 대시보드"
        title={`오늘 운영 현황 · ${s.profile?.display_name ?? ""}`}
        sub={`${kstLabel(now)} 기준 · 안전 → 연락 없이 늦어짐 · 지원 요청 → 다음 현장 지연 순서 · 숫자는 DB 기록과 규칙 · 엔진 계산에서 바로 센 값입니다`}
        right={<AutoRefresh seconds={15} label="자동 갱신" />}
      />
      <DayBar path="/pilot/admin" date={date} kind={kind} today={kst(now).date} />
      <KindBanner kind={kind} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="오늘 핵심 숫자">
        <Stat
          label="안전 확인 필요"
          value={safetyItems.length}
          unit="건"
          tone={safetyDanger ? "danger" : safetyItems.length ? "warning" : "neutral"}
          hint={`즉시 확인 ${safetyDanger} · 그 밖 ${safetyItems.length - safetyDanger}`}
          href="#safety"
        />
        <Stat
          label="연락 없이 늦어짐"
          value={isToday ? watch.length : "—"}
          unit={isToday ? "곳" : undefined}
          tone={over.length ? "danger" : mid.length ? "warning" : "neutral"}
          hint={isToday ? `예정 넘김 ${over.length} · 중간 확인 ${mid.length}` : "오늘 날짜에서만 계산"}
          href="#watch"
        />
        <Stat label="신규 문제 보고" value={fresh.length} unit="건" tone={fresh.length ? "danger" : "neutral"} hint="본사 확인 전" href={`/pilot/admin/cases?${q}`} />
        <Stat label="조치 대기 요청" value={ranked.length} unit="건" tone={ranked.length ? "warning" : "neutral"} hint="처리 끝나지 않은 요청 전체" href={`/pilot/admin/cases?${q}`} />
        <Stat label="다음 현장 지연 위험" value={highSites.size} unit="곳" tone={highSites.size ? "warning" : "neutral"} hint={`위험 연결 ${riskyLinks.length} · 보류 ${held}`} href="#next-site" />
        <Stat label="운영 중인 현장" value={active.length} unit="곳" tone="info" hint={`작업 중 ${working} · 종료 ${finished}`} href={`/pilot/admin/schedule?${q}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section id="safety" aria-label="안전 확인 필요" className="scroll-mt-20 space-y-3">
          <SectionHead
            title="안전 확인 필요 (1순위)"
            count={safetyItems.length}
            right={
              <Link href={`/pilot/admin/safety?${q}`} className="inline-flex items-center gap-1 text-[14.5px] font-bold text-primary">
                안전관리 <ChevronRight size={16} />
              </Link>
            }
          />
          {safetyItems.length === 0 ? (
            <p className="card px-4 py-4 text-[14.5px] text-ink-3">지금 확인할 안전 항목이 없습니다. 미흡 · 안전 위험 보고 · 보완 요청 · 점검 없이 시작하거나 마친 현장 · 빠진 단계가 생기면 여기에 먼저 나타납니다.</p>
          ) : (
            <ul className="space-y-2.5">
              {safetyItems.slice(0, 10).map((i) => (
                <li key={i.key} className={cx("card flex items-start gap-3 p-4", i.tone === "danger" ? "ring-1 ring-danger/30" : "ring-1 ring-warning/30")} aria-label={`안전 ${i.site}`}>
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", i.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning")}>
                    <HardHat size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-extrabold">{i.site}</span>
                      <span className="text-[15px] font-semibold text-ink-3">· {i.worker}</span>
                      <Pill tone={i.tone}>{i.pill}</Pill>
                    </span>
                    <span className="mt-1 block text-[15px] font-semibold text-ink-2">{i.what}</span>
                  </span>
                </li>
              ))}
              {safetyItems.length > 10 && <li className="px-1 text-[14.5px] text-ink-3">외 {safetyItems.length - 10}건 — 안전관리 화면에서 모두 봅니다.</li>}
            </ul>
          )}
          <p className="text-[13.5px] text-ink-3">사진만으로 적합 판정하지 않습니다 — 관리자가 눈으로 확인한 결과만 기록합니다. 위험하면 화면을 기다리지 말고 현장에 바로 전화해 작업을 멈추게 하세요.</p>
        </section>

        <section id="watch" aria-label="연락 없이 늦어지는 현장" className="scroll-mt-20 space-y-3">
          <SectionHead title="연락 없이 늦어지는 현장 (공동 1순위)" count={isToday ? watch.length : undefined} />
          {!isToday ? (
            <p className="card px-4 py-4 text-[14.5px] text-ink-3">오늘 날짜에서만 계산합니다 (지난 날짜는 지금 시각과 비교하지 않음).</p>
          ) : watch.length === 0 ? (
            <p className="card px-4 py-4 text-[14.5px] text-ink-3">지금은 연락 없이 늦어지는 현장이 없습니다. 작업 중 현장이 예상 종료를 넘기거나, 예정 시간의 절반이 지나도록 진행 보고가 없으면 여기에 나타납니다.</p>
          ) : (
            <ul className="space-y-2.5">
              {watch.map(({ x, w }) => (
                <li key={x.id} className={cx("card flex flex-wrap items-start gap-3 p-4", w!.level === "예정 넘김" ? "ring-1 ring-danger/30" : "ring-1 ring-warning/30")} aria-label={`확인 필요 ${x.site_name}`}>
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", w!.level === "예정 넘김" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning")}>
                    <Clock size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-extrabold">{x.site_name}</span>
                      <span className="text-[15px] font-semibold text-ink-3">· {names[x.assignee_id] ?? "직원"}</span>
                      <Pill tone={w!.level === "예정 넘김" ? "danger" : "warning"}>{w!.level === "예정 넘김" ? `예정 넘김 ${w!.overBy}분` : "중간 확인"}</Pill>
                    </span>
                    <span className="mt-1 block text-[15px] font-semibold text-ink-2">{w!.reason}</span>
                    <span className="block text-[14px] text-ink-3 tabular-nums">
                      예정 {hm2(x.planned_start)}–{hm2(x.planned_end)} · 지금 기준 예상 종료 {w!.expectedEnd}
                    </span>
                    {w!.level === "예정 넘김" && nextOf.has(x.id) && (
                      <span className={cx("mt-1 block text-[14.5px] font-semibold", nextOf.get(x.id)!.risky > 0 ? "text-danger" : "text-ink-2")}>{nextOf.get(x.id)!.text}</span>
                    )}
                  </span>
                  <Link href={`/pilot/admin/cases?${q}`} className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-primary-light px-3 text-[14.5px] font-bold text-primary-dark">
                    <PhoneCall size={16} /> 전화 확인 → 대리 보고
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[13.5px] text-ink-3">
            현장 직원이 혼자 붙잡고 있는 상황을 먼저 알아채기 위한 표시입니다. 전화로 확인한 문제는 &lsquo;문제·지원 → 대리 보고&rsquo;로 남기면 발견 · 보고 시각이 기록됩니다. &lsquo;지금 끝나도&rsquo; 계산은 기존 엔진에 가정 기록 하나를 더해 본 값이며 저장하지 않습니다. 규칙 기반 표시 (AI 예측 아님) · {WATCH_RULE_VERSION}
          </p>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section aria-label="우선 처리할 사건" className="space-y-3">
          <SectionHead
            title="우선 처리할 사건"
            count={ranked.length}
            right={
              <Link href={`/pilot/admin/cases?${q}`} className="inline-flex items-center gap-1 text-[14.5px] font-bold text-primary">
                전체 보기 <ChevronRight size={16} />
              </Link>
            }
          />
          {ranked.length === 0 ? (
            <Empty icon={<CheckCircle2 size={22} />} title="처리할 요청이 없습니다." desc="현장에서 문제를 보고하면 안전 · 긴급 → 본사 확인 전 → 지원 요청 순서로 여기에 나타납니다." />
          ) : (
            <ol className="space-y-3">
              {ranked.slice(0, 6).map((r, i) => {
                const c = r.c;
                const im = r.impact;
                return (
                  <li key={c.id}>
                    <Link href={`/pilot/admin/cases?${q}`} className="card card-hover block p-4" aria-label={`우선 ${i + 1} 사건 ${c.case_no}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[14px] font-extrabold text-white tabular-nums">{i + 1}</span>
                        <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
                        {c.urgency === "긴급" && <Pill tone="danger">긴급</Pill>}
                        {c.issue_type === "안전 위험" && <Pill tone="danger">안전</Pill>}
                        <span className="text-[14px] font-semibold text-ink-3 tabular-nums">{c.case_no}</span>
                        <span className="ml-auto">
                          {im && im.risky > 0 ? (
                            <Pill tone="danger">
                              후속 현장 {im.risky}곳 위험 · 최대 {im.maxShortfall}분
                            </Pill>
                          ) : im && im.held > 0 ? (
                            <Pill tone="warning">판단 보류 {im.held}</Pill>
                          ) : c.expected_end ? (
                            <Pill tone="success">후속 위험 없음</Pill>
                          ) : (
                            <Pill tone="neutral">예상 종료 미확인</Pill>
                          )}
                        </span>
                      </div>
                      <p className="mt-2.5 text-[17px] font-extrabold">
                        {titleOf.get(c.schedule_id) ?? "현장"} <span className="font-semibold text-ink-3">· {names[c.worker_id] ?? "직원"}</span>
                      </p>
                      <p className="text-[15px] font-semibold text-ink-2">{c.issue_type}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[14.5px] sm:grid-cols-4">
                        <div>
                          <dt className="text-ink-3">발견</dt>
                          <dd className="font-semibold tabular-nums">{hm(c.discovered_at)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-3">보고</dt>
                          <dd className="font-semibold tabular-nums">{hm(c.reported_at)}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-ink-3">요청 지원</dt>
                          <dd className="truncate font-semibold">{c.needs.length ? c.needs.join(", ") : "—"}</dd>
                        </div>
                      </dl>
                      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary-light px-3 py-2 text-[14.5px] font-bold text-primary-dark">
                        다음 조치 <ArrowRight size={15} /> {NEXT_ADMIN_ACTION[c.status]}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <div className="space-y-6">
          <section id="next-site" aria-label="다음 현장 지연 위험" className="scroll-mt-20 space-y-3">
            <SectionHead title="다음 현장 지연 위험 (2순위)" count={riskyLinks.length} />
            {riskyLinks.length === 0 ? (
              <p className="card px-4 py-4 text-[14.5px] text-ink-3">지금 시각 기준 중간 이상 위험 연결이 없습니다.</p>
            ) : (
              <ul className="card divide-y divide-line px-4">
                {riskyLinks.slice(0, 6).map((l) => (
                  <li key={l.key} className="flex items-center gap-3 py-3">
                    <Route size={18} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">
                        {l.prev.title} → {l.next.title}
                      </span>
                      <span className="block text-[13.5px] text-ink-3">
                        {names[l.workerId] ?? "직원"} · {l.shortfall > 0 ? `도착 ${l.shortfall}분 부족 (계산값)` : "여유 부족"}
                      </span>
                    </span>
                    <Pill tone={GRADE_TONE(l.grade)}>{l.grade}</Pill>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[13.5px] text-ink-3">연쇄위험 판단엔진 계산값 — 앞 현장이 늦어질 때 다음 현장 도착이 모자라는 연결. 규칙 기반 계산 (AI 예측 아님) · {RISK_RULE_VERSION}</p>
          </section>

          <section aria-label="최근 처리 결과" className="space-y-3">
            <SectionHead title="최근 처리 결과" count={closed.length} right={<span className="text-[14px] font-semibold text-ink-3">해결 {resolved} · 그 밖 {closed.length - resolved}</span>} />
            {recent.length === 0 ? (
              <p className="card px-4 py-4 text-[14.5px] text-ink-3">이 날짜에 끝난 사건이 없습니다.</p>
            ) : (
              <ul className="card divide-y divide-line px-4">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link href={`/pilot/admin/cases/${c.id}`} className="flex items-center gap-3 py-3">
                      {c.status === "해결" ? <CheckCircle2 size={18} className="shrink-0 text-success" /> : <AlertTriangle size={18} className="shrink-0 text-ink-3" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">
                          {titleOf.get(c.schedule_id) ?? "현장"} · {c.issue_type}
                        </span>
                        <span className="block text-[13.5px] text-ink-3 tabular-nums">
                          {c.case_no} · {kst(c.updated_at).time}
                        </span>
                      </span>
                      <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <p className="text-[13.5px] text-ink-3">
        사건 {inbox.cases.length}건 · 직원 {staff.filter((p) => p.role === "field" && p.active).length}명 기준. 처리 기록과 조치 전후 비교는 각 사건의 증빙 화면(성과·증빙)에서 확인합니다.
      </p>
    </div>
  );
}
