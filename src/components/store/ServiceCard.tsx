"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { categoryOf, type ServiceItem } from "@/lib/store-catalog";
import { formatMoney } from "@/lib/format";
import { ServiceVisual } from "./ServiceVisual";

export function priceLabel(item: ServiceItem): string {
  if (item.priceKind === "from" && item.priceFrom) return `${formatMoney(item.priceFrom)}부터`;
  if (item.priceKind === "quote") return "현장 확인 후 견적";
  return "별도 상담";
}

export function ServiceCard({ item }: { item: ServiceItem }) {
  const cat = categoryOf(item.category);
  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
      <Link href={`/store/services/${item.slug}`} className="block h-[13rem] shrink-0">
        <ServiceVisual item={item} />
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-[#f2f4f6] px-2.5 py-1 text-[16.5px] font-bold text-ink-2">
            {cat.name}
          </span>
          {item.provider === "하나컨설팅" && (
            <span className="rounded-lg bg-success-bg px-2.5 py-1 text-[16.5px] font-bold text-success">
              하나컨설팅
            </span>
          )}
          {item.popular && (
            <span className="rounded-lg bg-warning-bg px-2.5 py-1 text-[16.5px] font-bold text-warning">
              문의 많은 서비스
            </span>
          )}
        </div>

        <Link href={`/store/services/${item.slug}`}>
          <h3 className="mt-3 text-[24px] leading-snug font-extrabold hover:text-primary-dark">
            {item.name}
          </h3>
        </Link>
        <p className="mt-1.5 text-[19px] leading-relaxed text-ink-2">{item.tagline}</p>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            className={`text-[23px] font-extrabold ${
              item.priceKind === "from" ? "text-primary" : "text-ink-2"
            }`}
          >
            {priceLabel(item)}
          </span>
          <span className="inline-flex items-center gap-1 text-[17.5px] text-ink-3">
            <Clock size={18} /> {item.duration}
          </span>
        </div>

        <div className="mt-5 flex gap-2 pt-1">
          <Link
            href={`/store/services/${item.slug}`}
            className="flex-1 rounded-xl bg-[#f2f4f6] px-4 py-3 text-center text-[18.5px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
          >
            자세히 보기
          </Link>
          <Link
            href={`/store/request?service=${item.slug}&type=견적문의`}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-4 py-3 text-[18.5px] font-bold text-white transition-colors hover:bg-primary-dark"
          >
            견적문의 <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
