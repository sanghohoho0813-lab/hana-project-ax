"use client";

import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { useApp } from "@/lib/store";

export const DEMO_STEPS: { title: string; desc: string; href: string }[] = [
  {
    title: "확인되지 않은 업무부터 확인",
    desc: "미확인 3건, 기한 초과 2건, 일정 충돌 1건을 먼저 보여주세요.",
    href: "/",
  },
  {
    title: "전화메모를 업무로 정리",
    desc: "'내일 오전 박기사 서천 학교…' 메모를 넣고 '업무로 정리하기'를 누르세요.",
    href: "/?memo=1",
  },
  {
    title: "업무와 일정으로 등록",
    desc: "정리 결과를 확인하고 등록하면 업무지시와 통합일정에 함께 들어갑니다.",
    href: "/tasks",
  },
  {
    title: "직원 계정으로 전환해 업무 확인",
    desc: "좌측 하단에서 박정우 현장책임자로 바꾸고 '확인했습니다'를 누르세요.",
    href: "/",
  },
  {
    title: "작업 시작과 진행보고 제출",
    desc: "업무를 열어 작업 시작 후 짧은 메모로 보고를 만들어 제출합니다.",
    href: "/tasks",
  },
  {
    title: "관리자가 보고를 검토·승인",
    desc: "구본석 이사로 다시 전환해 검토 대기 보고를 승인하세요.",
    href: "/reports?filter=review",
  },
  {
    title: "일정 충돌 조정",
    desc: "박정우 현장책임자의 겹친 일정을 변경하거나 담당자를 바꿔 보세요.",
    href: "/schedule",
  },
  {
    title: "운영성과와 도입 리포트",
    desc: "일정 누락·보고 제출률 목표와 AX 도입·검증 리포트를 보여주세요.",
    href: "/performance",
  },
  {
    title: "조달 인사이트와 설비 연동 준비",
    desc: "샘플 데이터 표시를 함께 짚어 주세요.",
    href: "/procurement",
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
    <div className="float-in fixed right-4 bottom-[5.8rem] z-40 lg:bottom-4 w-[min(34.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-ink text-white shadow-[var(--shadow-modal)]">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[18px] font-bold text-[#8fbcff]">
          <PlayCircle size={20} /> 시연 모드 · {demoStep + 1} /{" "}
          {DEMO_STEPS.length}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => go(0)}
            aria-label="처음 단계로"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={21} />
          </button>
          <button
            onClick={() => setDemoMode(false)}
            aria-label="시연 모드 종료"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-2 pb-3.5">
        <p className="text-[22.5px] leading-snug font-bold">{step.title}</p>
        <p className="mt-1 text-[18.8px] leading-relaxed text-white/70">
          {step.desc}
        </p>
      </div>

      <div className="flex gap-1 px-4">
        {DEMO_STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-[0.35rem] flex-1 rounded-full transition-colors ${
              i <= demoStep ? "bg-[#5b9dff]" : "bg-white/15"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2 px-4 pb-4">
        <button
          onClick={() => go(demoStep - 1)}
          disabled={demoStep === 0}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-[19.5px] font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-35"
        >
          <ChevronLeft size={21} /> 이전
        </button>
        <button
          onClick={() =>
            demoStep === DEMO_STEPS.length - 1
              ? setDemoMode(false)
              : go(demoStep + 1)
          }
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-[19.5px] font-bold text-white transition-colors hover:bg-[#4a92f8] active:scale-[0.98]"
        >
          {demoStep === DEMO_STEPS.length - 1 ? "시연 마치기" : "다음 화면"}
          {demoStep < DEMO_STEPS.length - 1 && <ChevronRight size={21} />}
        </button>
      </div>
    </div>
  );
}
