import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { pilotConfig } from "@/lib/pilot/config";
import { getPilotSession } from "@/lib/pilot/session";
import { signOutAction } from "./auth-actions";
import { FontToggle } from "./_ui/FontToggle";

export const metadata: Metadata = {
  title: "실증 · 하나 프로젝트 AX",
  robots: { index: false, follow: false },
};

/** 실증 화면 공통 틀 — 얇은 흰 머리글(이름 · 역할 · 로그아웃) + 아래쪽 안내 한 줄 */
export default async function PilotLayout({ children }: { children: React.ReactNode }) {
  const cfg = pilotConfig();
  const s = cfg ? await getPilotSession() : "unconfigured";
  const who = s && s !== "unconfigured" ? s : null;
  const admin = who?.profile?.role === "admin";
  return (
    <div className="min-h-screen bg-bg text-[16px]">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/90 backdrop-blur print:static print:hidden">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-3 px-4 lg:px-6">
          <Link href="/pilot" className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-[14px] font-black tracking-tight text-white">
              AX
            </span>
            <span className="truncate text-[17px] font-extrabold tracking-[-0.01em] max-sm:hidden">
              하나 AX <span className="font-semibold text-ink-3">실증</span>
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {cfg && <span className="hidden rounded-full bg-[#eef0f3] px-2.5 py-1 text-[13.5px] font-semibold text-ink-2 sm:inline">{cfg.dbLabel}</span>}
            <FontToggle />
            {who && (
              <>
                <span className="flex min-w-0 items-center gap-1.5 text-[14.5px] font-semibold text-ink-2">
                  <span className="truncate">{who.profile?.display_name ?? who.email}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[13px] font-bold ${admin ? "bg-ink text-white" : "bg-primary-light text-primary-dark"}`}>{admin ? "관리자" : "현장 직원"}</span>
                </span>
                <form action={signOutAction}>
                  <button className="inline-flex min-h-[2.5rem] items-center gap-1 rounded-xl px-2.5 text-[14px] font-semibold text-ink-3 hover:bg-[#eef0f3] hover:text-ink-2">
                    <LogOut size={16} aria-hidden />
                    <span className="max-sm:sr-only">로그아웃</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 py-5 lg:px-6 lg:py-7">{children}</main>
      <footer className="mx-auto max-w-[1320px] px-4 pt-2 pb-28 text-[13.5px] leading-relaxed text-ink-3 lg:px-6 lg:pb-8 print:hidden">
        실증 시스템 — 실제 현장 기록을 저장합니다 · 데모 화면과 데이터가 섞이지 않습니다 · 실제 자료로 성능이 검증됐다는 뜻이 아닙니다 · 화면 버전 {process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
      </footer>
    </div>
  );
}
