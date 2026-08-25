"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Phone, PlusSquare } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge, EmptyState, PageIntro, type Tone } from "@/components/ui";
import { PhoneMemoModal } from "@/components/modals";
import type { ChangeOrderStatus } from "@/lib/types";

const STATUS_FLOW: ChangeOrderStatus[] = [
  "요청 접수",
  "견적 작성",
  "견적 발송",
  "승인 대기",
  "승인 완료",
  "공사 완료",
  "청구 완료",
];

function coTone(status: ChangeOrderStatus): Tone {
  if (status === "승인 완료" || status === "청구 완료") return "success";
  if (status === "승인 대기") return "danger";
  if (status === "공사 완료") return "info";
  return "warning";
}

export default function ChangeOrdersPage() {
  const { changeOrders, projects, updateChangeOrder, showToast } = useApp();
  const [memoOpen, setMemoOpen] = useState(false);

  const verbal = changeOrders.filter((c) => c.verbalOnly);
  const totalUnbilled = changeOrders
    .filter((c) => !c.billed)
    .reduce((s, c) => s + c.addRevenue, 0);

  return (
    <div className="page-in space-y-5">
      <PageIntro message="말로 요청받은 작업을 실제 매출로 남기세요.">
        <button
          onClick={() => setMemoOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[21px] font-semibold text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
        >
          <Phone size={22} /> 전화메모로 등록
        </button>
      </PageIntro>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "전체 추가공사", value: `${changeOrders.length}건` },
          { label: "전화 요청 · 서면 미승인", value: `${verbal.length}건`, danger: verbal.length > 0 },
          { label: "미청구 추가매출", value: formatMoney(totalUnbilled) },
          {
            label: "예상 추가이익 합계",
            value: formatMoney(changeOrders.reduce((s, c) => s + (c.addRevenue - c.addCost), 0)),
          },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[18.8px] font-semibold text-ink-3">{k.label}</p>
            <p className={`mt-1 text-[30px] font-extrabold ${"danger" in k && k.danger ? "text-danger" : ""}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {verbal.length > 0 && (
        <div className="card pulse-danger border border-danger/15 bg-danger-bg/40 p-5">
          <p className="flex items-center gap-2 text-[21px] font-bold text-danger">
            <AlertTriangle size={24} /> 서면승인이 필요한 요청이 있습니다
          </p>
          {verbal.map((c) => (
            <p key={c.id} className="mt-1.5 text-[20.2px] text-ink-2">
              <b>{c.content}</b> 요청이 아직 전화로만 접수돼 있습니다. 작업 전에 서면승인을 받으세요.
            </p>
          ))}
        </div>
      )}

      {changeOrders.length === 0 ? (
        <EmptyState icon={<PlusSquare size={30} />} title="등록된 추가공사가 없어요" />
      ) : (
        <div className="space-y-3">
          {changeOrders.map((c) => {
            const project = projects.find((p) => p.id === c.projectId);
            const stepIdx = STATUS_FLOW.indexOf(c.status);
            const next = STATUS_FLOW[stepIdx + 1];
            return (
              <div
                key={c.id}
                className={`card p-5 ${c.verbalOnly ? "border border-danger/15" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[21.8px] font-bold">{c.content}</p>
                  <Badge tone={coTone(c.status)}>{c.status}</Badge>
                  {c.verbalOnly && <Badge tone="danger">전화 요청</Badge>}
                </div>
                <p className="mt-1 text-[18.8px] text-ink-3">
                  {project ? (
                    <Link href={`/projects/${project.id}?tab=changes`} className="font-semibold text-primary-dark hover:underline">
                      {project.name}
                    </Link>
                  ) : (
                    "프로젝트 미연결"
                  )}{" "}
                  · {formatDate(c.requestDate)} · 요청자 {c.requester}
                </p>

                {/* 진행 단계 */}
                <div className="mt-3.5 flex flex-wrap items-center gap-1">
                  {STATUS_FLOW.map((s, i) => (
                    <span
                      key={s}
                      className={`rounded-full px-2.5 py-1 text-[17.2px] font-semibold ${
                        i < stepIdx
                          ? "bg-success-bg text-success"
                          : i === stepIdx
                            ? "bg-primary text-white"
                            : "bg-[#f2f4f6] text-ink-3"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="mt-3.5 flex flex-wrap items-end justify-between gap-3">
                  <div className="grid grid-cols-3 gap-4 text-[19.5px]">
                    <div>
                      <p className="text-ink-3">추가매출</p>
                      <p className="text-[22.5px] font-extrabold">{formatMoney(c.addRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-ink-3">추가원가</p>
                      <p className="text-[22.5px] font-extrabold">{formatMoney(c.addCost)}</p>
                    </div>
                    <div>
                      <p className="text-ink-3">추가이익</p>
                      <p className="text-[22.5px] font-extrabold text-success">
                        {formatMoney(c.addRevenue - c.addCost)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] text-ink-3">
                      견적서 {c.quoteSent ? "발송 완료" : "미발송"} · 청구{" "}
                      {c.billed ? "완료" : "전"}
                    </span>
                    {next && (
                      <button
                        onClick={() => {
                          updateChangeOrder(c.id, {
                            status: next,
                            verbalOnly: next === "요청 접수" ? c.verbalOnly : false,
                            quoteSent: c.quoteSent || next === "견적 발송" || STATUS_FLOW.indexOf(next) >= 2,
                            billed: c.billed || next === "청구 완료",
                          });
                          showToast(`'${next}' 단계로 변경됐어요`);
                        }}
                        className="rounded-xl bg-primary-light px-3.5 py-2 text-[18.8px] font-bold text-primary-dark transition-colors hover:bg-[#dcebfd]"
                      >
                        다음 단계: {next}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PhoneMemoModal open={memoOpen} onClose={() => setMemoOpen(false)} />
    </div>
  );
}
