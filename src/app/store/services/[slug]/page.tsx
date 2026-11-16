"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Handshake,
  Phone,
  ShieldAlert,
} from "lucide-react";
import {
  SERVICES,
  categoryOf,
  serviceBySlug,
  type ServiceItem,
} from "@/lib/store-catalog";
import { ServiceVisual } from "@/components/store/ServiceVisual";
import { ServiceCard, priceLabel } from "@/components/store/ServiceCard";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="text-[26px] font-extrabold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bullets({ items, icon }: { items: string[]; icon?: "check" | "dot" }) {
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[20px] leading-relaxed text-ink-2">
          {icon === "check" ? (
            <CheckCircle2 size={22} className="mt-1 shrink-0 text-primary" />
          ) : (
            <span className="mt-3 h-[0.45rem] w-[0.45rem] shrink-0 rounded-full bg-ink-3" />
          )}
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function ServiceDetailPage() {
  const params = useParams<{ slug: string }>();
  const item = serviceBySlug(params.slug);

  if (!item) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-24 text-center">
        <p className="text-[26px] font-extrabold">서비스를 찾을 수 없어요</p>
        <Link
          href="/store/services"
          className="mt-5 inline-block rounded-2xl bg-primary px-6 py-3.5 text-[20px] font-bold text-white"
        >
          서비스 목록으로
        </Link>
      </div>
    );
  }

  const cat = categoryOf(item.category);
  const related = item.related
    .map((r) => SERVICES.find((s) => s.slug === r))
    .filter(Boolean) as ServiceItem[];

  return (
    <div className="page-in">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-10 lg:px-8">
        <Link
          href="/store/services"
          className="inline-flex items-center gap-1.5 text-[18.5px] font-semibold text-ink-3 hover:text-ink"
        >
          <ArrowLeft size={19} /> 서비스 목록
        </Link>

        {/* 상단 */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_28rem]">
          <div className="h-[20rem] overflow-hidden rounded-3xl border border-line lg:h-[26rem]">
            <ServiceVisual item={item} showLabel={false} />
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[#f2f4f6] px-3 py-1.5 text-[17.5px] font-bold text-ink-2">
                {cat.name}
              </span>
              {item.popular && (
                <span className="rounded-lg bg-warning-bg px-3 py-1.5 text-[17.5px] font-bold text-warning">
                  문의 많은 서비스
                </span>
              )}
            </div>

            <h1 className="mt-4 text-[32px] leading-tight font-extrabold lg:text-[36px]">
              {item.name}
            </h1>
            <p className="mt-3 text-[21px] leading-relaxed text-ink-2">{item.tagline}</p>

            <div className="mt-6 space-y-3 rounded-3xl bg-[#f7f8fa] p-6">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[19px] font-semibold text-ink-2">가격</span>
                <span
                  className={`text-[26px] font-extrabold ${
                    item.priceKind === "from" ? "text-primary" : "text-ink-2"
                  }`}
                >
                  {priceLabel(item)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[19px] font-semibold text-ink-2">예상 기간</span>
                <span className="inline-flex items-center gap-1.5 text-[20px] font-bold">
                  <Clock size={20} className="text-ink-3" /> {item.duration}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[19px] font-semibold text-ink-2">수행</span>
                <span className="inline-flex items-center gap-1.5 text-[20px] font-bold">
                  {item.provider === "하나인사이트" ? (
                    <Handshake size={20} className="text-success" />
                  ) : (
                    <Building2 size={20} className="text-primary" />
                  )}
                  {item.provider}
                </span>
              </div>
              <p className="border-t border-line pt-3 text-[17.5px] leading-relaxed text-ink-3">
                {item.priceNote} · 현장 상황에 따라 물량이 달라져 최종 금액은 견적서로
                안내드립니다.
              </p>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <Link
                href={`/store/request?service=${item.slug}&type=상담신청`}
                className="rounded-2xl border border-line bg-white px-6 py-4 text-center text-[20px] font-bold text-ink-2 transition-colors hover:bg-[#f7f8fa]"
              >
                상담신청
              </Link>
              <Link
                href={`/store/request?service=${item.slug}&type=견적문의`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
              >
                견적문의 <ArrowRight size={20} />
              </Link>
            </div>
            <a
              href="tel:041-000-0000"
              className="mt-2.5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f2f4f6] px-6 py-4 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
            >
              <Phone size={20} /> 전화 상담 요청
            </a>
          </div>
        </div>

        {/* 본문 */}
        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-8">
            <section>
              <h2 className="text-[26px] font-extrabold">서비스 개요</h2>
              <p className="mt-4 text-[20px] leading-[1.75] text-ink-2">{item.overview}</p>
            </section>

            <Section title="이런 상황에서 필요합니다">
              <Bullets items={item.fitFor} icon="check" />
            </Section>

            <Section title="주요 포함 업무">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {item.includes.map((t) => (
                  <div
                    key={t}
                    className="rounded-2xl bg-[#f7f8fa] px-5 py-4 text-[19px] font-semibold text-ink-2"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="기대 효과">
              <Bullets items={item.effects} icon="check" />
            </Section>

            <Section title="진행 절차">
              <ol className="space-y-3">
                {item.steps.map((t, i) => (
                  <li key={t} className="flex items-start gap-4">
                    <span className="flex h-[2.6rem] w-[2.6rem] shrink-0 items-center justify-center rounded-full bg-primary-light text-[19px] font-extrabold text-primary-dark">
                      {i + 1}
                    </span>
                    <span className="pt-1.5 text-[20px] leading-relaxed text-ink-2">{t}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="유의사항">
              <div className="rounded-3xl bg-warning-bg/50 p-6">
                <p className="mb-3 flex items-center gap-2 text-[20px] font-bold text-warning">
                  <ShieldAlert size={22} /> 진행 전에 확인해 주세요
                </p>
                <Bullets items={item.notes} />
              </div>
            </Section>

            <Section title="자주 묻는 질문">
              <div className="space-y-5">
                {item.faqs.map((f) => (
                  <div key={f.q} className="rounded-3xl border border-line p-6">
                    <p className="text-[21px] font-bold">Q. {f.q}</p>
                    <p className="mt-2 text-[19.5px] leading-relaxed text-ink-2">{f.a}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* 사이드 CTA */}
          <aside className="lg:sticky lg:top-[9rem] lg:self-start">
            <div className="rounded-3xl border border-line bg-white p-7 shadow-[var(--shadow-card)]">
              <p className="text-[23px] font-extrabold">이 서비스로 문의하기</p>
              <p className="mt-2 text-[18.5px] leading-relaxed text-ink-2">
                아래 버튼을 누르면 <b>{item.name}</b>이 관심 서비스로 자동 입력됩니다.
              </p>
              <div className="mt-5 space-y-2.5">
                {(["상담신청", "견적문의", "주문요청"] as const).map((t, i) => (
                  <Link
                    key={t}
                    href={`/store/request?service=${item.slug}&type=${t}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-[20px] font-bold transition-colors ${
                      i === 1
                        ? "bg-primary text-white hover:bg-primary-dark"
                        : "bg-[#f7f8fa] text-ink-2 hover:bg-[#eceff2]"
                    }`}
                  >
                    {t} <ArrowRight size={20} />
                  </Link>
                ))}
              </div>
              <p className="mt-5 border-t border-line pt-4 text-[17.5px] leading-relaxed text-ink-3">
                보령·서천·홍성·서산·태안·논산, 전북 군산·익산 지역은 빠른 현장 확인이
                가능합니다.
              </p>
            </div>
          </aside>
        </div>

        {/* 관련 서비스 */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-[28px] font-extrabold">함께 문의하는 서비스</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {related.map((r) => (
                <ServiceCard key={r.slug} item={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
