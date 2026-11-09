"use client";

import { useState } from "react";
import { CheckCircle2, Clock, PlayCircle, StopCircle, UserRound } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import { usePref } from "@/lib/lab/store";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import type { PilotEventKind } from "@/lib/pilot/core";
import {
  currentSchedules,
  delayNotes,
  judgeSession,
  labProgress,
  recordEvent,
  replacedBy,
  sessionEvents,
  type EventEntry,
  type LabState,
  type Phase,
  type Session,
  type Snap,
  type TimeBasis,
} from "@/lib/lab/model";
import { ProvenanceBar, useProvenance } from "./Provenance";
import { MsgBox, useAct } from "./common";

const LABEL: Record<PilotEventKind, string> = { "업무 확인": "업무 확인", 작업개시: "작업 시작", "예상 종료 보고": "예상 종료", 작업종료: "작업 종료", "기록 무효": "기록 무효" };
const PHASE_TONE: Record<Phase, Tone> = { 예정: "neutral", 확인함: "info", "작업 중": "warning", "작업 종료": "success", 취소: "neutral" };

type Sheet = { kind: PilotEventKind; voidsSeq: number | null; opId: string } | null;

export function WorkerView({ s, session }: { s: LabState; session: Session }) {
  const [workerId, setWorker] = usePref(`worker:${session.id}`, "");
  const schedules = currentSchedules(s, session.id);
  const withPlans = [...new Set(schedules.map((x) => x.workerId))];
  const worker = s.people.find((p) => p.id === workerId && withPlans.includes(p.id)) ?? null;
  const [picking, setPicking] = useState(false);

  if (!worker || picking) {
    return (
      <section className="space-y-3" aria-label="현장기사 고르기">
        <p className="text-[18px] font-bold">어느 현장기사 화면으로 볼까요?</p>
        <p className="text-[15px] text-ink-3">시험용 화면 전환입니다 — 실제 로그인이 아닙니다. 입력한 사람은 &lsquo;입력자&rsquo;로 따로 남습니다.</p>
        {withPlans.length === 0 && <p className="card px-4 py-4 text-[16.5px] text-ink-3">이 세트에 일정이 없습니다. 관리자 시점에서 일정을 먼저 넣으세요.</p>}
        {withPlans.map((id) => {
          const p = s.people.find((x) => x.id === id);
          return (
            <button
              key={id}
              onClick={() => {
                setWorker(id);
                setPicking(false);
              }}
              className="flex min-h-[4rem] w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-[21px] font-bold shadow-[var(--shadow-card)]"
            >
              <UserRound size={26} className="text-primary" />
              {p?.name ?? "알 수 없음"}
              {p?.code && <span className="text-[16px] text-ink-3">{p.code}</span>}
              <span className="ml-auto text-[15px] font-semibold text-ink-3">일정 {schedules.filter((x) => x.workerId === id && x.status === "예정").length}건</span>
            </button>
          );
        })}
      </section>
    );
  }

  const mine = schedules.filter((x) => x.workerId === worker.id);
  const { result } = judgeSession(s, session.id, new Date());
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[20px] font-extrabold">
          {worker.name} <span className="text-[15px] font-semibold text-ink-3">현장기사 시점 · 시험용 전환</span>
        </p>
        <button onClick={() => setPicking(true)} className="rounded-xl bg-white px-3 py-1.5 text-[15.5px] font-bold text-ink-2 shadow-[var(--shadow-card)]">
          기사 바꾸기
        </button>
      </div>
      <ProvenanceBar s={s} session={session} workerId={worker.id} />
      <p className={`rounded-xl px-3 py-2 text-[15px] font-semibold ${session.kind === "실제 업무" ? "bg-[#e8f1fe] text-[#1b64da]" : "bg-[#fdf3e0] text-[#8a4b00]"}`}>
        {session.kind === "실제 업무"
          ? "실제 업무 — 버튼을 누른 시각이 실제 시각으로 기록됩니다."
          : `${session.kind} — 버튼을 누르면 실제 시각을 묻습니다. 모르면 '시각 모름'을 누르세요 (추정하지 않음).`}
      </p>
      {mine.map((x) => (
        <Card key={x.id} s={s} session={session} x={x} notes={delayNotes(result, x.id)} />
      ))}
    </div>
  );
}

function Card({ s, session, x, notes }: { s: LabState; session: Session; x: Snap; notes: string[] }) {
  const [prov] = useProvenance(session);
  const { msg, act } = useAct();
  const [sheet, setSheet] = useState<Sheet>(null);
  // 기록 직후 잠깐은 버튼을 받지 않는다 — 두 번 누른 두 번째 손가락이 바뀐 화면의 다른 버튼을 누르지 않게
  const [cool, setCool] = useState(false);
  const cooling = () => cool;
  const events = sessionEvents(s, session.id).filter((e) => e.scheduleId === x.id);
  const rep = replacedBy(events);
  const p = labProgress(x, events);
  const live = session.kind === "실제 업무";
  const active = x.status === "예정";

  const record = (kind: PilotEventKind, opts: { timeMode: "지금" | "입력" | "모름"; time?: string; timeBasis?: TimeBasis; expectedEnd?: string; voidsSeq?: number | null; opId?: string }) => {
    const ok = act(
      (st, c) => {
        const r = recordEvent(
          st,
          {
            opId: opts.opId ?? newOpId(),
            sessionId: session.id,
            scheduleId: x.id,
            kind,
            timeMode: opts.timeMode,
            time: opts.time,
            timeBasis: opts.timeBasis,
            expectedEnd: opts.expectedEnd ?? null,
            voidsSeq: opts.voidsSeq ?? null,
            via: "현장기사 화면",
            prov,
          },
          c,
        );
        const e = r.state.entries.find((o) => o.seq === r.seq) as EventEntry;
        return { state: r.state, value: { dup: r.duplicated, e } };
      },
      ({ dup, e }) =>
        dup
          ? "이미 기록된 입력입니다 (한 번만 저장)."
          : `${x.siteName} ${LABEL[kind]}${e.expectedEnd ? ` ${e.expectedEnd}` : ""} 기록됨 · 실제 ${e.occurredAt ? kst(e.occurredAt).time : "모름"} (${e.timeBasis}) · 입력 ${kst(e.enteredAt).seconds}`,
    );
    if (ok) {
      setCool(true);
      window.setTimeout(() => setCool(false), 450);
      setSheet(null);
    }
  };

  const open = (s: NonNullable<Sheet>) => {
    if (!cooling()) setSheet(s);
  };

  const tap = (kind: PilotEventKind) => {
    if (cooling()) return;
    if (live && kind !== "예상 종료 보고") record(kind, { timeMode: "지금" });
    else open({ kind, voidsSeq: null, opId: newOpId() });
  };

  const big = "flex min-h-[4rem] w-full items-center justify-center gap-2 rounded-2xl text-[22px] font-extrabold active:scale-[0.99]";
  return (
    <section className={`card space-y-2.5 p-4 ${x.status === "취소" ? "opacity-60" : ""}`} aria-label={`${x.siteName} 일정`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-ink-2 tabular-nums">
            {x.plannedStart} ~ {x.plannedEnd}
          </p>
          <h3 className="text-[25px] leading-tight font-extrabold">{x.siteName}</h3>
          {x.travelMinutes !== null && <p className="text-[15.5px] text-ink-3">이동 {x.travelMinutes}분</p>}
        </div>
        <Badge tone={PHASE_TONE[p.phase]}>{x.status === "취소" ? "취소됨" : p.phase}</Badge>
      </div>

      {events.filter((e) => e.kind !== "기록 무효").length > 0 && (
        <ul className="space-y-1 rounded-2xl bg-[#f7f8fa] px-3 py-2">
          {events
            .filter((e) => e.kind !== "기록 무효")
            .map((e) => {
              const r = rep.get(e.seq);
              return (
                <li key={e.seq} className={`text-[16.5px] ${r ? "text-ink-3 line-through" : ""}`}>
                  <b>{LABEL[e.kind]}</b> {e.expectedEnd && <b className="tabular-nums">{e.expectedEnd} </b>}
                  <span className="tabular-nums">{e.occurredAt ? kst(e.occurredAt).time : "시각 모름"}</span>
                  <span className="text-[14px] text-ink-3">
                    {e.occurredAt && ` · ${e.timeBasis}`}
                    {r && ` · ${r.kind === "기록 무효" ? "무효" : "정정됨"}`}
                  </span>
                  {!r && active && (
                    <button onClick={() => open({ kind: e.kind, voidsSeq: e.seq, opId: newOpId() })} className="ml-1.5 rounded-lg bg-white px-2 py-0.5 text-[14.5px] font-bold text-primary-dark no-underline">
                      정정
                    </button>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      {notes.map((n) => (
        <p key={n} className="rounded-xl bg-danger-bg px-3 py-2 text-[15.5px] font-bold text-danger">
          ⚠ {n}
        </p>
      ))}
      <MsgBox msg={msg} />

      {sheet ? (
        <TimeSheet
          session={session}
          x={x}
          sheet={sheet}
          onCancel={() => setSheet(null)}
          onVoid={() => record("기록 무효", { timeMode: "모름", voidsSeq: sheet.voidsSeq, opId: sheet.opId })}
          onSend={(o) => record(sheet.kind, { ...o, voidsSeq: sheet.voidsSeq, opId: sheet.opId })}
        />
      ) : (
        active &&
        !p.end && (
          <div className="space-y-2">
            {!p.ack && !p.start && (
              <button onClick={() => tap("업무 확인")} className={`${big} bg-[#e8f1fe] text-primary-dark`}>
                <CheckCircle2 size={26} /> 업무 확인
              </button>
            )}
            {!p.start && (
              <button onClick={() => tap("작업개시")} className={`${big} bg-primary text-white`}>
                <PlayCircle size={28} /> 작업 시작
              </button>
            )}
            {p.start && (
              <>
                <button onClick={() => open({ kind: "예상 종료 보고", voidsSeq: null, opId: newOpId() })} className={`${big} bg-[#e8f1fe] text-primary-dark`}>
                  <Clock size={26} /> 예상 종료시간 변경
                </button>
                <button onClick={() => tap("작업종료")} className={`${big} bg-ink text-white`}>
                  <StopCircle size={28} /> 작업 종료
                </button>
              </>
            )}
            {live && (
              <button onClick={() => open({ kind: !p.start ? "작업개시" : "작업종료", voidsSeq: null, opId: newOpId() })} className="text-[15.5px] font-bold text-ink-2 underline">
                시각을 놓쳤어요 (직접 입력)
              </button>
            )}
          </div>
        )
      )}
    </section>
  );
}

function TimeSheet({
  session,
  x,
  sheet,
  onCancel,
  onVoid,
  onSend,
}: {
  session: Session;
  x: Snap;
  sheet: NonNullable<Sheet>;
  onCancel: () => void;
  onVoid: () => void;
  onSend: (o: { timeMode: "지금" | "입력" | "모름"; time?: string; timeBasis?: TimeBasis; expectedEnd?: string }) => void;
}) {
  const live = session.kind === "실제 업무";
  const virtual = session.kind === "가상 시나리오";
  const report = sheet.kind === "예상 종료 보고";
  const [time, setTime] = useState("");
  const [end, setEnd] = useState(x.plannedEnd);
  const [basis, setBasis] = useState<TimeBasis>("정보 제공자 진술");
  const title = sheet.voidsSeq !== null ? `${LABEL[sheet.kind]} 정정` : LABEL[sheet.kind];
  return (
    <div className="space-y-2.5 rounded-2xl border-2 border-primary/30 bg-white p-3">
      <p className="text-[18px] font-extrabold">{title}</p>
      {report && (
        <label className="block">
          <span className="block text-[15px] font-semibold text-ink-2">새 예상 종료시간</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="새 예상 종료시간" className="min-h-[3.2rem] w-full rounded-xl border border-line px-3 text-[22px]" />
        </label>
      )}
      <label className="block">
        <span className="block text-[15px] font-semibold text-ink-2">{report ? "보고받은 실제 시각" : "실제로 한 시각"}</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="실제 시각" className="min-h-[3.2rem] w-full rounded-xl border border-line px-3 text-[22px]" />
      </label>
      {!virtual && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="시각 근거">
          {(["정보 제공자 진술", "원자료 기록"] as TimeBasis[]).map((b) => (
            <button key={b} onClick={() => setBasis(b)} aria-pressed={basis === b} className={`rounded-xl px-3 py-2 text-[15.5px] font-bold ${basis === b ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
              {b}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!/^\d{2}:\d{2}$/.test(time) || (report && !/^\d{2}:\d{2}$/.test(end))}
          onClick={() => onSend({ timeMode: "입력", time, timeBasis: virtual ? "가상 시각" : basis, expectedEnd: report ? end : undefined })}
          className="min-h-[3.4rem] rounded-2xl bg-primary text-[19px] font-extrabold text-white disabled:opacity-40"
        >
          이 시각으로 기록
        </button>
        {live && !sheet.voidsSeq ? (
          <button disabled={report && !/^\d{2}:\d{2}$/.test(end)} onClick={() => onSend({ timeMode: "지금", expectedEnd: report ? end : undefined })} className="min-h-[3.4rem] rounded-2xl bg-[#e8f1fe] text-[19px] font-extrabold text-primary-dark">
            지금 시각으로
          </button>
        ) : (
          <button disabled={report && !/^\d{2}:\d{2}$/.test(end)} onClick={() => onSend({ timeMode: "모름", expectedEnd: report ? end : undefined })} className="min-h-[3.4rem] rounded-2xl bg-[#f2f4f6] text-[19px] font-extrabold text-ink-2">
            시각 모름
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        {sheet.voidsSeq !== null ? (
          <button onClick={onVoid} className="text-[15.5px] font-bold text-danger underline">
            잘못 누름 — 이 기록 무효
          </button>
        ) : (
          <span />
        )}
        <button onClick={onCancel} className="rounded-xl bg-[#f2f4f6] px-4 py-2 text-[16px] font-bold text-ink-2">
          닫기
        </button>
      </div>
      <p className="text-[13.5px] text-ink-3">실제 시각을 모르면 &lsquo;시각 모름&rsquo; — 시각을 추정해 넣지 않습니다. 정정해도 원래 기록은 남습니다.</p>
    </div>
  );
}
