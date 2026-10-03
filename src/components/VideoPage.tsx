"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Captions, Clock, Download, Gauge, ListVideo, Play, Users } from "lucide-react";
import { PageIntro } from "@/components/ui";

export interface VideoChapter {
  /** 시작 시각(초) */
  at: number;
  label: string;
}

export interface VideoInfo {
  src: string;
  poster: string;
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

export function VideoPage({ video, intro }: { video: VideoInfo; intro: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState<number>(1);
  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);

  const applyRate = (r: number) => {
    setRate(r);
    if (ref.current) ref.current.playbackRate = r;
  };

  const seek = (at: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = at;
    v.play().catch(() => {});
    // 휴대폰에서는 목차가 영상 아래에 있으므로 영상이 보이게 올려 준다
    v.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const current = video.chapters.reduce(
    (acc, c, i) => (time >= c.at - 0.25 ? i : acc),
    0,
  );
  const remaining = (video.duration - time) / rate;

  return (
    <div className="page-in space-y-6">
      <PageIntro message={intro} />

      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        {/* 영상 — 세로 9:16 */}
        <div className="mx-auto w-full max-w-[24rem] lg:sticky lg:top-[10.5rem] lg:mx-0 lg:w-[calc(min(72vh,56rem)*0.5625/var(--app-scale,1))] lg:max-w-none">
          <div className="relative aspect-[9/16] overflow-hidden rounded-3xl bg-[#0f1216] shadow-[var(--shadow-card-hover)]">
            <video
              ref={ref}
              src={video.src}
              poster={video.poster}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full"
              onLoadedMetadata={(e) => {
                e.currentTarget.playbackRate = rate;
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
        </div>

        {/* 정보 · 배속 · 목차 */}
        <div className="min-w-0 space-y-4">
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f4f6] px-3 py-1.5">
                세로 영상 · 휴대폰 화면 기준
              </span>
            </div>
          </div>

          {/* 배속 */}
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
                      on
                        ? "bg-primary text-white shadow-[0_8px_20px_-8px_rgba(49,130,246,.6)]"
                        : "bg-[#f2f4f6] text-ink-2 hover:bg-[#e8ebee]"
                    }`}
                  >
                    {rateLabel(r)}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[18px] text-ink-3">
              누르는 즉시 바뀝니다. 목소리 높낮이는 그대로 유지됩니다.
            </p>
          </div>

          {/* 목차 */}
          <div className="card p-6">
            <p className="flex items-center gap-2 text-[22.5px] font-bold">
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
                      <span
                        className={`w-[3.6rem] shrink-0 text-[18px] font-bold tabular-nums ${
                          on ? "text-primary-dark" : "text-ink-3"
                        }`}
                      >
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
              <Link
                href={video.other.href}
                className="inline-flex items-center gap-1.5 text-[20px] font-bold text-primary-dark hover:underline"
              >
                {video.other.label} <ArrowRight size={20} />
              </Link>
              <a
                href={video.srt}
                download
                className="inline-flex items-center gap-1.5 text-[19px] font-semibold text-ink-2 hover:text-ink"
              >
                <Download size={19} /> 자막 파일(SRT)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
