"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clapperboard,
  Clock,
  HelpCircle,
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
import { useFontScale } from "@/components/FontScale";

/** 실사 당일 진행 순서 — 처음 보는 분도 따라올 수 있게 '왜 → 무엇 → 어떻게 → 앞으로' 순서 */
const AGENDA = [
  { id: "video", n: 1, label: "실사용 영상", min: "4분", icon: Clapperboard },
  { id: "summary", n: 2, label: "한 장으로 정리", min: "1분", icon: Target },
  { id: "live", n: 3, label: "실제 화면 시연", min: "6~8분", icon: MonitorPlay },
  { id: "roadmap", n: 4, label: "앞으로의 개발", min: "2분", icon: Route },
  { id: "qna", n: 5, label: "예상 질문", min: "질의응답", icon: HelpCircle },
];

const SUMMARY = [
  {
    k: "문제",
    title: "확인하려면 계속 전화해야 했습니다",
    body: "업무지시는 전화·카카오톡으로, 일정은 따로, 진행상황은 다시 전화로 확인했습니다. 한 현장이 늦어지면 다음 현장 문제는 터진 뒤에야 알았습니다.",
  },
  {
    k: "해결",
    title: "업무를 상태 흐름으로 관리합니다",
    body: "업무지시 → 확인 → 작업개시 → 작업보고 → 관리자 확인. 직원은 버튼으로 상태를 남기고, 관리자는 문제가 있는 업무만 봅니다.",
  },
  {
    k: "차별점",
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

const QNA = [
  {
    q: "지금 실제로 쓰고 있나요?",
    a: "아직 상용화 전 단계입니다. 업무 구조와 화면을 MVP로 먼저 만들어 확인했고, 자사 정보통신공사 현장에서 실제 사용과 실증을 준비하고 있습니다. 화면 속 업무와 인물은 예시 데이터입니다.",
  },
  {
    q: "특허는 어떤 상태인가요?",
    a: `2026년 9월 11일 출원을 마쳤습니다(출원번호 ${PATENT_NO}). 등록된 특허가 아니라 출원 완료 상태입니다. 핵심은 복수 현장의 작업상태 변화와 시간·장소 조건으로 연계업무의 위험도와 대응 우선순위를 정하는 처리 구조입니다.`,
  },
  {
    q: "카카오톡이나 일반 일정관리 앱과 무엇이 다른가요?",
    a: "기존 도구는 업무와 일정을 기록하는 데 중심이 있습니다. 이 시스템은 지금 생긴 변화(예: 앞 현장 지연)가 다음 업무에 줄 영향까지 이어서 판단하고, 관리자가 먼저 확인할 순서를 제시합니다.",
  },
  {
    q: "직원들이 현장에서 쓰기 어렵지 않을까요?",
    a: "긴 보고서를 쓰지 않습니다. 휴대폰에서 '확인했습니다', '일정 조정이 필요합니다', '내용 확인이 필요합니다' 같은 버튼과 사진 첨부로 상태를 남기는 방식입니다.",
  },
  {
    q: "효과는 어떻게 증명하나요?",
    a: "아직 실측 수치는 없습니다. 자사 현장 실증에서 업무 누락, 일정 지연, 이동시간 부족, 일정 충돌, 반복 확인이 도입 전과 비교해 얼마나 줄었는지 실제 데이터로 측정할 계획입니다.",
  },
  {
    q: "아이디어는 어디서 나왔고, 누가 만들었나요?",
    a: "약 24년간 정보통신공사 현장을 운영하며 반복적으로 겪은 문제에서 시작했습니다. 대표와 실무진이 업무 흐름을 직접 정리했고, 외부 기술개발 협력을 통해 MVP를 구축했습니다.",
  },
  {
    q: "다음 개발은 무엇부터 하나요?",
    a: "지금 MVP를 기준으로 실제 직원 계정, 현장·일정 데이터, 모바일 환경, 자동 알림, 데이터 저장, 권한 관리를 붙이고, 필요하면 지도 이동시간 연동과 위험 판단 기능을 고도화합니다. 처음부터 다시 만드는 것이 아닙니다.",
  },
];

const CHECKLIST = [
  "오른쪽 위 메뉴에서 '데모 데이터 초기화' 한 번 누르기",
  "글자 크기는 화면 크기에 맞게 '크게'로 (오른쪽 위 메뉴)",
  "실사용 영상은 가로 · 모니터로, 소리 켜고 처음부터",
  "현재 사용자가 '구본석 이사'인지 확인 (왼쪽 아래)",
  "라이브 시연은 → 키 또는 발표용 리모컨으로 넘기기",
];

function Section({ id, n, title, children, desc }: { id: string; n: number; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-[10rem]">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="flex h-[2.4rem] w-[2.4rem] shrink-0 items-center justify-center rounded-full bg-primary text-[19px] font-extrabold text-white">
          {n}
        </span>
        <div>
          <h2 className="text-[28px] leading-tight font-extrabold">{title}</h2>
          {desc && <p className="mt-0.5 text-[19px] text-ink-3">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DemoGuidePage() {
  const router = useRouter();
  const { setDemoMode, setDemoStep, resetDemo, showToast } = useApp();
  const { setScale } = useFontScale();
  const [open, setOpen] = useState<number | null>(0);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));
  const v = VIDEOS.inspection;

  const startTour = (i = 0) => {
    setDemoStep(i);
    setDemoMode(true);
    router.push(TOUR_STEPS[i].href);
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="page-in space-y-10">
      {/* 머리말 */}
      <div className="hero-navy overflow-hidden rounded-3xl px-6 py-7 text-white lg:px-9 lg:py-8">
        <p className="text-[18px] font-bold tracking-wide text-[#8fbcff]">실사 시연 가이드</p>
        <h1 className="mt-1.5 text-[36px] leading-tight font-extrabold lg:text-[42px]">
          복수 현장 업무 위험관리 AX
        </h1>
        <p className="mt-2 max-w-[54rem] text-[21px] leading-relaxed text-white/75">
          처음 보시는 분도 따라오실 수 있게 <b className="text-white">왜 필요한지 → 무엇인지 → 실제로 어떻게 쓰는지 → 앞으로 어떻게 개발하는지</b> 순서로 준비했습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            onClick={() => jump("video")}
            className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-white px-5 text-[20px] font-bold text-ink transition-transform active:scale-[0.98]"
          >
            <PlayCircle size={23} className="text-primary" /> 영상부터 시작
          </button>
          <button
            onClick={() => startTour(0)}
            className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-colors hover:bg-[#4a92f8]"
          >
            <MonitorPlay size={23} /> 실제 화면 시연 시작
          </button>
        </div>

        {/* 진행 순서 */}
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {AGENDA.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => jump(s.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-left transition-colors hover:bg-white/14"
              >
                <span className="flex h-[2.1rem] w-[2.1rem] shrink-0 items-center justify-center rounded-full bg-white/15 text-[17px] font-extrabold">
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
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[22.5px] font-bold">
            <ListChecks size={24} className="text-primary" /> 시작 전 점검
            <span className="text-[18px] font-medium text-ink-3">
              {checked.filter(Boolean).length} / {CHECKLIST.length}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                resetDemo();
                setChecked((c) => c.map((x, i) => (i === 0 ? true : x)));
                showToast("데모 데이터를 처음 상태로 되돌렸습니다");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[19px] font-bold text-ink-2 hover:bg-[#e8ebee]"
            >
              <RotateCcw size={19} /> 데모 데이터 초기화
            </button>
            <button
              onClick={() => {
                setScale("large");
                setChecked((c) => c.map((x, i) => (i === 1 ? true : x)));
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
                  <CheckCircle2 size={23} className="mt-[0.1em] shrink-0 text-primary" />
                ) : (
                  <CircleDashed size={23} className="mt-[0.1em] shrink-0 text-ink-3" />
                )}
                <span className={`text-[19.5px] ${checked[i] ? "text-ink-3 line-through" : "text-ink"}`}>{c}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* 1. 영상 */}
      <Section id="video" n={1} title="실사용 영상으로 먼저 보기" desc="문제 → 해결 구조 → 실제 화면 → 특허 · 현재 단계까지 4분에 담았습니다.">
        <div className="card overflow-hidden p-0">
          <div className="relative aspect-video w-full bg-[#0f1216]">
            <video src={v.src.h} poster={v.poster.h} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-[19px] text-ink-2">세로 화면 · 배속 · 목차는 영상 페이지에서 볼 수 있습니다.</p>
            <a href="/videos/inspection" className="inline-flex items-center gap-1.5 text-[19.5px] font-bold text-primary-dark hover:underline">
              실사용 영상 페이지 <ArrowRight size={19} />
            </a>
          </div>
        </div>
      </Section>

      {/* 2. 요약 */}
      <Section id="summary" n={2} title="한 장으로 정리" desc="영상 직후, 세 문장으로 다시 짚어 주세요.">
        <div className="grid gap-3 lg:grid-cols-3">
          {SUMMARY.map((s, i) => (
            <div key={s.k} className={`card p-6 ${i === 2 ? "border-2 border-primary/40" : ""}`}>
              <p className="text-[17.5px] font-bold text-primary-dark">{s.k}</p>
              <p className="mt-1 text-[24px] leading-snug font-extrabold">{s.title}</p>
              <p className="mt-2.5 text-[19.5px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="card mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 p-5">
          <Workflow size={24} className="text-primary" />
          {["업무지시", "확인", "작업개시", "작업보고", "관리자 확인"].map((s, i) => (
            <span key={s} className="flex items-center gap-3 text-[20.5px] font-bold">
              {i > 0 && <ArrowRight size={18} className="text-ink-3" />}
              {s}
            </span>
          ))}
        </div>
      </Section>

      {/* 3. 라이브 시연 */}
      <Section id="live" n={3} title="실제 화면으로 시연" desc="버튼을 누르면 화면이 차례로 열리고, 보여줄 곳이 밝게 표시되며, 설명할 문장이 함께 뜹니다.">
        <div className="card p-6">
          <ol className="grid gap-2 md:grid-cols-2">
            {TOUR_STEPS.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => startTour(i)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-line px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-primary-light/40"
                >
                  <span className="flex h-[2.2rem] w-[2.2rem] shrink-0 items-center justify-center rounded-full bg-primary-light text-[17px] font-extrabold text-primary-dark">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16.5px] font-semibold text-ink-3">{s.chapter}</span>
                    <span className="block text-[20.5px] leading-snug font-bold">{s.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <button
            onClick={() => startTour(0)}
            className="mt-4 inline-flex min-h-[3.75rem] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[21px] font-bold text-white transition-colors hover:bg-primary-dark active:scale-[0.99]"
          >
            <MonitorPlay size={24} /> 1번부터 시연 시작
          </button>
          <p className="mt-2.5 text-center text-[17.5px] text-ink-3">
            직원 화면 단계에서는 자동으로 현장책임자 계정으로 바뀌고, 시연을 마치면 이사 계정으로 돌아옵니다.
          </p>
        </div>
      </Section>

      {/* 4. 로드맵 */}
      <Section id="roadmap" n={4} title="앞으로 어떻게 개발되는가" desc="지금 만든 MVP를 기준으로, 작게 실증하고 확인한 뒤 넓혀 갑니다.">
        <div className="card p-6">
          <ol className="relative space-y-5 pl-2">
            <span className="absolute top-3 bottom-3 left-[1.35rem] w-[2px] bg-line" aria-hidden />
            {ROADMAP.map((r) => (
              <li key={r.title} className="relative flex gap-4">
                <span
                  className={`relative z-[1] flex h-[2.3rem] w-[2.3rem] shrink-0 items-center justify-center rounded-full ${
                    r.status === "done"
                      ? "bg-primary text-white"
                      : r.status === "now"
                        ? "border-[3px] border-primary bg-white text-primary"
                        : "border-2 border-dashed border-ink-3/50 bg-white text-ink-3"
                  }`}
                >
                  {r.status === "done" ? <CheckCircle2 size={20} /> : r.status === "now" ? <Map size={18} /> : <CircleDashed size={18} />}
                </span>
                <div className="min-w-0 pb-1">
                  <p className={`text-[17px] font-bold ${r.status === "next" ? "text-ink-3" : "text-primary-dark"}`}>{r.when}</p>
                  <p className="text-[23px] leading-snug font-extrabold">{r.title}</p>
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
            ))}
          </ol>
          <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-5">
            <p className="text-[19.5px] font-bold">실증에서 측정할 것</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {MEASURE.map((m) => (
                <span key={m} className="rounded-full bg-white px-4 py-2 text-[19px] font-semibold text-ink-2 shadow-[var(--shadow-card)]">
                  {m} 감소
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[17.5px] text-ink-3">아직 실측 수치는 없습니다. 실증 데이터로 도입 전과 비교합니다.</p>
          </div>
        </div>
      </Section>

      {/* 5. 예상 질문 */}
      <Section id="qna" n={5} title="예상 질문과 답변" desc="실사에서 나올 만한 질문을 사실 그대로 정리했습니다.">
        <div className="card divide-y divide-line p-2">
          {QNA.map((x, i) => (
            <div key={x.q}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-4 text-left hover:bg-[#f7f8fa]"
              >
                <span className="text-[21px] font-bold">
                  <span className="mr-2 text-primary">Q.</span>
                  {x.q}
                </span>
                <ChevronDown size={22} className={`shrink-0 text-ink-3 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="px-4 pb-5 pl-[3.1rem] text-[20px] leading-relaxed text-ink-2">{x.a}</p>}
            </div>
          ))}
        </div>
      </Section>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-6">
        <p className="text-[20px] font-semibold text-ink-2">대표님 · 이사님께 실제 사용 방법을 보여드릴 때는 사용법 영상을 활용하세요.</p>
        <a href="/videos/guide" className="inline-flex items-center gap-1.5 text-[20px] font-bold text-primary-dark hover:underline">
          사용법 영상 <ArrowRight size={20} />
        </a>
      </div>
    </div>
  );
}
