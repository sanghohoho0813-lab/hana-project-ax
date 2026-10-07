"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clapperboard,
  Clock,
  ListChecks,
  Map,
  MonitorPlay,
  PlayCircle,
  RotateCcw,
  Route,
  Target,
  Workflow,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { TOUR_STEPS } from "@/lib/demo-tour";
import { PATENT_NO, VIDEOS } from "@/lib/videos";
import { VideoPage } from "@/components/VideoPage";
import { useFontScale } from "@/components/FontScale";

/**
 * 실사 시연 화면의 강조색 — 기본 파랑에 어울리는 두 가지만 더한다.
 * 코랄: 영상·문제 / 파랑: 해결·라이브 시연 / 청록: 차별점·앞으로의 개발
 */
const ACCENT = {
  coral: { solid: "#e5734a", text: "#c2532b", soft: "#fdf0ea", line: "#f3c3ae" },
  blue: { solid: "#3182f6", text: "#1b64da", soft: "#e8f1fe", line: "#b7d3fb" },
  teal: { solid: "#14a08f", text: "#0b7d70", soft: "#e4f6f3", line: "#a6ddd5" },
} as const;
type AccentKey = keyof typeof ACCENT;

/** 실사 당일 진행 순서 — 처음 보는 분도 따라올 수 있게 '왜 → 무엇 → 어떻게 → 앞으로' 순서 */
const AGENDA: { id: string; n: number; label: string; min: string; tone: AccentKey }[] = [
  { id: "video", n: 1, label: "실사용 영상", min: "4분", tone: "coral" },
  { id: "summary", n: 2, label: "한 장으로 정리", min: "1분", tone: "blue" },
  { id: "live", n: 3, label: "실제 화면 시연", min: "6~8분", tone: "blue" },
  { id: "roadmap", n: 4, label: "앞으로의 개발", min: "2분", tone: "teal" },
];

const SUMMARY: { k: string; tone: AccentKey; title: string; body: string }[] = [
  {
    k: "문제",
    tone: "coral",
    title: "확인하려면 계속 전화해야 했습니다",
    body: "업무지시는 전화·카카오톡으로, 일정은 따로, 진행상황은 다시 전화로 확인했습니다. 한 현장이 늦어지면 다음 현장 문제는 터진 뒤에야 알았습니다.",
  },
  {
    k: "해결",
    tone: "blue",
    title: "업무를 상태 흐름으로 관리합니다",
    body: "업무지시 → 확인 → 작업개시 → 작업보고 → 관리자 확인. 직원은 버튼으로 상태를 남기고, 관리자는 문제가 있는 업무만 봅니다.",
  },
  {
    k: "차별점",
    tone: "teal",
    title: "다음 현장의 위험까지 미리 판단합니다",
    body: "같은 직원의 앞뒤 일정, 현장 위치, 필요한 이동시간을 함께 보고, 아직 시작 전인 업무도 늦어질 위험이 있으면 대응 순서를 먼저 알려줍니다.",
  },
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

const CHECKLIST = [
  "오른쪽 위 메뉴에서 '데모 데이터 초기화' 한 번 누르기",
  "글자 크기는 화면 크기에 맞게 '크게'로 (오른쪽 위 메뉴)",
  "실사용 영상은 가로 · 모니터로, 소리 켜고 처음부터",
  "현재 사용자가 '구본석 이사'인지 확인 (왼쪽 아래)",
  "라이브 시연은 → 키 또는 발표용 리모컨으로 넘기기",
];

function Section({
  id,
  n,
  tone,
  icon: Icon,
  title,
  desc,
  children,
}: {
  id: string;
  n: number;
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
          <p className="text-[16.5px] font-extrabold tracking-wide" style={{ color: c.text }}>
            {n}단계
          </p>
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
  const { setDemoMode, setDemoStep, resetDemo, showToast } = useApp();
  const { setScale } = useFontScale();
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));

  const startTour = (i = 0) => {
    setDemoStep(i);
    setDemoMode(true);
    router.push(TOUR_STEPS[i].href);
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const tick = (i: number) => setChecked((c) => c.map((x, j) => (j === i ? true : x)));

  return (
    <div className="page-in space-y-12">
      {/* 머리말 */}
      <div className="hero-navy overflow-hidden rounded-3xl px-6 py-7 text-white lg:px-9 lg:py-8">
        <p className="text-[18px] font-bold tracking-wide text-[#f0c2a2]">실사 시연 · 실사용 영상</p>
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
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {AGENDA.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => jump(s.id)}
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

      {/* 시작 전 점검 */}
      <div className="card border-l-[6px] p-6" style={{ borderLeftColor: ACCENT.teal.solid }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[22.5px] font-bold">
            <ListChecks size={24} style={{ color: ACCENT.teal.solid }} /> 시작 전 점검
            <span className="rounded-full px-2.5 py-0.5 text-[17px] font-bold" style={{ background: ACCENT.teal.soft, color: ACCENT.teal.text }}>
              {checked.filter(Boolean).length} / {CHECKLIST.length}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                resetDemo();
                tick(0);
                showToast("데모 데이터를 처음 상태로 되돌렸습니다");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[19px] font-bold text-ink-2 hover:bg-[#e8ebee]"
            >
              <RotateCcw size={19} /> 데모 데이터 초기화
            </button>
            <button
              onClick={() => {
                setScale("large");
                tick(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[19px] font-bold text-ink-2 hover:bg-[#e8ebee]"
            >
              글자 크게
            </button>
          </div>
        </div>
        <ul className="mt-3 grid gap-1.5 md:grid-cols-2">
          {CHECKLIST.map((c, i) => (
            <li key={c}>
              <button
                onClick={() => setChecked((s) => s.map((x, j) => (j === i ? !x : x)))}
                aria-pressed={checked[i]}
                className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-[#f7f8fa]"
              >
                {checked[i] ? (
                  <CheckCircle2 size={23} className="mt-[0.1em] shrink-0" style={{ color: ACCENT.teal.solid }} />
                ) : (
                  <CircleDashed size={23} className="mt-[0.1em] shrink-0 text-ink-3" />
                )}
                <span className={`text-[19.5px] ${checked[i] ? "text-ink-3 line-through" : "text-ink"}`}>{c}</span>
              </button>
            </li>
          ))}
        </ul>
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

      {/* 2. 요약 */}
      <Section id="summary" n={2} tone="blue" icon={Target} title="한 장으로 정리" desc="영상 직후, 세 문장으로 다시 짚어 주세요.">
        <div className="grid gap-3 lg:grid-cols-3">
          {SUMMARY.map((s) => {
            const c = ACCENT[s.tone];
            return (
              <div key={s.k} className="card overflow-hidden p-0">
                <div className="h-[6px]" style={{ background: c.solid }} />
                <div className="p-6">
                  <span className="inline-block rounded-full px-3 py-1 text-[17px] font-extrabold" style={{ background: c.soft, color: c.text }}>
                    {s.k}
                  </span>
                  <p className="mt-2.5 text-[24px] leading-snug font-extrabold">{s.title}</p>
                  <p className="mt-2.5 text-[19.5px] leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="card mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 p-5">
          <Workflow size={24} className="text-primary" />
          {["업무지시", "확인", "작업개시", "작업보고", "관리자 확인"].map((s, i, a) => (
            <span key={s} className="flex items-center gap-3 text-[20.5px] font-bold">
              {i > 0 && <ArrowRight size={18} className="text-ink-3" />}
              <span
                className="rounded-xl px-3 py-1.5"
                style={i === a.length - 1 ? { background: ACCENT.teal.soft, color: ACCENT.teal.text } : { background: ACCENT.blue.soft, color: ACCENT.blue.text }}
              >
                {s}
              </span>
            </span>
          ))}
        </div>
      </Section>

      {/* 3. 라이브 시연 */}
      <Section
        id="live"
        n={3}
        tone="blue"
        icon={MonitorPlay}
        title="실제 화면으로 시연"
        desc="버튼을 누르면 화면이 차례로 열리고, 보여줄 곳이 밝게 표시되며, 설명할 문장이 함께 뜹니다."
      >
        <div className="card p-6">
          <ol className="grid gap-2 md:grid-cols-2">
            {TOUR_STEPS.map((s, i) => {
              const staff = s.chapter === "직원 화면";
              const c = staff ? ACCENT.coral : ACCENT.blue;
              return (
                <li key={i}>
                  <button
                    onClick={() => startTour(i)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-line px-4 py-3.5 text-left transition-colors hover:bg-[#f7f8fa]"
                    style={{ borderLeft: `5px solid ${c.solid}` }}
                  >
                    <span
                      className="flex h-[2.2rem] w-[2.2rem] shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold"
                      style={{ background: c.soft, color: c.text }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16.5px] font-bold" style={{ color: c.text }}>
                        {s.chapter}
                      </span>
                      <span className="block text-[20.5px] leading-snug font-bold">{s.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            onClick={() => startTour(0)}
            className="mt-4 inline-flex min-h-[3.75rem] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[21px] font-bold text-white transition-colors hover:bg-primary-dark active:scale-[0.99]"
          >
            <MonitorPlay size={24} /> 1번부터 시연 시작
          </button>
          <p className="mt-2.5 text-center text-[17.5px] text-ink-3">
            <b style={{ color: ACCENT.coral.text }}>직원 화면</b> 단계에서는 자동으로 현장책임자 계정으로 바뀌고, 시연을 마치면 이사 계정으로 돌아옵니다.
          </p>
        </div>
      </Section>

      {/* 4. 로드맵 */}
      <Section
        id="roadmap"
        n={4}
        tone="teal"
        icon={Route}
        title="앞으로 어떻게 개발되는가"
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
