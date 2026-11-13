"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, PlayCircle, RotateCw, Send, StopCircle, WifiOff } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import type { PilotEventKind, ScheduleProgress } from "@/lib/pilot/core";
import { newOpId } from "@/lib/pilot/op-id";
import { enqueue, flushQueue, removeItem, type QueuedEvent } from "@/lib/pilot/queue";
import { kst } from "@/lib/pilot/time";
import { recordEventAction, type EventResult } from "./actions";
import { getQueue, isStorable, serverSnapshot, setQueue as storeQueue, subscribe } from "./queueStore";
import { CasePanel, type FieldCase } from "./CasePanel";

export interface FieldStep {
  id: string;
  kind: PilotEventKind;
  /** 실제 발생시각 (한국 시각 HH:MM) */
  time: string;
  expectedEnd: string | null;
  entryMode: string;
  source: string;
  recordedAt: string;
  mine: boolean;
  replaced: "정정" | "무효" | null;
}

export interface FieldCard {
  id: string;
  siteName: string;
  region: string;
  plannedStart: string;
  plannedEnd: string;
  travelMinutes: number | null;
  travelFrom: string | null;
  priority: "긴급" | "보통" | "낮음";
  status: "예정" | "취소";
  note: string | null;
  phase: ScheduleProgress["phase"];
  acknowledged: boolean;
  started: boolean;
  ended: boolean;
  steps: FieldStep[];
  /** 지금 예상 종료 (마지막 예상 종료 보고, 없으면 예정 종료) */
  currentEnd: string;
  /** 이 현장의 문제 사건 (본인 담당만) */
  cases: FieldCase[];
}

const LABEL: Record<PilotEventKind, string> = {
  "업무 확인": "업무 확인",
  작업개시: "작업 시작",
  "예상 종료 보고": "예상 종료 보고",
  작업종료: "작업 종료",
  "기록 무효": "기록 무효",
};
const PHASE_TONE: Record<ScheduleProgress["phase"], Tone> = { 예정: "neutral", 확인함: "info", "작업 중": "warning", "작업 종료": "success", 취소: "neutral" };

type Tap = Pick<QueuedEvent, "kind" | "mode" | "enteredTime" | "expectedEnd" | "voidsEventId">;

export function FieldBoard({ userId, date, today, cards, scenario = false }: { userId: string; date: string; today: string; cards: FieldCard[]; scenario?: boolean }) {
  const router = useRouter();
  const queue = useSyncExternalStore(subscribe, () => getQueue(userId), serverSnapshot);
  const storable = queue === serverSnapshot() || isStorable();
  const [notice, setNotice] = useState<string | null>(null);
  const flushing = useRef(false);
  const current = useCallback(() => getQueue(userId), [userId]);
  const setQueue = useCallback((items: QueuedEvent[]) => storeQueue(userId, items), [userId]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let sent = false;
    try {
      await flushQueue(
        current,
        setQueue,
        async (item, sentAt) => {
          const r: EventResult = await recordEventAction({
            opId: item.opId,
            scheduleId: item.scheduleId,
            kind: item.kind,
            mode: item.mode,
            enteredTime: item.enteredTime,
            expectedEnd: item.expectedEnd,
            voidsEventId: item.voidsEventId,
            pressedAt: item.pressedAt,
            sentAt,
          });
          if (r.ok) {
            sent = true;
            setNotice(
              `${item.siteName} ${LABEL[item.kind]} ${r.duplicated ? "— 이미 기록된 요청입니다 (한 번만 저장)" : "기록됨"} · 실제 ${kst(r.occurredAt).time} · 서버 기록 ${kst(r.recordedAt).seconds} · ${r.entryMode}`,
            );
            return { ok: true };
          }
          return { ok: false, error: r.error, retry: r.retry };
        },
      );
    } finally {
      flushing.current = false;
      if (sent) router.refresh();
    }
  }, [router, setQueue, current]);

  // 저장해 둔 기록을 불러와 보내고, 연결이 돌아오거나 화면으로 돌아오면 다시 보낸다
  useEffect(() => {
    void flush();
    const again = () => void flush();
    const onVisible = () => document.visibilityState === "visible" && void flush();
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (current().some((x) => !x.stopped)) void flush();
    }, 15000);
    return () => {
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [flush, current]);

  const tap = (card: FieldCard, t: Tap) => {
    // 누른 시각을 먼저 휴대폰에 저장한 뒤 보낸다 — 보내다 끊겨도 기록이 남는다
    setQueue(enqueue(current(), { opId: newOpId(), scheduleId: card.id, siteName: card.siteName, pressedAt: new Date().toISOString(), ...t }));
    setNotice(null);
    void flush();
  };

  const waiting = queue.filter((x) => !x.stopped);
  const stopped = queue.filter((x) => x.stopped);

  return (
    <div className="space-y-3">
      {!storable && (
        <p className="rounded-2xl bg-warning-bg px-4 py-3 text-[17px] font-semibold text-warning">
          이 브라우저는 기록을 보관할 수 없습니다 (개인정보 보호 모드 등). 연결이 끊기면 기록이 사라질 수 있으니 전송 결과를 꼭 확인하세요.
        </p>
      )}
      {waiting.length > 0 && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning-bg px-4 py-3">
          <p className="flex items-center gap-2 text-[18px] font-bold text-warning">
            <WifiOff size={20} /> 전송 대기 {waiting.length}건 — 이 휴대폰에 보관 중
          </p>
          <p className="mt-0.5 text-[16px] text-ink-2">연결되면 자동으로 다시 보냅니다. 같은 기록이 두 번 저장되지 않습니다. 누른 시각을 기준으로 기록됩니다.</p>
          <button onClick={() => void flush()} className="mt-2 inline-flex min-h-[3rem] items-center gap-1.5 rounded-xl bg-white px-4 text-[17px] font-bold text-ink-2">
            <RotateCw size={18} /> 지금 다시 보내기
          </button>
        </div>
      )}
      {stopped.map((x) => (
        <div key={x.opId} role="alert" className="rounded-2xl border border-danger/30 bg-danger-bg/50 px-4 py-3">
          <p className="text-[17px] font-bold text-danger">
            {x.siteName} {LABEL[x.kind]} 기록 안 됨 — {x.lastError}
          </p>
          <p className="mt-0.5 text-[15.5px] text-ink-2">다시 보내도 같은 결과라 자동 재시도를 멈췄습니다. 내용을 확인한 뒤 지우고, 필요하면 다시 입력하세요.</p>
          <button onClick={() => setQueue(removeItem(current(), x.opId))} className="mt-1.5 rounded-lg bg-white px-3 py-1.5 text-[16px] font-bold text-ink-2">
            이 기록 지우기
          </button>
        </div>
      ))}
      {notice && (
        <p role="status" className="rounded-2xl bg-success-bg px-4 py-3 text-[17px] font-semibold text-success">
          {notice}
        </p>
      )}
      {cards.length === 0 ? (
        <p className="card px-5 py-6 text-[19px] text-ink-3">이 날짜에 배정된 일정이 없습니다.</p>
      ) : (
        cards.map((c) => (
          <Card key={c.id} c={c} date={date} today={today} pending={queue.filter((x) => x.scheduleId === c.id)} onTap={(t) => tap(c, t)} userId={userId} scenario={scenario} />
        ))
      )}
    </div>
  );
}

function Card({
  c,
  date,
  today,
  pending,
  onTap,
  userId,
  scenario,
}: {
  c: FieldCard;
  date: string;
  today: string;
  pending: QueuedEvent[];
  onTap: (t: Tap) => void;
  userId: string;
  scenario: boolean;
}) {
  const [late, setLate] = useState(false);
  const [fix, setFix] = useState<string | null>(null);
  const live = pending.filter((x) => !x.stopped);
  const has = (k: PilotEventKind) => live.some((x) => x.kind === k && !x.voidsEventId);
  const ackd = c.acknowledged || has("업무 확인");
  const started = c.started || has("작업개시");
  const ended = c.ended || has("작업종료");
  const isToday = date === today;
  const past = date < today;
  const active = c.status === "예정";
  const endActive = c.steps.some((s) => s.kind === "작업종료" && !s.replaced);

  const big = "flex min-h-[4rem] w-full items-center justify-center gap-2 rounded-2xl text-[22px] font-extrabold active:scale-[0.99] disabled:opacity-40";

  return (
    <section className={`card space-y-3 p-4 ${c.status === "취소" ? "opacity-60" : ""}`} aria-label={`${c.siteName} 일정`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[18px] font-bold text-ink-2 tabular-nums">
            {c.plannedStart} ~ {c.plannedEnd}
          </p>
          <h2 className="text-[25px] leading-tight font-extrabold">{c.siteName}</h2>
          {c.region && <p className="text-[16px] text-ink-3">{c.region}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={PHASE_TONE[c.phase]}>{c.status === "취소" ? "취소된 일정" : c.phase}</Badge>
          {c.priority === "긴급" && <Badge tone="danger">긴급</Badge>}
        </div>
      </div>
      {(c.travelMinutes !== null || c.note) && (
        <p className="text-[16.5px] text-ink-2">
          {c.travelMinutes !== null && `이동 ${c.travelMinutes}분${c.travelFrom ? ` (${c.travelFrom}에서)` : ""}`}
          {c.travelMinutes !== null && c.note && " · "}
          {c.note}
        </p>
      )}

      {/* 기록된 단계 */}
      {(c.steps.length > 0 || pending.length > 0) && (
        <ul className="space-y-1.5 rounded-2xl bg-[#f7f8fa] px-3.5 py-2.5">
          {c.steps.map((s) => (
            <li key={s.id} className={`text-[17px] ${s.replaced ? "text-ink-3 line-through" : ""}`}>
              <span className="font-bold">{LABEL[s.kind]}</span>{" "}
              {s.kind === "예상 종료 보고" ? (
                <>
                  <b className="tabular-nums">{s.expectedEnd}</b> 종료 예상 <span className="text-ink-3">(보고 {s.time})</span>
                </>
              ) : (
                <b className="tabular-nums">{s.time}</b>
              )}{" "}
              <span className="text-[15px] text-ink-3">
                · {s.entryMode}
                {!s.mine && " · 관리자 입력"}
                {s.replaced && ` · ${s.replaced}됨`}
              </span>
              {s.mine && !s.replaced && active && s.kind !== "예상 종료 보고" && !(s.kind === "작업개시" && endActive) && (
                <span className="ml-1 inline-flex gap-1 no-underline">
                  <button onClick={() => setFix(fix === s.id ? null : s.id)} className="rounded-lg bg-white px-2 py-0.5 text-[15px] font-bold text-primary-dark">
                    시각 정정
                  </button>
                  <button onClick={() => onTap({ kind: "기록 무효", mode: "즉시", voidsEventId: s.id })} className="rounded-lg bg-white px-2 py-0.5 text-[15px] font-bold text-danger">
                    잘못 누름
                  </button>
                </span>
              )}
              {fix === s.id && (
                <TimeSend
                  label={`${LABEL[s.kind]} 실제 시각`}
                  defaultValue={s.time}
                  button="정정 보내기"
                  onSend={(t) => {
                    setFix(null);
                    onTap({ kind: s.kind, mode: "사후", enteredTime: t, voidsEventId: s.id });
                  }}
                />
              )}
            </li>
          ))}
          {pending.map((x) => (
            <li key={x.opId} className="text-[17px]">
              <span className="font-bold">{x.voidsEventId ? (x.kind === "기록 무효" ? "기록 무효" : `${LABEL[x.kind]} 정정`) : LABEL[x.kind]}</span>{" "}
              {x.expectedEnd && <b className="tabular-nums">{x.expectedEnd} 종료 예상 </b>}
              {x.enteredTime && <b className="tabular-nums">{x.enteredTime} </b>}
              <Badge tone={x.stopped ? "danger" : "warning"}>{x.stopped ? "기록 안 됨" : `전송 대기 · ${kst(x.pressedAt).time} 누름`}</Badge>
            </li>
          ))}
        </ul>
      )}

      {/* 다음 할 일 */}
      {active && !ended && (
        <div className="space-y-2">
          {!ackd && !started && !past && (
            <button onClick={() => onTap({ kind: "업무 확인", mode: "즉시" })} className={`${big} bg-[#e8f1fe] text-primary-dark`}>
              <CheckCircle2 size={26} /> 업무 확인
            </button>
          )}
          {isToday && !started && (
            <button onClick={() => onTap({ kind: "작업개시", mode: "즉시" })} className={`${big} bg-primary text-white`}>
              <PlayCircle size={28} /> 작업 시작
            </button>
          )}
          {isToday && started && (
            <>
              <TimeSend
                label="예상 종료 시각"
                defaultValue={c.plannedEnd}
                button="예상 종료 보내기"
                onSend={(t) => onTap({ kind: "예상 종료 보고", mode: "즉시", expectedEnd: t })}
              />
              <button onClick={() => onTap({ kind: "작업종료", mode: "즉시" })} className={`${big} mt-3 bg-ink text-white`}>
                <StopCircle size={28} /> 작업 종료
              </button>
            </>
          )}
        </div>
      )}

      {active && (isToday || past) && !ended && (
        <div>
          <button onClick={() => setLate((v) => !v)} aria-expanded={late} className="inline-flex items-center gap-1.5 text-[17px] font-bold text-ink-2 underline">
            <Clock size={18} /> 시각을 놓쳤어요 (사후 입력)
          </button>
          {late && (
            <LateEntry
              steps={[!ackd && !started ? "업무 확인" : null, !started ? "작업개시" : null, started ? "작업종료" : null].filter((x): x is PilotEventKind => !!x)}
              onSend={(kind, t) => {
                setLate(false);
                onTap({ kind, mode: "사후", enteredTime: t });
              }}
            />
          )}
        </div>
      )}

      <CasePanel
        userId={userId}
        scenario={scenario}
        cases={c.cases}
        canReport={active && isToday}
        target={{ scheduleId: c.id, siteName: c.siteName, plannedEnd: c.plannedEnd, currentEnd: c.currentEnd, started }}
      />
    </section>
  );
}

function TimeSend({ label, defaultValue, button, onSend }: { label: string; defaultValue: string; button: string; onSend: (t: string) => void }) {
  const [t, setT] = useState(defaultValue);
  return (
    <div className="mt-1.5 flex flex-wrap items-end gap-2 no-underline">
      <label className="block">
        <span className="block text-[15.5px] font-semibold text-ink-3">{label}</span>
        <input type="time" value={t} onChange={(e) => setT(e.target.value)} className="min-h-[3.25rem] rounded-xl border border-line bg-white px-3 text-[21px] tabular-nums" />
      </label>
      <button
        onClick={() => /^\d{2}:\d{2}$/.test(t) && onSend(t)}
        className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-primary-light px-4 text-[18px] font-bold text-primary-dark"
      >
        <Send size={18} /> {button}
      </button>
    </div>
  );
}

function LateEntry({ steps, onSend }: { steps: PilotEventKind[]; onSend: (k: PilotEventKind, t: string) => void }) {
  const [kind, setKind] = useState<PilotEventKind>(steps[0]);
  const [t, setT] = useState("");
  if (steps.length === 0) return null;
  return (
    <div className="mt-2 space-y-2 rounded-2xl border border-line p-3">
      <p className="text-[16px] text-ink-2">실제로 있었던 시각을 넣으세요. &lsquo;사후 입력&rsquo;으로 표시되어 즉시 기록과 구분됩니다.</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="사후 입력할 단계">
        {steps.map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`rounded-xl px-3 py-2 text-[17px] font-bold ${kind === k ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
            {LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-[15.5px] font-semibold text-ink-3">실제 시각</span>
          <input type="time" value={t} onChange={(e) => setT(e.target.value)} aria-label="실제 시각" className="min-h-[3.25rem] rounded-xl border border-line bg-white px-3 text-[21px]" />
        </label>
        <button
          disabled={!/^\d{2}:\d{2}$/.test(t)}
          onClick={() => onSend(kind, t)}
          className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-primary px-4 text-[18px] font-bold text-white disabled:opacity-40"
        >
          <Send size={18} /> 사후 입력으로 보내기
        </button>
      </div>
    </div>
  );
}
