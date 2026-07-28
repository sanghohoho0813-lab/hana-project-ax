"use client";

import { useState } from "react";
import { Type } from "lucide-react";

export type FontScale = "base" | "large" | "xlarge";

export const FONT_SCALE_KEY = "hana-ax-font-scale";

export const FONT_SCALE_OPTIONS: { value: FontScale; label: string; hint: string }[] = [
  { value: "base", label: "기본", hint: "기본 크기" },
  { value: "large", label: "크게", hint: "기본보다 20% 크게" },
  { value: "xlarge", label: "매우 크게", hint: "기본보다 40% 크게" },
];

/**
 * 화면이 처음 그려지기 전에 저장된 글자 크기를 적용하는 스크립트.
 * layout.tsx의 <head>에 넣어 깜빡임과 하이드레이션 불일치를 막는다.
 */
export const FONT_SCALE_BOOTSTRAP = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  FONT_SCALE_KEY
)});if(v==="large"||v==="xlarge"){document.documentElement.setAttribute("data-font-scale",v);}}catch(e){}})();`;

export function useFontScale() {
  // 부트스트랩 스크립트가 이미 <html>에 적용해 둔 값을 그대로 읽는다
  const [scale, setScale] = useState<FontScale>(() => {
    if (typeof document === "undefined") return "base";
    const v = document.documentElement.getAttribute("data-font-scale");
    return v === "large" || v === "xlarge" ? v : "base";
  });

  const apply = (v: FontScale) => {
    setScale(v);
    if (v === "base") {
      document.documentElement.removeAttribute("data-font-scale");
      window.localStorage.removeItem(FONT_SCALE_KEY);
    } else {
      document.documentElement.setAttribute("data-font-scale", v);
      window.localStorage.setItem(FONT_SCALE_KEY, v);
    }
  };

  return { scale, setScale: apply };
}

/** 사용자 메뉴 안에 들어가는 글자 크기 선택기 */
export function FontScalePicker({
  scale,
  onChange,
}: {
  scale: FontScale;
  onChange: (v: FontScale) => void;
}) {
  return (
    <div className="px-3 py-2.5">
      <p className="mb-2 flex items-center gap-2 text-[19.5px] font-semibold text-ink-2">
        <Type size={21} className="text-ink-3" /> 글자 크기
      </p>
      <div className="flex gap-1 rounded-xl bg-[#f2f4f6] p-1">
        {FONT_SCALE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            title={o.hint}
            className={`flex-1 rounded-lg px-2 py-2 text-[18px] font-bold whitespace-nowrap transition-all ${
              scale === o.value
                ? "bg-white text-primary-dark shadow-sm"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[16.5px] text-ink-3">
        {FONT_SCALE_OPTIONS.find((o) => o.value === scale)?.hint}
      </p>
    </div>
  );
}
