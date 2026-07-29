"use client";

import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Handshake, Phone } from "lucide-react";
import { STORE_FAQS, STORE_PROCESS } from "@/lib/store-catalog";

const HANA_ROLE = [
  "고객 계약",
  "실제 시공",
  "자재 구매와 인력 투입",
  "현장 안전관리",
  "준공 책임과 공사대금 청구",
];

const CONSULTING_ROLE = [
  "공사 전 사전 검토",
  "공정·일정 계획 수립 지원",
  "예상원가 검토와 분석",
  "변경·추가공사 내용 정리",
  "준공자료 취합과 보고서 작성",
];

export default function ProcessPage() {
  return (
    <div className="page-in mx-auto w-full max-w-[1500px] px-4 py-12 lg:px-8">
      <h1 className="text-[34px] font-extrabold lg:text-[38px]">진행 방식</h1>
      <p className="mt-3 text-[21px] leading-relaxed text-ink-2">
        문의부터 준공, 정산까지 어떻게 진행되는지 정리했습니다.
        <br className="hidden sm:block" />
        현장마다 상황이 달라 일정은 협의해 조정합니다.
      </p>

      {/* 절차 */}
      <section className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STORE_PROCESS.map((p) => (
            <div key={p.step} className="rounded-3xl border border-line bg-white p-7">
              <span className="text-[21px] font-extrabold text-primary">{p.step}</span>
              <p className="mt-2 text-[23px] font-extrabold">{p.title}</p>
              <p className="mt-2 text-[19px] leading-relaxed text-ink-2">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 역할 구분 */}
      <section className="mt-14">
        <h2 className="text-[28px] font-extrabold">누가 어떤 일을 하나요?</h2>
        <p className="mt-2 text-[20px] text-ink-2">
          시공은 하나정보통신이, 프로젝트 기획과 운영관리는 하나인사이트가 맡습니다.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-white p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-[3.4rem] w-[3.4rem] items-center justify-center rounded-2xl bg-info-bg text-info">
                <Building2 size={28} />
              </span>
              <div>
                <p className="text-[24px] font-extrabold">하나정보통신</p>
                <p className="text-[18px] text-ink-3">계약 · 시공 · 준공 책임</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {HANA_ROLE.map((t) => (
                <li key={t} className="flex gap-3 text-[20px] text-ink-2">
                  <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-line bg-white p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-[3.4rem] w-[3.4rem] items-center justify-center rounded-2xl bg-success-bg text-success">
                <Handshake size={28} />
              </span>
              <div>
                <p className="text-[24px] font-extrabold">하나인사이트</p>
                <p className="text-[18px] text-ink-3">기획 · 운영관리 · 자료관리</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {CONSULTING_ROLE.map((t) => (
                <li key={t} className="flex gap-3 text-[20px] text-ink-2">
                  <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-success" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-2xl bg-[#f7f8fa] px-5 py-4 text-[17.5px] leading-relaxed text-ink-3">
              하나인사이트는 프로젝트 운영을 지원하는 역할이며, 직접 시공하거나 설계·감리
              업무를 수행하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 가격 안내 */}
      <section className="mt-14 rounded-3xl border border-line bg-[#f7f8fa] p-8 lg:p-10">
        <h2 className="text-[28px] font-extrabold">가격은 어떻게 정해지나요?</h2>
        <p className="mt-3 text-[20px] leading-relaxed text-ink-2">
          전기·통신공사는 건물 구조, 배선 길이, 기존 설비 상태에 따라 물량이 크게
          달라집니다. 그래서 서비스 목록에는 시작 금액만 안내드리고, 현장을 확인한 뒤
          항목별로 계산한 견적서를 보내 드립니다.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { t: "시작 금액 표시", d: "기본 구성 기준 최소 금액입니다. 예: 150만 원부터" },
            { t: "현장 확인 후 견적", d: "물량 변동이 큰 공사는 방문 후 산정합니다." },
            { t: "별도 상담", d: "범위를 함께 정해야 하는 컨설팅 서비스입니다." },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl bg-white p-6">
              <p className="text-[21px] font-extrabold">{x.t}</p>
              <p className="mt-2 text-[18.5px] leading-relaxed text-ink-2">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="text-[28px] font-extrabold">자주 묻는 질문</h2>
        <div className="mt-6 space-y-4">
          {STORE_FAQS.map((f) => (
            <div key={f.q} className="rounded-3xl border border-line bg-white p-7">
              <p className="text-[22px] font-bold">Q. {f.q}</p>
              <p className="mt-2.5 text-[19.5px] leading-relaxed text-ink-2">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-14 flex flex-col items-center gap-4 rounded-3xl bg-[#101a2e] px-6 py-14 text-center">
        <p className="text-[30px] font-extrabold text-white">먼저 상담부터 받아 보세요</p>
        <p className="text-[20px] text-white/70">
          현장 상황만 알려 주시면 필요한 공사를 정리해 드립니다.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Link
            href="/store/request?type=상담신청"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-[21px] font-bold text-white transition-colors hover:bg-[#4a92f8]"
          >
            상담신청 <ArrowRight size={21} />
          </Link>
          <a
            href="tel:041-000-0000"
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-8 py-4 text-[21px] font-bold text-white transition-colors hover:bg-white/20"
          >
            <Phone size={21} /> 전화 상담 요청
          </a>
        </div>
      </section>
    </div>
  );
}
