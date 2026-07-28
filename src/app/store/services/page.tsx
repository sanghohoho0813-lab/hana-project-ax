"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Phone } from "lucide-react";
import {
  SERVICES,
  SERVICE_CATEGORIES,
  type ServiceCategoryKey,
} from "@/lib/store-catalog";
import { ServiceCard } from "@/components/store/ServiceCard";

type SortKey = "recommend" | "inquiry" | "priceLow";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "inquiry", label: "문의 많은 순" },
  { key: "priceLow", label: "시작 금액 낮은 순" },
];

function ServicesInner() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("category") as ServiceCategoryKey | null;
  const [category, setCategory] = useState<ServiceCategoryKey | "all">(
    initial && SERVICE_CATEGORIES.some((c) => c.key === initial) ? initial : "all"
  );
  const [sort, setSort] = useState<SortKey>("recommend");

  const list = useMemo(() => {
    const filtered =
      category === "all" ? [...SERVICES] : SERVICES.filter((s) => s.category === category);
    if (sort === "inquiry") filtered.sort((a, b) => b.inquiryCount - a.inquiryCount);
    else if (sort === "priceLow")
      filtered.sort((a, b) => (a.priceFrom ?? 999999) - (b.priceFrom ?? 999999));
    else
      filtered.sort(
        (a, b) => Number(!!b.popular) - Number(!!a.popular) || b.inquiryCount - a.inquiryCount
      );
    return filtered;
  }, [category, sort]);

  return (
    <div className="page-in mx-auto w-full max-w-[1500px] px-4 py-12 lg:px-8">
      <h1 className="text-[34px] font-extrabold lg:text-[38px]">서비스 안내</h1>
      <p className="mt-3 text-[21px] leading-relaxed text-ink-2">
        전기·통신공사부터 유지보수, 프로젝트 운영관리까지 요청할 수 있는 서비스입니다.
        <br className="hidden sm:block" />
        표시된 금액은 시작 금액이며, 정확한 금액은 현장을 확인한 뒤 견적서로 안내드립니다.
      </p>

      {/* 카테고리 필터 */}
      <div className="-mx-4 mt-8 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex min-w-max gap-2">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-2xl px-5 py-3 text-[19px] font-bold whitespace-nowrap transition-colors ${
              category === "all"
                ? "bg-primary text-white"
                : "border border-line bg-white text-ink-2 hover:bg-[#f7f8fa]"
            }`}
          >
            전체 {SERVICES.length}
          </button>
          {SERVICE_CATEGORIES.map((c) => {
            const n = SERVICES.filter((s) => s.category === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`rounded-2xl px-5 py-3 text-[19px] font-bold whitespace-nowrap transition-colors ${
                  category === c.key
                    ? "bg-primary text-white"
                    : "border border-line bg-white text-ink-2 hover:bg-[#f7f8fa]"
                }`}
              >
                {c.name} {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* 정렬 */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[19px] font-semibold text-ink-2">
          {list.length}개 서비스
          {category !== "all" &&
            ` · ${SERVICE_CATEGORIES.find((c) => c.key === category)?.desc}`}
        </p>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:rounded-2xl sm:bg-[#f2f4f6] sm:p-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-[18px] font-bold whitespace-nowrap transition-all sm:border-0 sm:py-2 ${
                sort === s.key
                  ? "border-primary bg-white text-ink shadow-sm"
                  : "border-line bg-white text-ink-3 hover:text-ink-2 sm:bg-transparent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <ServiceCard key={s.slug} item={s} />
        ))}
      </div>

      {list.length === 0 && (
        <div className="mt-10 rounded-3xl border border-line bg-white p-16 text-center">
          <p className="text-[22px] font-bold text-ink-2">해당 분야의 서비스가 아직 없어요</p>
          <p className="mt-2 text-[19px] text-ink-3">
            필요한 작업이 있으시면 상담으로 문의해 주세요.
          </p>
        </div>
      )}

      {/* 하단 CTA */}
      <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-[#f7f8fa] px-6 py-12 text-center">
        <p className="text-[26px] font-extrabold">찾는 서비스가 목록에 없나요?</p>
        <p className="text-[20px] text-ink-2">
          현장 상황을 알려 주시면 가능한 방법을 정리해 드립니다.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link
            href="/store/request?type=상담신청"
            className="rounded-2xl bg-primary px-7 py-4 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
          >
            상담신청
          </Link>
          <a
            href="tel:041-000-0000"
            className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-7 py-4 text-[20px] font-bold text-ink-2 transition-colors hover:bg-white"
          >
            <Phone size={21} /> 전화 상담 요청
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1500px] px-4 py-20 text-center text-[20px] text-ink-3">
          불러오는 중입니다...
        </div>
      }
    >
      <ServicesInner />
    </Suspense>
  );
}
