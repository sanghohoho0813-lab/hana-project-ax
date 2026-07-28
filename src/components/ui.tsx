"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// ───────────── Badge ─────────────
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-[#f2f4f6] text-ink-2",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function statusTone(statusKey: string): Tone {
  switch (statusKey) {
    case "normal":
    case "preparing":
      return "info";
    case "caution":
      return "warning";
    case "delayed":
      return "danger";
    case "closeout":
      return "success";
    case "done":
      return "neutral";
    default:
      return "neutral";
  }
}

// ───────────── ProgressBar ─────────────
export function ProgressBar({
  value,
  tone = "info",
  className = "",
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const color =
    tone === "danger"
      ? "bg-danger"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "success"
          ? "bg-success"
          : "bg-primary";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-[#eceff2] ${className}`}>
      <div
        className={`bar-fill h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ───────────── CountUp ─────────────
export function CountUp({
  value,
  format,
  duration = 750,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) {
      setDisplay(value);
      return;
    }
    started.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(display)}</>;
}

// ───────────── Modal ─────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className={`rise-in max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-[var(--shadow-modal)] sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-ink-3 transition-colors hover:bg-[#f2f4f6] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ───────────── 폼 요소 ─────────────
export function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-ink-3 focus:border-primary focus:ring-2 focus:ring-primary/15";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[14px] font-semibold text-ink-2 transition-all hover:bg-[#e8ebee] active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

// ───────────── 빈 상태 ─────────────
export function EmptyState({
  title,
  desc,
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-ink-2">{title}</p>
      {desc && <p className="text-[13px] text-ink-3">{desc}</p>}
    </div>
  );
}

// ───────────── 세그먼트 컨트롤 ─────────────
export function Segment<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl bg-[#e8ebee] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg font-semibold transition-all ${
            size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]"
          } ${
            value === o.value
              ? "bg-white text-ink shadow-sm"
              : "text-ink-3 hover:text-ink-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
