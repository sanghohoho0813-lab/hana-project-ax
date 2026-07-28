"use client";

import type { ServiceItem } from "@/lib/store-catalog";

/**
 * 서비스 대표 이미지 영역.
 * item.image에 실제 사진 경로가 들어오면 그 사진을 쓰고,
 * 없으면 업종에 맞는 SVG 일러스트를 그린다. 나중에 사진만 넣으면 바로 교체된다.
 */

const THEME: Record<
  ServiceItem["visual"],
  { from: string; to: string; ink: string; label: string }
> = {
  electric: { from: "#fff4dd", to: "#ffe2b0", ink: "#b45309", label: "전기공사" },
  cable: { from: "#e6f0ff", to: "#cfe0ff", ink: "#1b64da", label: "통신배선" },
  network: { from: "#e4f4ff", to: "#c8e6fb", ink: "#0e7490", label: "네트워크" },
  cctv: { from: "#e9f6ef", to: "#cfeadd", ink: "#059669", label: "CCTV·보안" },
  access: { from: "#f0eefe", to: "#ded9fb", ink: "#5b46d6", label: "출입통제" },
  wrench: { from: "#f1f3f6", to: "#dfe3e8", ink: "#4e5968", label: "유지보수" },
  report: { from: "#e9f6ef", to: "#d5ecf7", ink: "#0f766e", label: "운영관리" },
};

function Art({ kind, ink }: { kind: ServiceItem["visual"]; ink: string }) {
  const common = {
    fill: "none",
    stroke: ink,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "electric":
      return (
        <g {...common}>
          <path d="M96 28 L70 84 L96 84 L82 132" />
          <rect x="122" y="40" width="52" height="80" rx="8" />
          <path d="M136 62h24M136 80h24M136 98h24" />
        </g>
      );
    case "cable":
      return (
        <g {...common}>
          <path d="M28 60c34 0 34 40 68 40s34-40 68-40" />
          <path d="M28 104c34 0 34 24 68 24s34-24 68-24" opacity="0.5" />
          <rect x="18" y="46" width="18" height="28" rx="4" />
          <rect x="156" y="46" width="18" height="28" rx="4" />
        </g>
      );
    case "network":
      return (
        <g {...common}>
          <rect x="66" y="24" width="60" height="34" rx="8" />
          <rect x="22" y="102" width="52" height="34" rx="8" />
          <rect x="118" y="102" width="52" height="34" rx="8" />
          <path d="M96 58v22M96 80H48v22M96 80h48v22" />
        </g>
      );
    case "cctv":
      return (
        <g {...common}>
          <rect x="40" y="42" width="86" height="40" rx="10" transform="rotate(-12 40 42)" />
          <path d="M120 52l30-14v40l-28-12" />
          <path d="M70 92v34M52 126h36" />
        </g>
      );
    case "access":
      return (
        <g {...common}>
          <rect x="48" y="26" width="70" height="120" rx="8" />
          <circle cx="104" cy="86" r="6" />
          <rect x="132" y="58" width="40" height="56" rx="8" />
          <path d="M142 78h20M142 94h20" />
        </g>
      );
    case "wrench":
      return (
        <g {...common}>
          <path d="M126 44a26 26 0 10 24 24l-64 64a14 14 0 01-20-20l64-64a26 26 0 01-4-4z" />
          <circle cx="60" cy="132" r="4" />
        </g>
      );
    case "report":
      return (
        <g {...common}>
          <rect x="52" y="26" width="88" height="120" rx="10" />
          <path d="M74 60h44M74 84h44M74 108h26" />
          <path d="M118 108l14 14 22-26" strokeWidth={6} />
        </g>
      );
  }
}

export function ServiceVisual({
  item,
  className = "",
  showLabel = true,
}: {
  item: ServiceItem;
  className?: string;
  showLabel?: boolean;
}) {
  const t = THEME[item.visual];

  if (item.image) {
    return (
      // 실제 사진이 들어오면 그대로 사용한다
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.image}
        alt={item.name}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)` }}
      role="img"
      aria-label={`${item.name} 이미지`}
    >
      <svg viewBox="0 0 192 172" className="h-[70%] w-auto opacity-90">
        <Art kind={item.visual} ink={t.ink} />
      </svg>
      {showLabel && (
        <span
          className="absolute top-4 left-4 rounded-lg bg-white/75 px-3 py-1.5 text-[18px] font-bold"
          style={{ color: t.ink }}
        >
          {t.label}
        </span>
      )}
    </div>
  );
}
