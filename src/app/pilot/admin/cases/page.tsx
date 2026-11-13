import { requireAdmin } from "@/lib/pilot/session";
import { kindParam, loadDay, loadStaff, parseDay } from "@/lib/pilot/board";
import { activeEvents, judgeAt, progressOf, type DataKind } from "@/lib/pilot/core";
import { endEventSeqs, judgmentsFor, loadInbox } from "@/lib/pilot/case-data";
import { impactOf, isOpen, rankCases, type Impact } from "@/lib/pilot/cases";
import { hhmm, kst, kstLabel } from "@/lib/pilot/time";
import { AdminNav, DayBar, KindBanner } from "../AdminNav";
import { AutoRefresh } from "../../_ui/AutoRefresh";
import { CaseBoard, type BoardCase, type DaySchedule } from "./CaseBoard";

/**
 * 관리자 — 현장 문제 · 지원 요청
 * 처리되지 않은 요청은 날짜와 상관없이 계속 보인다. 우선 확인 순서는 안전 위험·긴급 다음으로
 * 기존 연쇄위험 엔진이 계산한 '후속 현장 위험'을 쓴다 (단순 접수 순서가 아님).
 */
export default async function CasesPage({ searchParams }: { searchParams: Promise<{ date?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const { date, kind } = parseDay(await searchParams);
  const now = new Date();
  const [inbox, staff, today] = await Promise.all([loadInbox(s.sb, date, kind), loadStaff(s.sb), loadDay(s.sb, date, kind)]);
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));

  // 사건 날짜별 하루치 기록 → 지금 시각 기준 엔진 판단 (후속 현장 영향)
  const dates = [...new Set([date, ...inbox.cases.map((c) => c.work_date)])];
  const days = new Map<string, Awaited<ReturnType<typeof loadDay>>>([[date, today]]);
  await Promise.all(dates.filter((d) => d !== date).map(async (d) => days.set(d, await loadDay(s.sb, d, kind as DataKind))));
  const results = new Map(dates.map((d) => [d, judgeAt(days.get(d)!.schedules, days.get(d)!.events, now.toISOString())]));
  const impacts = new Map<string, Impact | null>();
  for (const c of inbox.cases) {
    const d = days.get(c.work_date)!;
    const start = (id: string) => hhmm(d.schedules.find((x) => x.id === id)?.planned_start);
    impacts.set(c.id, isOpen(c) ? impactOf(results.get(c.work_date)!, c.schedule_id, c.worker_id, start) : null);
  }
  const ranked = rankCases(inbox.cases.filter(isOpen), impacts, now);
  const closed = inbox.cases.filter((c) => !isOpen(c));

  // 연결된 엔진 판단 (보고의 예상 종료 · 일정 조정 · 예상 종료 변경)
  const endSeq = await endEventSeqs(s.sb, inbox.cases.map((c) => c.end_event_id).filter((x): x is string => !!x));
  const seqs = [...endSeq.values(), ...inbox.steps.map((x) => x.linked_seq).filter((x): x is number => x !== null)];
  const judgments = await judgmentsFor(s.sb, seqs);
  const titleOf = new Map<string, string>();
  for (const d of days.values()) for (const x of d.schedules) titleOf.set(x.id, x.site_name);

  const toBoard = (c: (typeof inbox.cases)[number], reasons: string[], impact: Impact | null): BoardCase => ({
    c,
    reasons,
    impact,
    site: titleOf.get(c.schedule_id) ?? "현장",
    steps: inbox.steps.filter((x) => x.case_id === c.id),
    photos: inbox.photos.filter((x) => x.case_id === c.id),
    reportJudgment: c.end_event_id ? (judgments.get(endSeq.get(c.end_event_id) ?? -1) ?? null) : null,
    stepJudgments: Object.fromEntries(inbox.steps.filter((x) => x.case_id === c.id && x.linked_seq !== null).map((x) => [x.id, judgments.get(x.linked_seq!) ?? null])),
  });

  const schedules: Record<string, DaySchedule[]> = Object.fromEntries(
    [...days.entries()].map(([d, v]) => [
      d,
      v.schedules
        .filter((x) => x.status === "예정")
        .map((x) => ({ id: x.id, site: x.site_name, workerId: x.assignee_id, start: hhmm(x.planned_start)!, end: hhmm(x.planned_end)!, version: x.version, started: progressOf(x, v.events).phase === "작업 중" })),
    ]),
  );

  // 직원별 현재 현장·작업상태 (선택한 날짜)
  const alive = activeEvents(today.events);
  const field = staff.filter((p) => p.role === "field" && p.active);
  const status = field.map((p) => {
    const mine = today.schedules.filter((x) => x.assignee_id === p.id && x.status === "예정");
    const phases = mine.map((x) => ({ x, ph: progressOf(x, today.events).phase }));
    const cur = phases.find((y) => y.ph === "작업 중") ?? phases.find((y) => y.ph === "예정" || y.ph === "확인함") ?? null;
    const end = cur ? alive.filter((e) => e.schedule_id === cur.x.id && e.kind === "예상 종료 보고").at(-1)?.expected_end : null;
    return {
      id: p.id,
      name: p.display_name,
      current: cur ? `${cur.x.site_name} · ${cur.ph}${end ? ` · 예상 종료 ${hhmm(end)}` : ""}` : mine.length ? "오늘 일정 모두 종료" : "배정 없음",
      done: phases.filter((y) => y.ph === "작업 종료").length,
      total: mine.length,
      open: inbox.cases.filter((c) => c.worker_id === p.id && isOpen(c)).length,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">현장 문제 · 지원 요청</h1>
        <AdminNav current="cases" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DayBar path="/pilot/admin/cases" date={date} kind={kind} today={kst(now).date} />
        <AutoRefresh seconds={10} label="새 보고 확인" />
      </div>
      <KindBanner kind={kind} />

      <section className="card overflow-x-auto p-4" aria-label="직원별 현재 현장">
        <h2 className="mb-1.5 text-[20px] font-extrabold">직원별 현재 현장 · 작업상태 ({date})</h2>
        <table className="w-full min-w-[34rem] text-[16px]">
          <thead className="text-[14px] text-ink-3">
            <tr>
              {["직원", "지금 현장", "끝난 현장", "처리 중 사건"].map((h) => (
                <th key={h} className="py-1 pr-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {status.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-1.5 pr-2 font-bold">{r.name}</td>
                <td className="py-1.5 pr-2">{r.current}</td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {r.done}/{r.total}
                </td>
                <td className={`py-1.5 pr-2 font-bold ${r.open ? "text-danger" : "text-ink-3"}`}>{r.open}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <CaseBoard
        kindParam={kindParam(kind)}
        date={date}
        scenario={kind !== "실제 업무"}
        userId={s.userId}
        open={ranked.map((r) => toBoard(r.c, r.reasons, r.impact))}
        closed={closed.map((c) => toBoard(c, [], null))}
        staff={staff.filter((p) => p.active).map((p) => ({ id: p.id, name: p.display_name, role: p.role }))}
        names={names}
        schedules={schedules}
        nowLabel={kstLabel(now)}
      />
    </div>
  );
}
