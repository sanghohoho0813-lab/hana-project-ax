"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  FolderOpen,
  Handshake,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessagesSquare,
  PhoneCall,
  PieChart,
  PlayCircle,
  PlusSquare,
  RotateCcw,
  Search,
  Sparkles,
  Store as Storefront,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { COMPANY } from "@/lib/company";
import { MEMBERS, memberById } from "@/lib/team";
import { buildAlerts, opsKpi } from "@/lib/ops-calc";
import type { BusinessView } from "@/lib/types";
import { GhostButton, Modal, PrimaryButton, Segment } from "@/components/ui";
import { GuideOverlay, useGuide } from "@/components/GuideOverlay";
import { DemoPanel } from "@/components/DemoPanel";
import { FontScalePicker, useFontScale } from "@/components/FontScale";
import { StoreShell } from "@/components/store/StoreShell";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_GROUPS: { key: string; label: string; items: NavItem[] }[] = [
  {
    key: "today",
    label: "오늘",
    items: [
      { href: "/", label: "오늘의 업무", icon: LayoutDashboard },
      { href: "/brief", label: "관리자 브리핑", icon: Sparkles },
    ],
  },
  {
    key: "ops",
    label: "소통·일정",
    items: [
      { href: "/tasks", label: "업무지시", icon: ListChecks },
      { href: "/schedule", label: "통합일정", icon: CalendarDays },
      { href: "/reports", label: "업무보고", icon: FileBarChart },
      { href: "/comms", label: "현장소통", icon: MessagesSquare },
    ],
  },
  {
    key: "work",
    label: "공사관리",
    items: [
      { href: "/projects", label: "프로젝트", icon: Briefcase },
      { href: "/logs", label: "현장일보", icon: ClipboardList },
      { href: "/change-orders", label: "추가공사", icon: PlusSquare },
      { href: "/closeout", label: "준공·수금", icon: Banknote },
    ],
  },
  {
    key: "biz",
    label: "경영관리",
    items: [
      { href: "/profit", label: "원가·수익", icon: PieChart },
      { href: "/inquiries", label: "문의·견적", icon: PhoneCall },
      { href: "/customers", label: "고객·재수주", icon: Users },
      { href: "/insight", label: COMPANY.insight.name, icon: Handshake },
      { href: "/documents", label: "문서함", icon: FolderOpen },
      { href: "/approvals", label: "대표 승인함", icon: CheckCircle2 },
    ],
  },
  {
    key: "intel",
    label: "인사이트",
    items: [
      { href: "/procurement", label: "조달 인사이트", icon: Building2 },
      { href: "/performance", label: "운영성과", icon: TrendingUp },
    ],
  },
];

const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/": { title: "오늘의 업무", crumb: "오늘" },
  "/brief": { title: "관리자 브리핑", crumb: "오늘" },
  "/tasks": { title: "업무지시", crumb: "소통·일정" },
  "/schedule": { title: "통합일정", crumb: "소통·일정" },
  "/reports": { title: "업무보고", crumb: "소통·일정" },
  "/comms": { title: "현장소통", crumb: "소통·일정" },
  "/projects": { title: "프로젝트", crumb: "공사관리" },
  "/logs": { title: "현장일보", crumb: "공사관리" },
  "/change-orders": { title: "추가공사", crumb: "공사관리" },
  "/closeout": { title: "준공·수금", crumb: "공사관리" },
  "/profit": { title: "원가·수익", crumb: "경영관리" },
  "/inquiries": { title: "문의·견적", crumb: "경영관리" },
  "/customers": { title: "고객·재수주", crumb: "경영관리" },
  "/insight": { title: COMPANY.insight.name, crumb: "경영관리" },
  "/documents": { title: "문서함", crumb: "경영관리" },
  "/procurement": { title: "조달 인사이트", crumb: "인사이트" },
  "/performance": { title: "운영성과", crumb: "인사이트" },
  "/approvals": { title: "대표 승인함", crumb: "경영관리" },
};

/* ───────────── 사이드바 ───────────── */

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const {
    tasks,
    schedules,
    currentUserId,
    setCurrentUserId,
    permission,
    reports,
    approvals,
  } = useApp();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [switcher, setSwitcher] = useState(false);

  const me = memberById(currentUserId)!;
  const kpi = opsKpi(tasks, schedules);
  const mine = tasks.filter((t) => t.assigneeId === currentUserId);

  const counts: Record<string, number> = permission.managerHome
    ? {
        "/": kpi.unacked + kpi.overdue,
        "/tasks": kpi.unacked,
        "/schedule": kpi.conflicts,
        "/reports": reports.filter((r) => r.reviewStatus === "검토 대기")
          .length,
        "/approvals": approvals.filter((a) => a.status === "대기").length,
      }
    : {
        "/": mine.filter((t) => t.status === "지시됨").length,
        "/tasks": mine.filter((t) => t.status === "지시됨").length,
      };

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => permission.routes.includes(i.href)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-[#101a2e] text-white">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-4"
      >
        <span className="flex h-[3.375rem] w-[3.375rem] shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <CheckCircle2 size={26} strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[23px] leading-tight font-extrabold">
            {COMPANY.product.name}
          </span>
          <span className="block truncate text-[16.5px] text-white/45">
            업무지시 · 확인 · 보고 관리
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {groups.map((g) => {
          const hasActive = g.items.some((i) =>
            i.href === "/" ? pathname === "/" : pathname.startsWith(i.href),
          );
          const open = !collapsed[g.key] || hasActive;
          return (
            <div key={g.key}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[16.5px] font-bold tracking-wide text-white/40 transition-colors hover:text-white/70"
              >
                {g.label}
                <ChevronDown
                  size={18}
                  className={`transition-transform ${open ? "" : "-rotate-90"}`}
                />
              </button>
              {open && (
                <ul className="space-y-0.5">
                  {g.items.map((item) => {
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    const count = counts[item.href];
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[20.2px] font-semibold transition-colors ${
                            active
                              ? "bg-primary text-white"
                              : "text-white/65 hover:bg-white/8 hover:text-white"
                          }`}
                        >
                          <item.icon size={22} strokeWidth={active ? 2.4 : 2} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {count ? (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[15.5px] font-bold tabular-nums ${
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-danger text-white"
                              }`}
                            >
                              {count}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 px-3 pb-3">
        <p className="mb-1.5 px-3 text-[16.5px] font-bold tracking-wide text-white/35">
          외부 고객용
        </p>
        <Link
          href="/store"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/20 px-3 py-2 text-[20.2px] font-semibold text-white/70 transition-colors hover:border-white/35 hover:bg-white/8 hover:text-white"
        >
          <Storefront size={24} />
          <span className="flex-1 truncate">서비스몰</span>
        </Link>
      </div>

      <div className="relative shrink-0 border-t border-white/8 px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 px-1 text-[17.2px] font-semibold text-white/45">
          <span className="h-[0.45rem] w-[0.45rem] rounded-full bg-success" />
          {COMPANY.main.base} 본사 · 샘플 데이터
        </p>
        <button
          onClick={() => setSwitcher((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-2xl bg-white/6 p-3 text-left transition-colors hover:bg-white/10"
        >
          <span
            className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-xl text-[21px] font-bold text-white"
            style={{ background: me.color }}
          >
            {me.initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[20.2px] font-bold">
              {me.name} {me.roleLabel}
            </span>
            <span className="block truncate text-[17.2px] text-white/50">
              {me.desc}
            </span>
          </span>
          <ChevronDown
            size={20}
            className={`shrink-0 text-white/40 transition-transform ${switcher ? "rotate-180" : ""}`}
          />
        </button>

        {switcher && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setSwitcher(false)}
            />
            <div className="float-in absolute right-4 bottom-[7rem] left-4 z-40 overflow-hidden rounded-2xl bg-white p-1.5 shadow-[var(--shadow-modal)]">
              <p className="px-3 py-2 text-[16.5px] font-bold text-ink-3">
                사용자를 바꾸면 화면과 권한이 달라집니다
              </p>
              {MEMBERS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setCurrentUserId(m.id);
                    setSwitcher(false);
                    onNavigate?.();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    m.id === currentUserId
                      ? "bg-primary-light"
                      : "hover:bg-[#f7f8fa]"
                  }`}
                >
                  <span
                    className="flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded-lg text-[18px] font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.initial}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[19.5px] font-bold text-ink">
                      {m.name} {m.roleLabel}
                    </span>
                    <span className="block truncate text-[16.5px] text-ink-3">
                      {m.desc}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────── 헤더 검색 ───────────── */

function HeaderSearch() {
  const { projects, tasks } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);

  const results = useMemo(() => {
    if (q.trim().length < 1) return { projects: [], tasks: [] };
    return {
      projects: projects
        .filter((p) => p.name.includes(q) || p.region.includes(q))
        .slice(0, 3),
      tasks: tasks.filter((t) => t.title.includes(q)).slice(0, 3),
    };
  }, [q, projects, tasks]);

  const total = results.projects.length + results.tasks.length;

  return (
    <div className="relative hidden w-full max-w-[24rem] xl:block">
      <Search
        size={24}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder="업무·프로젝트 검색"
        className="w-full rounded-xl border border-transparent bg-[#eceff2] py-2 pr-3 pl-11 text-[20.2px] outline-none transition-all placeholder:text-ink-3 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
      />
      {focus && total > 0 && (
        <div className="absolute top-full right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-2xl bg-white py-1 shadow-[var(--shadow-card-hover)]">
          {results.tasks.map((t) => (
            <button
              key={t.id}
              onMouseDown={() => {
                router.push(`/tasks?task=${t.id}`);
                setQ("");
              }}
              className="block w-full px-4 py-2.5 text-left text-[19.5px] hover:bg-[#f7f8fa]"
            >
              <span className="font-semibold">{t.title}</span>
              <span className="ml-2 text-[17px] text-ink-3">업무</span>
            </button>
          ))}
          {results.projects.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => {
                router.push(`/projects/${p.id}`);
                setQ("");
              }}
              className="block w-full px-4 py-2.5 text-left text-[19.5px] hover:bg-[#f7f8fa]"
            >
              <span className="font-semibold">{p.name}</span>
              <span className="ml-2 text-[17px] text-ink-3">프로젝트</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── 셸 ───────────── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    business,
    setBusiness,
    tasks,
    schedules,
    toast,
    demoMode,
    setDemoMode,
    setDemoStep,
    resetDemo,
    permission,
    currentUserId,
  } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const { open: guideOpen, setOpen: setGuideOpen } = useGuide();
  const { scale, setScale } = useFontScale();

  const isStore = pathname.startsWith("/store");
  const me = memberById(currentUserId)!;

  // 브라우저 탭에 현재 화면 이름을 띄운다 — 데모 중 여러 탭을 오갈 때 구분된다
  const screenLabel = useMemo(() => {
    if (isStore) return "서비스 안내";
    if (pathname === "/") return "오늘";
    const base = pathname.startsWith("/projects/") ? "/projects" : pathname;
    for (const g of NAV_GROUPS) {
      const hit = g.items.find((i) => i.href === base);
      if (hit) return hit.label;
    }
    return null;
  }, [pathname, isStore]);

  useEffect(() => {
    const title = screenLabel
      ? `${screenLabel} · ${COMPANY.product.name}`
      : COMPANY.product.name;
    document.title = title;
    // 최초 진입에서는 Next가 하이드레이션 직후 메타데이터 제목을 덮어쓴다 — 잠깐 동안 다시 적용한다
    const timers = [0, 200, 600].map((ms) =>
      window.setTimeout(() => {
        document.title = title;
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [screenLabel]);
  const alerts = buildAlerts(tasks, schedules);
  const myAlerts = permission.seeAllMembers
    ? alerts
    : alerts.filter((a) => a.memberId === currentUserId);

  if (isStore) return <StoreShell>{children}</StoreShell>;

  const meta =
    PAGE_META[pathname] ??
    (pathname.startsWith("/projects/")
      ? { title: "프로젝트 상세", crumb: "공사관리" }
      : { title: COMPANY.product.name, crumb: "" });

  // 권한 밖 화면은 URL로 직접 들어와도 열리지 않는다
  const baseRoute = pathname.startsWith("/projects/") ? "/projects" : pathname;
  const allowed = baseRoute === "/" || permission.routes.includes(baseRoute);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-[20.2px] focus:font-bold focus:text-white"
      >
        본문으로 건너뛰기
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[22.5rem] lg:block">
        <SidebarContent />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="overlay-in absolute inset-0 bg-ink/45"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(22.5rem,88vw)] shadow-2xl">
            <button
              onClick={() => setDrawer(false)}
              aria-label="메뉴 닫기"
              className="absolute top-4 right-3 z-10 rounded-full p-2.5 text-white/60 hover:bg-white/10"
            >
              <X size={26} />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[22.5rem]">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <button
              onClick={() => setDrawer(true)}
              aria-label="메뉴 열기"
              className="rounded-xl p-2.5 text-ink-2 hover:bg-[#f2f4f6] lg:hidden"
            >
              <Menu size={28} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden truncate text-[17.2px] font-semibold whitespace-nowrap text-ink-3 lg:block">
                {COMPANY.main.name}
                {meta.crumb && ` / ${meta.crumb}`}
              </p>
              <h1 className="truncate text-[24px] font-bold whitespace-nowrap lg:text-[25.5px]">
                {meta.title}
              </h1>
            </div>

            <div className="flex min-w-0 items-center gap-2 lg:gap-2.5">
              <HeaderSearch />
              {permission.seeMoney && (
                <div className="hidden shrink-0 2xl:block">
                  <Segment<BusinessView>
                    size="sm"
                    value={business}
                    onChange={setBusiness}
                    options={[
                      { value: "all", label: "전체" },
                      { value: "hana", label: COMPANY.main.name },
                      { value: "consulting", label: COMPANY.insight.name },
                    ]}
                  />
                </div>
              )}
              <button
                onClick={() => setGuideOpen(true)}
                className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3 py-2 text-[18.8px] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-[#e8ebee] xl:inline-flex"
              >
                <HelpCircle size={21} /> 사용 방법
              </button>
              <Link
                href={permission.managerHome ? "/brief" : "/tasks"}
                aria-label="알림"
                className="relative shrink-0 rounded-xl p-2 text-ink-2 transition-colors hover:bg-[#f2f4f6]"
              >
                <Bell size={28} />
                {myAlerts.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full bg-danger px-1 text-[15px] font-bold text-white">
                    {myAlerts.length}
                  </span>
                )}
              </Link>

              <div className="relative shrink-0">
                <button
                  onClick={() => setMenu((v) => !v)}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-[#f2f4f6] py-1.5 pr-2.5 pl-1.5 transition-colors hover:bg-[#e8ebee]"
                >
                  <span
                    className="flex h-[2.625rem] w-[2.625rem] items-center justify-center rounded-lg text-[18px] font-bold text-white"
                    style={{ background: me.color }}
                  >
                    {me.initial}
                  </span>
                  <span className="hidden text-[19.5px] font-semibold whitespace-nowrap 2xl:inline">
                    {me.name} {me.roleLabel}
                  </span>
                </button>
                {menu && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setMenu(false)}
                    />
                    <div className="float-in absolute top-full right-0 z-40 mt-2 w-[22.5rem] overflow-hidden rounded-2xl bg-white p-1.5 shadow-[var(--shadow-card-hover)]">
                      <div className="px-3 py-2.5">
                        <p className="text-[20.2px] font-bold">
                          {me.name} {me.roleLabel}
                        </p>
                        <p className="text-[17.2px] text-ink-3">{me.desc}</p>
                      </div>
                      <div className="my-1 h-px bg-line" />
                      <FontScalePicker scale={scale} onChange={setScale} />
                      <div className="my-1 h-px bg-line" />
                      <button
                        onClick={() => {
                          setMenu(false);
                          setDemoStep(0);
                          setDemoMode(!demoMode);
                          if (!demoMode) router.push("/");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[20.2px] font-semibold text-ink-2 transition-colors hover:bg-[#f7f8fa]"
                      >
                        <PlayCircle size={24} className="text-primary" />
                        {demoMode ? "시연 모드 끄기" : "시연 모드 시작"}
                      </button>
                      <button
                        onClick={() => {
                          setMenu(false);
                          setGuideOpen(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[20.2px] font-semibold text-ink-2 transition-colors hover:bg-[#f7f8fa]"
                      >
                        <HelpCircle size={24} className="text-ink-3" />
                        사용 방법 다시 보기
                      </button>
                      <button
                        onClick={() => {
                          setMenu(false);
                          setResetOpen(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[20.2px] font-semibold text-ink-2 transition-colors hover:bg-danger-bg hover:text-danger"
                      >
                        <RotateCcw size={24} />
                        데모 데이터 초기화
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {permission.seeMoney && (
            <div className="flex justify-center border-t border-line px-4 py-2 2xl:hidden">
              <Segment<BusinessView>
                size="sm"
                value={business}
                onChange={setBusiness}
                options={[
                  { value: "all", label: "전체" },
                  { value: "hana", label: COMPANY.main.name },
                  { value: "consulting", label: COMPANY.insight.name },
                ]}
              />
            </div>
          )}
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[1760px] flex-1 px-4 py-6 pb-[6.5rem] lg:px-8 lg:py-7 lg:pb-7"
        >
          {allowed ? (
            children
          ) : (
            <div className="card mx-auto max-w-[42rem] p-10 text-center">
              <span className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-warning-bg text-warning">
                <HelpCircle size={34} />
              </span>
              <p className="mt-4 text-[26px] font-extrabold">
                이 화면은 권한이 있는 계정만 볼 수 있어요
              </p>
              <p className="mt-2 text-[19.5px] leading-relaxed text-ink-2">
                {me.name} {me.roleLabel} 계정에는 열려 있지 않은 메뉴입니다.
                좌측 하단에서 대표 또는 이사 계정으로 전환하면 확인할 수
                있습니다.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-primary px-6 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
              >
                오늘의 업무로 돌아가기
              </Link>
            </div>
          )}
        </main>

        {/* 모바일 하단 내비 — 현장에서 엄지로 누르는 5버튼 */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          aria-label="하단 메뉴"
        >
          <div className="grid grid-cols-5">
            {[
              { href: "/", label: "오늘", icon: LayoutDashboard },
              { href: "/tasks", label: "업무", icon: ListChecks },
              { href: "/schedule", label: "일정", icon: CalendarDays },
              { href: "/reports", label: "보고", icon: FileBarChart },
            ]
              .filter((i) => permission.routes.includes(i.href))
              .map((i) => {
                const active =
                  i.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[4.2rem] flex-col items-center justify-center gap-0.5 text-[15.5px] font-bold transition-colors ${
                      active ? "text-primary" : "text-ink-3"
                    }`}
                  >
                    <i.icon size={26} strokeWidth={active ? 2.5 : 2} />
                    {i.label}
                  </Link>
                );
              })}
            <button
              onClick={() => setDrawer(true)}
              className="flex min-h-[4.2rem] flex-col items-center justify-center gap-0.5 text-[15.5px] font-bold text-ink-3"
            >
              <Menu size={26} />
              전체
            </button>
          </div>
        </nav>

        <footer className="hidden px-4 pb-6 text-center text-[17.2px] text-ink-3 lg:block">
          {COMPANY.product.name} 데모 · {COMPANY.main.name}({COMPANY.main.role}
          )과 {COMPANY.insight.name}({COMPANY.insight.role})의 업무를 구분해
          관리합니다
        </footer>
      </div>

      {!demoMode && (
        <GuideOverlay open={guideOpen} onClose={() => setGuideOpen(false)} />
      )}
      <DemoPanel />

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="데모 데이터를 초기화할까요?"
        desc="업무 확인 상태, 진행·완료보고, 관리자 승인, 일정 변경, 담당자 변경, 프로젝트 타임라인이 모두 처음 상태로 돌아갑니다."
      >
        <div className="flex justify-end gap-2">
          <GhostButton onClick={() => setResetOpen(false)}>취소</GhostButton>
          <PrimaryButton
            onClick={() => {
              resetDemo();
              setResetOpen(false);
              router.push("/");
            }}
          >
            초기화하기
          </PrimaryButton>
        </div>
      </Modal>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="toast-in fixed bottom-[6.5rem] left-1/2 z-[60] lg:bottom-6 max-w-[92vw] -translate-x-1/2 rounded-2xl bg-ink px-6 py-4 text-[21px] font-semibold text-white shadow-xl"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={24} className="shrink-0 text-[#7db8ff]" />
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
