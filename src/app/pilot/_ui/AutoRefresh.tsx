"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { kst } from "@/lib/pilot/time";

/**
 * 주기적 자동 갱신 — 화면이 보일 때만 서버에서 다시 읽는다 (실시간 수신 대신 안정적인 주기 갱신).
 * 입력 중인 내용은 그대로 남는다 (화면 상태를 지우지 않고 서버 자료만 새로 받음).
 */
export function AutoRefresh({ seconds, label = "자동 갱신" }: { seconds: number; label?: string }) {
  const router = useRouter();
  // 처음 그릴 때는 시각을 넣지 않는다 (서버·브라우저 시각이 달라 화면 불일치 오류가 나지 않게)
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLast(kst(new Date()).seconds);
    };
    const t = window.setInterval(tick, seconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f6] px-2.5 py-0.5 text-[14px] font-semibold text-ink-3 print:hidden" aria-live="off" data-auto-refresh={seconds}>
      <RefreshCw size={13} /> {label} {seconds}초 · {last ? `마지막 ${last}` : "켜짐"}
    </span>
  );
}
