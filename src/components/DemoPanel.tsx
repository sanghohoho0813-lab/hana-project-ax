"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PlayCircle, RotateCcw, X } from "lucide-react";
import { useApp } from "@/lib/store";

export const DEMO_STEPS: { title: string; desc: string; href: string }[] = [
  {
    title: "오늘 돈이 걸린 4가지 확인",
    desc: "잔금 청구, 미승인 추가공사, 원가 위험, 견적 후속 연락을 순서대로 보여줍니다.",
    href: "/",
  },
  {
    title: "군산 전화메모 AI 정리",
    desc: "전화 메모를 붙여넣고 'AI로 정리하기'를 눌러 구조화된 결과를 보여주세요.",
    href: "/?memo=1",
  },
  {
    title: "추가공사 620만 원 등록",
    desc: "AI 결과에서 '추가공사로 등록'을 누르면 확인 화면이 뜹니다. 등록 후 반영을 확인하세요.",
    href: "/change-orders",
  },
  {
    title: "서천 프로젝트 원가위험 확인",
    desc: "공정률 46%인데 원가는 59% 투입된 상태와 이익 감소 원인을 보여줍니다.",
    href: "/projects/p2?tab=cost",
  },
  {
    title: "보령 공공시설 잔금 3,800만 원",
    desc: "준공서류 8/9 상태와 지금 청구 가능한 잔금을 확인합니다.",
    href: "/projects/p6?tab=closeout",
  },
  {
    title: "하나컨설팅 용역비 740만 원 계산",
    desc: "업무량 기준 계산과 용역비 반영 후 공사이익까지 함께 보여주세요.",
    href: "/consulting",
  },
  {
    title: "문의·견적 예상 신규수주 확인",
    desc: "후속 연락이 필요한 견적과 다음 달 예상 신규수주로 마무리합니다.",
    href: "/inquiries",
  },
];

export function DemoPanel() {
  const router = useRouter();
  const { demoMode, setDemoMode, demoStep, setDemoStep } = useApp();
  if (!demoMode) return null;

  const step = DEMO_STEPS[demoStep];
  const go = (n: number) => {
    const next = Math.max(0, Math.min(DEMO_STEPS.length - 1, n));
    setDemoStep(next);
    router.push(DEMO_STEPS[next].href);
  };

  return (
    <div className="float-in fixed right-4 bottom-4 z-40 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-ink text-white shadow-[var(--shadow-modal)]">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#8fbcff]">
          <PlayCircle size={13} /> 시연 모드 · {demoStep + 1} / {DEMO_STEPS.length}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => go(0)}
            aria-label="처음 단계로"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setDemoMode(false)}
            aria-label="시연 모드 종료"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-2 pb-3.5">
        <p className="text-[15px] leading-snug font-bold">{step.title}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/70">{step.desc}</p>
      </div>

      <div className="flex gap-1 px-4">
        {DEMO_STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= demoStep ? "bg-[#5b9dff]" : "bg-white/15"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2 px-4 pb-4">
        <button
          onClick={() => go(demoStep - 1)}
          disabled={demoStep === 0}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-35"
        >
          <ChevronLeft size={14} /> 이전
        </button>
        <button
          onClick={() => (demoStep === DEMO_STEPS.length - 1 ? setDemoMode(false) : go(demoStep + 1))}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#4a92f8] active:scale-[0.98]"
        >
          {demoStep === DEMO_STEPS.length - 1 ? "시연 마치기" : "다음 화면"}
          {demoStep < DEMO_STEPS.length - 1 && <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
}
