"use client";

import { useState } from "react";
import { CalendarPlus, Pencil, UserPlus, XCircle } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import { newOpId } from "@/lib/pilot/op-id";
import { kstLabel } from "@/lib/pilot/time";
import {
  addPerson,
  cancelSchedule,
  currentSchedules,
  judgeSession,
  labNames,
  labProgress,
  labTitles,
  saveSchedule,
  scheduleHints,
  sessionEvents,
  type LabState,
  type Phase,
  type Session,
  type Snap,
} from "@/lib/lab/model";
import { JudgmentNow } from "@/app/pilot/_ui/JudgmentNow";
import { HistoryList } from "./History";
import { ProvenanceBar, useProvenance } from "./Provenance";
import { MsgBox, btnGhost, btnPrimary, inputSm, labelSm, useAct } from "./common";

const PHASE_TONE: Record<Phase, Tone> = { 예정: "neutral", 확인함: "info", "작업 중": "warning", "작업 종료": "success", 취소: "neutral" };

export function AdminView({ s, session }: { s: LabState; session: Session }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [all, setAll] = useState(false);
  const { msg, setMsg, act } = useAct();
  const saved = (text: string) => {
    setMsg({ ok: true, text });
    setEditing(null);
    setCancelling(null);
  };
  const schedules = currentSchedules(s, session.id);
  const events = sessionEvents(s, session.id);
  const hints = scheduleHints(s, session.id);
  const { result, asOf, asOfBasis } = judgeSession(s, session.id, new Date());
  const workers = [...new Set(schedules.map((x) => x.workerId))];
  const recheck = schedules.filter((x) => (hints.get(x.id)?.cancelledBefore.length ?? 0) > 0 || hints.get(x.id)?.stale);

  return (
    <div className="space-y-4">
      <ProvenanceBar s={s} session={session} />

      <section className="card space-y-3 p-4" aria-label="현장기사">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[20px] font-extrabold">현장기사</h2>
          {s.people
            .filter((p) => p.role !== "입력자")
            .map((p) => (
              <span key={p.id} className="rounded-full bg-[#f2f4f6] px-2.5 py-1 text-[15.5px] font-semibold">
                {p.name}
                {p.code && <span className="ml-1 text-ink-3">{p.code}</span>}
              </span>
            ))}
          <button className={btnGhost} onClick={() => setAdding((v) => !v)}>
            <UserPlus size={18} /> 시험용 기사 추가
          </button>
        </div>
        {adding && (
          <form
            className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = act(
                (st, c) => {
                  const r = addPerson(st, { name: String(f.get("name")), code: String(f.get("code")), role: String(f.get("role")), org: "" }, c);
                  return { state: r.state, value: r.id };
                },
                "현장기사를 추가했습니다.",
              );
              if (ok) {
                e.currentTarget.reset();
                setAdding(false);
              }
            }}
          >
            <input name="name" required placeholder="이름" className={inputSm} aria-label="기사 이름" />
            <input name="code" placeholder="코드 (예: T01)" className={inputSm} aria-label="참가자 코드" />
            <select name="role" className={inputSm} aria-label="역할" defaultValue="현장기사">
              <option>현장기사</option>
              <option>시험용 기사</option>
              <option>현장 관계자</option>
            </select>
            <button className={btnPrimary}>추가</button>
          </form>
        )}
      </section>

      <section className="space-y-3" aria-label="일정">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[21px] font-extrabold">
            일정 <span className="text-[16px] font-semibold text-ink-3">{schedules.filter((x) => x.status === "예정").length}건 · 취소 {schedules.filter((x) => x.status === "취소").length}건</span>
          </h2>
          <button className={btnPrimary} onClick={() => setEditing(editing === "new" ? null : "new")}>
            <CalendarPlus size={18} /> 일정 등록
          </button>
        </div>
        <MsgBox msg={msg} />
        {editing === "new" && (
          <div className="card p-4">
            <ScheduleForm s={s} session={session} onClose={() => setEditing(null)} />
          </div>
        )}
        {recheck.length > 0 && (
          <div className="rounded-2xl border border-warning/40 bg-warning-bg/60 px-4 py-3 text-[16px]">
            <p className="font-bold text-warning">이동 기준 재확인 필요 {recheck.length}건</p>
            {recheck.map((x) => {
              const h = hints.get(x.id)!;
              return (
                <p key={x.id} className="text-ink-2">
                  · {x.siteName}:{" "}
                  {h.cancelledBefore.length > 0
                    ? `앞 일정(${h.cancelledBefore.join(", ")}) 취소 — 실제 이동 출발지와 이동시간을 확인해 주세요. 현재 규칙(R7)에서는 이 연결을 판단 보류로 둡니다.`
                    : "이동시간을 넣은 뒤 직전 일정이 바뀌었습니다 — 이동시간을 다시 저장해 주세요."}
                </p>
              );
            })}
          </div>
        )}
        {schedules.length === 0 ? (
          <p className="card px-4 py-4 text-[16.5px] text-ink-3">일정이 없습니다. &lsquo;일정 등록&rsquo;으로 현장 A·B·C 일정을 넣으세요.</p>
        ) : (
          workers.map((w) => (
            <div key={w} className="card overflow-x-auto p-3.5">
              <p className="mb-1.5 text-[18px] font-bold">{s.people.find((p) => p.id === w)?.name ?? "알 수 없음"}</p>
              <table className="w-full min-w-[40rem] text-[16px]">
                <thead className="text-[14px] text-ink-3">
                  <tr>
                    <th className="py-1 pr-2 text-left font-semibold">예정</th>
                    <th className="py-1 pr-2 text-left font-semibold">현장</th>
                    <th className="py-1 pr-2 text-left font-semibold">이동</th>
                    <th className="py-1 pr-2 text-left font-semibold">진행</th>
                    <th className="py-1 text-left font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {schedules
                    .filter((x) => x.workerId === w)
                    .map((x) => {
                      const h = hints.get(x.id)!;
                      const p = labProgress(x, events);
                      return (
                        <Row key={x.id}>
                          <tr className={`border-t border-line align-top ${x.status === "취소" ? "text-ink-3 line-through" : ""}`}>
                            <td className="py-1.5 pr-2 font-semibold whitespace-nowrap tabular-nums">
                              {x.plannedStart}~{x.plannedEnd}
                            </td>
                            <td className="py-1.5 pr-2">
                              <b>{x.siteName}</b>
                              {x.priority === "긴급" && <Badge tone="danger" className="ml-1 !py-0 !text-[13.5px]">긴급</Badge>}
                              {x.region && <span className="ml-1 text-ink-3">{x.region}</span>}
                            </td>
                            <td className="py-1.5 pr-2">
                              {x.travelMinutes === null ? <span className="text-ink-3">없음</span> : `${x.travelMinutes}분 (${h.fromTitle ?? "?"}에서)`}
                              {h.cancelledBefore.length > 0 && <span className="block text-[14px] font-bold text-warning no-underline">취소 일정({h.cancelledBefore.join(", ")}) — 재확인 · 판단 보류(R7)</span>}
                              {h.cancelledBefore.length === 0 && h.stale && <span className="block text-[14px] font-bold text-warning no-underline">직전 일정이 바뀜 — 다시 저장</span>}
                            </td>
                            <td className="py-1.5 pr-2">
                              <Badge tone={PHASE_TONE[p.phase]} className="!py-0 !text-[14.5px]">
                                {p.phase}
                              </Badge>
                            </td>
                            <td className="py-1.5 text-right whitespace-nowrap">
                              {x.status === "예정" && (
                                <span className="inline-flex gap-1">
                                  <button onClick={() => setEditing(editing === x.id ? null : x.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#f2f4f6] px-2 py-1 font-semibold text-ink-2">
                                    <Pencil size={14} /> 조정
                                  </button>
                                  <button onClick={() => setCancelling(cancelling === x.id ? null : x.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#f2f4f6] px-2 py-1 font-semibold text-danger">
                                    <XCircle size={14} /> 취소
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                          {editing === x.id && (
                            <tr>
                              <td colSpan={5} className="pb-2">
                                <div className="rounded-2xl border border-line p-3">
                                  <ScheduleForm s={s} session={session} initial={x} onClose={() => setEditing(null)} onSaved={saved} />
                                </div>
                              </td>
                            </tr>
                          )}
                          {cancelling === x.id && (
                            <tr>
                              <td colSpan={5} className="pb-2">
                                <CancelForm session={session} x={x} onClose={() => setCancelling(null)} onSaved={saved} />
                              </td>
                            </tr>
                          )}
                        </Row>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      <JudgmentNow
        result={result}
        names={labNames(s)}
        titles={labTitles(s, session.id)}
        asOfLabel={`${kstLabel(asOf)} (${asOfBasis === "실제 현재 시각" ? "지금" : "재현 기준시각 · 가정값"})`}
        deviationsOpen={events.length > 0}
      />

      <section className="space-y-2" aria-label="판단 전후 기록">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[21px] font-extrabold">입력·조정할 때마다 판단 전 → 후</h2>
          <button className="text-[15.5px] font-bold text-primary-dark underline" onClick={() => setAll((v) => !v)}>
            {all ? "최근 10건만" : "전체 보기"}
          </button>
        </div>
        <HistoryList s={s} sessionId={session.id} limit={all ? undefined : 10} />
      </section>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ScheduleForm({ s, session, initial, onClose, onSaved }: { s: LabState; session: Session; initial?: Snap; onClose: () => void; onSaved?: (text: string) => void }) {
  const [prov] = useProvenance(session);
  const [opId, setOpId] = useState(newOpId);
  const { msg, act } = useAct();
  const workers = s.people.filter((p) => p.role !== "입력자");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const g = (k: string) => String(f.get(k) ?? "").trim();
        const travel = g("travel");
        const form = e.currentTarget;
        const ok = act(
          (st, c) => {
            const r = saveSchedule(
              st,
              {
                opId,
                sessionId: session.id,
                scheduleId: initial?.id ?? null,
                expectedVersion: initial?.version ?? null,
                workerId: g("worker"),
                siteName: g("site"),
                region: g("region"),
                plannedStart: g("start"),
                plannedEnd: g("end"),
                travelMinutes: travel === "" ? null : Number(travel),
                priority: (g("priority") || "보통") as Snap["priority"],
                note: g("note"),
                reason: g("reason"),
                prov,
              },
              c,
            );
            return { state: r.state, value: r.duplicated };
          },
          (dup) => (dup ? "이미 저장된 요청입니다 (한 번만 저장)." : initial ? "일정을 조정했습니다 — 아래에서 판단 전후를 확인하세요." : `${g("site")} 일정을 등록했습니다. 다음 일정을 이어서 넣으세요.`),
        );
        if (ok === null) return;
        if (initial) onSaved?.(ok ? "이미 저장된 요청입니다 (한 번만 저장)." : "일정을 조정했습니다 — 아래 '판단 전 → 후'에서 다시 판단한 결과를 확인하세요.");
        else {
          // 같은 기사로 다음 현장을 바로 넣을 수 있게 기사·중요도는 남기고 나머지만 비운다
          for (const k of ["site", "region", "start", "end", "travel", "note"]) {
            const el = form.elements.namedItem(k);
            if (el instanceof HTMLInputElement) el.value = "";
          }
          setOpId(newOpId());
        }
      }}
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelSm}>현장기사</span>
          <select name="worker" required defaultValue={initial?.workerId ?? ""} className={inputSm}>
            <option value="" disabled>
              고르세요
            </option>
            {workers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.code && `(${p.code})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelSm}>현장 이름</span>
          <input name="site" required maxLength={60} defaultValue={initial?.siteName} className={inputSm} placeholder="예: A현장" />
        </label>
        <label>
          <span className={labelSm}>지역</span>
          <input name="region" defaultValue={initial?.region} className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>업무 중요도</span>
          <select name="priority" defaultValue={initial?.priority ?? "보통"} className={inputSm}>
            <option>긴급</option>
            <option>보통</option>
            <option>낮음</option>
          </select>
        </label>
        <label>
          <span className={labelSm}>예정 시작</span>
          <input name="start" type="time" required defaultValue={initial?.plannedStart} className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>예정 종료</span>
          <input name="end" type="time" required defaultValue={initial?.plannedEnd} className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>직전 현장에서 이동시간(분)</span>
          <input name="travel" type="number" min={0} max={600} inputMode="numeric" defaultValue={initial?.travelMinutes ?? ""} placeholder="그날 첫 일정이면 비움" className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>{initial ? "조정 사유" : "메모"}</span>
          <input name={initial ? "reason" : "note"} defaultValue={initial ? "" : ""} className={inputSm} />
        </label>
      </div>
      <p className="text-[14px] text-ink-3">이동 출발 현장은 이 기사의 바로 앞 일정으로 자동 기록됩니다 · 이동시간은 입력값(실시간 교통정보 아님) · 저장하면 판단 전후가 기록됩니다</p>
      <MsgBox msg={msg} />
      <div className="flex gap-2">
        <button className={btnPrimary}>{initial ? "조정하고 다시 판단" : "일정 등록"}</button>
        <button type="button" className={btnGhost} onClick={onClose}>
          닫기
        </button>
      </div>
    </form>
  );
}

function CancelForm({ session, x, onClose, onSaved }: { session: Session; x: Snap; onClose: () => void; onSaved: (text: string) => void }) {
  const [prov] = useProvenance(session);
  const [opId] = useState(newOpId);
  const { msg, act } = useAct();
  return (
    <form
      className="space-y-2 rounded-2xl bg-danger-bg/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
        const ok = act(
          (st, c) => {
            const r = cancelSchedule(st, { opId, sessionId: session.id, scheduleId: x.id, expectedVersion: x.version, reason, prov }, c);
            return { state: r.state, value: r.duplicated };
          },
          "",
        );
        if (ok !== null) onSaved(`${x.siteName} 일정을 취소했습니다 (기록은 남습니다). 후속 현장의 실제 이동 출발지와 이동시간을 다시 확인해 주세요 — 현재 규칙(R7)에서는 그 연결을 판단 보류로 둡니다.`);
      }}
    >
      <p className="text-[16px] font-bold text-danger">{x.siteName} 일정을 취소합니다 — 지우지 않고 &lsquo;취소&rsquo;로 남깁니다.</p>
      <input name="reason" placeholder="취소 사유" className={inputSm} aria-label="취소 사유" />
      <MsgBox msg={msg} />
      <div className="flex gap-2">
        <button className={`${btnPrimary} !bg-danger`}>일정 취소</button>
        <button type="button" className={btnGhost} onClick={onClose}>
          닫기
        </button>
      </div>
    </form>
  );
}
