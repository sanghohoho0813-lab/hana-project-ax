"use client";

import { useMemo, useState } from "react";
import { BellRing, Phone, Plus, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatMoney, formatDate } from "@/lib/format";
import { Badge, EmptyState, type Tone } from "@/components/ui";
import { NewInquiryModal, PhoneMemoModal } from "@/components/modals";
import type { StageKey } from "@/lib/types";

const STAGES: { key: StageKey; label: string; tone: Tone }[] = [
  { key: "inquiry", label: "문의 접수", tone: "neutral" },
  { key: "visit", label: "현장 확인", tone: "info" },
  { key: "drafting", label: "견적 작성", tone: "info" },
  { key: "sent", label: "견적 발송", tone: "warning" },
  { key: "negotiating", label: "협의 중", tone: "warning" },
  { key: "won", label: "계약", tone: "success" },
  { key: "hold", label: "보류·실패", tone: "neutral" },
];

function probTone(p: number): Tone {
  if (p >= 70) return "success";
  if (p >= 50) return "info";
  if (p >= 30) return "warning";
  return "neutral";
}

export default function InquiriesPage() {
  const { opportunities, showToast } = useApp();
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const kpi = useMemo(() => {
    const newThisMonth = opportunities.filter((o) => o.stage !== "won").length;
    const visits = opportunities.filter((o) => o.stage === "visit").length;
    const sent = opportunities.filter(
      (o) => o.stage === "sent" || o.stage === "negotiating"
    ).length;
    const negotiatingAmount = opportunities
      .filter((o) => o.stage === "negotiating" || o.stage === "sent")
      .reduce((s, o) => s + o.amount, 0);
    return { newThisMonth, visits, sent, negotiatingAmount, conversion: 33 };
  }, [opportunities]);

  const forecast = useMemo(() => {
    const confirmed = opportunities
      .filter((o) => o.stage === "won")
      .reduce((s, o) => s + o.amount, 0);
    const high = opportunities
      .filter((o) => o.stage !== "won" && o.stage !== "hold" && o.probability >= 70)
      .reduce((s, o) => s + o.amount, 0);
    const weightedNextMonth = opportunities
      .filter(
        (o) =>
          o.stage !== "won" && o.stage !== "hold" && o.expectedCloseMonth === 8
      )
      .reduce((s, o) => s + Math.round((o.amount * o.probability) / 100), 0);
    return {
      confirmed,
      high,
      weightedNextMonth,
      nextMonth: confirmed + weightedNextMonth,
    };
  }, [opportunities]);

  const followUps = opportunities.filter(
    (o) => o.sentDaysAgo !== undefined && o.sentDaysAgo >= 3 && o.stage !== "won"
  );

  return (
    <div className="page-in space-y-6">
      {/* 상단 KPI + 버튼 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14.5px] text-ink-2">
          전화·카톡으로 들어온 문의를 놓치지 않고 계약까지 관리하세요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setMemoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-ink-2 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
          >
            <Phone size={15} className="text-primary" />
            전화메모 정리
          </button>
          <button
            onClick={() => setInquiryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
          >
            <Plus size={16} />새 문의 등록
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "이번 달 신규 문의", value: `${kpi.newThisMonth}건` },
          { label: "현장방문 예정", value: `${kpi.visits}건` },
          { label: "견적 발송", value: `${kpi.sent}건` },
          { label: "협의 중 예상금액", value: formatMoney(kpi.negotiatingAmount) },
          { label: "이번 달 수주전환율", value: `${kpi.conversion}%` },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[12.5px] font-semibold text-ink-3">{k.label}</p>
            <p className="mt-1 text-[20px] font-extrabold tracking-tight">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* 재접촉 알림 */}
      {followUps.length > 0 && (
        <div className="card border border-warning/20 bg-warning-bg/50 p-5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[14px] font-bold text-warning">
            <BellRing size={15} /> 견적 재접촉 알림
          </p>
          <div className="space-y-2">
            {followUps.map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-2 rounded-xl bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-[13.5px]">
                  <span className="font-bold">{o.customer}</span> 견적 발송 후{" "}
                  <span className="font-bold text-warning">
                    {o.sentDaysAgo}일
                  </span>
                  이 지났습니다. 진행 여부를 확인하세요.
                </p>
                <button
                  onClick={() => showToast(`${o.manager}에게 재연락 일정이 등록됐어요`)}
                  className="shrink-0 self-start rounded-lg bg-primary-light px-3 py-1.5 text-[12.5px] font-semibold text-primary-dark transition-colors hover:bg-[#dcebfd]"
                >
                  재연락 등록
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 파이프라인 */}
      <section>
        <h3 className="mb-3 text-[17px] font-bold">영업 파이프라인</h3>
        <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-7 lg:px-7">
          <div className="flex min-w-max gap-3">
            {STAGES.map((stage) => {
              const items = opportunities.filter((o) => o.stage === stage.key);
              return (
                <div key={stage.key} className="w-64 shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[13px] font-bold text-ink-2">
                      {stage.label}
                    </span>
                    <span className="rounded-full bg-[#e8ebee] px-2 py-0.5 text-[11.5px] font-bold text-ink-3">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2.5 rounded-2xl bg-[#eceff2]/70 p-2.5 min-h-28">
                    {items.length === 0 ? (
                      <p className="px-2 py-6 text-center text-[12px] text-ink-3">
                        해당 단계 없음
                      </p>
                    ) : (
                      items.map((o) => (
                        <div key={o.id} className="card card-hover p-4">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <p className="text-[13.5px] leading-snug font-bold">
                              {o.customer}
                            </p>
                            <Badge tone={probTone(o.probability)}>
                              {o.probability}%
                            </Badge>
                          </div>
                          <p className="text-[12px] text-ink-3">
                            {o.region} · {o.workType}
                          </p>
                          <p className="mt-2 text-[15px] font-extrabold">
                            {formatMoney(o.amount)}
                          </p>
                          <div className="mt-2.5 border-t border-line pt-2.5 text-[12px]">
                            <p className="font-semibold text-ink-2">
                              다음: {o.nextAction}
                            </p>
                            <p className="mt-0.5 text-ink-3">
                              {formatDate(o.nextDate)} · {o.manager}
                            </p>
                          </div>
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
        <h3 className="mb-1 flex items-center gap-2 text-[16px] font-bold">
          <TrendingUp size={17} className="text-primary" /> 다음 달 매출 예측
        </h3>
        <p className="mb-4 text-[13px] text-ink-3">
          각 영업기회의 예상금액 × 수주 가능성으로 계산한 가중 예측입니다.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "확정 계약", value: forecast.confirmed, tone: "text-ink" },
            { label: "수주 가능성 70% 이상", value: forecast.high, tone: "text-ink" },
            { label: "협의 중 가중 예상매출", value: forecast.weightedNextMonth, tone: "text-ink" },
            { label: "다음 달 예상 신규수주", value: forecast.nextMonth, tone: "text-primary" },
          ].map((f) => (
            <div key={f.label} className="rounded-2xl bg-[#f7f8fa] p-4">
              <p className="text-[12.5px] font-semibold text-ink-3">{f.label}</p>
              <p className={`mt-1 text-[19px] font-extrabold tracking-tight ${f.tone}`}>
                {formatMoney(f.value)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-primary-light/60 px-4 py-3 text-[13.5px] font-medium text-primary-dark">
          현재 문의와 견적을 기준으로 다음 달 약 {formatMoney(forecast.nextMonth)}의
          신규수주가 예상됩니다.
        </p>
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
