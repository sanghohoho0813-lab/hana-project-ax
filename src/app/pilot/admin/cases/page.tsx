import { requireAdmin } from "@/lib/pilot/session";
import { kindParam, loadStaff, parseDay } from "@/lib/pilot/board";
import { activeEvents, progressOf } from "@/lib/pilot/core";
import { endEventSeqs, judgmentsFor } from "@/lib/pilot/case-data";
import { loadRankedInbox } from "@/lib/pilot/case-rank";
import { isOpen, type Impact } from "@/lib/pilot/cases";
import { hhmm, kst, kstLabel } from "@/lib/pilot/time";
import { DayBar, KindBanner } from "../AdminNav";
import { AutoRefresh } from "../../_ui/AutoRefresh";
import { More, PageHead } from "../../_ui/ds";
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
  // 사건 날짜별 하루치 기록 → 지금 시각 기준 엔진 판단 (후속 현장 영향) → 우선 확인 순서
  const [{ inbox, today, days, ranked, closed, titleOf }, staff] = await Promise.all([loadRankedInbox(s.sb, date, kind, now), loadStaff(s.sb)]);
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));

  // 연결된 엔진 판단 (보고의 예상 종료 · 일정 조정 · 예상 종료 변경)
  const endSeq = await endEventSeqs(s.sb, inbox.cases.map((c) => c.end_event_id).filter((x): x is string => !!x));
  const seqs = [...endSeq.values(), ...inbox.steps.map((x) => x.linked_seq).filter((x): x is number => x !== null)];
  const judgments = await judgmentsFor(s.sb, seqs);

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

  // 표에는 이 날짜에 배정이 있거나 처리 중 사건이 있는 직원만 — 나머지는 이름만 한 줄로
  const busy = status.filter((r) => r.total > 0 || r.open > 0);
  const idle = status.filter((r) => r.total === 0 && r.open === 0);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="문제·지원"
        title="현장 문제 · 지원 요청"
        sub="우선 확인 순서: 안전 위험·긴급 → 엔진이 계산한 후속 현장 위험 → 미접수 · 오래 기다린 순"
        right={<AutoRefresh seconds={10} label="새 보고 확인" />}
      />
      <DayBar path="/pilot/admin/cases" date={date} kind={kind} today={kst(now).date} />
      <KindBanner kind={kind} />

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

      <section className="card table-scroll p-5" aria-label="직원별 현재 현장">
        <h2 className="mb-2 text-[17px] font-extrabold">직원별 현재 현장 · 작업상태 <span className="text-[14px] font-semibold text-ink-3">{date}</span></h2>
        <table className="w-full text-[15px]">
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
            {busy.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2.5 pr-2 font-bold">{r.name}</td>
                <td className="py-2.5 pr-2">{r.current}</td>
                <td className="py-2.5 pr-2 tabular-nums">
                  {r.done}/{r.total}
                </td>
                <td className={`py-2.5 pr-2 font-bold ${r.open ? "text-danger" : "text-ink-3"}`}>{r.open}건</td>
              </tr>
            ))}
          </tbody>
        </table>
        {busy.length === 0 && <p className="py-2 text-[14px] text-ink-3">이 날짜에 배정된 직원이 없습니다.</p>}
        {idle.length > 0 && (
          <More summary={`이 날짜 배정 없는 직원 ${idle.length}명`} className="mt-3">
            {idle.map((r) => r.name).join(", ")}
          </More>
        )}
      </section>
    </div>
  );
}
