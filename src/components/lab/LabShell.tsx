"use client";

/**
 * 실증 화면 틀 — 메뉴 4개(홈·현장 실증·전후 비교시험·실증 기록) + PC / Mobile / PC+Mobile 보기
 *
 * 화면 보기 규칙
 *  - Same App · Same Route · Same Data: 모바일 화면은 같은 앱의 같은 경로를 390px(또는 430px) iframe 으로 띄운다.
 *    축소 이미지가 아니라 실제 390px 화면 폭으로 반응형이 그대로 적용되고, 같은 브라우저 저장소를 쓴다.
 *  - Frame 재귀 방지: iframe 안에서는 보기 전환과 iframe 을 그리지 않는다 (iframe 안 화면 폭은 PC 기준보다 좁아
 *    보기 모드가 항상 PC 로 계산되고, iframe 안이라는 표시도 따로 확인한다).
 *  - Route 동기화: PC 쪽에서 메뉴를 옮기면 모바일도 같은 경로로, 모바일에서 옮기면 PC 도 같은 경로로 간다.
 *    경로가 같으면 아무것도 하지 않으므로 서로 반복해서 이동하지 않는다. 화면 시점(관리자/현장기사)은 창마다 고른다.
 *  - 데이터 동기화: 한쪽에서 저장하면 브라우저 storage 이벤트로 다른 쪽이 다시 읽는다 (다시 쓰지 않음).
 *  - 이 브라우저 안에서만 공유된다 — 다른 기기·다른 브라우저와는 공유되지 않는다.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Database, FlaskConical, Home, Menu, Monitor, PanelsTopLeft, Smartphone, X } from "lucide-react";
import { usePref, useLab } from "@/lib/lab/store";
import { personName, unsavedChanges } from "@/lib/lab/model";
import { kst } from "@/lib/pilot/time";

export const LAB_LINKS = [
  { href: "/", label: "실증 홈", short: "홈", icon: Home },
  { href: "/field", label: "현장 실증", short: "현장", icon: ClipboardList },
  { href: "/compare", label: "전후 비교시험", short: "비교시험", icon: FlaskConical },
  { href: "/records", label: "실증 기록·내보내기", short: "기록", icon: Database },
] as const;

export function isLabRoute(p: string) {
  return p === "/" || ["/field", "/compare", "/records"].some((x) => p === x || p.startsWith(`${x}/`));
}

const TITLE: Record<string, string> = {
  "/": "실증 홈",
  "/field": "현장 실증",
  "/compare": "전후 비교시험",
  "/records": "실증 기록·내보내기",
  "/records/report": "결과보고서 정리",
  "/records/evidence": "시험 증거 기록",
};

export type DeviceMode = "pc" | "mobile" | "both";
const NAV = "hana-nav";
const ROUTE = "hana-route";

/* ── 환경 감지 (서버 렌더에서는 PC 로 본다) ─────────── */

const noop = () => () => {};
export function useInFrame(): boolean {
  return useSyncExternalStore(
    noop,
    () => {
      try {
        return window.self !== window.top || new URLSearchParams(window.location.search).get("frame") === "1";
      } catch {
        return true;
      }
    },
    () => false,
  );
}

function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 1024px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

/* ── 공통 부품 ─────────────────────────────────────── */

export function BackupBadge({ compact = false }: { compact?: boolean }) {
  const { state, saveError, loadError } = useLab();
  if (loadError) return <span className="rounded-full bg-danger px-2.5 py-1 text-[15px] font-bold text-white">기록 손상</span>;
  if (saveError) return <span className="rounded-full bg-danger px-2.5 py-1 text-[15px] font-bold text-white">저장 실패</span>;
  if (!state) return null;
  const n = unsavedChanges(state);
  const has = state.entries.length + state.trials.length + state.notes.length > 0;
  const tone = !has ? "bg-[#f2f4f6] text-ink-3" : !state.backup.lastAt ? "bg-danger-bg text-danger" : n > 0 ? "bg-warning-bg text-warning" : "bg-success-bg text-success";
  const text = !has
    ? "기록 없음"
    : !state.backup.lastAt
      ? compact
        ? "백업 안 함"
        : "백업 안 함 — 지금 받으세요"
      : n > 0
        ? `백업 뒤 변경 ${n}`
        : `백업 ${kst(state.backup.lastAt).time}`;
  return (
    <Link href="/records#backup" className={`rounded-full px-2.5 py-1 text-[15px] font-bold whitespace-nowrap ${tone}`} title="JSON 백업 상태 — 누르면 백업 화면">
      {text}
    </Link>
  );
}

/** 지금 입력하는 사람 — 모든 기록에 '프로그램 입력자'로 남는다 (시험용 역할 전환, 로그인 아님) */
export function OperatorPicker({ compact = false }: { compact?: boolean }) {
  const { state } = useLab();
  const [op, setOp] = usePref("operator", "p-consultant");
  const [open, setOpen] = useState(false);
  if (!state) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded-xl bg-[#f2f4f6] px-2.5 py-1 text-[15.5px] font-bold whitespace-nowrap text-ink-2" aria-expanded={open}>
        입력자: {personName(state, op)}
        {!compact && " ▾"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-40 mt-1.5 w-[17rem] rounded-2xl bg-white p-1.5 shadow-[var(--shadow-modal)]">
            <p className="px-2.5 py-1.5 text-[14.5px] text-ink-3">지금 프로그램에 입력하는 사람 — 모든 기록에 남습니다. 시험용 전환이며 로그인이 아닙니다.</p>
            {state.people
              .filter((p) => p.role !== "시험용 가상 기사")
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setOp(p.id);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-xl px-3 py-2 text-left text-[17px] font-semibold ${p.id === op ? "bg-primary-light text-primary-dark" : "hover:bg-[#f7f8fa]"}`}
                >
                  {p.name} <span className="text-[14.5px] text-ink-3">{p.role}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export function useOperator(): string {
  return usePref("operator", "p-consultant")[0];
}

function DeviceSwitch({ mode, setMode }: { mode: DeviceMode; setMode: (m: DeviceMode) => void }) {
  const items: { m: DeviceMode; label: string; icon: React.ElementType }[] = [
    { m: "pc", label: "PC", icon: Monitor },
    { m: "mobile", label: "Mobile", icon: Smartphone },
    { m: "both", label: "PC+Mobile", icon: PanelsTopLeft },
  ];
  return (
    <div role="group" aria-label="화면 보기" className="inline-flex rounded-xl bg-[#e8ebee] p-1">
      {items.map((x) => (
        <button
          key={x.m}
          onClick={() => setMode(x.m)}
          aria-pressed={mode === x.m}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[16.5px] font-bold whitespace-nowrap ${mode === x.m ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}
        >
          <x.icon size={17} /> {x.label}
        </button>
      ))}
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="실증 하단 메뉴">
      <div className="grid grid-cols-4">
        {LAB_LINKS.map((i) => {
          const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[4.1rem] flex-col items-center justify-center gap-0.5 text-[15px] font-bold ${active ? "text-primary" : "text-ink-3"}`}
            >
              <i.icon size={25} strokeWidth={active ? 2.5 : 2} />
              {i.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── 모바일 화면 (같은 앱 · 같은 경로 · 같은 데이터) ─── */

function PhoneFrame({ width, height, label }: { width: number; height: number | string; label: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  // 처음 한 번만 주소를 정한다 — 그 뒤 경로 이동은 메시지로 알린다 (iframe 을 다시 불러오지 않음)
  const [src] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    q.delete("view");
    q.set("frame", "1");
    return `${pathname}?${q.toString()}`;
  });

  // PC → 모바일: 경로가 바뀌면 알린다
  useEffect(() => {
    ref.current?.contentWindow?.postMessage({ type: NAV, path: pathname }, window.location.origin);
  }, [pathname]);

  // 모바일 → PC: 모바일에서 옮긴 경로를 따라간다 (같으면 그대로)
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== ref.current?.contentWindow) return;
      if (e.data?.type === ROUTE && typeof e.data.path === "string" && e.data.path !== window.location.pathname && isLabRoute(e.data.path)) router.push(e.data.path);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="overflow-hidden rounded-[2rem] border-[10px] border-[#1d2433] bg-white shadow-[0_18px_40px_rgba(16,26,46,0.25)]" style={{ width: width + 20 }}>
        <iframe ref={ref} src={src} title={label} style={{ width, height, display: "block", border: 0 }} />
      </div>
      <p className="text-[14px] text-ink-3">실제 {width}px 모바일 화면 · 같은 앱·같은 데이터 (이 브라우저 안에서만)</p>
    </div>
  );
}

/** iframe 안: 경로가 바뀌면 바깥(PC)에 알리고, 바깥에서 온 경로로 이동한다 */
function FrameBridge() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    window.parent.postMessage({ type: ROUTE, path: pathname }, window.location.origin);
  }, [pathname]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      if (e.data?.type === NAV && typeof e.data.path === "string" && e.data.path !== window.location.pathname && isLabRoute(e.data.path)) router.push(`${e.data.path}?frame=1`);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [router]);
  return null;
}

/* ── 틀 ────────────────────────────────────────────── */

function Header({
  title,
  onMenu,
  tabs,
  pathname,
  switcher,
}: {
  title: string;
  onMenu?: () => void;
  tabs?: boolean;
  pathname: string;
  switcher?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur print:static">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-6">
        {onMenu && (
          <button onClick={onMenu} aria-label="메뉴 열기" className="rounded-xl p-2 text-ink-2 hover:bg-[#f2f4f6] lg:hidden print:hidden">
            <Menu size={26} />
          </button>
        )}
        <h1 className="min-w-[7rem] flex-1 truncate text-[22px] font-extrabold lg:text-[24px]">{title}</h1>
        {tabs && (
          <nav className="hidden items-center gap-1 xl:flex" aria-label="실증 메뉴">
            {LAB_LINKS.map((i) => {
              const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={`rounded-lg px-2.5 py-1.5 text-[16.5px] font-bold ${active ? "bg-primary-light text-primary-dark" : "text-ink-3 hover:text-ink-2"}`}>
                  {i.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="flex items-center gap-1.5 print:hidden">
          <BackupBadge compact />
          <OperatorPicker compact />
        </div>
        {switcher && <div className="hidden lg:block print:hidden">{switcher}</div>}
      </div>
      <p className="bg-[#fff7e6] px-4 py-1 text-center text-[13.5px] text-[#8a5a00] print:hidden">
        실증 기록은 이 브라우저에만 저장됩니다 (중앙 DB 아님) · 다른 기기와 공유되지 않음 · 백업 JSON 을 꼭 받아 두세요
      </p>
    </header>
  );
}

export function LabShell({ children, sidebar }: { children: React.ReactNode; sidebar: (onNavigate?: () => void) => React.ReactNode }) {
  const pathname = usePathname();
  const inFrame = useInFrame();
  const wide = useWide();
  const [modePref, setModePref] = usePref("device", "pc");
  const [widthPref, setWidthPref] = usePref("device-width", "390");
  const [drawer, setDrawer] = useState(false);
  const title = TITLE[pathname] ?? "실증";
  // iframe 안이거나 화면이 좁으면 항상 PC(=그 폭의 반응형) — iframe 을 다시 그리지 않는다 (재귀 방지)
  const mode: DeviceMode = inFrame || !wide ? "pc" : modePref === "mobile" || modePref === "both" ? modePref : "pc";
  const width = widthPref === "430" ? 430 : 390;

  useEffect(() => {
    document.title = `${title} · 하나 프로젝트 AX 실증`;
  }, [title]);

  const switcher = (
    <div className="flex items-center gap-1.5">
      <DeviceSwitch mode={mode} setMode={(m) => setModePref(m)} />
      {mode !== "pc" && (
        <div role="group" aria-label="모바일 화면 폭" className="inline-flex rounded-xl bg-[#e8ebee] p-1">
          {["390", "430"].map((w) => (
            <button key={w} onClick={() => setWidthPref(w)} aria-pressed={widthPref === w} className={`rounded-lg px-2 py-1.5 text-[15px] font-bold ${widthPref === w ? "bg-white text-ink shadow-sm" : "text-ink-3"}`}>
              {w}px
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (inFrame) {
    return (
      <div className="min-h-screen bg-bg" data-frame="mobile">
        <FrameBridge />
        <Header title={title} pathname={pathname} />
        <main className="px-3 py-3 pb-[6rem]">{children}</main>
        <BottomNav pathname={pathname} />
      </div>
    );
  }

  if (mode === "mobile") {
    return (
      <div className="min-h-screen bg-bg" data-device="mobile">
        <Header title={title} pathname={pathname} tabs switcher={switcher} />
        <main className="flex justify-center px-4 py-5">
          <PhoneFrame width={width} height="min(844px, calc(100vh - 190px))" label={`모바일 화면 ${width}px`} />
        </main>
      </div>
    );
  }

  if (mode === "both") {
    return (
      <div className="flex h-screen flex-col bg-bg" data-device="both">
        <Header title={title} pathname={pathname} tabs switcher={switcher} />
        <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr]">
          <div className="min-w-0 overflow-y-auto px-5 py-5" data-pane="pc">
            {children}
          </div>
          <div className="flex min-w-0 justify-center overflow-y-auto border-l border-line bg-[#e9ecf1] py-3" data-pane="mobile">
            <PhoneFrame width={width} height="calc(100vh - 175px)" label={`모바일 화면 ${width}px`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" data-device="pc">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[22.5rem] lg:block print:hidden">{sidebar()}</aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/45" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(22.5rem,88vw)] shadow-2xl">
            <button onClick={() => setDrawer(false)} aria-label="메뉴 닫기" className="absolute top-4 right-3 z-10 rounded-full p-2.5 text-white/60 hover:bg-white/10">
              <X size={26} />
            </button>
            {sidebar(() => setDrawer(false))}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[22.5rem] print:pl-0">
        <Header title={title} pathname={pathname} onMenu={() => setDrawer(true)} switcher={switcher} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 pb-[6.5rem] lg:px-7 lg:pb-8">{children}</main>
        <BottomNav pathname={pathname} />
      </div>
    </div>
  );
}
