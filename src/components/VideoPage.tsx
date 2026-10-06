"use client";

import React, { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Captions,
  Clock,
  Download,
  Gauge,
  ListVideo,
  Monitor,
  Play,
  Smartphone,
  Users,
} from "lucide-react";
import { PageIntro } from "@/components/ui";

export interface VideoChapter {
  /** 시작 시각(초) */
  at: number;
  label: string;
}

export type Orientation = "h" | "v";

export interface VideoInfo {
  /** 가로(16:9)·세로(9:16) 두 판 — 같은 시간축이라 바꿔도 이어서 재생된다 */
  src: Record<Orientation, string>;
  poster: Record<Orientation, string>;
  title: string;
  /** 누구에게 보여주는 영상인지 */
  audience: string;
  desc: string;
  /** 영상 길이(초) */
  duration: number;
  chapters: VideoChapter[];
  notes: string[];
  /** 자막 파일 (SRT) */
  srt: string;
  other: { href: string; label: string };
}

const RATES = [1, 1.25, 1.5] as const;

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function rateLabel(r: number): string {
  return r === 1 ? "1배속" : `${r}배속`;
}

const MQ = "(max-width: 1023px)";
function subscribeMq(cb: () => void) {
  const m = window.matchMedia(MQ);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

export function VideoPage({ video, intro }: { video: VideoInfo; intro: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // 화면 폭으로 기본 방향을 고르고, 사용자가 누르면 그 선택을 따른다
  const isNarrow = useSyncExternalStore(subscribeMq, () => window.matchMedia(MQ).matches, () => false);
  const [chosen, setChosen] = useState<Orientation | null>(null);
  const orient: Orientation = chosen ?? (isNarrow ? "v" : "h");
  const [rate, setRate] = useState<number>(1);
  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  /** 방향을 바꿀 때 이어 붙일 위치·재생 상태 */
  const resume = useRef<{ t: number; playing: boolean } | null>(null);

  const applyRate = (r: number) => {
    setRate(r);
    if (ref.current) ref.current.playbackRate = r;
  };

  const switchTo = (o: Orientation) => {
    if (o === orient) return;
    const v = ref.current;
    if (v) resume.current = { t: v.currentTime, playing: !v.paused && !v.ended };
    setChosen(o);
  };

  const seek = (at: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = at;
    v.play().catch(() => {});
    v.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const current = video.chapters.reduce((acc, c, i) => (time >= c.at - 0.25 ? i : acc), 0);
  const remaining = (video.duration - time) / rate;
  const H = orient === "h";

  const player = (
    <div
      className={`relative overflow-hidden rounded-3xl bg-[#0f1216] shadow-[var(--shadow-card-hover)] ${
        H ? "aspect-video w-full" : "aspect-[9/16] w-full"
      }`}
    >
      <video
        key={orient}
        ref={ref}
        src={video.src[orient]}
        poster={video.poster[orient]}
        controls
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          v.playbackRate = rate;
          const r = resume.current;
          if (r) {
            v.currentTime = Math.min(r.t, v.duration || r.t);
            if (r.playing) v.play().catch(() => {});
            resume.current = null;
          }
        }}
        onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setStarted(true)}
      />
      {!started && (
        <button
          onClick={() => ref.current?.play().catch(() => {})}
          aria-label={`${video.title} 재생`}
          className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/0"
        >
          <span className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-white/95 text-ink shadow-xl">
            <Play size={38} className="ml-1" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );

  const orientToggle = (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#e8ebee] p-1.5" role="group" aria-label="화면 방향">
      {(
        [
          ["h", "가로 · 모니터", Monitor],
          ["v", "세로 · 휴대폰", Smartphone],
        ] as const
      ).map(([o, label, Icon]) => {
        const on = orient === o;
        return (
          <button
            key={o}
            onClick={() => switchTo(o)}
            aria-pressed={on}
            className={`inline-flex min-h-[3.4rem] items-center justify-center gap-2 rounded-xl text-[19.5px] font-bold transition-all ${
              on ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            <Icon size={22} /> {label}
          </button>
        );
      })}
    </div>
  );

  const speedCard = (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[22.5px] font-bold">
          <Gauge size={24} className="text-primary" /> 재생 속도
        </p>
        <p className="text-[18px] text-ink-3">
          남은 시간 약 {mmss(remaining)} · {rateLabel(rate)} 기준
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="재생 속도">
        {RATES.map((r) => {
          const on = Math.abs(rate - r) < 0.001;
          return (
            <button
              key={r}
              onClick={() => applyRate(r)}
              aria-pressed={on}
              className={`min-h-[3.75rem] rounded-2xl text-[22px] font-extrabold transition-all active:scale-[0.98] ${
                on ? "bg-primary text-white shadow-[0_8px_20px_-8px_rgba(49,130,246,.6)]" : "bg-[#f2f4f6] text-ink-2 hover:bg-[#e8ebee]"
              }`}
            >
              {rateLabel(r)}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[18px] text-ink-3">누르는 즉시 바뀝니다. 가로·세로를 바꿔도 보던 곳에서 이어집니다.</p>
    </div>
  );

  const chapterCard = (
    <div className="card p-6">
      <p className="flex flex-wrap items-center gap-2 text-[22.5px] font-bold">
        <ListVideo size={24} className="text-primary" /> 목차
        <span className="text-[18px] font-medium text-ink-3">누르면 그 장면으로 이동합니다</span>
      </p>
      <ol className="mt-3 space-y-1">
        {video.chapters.map((c, i) => {
          const on = started && i === current;
          return (
            <li key={c.at}>
              <button
                onClick={() => seek(c.at)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  on ? "bg-primary-light" : "hover:bg-[#f7f8fa]"
                }`}
              >
                <span className={`w-[3.6rem] shrink-0 text-[18px] font-bold tabular-nums ${on ? "text-primary-dark" : "text-ink-3"}`}>
                  {mmss(c.at)}
                </span>
                <span className={`min-w-0 flex-1 text-[20.2px] font-semibold ${on ? "text-primary-dark" : "text-ink"}`}>
                  {c.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const infoCard = (
    <div className="card p-6">
      <p className="flex items-center gap-1.5 text-[18px] font-semibold text-primary-dark">
        <Users size={20} /> {video.audience}
      </p>
      <h2 className="mt-1.5 text-[30px] leading-tight font-extrabold">{video.title}</h2>
      <p className="mt-2 text-[20.2px] leading-relaxed text-ink-2">{video.desc}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-[18px] font-semibold text-ink-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f4f6] px-3 py-1.5">
          <Clock size={19} /> {mmss(video.duration)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f4f6] px-3 py-1.5">
          <Captions size={19} /> 한글 자막 포함
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f4f6] px-3 py-1.5">가로 · 세로 두 가지</span>
      </div>
    </div>
  );

  const notesCard = (
    <div className="card p-6">
      <ul className="space-y-1.5 text-[18.5px] leading-relaxed text-ink-2">
        {video.notes.map((n) => (
          <li key={n} className="flex gap-2">
            <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
            {n}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href={video.other.href} className="inline-flex items-center gap-1.5 text-[20px] font-bold text-primary-dark hover:underline">
          {video.other.label} <ArrowRight size={20} />
        </Link>
        <a href={video.srt} download className="inline-flex items-center gap-1.5 text-[19px] font-semibold text-ink-2 hover:text-ink">
          <Download size={19} /> 자막 파일(SRT)
        </a>
      </div>
    </div>
  );

  return (
    <div className="page-in space-y-6">
      <PageIntro message={intro} />

      {H ? (
        <div className="space-y-6">
          <div className="mx-auto w-full max-w-[min(100%,calc(72vh*1.7778/var(--app-scale,1)))] space-y-3">
            {orientToggle}
            {player}
          </div>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              {speedCard}
              {infoCard}
            </div>
            <div className="space-y-4">
              {chapterCard}
              {notesCard}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
          <div className="mx-auto w-full max-w-[24rem] space-y-3 lg:sticky lg:top-[10.5rem] lg:mx-0 lg:w-[calc(min(68vh,54rem)*0.5625/var(--app-scale,1))] lg:max-w-none">
            {orientToggle}
            {player}
          </div>
          <div className="min-w-0 space-y-4">
            {speedCard}
            {chapterCard}
            {infoCard}
            {notesCard}
          </div>
        </div>
      )}
    </div>
  );
}
