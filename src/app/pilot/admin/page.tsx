import { requireAdmin } from "@/lib/pilot/session";
import { loadDay, loadStaff, parseDay, pendingJobs } from "@/lib/pilot/board";
import { cancelledBetween, judgeAt, progressOf, travelBasisStale } from "@/lib/pilot/core";
import { kst, kstLabel } from "@/lib/pilot/time";
import { AdminNav, DayBar, KindBanner } from "./AdminNav";
import { ScheduleBoard, type BoardRow } from "./ScheduleBoard";
import { JudgmentNow } from "../_ui/JudgmentNow";
import { AutoRefresh } from "../_ui/AutoRefresh";
import Link from "next/link";
import { OPEN } from "@/lib/pilot/cases";
import { kindParam } from "@/lib/pilot/board";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ date?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const { date, kind } = parseDay(await searchParams);
  const [day, staff, pending, openCases] = await Promise.all([
    loadDay(s.sb, date, kind),
    loadStaff(s.sb),
    pendingJobs(s.sb),
    s.sb.from("field_cases").select("status, urgency, issue_type").eq("data_kind", kind).in("status", OPEN),
  ]);
  const open = (openCases.data ?? []) as { status: string; urgency: string; issue_type: string }[];
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
      cancelledBefore: cancelledBetween(x, day.schedules).map((c) => c.site_name),
      events: day.events.filter((e) => e.schedule_id === x.id).length,
    }));
  const fieldStaff = staff.filter((p) => p.role === "field" && p.active).map((p) => ({ id: p.id, name: p.display_name }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">관리자 일정판 · {s.profile?.display_name}</h1>
        <AdminNav current="board" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DayBar path="/pilot/admin" date={date} kind={kind} today={kst(now).date} />
        <AutoRefresh seconds={15} />
      </div>
      <KindBanner kind={kind} />
      {open.length > 0 && (
        <Link
          href={`/pilot/admin/cases?date=${date}&kind=${kindParam(kind)}`}
          className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-danger/50 bg-danger-bg/40 px-4 py-3 text-[18px] font-bold text-danger"
          aria-label="미처리 지원 요청"
        >
          ⚠ 미처리 지원 요청 {open.length}건 — 새 보고 {open.filter((x) => x.status === "보고됨").length}건 · 긴급·안전 {open.filter((x) => x.urgency === "긴급").length}건 → 현장 문제·지원 화면
        </Link>
      )}
      <ScheduleBoard date={date} kind={kind} staff={fieldStaff} names={names} rows={rows} pending={pending} />
      <JudgmentNow result={result} names={names} titles={titles} asOfLabel={`${kstLabel(now)} (지금)`} deviationsOpen={day.events.length > 0} />
    </div>
  );
}
