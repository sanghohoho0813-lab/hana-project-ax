import { requireAdmin } from "@/lib/pilot/session";
import { loadDay, loadStaff, parseDay } from "@/lib/pilot/board";
import { loadSafetyInbox } from "@/lib/pilot/case-data";
import { PENDING_REVIEW, SAFETY_STAGES, STAGE_LABEL, hasLivePhoto } from "@/lib/pilot/safety";
import { progressOf } from "@/lib/pilot/core";
import { safetyGaps, safetyTiming, watchInputOf, watchOf } from "@/lib/pilot/watch";
import { kst } from "@/lib/pilot/time";
import { DayBar, KindBanner } from "../AdminNav";
import { cx, PageHead, Pill, SectionHead } from "../../_ui/ds";
import { AutoRefresh } from "../../_ui/AutoRefresh";
import { SafetyBoard } from "./SafetyBoard";

/**
 * 관리자 — 안전점검 확인
 * 사진과 체크 내용을 눈으로 확인한 결과만 기록한다 (사진 인식·자동 판정 없음).
 * 확인 대기·보완 제출 점검은 날짜와 상관없이 계속 보인다.
 */
export default async function SafetyPage({ searchParams }: { searchParams: Promise<{ date?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const { date, kind } = parseDay(await searchParams);
  const [inbox, staff, day] = await Promise.all([loadSafetyInbox(s.sb, date, kind), loadStaff(s.sb), loadDay(s.sb, date, kind)]);
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));
  const sites = Object.fromEntries(day.schedules.map((x) => [x.id, x.site_name]));
  const missing = new Set(inbox.checks.map((c) => c.schedule_id));
  for (const id of missing) if (!sites[id]) sites[id] = "다른 날짜 현장";
  const items = inbox.checks
    .map((c) => ({ c, reviews: inbox.reviews.filter((r) => r.check_id === c.id), photos: inbox.photos.filter((p) => p.safety_check_id === c.id) }))
    .sort((a, b) => {
      const p = (x: typeof a) => (PENDING_REVIEW.includes(x.c.review_status) ? 0 : 1);
      return p(a) - p(b) || b.c.deficient.length - a.c.deficient.length || (a.c.recorded_at < b.c.recorded_at ? -1 : 1);
    });
  // 현장별 3단계(작업 전 · 작업 중 · 작업 종료) 현황 — 제출 · 확인 상태 · 빠진 단계 (0.5.0)
  const now = new Date();
  const isToday = date === kst(now).date;
  const rows = day.schedules
    .filter((x) => x.status === "예정")
    .map((x) => {
      const p = progressOf(x, day.events);
      const w = isToday ? watchOf(watchInputOf(x, p, false), kst(now).time) : null;
      const mine = inbox.checks.filter((c) => c.schedule_id === x.id);
      // 사진이 올라간 점검만 단계를 낸 것으로 센다
      const withPhoto = mine.filter((c) => hasLivePhoto(inbox.photos.filter((ph) => ph.safety_check_id === c.id)));
      const gaps = safetyGaps({ started: !!p.started, ended: !!p.ended, midDue: !!w?.checkAt && kst(now).time >= w.checkAt }, withPhoto.map((c) => c.stage));
      const timing = safetyTiming({ startedAt: p.started?.occurred_at ?? null, endedAt: p.ended?.occurred_at ?? null }, withPhoto);
      return { x, phase: p.phase, mine, gaps, timing };
    });
  const gapCount = rows.reduce((n, r) => n + r.gaps.filter((g) => g.state === "누락").length, 0);

  return (
    <div className="space-y-5">
      <PageHead eyebrow="안전관리 · 1순위" title="안전점검 확인" sub="시작 전 · 진행 중 · 마친 뒤 착용 사진을 눈으로 확인하고 결과를 보냅니다" right={<AutoRefresh seconds={10} label="새 점검 확인" />} />
      <DayBar path="/pilot/admin/safety" date={date} kind={kind} today={kst(new Date()).date} />
      <KindBanner kind={kind} />
      <p className="rounded-2xl bg-warning-bg px-4 py-3 text-[14.5px] text-ink-2">
        사진만으로 안전장구 착용·기준 충족을 판정하지 않습니다 — 관리자가 사진과 체크 내용을 <b>눈으로 확인한 결과</b>만 기록합니다. 위험한 상황이면 화면 확인을 기다리지 말고 현장에 직접 전화해 작업을 멈추게 하세요.
      </p>
      {rows.length > 0 && (
        <section className="space-y-2" aria-label="현장별 3단계 현황">
          <SectionHead title="현장별 3단계 현황 (작업 전 · 작업 중 · 마무리 착용 사진)" count={gapCount ? gapCount : undefined} />
          <div className="card overflow-x-auto px-4 py-2">
            <table className="w-full min-w-[40rem] text-[15px]">
              <thead className="text-[14px] text-ink-3">
                <tr>
                  <th className="py-2 pr-2 text-left font-semibold">현장 · 직원</th>
                  <th className="py-2 pr-2 text-left font-semibold">작업</th>
                  {SAFETY_STAGES.map((st) => (
                    <th key={st} className="py-2 pr-2 text-left font-semibold">
                      {STAGE_LABEL[st]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.x.id} className="border-t border-line">
                    <td className="py-2 pr-2 font-bold">
                      {r.x.site_name} <span className="font-semibold text-ink-3">· {names[r.x.assignee_id] ?? "?"}</span>
                    </td>
                    <td className="py-2 pr-2 text-ink-2">{r.phase}</td>
                    {SAFETY_STAGES.map((st) => {
                      const c = r.mine.filter((m) => m.stage === st).at(-1);
                      const noPhoto = !!c && !hasLivePhoto(inbox.photos.filter((ph) => ph.safety_check_id === c.id));
                      const g = r.gaps.find((x) => x.stage === st);
                      // 시점 표시 (0.6.0): 시작 전 점검 없이 시작 · 마무리 점검 없이 종료 · 늦게 제출
                      const late = (st === "작업 전" && r.timing.pre === "시작 뒤 제출") || (st === "작업 종료" && r.timing.final === "종료 뒤 제출");
                      const without = st === "작업 전" && r.timing.pre === "없음" ? "없이 시작" : st === "작업 종료" && r.timing.final === "없음" ? "없이 종료" : null;
                      return (
                        <td key={st} className="py-2 pr-2">
                          {c && noPhoto ? (
                            <Pill tone="danger">사진 없음</Pill>
                          ) : c ? (
                            <>
                              <Pill tone={c.review_status === "보완 요청" ? "danger" : c.review_status === "적합(육안 확인)" || c.review_status === "조치 완료" ? "success" : "warning"}>{c.review_status}</Pill>
                              {late && <span className="mt-0.5 block text-[13.5px] font-bold text-warning">{st === "작업 전" ? "시작 뒤 제출" : "종료 뒤 제출"}</span>}
                            </>
                          ) : g ? (
                            <span className={cx("text-[14.5px] font-bold", g.state === "누락" ? "text-danger" : "text-warning")}>{g.state === "누락" ? `누락${without ? ` · ${without}` : ""}` : "낼 차례"}</span>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13.5px] text-ink-3">누락: 작업을 시작했는데 시작 전 점검이 없거나(없이 시작), 작업을 마쳤는데 진행 중 · 마친 뒤 점검이 없음(없이 종료). 낼 차례: 지금 내야 할 단계. 시작 뒤 · 종료 뒤 제출: 작업 시각보다 늦게 낸 점검 (기록 시각 비교 · 위반 판정 아님).</p>
        </section>
      )}
      <SafetyBoard items={items} names={names} sites={sites} />
    </div>
  );
}
