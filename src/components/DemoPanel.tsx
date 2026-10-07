"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageSquareQuote, MousePointerClick, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { MANAGER_ID, TOUR_STEPS } from "@/lib/demo-tour";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 실사 시연 라이브 투어 — 실제 화면 위에 강조 영역과 설명 카드를 띄운다 */
export function DemoPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { demoMode, setDemoMode, demoStep, setDemoStep, currentUserId, setCurrentUserId } = useApp();
  const [rect, setRect] = useState<Rect | null>(null);

  const step = TOUR_STEPS[Math.min(demoStep, TOUR_STEPS.length - 1)];
  const last = demoStep >= TOUR_STEPS.length - 1;

  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(TOUR_STEPS.length - 1, n));
      setDemoStep(next);
      router.push(TOUR_STEPS[next].href);
    },
    [router, setDemoStep],
  );

  const finish = useCallback(() => {
    setDemoMode(false);
    setCurrentUserId(MANAGER_ID);
    router.push("/demo#roadmap");
  }, [router, setCurrentUserId, setDemoMode]);

  // 이 단계에서 보여줄 사용자로 전환
  useEffect(() => {
    if (demoMode && step.as && currentUserId !== step.as) setCurrentUserId(step.as);
  }, [demoMode, step, currentUserId, setCurrentUserId]);

  // 강조할 요소 위치를 따라간다 (화면 전환·스크롤·크기 변경)
  useEffect(() => {
    if (!demoMode || !step.target) return;
    let scrolled = false;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect((r) => (r ? null : r));
        return;
      }
      if (!scrolled) {
        // 화면보다 큰 영역은 머리부터 보이게
        const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
        (el as HTMLElement).style.scrollMarginTop = tall ? "11rem" : "";
        el.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "center" });
        scrolled = true;
      }
      // 글자 크기 설정(zoom)을 반영한 화면 좌표
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom || "1") || 1;
      const b = el.getBoundingClientRect();
      const next = { x: b.left / zoom, y: b.top / zoom, w: b.width / zoom, h: b.height / zoom };
      setRect((r) =>
        r && Math.abs(r.x - next.x) < 1 && Math.abs(r.y - next.y) < 1 && Math.abs(r.w - next.w) < 1 && Math.abs(r.h - next.h) < 1 ? r : next,
      );
    };
    const id = window.setInterval(measure, 200);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    measure();
    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [demoMode, step, pathname]);

  // 발표용 리모컨·키보드: → / PageDown 다음, ← / PageUp 이전, Esc 종료
  useEffect(() => {
    if (!demoMode) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (document.querySelector('[role="dialog"]') && e.key !== "Escape") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        if (last) finish();
        else go(demoStep + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(demoStep - 1);
      } else if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) {
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demoMode, demoStep, last, go, finish]);

  if (!demoMode) return null;

  const pad = 10;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  // 강조 영역이 화면 아래쪽이면 카드를 위로 올린다
  const cardTop = rect ? rect.y + rect.h / 2 > vh * 0.55 : false;

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[45] rounded-[1.4rem] border-[3px] border-primary transition-all duration-300"
          style={{
            left: rect.x - pad,
            top: rect.y - pad,
            width: rect.w + pad * 2,
            height: rect.h + pad * 2,
            boxShadow: "0 0 0 9999px rgba(16,26,46,0.48), 0 0 0 8px rgba(49,130,246,0.25)",
          }}
        />
      )}

      <div
        role="region"
        aria-label="실사 시연 안내"
        className={`float-in fixed right-4 z-[46] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-ink text-white shadow-[var(--shadow-modal)] ${
          cardTop ? "top-[9.5rem]" : "bottom-[5.8rem] lg:bottom-4"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4">
          <span className="text-[17.5px] font-bold text-[#8fbcff]">
            라이브 시연 {demoStep + 1} / {TOUR_STEPS.length} · {step.chapter}
          </span>
          <button
            onClick={finish}
            aria-label="시연 마치기"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-5 pt-1.5 pb-4">
          <p className="text-[25px] leading-snug font-extrabold">{step.title}</p>
          <p className="mt-2.5 flex gap-2 text-[18.5px] leading-relaxed text-white/70">
            <MousePointerClick size={20} className="mt-[0.2em] shrink-0 text-[#8fbcff]" />
            {step.show}
          </p>
          <p className="mt-3 flex gap-2 rounded-xl bg-white/8 px-4 py-3 text-[20px] leading-relaxed font-semibold">
            <MessageSquareQuote size={21} className="mt-[0.2em] shrink-0 text-[#8fbcff]" />
            {step.say}
          </p>
        </div>

        <div className="flex gap-1 px-5">
          {TOUR_STEPS.map((_, i) => (
            <span key={i} className={`h-[0.35rem] flex-1 rounded-full ${i <= demoStep ? "bg-[#5b9dff]" : "bg-white/15"}`} />
          ))}
        </div>

        <div className="mt-3.5 flex items-center gap-2 px-5 pb-4">
          <button
            onClick={() => go(demoStep - 1)}
            disabled={demoStep === 0}
            className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3.5 py-2.5 text-[19.5px] font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-35"
          >
            <ChevronLeft size={21} /> 이전
          </button>
          <button
            onClick={() => (last ? finish() : go(demoStep + 1))}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-[19.5px] font-bold text-white transition-colors hover:bg-[#4a92f8] active:scale-[0.98]"
          >
            {last ? "앞으로의 개발 계획으로" : "다음 화면"}
            <ChevronRight size={21} />
          </button>
        </div>
        <p className="px-5 pb-3.5 text-[15.5px] text-white/40">키보드 → ← 또는 발표용 리모컨으로 넘길 수 있습니다</p>
      </div>
    </>
  );
}
