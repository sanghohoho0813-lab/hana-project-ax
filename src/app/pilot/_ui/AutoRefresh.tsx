"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, WifiOff } from "lucide-react";
import { connSummary, initialConn, nextConn, type ConnState } from "@/lib/pilot/connection";
import { cx } from "./ds";

/** 사용자가 누르거나 입력한 뒤 이 시간 동안은 다시 읽지 않는다 — 입력 중인 화면을 흔들지 않게 */
const QUIET_MS = 8000;
/** 바뀐 것이 없어도 이 간격마다 한 번은 다시 읽는다 (안전망) */
const FULL_MS = 60_000;
/** 변경 확인 요청이 이 시간 안에 답이 없으면 실패로 본다 */
const TIMEOUT_MS = 8000;

/**
 * 주기적 자동 갱신 — 화면이 보일 때 '변경 확인'(/pilot/changes)만 가볍게 묻고,
 * 다른 기기에서 기록이 바뀌었을 때만 서버에서 화면 자료를 다시 읽는다 (실시간 수신 대신 안정적인 주기 확인).
 * 저장 직후 이전 자료로 화면을 덮는 경합을 줄이고, 놓친 변경은 다음 확인에서 다시 맞춘다.
 *
 * 0.6.1 안정화: 확인 실패를 숨기지 않는다.
 *   - 연결 끊김 · 서버 확인 실패 · 로그인 만료를 구분해 보여 주고, 마지막 정상 확인 시각을 함께 적는다.
 *   - '지금 확인'으로 바로 다시 읽을 수 있다 (입력 보호 시간과 상관없이 — 사용자가 직접 누른 경우).
 *   - 주기 확인이라는 한계를 문장에 그대로 둔다 (실시간 감시라고 쓰지 않음).
 */
export function AutoRefresh({ seconds, label = "자동 갱신" }: { seconds: number; label?: string }) {
  const router = useRouter();
  const [conn, setConn] = useState<ConnState>(initialConn);
  // 처음 그릴 때는 시각을 쓰지 않는다 (서버 · 브라우저 시각이 달라 화면 불일치 오류가 나지 않게)
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const state = useRef({ lastActive: 0, seen: null as string | null, lastFull: 0, busy: false });

  /** 변경 확인 한 번 — 결과(ok/offline/error/auth)와 받은 값 */
  const check = useCallback(async (): Promise<{ result: "ok" | "offline" | "error" | "auth"; v: string | null }> => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { result: "offline", v: null };
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch("/pilot/changes", { cache: "no-store", signal: ctl.signal });
      if (r.status === 401) return { result: "auth", v: null };
      if (!r.ok) return { result: "error", v: null };
      const v = ((await r.json()) as { v: string | null }).v;
      return v === null ? { result: "error", v: null } : { result: "ok", v };
    } catch {
      return { result: navigator.onLine === false ? "offline" : "error", v: null };
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const st = state.current;
    st.lastFull = Date.now();
    const active = () => (st.lastActive = Date.now());
    const tick = async () => {
      if (st.busy || document.visibilityState !== "visible" || Date.now() - st.lastActive < QUIET_MS) return;
      st.busy = true;
      try {
        const { result, v } = await check();
        const at = Date.now();
        setConn((c) => nextConn(c, result, at));
        setNow(at);
        if (result !== "ok" || v === null) return;
        if (st.seen === null) {
          st.seen = v;
          return;
        }
        if (v === st.seen && at - st.lastFull <= FULL_MS) return;
        // 확인하는 사이 사용자가 입력을 시작했으면 다음 확인으로 미룬다 (본 값으로 치지 않음)
        if (Date.now() - st.lastActive < QUIET_MS) return;
        st.seen = v;
        st.lastFull = Date.now();
        router.refresh();
      } finally {
        st.busy = false;
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), seconds * 1000);
    // 문장의 '몇 분 전'을 맞추고, 확인이 오래 안 되면 '늦어짐'을 보이게 한다
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    const onOnline = () => void tick();
    const onOffline = () => setConn((c) => nextConn(c, "offline", Date.now()));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    for (const ev of ["pointerdown", "keydown", "input"]) document.addEventListener(ev, active, { capture: true, passive: true });
    return () => {
      window.clearInterval(t);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      for (const ev of ["pointerdown", "keydown", "input"]) document.removeEventListener(ev, active, { capture: true });
    };
  }, [router, seconds, check]);

  /** '지금 확인' — 사용자가 직접 누른 경우라 입력 보호 시간을 기다리지 않고 확인 · 다시 읽기 */
  const manual = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { result, v } = await check();
      const at = Date.now();
      setConn((c) => nextConn(c, result, at));
      setNow(at);
      if (result === "ok") {
        if (v) state.current.seen = v;
        state.current.lastFull = at;
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const s = connSummary(conn, now, seconds, label);
  const bad = s.tone !== "ok";
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 print:hidden" data-auto-refresh={seconds} data-conn={conn.kind}>
      <span
        role={bad ? "status" : undefined}
        aria-live={bad ? "polite" : "off"}
        title="주기 확인입니다 (실시간 감시 아님)"
        className={cx(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[14px] font-semibold",
          s.tone === "danger" ? "bg-danger-bg text-danger" : s.tone === "warn" ? "bg-warning-bg text-warning" : "bg-[#f2f4f6] text-ink-3",
        )}
      >
        {bad ? <WifiOff size={13} /> : <RefreshCw size={13} />} {s.text}
      </span>
      {conn.kind === "auth" ? (
        <a href="/pilot/login" className="rounded-full bg-white px-2.5 py-0.5 text-[14px] font-bold text-primary ring-1 ring-line">
          다시 로그인
        </a>
      ) : (
        <button type="button" onClick={() => void manual()} disabled={busy} className="rounded-full bg-white px-2.5 py-0.5 text-[14px] font-bold text-primary ring-1 ring-line disabled:opacity-50">
          {busy ? "확인 중…" : "지금 확인"}
        </button>
      )}
      {s.detail && <span className="basis-full text-[13.5px] leading-snug text-ink-3">{s.detail}</span>}
    </span>
  );
}
