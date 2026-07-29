"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import {
  SERVICES,
  SERVICE_CATEGORIES,
  STORE_FAQS,
  STORE_PROCESS,
} from "@/lib/store-catalog";
import { ServiceCard } from "@/components/store/ServiceCard";

const REGIONS = [
  "충남 보령",
  "충남 서천",
  "충남 홍성",
  "충남 서산",
  "충남 태안",
  "충남 논산",
  "전북 군산",
  "전북 익산",
];

export default function StoreHome() {
  const popular = SERVICES.filter((s) => s.popular).slice(0, 3);
  const consulting = SERVICES.filter((s) => s.provider === "하나인사이트");

  return (
    <div className="page-in">
      {/* 히어로 */}
      <section className="border-b border-line bg-gradient-to-b from-[#f4f8ff] to-white">
        <div className="mx-auto grid w-full max-w-[1500px] items-center gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
          <div>
            <span className="inline-block rounded-full bg-primary-light px-4 py-2 text-[18px] font-bold text-primary-dark">
              보령·충남·전북 지역 대응
            </span>
            <h1 className="mt-5 text-[38px] leading-[1.28] font-extrabold lg:text-[46px]">
              전기·통신공사부터
              <br />
              운영 컨설팅까지
            </h1>
            <p className="mt-5 text-[22px] leading-relaxed text-ink-2">
              필요한 서비스를 확인하고 상담 또는 견적을 요청하세요.
              <br className="hidden sm:block" />
              현장을 확인한 뒤 보통 2~3일 안에 견적서를 보내 드립니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/store/services"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 text-[21px] font-bold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
              >
                서비스 보기 <ArrowRight size={22} />
              </Link>
              <Link
                href="/store/request?type=상담신청"
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-7 py-4 text-[21px] font-bold text-ink-2 transition-all hover:bg-[#f7f8fa]"
              >
                상담신청
              </Link>
              <Link
                href="/store/request?type=견적문의"
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-4 text-[21px] font-bold text-primary-dark transition-colors hover:bg-primary-light"
              >
                견적문의
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
              {[
                { icon: ShieldCheck, text: "전기공사업·정보통신공사업 등록" },
                { icon: Wrench, text: "현장 확인 후 맞춤 견적" },
                { icon: Clock, text: "견적서 2~3일 내 발송" },
              ].map((b) => (
                <span
                  key={b.text}
                  className="inline-flex items-center gap-2 text-[18.5px] font-semibold text-ink-2"
                >
                  <b.icon size={21} className="text-primary" /> {b.text}
                </span>
              ))}
            </div>
          </div>

          {/* 빠른 문의 카드 */}
          <div className="rounded-3xl border border-line bg-white p-7 shadow-[var(--shadow-card)]">
            <p className="text-[24px] font-extrabold">빠른 상담 요청</p>
            <p className="mt-2 text-[19px] leading-relaxed text-ink-2">
              어떤 공사가 필요한지 아직 정하지 못하셨어도 괜찮습니다. 현장 상황만
              알려 주시면 담당자가 정리해 드립니다.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                { label: "상담신청", desc: "무엇이 필요한지부터 같이 정리", type: "상담신청" },
                { label: "견적문의", desc: "대략 금액과 기간이 궁금할 때", type: "견적문의" },
                { label: "주문요청", desc: "서비스를 정하고 바로 진행", type: "주문요청" },
              ].map((r) => (
                <Link
                  key={r.type}
                  href={`/store/request?type=${r.type}`}
                  className="flex items-center gap-4 rounded-2xl bg-[#f7f8fa] px-5 py-4 transition-colors hover:bg-primary-light"
                >
                  <span className="flex-1">
                    <span className="block text-[20px] font-bold">{r.label}</span>
                    <span className="block text-[17.5px] text-ink-3">{r.desc}</span>
                  </span>
                  <ArrowRight size={21} className="text-ink-3" />
                </Link>
              ))}
            </div>
            <a
              href="tel:041-000-0000"
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-line px-5 py-4 text-[20px] font-bold text-ink-2 transition-colors hover:bg-[#f7f8fa]"
            >
              <Phone size={21} /> 전화 상담 041-000-0000
            </a>
          </div>
        </div>
      </section>

      {/* 서비스 카테고리 */}
      <section className="mx-auto w-full max-w-[1500px] px-4 py-16 lg:px-8">
        <h2 className="text-[30px] font-extrabold">서비스 분야</h2>
        <p className="mt-2 text-[20px] text-ink-2">필요한 분야를 고르면 관련 서비스만 볼 수 있어요.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATEGORIES.map((c) => {
            const count = SERVICES.filter((s) => s.category === c.key).length;
            return (
              <Link
                key={c.key}
                href={`/store/services?category=${c.key}`}
                className="group rounded-3xl border border-line bg-white p-7 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[23px] font-extrabold">{c.name}</p>
                  <span className="rounded-lg bg-[#f2f4f6] px-2.5 py-1 text-[16.5px] font-bold text-ink-3">
                    {count}개
                  </span>
                </div>
                <p className="mt-2.5 text-[19px] leading-relaxed text-ink-2">{c.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[18.5px] font-bold text-primary">
                  서비스 보기 <ArrowRight size={18} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 자주 찾는 서비스 */}
      <section className="bg-[#f7f8fa] py-16">
        <div className="mx-auto w-full max-w-[1500px] px-4 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[30px] font-extrabold">고객이 자주 찾는 서비스</h2>
              <p className="mt-2 text-[20px] text-ink-2">
                최근 문의가 많았던 서비스입니다.
              </p>
            </div>
            <Link
              href="/store/services"
              className="inline-flex items-center gap-1.5 text-[20px] font-bold text-primary hover:underline"
            >
              전체 서비스 보기 <ArrowRight size={20} />
            </Link>
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {popular.map((s) => (
              <ServiceCard key={s.slug} item={s} />
            ))}
          </div>
        </div>
      </section>

      {/* 진행 절차 */}
      <section className="mx-auto w-full max-w-[1500px] px-4 py-16 lg:px-8">
        <h2 className="text-[30px] font-extrabold">이렇게 진행됩니다</h2>
        <p className="mt-2 text-[20px] text-ink-2">
          상담을 신청하시면 담당자가 하루 안에 연락드립니다.
        </p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STORE_PROCESS.map((p) => (
            <div key={p.step} className="rounded-3xl border border-line bg-white p-6">
              <span className="text-[20px] font-extrabold text-primary">{p.step}</span>
              <p className="mt-2 text-[22px] font-extrabold">{p.title}</p>
              <p className="mt-1.5 text-[18.5px] leading-relaxed text-ink-2">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 하나인사이트 연계 */}
      <section className="mx-auto w-full max-w-[1500px] px-4 pb-16 lg:px-8">
        <div className="rounded-3xl border border-line bg-gradient-to-br from-[#f2fbf7] to-white p-8 lg:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <span className="inline-block rounded-full bg-success-bg px-4 py-2 text-[18px] font-bold text-success">
                하나인사이트 연계 서비스
              </span>
              <h2 className="mt-4 text-[30px] font-extrabold">
                공사만이 아니라 프로젝트 관리까지 맡기실 수 있습니다
              </h2>
              <p className="mt-3 text-[20px] leading-relaxed text-ink-2">
                하나인사이트가 사전 검토, 공정·자료 관리, 원가 분석을 지원합니다. 시공과
                준공 책임은 하나정보통신이 담당합니다.
              </p>
            </div>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {consulting.map((s) => (
              <Link
                key={s.slug}
                href={`/store/services/${s.slug}`}
                className="rounded-2xl border border-line bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
              >
                <p className="text-[21px] font-extrabold">{s.name.replace(" (하나인사이트)", "")}</p>
                <p className="mt-2 text-[18.5px] leading-relaxed text-ink-2">{s.tagline}</p>
                <p className="mt-3 text-[19px] font-bold text-success">
                  {s.priceKind === "from" && s.priceFrom
                    ? `${s.priceFrom.toLocaleString()}만 원부터`
                    : "별도 상담"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 지역 안내 + FAQ */}
      <section className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 pb-16 lg:grid-cols-2 lg:px-8">
        <div className="rounded-3xl border border-line bg-white p-8">
          <h2 className="flex items-center gap-2 text-[26px] font-extrabold">
            <MapPin size={26} className="text-primary" /> 대응 지역
          </h2>
          <p className="mt-3 text-[19.5px] leading-relaxed text-ink-2">
            보령·충남·전북 지역을 중심으로 전기·통신공사와 현장 맞춤형 서비스를
            제공합니다. 아래 지역은 당일 또는 다음 날 현장 확인이 가능합니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <span
                key={r}
                className="rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[18.5px] font-semibold text-ink-2"
              >
                {r}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[18px] text-ink-3">
            그 밖의 지역도 상담을 통해 진행 가능 여부를 안내드립니다.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-white p-8">
          <h2 className="text-[26px] font-extrabold">자주 묻는 질문</h2>
          <div className="mt-5 space-y-4">
            {STORE_FAQS.map((f) => (
              <div key={f.q}>
                <p className="flex gap-2 text-[20px] font-bold">
                  <CheckCircle2 size={21} className="mt-1 shrink-0 text-primary" />
                  {f.q}
                </p>
                <p className="mt-1.5 pl-8 text-[18.5px] leading-relaxed text-ink-2">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="bg-[#101a2e] py-16">
        <div className="mx-auto w-full max-w-[1500px] px-4 text-center lg:px-8">
          <h2 className="text-[32px] font-extrabold text-white">
            어떤 공사가 필요한지 아직 모르셔도 괜찮습니다
          </h2>
          <p className="mt-3 text-[21px] text-white/70">
            현장 상황만 알려 주시면 담당자가 확인하고 정리해 드립니다.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/store/request?type=상담신청"
              className="rounded-2xl bg-primary px-8 py-4 text-[21px] font-bold text-white transition-colors hover:bg-[#4a92f8]"
            >
              지금 문의하기
            </Link>
            <a
              href="tel:041-000-0000"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-8 py-4 text-[21px] font-bold text-white transition-colors hover:bg-white/20"
            >
              <Phone size={21} /> 전화 상담 요청
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
