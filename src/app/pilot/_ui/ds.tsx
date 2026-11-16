/**
 * 하나 AX 디자인 시스템 — 실증 화면 공용 부품 (docs/DESIGN_SYSTEM.md)
 * 포인트 색 1개(primary 인디고) + 뜻에 따른 상태 색(위험·주의·정상) + 시험 데이터 점선.
 * 서버·클라이언트 컴포넌트 어디서나 쓸 수 있게 상태(state)를 갖지 않는다.
 */
import type { ReactNode } from "react";

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

type BtnVariant = "primary" | "dark" | "soft" | "ghost" | "danger" | "outline" | "white";
type BtnSize = "xl" | "lg" | "md" | "sm";

const BTN_V: Record<BtnVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark shadow-[0_6px_16px_-6px_rgba(79,70,229,0.55)]",
  dark: "bg-ink text-white hover:bg-[#262a33]",
  soft: "bg-primary-light text-primary-dark hover:bg-[#e2e5ff]",
  ghost: "bg-[#eef0f3] text-ink-2 hover:bg-[#e4e7eb]",
  danger: "bg-danger text-white hover:bg-[#b91c1c]",
  outline: "bg-white text-ink-2 ring-1 ring-line ring-inset hover:bg-[#f7f8fa]",
  white: "bg-white text-ink-2 hover:bg-[#f2f3f5]",
};
const BTN_S: Record<BtnSize, string> = {
  xl: "min-h-[3.75rem] rounded-2xl px-5 text-[19px] gap-2",
  lg: "min-h-[3.25rem] rounded-2xl px-4 text-[17px] gap-2",
  md: "min-h-[2.75rem] rounded-xl px-3.5 text-[15.5px] gap-1.5",
  sm: "min-h-[2.25rem] rounded-lg px-2.5 text-[14px] gap-1",
};

/** 버튼 클래스 — 누를 수 없는 상태는 흐리게, 누르는 순간 살짝 눌림 */
export function btn(v: BtnVariant = "primary", size: BtnSize = "md", block = false): string {
  return cx(
    "inline-flex select-none items-center justify-center font-bold whitespace-nowrap transition-colors active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40",
    BTN_V[v],
    BTN_S[size],
    block && "w-full",
  );
}

/** 선택 칩 — 손가락으로 누르기 쉬운 크기 · 선택하면 포인트 색 */
export function chip(on: boolean, tone: "primary" | "danger" = "primary"): string {
  return cx(
    "inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-full px-4 text-[15.5px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-40",
    on ? (tone === "danger" ? "bg-danger text-white" : "bg-primary text-white") : "bg-[#eef0f3] text-ink-2 hover:bg-[#e4e7eb]",
  );
}

export type PillTone = "neutral" | "info" | "success" | "warning" | "danger" | "test" | "dark";
const PILL: Record<PillTone, string> = {
  neutral: "bg-[#eef0f3] text-ink-2",
  info: "bg-info-bg text-info",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  test: "bg-test-bg text-test border border-dashed border-[#94a3b8]",
  dark: "bg-ink text-white",
};
const DOT: Record<PillTone, string> = {
  neutral: "bg-ink-3",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-[#f59e0b]",
  danger: "bg-danger",
  test: "bg-test",
  dark: "bg-white",
};

/** 상태 칩 — 색은 뜻대로 (위험 빨강 · 주의 주황 · 정상 초록 · 진행 인디고 · 시험 회청 점선) */
export function Pill({ tone = "neutral", dot = true, children, className }: { tone?: PillTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13.5px] leading-none font-bold whitespace-nowrap", PILL[tone], className)}>
      {dot && <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", DOT[tone])} />}
      {children}
    </span>
  );
}

/** 화면 제목 — 제목 · 한 줄 설명 · 오른쪽 행동 */
export function PageHead({ title, sub, right, eyebrow }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[13.5px] font-bold tracking-wide text-primary">{eyebrow}</p>}
        <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.01em] text-ink">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-ink-3">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/** 구역 제목 */
export function SectionHead({ title, count, right, id }: { title: ReactNode; count?: number; right?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-2" id={id}>
      <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-ink">
        {title}
        {count !== undefined && <span className="rounded-full bg-[#eef0f3] px-2 py-0.5 text-[13px] font-bold text-ink-2 tabular-nums">{count}</span>}
      </h2>
      {right}
    </div>
  );
}

/** 대시보드 핵심 숫자 */
export function Stat({ label, value, unit, tone = "neutral", hint, href, ariaLabel }: { label: string; value: ReactNode; unit?: string; tone?: PillTone; hint?: ReactNode; href?: string; ariaLabel?: string }) {
  const color = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "info" ? "text-primary" : "text-ink";
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-3">
        <span aria-hidden className={cx("h-2 w-2 rounded-full", DOT[tone])} />
        {label}
      </p>
      <p className={cx("mt-1.5 text-[30px] leading-none font-extrabold tabular-nums", color)}>
        {value}
        {unit && <span className="ml-0.5 text-[16px] font-bold text-ink-3">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-[13px] leading-snug text-ink-3">{hint}</p>}
    </>
  );
  const cls = "card block min-w-0 px-4 py-4";
  return href ? (
    <a href={href} className={cx(cls, "card-hover")} aria-label={ariaLabel}>
      {body}
    </a>
  ) : (
    <div className={cls} aria-label={ariaLabel}>
      {body}
    </div>
  );
}

/** 데이터 없음 */
export function Empty({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] bg-white px-6 py-10 text-center">
      {icon && <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f3f6] text-ink-3">{icon}</div>}
      <p className="text-[17px] font-bold text-ink-2">{title}</p>
      {desc && <p className="max-w-[28rem] text-[14.5px] text-ink-3">{desc}</p>}
      {action}
    </div>
  );
}

/** 결과 메시지 — 성공 · 오류 · 주의 · 안내 (모든 화면 같은 모양) */
export function Notice({ kind = "info", title, children, className }: { kind?: "success" | "error" | "warn" | "info"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const tone =
    kind === "success" ? "bg-success-bg text-success" : kind === "error" ? "bg-danger-bg text-danger" : kind === "warn" ? "bg-warning-bg text-warning" : "bg-info-bg text-primary-dark";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cx("rounded-2xl px-4 py-3 text-[15.5px] font-semibold", tone, className)}>
      {title && <p className="font-extrabold">{title}</p>}
      {children}
    </div>
  );
}

/** 자세한 설명 · 계산 근거 펼쳐보기 (기본 화면은 핵심만) */
export function More({ summary, children, className, open }: { summary: ReactNode; children: ReactNode; className?: string; open?: boolean }) {
  return (
    <details className={cx("group rounded-2xl bg-[#f7f8fa] px-4 py-3 [&_summary::-webkit-details-marker]:hidden", className)} open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[14.5px] font-bold text-ink-2">
        {summary}
        <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="mt-2 text-[14.5px] text-ink-2">{children}</div>
    </details>
  );
}

/** 단계 진행 표시 — 1 → 2 → 3 … (완료 · 지금 · 남음) */
export function Steps({ items, current, label = "진행 단계" }: { items: string[]; current: number; label?: string }) {
  return (
    <ol aria-label={label} className="flex items-center gap-1.5">
      {items.map((x, i) => (
        <li key={x} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cx("h-1.5 rounded-full", i < current ? "bg-primary" : i === current ? "bg-primary/45" : "bg-[#e4e7eb]")} />
          <span className={cx("truncate text-[12px] font-semibold", i <= current ? "text-primary-dark" : "text-ink-3")}>{x}</span>
        </li>
      ))}
    </ol>
  );
}
