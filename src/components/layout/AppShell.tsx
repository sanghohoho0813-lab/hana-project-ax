"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Bell,
  Briefcase,
  CalendarCheck,
  ClipboardList,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  Menu,
  PhoneCall,
  PieChart,
  PlusSquare,
  Search,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "@/lib/store";
import type { BusinessView } from "@/lib/types";
import { Segment } from "@/components/ui";

const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
}[] = [
  {
    label: "영업",
    items: [
      { href: "/", label: "오늘", icon: LayoutDashboard },
      { href: "/inquiries", label: "문의·견적", icon: PhoneCall },
      { href: "/customers", label: "고객·재수주", icon: Users },
    ],
  },
  {
    label: "공사관리",
    items: [
      { href: "/projects", label: "프로젝트", icon: Briefcase },
      { href: "/logs", label: "현장일보", icon: ClipboardList },
      { href: "/change-orders", label: "추가공사", icon: PlusSquare },
      { href: "/profit", label: "원가·수익", icon: PieChart },
    ],
  },
  {
    label: "정산·자료",
    items: [
      { href: "/closeout", label: "준공·수금", icon: Banknote },
      { href: "/consulting", label: "하나컨설팅", icon: Handshake },
      { href: "/documents", label: "문서함", icon: FolderOpen },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "오늘",
  "/inquiries": "문의·견적",
  "/customers": "고객·재수주",
  "/projects": "프로젝트",
  "/logs": "현장일보",
  "/change-orders": "추가공사",
  "/profit": "원가·수익",
  "/closeout": "준공·수금",
  "/consulting": "하나컨설팅",
  "/documents": "문서함",
  "/approvals": "대표 승인함",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-6"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          <Zap size={18} strokeWidth={2.4} />
        </span>
        <span>
          <span className="block text-[16px] leading-tight font-extrabold">
            하나 프로젝트 AX
          </span>
          <span className="block text-[11px] text-ink-3">
            하나정보통신 × 하나컨설팅
          </span>
        </span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-2.5 text-[11px] font-bold tracking-wide text-ink-3">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] font-semibold transition-colors ${
                        active
                          ? "bg-primary-light text-primary-dark"
                          : "text-ink-2 hover:bg-[#f2f4f6]"
                      }`}
                    >
                      <item.icon size={17} strokeWidth={active ? 2.4 : 2} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-4">
        <p className="text-[12px] leading-relaxed text-ink-3">
          충남 보령 · 전기공사 / 정보통신공사
          <br />
          데모 기준일 2026년 7월 28일
        </p>
      </div>
    </div>
  );
}

function HeaderSearch() {
  const { projects } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);

  const results = useMemo(() => {
    if (q.trim().length < 1) return [];
    return projects
      .filter(
        (p) =>
          p.name.includes(q) || p.region.includes(q) || p.workType.includes(q)
      )
      .slice(0, 5);
  }, [q, projects]);

  return (
    <div className="relative hidden w-full max-w-xs md:block">
      <Search
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) {
            router.push(`/documents?q=${encodeURIComponent(q.trim())}`);
            setQ("");
          }
        }}
        placeholder="프로젝트·문서 검색"
        className="w-full rounded-xl border border-transparent bg-[#eceff2] py-2 pr-3 pl-9 text-[14px] outline-none transition-all placeholder:text-ink-3 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
      />
      {focus && results.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card-hover)]">
          {results.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => {
                router.push(`/projects/${p.id}`);
                setQ("");
              }}
              className="block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[#f7f8fa]"
            >
              <span className="font-semibold">{p.name}</span>
              <span className="ml-2 text-ink-3">{p.region}</span>
            </button>
          ))}
          <button
            onMouseDown={() => {
              router.push(`/documents?q=${encodeURIComponent(q.trim())}`);
              setQ("");
            }}
            className="block w-full border-t border-line px-4 py-2.5 text-left text-[13px] font-semibold text-primary hover:bg-[#f7f8fa]"
          >
            문서함에서 &ldquo;{q}&rdquo; 통합 검색
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { business, setBusiness, approvals, toast } = useApp();
  const [drawer, setDrawer] = useState(false);

  const title =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/projects/") ? "프로젝트 상세" : "하나 프로젝트 AX");
  const pendingApprovals = approvals.filter((a) => a.status === "대기").length;

  return (
    <div className="flex min-h-screen">
      {/* 데스크톱 사이드바 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* 모바일 드로어 */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button
              onClick={() => setDrawer(false)}
              aria-label="메뉴 닫기"
              className="absolute top-5 right-4 rounded-full p-2 text-ink-3 hover:bg-[#f2f4f6]"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* 헤더 */}
        <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-7">
            <button
              onClick={() => setDrawer(true)}
              aria-label="메뉴 열기"
              className="rounded-xl p-2 text-ink-2 hover:bg-[#f2f4f6] lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold lg:flex-none">
              {title}
            </h1>
            <div className="flex flex-1 items-center justify-end gap-2.5 lg:gap-3">
              <HeaderSearch />
              <div className="hidden sm:block">
                <Segment<BusinessView>
                  size="sm"
                  value={business}
                  onChange={setBusiness}
                  options={[
                    { value: "all", label: "전체" },
                    { value: "hana", label: "하나정보통신" },
                    { value: "consulting", label: "하나컨설팅" },
                  ]}
                />
              </div>
              <Link
                href="/approvals"
                aria-label="대표 승인함"
                className="relative rounded-xl p-2 text-ink-2 transition-colors hover:bg-[#f2f4f6]"
              >
                <Bell size={19} />
                {pendingApprovals > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {pendingApprovals}
                  </span>
                )}
              </Link>
              <div className="hidden items-center gap-2 rounded-xl bg-[#f2f4f6] py-1.5 pr-3 pl-1.5 md:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[12px] font-bold text-white">
                  구
                </span>
                <span className="text-[13px] font-semibold">구본석 이사</span>
              </div>
            </div>
          </div>
          {/* 모바일 사업자 전환 */}
          <div className="flex justify-center border-t border-line px-4 py-2 sm:hidden">
            <Segment<BusinessView>
              size="sm"
              value={business}
              onChange={setBusiness}
              options={[
                { value: "all", label: "전체" },
                { value: "hana", label: "하나정보통신" },
                { value: "consulting", label: "하나컨설팅" },
              ]}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-7 lg:py-8">
          {children}
        </main>

        <footer className="px-4 pb-6 text-center text-[11.5px] text-ink-3">
          하나 프로젝트 AX 데모 · 하나정보통신(시공)과 하나컨설팅(프로젝트
          기획·운영관리)의 업무를 구분해 관리합니다
        </footer>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="toast-in fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-ink px-5 py-3 text-[14px] font-semibold text-white shadow-xl">
          <span className="flex items-center gap-2">
            <CalendarCheck size={16} className="text-[#7db8ff]" />
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
