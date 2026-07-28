"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Banknote,
  Bell,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Handshake,
  HelpCircle,
  LayoutDashboard,
  Menu,
  PhoneCall,
  PieChart,
  PlayCircle,
  PlusSquare,
  RotateCcw,
  Search,
  Store as Storefront,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "@/lib/store";
import type { BusinessView } from "@/lib/types";
import { GhostButton, Modal, PrimaryButton, Segment } from "@/components/ui";
import { GuideOverlay, useGuide } from "@/components/GuideOverlay";
import { DemoPanel } from "@/components/DemoPanel";
import { FontScalePicker, useFontScale } from "@/components/FontScale";
import { StoreShell } from "@/components/store/StoreShell";

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

const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/": { title: "오늘의 공사 운영 브리핑", crumb: "종합 브리핑" },
  "/inquiries": { title: "문의·견적", crumb: "영업" },
  "/customers": { title: "고객·재수주", crumb: "영업" },
  "/projects": { title: "프로젝트", crumb: "공사관리" },
  "/logs": { title: "현장일보", crumb: "공사관리" },
  "/change-orders": { title: "추가공사", crumb: "공사관리" },
  "/profit": { title: "원가·수익", crumb: "공사관리" },
  "/closeout": { title: "준공·수금", crumb: "정산·자료" },
  "/consulting": { title: "하나컨설팅", crumb: "정산·자료" },
  "/documents": { title: "문서함", crumb: "정산·자료" },
  "/approvals": { title: "대표 승인함", crumb: "정산·자료" },
};

/* ───────────────── 사이드바 ───────────────── */

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { approvals, changeOrders, opportunities } = useApp();

  const counts: Record<string, number> = {
    "/": approvals.filter((a) => a.status === "대기").length,
    "/inquiries": opportunities.filter((o) => o.stage !== "won" && o.stage !== "hold").length,
    "/change-orders": changeOrders.filter((c) => !c.billed).length,
  };

  // 그룹을 가로지르는 연속 번호를 미리 계산해 둔다
  const numberOf = new Map<string, string>();
  NAV_GROUPS.flatMap((g) => g.items).forEach((item, i) =>
    numberOf.set(item.href, String(i + 1).padStart(2, "0"))
  );

  return (
    <div className="flex h-full flex-col bg-[#101a2e] text-white">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-4"
      >
        <span className="flex h-[3.375rem] w-[3.375rem] items-center justify-center rounded-xl bg-primary text-white">
          <Zap size={27} strokeWidth={2.4} />
        </span>
        <span>
          <span className="block text-[23.2px] leading-tight font-extrabold">
            하나 프로젝트 AX
          </span>
          <span className="block text-[16.5px] text-white/45">
            전기·통신공사 운영 시스템
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-[16.5px] font-bold tracking-wide text-white/35">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const num = numberOf.get(item.href);
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const count = counts[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[20.2px] font-semibold transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : "text-white/65 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <span
                        className={`text-[16.5px] tabular-nums ${active ? "text-white/70" : "text-white/30"}`}
                      >
                        {num}
                      </span>
                      <item.icon size={24} strokeWidth={active ? 2.4 : 2} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count ? (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[15.8px] font-bold tabular-nums ${
                            active ? "bg-white/20 text-white" : "bg-white/10 text-white/55"
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
          </div>
        ))}
      </nav>

      {/* 외부 고객용 영역 — 내부 운영 메뉴와 구분 */}
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
          <ArrowUpRight size={20} className="text-white/40" />
        </Link>
      </div>

      {/* 사용자 카드 */}
      <div className="shrink-0 border-t border-white/8 px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 px-1 text-[17.2px] font-semibold text-white/45">
          <span className="h-[0.5625rem] w-[0.5625rem] rounded-full bg-success" />
          보령 본사 운영 중
        </p>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/6 p-3">
          <span className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-xl bg-primary text-[21px] font-bold text-white">
            구
          </span>
          <div className="min-w-0">
            <p className="truncate text-[20.2px] font-bold">구본석 이사</p>
            <p className="truncate text-[17.2px] text-white/50">
              공사운영 총괄 · 보령 본사
            </p>
          </div>
        </div>
        
      </div>
    </div>
  );
}

/* ───────────────── 헤더 검색 ───────────────── */

function HeaderSearch() {
  const { projects } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);

  const results = useMemo(() => {
    if (q.trim().length < 1) return [];
    return projects
      .filter(
        (p) => p.name.includes(q) || p.region.includes(q) || p.workType.includes(q)
      )
      .slice(0, 5);
  }, [q, projects]);

  return (
    <div className="relative hidden w-full max-w-[24rem] 2xl:block">
      <Search
        size={24}
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
        className="w-full rounded-xl border border-transparent bg-[#eceff2] py-2 pr-3 pl-9 text-[20.2px] outline-none transition-all placeholder:text-ink-3 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
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
              className="block w-full px-4 py-2.5 text-left text-[19.5px] hover:bg-[#f7f8fa]"
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
            className="block w-full border-t border-line px-4 py-2.5 text-left text-[19.5px] font-semibold text-primary hover:bg-[#f7f8fa]"
          >
            문서함에서 &ldquo;{q}&rdquo; 통합 검색
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────── 셸 ───────────────── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 공개용 서비스몰(/store)은 내부 운영 화면과 완전히 분리된 레이아웃을 사용한다.
  // 나중에 별도 도메인으로 떼어낼 때도 이 분기만 걷어내면 된다.
  const isStore = pathname.startsWith("/store");
  const router = useRouter();
  const { business, setBusiness, approvals, toast, demoMode, setDemoMode, setDemoStep, resetDemo } =
    useApp();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const { open: guideOpen, setOpen: setGuideOpen } = useGuide();
  const { scale, setScale } = useFontScale();

  if (isStore) return <StoreShell>{children}</StoreShell>;

  const meta =
    PAGE_META[pathname] ??
    (pathname.startsWith("/projects/")
      ? { title: "프로젝트 상세", crumb: "공사관리" }
      : { title: "하나 프로젝트 AX", crumb: "" });
  const pendingApprovals = approvals.filter((a) => a.status === "대기").length;

  return (
    <div className="flex min-h-screen">
      {/* 데스크톱 사이드바 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[22.5rem] lg:block">
        <SidebarContent />
      </aside>

      {/* 모바일 드로어 */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="overlay-in absolute inset-0 bg-ink/45"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[27rem] shadow-2xl">
            <button
              onClick={() => setDrawer(false)}
              aria-label="메뉴 닫기"
              className="absolute top-5 right-4 z-10 rounded-full p-2 text-white/60 hover:bg-white/10"
            >
              <X size={27} />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[22.5rem]">
        {/* 헤더 */}
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <button
              onClick={() => setDrawer(true)}
              aria-label="메뉴 열기"
              className="rounded-xl p-2 text-ink-2 hover:bg-[#f2f4f6] lg:hidden"
            >
              <Menu size={30} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden truncate text-[17.2px] font-semibold whitespace-nowrap text-ink-3 lg:block">
                하나정보통신{meta.crumb && ` / ${meta.crumb}`}
              </p>
              <h1 className="truncate text-[24px] font-bold whitespace-nowrap lg:text-[25.5px]">{meta.title}</h1>
            </div>

            <div className="flex min-w-0 items-center gap-2 lg:gap-2.5">
              <HeaderSearch />
              <div className="hidden shrink-0 xl:block">
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
              <button
                onClick={() => setGuideOpen(true)}
                className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3 py-2 text-[18.8px] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-[#e8ebee] xl:inline-flex"
              >
                <HelpCircle size={21} /> 사용 방법
              </button>
              <Link
                href="/approvals"
                aria-label="대표 승인함"
                className="relative shrink-0 rounded-xl p-2 text-ink-2 transition-colors hover:bg-[#f2f4f6]"
              >
                <Bell size={28} />
                {pendingApprovals > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full bg-danger px-1 text-[15px] font-bold text-white">
                    {pendingApprovals}
                  </span>
                )}
              </Link>

              {/* 사용자 메뉴 */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setMenu((v) => !v)}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-[#f2f4f6] py-1.5 pr-2.5 pl-1.5 transition-colors hover:bg-[#e8ebee]"
                >
                  <span className="flex h-[2.625rem] w-[2.625rem] items-center justify-center rounded-lg bg-primary text-[18px] font-bold text-white">
                    구
                  </span>
                  <span className="hidden text-[19.5px] font-semibold whitespace-nowrap 2xl:inline">
                    구본석 이사
                  </span>
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                    <div className="float-in absolute top-full right-0 z-40 mt-2 w-[22.5rem] overflow-hidden rounded-2xl bg-white p-1.5 shadow-[var(--shadow-card-hover)]">
                      <div className="px-3 py-2.5">
                        <p className="text-[20.2px] font-bold">구본석 이사</p>
                        <p className="text-[17.2px] text-ink-3">
                          하나정보통신 · 공사운영 총괄
                        </p>
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

          {/* 모바일 사업자 전환 */}
          <div className="flex justify-center border-t border-line px-4 py-2 xl:hidden">
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

        <main className="mx-auto w-full max-w-[1760px] flex-1 px-4 py-6 lg:px-8 lg:py-7">
          {children}
        </main>

        <footer className="px-4 pb-6 text-center text-[17.2px] text-ink-3">
          하나 프로젝트 AX 데모 · 하나정보통신(계약·시공·준공)과 하나컨설팅(기획·운영·자료관리)의
          업무를 구분해 관리합니다
        </footer>
      </div>

      {/* 오버레이 안내 · 시연 모드 */}
      {!demoMode && <GuideOverlay open={guideOpen} onClose={() => setGuideOpen(false)} />}
      <DemoPanel />

      {/* 데모 초기화 확인 */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="데모 데이터를 초기화할까요?"
        desc="시연 중 바꾼 승인 상태, 추가공사, 새 문의, 준공 체크리스트가 모두 처음 상태로 돌아갑니다."
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

      {/* 토스트 */}
      {toast && (
        <div className="toast-in fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-ink px-5 py-3 text-[21px] font-semibold text-white shadow-xl">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={24} className="text-[#7db8ff]" />
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
