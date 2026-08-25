"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Phone, X, Zap } from "lucide-react";
import { useApp } from "@/lib/store";

const NAV = [
  { href: "/store", label: "홈" },
  { href: "/store/services", label: "서비스 안내" },
  { href: "/store/process", label: "진행 방식" },
  { href: "/store/request", label: "상담·견적 신청" },
];

/** 공개용 서비스몰 셸 — 내부 운영 SaaS와 완전히 다른 레이아웃을 쓴다 */
export function StoreShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* 상단 안내 띠 */}
      <div className="bg-[#101a2e] px-4 py-2.5 text-center text-[17px] font-medium text-white/80">
        보령·충남·전북 지역 전기공사 · 정보통신공사 전문 ·{" "}
        <span className="font-bold text-white">041-000-0000</span>
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] items-center gap-3 px-3 py-4 sm:px-4 lg:gap-4 lg:px-8">
          <Link
            href="/store"
            className="flex min-w-0 shrink items-center gap-2.5"
          >
            <span className="flex h-[3rem] w-[3rem] items-center justify-center rounded-xl bg-primary text-white">
              <Zap size={26} strokeWidth={2.4} />
            </span>
            <span>
              <span className="block truncate text-[24px] leading-tight font-extrabold">
                하나정보통신
              </span>
              <span className="block truncate text-[16px] text-ink-3">
                서비스·상담센터
              </span>
            </span>
          </Link>

          <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
            {NAV.map((n) => {
              const active =
                n.href === "/store"
                  ? pathname === "/store"
                  : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-xl px-4 py-2.5 text-[20px] font-semibold transition-colors ${
                    active
                      ? "bg-primary-light text-primary-dark"
                      : "text-ink-2 hover:bg-[#f2f4f6]"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <a
              href="tel:041-000-0000"
              className="hidden items-center gap-2 rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee] sm:inline-flex"
            >
              <Phone size={20} /> 전화 상담
            </a>
            <Link
              href="/store/request"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[18px] font-bold whitespace-nowrap text-white transition-colors hover:bg-primary-dark active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-[19px]"
            >
              상담신청
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="메뉴"
              className="rounded-xl p-1.5 text-ink-2 hover:bg-[#f2f4f6] sm:p-2.5 lg:hidden"
            >
              {open ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-line px-4 py-2 lg:hidden">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 text-[20px] font-semibold text-ink-2 hover:bg-[#f2f4f6]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* 푸터 */}
      <footer className="mt-16 border-t border-line bg-[#f7f8fa]">
        <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-12 lg:grid-cols-3 lg:px-8">
          <div>
            <p className="text-[22px] font-extrabold">하나정보통신</p>
            <p className="mt-2 text-[18px] leading-relaxed text-ink-2">
              충남 보령에 자리한 전기공사·정보통신공사 업체입니다.
              <br />
              보령·서천·홍성·서산·태안·논산과 전북 군산·익산 지역을 중심으로
              <br />
              현장 상황에 맞춘 공사와 유지보수를 제공합니다.
            </p>
            <p className="mt-4 text-[18px] font-bold">041-000-0000</p>
            <p className="text-[17px] text-ink-3">
              평일 08:30 ~ 18:00 · 주말 상담 예약 가능
            </p>
          </div>

          <div>
            <p className="text-[19px] font-bold">서비스</p>
            <ul className="mt-3 space-y-1.5 text-[18px] text-ink-2">
              <li>전기공사 · 전기증설</li>
              <li>정보통신공사 · 통신배선</li>
              <li>CCTV · 출입통제</li>
              <li>사무실 네트워크 구축</li>
              <li>유지보수 · 정기점검</li>
            </ul>
          </div>

          <div>
            <p className="text-[19px] font-bold">함께하는 곳</p>
            <p className="mt-3 text-[18px] leading-relaxed text-ink-2">
              <b>하나인사이트</b>이 프로젝트 기획·운영관리, 자료 정리, 원가
              분석을 지원합니다. 시공과 준공 책임은 하나정보통신이 담당합니다.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-[17px] font-semibold text-ink-3 transition-colors hover:text-ink-2"
            >
              운영 시스템 보기 <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
        <div className="border-t border-line px-4 py-5 text-center text-[16px] text-ink-3">
          하나정보통신 서비스·상담센터 데모 · 표시된 금액은 시작 금액이며 실제
          금액은 현장 확인 후 견적서로 안내드립니다.
        </div>
      </footer>

      {toast && (
        <div className="toast-in fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-ink px-6 py-4 text-[20px] font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
