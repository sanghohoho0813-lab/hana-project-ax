import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, HardHat, Route } from "lucide-react";
import { requireAdmin } from "@/lib/pilot/session";
import { kindParam, loadStaff, parseDay } from "@/lib/pilot/board";
import { progressOf } from "@/lib/pilot/core";
import { loadRankedInbox } from "@/lib/pilot/case-rank";
import { loadSafetyInbox } from "@/lib/pilot/case-data";
import { NEXT_ADMIN_ACTION, type CaseStatus } from "@/lib/pilot/cases";
import { STAGE_LABEL } from "@/lib/pilot/safety";
import { gradeRank, RISK_RULE_VERSION } from "@/lib/risk-engine";
import { kst, kstLabel } from "@/lib/pilot/time";
import { DayBar, KindBanner } from "./AdminNav";
import { AutoRefresh } from "../_ui/AutoRefresh";
import { cx, Empty, PageHead, Pill, SectionHead, Stat, type PillTone } from "../_ui/ds";

const STATUS_TONE: Record<CaseStatus, PillTone> = { 보고됨: "danger", 접수됨: "warning", "조치 중": "info", "현장 해결 보고": "info", 미해결: "danger", 해결: "success", 무효: "neutral" };
const GRADE_TONE = (g: string | null): PillTone => (g === "매우 높음" || g === "높음" ? "danger" : g === "중간" ? "warning" : "neutral");

/**
 * 관리자 대시보드 — 오늘 운영 현황 한 화면.
 * 숫자는 모두 DB 기록과 기존 엔진 계산(지금 시각 기준)에서 바로 센 값이다. 개선율 · 절감 시간 같은 추정치는 보여 주지 않는다.
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
  const phases = active.map((x) => progressOf(x, today.events).phase);
  const working = phases.filter((p) => p === "작업 중").length;
  const finished = phases.filter((p) => p === "작업 종료").length;

  // 위험 — 오늘 일정 전체에 대한 지금 시각 기준 엔진 판단
  const risk = results.get(date)!.risk;
  const riskyLinks = risk.links.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2).sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || b.shortfall - a.shortfall);
  const highSites = new Set(riskyLinks.filter((l) => gradeRank(l.grade) >= 3).map((l) => l.next.id));
  const held = risk.links.filter((l) => l.status === "판단 보류").length;

  // 안전점검 — 확인할 점검 + 오늘 시작 전 점검을 아직 안 보낸 현장
  const pendingReview = safety.checks.filter((c) => c.review_status === "확인 대기" || c.review_status === "보완 제출");
  const supplement = safety.checks.filter((c) => c.review_status === "보완 요청");
  const noPreCheck = active.filter((x) => !safety.checks.some((c) => c.schedule_id === x.id && c.stage === "작업 전"));

  // 문제·지원
  const fresh = ranked.filter((r) => r.c.status === "보고됨");
  const recent = closed
    .slice()
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 5);
  const resolved = closed.filter((c) => c.status === "해결").length;
  const hm = (iso: string | null) => (iso ? kst(iso).time : "모름");

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="관리자 대시보드"
        title={`오늘 운영 현황 · ${s.profile?.display_name ?? ""}`}
        sub={`${kstLabel(now)} 기준 · 숫자는 DB 기록과 기존 엔진 계산에서 바로 센 값입니다`}
        right={<AutoRefresh seconds={15} label="자동 갱신" />}
      />
      <DayBar path="/pilot/admin" date={date} kind={kind} today={kst(now).date} />
      <KindBanner kind={kind} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="오늘 핵심 숫자">
        <Stat label="운영 중인 현장" value={active.length} unit="곳" tone="info" hint={`작업 중 ${working} · 종료 ${finished}`} href={`/pilot/admin/schedule?${q}`} />
        <Stat label="신규 문제 보고" value={fresh.length} unit="건" tone={fresh.length ? "danger" : "neutral"} hint="본사 접수 전" href={`/pilot/admin/cases?${q}`} />
        <Stat label="조치 대기 요청" value={ranked.length} unit="건" tone={ranked.length ? "warning" : "neutral"} hint="처리 끝나지 않은 요청 전체" href={`/pilot/admin/cases?${q}`} />
        <Stat label="위험도 높은 현장" value={highSites.size} unit="곳" tone={highSites.size ? "danger" : "neutral"} hint={`위험 연결 ${riskyLinks.length} · 보류 ${held}`} href={`/pilot/admin/schedule?${q}`} />
        <Stat
          label="안전점검 미완료"
          value={pendingReview.length + supplement.length + noPreCheck.length}
          unit="건"
          tone={supplement.length || pendingReview.some((c) => c.deficient.length) ? "danger" : pendingReview.length + noPreCheck.length ? "warning" : "neutral"}
          hint={`확인 대기 ${pendingReview.length} · 보완 중 ${supplement.length} · 미제출 ${noPreCheck.length}`}
          href={`/pilot/admin/safety?${q}`}
        />
        <Stat label="최근 처리 결과" value={closed.length} unit="건" tone="success" hint={`해결 ${resolved} · 그 밖 ${closed.length - resolved}`} href={`/pilot/admin/cases?${q}#closed`} />
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
            <Empty icon={<CheckCircle2 size={22} />} title="처리할 요청이 없습니다." desc="현장에서 문제를 보고하면 위험도 순서로 여기에 나타납니다." />
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
          <section aria-label="위험도 높은 현장" className="space-y-3">
            <SectionHead title="연쇄 위험 현장" count={riskyLinks.length} />
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
            <p className="text-[13.5px] text-ink-3">규칙 기반 계산 (AI 예측 아님) · {RISK_RULE_VERSION}</p>
          </section>

          <section aria-label="안전점검 대기" className="space-y-3">
            <SectionHead
              title="안전점검"
              count={pendingReview.length + supplement.length}
              right={
                <Link href={`/pilot/admin/safety?${q}`} className="inline-flex items-center gap-1 text-[14.5px] font-bold text-primary">
                  확인하기 <ChevronRight size={16} />
                </Link>
              }
            />
            {pendingReview.length + supplement.length + noPreCheck.length === 0 ? (
              <p className="card px-4 py-4 text-[14.5px] text-ink-3">확인할 점검이 없습니다.</p>
            ) : (
              <ul className="card divide-y divide-line px-4">
                {[...pendingReview, ...supplement].slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <HardHat size={18} className={cx("shrink-0", c.deficient.length ? "text-danger" : "text-ink-3")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">
                        {titleOf.get(c.schedule_id) ?? "현장"} · {STAGE_LABEL[c.stage]}
                      </span>
                      <span className="block text-[13.5px] text-ink-3">
                        {names[c.worker_id] ?? "직원"} · {kst(c.recorded_at).time} 제출{c.deficient.length > 0 && " · 미흡 있음"}
                      </span>
                    </span>
                    <Pill tone={c.review_status === "보완 요청" ? "danger" : "warning"}>{c.review_status}</Pill>
                  </li>
                ))}
                {noPreCheck.length > 0 && (
                  <li className="py-3 text-[14.5px] text-ink-2">
                    시작 전 점검 미제출 {noPreCheck.length}곳 — {noPreCheck.slice(0, 3).map((x) => x.site_name).join(", ")}
                    {noPreCheck.length > 3 && " 외"}
                  </li>
                )}
              </ul>
            )}
          </section>

          <section aria-label="최근 처리 결과" className="space-y-3">
            <SectionHead title="최근 처리 결과" count={closed.length} />
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
