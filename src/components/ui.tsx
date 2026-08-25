"use client";

import React, { useEffect, useRef, useState } from "react";
import { Inbox, X } from "lucide-react";

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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[18px] font-semibold whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
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
    default:
      return "neutral";
  }
}

// ───────────── ProgressBar ─────────────
export function ProgressBar({
  value,
  tone = "info",
  thick = false,
  className = "",
}: {
  value: number;
  tone?: Tone;
  thick?: boolean;
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
    <div
      className={`${thick ? "h-[0.9rem]" : "h-[0.55rem]"} w-full overflow-hidden rounded-full bg-[#eceff2] ${className}`}
    >
      <div
        className={`bar-fill h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ───────────── CountUp ─────────────
/** 첫 진입에만 카운트업하고, 이후 값 변경은 부드럽게 이어서 올라간다 */
export function CountUp({
  value,
  format,
  duration = 700,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const from = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const origin = mounted.current ? from.current : 0;
    mounted.current = true;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = origin + (value - origin) * eased;
      from.current = next;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
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
  desc,
  children,
  size = "md",
  bodyClassName = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
  /** 인쇄 등 특수 목적으로 모달 본문에 붙일 클래스 */
  bodyClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // 열릴 때 모달로 초점을 옮겨야 키보드 사용자가 바로 내용을 읽는다
    const restore = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      restore?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width =
    size === "xl"
      ? "sm:max-w-[72rem]"
      : size === "lg"
        ? "sm:max-w-[60rem]"
        : "sm:max-w-[48rem]";
  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`modal-in max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-[var(--shadow-modal)] outline-none sm:rounded-3xl ${width} ${bodyClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[28.5px] font-bold">{title}</h2>
            {desc && <p className="mt-1 text-[20.2px] text-ink-2">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mt-1 shrink-0 rounded-full p-2 text-ink-3 transition-colors hover:bg-[#f2f4f6] hover:text-ink"
          >
            <X size={27} />
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
  hint,
  children,
  required = false,
  group = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
  /** 버튼 여러 개를 담는 그룹이면 true — label로 감싸지 않아 버튼 이름이 섞이지 않는다 */
  group?: boolean;
}) {
  const Wrapper = group ? "div" : "label";
  return (
    <Wrapper
      className="block"
      {...(group ? { role: "group", "aria-label": label } : {})}
    >
      <span className="mb-1.5 block text-[19.5px] font-semibold text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
        {hint && <span className="ml-1.5 font-medium text-ink-3">{hint}</span>}
      </span>
      {children}
    </Wrapper>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[22.5px] outline-none transition-colors placeholder:text-ink-3 focus:border-primary focus:ring-2 focus:ring-primary/15";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[21px] font-semibold text-white transition-all hover:bg-primary-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[21px] font-semibold text-ink-2 transition-all hover:bg-[#e8ebee] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}

/** 흰 배경 위에 얹는 보조 버튼 */
export function SoftButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[21px] font-semibold text-ink-2 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] active:translate-y-0 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

// ───────────── 빈 상태 ─────────────
export function EmptyState({
  title,
  desc,
  action,
  icon,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="mb-1 flex h-[4rem] w-[4rem] items-center justify-center rounded-2xl bg-[#f2f4f6] text-ink-3">
        {icon ?? <Inbox size={30} />}
      </span>
      <p className="text-[23.2px] font-bold text-ink-2">{title}</p>
      {desc && (
        <p className="max-w-[28rem] text-[20.2px] leading-relaxed text-ink-3">
          {desc}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
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
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-[#e8ebee] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-lg font-semibold whitespace-nowrap transition-all ${
            size === "sm"
              ? "px-2.5 py-1 text-[18px]"
              : "px-3.5 py-1.5 text-[19.5px]"
          } ${value === o.value ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────────── 페이지 헤더 (한 줄 메시지) ─────────────
export function PageIntro({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[22.5px] font-semibold text-ink-2">{message}</p>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

// ───────────── 통계 타일 ─────────────
export function StatTile({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "danger" | "success";
  icon?: React.ReactNode;
}) {
  return (
    <div className="card card-hover flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-[18.8px] font-semibold text-ink-3">{label}</p>
        <p
          className={`mt-1.5 text-[31.5px] leading-tight font-extrabold tracking-tight ${
            tone === "danger"
              ? "text-danger"
              : tone === "success"
                ? "text-success"
                : ""
          }`}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-[18px] text-ink-3">{sub}</p>}
      </div>
      {icon && <span className="shrink-0 text-ink-3/60">{icon}</span>}
    </div>
  );
}
