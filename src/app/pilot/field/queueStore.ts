"use client";

/**
 * 전송 대기열 보관소 — 메모리에 두고 브라우저 저장소(localStorage)에 같이 써 둔다.
 * 저장소를 못 쓰는 브라우저(개인정보 보호 모드 등)에서도 화면이 열려 있는 동안은 메모리로 동작한다.
 * 다른 탭에서 바뀌면(storage 이벤트) 다시 읽는다. React 는 useSyncExternalStore 로 구독한다.
 */
import { loadQueue, saveQueue, type KeyValueStore, type QueuedEvent } from "@/lib/pilot/queue";

const listeners = new Set<() => void>();
const memory = new Map<string, QueuedEvent[]>();
let storable = true;
const EMPTY: QueuedEvent[] = [];

function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getQueue(userId: string): QueuedEvent[] {
  let q = memory.get(userId);
  if (!q) {
    q = loadQueue(storage(), userId);
    memory.set(userId, q);
  }
  return q;
}

export function setQueue(userId: string, items: QueuedEvent[]) {
  memory.set(userId, items);
  storable = saveQueue(storage(), userId, items);
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("hana-ax-pilot-queue:")) {
      memory.clear();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const serverSnapshot = () => EMPTY;
/** 마지막 저장이 브라우저 저장소에 들어갔는지 */
export const isStorable = () => storable;
