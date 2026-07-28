"use client";

import Link from "next/link";
import { CheckCircle2, Stamp, XCircle } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatMoney } from "@/lib/format";
import { Badge, EmptyState, PageIntro, type Tone } from "@/components/ui";

const KIND_TONE: Record<string, Tone> = {
  견적: "info",
  추가공사: "danger",
  "자재 발주": "warning",
  용역비: "success",
  "잔금 청구": "success",
};

export default function ApprovalsPage() {
  const { approvals, decideApproval, showToast, projects } = useApp();
  const pending = approvals.filter((a) => a.status === "대기");
  const decided = approvals.filter((a) => a.status !== "대기");

  return (
    <div className="page-in space-y-6">
      <PageIntro message="승인 한 번으로 청구와 공사가 바로 진행됩니다." />

      <div className="card flex items-start gap-3.5 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <Stamp size={19} />
        </span>
        <div>
          <p className="text-[15px] font-bold">대표 승인함</p>
          <p className="mt-0.5 text-[13.5px] text-ink-2">
            견적·추가공사·자재 발주·용역비·잔금 청구를 한곳에서 승인하세요.
            승인하면 상태가 바로 반영됩니다.
          </p>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-[17px] font-bold">
          승인 대기 <span className="text-danger">{pending.length}건</span>
        </h3>
        {pending.length === 0 ? (
          <EmptyState
            title="승인 대기 항목이 없어요"
            desc="새 요청이 오면 여기에 표시됩니다."
          />
        ) : (
          <div className="space-y-2.5">
            {pending.map((a) => {
              const project = projects.find((p) => p.id === a.projectId);
              return (
                <div key={a.id} className="card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={KIND_TONE[a.kind] ?? "neutral"}>{a.kind}</Badge>
                        <p className="text-[14.5px] font-bold">{a.title}</p>
                      </div>
                      <p className="mt-1 text-[13px] text-ink-2">{a.desc}</p>
                      {project && (
                        <Link
                          href={`/projects/${project.id}`}
                          className="mt-1 inline-block text-[12.5px] font-semibold text-primary-dark hover:underline"
                        >
                          {project.name} 상세 보기
                        </Link>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.amount !== undefined && (
                        <span className="mr-1 text-[16px] font-extrabold">
                          {formatMoney(a.amount)}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          decideApproval(a.id, "승인");
                          showToast(`'${a.kind}' 항목이 승인됐어요`);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-primary-dark"
                      >
                        <CheckCircle2 size={14} /> 승인
                      </button>
                      <button
                        onClick={() => {
                          decideApproval(a.id, "반려");
                          showToast("반려 처리됐어요");
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#f2f4f6] px-4 py-2 text-[13px] font-bold text-ink-2 transition-colors hover:bg-danger-bg hover:text-danger"
                      >
                        <XCircle size={14} /> 반려
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h3 className="mb-3 text-[17px] font-bold">처리 완료</h3>
          <div className="space-y-2">
            {decided.map((a) => (
              <div key={a.id} className="card flex items-center justify-between gap-3 p-4 opacity-80">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge tone={KIND_TONE[a.kind] ?? "neutral"}>{a.kind}</Badge>
                  <p className="truncate text-[13.5px] font-semibold">{a.title}</p>
                </div>
                <Badge tone={a.status === "승인" ? "success" : "danger"}>
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
