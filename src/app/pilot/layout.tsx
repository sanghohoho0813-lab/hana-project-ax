import type { Metadata } from "next";
import Link from "next/link";
import { pilotConfig } from "@/lib/pilot/config";
import { getPilotSession } from "@/lib/pilot/session";
import { signOutAction } from "./auth-actions";

export const metadata: Metadata = {
  title: "실증 · 하나 프로젝트 AX",
  robots: { index: false, follow: false },
};

export default async function PilotLayout({ children }: { children: React.ReactNode }) {
  const cfg = pilotConfig();
  const s = cfg ? await getPilotSession() : "unconfigured";
  const who = s && s !== "unconfigured" ? s : null;
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-white print:static">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/pilot" className="flex items-center gap-2">
            <span className="rounded-lg bg-primary px-2 py-0.5 text-[16px] font-extrabold text-white">실증</span>
            <span className="text-[20px] font-extrabold">하나 프로젝트 AX</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-[16px]">
            {cfg && <span className="rounded-full bg-[#f2f4f6] px-2.5 py-0.5 font-semibold text-ink-2">{cfg.dbLabel}</span>}
            {who && (
              <>
                <span className="font-semibold text-ink-2">
                  {who.profile?.display_name ?? who.email} · {who.profile?.role === "admin" ? "관리자" : "현장 직원"}
                </span>
                <form action={signOutAction} className="print:hidden">
                  <button className="rounded-lg bg-[#f2f4f6] px-2.5 py-1 font-semibold text-ink-2 hover:bg-[#e8ebee]">로그아웃</button>
                </form>
              </>
            )}
          </div>
        </div>
        <p className="bg-[#fff7e6] px-4 py-1 text-center text-[14.5px] text-[#8a5a00]">
          실증 시스템 — 실제 현장 기록을 저장합니다 · 데모 화면과 데이터가 섞이지 않습니다 · 실제 자료로 성능이 검증됐다는 뜻이 아닙니다
        </p>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 py-5">{children}</main>
    </div>
  );
}
