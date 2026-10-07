"use client";

import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleDashed,
  Clapperboard,
  Clock,
  Map,
  MonitorPlay,
  PlayCircle,
  Route,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { TOUR_STEPS } from "@/lib/demo-tour";
import { PATENT_NO, VIDEOS } from "@/lib/videos";
import { VideoPage } from "@/components/VideoPage";

/**
 * 실사 시연 화면의 강조색 — 기본 파랑에 어울리는 두 가지만 더한다.
 * 빨강: 영상·문제 / 파랑: 해결·라이브 시연 / 청록: 차별점·앞으로의 개발
 */
const ACCENT = {
  coral: { solid: "#e5545f", text: "#c43843", soft: "#fdeeef", line: "#f4bfc4" },
  blue: { solid: "#3182f6", text: "#1b64da", soft: "#e8f1fe", line: "#b7d3fb" },
  teal: { solid: "#14a08f", text: "#0b7d70", soft: "#e4f6f3", line: "#a6ddd5" },
} as const;
type AccentKey = keyof typeof ACCENT;

/** 실사 당일 진행 순서 — 처음 보는 분도 따라올 수 있게 '왜 → 무엇 → 어떻게 → 앞으로' 순서 */
const AGENDA: { id: string; n: number; label: string; min: string; tone: AccentKey }[] = [
  { id: "video", n: 1, label: "실사용 영상", min: "4분", tone: "coral" },
  { id: "live", n: 2, label: "실제 화면 시연", min: "6~8분", tone: "blue" },
  { id: "roadmap", n: 3, label: "앞으로의 개발", min: "2분", tone: "teal" },
];

type Status = "done" | "now" | "next";
const ROADMAP: { status: Status; when: string; title: string; items: string[] }[] = [
  {
    status: "done",
    when: "완료",
    title: "MVP 구축 · 특허출원",
    items: ["관리자 대시보드 · 업무지시 · 통합일정 · 작업보고 · 현장기사 모바일 화면", `특허출원 2026.09.11 · 출원번호 ${PATENT_NO}`],
  },
  {
    status: "now",
    when: "준비 중",
    title: "자사 현장 실증",
    items: ["실제 직원 몇 명 · 현장 몇 곳부터 적용", "업무지시 → 확인 → 진행 → 보고 → 일정 변경 사이클을 한두 달 운영"],
  },
  {
    status: "next",
    when: "다음 단계",
    title: "정식 운영 시스템",
    items: ["직원별 실제 계정 · 권한 관리", "정식 운영용 DB · 데이터 저장", "모바일 사용 환경 · 자동 알림"],
  },
  {
    status: "next",
    when: "그다음",
    title: "위험 판단 고도화",
    items: ["지도 · 실제 이동시간 연동", "쌓인 데이터로 위험 판단 기준을 계속 보완"],
  },
  {
    status: "next",
    when: "목표",
    title: "여러 현장을 운영하는 업종으로 확대",
    items: ["정보통신공사에서 시작해 전기 · 소방 · 설비 · 시설관리로"],
  },
];

const MEASURE = ["업무 누락", "일정 지연", "이동시간 부족", "일정 충돌", "반복 확인 전화"];

function Section({
  id,
  tone,
  icon: Icon,
  title,
  desc,
  children,
}: {
  id: string;
  n?: number;
  tone: AccentKey;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const c = ACCENT[tone];
  return (
    <section id={id} className="scroll-mt-[10rem]">
      <div className="mb-4 flex items-center gap-3.5">
        <span
          className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ background: c.solid }}
        >
          <Icon size={24} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[28px] leading-tight font-extrabold">{title}</h2>
        </div>
      </div>
      {desc && <p className="-mt-1.5 mb-3.5 text-[19px] text-ink-3">{desc}</p>}
      {children}
    </section>
  );
}

export default function DemoGuidePage() {
  const router = useRouter();
  const { setDemoMode, setDemoStep } = useApp();

  const startTour = (i = 0) => {
    setDemoStep(i);
    setDemoMode(true);
    router.push(TOUR_STEPS[i].href);
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="page-in space-y-12">
      {/* 머리말 */}
      <div className="hero-navy overflow-hidden rounded-3xl px-6 py-7 text-white lg:px-9 lg:py-8">
        <p className="text-[18px] font-bold tracking-wide text-[#f6b6bc]">실사 시연 · 실사용 영상</p>
        <h1 className="mt-1.5 text-[36px] leading-tight font-extrabold lg:text-[42px]">복수 현장 업무 위험관리 AX</h1>
        <p className="mt-2 max-w-[54rem] text-[21px] leading-relaxed text-white/75">
          처음 보시는 분도 따라오실 수 있게{" "}
          <b className="text-white">왜 필요한지 → 무엇인지 → 실제로 어떻게 쓰는지 → 앞으로 어떻게 개발하는지</b> 순서로 준비했습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            onClick={() => jump("video")}
            className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl px-5 text-[20px] font-bold text-white transition-transform active:scale-[0.98]"
            style={{ background: ACCENT.coral.solid }}
          >
            <PlayCircle size={23} /> 영상부터 시작
          </button>
          <button
            onClick={() => startTour(0)}
            className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-white px-5 text-[20px] font-bold text-ink transition-transform active:scale-[0.98]"
          >
            <MonitorPlay size={23} className="text-primary" /> 실제 화면 시연 시작
          </button>
        </div>

        {/* 진행 순서 */}
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AGENDA.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => (s.id === "live" ? startTour(0) : jump(s.id))}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-left transition-colors hover:bg-white/14"
              >
                <span
                  className="flex h-[2.2rem] w-[2.2rem] shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold text-white"
                  style={{ background: ACCENT[s.tone].solid }}
                >
                  {s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[19px] leading-snug font-bold break-keep">{s.label}</span>
                  <span className="flex items-center gap-1 text-[16px] text-white/55">
                    <Clock size={15} /> {s.min}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* 1. 영상 — 가로·세로, 배속, 목차까지 여기서 바로 */}
      <Section
        id="video"
        n={1}
        tone="coral"
        icon={Clapperboard}
        title="실사용 영상으로 먼저 보기"
        desc="문제 → 해결 구조 → 실제 화면 → 특허 · 현재 단계까지 4분에 담았습니다. 가로 · 세로, 배속, 목차를 여기서 바로 조작할 수 있습니다."
      >
        <VideoPage video={VIDEOS.inspection} embedded />
      </Section>

      {/* 2. 로드맵 */}
      <Section
        id="roadmap"
        n={2}
        tone="teal"
        icon={Route}
        title="앞으로 어떻게 개발될 예정인가"
        desc="지금 만든 MVP를 기준으로, 작게 실증하고 확인한 뒤 넓혀 갑니다."
      >
        <div className="card p-6">
          <ol className="relative space-y-5 pl-2">
            <span className="absolute top-3 bottom-3 left-[1.35rem] w-[2px] bg-line" aria-hidden />
            {ROADMAP.map((r) => {
              const color = r.status === "done" ? ACCENT.blue : r.status === "now" ? ACCENT.teal : null;
              return (
                <li key={r.title} className="relative flex gap-4">
                  <span
                    className={`relative z-[1] flex h-[2.3rem] w-[2.3rem] shrink-0 items-center justify-center rounded-full ${
                      r.status === "done"
                        ? "text-white"
                        : r.status === "now"
                          ? "border-[3px] bg-white"
                          : "border-2 border-dashed border-ink-3/50 bg-white text-ink-3"
                    }`}
                    style={
                      r.status === "done"
                        ? { background: ACCENT.blue.solid }
                        : r.status === "now"
                          ? { borderColor: ACCENT.teal.solid, color: ACCENT.teal.solid }
                          : undefined
                    }
                  >
                    {r.status === "done" ? <CheckCircle2 size={20} /> : r.status === "now" ? <Map size={18} /> : <CircleDashed size={18} />}
                  </span>
                  <div
                    className="min-w-0 flex-1 rounded-2xl px-4 py-3"
                    style={r.status === "now" ? { background: ACCENT.teal.soft } : undefined}
                  >
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[16.5px] font-bold"
                      style={color ? { background: r.status === "now" ? "#fff" : color.soft, color: color.text } : { background: "#f2f4f6", color: "#6b7684" }}
                    >
                      {r.when}
                    </span>
                    <p className="mt-1 text-[23px] leading-snug font-extrabold">{r.title}</p>
                    <ul className="mt-1.5 space-y-1">
                      {r.items.map((it) => (
                        <li key={it} className="flex gap-2 text-[19.5px] leading-relaxed text-ink-2">
                          <span className="mt-[0.75em] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: ACCENT.coral.line, background: ACCENT.coral.soft }}>
            <p className="text-[19.5px] font-bold" style={{ color: ACCENT.coral.text }}>
              실증에서 측정할 것
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {MEASURE.map((m) => (
                <span key={m} className="rounded-full bg-white px-4 py-2 text-[19px] font-semibold text-ink-2 shadow-[var(--shadow-card)]">
                  {m} 감소
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[17.5px] text-ink-2">아직 실측 수치는 없습니다. 실증 데이터로 도입 전과 비교합니다.</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
