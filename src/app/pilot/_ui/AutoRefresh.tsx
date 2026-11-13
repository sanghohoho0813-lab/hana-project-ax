"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { kst } from "@/lib/pilot/time";

/** 사용자가 누르거나 입력한 뒤 이 시간 동안은 다시 읽지 않는다 — 입력 중인 화면을 흔들지 않게 */
const QUIET_MS = 8000;
/** 바뀐 것이 없어도 이 간격마다 한 번은 다시 읽는다 (안전망) */
const FULL_MS = 60_000;

/**
 * 주기적 자동 갱신 — 화면이 보일 때 '변경 확인'(/pilot/changes)만 가볍게 묻고,
 * 다른 기기에서 기록이 바뀌었을 때만 서버에서 화면 자료를 다시 읽는다 (실시간 수신 대신 안정적인 주기 확인).
 * 저장 직후 이전 자료로 화면을 덮는 경합을 줄이고, 놓친 변경은 다음 확인에서 다시 맞춘다.
 */
export function AutoRefresh({ seconds, label = "자동 갱신" }: { seconds: number; label?: string }) {
  const router = useRouter();
  // 처음 그릴 때는 시각을 넣지 않는다 (서버·브라우저 시각이 달라 화면 불일치 오류가 나지 않게)
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    let lastActive = 0;
    let seen: string | null = null;
    let lastFull = Date.now();
    let busy = false;
    const active = () => (lastActive = Date.now());
    const tick = async () => {
      if (busy || document.visibilityState !== "visible" || Date.now() - lastActive < QUIET_MS) return;
      busy = true;
      try {
        const r = await fetch("/pilot/changes", { cache: "no-store" });
        const v = r.ok ? ((await r.json()) as { v: string | null }).v : null;
        if (v === null) return;
        if (seen === null) {
          seen = v;
          return;
        }
        if (v === seen && Date.now() - lastFull <= FULL_MS) return;
        // 확인하는 사이 사용자가 입력을 시작했으면 다음 확인으로 미룬다 (본 값으로 치지 않음)
        if (Date.now() - lastActive < QUIET_MS) return;
        seen = v;
        lastFull = Date.now();
        router.refresh();
        setLast(kst(new Date()).seconds);
      } catch {
        // 연결이 끊기면 다음 확인에서 다시 묻는다
      } finally {
        busy = false;
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), seconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    for (const ev of ["pointerdown", "keydown", "input"]) document.addEventListener(ev, active, { capture: true, passive: true });
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      for (const ev of ["pointerdown", "keydown", "input"]) document.removeEventListener(ev, active, { capture: true });
    };
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f6] px-2.5 py-0.5 text-[14px] font-semibold text-ink-3 print:hidden" aria-live="off" data-auto-refresh={seconds}>
      <RefreshCw size={13} /> {label} {seconds}초 확인 · {last ? `마지막 갱신 ${last}` : "켜짐"}
    </span>
  );
}
