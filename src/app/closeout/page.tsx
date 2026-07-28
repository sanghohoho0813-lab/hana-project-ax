"use client";

import Link from "next/link";
import { AlertTriangle, Banknote, CheckCircle2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatDate, formatMoney } from "@/lib/format";
import { closeoutDone, collectRate, missingCloseoutDocs, receivable } from "@/lib/calc";
import { Badge, PageIntro, ProgressBar, statusTone } from "@/components/ui";

export default function CloseoutPage() {
  const { projects } = useApp();

  const relevant = projects.filter(
    (p) => p.statusKey === "closeout" || p.statusKey === "done" || receivable(p) > 0
  );
  const totalReceivable = projects.reduce((s, p) => s + receivable(p), 0);
  const overdue = projects.filter((p) => (p.payment.overdueDays ?? 0) > 0);
  const balanceReady = projects.filter((p) => p.payment.balanceClaimable);
  const missingDocs = projects.filter(
    (p) => p.statusKey === "closeout" && missingCloseoutDocs(p).length > 1
  );
  const expectedThisMonth = projects.reduce((s, p) => s + p.payment.expectedThisMonth, 0);
  const claimable = balanceReady.reduce((s, p) => s + p.payment.balance, 0);

  return (
    <div className="page-in space-y-5">
      <PageIntro message="공사가 끝난 뒤 돈이 들어올 때까지 관리하세요." />

      {/* 핵심 알림 */}
      <div className="grid gap-3 md:grid-cols-2">
        {balanceReady.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}?tab=closeout`}
            className="card card-hover border border-success/20 bg-success-bg/40 p-5"
          >
            <p className="flex items-center gap-2 text-[21px] font-bold text-success">
              <Banknote size={24} /> 잔금 청구 가능
            </p>
            <p className="mt-1 text-[20.2px] text-ink-2">
              <b>{p.name}</b> — 잔금 {formatMoney(p.payment.balance)}을 바로 청구할 수 있습니다.
              준공서류 {closeoutDone(p)}/{p.closeoutDocs.length} 완료.
            </p>
          </Link>
        ))}
        {missingDocs.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}?tab=closeout`}
            className="card card-hover border border-warning/20 bg-warning-bg/40 p-5"
          >
            <p className="flex items-center gap-2 text-[21px] font-bold text-warning">
              <AlertTriangle size={24} /> 서류 누락으로 청구 지연 위험
            </p>
            <p className="mt-1 text-[20.2px] text-ink-2">
              <b>{p.name}</b> — {missingCloseoutDocs(p).join(", ")}이(가) 아직 없습니다.
            </p>
          </Link>
        ))}
        {overdue.map((p) => (
          <div key={p.id} className="card border border-danger/15 bg-danger-bg/30 p-5">
            <p className="flex items-center gap-2 text-[21px] font-bold text-danger">
              <AlertTriangle size={24} /> 지급기일 경과 미수금
            </p>
            <p className="mt-1 text-[20.2px] text-ink-2">
              <b>{p.name}</b> — 미수금 {formatMoney(receivable(p))} · 기일{" "}
              {p.payment.dueDate && formatDate(p.payment.dueDate)} 이후{" "}
              <b className="text-danger">{p.payment.overdueDays}일</b> 경과
            </p>
          </div>
        ))}
      </div>

      {/* 수금 요약 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "전체 미수금", value: formatMoney(totalReceivable), danger: totalReceivable > 0 },
          { label: "이번 달 입금 예정", value: formatMoney(expectedThisMonth) },
          { label: "잔금 청구 가능", value: formatMoney(claimable) },
          { label: "기일 경과", value: `${overdue.length}건`, danger: overdue.length > 0 },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[18.8px] font-semibold text-ink-3">{k.label}</p>
            <p className={`mt-1 text-[28.5px] font-extrabold ${k.danger ? "text-danger" : ""}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* 프로젝트별 준공·수금 현황 */}
      <section className="space-y-3">
        <h3 className="text-[25.5px] font-bold">프로젝트별 준공·수금 현황</h3>
        {relevant.map((p) => {
          const done = closeoutDone(p);
          const missing = missingCloseoutDocs(p);
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}?tab=closeout`}
              className="card card-hover block min-w-0 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[21.8px] font-bold">{p.name}</p>
                <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
                {p.payment.expectedThisMonth > 0 && (
                  <span className="text-[18px] font-semibold text-ink-3">
                    이번 달 {formatMoney(p.payment.expectedThisMonth)} 회수 예정
                  </span>
                )}
              </div>
              <div className="mt-3.5 grid min-w-0 gap-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <div className="mb-1 flex justify-between text-[18.8px] font-semibold">
                    <span className="text-ink-3">준공서류</span>
                    <span>
                      {done}/{p.closeoutDocs.length}
                    </span>
                  </div>
                  <ProgressBar
                    value={(done / p.closeoutDocs.length) * 100}
                    tone={done === p.closeoutDocs.length ? "success" : "warning"}
                  />
                  {missing.length > 0 && missing.length < 9 && (
                    <p className="mt-1.5 truncate text-[18px] font-semibold text-warning">
                      누락: {missing.join(", ")}
                    </p>
                  )}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[18.8px] font-semibold">
                    <span className="text-ink-3">수금률</span>
                    <span>{collectRate(p)}%</span>
                  </div>
                  <ProgressBar value={collectRate(p)} tone="info" />
                  <p className="mt-1.5 text-[18px] text-ink-3">
                    입금 {formatMoney(p.payment.received)} /{" "}
                    {formatMoney(p.contractAmount)}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center">
                  <span className="text-[18.8px] text-ink-3">미수금</span>
                  {receivable(p) > 0 ? (
                    <span className="text-[25.5px] font-extrabold text-danger">
                      {formatMoney(receivable(p))}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[21px] font-bold text-success">
                      <CheckCircle2 size={22} /> 없음
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
