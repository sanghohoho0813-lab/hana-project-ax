/**
 * 현장 기록 전송 대기열 — 휴대폰(브라우저 저장소)에 보관했다가 순서대로 보낸다.
 *
 * - 버튼을 누르면 먼저 대기열에 넣고(누른 시각 = 기기 기준 pressedAt) 바로 보낸다.
 * - 연결이 끊기면 남겨 두고 다시 보낸다. 요청 번호(opId)가 같으므로 DB 에는 한 번만 기록된다.
 * - 실제 발생시각은 서버가 '서버 수신 시각 − (보낸 시각 − 누른 시각)'으로 정한다 (기기 시계가 틀려도 영향 없음).
 * - 다시 보내도 결과가 같은 오류(권한·입력 검사 등)는 자동 재시도를 멈추고 사용자에게 보여 준다.
 * 순수 함수 — 저장소는 인자로 받는다 (브라우저: localStorage, 시험: Map).
 */
import type { PilotEventKind } from "./core";

export interface QueuedEvent {
  opId: string;
  scheduleId: string;
  siteName: string;
  kind: PilotEventKind;
  mode: "즉시" | "사후";
  /** 사후 입력 시각 HH:MM */
  enteredTime?: string;
  /** 예상 종료 보고 시각 HH:MM */
  expectedEnd?: string;
  /** 정정·무효 대상 기록 */
  voidsEventId?: string;
  /** 기기에서 누른 시각 (ISO, 기기 시계) */
  pressedAt: string;
  tries: number;
  lastTriedAt?: string;
  lastError?: string;
  /** 다시 보내도 같은 결과인 오류 — 자동 재시도 멈춤 */
  stopped?: boolean;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const queueKey = (userId: string) => `hana-ax-pilot-queue:${userId}`;

const KINDS: PilotEventKind[] = ["업무 확인", "작업개시", "예상 종료 보고", "작업종료", "기록 무효"];

function valid(x: unknown): x is QueuedEvent {
  if (!x || typeof x !== "object") return false;
  const q = x as QueuedEvent;
  return (
    typeof q.opId === "string" &&
    typeof q.scheduleId === "string" &&
    KINDS.includes(q.kind) &&
    (q.mode === "즉시" || q.mode === "사후") &&
    typeof q.pressedAt === "string" &&
    !Number.isNaN(Date.parse(q.pressedAt))
  );
}

export function loadQueue(store: KeyValueStore | null | undefined, userId: string): QueuedEvent[] {
  try {
    const raw = store?.getItem(queueKey(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(valid) : [];
  } catch {
    return [];
  }
}

export function saveQueue(store: KeyValueStore | null | undefined, userId: string, items: QueuedEvent[]): boolean {
  try {
    store?.setItem(queueKey(userId), JSON.stringify(items));
    return !!store;
  } catch {
    return false;
  }
}

export function enqueue(items: QueuedEvent[], item: Omit<QueuedEvent, "tries">): QueuedEvent[] {
  if (items.some((x) => x.opId === item.opId)) return items;
  return [...items, { ...item, tries: 0 }];
}

/** 보낼 차례 — 멈춘 항목은 건너뛰고 들어온 순서대로 */
export function nextToSend(items: QueuedEvent[]): QueuedEvent | undefined {
  return items.find((x) => !x.stopped);
}

export type SendOutcome = { ok: true } | { ok: false; error: string; retry: boolean };

export function applyOutcome(items: QueuedEvent[], opId: string, outcome: SendOutcome, at: string): QueuedEvent[] {
  if (outcome.ok) return items.filter((x) => x.opId !== opId);
  return items.map((x) =>
    x.opId === opId ? { ...x, tries: x.tries + 1, lastTriedAt: at, lastError: outcome.error, stopped: !outcome.retry } : x,
  );
}

export function removeItem(items: QueuedEvent[], opId: string): QueuedEvent[] {
  return items.filter((x) => x.opId !== opId);
}

/**
 * 대기열을 순서대로 보낸다. 연결 문제(재시도 가능)가 나면 그 자리에서 멈춘다 (뒤 기록이 앞 기록을 앞지르지 않게).
 * 보내는 동안 새로 누른 기록도 잃지 않도록 매번 지금 대기열(get)을 읽고 결과를 반영(set)한다.
 * send 는 보내는 순간의 기기 시각(sentAt)을 함께 넘긴다.
 */
export async function flushQueue(
  get: () => QueuedEvent[],
  set: (items: QueuedEvent[]) => void,
  send: (item: QueuedEvent, sentAt: string) => Promise<SendOutcome>,
  now: () => Date = () => new Date(),
): Promise<void> {
  const tried = new Set<string>();
  for (;;) {
    const item = get().find((x) => !x.stopped && !tried.has(x.opId));
    if (!item) return;
    tried.add(item.opId);
    let outcome: SendOutcome;
    try {
      outcome = await send(item, now().toISOString());
    } catch {
      outcome = { ok: false, error: "서버에 연결하지 못했습니다.", retry: true };
    }
    set(applyOutcome(get(), item.opId, outcome, now().toISOString()));
    if (!outcome.ok && outcome.retry) return;
  }
}
