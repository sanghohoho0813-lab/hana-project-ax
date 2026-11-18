"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Camera, CheckCircle2, ClipboardList, Clock, HardHat, Megaphone, PlayCircle, RotateCw, Send, StopCircle, ThumbsUp, WifiOff, X } from "lucide-react";
import type { PilotEventKind, ScheduleProgress } from "@/lib/pilot/core";
import { newOpId } from "@/lib/pilot/op-id";
import { enqueue, flushQueue, removeItem, type QueuedEvent } from "@/lib/pilot/queue";
import { kst } from "@/lib/pilot/time";
import { isOpen, STATUS_TEXT } from "@/lib/pilot/cases";
import { SAFETY_STAGES, STAGE_LABEL, hasLivePhoto, itemLabel, type SafetyStage } from "@/lib/pilot/safety";
import { lastReportAfterStart, safetyGaps, watchOf, type SafetyGap, type Watch } from "@/lib/pilot/watch";
import { recordEventAction, type EventResult } from "./actions";
import { getQueue, isStorable, serverSnapshot, setQueue as storeQueue, subscribe } from "./queueStore";
import { adminSteps, CasePanel, type FieldCase } from "./CasePanel";
import { SafetyPanel, type FieldSafety } from "./SafetyPanel";
import { FeedbackForm } from "./FeedbackForm";
import { btn, cx, Empty, More, Pill, SectionHead, type PillTone } from "../_ui/ds";

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
  /** 이 현장의 안전점검 */
  safety: FieldSafety[];
}

export type FieldTab = "today" | "report" | "safety" | "records";

const LABEL: Record<PilotEventKind, string> = {
  "업무 확인": "업무 확인",
  작업개시: "작업 시작",
  "예상 종료 보고": "예상 종료 보고",
  작업종료: "작업 종료",
  "기록 무효": "기록 무효",
};
const PHASE_TONE: Record<ScheduleProgress["phase"], PillTone> = { 예정: "neutral", 확인함: "info", "작업 중": "warning", "작업 종료": "success", 취소: "neutral" };

const TABS: { key: FieldTab; label: string; icon: typeof CalendarDays }[] = [
  { key: "today", label: "오늘 일정", icon: CalendarDays },
  { key: "safety", label: "안전점검", icon: HardHat },
  { key: "report", label: "문제 보고", icon: AlertTriangle },
  { key: "records", label: "내 기록", icon: ClipboardList },
];

type Tap = Pick<QueuedEvent, "kind" | "mode" | "enteredTime" | "expectedEnd" | "voidsEventId">;
/** 첫 화면의 빠른 버튼이 해당 현장 카드의 보고 · 사진 · 안전점검을 바로 연다 */
export type Focus = { id: string; act: "report" | "photo" | "safety" | "view"; n: number; stage?: SafetyStage };
/** 안전 1순위 (0.6.0) — 즉시 작업 시작 · 작업 종료를 누를 때 그 단계 점검이 없으면 먼저 묻는다 */
type Gate = { card: FieldCard; t: Tap; kind: "start" | "end" | "deficient" };

/** 기록된 단계 + 아직 보내는 중인 단계를 합친 진행 상태 */
function progress(c: FieldCard, pending: QueuedEvent[]) {
  const live = pending.filter((x) => x.scheduleId === c.id && !x.stopped);
  const has = (k: PilotEventKind) => live.some((x) => x.kind === k && !x.voidsEventId);
  const started = c.started || has("작업개시");
  return { ackd: c.acknowledged || has("업무 확인"), started, ended: c.ended || has("작업종료") };
}

/** 지금 시각(한국 HH:MM) — 서버 그림에는 없고(null) 휴대폰에서 20초마다 다시 읽는다 */
const subscribeNow = (cb: () => void) => {
  const t = window.setInterval(cb, 20000);
  return () => window.clearInterval(t);
};
const readNow = () => kst(new Date()).time;
const useNowHM = () => useSyncExternalStore(subscribeNow, readNow, () => null);

/**
 * 조기 확인 (0.5.0) — 작업 중인데 예정 시간의 절반이 지나도록 진행 보고가 없거나, 예상 종료를 넘기면 먼저 묻는다.
 * 기록된 단계 + 아직 보내는 중인 단계로 계산한다 (규칙: lib/pilot/watch.ts).
 */
function fieldWatch(c: FieldCard, pending: QueuedEvent[], now: string): Watch {
  const live = pending.filter((x) => x.scheduleId === c.id && !x.stopped && !x.voidsEventId);
  const alive = c.steps.filter((x) => !x.replaced);
  const startIdx = alive.findIndex((x) => x.kind === "작업개시");
  const queuedStart = live.find((x) => x.kind === "작업개시");
  const startedAt = startIdx >= 0 ? alive[startIdx].time : queuedStart ? kst(queuedStart.pressedAt).time : null;
  // 작업 시작 뒤에 '일어난' 예상 종료 보고 — 기록 순서가 아니라 발생시각으로 비교 (작업 시작을 나중에 사후 입력한 경우)
  const lastReport = lastReportAfterStart(
    startedAt,
    alive,
    live.filter((x) => x.kind === "예상 종료 보고" && x.expectedEnd).map((x) => ({ at: kst(x.pressedAt).time, end: x.expectedEnd! })),
  );
  return watchOf(
    {
      plannedStart: c.plannedStart,
      plannedEnd: c.plannedEnd,
      startedAt,
      ended: progress(c, pending).ended,
      cancelled: c.status === "취소",
      lastReport,
      openCase: c.cases.some((x) => isOpen(x.c)),
    },
    now,
  );
}

/** 이 현장 안전점검 3단계 가운데 빠졌거나 지금 낼 차례인 단계 */
function cardGaps(c: FieldCard, pending: QueuedEvent[], w: Watch | null, now: string | null): SafetyGap[] {
  const p = progress(c, pending);
  return safetyGaps(
    { started: p.started, ended: p.ended, midDue: !!(w?.checkAt && now && now >= w.checkAt), cancelled: c.status === "취소" },
    c.safety.filter((x) => hasLivePhoto(x.photos)).map((x) => x.c.stage),
  );
}

export function FieldBoard({
  userId,
  date,
  today,
  cards,
  scenario = false,
  initialTab = "today",
}: {
  userId: string;
  date: string;
  today: string;
  cards: FieldCard[];
  scenario?: boolean;
  initialTab?: FieldTab;
}) {
  const router = useRouter();
  const queue = useSyncExternalStore(subscribe, () => getQueue(userId), serverSnapshot);
  const storable = queue === serverSnapshot() || isStorable();
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTabState] = useState<FieldTab>(initialTab);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const flushing = useRef(false);
  const current = useCallback(() => getQueue(userId), [userId]);
  const setQueue = useCallback((items: QueuedEvent[]) => storeQueue(userId, items), [userId]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let sent = false;
    try {
      await flushQueue(current, setQueue, async (item, sentAt) => {
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
      });
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

  // 결과 알림은 화면 아래에 잠시 띄운다 (닫기 가능 · 12초 뒤 자동으로 닫힘)
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 12000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const send = (card: FieldCard, t: Tap) => {
    // 누른 시각을 먼저 휴대폰에 저장한 뒤 보낸다 — 보내다 끊겨도 기록이 남는다
    setQueue(enqueue(current(), { opId: newOpId(), scheduleId: card.id, siteName: card.siteName, pressedAt: new Date().toISOString(), ...t }));
    setNotice(null);
    void flush();
  };
  // 안전 1순위: 시작 전 점검 없이 '작업 시작', 마무리 점검 없이 '작업 종료'를 누르면 먼저 점검을 권한다 (점검 없이 진행도 가능 · 본사에 표시됨)
  const tap = (card: FieldCard, t: Tap) => {
    if (t.mode === "즉시" && !t.voidsEventId) {
      // 사진이 올라간 점검만 낸 것으로 본다 (사진 올리기가 실패한 점검은 다시 올려야 함)
      const has = new Set(card.safety.filter((x) => hasLivePhoto(x.photos)).map((x) => x.c.stage));
      if (t.kind === "작업개시" && !has.has("작업 전")) return setGate({ card, t, kind: "start" });
      // 시작 전 점검에 '미흡'이 있고 본사 보완 확인(조치 완료) 전이면 한 번 더 묻는다
      if (t.kind === "작업개시" && openDeficiency(card)) return setGate({ card, t, kind: "deficient" });
      if (t.kind === "작업종료" && !has.has("작업 종료")) return setGate({ card, t, kind: "end" });
    }
    send(card, t);
  };

  const setTab = (t: FieldTab) => {
    setTabState(t);
    try {
      const u = new URL(window.location.href);
      if (t === "today") u.searchParams.delete("tab");
      else u.searchParams.set("tab", t);
      window.history.replaceState(window.history.state, "", u);
    } catch {
      // 주소를 못 바꿔도 화면 전환은 된다
    }
    window.scrollTo({ top: 0 });
  };

  const go = (id: string, act: Focus["act"], stage?: SafetyStage) => {
    setFocus((f) => ({ id, act, n: (f?.n ?? 0) + 1, stage }));
    if (tab !== "today") setTabState("today");
    if (act !== "report") window.setTimeout(() => document.getElementById(`${act === "safety" ? "safety" : "card"}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const waiting = queue.filter((x) => !x.stopped);
  const stopped = queue.filter((x) => x.stopped);
  const isToday = date === today;
  const active = cards.filter((c) => c.status === "예정");
  const cur = isToday ? (active.find((c) => progress(c, queue).started && !progress(c, queue).ended) ?? active.find((c) => !progress(c, queue).ended)) : undefined;
  const openCases = cards.flatMap((c) => c.cases.filter((x) => isOpen(x.c)).map((x) => ({ card: c, x })));
  const supplements = cards.flatMap((c) => c.safety.filter((x) => x.c.review_status === "보완 요청").map((x) => ({ card: c, x })));
  const curState = cur ? progress(cur, queue) : null;
  const now = useNowHM();
  const curWatch = cur && now ? fieldWatch(cur, queue, now) : null;
  const curGaps = cur ? cardGaps(cur, queue, curWatch, now) : [];
  // 마친 현장의 빠진 안전점검(작업 중 · 작업 종료) — 오늘 소식에 띄운다
  const safetyMissing = isToday ? active.filter((c) => c.id !== cur?.id).flatMap((c) => cardGaps(c, queue, null, now).filter((g) => g.state === "누락").map((g) => ({ card: c, stage: g.stage }))) : [];

  return (
    <div className="space-y-4 pb-24">
      {!storable && (
        <p className="rounded-2xl bg-warning-bg px-4 py-3 text-[15px] font-semibold text-warning">
          이 브라우저는 기록을 보관할 수 없습니다 (개인정보 보호 모드 등). 연결이 끊기면 기록이 사라질 수 있으니 전송 결과를 꼭 확인하세요.
        </p>
      )}
      {waiting.length > 0 && (
        <div role="status" className="rounded-2xl bg-warning-bg px-4 py-3.5">
          <p className="flex items-center gap-2 text-[16.5px] font-extrabold text-warning">
            <WifiOff size={19} /> 전송 대기 {waiting.length}건 — 이 휴대폰에 보관 중
          </p>
          <p className="mt-1 text-[15.5px] text-ink-2">연결되면 자동으로 다시 보냅니다. 같은 기록이 두 번 저장되지 않습니다. 누른 시각을 기준으로 기록됩니다.</p>
          <button onClick={() => void flush()} className={cx(btn("white", "md"), "mt-2.5")}>
            <RotateCw size={17} /> 지금 다시 보내기
          </button>
        </div>
      )}
      {stopped.map((x) => (
        <div key={x.opId} role="alert" className="rounded-2xl bg-danger-bg px-4 py-3.5">
          <p className="text-[16px] font-extrabold text-danger">
            {x.siteName} {LABEL[x.kind]} 기록 안 됨 — {x.lastError}
          </p>
          <p className="mt-1 text-[15.5px] text-ink-2">다시 보내도 같은 결과라 자동 재시도를 멈췄습니다. 내용을 확인한 뒤 지우고, 필요하면 다시 입력하세요.</p>
          <button onClick={() => setQueue(removeItem(current(), x.opId))} className={cx(btn("white", "sm"), "mt-2")}>
            이 기록 지우기
          </button>
        </div>
      ))}

      {tab === "today" && (
        <>
          <Hero
            cur={cur}
            curState={curState}
            index={cur ? active.indexOf(cur) + 1 : 0}
            total={active.length}
            isToday={isToday}
            date={date}
            empty={cards.length === 0}
            onGo={go}
            watch={curWatch}
            gaps={curGaps}
            onOnTrack={(c, end) => tap(c, { kind: "예상 종료 보고", mode: "즉시", expectedEnd: end })}
          />
          {cards.length > 0 && (
            <Summary
              items={[
                { label: "오늘 현장", value: `${active.length}곳` },
                { label: "작업 종료", value: `${active.filter((c) => progress(c, queue).ended).length}곳`, tone: "success" },
                { label: "안전점검", value: `${active.reduce((n, c) => n + new Set(c.safety.filter((s) => hasLivePhoto(s.photos)).map((s) => s.c.stage)).size, 0)}/${active.length * 3}`, tone: supplements.length ? "danger" : "info" },
                { label: "열린 요청", value: `${openCases.length}건`, tone: openCases.length ? "warning" : "neutral" },
              ]}
            />
          )}
          <Messages openCases={openCases} supplements={supplements} missing={safetyMissing} onGo={go} />
          {cards.length > 0 && <SectionHead title="방문 순서" count={cards.length} />}
          {cards.length === 0 ? null : (
            <ol className="space-y-3">
              {cards.map((c, i) => (
                <li key={c.id}>
                  <Card
                    c={c}
                    index={i + 1}
                    current={cur?.id === c.id}
                    date={date}
                    today={today}
                    pending={queue.filter((x) => x.scheduleId === c.id)}
                    onTap={(t) => tap(c, t)}
                    userId={userId}
                    scenario={scenario}
                    focus={focus?.id === c.id ? focus : null}
                  />
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {tab === "report" && <ReportTab cards={cards} isToday={isToday} userId={userId} scenario={scenario} queue={queue} />}
      {tab === "safety" && <SafetyTab cards={active} isToday={isToday} userId={userId} />}
      {tab === "records" && <RecordsTab cards={cards} />}

      {gate && (
        <SafetyGate
          gate={gate}
          onCheck={() => {
            const g = gate;
            setGate(null);
            go(g.card.id, "safety", g.kind === "start" ? "작업 전" : "작업 종료");
          }}
          onSkip={() => {
            const g = gate;
            setGate(null);
            send(g.card, g.t);
          }}
          onClose={() => setGate(null)}
        />
      )}

      {/* 결과 알림 */}
      {notice && (
        <div className={cx("pointer-events-none fixed inset-x-0 z-40 px-4", tab === "today" && cur ? "bottom-[9.5rem]" : "bottom-[5.5rem]")}>
          <div role="status" className="toast-in pointer-events-auto mx-auto flex max-w-[38rem] items-start gap-2 rounded-2xl bg-ink px-4 py-3 text-[15px] font-semibold text-white shadow-[var(--shadow-modal)]">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#86efac]" />
            <span className="min-w-0 flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="알림 닫기" className="-m-1 rounded-lg p-1 text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 아래 고정: 지금 현장의 주요 버튼 + 메뉴 */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-white/95 backdrop-blur print:hidden">
        {tab === "today" && cur && curState && (
          <div className="mx-auto flex max-w-[40rem] items-center gap-3 px-4 pt-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink-3">지금 현장 · {cur.phase}</p>
              <p className="truncate text-[16.5px] font-extrabold">{cur.siteName}</p>
            </div>
            {!curState.started ? (
              <button onClick={() => tap(cur, { kind: "작업개시", mode: "즉시" })} className={btn("primary", "lg")}>
                <PlayCircle size={21} /> 작업 시작
              </button>
            ) : (
              <>
                <button onClick={() => go(cur.id, "photo")} className={btn("ghost", "lg")} aria-label={`${cur.siteName} 사진 첨부`}>
                  <Camera size={20} />
                </button>
                <button onClick={() => tap(cur, { kind: "작업종료", mode: "즉시" })} className={btn("dark", "lg")}>
                  <StopCircle size={21} /> 작업 종료
                </button>
              </>
            )}
          </div>
        )}
        <nav aria-label="현장 메뉴" className="mx-auto grid max-w-[40rem] grid-cols-4 px-2">
          {TABS.map((t) => {
            const on = tab === t.key;
            const Icon = t.icon;
            const badge = t.key === "report" ? openCases.length : t.key === "safety" ? supplements.length : 0;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} aria-current={on ? "page" : undefined} className={cx("relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[14px] font-bold", on ? "text-primary" : "text-ink-3")}>
                <Icon size={22} strokeWidth={on ? 2.4 : 2} aria-hidden />
                {t.label}
                {badge > 0 && <span className="absolute top-1.5 left-[calc(50%+6px)] min-w-[1.15rem] rounded-full bg-danger px-1 text-[12.5px] leading-[1.15rem] text-white tabular-nums">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** 첫 화면 — 지금 현장 · 다음 행동 · 빠른 버튼 */
function Hero({
  cur,
  curState,
  index,
  total,
  isToday,
  date,
  empty,
  onGo,
  watch,
  gaps,
  onOnTrack,
}: {
  cur: FieldCard | undefined;
  curState: ReturnType<typeof progress> | null;
  index: number;
  total: number;
  isToday: boolean;
  date: string;
  empty: boolean;
  onGo: (id: string, act: Focus["act"], stage?: SafetyStage) => void;
  watch: Watch | null;
  gaps: SafetyGap[];
  onOnTrack: (c: FieldCard, end: string) => void;
}) {
  if (empty) return <Empty icon={<CalendarDays size={22} />} title="이 날짜에 배정된 일정이 없습니다." desc="본사에서 일정을 등록하면 여기에 방문 순서대로 나타납니다." />;
  if (!isToday)
    return (
      <section aria-label="지금 할 일" className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-[15px] font-bold text-primary">{date} 일정 보기</p>
        <p className="mt-1 text-[17px] font-bold text-ink-2">작업 시작 · 종료는 그날에만 누를 수 있습니다. 놓친 시각은 카드의 &lsquo;사후 입력&rsquo;으로 남기세요.</p>
      </section>
    );
  if (!cur || !curState)
    return (
      <section aria-label="지금 할 일" className="rounded-[24px] bg-success-bg p-5">
        <p className="flex items-center gap-2 text-[19px] font-extrabold text-success">
          <CheckCircle2 size={22} /> 오늘 일정을 모두 마쳤습니다
        </p>
        <p className="mt-1 text-[15px] text-ink-2">놓친 기록이 있으면 각 카드에서 사후 입력이나 시각 정정을 하세요.</p>
      </section>
    );
  const next = !curState.started
    ? "현장에 도착하면 시작 전 안전점검(착용 사진)을 보내고 작업 시작을 누르세요."
    : "막히거나 뜯어보니 예상과 다르면 혼자 붙잡지 말고 바로 '문제 보고'를 누르세요. 본사가 숙련 직원 · 장비 지원을 바로 검토합니다.";
  const ask = watch && (watch.level === "중간 확인" || watch.level === "예정 넘김") ? watch : null;
  const gap = gaps[0];
  const preDue = !curState.started && gaps.some((g) => g.stage === "작업 전");
  const quickBase = "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[15.5px] font-bold transition-colors active:scale-[0.98]";
  const quick = `${quickBase} bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25`;
  return (
    <section aria-label="지금 할 일" className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4f46e5] to-[#3730a3] p-5 text-white shadow-[0_18px_40px_-18px_rgba(79,70,229,0.7)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-bold text-white/80">
          지금 할 일 · {index}/{total}번째 현장
        </p>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[14px] font-bold">{cur.phase}</span>
      </div>
      <p className="mt-2 text-[25px] leading-tight font-extrabold tracking-[-0.01em]">{cur.siteName}</p>
      <p className="mt-0.5 text-[15px] text-white/80 tabular-nums">
        {cur.plannedStart}–{cur.plannedEnd}
        {cur.region && ` · ${cur.region}`}
        {curState.started && cur.currentEnd !== cur.plannedEnd && ` · 예상 종료 ${cur.currentEnd}`}
      </p>
      {ask ? (
        <div aria-live="polite" role="region" aria-label="진행 확인" className="mt-3 rounded-2xl bg-white p-3.5 text-ink">
          <p className={cx("flex items-center gap-1.5 text-[16.5px] font-extrabold", ask.level === "예정 넘김" ? "text-danger" : "text-warning")}>
            <Clock size={19} /> {ask.level === "예정 넘김" ? `예상 종료 ${ask.expectedEnd}가 ${ask.overBy}분 지났어요` : `작업 시작 ${ask.elapsed}분째예요 — 예정대로 되고 있나요?`}
          </p>
          <p className="mt-1 text-[15px] text-ink-2">{ask.level === "예정 넘김" ? "막혔으면 지원을 요청하고, 아니면 새 예상 종료를 보내 주세요. 본사가 먼저 알면 빨리 도울 수 있습니다." : "막히는 게 있으면 지금 알려 주세요. 혼자 오래 붙잡을수록 지원이 늦어집니다."}</p>
          <div className={cx("mt-2.5 grid gap-2", ask.level === "중간 확인" ? "grid-cols-3" : "grid-cols-2")}>
            <button onClick={() => onGo(cur.id, "report")} className={cx(btn("danger", "md"), "flex-col !gap-0.5 !px-1 leading-tight")}>
              <AlertTriangle size={18} /> 막혔어요
              <span className="text-[12.5px] font-semibold opacity-90">지원 요청</span>
            </button>
            {ask.level === "중간 확인" && (
              <button onClick={() => onOnTrack(cur, ask.expectedEnd!)} className={cx(btn("soft", "md"), "flex-col !gap-0.5 !px-1 leading-tight")}>
                <ThumbsUp size={18} /> 예정대로
                <span className="text-[12.5px] font-semibold tabular-nums">{ask.expectedEnd} 종료</span>
              </button>
            )}
            <button onClick={() => onGo(cur.id, "view")} className={cx(btn("white", "md"), "flex-col !gap-0.5 !px-1 leading-tight ring-1 ring-line")}>
              <Send size={18} /> 늦어져요
              <span className="text-[12.5px] font-semibold text-ink-3">새 예상 종료</span>
            </button>
          </div>
        </div>
      ) : preDue ? (
        <div aria-label="시작 전 안전점검 안내" className="mt-3 rounded-2xl bg-white p-3.5 text-ink">
          <p className="flex items-center gap-1.5 text-[16.5px] font-extrabold text-primary-dark">
            <HardHat size={19} /> ① 시작 전 안전점검 → ② 작업 시작
          </p>
          <p className="mt-1 text-[15px] text-ink-2">안전모 · 안전화 착용과 작업구역 표시를 사진으로 먼저 남겨 주세요. 위험하면 작업하지 말고 관리자에게 바로 전화하세요.</p>
          <button onClick={() => onGo(cur.id, "safety", "작업 전")} className={cx(btn("primary", "md", true), "mt-2.5")}>
            <HardHat size={18} /> 시작 전 안전점검 하기
          </button>
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/10 px-3.5 py-2.5 text-[15.5px] font-semibold">{next}</p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={() => onGo(cur.id, "safety")} className={cx(quick, gap && "ring-2 ring-[#fde68a]")}>
          <HardHat size={22} /> 안전점검
          {gap && <span className="text-[12.5px] font-semibold text-[#fde68a]">{STAGE_LABEL[gap.stage]} {gap.state === "누락" ? "빠짐" : "차례"}</span>}
        </button>
        <button onClick={() => onGo(cur.id, "report")} className={`${quickBase} bg-white text-danger shadow-sm hover:bg-[#fff5f5]`}>
          <AlertTriangle size={22} /> 문제 보고
          <span className="text-[12.5px] font-semibold text-ink-3">· 지원 요청</span>
        </button>
        <button onClick={() => onGo(cur.id, "photo")} className={quick}>
          <Camera size={22} /> 사진 첨부
        </button>
      </div>
    </section>
  );
}

/** 안전 1순위 확인 — 작업 시작 · 종료 전에 그 단계 안전점검(착용 사진)을 먼저 권한다 */
/** 시작 전 점검(사진 있음) 가운데 마지막 것에 '미흡'이 남아 있고 아직 조치 완료 전인가 */
function openDeficiency(card: FieldCard): string[] | null {
  const pre = card.safety.filter((x) => x.c.stage === "작업 전" && hasLivePhoto(x.photos)).at(-1);
  return pre && pre.c.deficient.length > 0 && pre.c.review_status !== "조치 완료" ? pre.c.deficient : null;
}

function SafetyGate({ gate, onCheck, onSkip, onClose }: { gate: Gate; onCheck: () => void; onSkip: () => void; onClose: () => void }) {
  if (gate.kind === "deficient") {
    const items = (openDeficiency(gate.card) ?? []).map(itemLabel).join(", ");
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 sm:items-center" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label="안전점검 확인" className="w-full max-w-[34rem] rounded-[24px] bg-white p-5 shadow-[var(--shadow-modal)]" onClick={(e) => e.stopPropagation()}>
          <p className="flex items-center gap-2 text-[19px] font-extrabold text-danger">
            <HardHat size={22} /> 시작 전 점검에 &lsquo;미흡&rsquo;이 남아 있습니다
          </p>
          <p className="mt-1 text-[15px] font-semibold text-ink-3">{gate.card.siteName}</p>
          <p className="mt-3 text-[15.5px] text-ink-2">
            미흡: <b>{items}</b> — 본사 보완 확인(조치 완료) 전입니다. 보완하지 않고 시작하면 기록은 되지만 본사 화면에 미흡이 그대로 남습니다.
          </p>
          <p className="mt-2 rounded-xl bg-danger-bg px-3 py-2 text-[14.5px] font-semibold text-danger">위험하면 작업하지 말고 관리자 · 안전 책임자에게 바로 전화하세요. 이 화면은 알림을 기다리는 용도가 아닙니다.</p>
          <div className="mt-4 grid gap-2">
            <button onClick={onClose} className={btn("primary", "lg", true)}>
              작업 시작 안 함 (닫기)
            </button>
            <button onClick={onSkip} className={btn("ghost", "md", true)}>
              그래도 작업 시작
            </button>
          </div>
        </div>
      </div>
    );
  }
  const start = gate.kind === "start";
  const midMissing = !start && !gate.card.safety.some((x) => x.c.stage === "작업 중" && hasLivePhoto(x.photos));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="안전점검 확인" className="w-full max-w-[34rem] rounded-[24px] bg-white p-5 shadow-[var(--shadow-modal)]" onClick={(e) => e.stopPropagation()}>
        <p className="flex items-center gap-2 text-[19px] font-extrabold text-ink">
          <HardHat size={22} className="text-danger" /> {start ? "시작 전 안전점검을 먼저 보내 주세요" : "마무리 안전점검을 먼저 보내 주세요"}
        </p>
        <p className="mt-1 text-[15px] font-semibold text-ink-3">{gate.card.siteName}</p>
        <p className="mt-3 text-[15.5px] text-ink-2">
          {start
            ? "안전모 · 안전화 착용과 작업구역 표시를 사진으로 남긴 뒤 시작하세요. 점검 없이 시작하면 본사 화면에 '점검 전 작업 시작'으로 표시됩니다."
            : "장구를 착용한 채 마무리했는지 사진으로 남깁니다. 점검 없이 종료하면 본사 화면에 '마무리 점검 없이 종료'로 표시됩니다."}
          {midMissing && " 진행 중 점검도 아직 없습니다."}
        </p>
        <p className="mt-2 rounded-xl bg-danger-bg px-3 py-2 text-[14.5px] font-semibold text-danger">위험한 상황이면 작업을 멈추고 관리자 · 안전 책임자에게 바로 전화하세요.</p>
        <div className="mt-4 grid gap-2">
          <button onClick={onCheck} className={btn("primary", "lg", true)}>
            <HardHat size={19} /> {start ? "시작 전 점검 하기" : "마무리 점검 하기"}
          </button>
          <button onClick={onSkip} className={btn("ghost", "md", true)}>
            {start ? "점검 없이 시작" : "점검 없이 종료"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ items }: { items: { label: string; value: string; tone?: PillTone }[] }) {
  const color = (t?: PillTone) => (t === "danger" ? "text-danger" : t === "warning" ? "text-warning" : t === "success" ? "text-success" : t === "info" ? "text-primary" : "text-ink");
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="오늘 요약">
      {items.map((x) => (
        <div key={x.label} className="rounded-2xl bg-white px-2 py-3 text-center shadow-[var(--shadow-card)]">
          <p className={cx("text-[19px] leading-none font-extrabold tabular-nums", color(x.tone))}>{x.value}</p>
          <p className="mt-1.5 text-[13.5px] font-semibold text-ink-3">{x.label}</p>
        </div>
      ))}
    </div>
  );
}

/** 본사 메시지 · 안전 보완 요청 — 누르면 해당 현장 카드로 */
function Messages({
  openCases,
  supplements,
  missing,
  onGo,
}: {
  openCases: { card: FieldCard; x: FieldCase }[];
  supplements: { card: FieldCard; x: FieldSafety }[];
  missing: { card: FieldCard; stage: (typeof SAFETY_STAGES)[number] }[];
  onGo: (id: string, act: Focus["act"]) => void;
}) {
  const msgs = openCases.map(({ card, x }) => ({ card, x, last: adminSteps(x).at(-1) })).filter((m) => m.last);
  if (msgs.length === 0 && supplements.length === 0 && missing.length === 0) return null;
  return (
    <section aria-label="본사 메시지" className="space-y-2">
      <SectionHead title="본사에서 온 소식" count={msgs.length + supplements.length + missing.length} />
      <ul className="space-y-2">
        {missing.map(({ card, stage }) => (
          <li key={`${card.id}-${stage}`}>
            <button onClick={() => onGo(card.id, "safety")} className="flex w-full items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[var(--shadow-card)] ring-1 ring-warning/30">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-bg text-warning">
                <HardHat size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold text-warning">{card.siteName} · 안전점검 빠짐</span>
                <span className="block text-[15px] font-semibold text-ink">{STAGE_LABEL[stage]}(착용 사진)을 아직 보내지 않았습니다</span>
              </span>
            </button>
          </li>
        ))}
        {supplements.map(({ card, x }) => (
          <li key={x.c.id}>
            <button onClick={() => onGo(card.id, "safety")} className="flex w-full items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[var(--shadow-card)] ring-1 ring-danger/25">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger-bg text-danger">
                <HardHat size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold text-danger">{card.siteName} · 안전점검 보완 요청</span>
                <span className="block text-[15px] font-semibold text-ink">{x.reviews.filter((r) => r.source === "관리자" && r.message).at(-1)?.message ?? STAGE_LABEL[x.c.stage]}</span>
              </span>
            </button>
          </li>
        ))}
        {msgs.map(({ card, x, last }) => (
          <li key={x.c.id}>
            <button onClick={() => onGo(card.id, "view")} className="flex w-full items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[var(--shadow-card)]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Megaphone size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold text-ink-3">
                  {card.siteName} · {x.c.case_no} · {STATUS_TEXT[x.c.status]}
                </span>
                <span className="block text-[15px] font-semibold text-ink">
                  본사 {last!.kind}
                  {last!.action && ` — ${last!.action}`}
                  {last!.message && `: ${last!.message}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({
  c,
  index,
  current,
  date,
  today,
  pending,
  onTap,
  userId,
  scenario,
  focus,
}: {
  c: FieldCard;
  index: number;
  current: boolean;
  date: string;
  today: string;
  pending: QueuedEvent[];
  onTap: (t: Tap) => void;
  userId: string;
  scenario: boolean;
  focus: Focus | null;
}) {
  const [late, setLate] = useState(false);
  const [fix, setFix] = useState<string | null>(null);
  const { ackd, started, ended } = progress(c, pending);
  const isToday = date === today;
  const past = date < today;
  const active = c.status === "예정";
  const endActive = c.steps.some((s) => s.kind === "작업종료" && !s.replaced);
  const flow = [
    { k: "확인", on: ackd || started },
    { k: "시작", on: started },
    { k: "종료", on: ended },
  ];

  return (
    <section
      id={`card-${c.id}`}
      className={cx("card scroll-mt-20 space-y-4 p-4", c.status === "취소" && "opacity-60", current && "ring-2 ring-primary")}
      aria-label={`${c.siteName} 일정`}
    >
      <div className="flex items-start gap-3">
        <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold tabular-nums", ended ? "bg-success-bg text-success" : current ? "bg-primary text-white" : "bg-[#eef0f3] text-ink-2")}>
          {ended ? <CheckCircle2 size={18} /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] font-semibold text-ink-3 tabular-nums">
            {c.plannedStart} ~ {c.plannedEnd}
          </p>
          <h2 className="text-[21px] leading-tight font-extrabold">{c.siteName}</h2>
          {c.region && <p className="text-[15px] text-ink-3">{c.region}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill tone={PHASE_TONE[c.phase]}>{c.status === "취소" ? "취소된 일정" : c.phase}</Pill>
          {c.priority === "긴급" && <Pill tone="danger">긴급</Pill>}
        </div>
      </div>
      {(c.travelMinutes !== null || c.note) && (
        <p className="rounded-xl bg-[#f7f8fa] px-3 py-2 text-[15.5px] text-ink-2">
          {c.travelMinutes !== null && `이동 ${c.travelMinutes}분${c.travelFrom ? ` (${c.travelFrom}에서)` : ""}`}
          {c.travelMinutes !== null && c.note && " · "}
          {c.note}
        </p>
      )}

      {active && (
        <div className="flex items-center gap-1.5" aria-hidden>
          {flow.map((f, i) => (
            <div key={f.k} className="flex flex-1 items-center gap-1.5">
              <span className={cx("h-1.5 flex-1 rounded-full", f.on ? "bg-primary" : "bg-[#e4e7eb]")} />
              <span className={cx("text-[13.5px] font-bold", f.on ? "text-primary-dark" : "text-ink-3")}>{f.k}</span>
              {i < flow.length - 1 && <span className="w-0.5" />}
            </div>
          ))}
        </div>
      )}

      {/* 기록된 단계 */}
      {(c.steps.length > 0 || pending.length > 0) && (
        <ul className="space-y-2 rounded-2xl bg-[#f7f8fa] px-3.5 py-3" aria-label="기록된 단계">
          {c.steps.map((s) => (
            <li key={s.id} className={cx("text-[15.5px]", s.replaced && "text-ink-3 line-through")}>
              <span className="font-bold">{LABEL[s.kind]}</span>{" "}
              {s.kind === "예상 종료 보고" ? (
                <>
                  <b className="tabular-nums">{s.expectedEnd}</b> 종료 예상 <span className="text-ink-3">(보고 {s.time})</span>
                </>
              ) : (
                <b className="tabular-nums">{s.time}</b>
              )}{" "}
              <span className="text-[14.5px] text-ink-3">
                · {s.entryMode}
                {!s.mine && " · 관리자 입력"}
                {s.replaced && ` · ${s.replaced}됨`}
              </span>
              {s.mine && !s.replaced && active && s.kind !== "예상 종료 보고" && !(s.kind === "작업개시" && endActive) && (
                <span className="ml-1 inline-flex gap-1 no-underline">
                  <button onClick={() => setFix(fix === s.id ? null : s.id)} className="min-h-[2rem] rounded-lg bg-white px-2.5 text-[15px] font-bold text-primary-dark ring-1 ring-line">
                    시각 정정
                  </button>
                  <button onClick={() => onTap({ kind: "기록 무효", mode: "즉시", voidsEventId: s.id })} className="min-h-[2rem] rounded-lg bg-white px-2.5 text-[15px] font-bold text-danger ring-1 ring-line">
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
            <li key={x.opId} className="text-[15.5px]">
              <span className="font-bold">{x.voidsEventId ? (x.kind === "기록 무효" ? "기록 무효" : `${LABEL[x.kind]} 정정`) : LABEL[x.kind]}</span>{" "}
              {x.expectedEnd && <b className="tabular-nums">{x.expectedEnd} 종료 예상 </b>}
              {x.enteredTime && <b className="tabular-nums">{x.enteredTime} </b>}
              <Pill tone={x.stopped ? "danger" : "warning"}>{x.stopped ? "기록 안 됨" : `전송 대기 · ${kst(x.pressedAt).time} 누름`}</Pill>
            </li>
          ))}
        </ul>
      )}

      {/* 다음 할 일 */}
      {active && !ended && (
        <div className="space-y-2.5">
          {!ackd && !started && !past && (
            <button onClick={() => onTap({ kind: "업무 확인", mode: "즉시" })} className={btn("soft", "xl", true)}>
              <CheckCircle2 size={22} /> 업무 확인
            </button>
          )}
          {isToday && !started && (
            <button onClick={() => onTap({ kind: "작업개시", mode: "즉시" })} className={btn("primary", "xl", true)}>
              <PlayCircle size={24} /> 작업 시작
            </button>
          )}
          {isToday && started && (
            <>
              <TimeSend label="예상 종료 시각" defaultValue={c.plannedEnd} button="예상 종료 보내기" onSend={(t) => onTap({ kind: "예상 종료 보고", mode: "즉시", expectedEnd: t })} />
              <button onClick={() => onTap({ kind: "작업종료", mode: "즉시" })} className={btn("dark", "xl", true)}>
                <StopCircle size={24} /> 작업 종료
              </button>
            </>
          )}
        </div>
      )}

      {active && (isToday || past) && !ended && (
        <div>
          <button onClick={() => setLate((v) => !v)} aria-expanded={late} className="inline-flex min-h-[2.75rem] items-center gap-1.5 text-[15px] font-bold text-ink-3 underline underline-offset-4">
            <Clock size={17} /> 시각을 놓쳤어요 (사후 입력)
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

      {c.status === "예정" && (
        <div id={`safety-${c.id}`} className="scroll-mt-20">
          <SafetyPanel userId={userId} scheduleId={c.id} checks={c.safety} canCheck={active && isToday} openSignal={focus?.act === "safety" ? focus.n : 0} openStage={focus?.act === "safety" ? focus.stage : undefined} />
        </div>
      )}

      <CasePanel
        userId={userId}
        scenario={scenario}
        cases={c.cases}
        canReport={active && isToday}
        target={{ scheduleId: c.id, siteName: c.siteName, plannedEnd: c.plannedEnd, currentEnd: c.currentEnd, started }}
        focus={focus && (focus.act === "report" || focus.act === "photo") ? { act: focus.act, n: focus.n } : null}
      />
    </section>
  );
}

/** 문제 보고 탭 — 현장을 골라 보고 · 본사 조치 결과 확인 */
function ReportTab({ cards, isToday, userId, scenario, queue }: { cards: FieldCard[]; isToday: boolean; userId: string; scenario: boolean; queue: QueuedEvent[] }) {
  const list = cards.filter((c) => c.status === "예정" || c.cases.length > 0);
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[20px] font-extrabold">문제 보고 · 지원 요청</h2>
        <p className="text-[15.5px] text-ink-3">문제가 생긴 현장에서 보고하세요. 단계대로 고르기만 하면 됩니다. 본사 조치 결과도 여기서 봅니다.</p>
      </div>
      {list.length === 0 ? (
        <Empty icon={<AlertTriangle size={22} />} title="보고할 현장이 없습니다." />
      ) : (
        list.map((c) => {
          const p = progress(c, queue);
          return (
            <section key={c.id} aria-label={`${c.siteName} 문제·지원`} className="card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink-3 tabular-nums">
                    {c.plannedStart} ~ {c.plannedEnd}
                  </p>
                  <p className="truncate text-[18px] font-extrabold">{c.siteName}</p>
                </div>
                <Pill tone={PHASE_TONE[c.phase]}>{c.status === "취소" ? "취소된 일정" : c.phase}</Pill>
              </div>
              <CasePanel
                userId={userId}
                scenario={scenario}
                cases={c.cases}
                canReport={c.status === "예정" && isToday}
                target={{ scheduleId: c.id, siteName: c.siteName, plannedEnd: c.plannedEnd, currentEnd: c.currentEnd, started: p.started }}
                focus={null}
              />
              {c.cases.length === 0 && !(c.status === "예정" && isToday) && <p className="text-[15px] text-ink-3">보고 기록이 없습니다.</p>}
            </section>
          );
        })
      )}
    </div>
  );
}

/** 안전점검 탭 — 현장별 시작 전 · 진행 중 · 마친 뒤 점검 */
function SafetyTab({ cards, isToday, userId }: { cards: FieldCard[]; isToday: boolean; userId: string }) {
  const done = cards.reduce((n, c) => n + new Set(c.safety.map((s) => s.c.stage)).size, 0);
  const total = cards.length * SAFETY_STAGES.length;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[20px] font-extrabold">안전점검</h2>
        <p className="text-[15.5px] text-ink-3">현장마다 시작 전 · 진행 중 · 마친 뒤 착용 사진을 보내 주세요. 관리자가 사진을 눈으로 확인합니다.</p>
      </div>
      {total > 0 && (
        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[15.5px] font-bold text-ink-2">오늘 점검 진행</p>
            <p className="text-[20px] font-extrabold text-primary tabular-nums">
              {done}/{total}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef0f3]">
            <div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
        </div>
      )}
      {cards.length === 0 ? (
        <Empty icon={<HardHat size={22} />} title="점검할 현장이 없습니다." />
      ) : (
        cards.map((c) => (
          <section key={c.id} aria-label={`${c.siteName} 안전`} className="card space-y-3 p-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink-3 tabular-nums">
                {c.plannedStart} ~ {c.plannedEnd}
              </p>
              <p className="truncate text-[18px] font-extrabold">{c.siteName}</p>
            </div>
            <SafetyPanel userId={userId} scheduleId={c.id} checks={c.safety} canCheck={isToday} openSignal={0} />
          </section>
        ))
      )}
    </div>
  );
}

/** 내 기록 탭 — 오늘 남긴 기록 · 보고 · 점검 · 의견 보내기 */
function RecordsTab({ cards }: { cards: FieldCard[] }) {
  const steps = cards
    .flatMap((c) => c.steps.map((s) => ({ c, s })))
    .sort((a, b) => (a.s.time < b.s.time ? -1 : a.s.time > b.s.time ? 1 : 0));
  const cases = cards.flatMap((c) => c.cases.map((x) => ({ c, x })));
  const checks = cards.flatMap((c) => c.safety.map((x) => ({ c, x })));
  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-label="내가 남긴 기록">
        <SectionHead title="내가 남긴 기록" count={steps.length} />
        {steps.length === 0 ? (
          <Empty icon={<ClipboardList size={22} />} title="아직 남긴 기록이 없습니다." />
        ) : (
          <ol className="card divide-y divide-line px-4">
            {steps.map(({ c, s }) => (
              <li key={s.id} className={cx("flex items-start gap-3 py-3", s.replaced && "text-ink-3 line-through")}>
                <span className="w-12 shrink-0 text-[15px] font-extrabold tabular-nums">{s.time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">
                    {c.siteName} · {LABEL[s.kind]}
                    {s.kind === "예상 종료 보고" && s.expectedEnd && ` ${s.expectedEnd}`}
                  </span>
                  <span className="block text-[14px] text-ink-3">
                    {s.entryMode} · 서버 기록 {s.recordedAt}
                    {!s.mine && " · 관리자 입력"}
                    {s.replaced && ` · ${s.replaced}됨`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-2" aria-label="내 문제 보고">
        <SectionHead title="문제 보고" count={cases.length} />
        {cases.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-[15.5px] text-ink-3">보고한 문제가 없습니다.</p>
        ) : (
          <ul className="card divide-y divide-line px-4">
            {cases.map(({ c, x }) => (
              <li key={x.c.id} className="flex items-center justify-between gap-2 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">
                    {c.siteName} · {x.c.issue_type}
                  </span>
                  <span className="block text-[14px] text-ink-3 tabular-nums">{x.c.case_no}</span>
                </span>
                <Pill tone={isOpen(x.c) ? "warning" : x.c.status === "해결" ? "success" : "neutral"}>{STATUS_TEXT[x.c.status]}</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-label="내 안전점검">
        <SectionHead title="안전점검" count={checks.length} />
        {checks.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-[15.5px] text-ink-3">제출한 점검이 없습니다.</p>
        ) : (
          <ul className="card divide-y divide-line px-4">
            {checks.map(({ c, x }) => (
              <li key={x.c.id} className="flex items-center justify-between gap-2 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">
                    {c.siteName} · {STAGE_LABEL[x.c.stage]}
                  </span>
                  <span className="block text-[14px] text-ink-3 tabular-nums">
                    {x.c.check_no} · {kst(x.c.recorded_at).time} 제출
                  </span>
                </span>
                <Pill tone={x.c.review_status === "보완 요청" ? "danger" : x.c.review_status === "확인 대기" ? "warning" : x.c.review_status === "보완 제출" ? "info" : "success"}>{x.c.review_status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>

      <More summary="기록 시각은 어떻게 남나요?">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>즉시 기록</b>: 버튼을 누른 그 시각이 실제 시각입니다. 서버에 저장된 시각(서버 기록)도 함께 남습니다.
          </li>
          <li>
            <b>지연 전송</b>: 연결이 끊겨 늦게 도착한 기록입니다. 휴대폰에서 누른 시각으로 기록됩니다.
          </li>
          <li>
            <b>사후 입력</b>: 시각을 놓쳐 나중에 넣은 기록입니다. 즉시 기록과 구분해 표시됩니다.
          </li>
          <li>잘못 누른 기록은 지우지 않고 &lsquo;무효&rsquo; 또는 &lsquo;정정&rsquo; 기록을 덧붙입니다.</li>
        </ul>
      </More>

      <FeedbackForm />
    </div>
  );
}

function TimeSend({ label, defaultValue, button, onSend }: { label: string; defaultValue: string; button: string; onSend: (t: string) => void }) {
  const [t, setT] = useState(defaultValue);
  return (
    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 no-underline">
      <label className="block min-w-0">
        <span className="mb-1 block text-[15px] font-bold text-ink-3">{label}</span>
        <input type="time" value={t} onChange={(e) => setT(e.target.value)} className="min-h-[3.25rem] w-full rounded-2xl bg-white px-3 text-[19px] tabular-nums ring-1 ring-line outline-none focus:ring-2 focus:ring-primary" />
      </label>
      <button onClick={() => /^\d{2}:\d{2}$/.test(t) && onSend(t)} className={btn("soft", "lg")}>
        <Send size={17} /> {button}
      </button>
    </div>
  );
}

function LateEntry({ steps, onSend }: { steps: PilotEventKind[]; onSend: (k: PilotEventKind, t: string) => void }) {
  const [picked, setKind] = useState<PilotEventKind>(steps[0]);
  const [t, setT] = useState("");
  if (steps.length === 0) return null;
  // 입력 칸을 연 뒤 앞 기록이 반영되면 고를 수 있는 단계가 바뀐다 — 보이지 않는 단계로 보내지 않게 지금 목록에 있는 단계만 쓴다
  const kind = steps.includes(picked) ? picked : steps[0];
  return (
    <div className="mt-2 space-y-3 rounded-2xl bg-[#f7f8fa] p-3.5">
      <p className="text-[15.5px] text-ink-2">실제로 있었던 시각을 넣으세요. &lsquo;사후 입력&rsquo;으로 표시되어 즉시 기록과 구분됩니다.</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="사후 입력할 단계">
        {steps.map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={cx("min-h-[2.75rem] rounded-xl px-3.5 text-[15.5px] font-bold", kind === k ? "bg-ink text-white" : "bg-white text-ink-2 ring-1 ring-line")}>
            {LABEL[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-[15px] font-bold text-ink-3">실제 시각</span>
          <input type="time" value={t} onChange={(e) => setT(e.target.value)} aria-label="실제 시각" className="min-h-[3.25rem] w-full rounded-2xl bg-white px-3 text-[19px] ring-1 ring-line outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <button disabled={!/^\d{2}:\d{2}$/.test(t)} onClick={() => onSend(kind, t)} className={btn("primary", "lg")}>
          <Send size={17} /> 사후 입력으로 보내기
        </button>
      </div>
    </div>
  );
}

