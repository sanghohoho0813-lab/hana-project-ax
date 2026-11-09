import Link from "next/link";
import { requireField } from "@/lib/pilot/session";
import { kindParam, loadDay, parseDay } from "@/lib/pilot/board";
import { progressOf, sourceLabel } from "@/lib/pilot/core";
import { hhmm, kst, kstLabel } from "@/lib/pilot/time";
import { KindBanner } from "../admin/AdminNav";
import { FieldBoard, type FieldCard } from "./FieldBoard";

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default async function FieldPage({ searchParams }: { searchParams: Promise<{ date?: string; kind?: string }> }) {
  const s = await requireField();
  const { date, kind } = parseDay(await searchParams);
  const today = kst(new Date()).date;
  // RLS: 본인 담당 일정과 그 일정의 기록만 읽힌다
  const day = await loadDay(s.sb, date, kind);
  const titles = Object.fromEntries(day.schedules.map((x) => [x.id, x.site_name]));
  const voidedBy = new Map<string, "정정" | "무효">();
  for (const e of day.events) if (e.voids_event_id) voidedBy.set(e.voids_event_id, e.kind === "기록 무효" ? "무효" : "정정");

  const cards: FieldCard[] = day.schedules
    .slice()
    .sort((a, b) => (a.planned_start < b.planned_start ? -1 : 1))
    .map((x) => {
      const p = progressOf(x, day.events);
      return {
        id: x.id,
        siteName: x.site_name,
        region: x.region,
        plannedStart: hhmm(x.planned_start)!,
        plannedEnd: hhmm(x.planned_end)!,
        travelMinutes: x.travel_minutes,
        travelFrom: x.travel_from_id ? (titles[x.travel_from_id] ?? null) : null,
        priority: x.priority,
        status: x.status,
        note: x.note,
        phase: p.phase,
        acknowledged: !!p.acknowledged,
        started: !!p.started,
        ended: !!p.ended,
        steps: day.events
          .filter((e) => e.schedule_id === x.id && e.kind !== "기록 무효")
          .map((e) => ({
            id: e.id,
            kind: e.kind,
            time: kst(e.occurred_at).time,
            expectedEnd: hhmm(e.expected_end) ?? null,
            entryMode: e.entry_mode,
            source: sourceLabel(e),
            recordedAt: kstLabel(e.recorded_at),
            mine: e.actor_id === s.userId,
            replaced: voidedBy.get(e.id) ?? null,
          })),
      };
    });

  const q = (d: string) => `/pilot/field?date=${d}&kind=${kindParam(kind)}`;
  return (
    <div className="mx-auto max-w-[40rem] space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold">
          {date === today ? "오늘" : date} 내 일정 · {s.profile?.display_name}
        </h1>
        <p className="text-[16px] text-ink-3">기록 시각은 서버 시각으로 저장됩니다 · 지금 {kstLabel(new Date())}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[17px]">
        <Link href={q(shift(date, -1))} className="rounded-xl bg-white px-3 py-1.5 font-semibold text-ink-2">
          ◀ 전날
        </Link>
        {date !== today && (
          <Link href={q(today)} className="rounded-xl bg-primary-light px-3 py-1.5 font-bold text-primary-dark">
            오늘
          </Link>
        )}
        <Link href={q(shift(date, 1))} className="rounded-xl bg-white px-3 py-1.5 font-semibold text-ink-2">
          다음날 ▶
        </Link>
        <Link
          href={`/pilot/field?date=${date}&kind=${kind === "실제 업무" ? "scenario" : "real"}`}
          className="ml-auto rounded-xl bg-white px-3 py-1.5 font-semibold text-ink-3"
        >
          {kind === "실제 업무" ? "검증 시나리오 보기" : "실제 업무로 돌아가기"}
        </Link>
      </div>
      <KindBanner kind={kind} />
      <FieldBoard userId={s.userId} date={date} today={today} cards={cards} />
    </div>
  );
}
