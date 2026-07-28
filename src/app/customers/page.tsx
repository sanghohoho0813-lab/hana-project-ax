"use client";

import { Lightbulb, MapPin } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatMoney, formatDateFull } from "@/lib/format";
import { Badge, EmptyState, type Tone } from "@/components/ui";

function customerTone(status: string): Tone {
  switch (status) {
    case "제안 준비":
      return "info";
    case "연락 예정":
      return "warning";
    case "관심 없음":
      return "neutral";
    default:
      return "neutral";
  }
}

export default function CustomersPage() {
  const { customers, updateCustomer, showToast } = useApp();

  const rebookTargets = customers.filter(
    (c) => c.monthsSince >= 3 && c.status !== "관심 없음"
  );

  return (
    <div className="page-in space-y-6">
      <p className="text-[14.5px] text-ink-2">
        공사가 끝난 고객도 매출로 이어집니다. 점검·증설·유지보수 제안 시기를
        놓치지 마세요.
      </p>

      {/* 재수주 추천 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
          <Lightbulb size={17} className="text-warning" /> 재수주 추천
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {rebookTargets.map((c) => (
            <div key={c.id} className="card card-hover p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-[14.5px] font-bold">{c.name}</p>
                <Badge tone={customerTone(c.status)}>{c.status}</Badge>
              </div>
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                마지막 공사 후{" "}
                <span className="font-bold text-ink">{c.monthsSince}개월</span>이
                지났습니다. <span className="font-bold">{c.recommend}</span>{" "}
                제안을 준비해 보세요.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    updateCustomer(c.id, { status: "제안 준비" });
                    showToast(`${c.name} 제안 준비로 변경됐어요`);
                  }}
                  className="rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  제안 준비
                </button>
                <button
                  onClick={() => {
                    updateCustomer(c.id, { status: "연락 예정" });
                    showToast("연락 일정이 등록됐어요");
                  }}
                  className="rounded-xl bg-[#f2f4f6] px-3.5 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-[#e8ebee]"
                >
                  연락 일정 등록
                </button>
                <button
                  onClick={() => {
                    updateCustomer(c.id, { status: "관심 없음" });
                    showToast("관심 없음으로 표시했어요");
                  }}
                  className="rounded-xl px-3.5 py-2 text-[13px] font-semibold text-ink-3 transition-colors hover:bg-[#f2f4f6]"
                >
                  관심 없음
                </button>
              </div>
            </div>
          ))}
          {rebookTargets.length === 0 && (
            <EmptyState title="지금은 재수주 추천 대상이 없어요" />
          )}
        </div>
      </section>

      {/* 고객 리스트 */}
      <section>
        <h3 className="mb-3 text-[17px] font-bold">
          고객 목록 <span className="text-ink-3">{customers.length}곳</span>
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {customers.map((c) => (
            <div key={c.id} className="card card-hover p-5">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <p className="text-[14.5px] leading-snug font-bold">{c.name}</p>
                <Badge tone={customerTone(c.status)}>{c.status}</Badge>
              </div>
              <p className="flex items-center gap-1 text-[12.5px] text-ink-3">
                <MapPin size={12} /> {c.region} · 최근 공사{" "}
                {formatDateFull(c.lastWorkDate)}
              </p>
              <div className="mt-3.5 grid grid-cols-2 gap-y-2 text-[13px]">
                <div>
                  <p className="text-ink-3">누적 계약금액</p>
                  <p className="font-extrabold">{formatMoney(c.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-ink-3">미수금</p>
                  <p
                    className={`font-extrabold ${c.receivable > 0 ? "text-danger" : "text-ink"}`}
                  >
                    {c.receivable > 0 ? formatMoney(c.receivable) : "없음"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-ink-3">진행한 공사</p>
                  <p className="font-semibold">{c.workTypes.join(" · ")}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-ink-3">다음 제안</p>
                  <p className="font-semibold">
                    {formatDateFull(c.nextProposal)} — {c.recommend}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
