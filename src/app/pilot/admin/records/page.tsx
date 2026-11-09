import Link from "next/link";
import { requireAdmin } from "@/lib/pilot/session";
import { loadDay, loadRecords, loadStaff, parseDay } from "@/lib/pilot/board";
import { kst, kstLabel } from "@/lib/pilot/time";
import { AdminNav, DayBar, KindBanner } from "../AdminNav";

/** 입력 기록과 위험 판단 전후 — 실증 자료 확인용 (보고서 작성 시 이 화면과 판단 상세를 근거로 쓴다) */
export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ date?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const { date, kind } = parseDay(await searchParams);
  const [rec, day, staff] = await Promise.all([loadRecords(s.sb, date, kind), loadDay(s.sb, date, kind), loadStaff(s.sb)]);
  const name = (id: string) => staff.find((p) => p.id === id)?.display_name ?? "알 수 없음";
  const site = (id: string) => day.schedules.find((x) => x.id === id)?.site_name ?? "알 수 없는 현장";
  const evById = new Map(rec.events.map((e) => [e.id, e]));
  const replacedBy = new Map<string, { seq: number; kind: string }>();
  for (const e of rec.events) if (e.voids_event_id) replacedBy.set(e.voids_event_id, { seq: e.seq, kind: e.kind });
  const trigger = (kindText: string, ref: string) => {
    const e = evById.get(ref);
    if (e) return `${site(e.schedule_id)} ${e.kind}${e.expected_end ? ` ${e.expected_end.slice(0, 5)}` : ""} · ${name(e.actor_id)} · ${e.entry_mode}`;
    return `${site(ref)} ${kindText}`;
  };
  const th = "py-1.5 pr-3 text-left font-semibold whitespace-nowrap";
  const td = "py-1.5 pr-3 align-top";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">기록·판단 이력</h1>
        <AdminNav current="records" />
      </div>
      <DayBar path="/pilot/admin/records" date={date} kind={kind} today={kst(new Date()).date} />
      <KindBanner kind={kind} />
      <p className="text-[16px] text-ink-3">
        모든 시각은 한국 시각 · 실제 발생시각은 서버가 정한 값(즉시 기록: 서버 수신 − 기기 기준 전송 지연, 사후 입력: 입력한 시각) · DB 기록시각은 DB 서버가 쓴 순간 · 기록은 추가만 되며 고치거나 지울 수 없습니다.
      </p>

      {rec.pending.length > 0 && (
        <p className="rounded-2xl bg-warning-bg px-4 py-3 text-[17px] font-semibold text-warning">
          기록 대기 판단 {rec.pending.length}건 (번호 {rec.pending.map((p) => p.seq).join(", ")}) — 일정판의 &lsquo;다시 처리&rsquo;로 기록하세요.
          {rec.pending[0].last_error && ` 최근 오류: ${rec.pending[0].last_error}`}
        </p>
      )}

      <section className="card overflow-x-auto p-4" aria-label="작업 기록">
        <h2 className="mb-2 text-[22px] font-extrabold">작업 기록 {rec.events.length}건</h2>
        {rec.events.length === 0 ? (
          <p className="text-[17px] text-ink-3">이 날짜의 작업 기록이 없습니다.</p>
        ) : (
          <table className="w-full min-w-[64rem] text-[15.5px] tabular-nums">
            <thead className="text-ink-3">
              <tr>
                <th className={th}>번호</th>
                <th className={th}>현장</th>
                <th className={th}>기록</th>
                <th className={th}>실제 발생시각</th>
                <th className={th}>입력한 시각</th>
                <th className={th}>DB 기록시각</th>
                <th className={th}>입력 방식</th>
                <th className={th}>전송 지연</th>
                <th className={th}>입력자</th>
                <th className={th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {rec.events.map((e) => {
                const r = replacedBy.get(e.id);
                const target = e.voids_event_id ? evById.get(e.voids_event_id) : undefined;
                return (
                  <tr key={e.id} className="border-t border-line">
                    <td className={td}>{e.seq}</td>
                    <td className={td}>{site(e.schedule_id)}</td>
                    <td className={td}>
                      <b>{e.kind}</b>
                      {e.expected_end && ` ${e.expected_end.slice(0, 5)} 종료 예상`}
                      {target && <span className="block text-ink-3">{e.kind === "기록 무효" ? "무효 처리" : "정정"}: 번호 {target.seq}</span>}
                    </td>
                    <td className={td}>{kst(e.occurred_at).seconds}</td>
                    <td className={td}>{e.entered_time ? e.entered_time.slice(0, 5) : "-"}</td>
                    <td className={td}>{kst(e.recorded_at).seconds}</td>
                    <td className={td}>{e.entry_mode}</td>
                    <td className={td}>{e.send_delay_seconds === null ? "-" : `${e.send_delay_seconds}초`}</td>
                    <td className={td}>
                      {name(e.actor_id)}
                      <span className="block text-ink-3">{e.source}</span>
                    </td>
                    <td className={td}>{r ? <span className="text-warning">{r.kind === "기록 무효" ? "무효" : "정정됨"} (번호 {r.seq})</span> : e.kind === "기록 무효" ? "-" : "유효"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card overflow-x-auto p-4" aria-label="위험 판단 이력">
        <h2 className="mb-1 text-[22px] font-extrabold">위험 판단 이력 {rec.judgments.length}건</h2>
        <p className="mb-2 text-[15.5px] text-ink-3">일정 변경·작업 기록 1건마다 판단 1건 — 그 기록 직전까지와 그 기록까지의 자료로 계산한 전후 결과입니다.</p>
        {rec.judgments.length === 0 ? (
          <p className="text-[17px] text-ink-3">기록된 판단이 없습니다.</p>
        ) : (
          <table className="w-full min-w-[60rem] text-[15.5px] tabular-nums">
            <thead className="text-ink-3">
              <tr>
                <th className={th}>번호</th>
                <th className={th}>계기</th>
                <th className={th}>기준시각</th>
                <th className={th}>위험 연결</th>
                <th className={th}>판단 보류</th>
                <th className={th}>1순위 (전 → 후)</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rec.judgments.map((j) => {
                const changed = j.summary.risky_before !== j.summary.risky_after || j.summary.changed_links > 0;
                return (
                  <tr key={j.id} className={`border-t border-line ${changed ? "bg-warning-bg/30" : ""}`}>
                    <td className={td}>{j.seq}</td>
                    <td className={td}>{trigger(j.trigger_kind, j.trigger_ref)}</td>
                    <td className={td}>{kst(j.as_of).seconds}</td>
                    <td className={td}>
                      {j.summary.risky_before} → <b>{j.summary.risky_after}</b>
                    </td>
                    <td className={td}>
                      {j.summary.held_before} → {j.summary.held_after}
                    </td>
                    <td className={td}>
                      <span className="text-ink-3">{j.summary.priority_before[0] ?? "없음"}</span> → {j.summary.priority_after[0] ?? "없음"}
                    </td>
                    <td className={td}>
                      <Link href={`/pilot/admin/judgments/${j.id}`} className="font-bold text-primary-dark underline">
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card overflow-x-auto p-4" aria-label="일정 변경 이력">
        <h2 className="mb-2 text-[22px] font-extrabold">일정 변경 이력 {rec.revisions.length}건</h2>
        <table className="w-full min-w-[44rem] text-[15.5px] tabular-nums">
          <thead className="text-ink-3">
            <tr>
              <th className={th}>번호</th>
              <th className={th}>현장</th>
              <th className={th}>변경</th>
              <th className={th}>수정본</th>
              <th className={th}>예정 · 이동시간</th>
              <th className={th}>관리자</th>
              <th className={th}>DB 기록시각</th>
            </tr>
          </thead>
          <tbody>
            {rec.revisions.map((r) => (
              <tr key={r.seq} className="border-t border-line">
                <td className={td}>{r.seq}</td>
                <td className={td}>{r.snapshot.site_name}</td>
                <td className={td}>{r.change_kind}</td>
                <td className={td}>{r.revision}</td>
                <td className={td}>
                  {r.snapshot.planned_start.slice(0, 5)}~{r.snapshot.planned_end.slice(0, 5)} · {r.snapshot.travel_minutes === null ? "이동 없음" : `${r.snapshot.travel_minutes}분`}
                </td>
                <td className={td}>{name(r.actor_id)}</td>
                <td className={td}>{kstLabel(r.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
