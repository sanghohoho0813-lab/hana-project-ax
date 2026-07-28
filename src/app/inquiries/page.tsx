"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, HelpCircle, Phone, Plus, Send, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatDate, formatMoney } from "@/lib/format";
import { companyKpi, needsFollowUp, weightedAmount } from "@/lib/calc";
import { Badge, EmptyState, PageIntro, type Tone } from "@/components/ui";
import { NewInquiryModal, PhoneMemoModal } from "@/components/modals";
import type { Opportunity, StageKey } from "@/lib/types";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "inquiry", label: "문의 접수" },
  { key: "visit", label: "현장 확인" },
  { key: "drafting", label: "견적 작성" },
  { key: "sent", label: "견적 발송" },
  { key: "negotiating", label: "협의 중" },
  { key: "won", label: "계약" },
  { key: "hold", label: "보류·실패" },
];

function probTone(p: number): Tone {
  if (p >= 70) return "success";
  if (p >= 50) return "info";
  if (p >= 30) return "warning";
  return "neutral";
}

export default function InquiriesPage() {
  const { opportunities, projects, changeOrders, updateOpportunity, showToast } = useApp();
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  const kpi = useMemo(
    () => companyKpi(projects, opportunities, changeOrders),
    [projects, opportunities, changeOrders]
  );

  const stale = opportunities.filter(needsFollowUp);
  const highChance = opportunities.filter(
    (o) => o.stage !== "won" && o.stage !== "hold" && o.probability >= 70
  );
  const unconfirmedVisits = opportunities.filter(
    (o) => o.needsVisit && !o.visitConfirmed && o.stage !== "won" && o.stage !== "hold"
  );

  const openCount = opportunities.filter((o) => o.stage !== "won" && o.stage !== "hold").length;
  const sentCount = opportunities.filter(
    (o) => o.stage === "sent" || o.stage === "negotiating"
  ).length;
  const negotiatingAmount = opportunities
    .filter((o) => o.stage === "sent" || o.stage === "negotiating")
    .reduce((s, o) => s + o.amount, 0);

  const act = (o: Opportunity, nextAction: string, patch: Partial<Opportunity>, msg: string) => {
    updateOpportunity(o.id, { nextAction, ...patch });
    showToast(msg);
  };

  const OPPORTUNITY_BOXES = [
    {
      key: "stale",
      title: "후속 연락이 필요한 견적",
      desc: "견적을 보낸 지 3일이 지났습니다",
      items: stale,
      tone: "warning" as Tone,
      icon: Send,
    },
    {
      key: "high",
      title: "수주 가능성이 높은 건",
      desc: "70% 이상 — 마무리에 집중하세요",
      items: highChance,
      tone: "success" as Tone,
      icon: TrendingUp,
    },
    {
      key: "visit",
      title: "방문 일정이 안 잡힌 건",
      desc: "날짜부터 확정해야 진행됩니다",
      items: unconfirmedVisits,
      tone: "info" as Tone,
      icon: CalendarCheck,
    },
  ];

  return (
    <div className="page-in space-y-5">
      <PageIntro message="문의가 들어온 순간부터 계약될 때까지 놓치지 않습니다.">
        <button
          onClick={() => setMemoOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-ink-2 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
        >
          <Phone size={15} className="text-primary" /> 전화메모 정리
        </button>
        <button
          onClick={() => setInquiryOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
        >
          <Plus size={16} /> 새 문의 등록
        </button>
      </PageIntro>

      {/* 이번 달 놓치면 안 되는 영업기회 */}
      <section>
        <h3 className="mb-3 text-[17px] font-bold">이번 달 놓치면 안 되는 영업기회</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          {OPPORTUNITY_BOXES.map((box) => (
            <div key={box.key} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-bold">{box.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">{box.desc}</p>
                </div>
                <Badge tone={box.tone}>{box.items.length}건</Badge>
              </div>
              {box.items.length === 0 ? (
                <p className="rounded-xl bg-[#f7f8fa] px-3.5 py-3 text-[12.5px] text-ink-3">
                  지금은 해당하는 건이 없어요.
                </p>
              ) : (
                <div className="space-y-2">
                  {box.items.slice(0, 3).map((o) => (
                    <div key={o.id} className="rounded-xl bg-[#f7f8fa] p-3.5">
                      <p className="truncate text-[13.5px] font-bold">{o.customer}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-2">
                        {formatMoney(o.amount)} · 수주 가능성 {o.probability}%
                        {box.key === "stale" && ` · 발송 후 ${o.sentDaysAgo}일`}
                      </p>
                      <button
                        onClick={() =>
                          box.key === "stale"
                            ? act(o, "담당자 재연락", { sentDaysAgo: 0, nextDate: "2026-07-29" }, `${o.manager}에게 재연락 일정을 등록했어요`)
                            : box.key === "visit"
                              ? act(o, "현장 방문", { visitConfirmed: true, stage: "visit" }, "방문 일정을 확정했어요")
                              : act(o, "계약서 준비", {}, "계약 준비 단계로 표시했어요")
                        }
                        className="mt-2 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-primary-dark shadow-sm transition-shadow hover:shadow-md"
                      >
                        {box.key === "stale"
                          ? "재연락 등록"
                          : box.key === "visit"
                            ? "방문 일정 확정"
                            : "계약 준비"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "진행 중 문의·견적", value: `${openCount}건` },
          { label: "현장방문 예정", value: `${unconfirmedVisits.length}건` },
          { label: "견적 발송·협의", value: `${sentCount}건` },
          { label: "협의 중 예상금액", value: formatMoney(negotiatingAmount) },
          { label: "이번 달 수주전환율", value: "33%" },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[12.5px] font-semibold text-ink-3">{k.label}</p>
            <p className="mt-1 text-[19px] font-extrabold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* 파이프라인 */}
      <section>
        <h3 className="mb-3 text-[17px] font-bold">영업 파이프라인</h3>
        <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-3">
            {STAGES.map((stage) => {
              const items = opportunities.filter((o) => o.stage === stage.key);
              return (
                <div key={stage.key} className="w-[16.5rem] shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[13px] font-bold text-ink-2">{stage.label}</span>
                    <span className="rounded-full bg-[#e8ebee] px-2 py-0.5 text-[11.5px] font-bold text-ink-3">
                      {items.length}
                    </span>
                  </div>
                  <div className="min-h-28 space-y-2.5 rounded-2xl bg-[#eceff2]/70 p-2.5">
                    {items.length === 0 ? (
                      <p className="px-2 py-7 text-center text-[12px] text-ink-3">
                        해당 단계 없음
                      </p>
                    ) : (
                      items.map((o) => (
                        <div key={o.id} className="card card-hover p-4">
                          <p className="text-[13.5px] leading-snug font-bold">{o.customer}</p>
                          <p className="mt-0.5 text-[12px] text-ink-3">
                            {o.region} · {o.workType}
                          </p>

                          {/* 다음 행동을 가장 크게 */}
                          <div className="mt-3 rounded-xl bg-primary-light/60 px-3 py-2.5">
                            <p className="text-[11px] font-semibold text-primary-dark/70">
                              다음 행동
                            </p>
                            <p className="text-[13.5px] font-bold text-primary-dark">
                              {o.nextAction}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-ink-3">
                              {formatDate(o.nextDate)} · {o.manager}
                            </p>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between">
                            <span className="text-[13px] font-extrabold">
                              {formatMoney(o.amount)}
                            </span>
                            <Badge tone={probTone(o.probability)}>{o.probability}%</Badge>
                          </div>

                          {o.stage !== "won" && o.stage !== "hold" && (
                            <button
                              onClick={() =>
                                act(
                                  o,
                                  "고객 회신 대기",
                                  { nextDate: "2026-07-31" },
                                  `'${o.nextAction}' 처리로 기록했어요`
                                )
                              }
                              className="mt-2.5 w-full rounded-lg bg-[#f2f4f6] py-2 text-[12px] font-bold text-ink-2 transition-colors hover:bg-primary-light hover:text-primary-dark"
                            >
                              처리 완료로 기록
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 매출 예측 */}
      <section className="card p-6">
        <div className="mb-1 flex items-center gap-2">
          <TrendingUp size={17} className="text-primary" />
          <h3 className="text-[16.5px] font-bold">다음 달 매출 예측</h3>
          <button
            onClick={() => setTipOpen((v) => !v)}
            aria-label="계산 방식 안내"
            className="relative rounded-full p-1 text-ink-3 transition-colors hover:bg-[#f2f4f6] hover:text-ink-2"
          >
            <HelpCircle size={15} />
            {tipOpen && (
              <span className="absolute top-full left-1/2 z-20 mt-1.5 w-60 -translate-x-1/2 rounded-xl bg-ink px-3.5 py-2.5 text-left text-[12px] leading-relaxed font-medium text-white shadow-lg">
                예상금액 × 수주 가능성을 반영한 내부 예측치입니다. 확정 계약은 100%로
                계산합니다.
              </span>
            )}
          </button>
        </div>
        <p className="mb-4 text-[13px] text-ink-3">
          확정된 계약과 가능성 가중금액을 구분해서 보여줍니다.
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "확정 계약", value: kpi.nextMonthConfirmed, note: "계약서 서명 완료" },
            {
              label: "높은 가능성 (70% 이상)",
              value: highChance.reduce((s, o) => s + o.amount, 0),
              note: `${highChance.length}건 · 예상금액 기준`,
            },
            {
              label: "협의 중 가중 예상매출",
              value: kpi.nextMonthWeighted,
              note: "가능성 반영",
            },
            {
              label: "다음 달 예상 신규수주",
              value: kpi.nextMonthOrders,
              note: "확정 + 가중",
              accent: true,
            },
          ].map((f) => (
            <div key={f.label} className="rounded-2xl bg-[#f7f8fa] p-4">
              <p className="text-[12.5px] font-semibold text-ink-3">{f.label}</p>
              <p
                className={`mt-1 text-[19px] font-extrabold tracking-tight ${f.accent ? "text-primary" : ""}`}
              >
                {formatMoney(f.value)}
              </p>
              <p className="mt-1 text-[11.5px] text-ink-3">{f.note}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-xl bg-primary-light/60 px-4 py-3 text-[13.5px] font-semibold text-primary-dark">
          현재 문의와 견적을 기준으로 다음 달 약 {formatMoney(kpi.nextMonthOrders)}의 신규수주가
          예상됩니다.
        </p>

        <div className="mt-3 grid gap-2 text-[12.5px] text-ink-3 sm:grid-cols-3">
          {opportunities
            .filter((o) => o.stage !== "hold")
            .slice(0, 3)
            .map((o) => (
              <p key={o.id} className="rounded-xl bg-[#f7f8fa] px-3.5 py-2.5">
                {o.customer.split(" ")[0]} · {formatMoney(o.amount)} × {o.probability}% ={" "}
                <b className="text-ink-2">{formatMoney(weightedAmount(o))}</b>
              </p>
            ))}
        </div>
      </section>

      {opportunities.length === 0 && (
        <EmptyState
          title="등록된 문의가 없어요"
          desc="새 문의 등록 버튼으로 첫 문의를 등록해 보세요."
        />
      )}

      <NewInquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
      <PhoneMemoModal open={memoOpen} onClose={() => setMemoOpen(false)} />
    </div>
  );
}
