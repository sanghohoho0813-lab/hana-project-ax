import { requireAdmin } from "@/lib/pilot/session";
import { loadDay, loadStaff, parseDay } from "@/lib/pilot/board";
import { loadSafetyInbox } from "@/lib/pilot/case-data";
import { PENDING_REVIEW } from "@/lib/pilot/safety";
import { kst } from "@/lib/pilot/time";
import { AdminNav, DayBar, KindBanner } from "../AdminNav";
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
  // 오늘 일정 중 '작업 전' 점검이 없는 현장 (작업을 시작했거나 예정)
  const ended = new Set(day.events.filter((e) => e.kind === "작업종료").map((e) => e.schedule_id));
  const noPre = day.schedules.filter((x) => x.status === "예정" && !ended.has(x.id) && !inbox.checks.some((c) => c.schedule_id === x.id && c.stage === "작업 전"));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">안전점검 확인</h1>
        <AdminNav current="safety" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DayBar path="/pilot/admin/safety" date={date} kind={kind} today={kst(new Date()).date} />
        <AutoRefresh seconds={10} label="새 점검 확인" />
      </div>
      <KindBanner kind={kind} />
      <p className="rounded-2xl bg-white px-4 py-2.5 text-[16px] text-ink-2">
        사진만으로 안전장구 착용·기준 충족을 판정하지 않습니다 — 관리자가 사진과 체크 내용을 <b>눈으로 확인한 결과</b>만 기록합니다. 위험한 상황이면 화면 확인을 기다리지 말고 현장에 직접 전화해 작업을 멈추게 하세요.
      </p>
      {noPre.length > 0 && (
        <p className="rounded-2xl border border-warning/40 bg-warning-bg/60 px-4 py-2.5 text-[16px] font-semibold text-warning">
          &lsquo;작업 전&rsquo; 점검이 아직 없는 현장 {noPre.length}곳: {noPre.slice(0, 8).map((x) => `${x.site_name}(${names[x.assignee_id] ?? "?"})`).join(", ")}
          {noPre.length > 8 && ` 외 ${noPre.length - 8}곳`}
        </p>
      )}
      <SafetyBoard items={items} names={names} sites={sites} />
    </div>
  );
}
