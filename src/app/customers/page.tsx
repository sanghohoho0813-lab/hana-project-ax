"use client";

import { useState } from "react";
import { Lightbulb, MapPin } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatMoney, formatDateFull } from "@/lib/format";
import { Badge, EmptyState, Modal, PageIntro, GhostButton, type Tone } from "@/components/ui";
import type { Customer } from "@/lib/types";

function tone(status: string): Tone {
  switch (status) {
    case "제안 준비":
      return "info";
    case "연락 예정":
      return "warning";
    case "다음 달 검토":
      return "neutral";
    case "관심 없음":
      return "neutral";
    default:
      return "neutral";
  }
}

export default function CustomersPage() {
  const { customers, updateCustomer, showToast } = useApp();
  const [draft, setDraft] = useState<Customer | null>(null);

  const targets = customers.filter((c) => c.status !== "관심 없음");
  const totalProposal = targets.reduce((s, c) => s + c.proposalAmount, 0);

  return (
    <div className="page-in space-y-5">
      <PageIntro message="한 번 공사한 고객을 다음 매출로 연결하세요." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "관리 중인 고객", value: `${customers.length}곳` },
          { label: "재수주 제안 대상", value: `${targets.length}곳` },
          { label: "예상 제안금액 합계", value: formatMoney(totalProposal) },
          {
            label: "미수금 있는 고객",
            value: `${customers.filter((c) => c.receivable > 0).length}곳`,
          },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[18.8px] font-semibold text-ink-3">{k.label}</p>
            <p className="mt-1 text-[28.5px] font-extrabold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* 재수주 추천 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
          <Lightbulb size={26} className="text-warning" /> 재수주 추천
        </h3>
        {targets.length === 0 ? (
          <EmptyState title="지금은 재수주 추천 대상이 없어요" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {targets.map((c) => (
              <div key={c.id} className="card card-hover p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[21.8px] leading-snug font-bold">{c.name}</p>
                    <p className="mt-0.5 text-[18.8px] text-ink-3">
                      {c.region} · 최근 공사 {formatDateFull(c.lastWorkDate)}
                    </p>
                  </div>
                  <Badge tone={tone(c.status)}>{c.status}</Badge>
                </div>

                <div className="mt-3 rounded-2xl bg-[#f7f8fa] p-4">
                  <p className="text-[17.2px] font-semibold text-ink-3">추천 이유</p>
                  <ul className="mt-1 space-y-0.5">
                    {c.signals.map((s) => (
                      <li key={s} className="flex gap-1.5 text-[19.5px] text-ink-2">
                        <span className="mt-2 h-[0.45rem] w-[0.45rem] shrink-0 rounded-full bg-ink-3" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-[19.5px]">
                  <div>
                    <p className="text-[17.2px] text-ink-3">제안 서비스</p>
                    <p className="font-bold">{c.recommend}</p>
                  </div>
                  <div>
                    <p className="text-[17.2px] text-ink-3">예상 제안금액</p>
                    <p className="font-extrabold">{formatMoney(c.proposalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[17.2px] text-ink-3">연락 추천일</p>
                    <p className="font-bold">{formatDateFull(c.nextProposal)}</p>
                  </div>
                </div>
                <p className="mt-2 text-[18px] text-ink-3">담당 {c.manager}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      updateCustomer(c.id, { status: "연락 예정" });
                      showToast(`${c.manager}에게 연락 일정을 등록했어요`);
                    }}
                    className="rounded-xl bg-primary px-3.5 py-2 text-[19.5px] font-semibold text-white transition-colors hover:bg-primary-dark"
                  >
                    연락 일정 등록
                  </button>
                  <button
                    onClick={() => {
                      updateCustomer(c.id, { status: "제안 준비" });
                      setDraft(c);
                    }}
                    className="rounded-xl bg-[#f2f4f6] px-3.5 py-2 text-[19.5px] font-semibold text-ink-2 transition-colors hover:bg-[#e8ebee]"
                  >
                    제안서 초안
                  </button>
                  <button
                    onClick={() => {
                      updateCustomer(c.id, { status: "다음 달 검토" });
                      showToast("다음 달 검토 목록으로 옮겼어요");
                    }}
                    className="rounded-xl px-3.5 py-2 text-[19.5px] font-semibold text-ink-3 transition-colors hover:bg-[#f2f4f6]"
                  >
                    다음 달로 미루기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 고객 목록 */}
      <section>
        <h3 className="mb-3 text-[25.5px] font-bold">
          고객 목록 <span className="text-ink-3">{customers.length}곳</span>
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {customers.map((c) => (
            <div key={c.id} className="card card-hover p-5">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <p className="text-[21.8px] leading-snug font-bold">{c.name}</p>
                <Badge tone={tone(c.status)}>{c.status}</Badge>
              </div>
              <p className="flex items-center gap-1 text-[18.8px] text-ink-3">
                <MapPin size={18} /> {c.region} · 최근 공사 {formatDateFull(c.lastWorkDate)}
              </p>
              <div className="mt-3.5 grid grid-cols-2 gap-y-2.5 text-[19.5px]">
                <div>
                  <p className="text-[17.2px] text-ink-3">누적 계약금액</p>
                  <p className="font-extrabold">{formatMoney(c.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-[17.2px] text-ink-3">미수금</p>
                  <p className={`font-extrabold ${c.receivable > 0 ? "text-danger" : ""}`}>
                    {c.receivable > 0 ? formatMoney(c.receivable) : "없음"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[17.2px] text-ink-3">진행한 공사</p>
                  <p className="font-semibold">{c.workTypes.join(" · ")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 제안서 초안 */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="제안서 초안"
        desc={draft ? `${draft.name} · ${draft.recommend}` : ""}
        size="lg"
      >
        {draft && (
          <div>
            <div className="grid grid-cols-2 gap-y-3 rounded-2xl bg-[#f7f8fa] p-4 sm:grid-cols-4">
              {[
                ["제안 서비스", draft.recommend],
                ["예상금액", formatMoney(draft.proposalAmount)],
                ["연락 추천일", formatDateFull(draft.nextProposal)],
                ["담당", draft.manager],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[17.2px] text-ink-3">{k}</p>
                  <p className="text-[19.5px] font-semibold">{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-4 text-[21px] leading-relaxed">
              <p>
                안녕하세요, 하나정보통신입니다. {formatDateFull(draft.lastWorkDate)} 진행한{" "}
                {draft.workTypes.join("·")} 공사 이후 설비 상태를 점검할 시기가 되어 연락드립니다.
              </p>
              <div>
                <p className="mb-1.5 font-bold">제안 내용</p>
                <ul className="space-y-1 text-ink-2">
                  <li>· {draft.recommend} 및 현장 점검</li>
                  <li>· 노후 자재 교체 여부 확인 후 견적 제공</li>
                  <li>· 시공은 하나정보통신, 일정·자료 정리는 하나인사이트가 지원</li>
                </ul>
              </div>
              <div>
                <p className="mb-1.5 font-bold">예상 일정과 금액</p>
                <ul className="space-y-1 text-ink-2">
                  <li>· 현장 점검 후 3일 이내 견적서 발송</li>
                  <li>· 예상금액 {formatMoney(draft.proposalAmount)} (현장 확인 후 조정)</li>
                </ul>
              </div>
              {draft.receivable > 0 && (
                <p className="rounded-xl bg-warning-bg px-4 py-3 text-[19.5px] font-semibold text-warning">
                  잔여 미수금 {formatMoney(draft.receivable)}에 대한 안내를 함께 전달하세요.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <GhostButton onClick={() => setDraft(null)}>닫기</GhostButton>
              <button
                onClick={() => {
                  showToast("제안서 초안을 문서함에 저장했어요");
                  setDraft(null);
                }}
                className="rounded-xl bg-primary px-4 py-2.5 text-[21px] font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                문서함에 저장
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
