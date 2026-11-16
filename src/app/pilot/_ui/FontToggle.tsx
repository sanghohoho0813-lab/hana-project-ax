"use client";

import { useSyncExternalStore } from "react";
import { FONT_SCALE_KEY } from "@/components/FontScale";

/**
 * 글자 크기 — 기본 → 크게(120%) → 매우 크게(140%) 를 차례로 바꾼다.
 * 기존 화면의 글자 크기 설정과 같은 값을 쓴다 (이 브라우저에 저장 · 화면 전체가 같은 비율로 커짐).
 */
type Scale = "base" | "large" | "xlarge";
const NEXT: Record<Scale, Scale> = { base: "large", large: "xlarge", xlarge: "base" };
const LABEL: Record<Scale, string> = { base: "기본", large: "크게", xlarge: "매우 크게" };
const EVENT = "hana-font-scale";

function read(): Scale {
  const v = document.documentElement.getAttribute("data-font-scale");
  return v === "large" || v === "xlarge" ? v : "base";
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function FontToggle() {
  const scale = useSyncExternalStore(subscribe, read, () => "base" as Scale);
  const change = () => {
    const v = NEXT[scale];
    try {
      if (v === "base") {
        document.documentElement.removeAttribute("data-font-scale");
        window.localStorage.removeItem(FONT_SCALE_KEY);
      } else {
        document.documentElement.setAttribute("data-font-scale", v);
        window.localStorage.setItem(FONT_SCALE_KEY, v);
      }
    } catch {
      // 저장을 못 해도 지금 화면에는 적용된다
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <button
      type="button"
      onClick={change}
      aria-label={`글자 크기: ${LABEL[scale]} — 누르면 ${LABEL[NEXT[scale]]}`}
      className="inline-flex min-h-[2.5rem] shrink-0 items-center gap-0.5 rounded-xl px-2 font-extrabold text-ink-2 hover:bg-[#eef0f3]"
    >
      <span className="text-[15px]">가</span>
      <span className="text-[19px] leading-none">가</span>
      {scale !== "base" && <span className="ml-0.5 rounded-full bg-primary-light px-1.5 text-[12px] text-primary-dark">{scale === "large" ? "+" : "++"}</span>}
    </button>
  );
}
