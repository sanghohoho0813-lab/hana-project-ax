import { requireAdmin } from "@/lib/pilot/session";
import { loadDay, loadStaff, parseDay, pendingJobs } from "@/lib/pilot/board";
import { judgeAt, progressOf, travelBasisStale } from "@/lib/pilot/core";
import { kst, kstLabel } from "@/lib/pilot/time";
import { AdminNav, DayBar, KindBanner } from "./AdminNav";
import { ScheduleBoard, type BoardRow } from "./ScheduleBoard";
import { JudgmentNow } from "../_ui/JudgmentNow";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ date?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const { date, kind } = parseDay(await searchParams);
  const [day, staff, pending] = await Promise.all([loadDay(s.sb, date, kind), loadStaff(s.sb), pendingJobs(s.sb)]);
  const now = new Date();
  const result = judgeAt(day.schedules, day.events, now.toISOString());

  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));
  const titles = Object.fromEntries(day.schedules.map((x) => [x.id, x.site_name]));
  const rows: BoardRow[] = day.schedules
    .slice()
    .sort((a, b) => (a.planned_start < b.planned_start ? -1 : a.planned_start > b.planned_start ? 1 : 0))
    .map((x) => ({
      s: x,
      phase: progressOf(x, day.events).phase,
      travelFromTitle: x.travel_from_id ? (titles[x.travel_from_id] ?? null) : null,
      stale: travelBasisStale(x, day.schedules),
      events: day.events.filter((e) => e.schedule_id === x.id).length,
    }));
  const fieldStaff = staff.filter((p) => p.role === "field" && p.active).map((p) => ({ id: p.id, name: p.display_name }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">관리자 일정판 · {s.profile?.display_name}</h1>
        <AdminNav current="board" />
      </div>
      <DayBar path="/pilot/admin" date={date} kind={kind} today={kst(now).date} />
      <KindBanner kind={kind} />
      <ScheduleBoard date={date} kind={kind} staff={fieldStaff} names={names} rows={rows} pending={pending} />
      <JudgmentNow result={result} names={names} titles={titles} asOfLabel={kstLabel(now)} deviationsOpen={day.events.length > 0} />
    </div>
  );
}
