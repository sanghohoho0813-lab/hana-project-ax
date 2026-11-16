"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, BarChart3, CalendarDays, ClipboardList, HardHat, LayoutDashboard, UserCog } from "lucide-react";

/** 관리자 메뉴 — 주요 5개 + 더보기 2개. 날짜 · 데이터 구분(?date=&kind=)은 메뉴를 옮겨도 그대로 이어진다 */
const MAIN = [
  { href: "/pilot/admin", label: "대시보드", icon: LayoutDashboard, match: (p: string) => p === "/pilot/admin" },
  { href: "/pilot/admin/schedule", label: "현장·일정", icon: CalendarDays, match: (p: string) => p.startsWith("/pilot/admin/schedule") },
  { href: "/pilot/admin/cases", label: "문제·지원", icon: AlertTriangle, match: (p: string) => p.startsWith("/pilot/admin/cases") },
  { href: "/pilot/admin/safety", label: "안전관리", icon: HardHat, match: (p: string) => p.startsWith("/pilot/admin/safety") },
  { href: "/pilot/admin/measures", label: "성과·증빙", icon: BarChart3, match: (p: string) => p.startsWith("/pilot/admin/measures") },
];
const MORE = [
  { href: "/pilot/admin/records", label: "기록·판단 이력", icon: ClipboardList, match: (p: string) => p.startsWith("/pilot/admin/records") || p.startsWith("/pilot/admin/judgments") },
  { href: "/pilot/admin/staff", label: "계정", icon: UserCog, match: (p: string) => p.startsWith("/pilot/admin/staff"), plain: true },
];

export function AdminSidebar() {
  const path = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["date", "kind"]) {
    const v = sp.get(k);
    if (v) keep.set(k, v);
  }
  const qs = keep.toString();
  const to = (href: string, plain?: boolean) => (qs && !plain ? `${href}?${qs}` : href);
  const item = (x: (typeof MAIN)[number] & { plain?: boolean }, mobile: boolean) => {
    const on = x.match(path);
    const Icon = x.icon;
    return (
      <Link
        key={x.href}
        href={to(x.href, x.plain)}
        aria-current={on ? "page" : undefined}
        className={
          mobile
            ? `inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold ${on ? "bg-ink text-white" : "bg-white text-ink-2"}`
            : `flex min-h-[2.75rem] items-center gap-3 rounded-xl px-3 text-[15.5px] font-bold transition-colors ${on ? "bg-primary-light text-primary-dark" : "text-ink-2 hover:bg-white"}`
        }
      >
        <Icon size={mobile ? 16 : 19} className={on ? "" : "text-ink-3"} aria-hidden />
        {x.label}
      </Link>
    );
  };
  return (
    <>
      {/* PC: 왼쪽 고정 메뉴 */}
      <nav aria-label="관리자 메뉴" className="sticky top-[4.5rem] hidden space-y-1 self-start lg:block print:hidden">
        {MAIN.map((x) => item(x, false))}
        <p className="px-3 pt-5 pb-1 text-[13.5px] font-bold tracking-wide text-ink-3">더보기</p>
        {MORE.map((x) => item(x, false))}
      </nav>
      {/* 모바일 · 태블릿: 위쪽 가로 메뉴 */}
      <nav aria-label="관리자 메뉴 (모바일)" className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden print:hidden">
        {[...MAIN, ...MORE].map((x) => item(x, true))}
      </nav>
    </>
  );
}
