"use client";

/**
 * 로컬 실증 기록 보관소 — 이 브라우저의 localStorage 한 칸에 전체를 JSON 으로 둔다.
 *
 * - 같은 브라우저의 PC 화면과 모바일 화면(같은 앱을 iframe 으로 띄운 것)은 같은 저장소를 쓴다 (Same Data).
 *   다른 화면이 저장하면 storage 이벤트로 다시 읽는다. 받는 쪽은 다시 쓰지 않으므로 동기화가 반복되지 않는다.
 * - 저장할 때마다 저장소의 최신 값을 다시 읽고 바꾼 뒤 쓴다 — 두 화면이 서로의 기록을 덮어쓰지 않는다.
 * - 저장에 실패하면(저장공간 부족 등) 화면 상태를 바꾸지 않고 오류를 알린다.
 * - 중앙 DB 가 아니다. 다른 기기·다른 브라우저와는 공유되지 않는다.
 */
import { useCallback, useSyncExternalStore } from "react";
import { newOpId } from "@/lib/pilot/op-id";
import { emptyState, LabError, type Ctx, type LabState } from "./model";

export const LAB_KEY = "hana-ax-lab:v1";
export const LAB_BEFORE_IMPORT_KEY = "hana-ax-lab:v1:before-import";
export const LAB_DAMAGED_KEY = "hana-ax-lab:v1:damaged";
/** 이 크기를 넘으면 경고 (브라우저 한도는 보통 5MB 안팎) */
export const WARN_BYTES = 3_500_000;

export interface LabSnapshot {
  state: LabState | null;
  /** 저장된 기록을 읽지 못함 (손상) */
  loadError: string | null;
  /** 마지막 저장 실패 */
  saveError: string | null;
  bytes: number;
  /** 브라우저 저장소를 쓸 수 없음 (개인정보 보호 모드 등) */
  unavailable: boolean;
}

const listeners = new Set<() => void>();
let snap: LabSnapshot | null = null;
const SERVER: LabSnapshot = { state: null, loadError: null, saveError: null, bytes: 0, unavailable: false };

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem(LAB_KEY);
    return s;
  } catch {
    return null;
  }
}

function read(): LabSnapshot {
  const st = storage();
  if (!st) return { state: emptyState(new Date()), loadError: null, saveError: "이 브라우저에서는 기록을 저장할 수 없습니다 (개인정보 보호 모드 등). 화면을 닫으면 사라집니다.", bytes: 0, unavailable: true };
  const raw = st.getItem(LAB_KEY);
  if (!raw) return { state: emptyState(new Date()), loadError: null, saveError: snap?.saveError ?? null, bytes: 0, unavailable: false };
  try {
    const state = JSON.parse(raw) as LabState;
    if (state.format !== "hana-ax-lab" || state.version !== 1) throw new Error("형식");
    return { state, loadError: null, saveError: snap?.saveError ?? null, bytes: raw.length * 2, unavailable: false };
  } catch {
    return { state: null, loadError: "저장된 실증 기록을 읽을 수 없습니다 (손상). 백업 JSON 을 불러오거나, 손상된 원문을 내려받은 뒤 새로 시작하세요.", saveError: null, bytes: raw.length * 2, unavailable: false };
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LAB_KEY || e.key === null) {
      snap = read();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): LabSnapshot {
  if (!snap) snap = read();
  return snap;
}
export const getServerSnapshot = () => SERVER;

const isQuota = (e: unknown) => e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22 || e.name === "NS_ERROR_DOM_QUOTA_REACHED");

/** 바꾸기 — 최신 저장값을 읽어 change 를 적용하고 저장한다. 실패하면 상태를 바꾸지 않고 오류를 돌려준다 */
export function commit<T>(change: (s: LabState, ctx: Ctx) => { state: LabState; value: T }): { ok: true; value: T } | { ok: false; error: string } {
  const fresh = read();
  if (!fresh.state) return { ok: false, error: fresh.loadError ?? "저장된 기록을 읽을 수 없습니다." };
  let out: { state: LabState; value: T };
  try {
    out = change(fresh.state, { now: new Date(), id: newOpId });
  } catch (e) {
    if (e instanceof LabError) return { ok: false, error: e.message };
    return { ok: false, error: `처리하지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (out.state === fresh.state) {
    snap = fresh;
    emit();
    return { ok: true, value: out.value };
  }
  const text = JSON.stringify(out.state);
  const st = storage();
  if (!st) {
    snap = { ...fresh, state: out.state, unavailable: true, saveError: "이 브라우저에서는 기록을 저장할 수 없습니다 (개인정보 보호 모드 등). 화면을 닫으면 사라집니다. 지금 JSON 백업을 받으세요." };
    emit();
    return { ok: true, value: out.value };
  }
  try {
    st.setItem(LAB_KEY, text);
  } catch (e) {
    const msg = isQuota(e)
      ? "저장 실패 — 브라우저 저장공간이 부족합니다. 방금 입력은 저장되지 않았습니다. 지금 JSON 백업을 받은 뒤 오래된 시험을 정리하세요."
      : "저장 실패 — 방금 입력은 저장되지 않았습니다.";
    snap = { ...fresh, saveError: msg };
    emit();
    return { ok: false, error: msg };
  }
  snap = { state: out.state, loadError: null, saveError: null, bytes: text.length * 2, unavailable: false };
  emit();
  return { ok: true, value: out.value };
}

/** 백업 불러오기 — 지금 기록은 따로 한 칸에 남겨 둔다(공간이 있으면) */
export function replaceAll(next: LabState): { ok: true; keptPrevious: boolean } | { ok: false; error: string } {
  const st = storage();
  if (!st) return { ok: false, error: "이 브라우저에서는 저장할 수 없습니다." };
  let keptPrevious = false;
  const prev = st.getItem(LAB_KEY);
  if (prev) {
    try {
      st.setItem(LAB_BEFORE_IMPORT_KEY, prev);
      keptPrevious = true;
    } catch {
      keptPrevious = false;
    }
  }
  try {
    const text = JSON.stringify(next);
    st.setItem(LAB_KEY, text);
    snap = { state: next, loadError: null, saveError: null, bytes: text.length * 2, unavailable: false };
    emit();
    return { ok: true, keptPrevious };
  } catch (e) {
    return { ok: false, error: isQuota(e) ? "저장공간이 부족해 불러오지 못했습니다." : "불러오지 못했습니다." };
  }
}

/** 손상된 기록을 옆 칸으로 옮기고 새로 시작 */
export function resetDamaged(): void {
  const st = storage();
  if (!st) return;
  const raw = st.getItem(LAB_KEY);
  if (raw) {
    try {
      st.setItem(LAB_DAMAGED_KEY, raw);
    } catch {
      // 공간이 없으면 옮기지 못함 — 화면에서 원문 내려받기를 먼저 안내한다
    }
  }
  st.removeItem(LAB_KEY);
  snap = read();
  emit();
}

export function rawStored(): string {
  return storage()?.getItem(LAB_KEY) ?? "";
}

export function useLab(): LabSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ── 이 브라우저 설정 (기록 아님) ──────────────────── */

const prefListeners = new Set<() => void>();
const prefCache = new Map<string, string | null>();

function prefSubscribe(l: () => void) {
  prefListeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("hana-ax-pref:") || e.key === null) {
      prefCache.clear();
      prefListeners.forEach((x) => x());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    prefListeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

function prefGet(key: string): string | null {
  if (!prefCache.has(key)) {
    let v: string | null = null;
    try {
      v = window.localStorage.getItem(`hana-ax-pref:${key}`);
    } catch {
      v = null;
    }
    prefCache.set(key, v);
  }
  return prefCache.get(key) ?? null;
}

export function setPref(key: string, value: string) {
  try {
    window.localStorage.setItem(`hana-ax-pref:${key}`, value);
  } catch {
    // 설정은 못 남겨도 화면은 동작
  }
  prefCache.set(key, value);
  prefListeners.forEach((x) => x());
}

/** 화면 설정(입력자·보기 방식 등) — 같은 브라우저의 모든 화면이 공유 */
export function usePref(key: string, fallback: string): [string, (v: string) => void] {
  const v = useSyncExternalStore(
    prefSubscribe,
    () => prefGet(key) ?? fallback,
    () => fallback,
  );
  return [v, useCallback((x: string) => setPref(key, x), [key])];
}
