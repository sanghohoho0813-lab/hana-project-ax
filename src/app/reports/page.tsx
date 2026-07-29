"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, Plus, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { fullName } from "@/lib/team";
import { whenLabel } from "@/lib/ops-calc";
import { Badge, EmptyState, PageIntro } from "@/components/ui";
import { Avatar, ReportModal } from "@/components/ops";

type Filter = "all" | "review" | "approved" | "mine";

function ReportsInner() {
  const searchParams = useSearchParams();
  const { reports, projects, tasks, currentUserId, permission, reviewReport, updateTask, showToast } =
    useApp();
  const initial = (searchParams.get("filter") as Filter) ?? "all";
  const [filter, setFilter] = useState<Filter>(initial === "review" ? "review" : "all");
  const [writeOpen, setWriteOpen] = useState(false);

  const visible = useMemo(
    () => (permission.seeAllMembers ? reports : reports.filter((r) => r.authorId === currentUserId)),
    [reports, permission.seeAllMembers, currentUserId]
  );

  const list = useMemo(() => {
    const sorted = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter === "review") return sorted.filter((r) => r.reviewStatus === "검토 대기");
    if (filter === "approved") return sorted.filter((r) => r.reviewStatus === "승인");
    if (filter === "mine") return sorted.filter((r) => r.authorId === currentUserId);
    return sorted;
  }, [visible, filter, currentUserId]);

  const pending = visible.filter((r) => r.reviewStatus === "검토 대기").length;

  return (
    <div className="page-in space-y-5">
      <PageIntro message="흩어진 업무보고를 한 곳에 모으고, 관리자 검토까지 남깁니다.">
        <button
          onClick={() => setWriteOpen(true)}
          className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
        >
          <Plus size={24} /> 업무보고 작성
        </button>
      </PageIntro>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "전체 보고", value: visible.length },
          { label: "검토 대기", value: pending, tone: pending ? "text-warning" : "" },
          { label: "승인 완료", value: visible.filter((r) => r.reviewStatus === "승인").length },
          { label: "보완 요청", value: visible.filter((r) => r.reviewStatus === "보완 요청").length },
        ].map((k) => (
          <div key={k.label} className="card min-w-0 p-5">
            <p className="text-[18.5px] font-semibold text-ink-3">{k.label}</p>
            <p className={`mt-1 text-[34px] leading-none font-extrabold ${k.tone ?? ""}`}>
              {k.value}
              <span className="ml-1 text-[21px]">건</span>
            </p>
          </div>
        ))}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex min-w-max gap-2">
          {([
            { k: "all", l: "전체" },
            { k: "review", l: "검토 대기" },
            { k: "approved", l: "승인 완료" },
            { k: "mine", l: "내가 쓴 보고" },
          ] as { k: Filter; l: string }[]).map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`min-h-[3.25rem] shrink-0 rounded-xl px-4 text-[19px] font-bold transition-colors ${
                filter === f.k ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-2 hover:bg-[#e8ebee]"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title="해당하는 보고가 없어요" desc="업무보고 작성 버튼으로 첫 보고를 남겨 보세요." />
      ) : (
        <div className="stagger space-y-3">
          {list.map((r) => {
            const project = projects.find((p) => p.id === r.projectId);
            const task = tasks.find((t) => t.id === r.taskId);
            return (
              <div key={r.id} className="card min-w-0 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      r.reviewStatus === "승인"
                        ? "success"
                        : r.reviewStatus === "보완 요청"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {r.reviewStatus}
                  </Badge>
                  <Badge tone="neutral">{r.kind}</Badge>
                  <span className="text-[18px] text-ink-3">{whenLabel(r.createdAt)}</span>
                </div>

                <div className="mt-3 flex items-center gap-2.5">
                  <Avatar id={r.authorId} size={44} />
                  <div className="min-w-0">
                    <p className="text-[20.5px] font-bold">{fullName(r.authorId)}</p>
                    <p className="truncate text-[18px] text-ink-3">
                      {task ? task.title : "업무 연결 없음"}
                      {project && ` · ${project.shortName}`}
                    </p>
                  </div>
                </div>

                {r.summary ? (
                  <div className="mt-3 rounded-2xl bg-[#f7f8fa] p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[17.5px] font-bold text-primary-dark">
                      <Sparkles size={19} /> 정리된 보고
                    </p>
                    <dl className="space-y-1.5 text-[19px]">
                      {([
                        ["완료 작업", r.summary.done],
                        ["변경사항", r.summary.changes],
                        ["추가 필요자재", r.summary.materials],
                        ["다음 작업", r.summary.next],
                        ["관리자 확인 필요", r.summary.needsManager],
                      ] as [string, string | undefined][])
                        .filter(([, v]) => !!v)
                        .map(([k, v]) => (
                          <div key={k} className="flex gap-3">
                            <dt className="w-[10.5rem] shrink-0 font-semibold text-ink-3">{k}</dt>
                            <dd className="min-w-0">{v}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl bg-[#f7f8fa] p-4 text-[19px] leading-relaxed">{r.raw}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[18px] text-ink-3">
                  <span>진행률 {r.progress}%</span>
                  {r.photoCount > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Camera size={19} /> 사진 {r.photoCount}장
                    </span>
                  )}
                  {r.eta && <span>예상 완료 {r.eta}</span>}
                  {project && (
                    <Link
                      href={`/projects/${project.id}?tab=comms`}
                      className="font-bold text-primary hover:underline"
                    >
                      타임라인 보기
                    </Link>
                  )}
                </div>

                {r.reviewNote && (
                  <p className="mt-2.5 rounded-xl bg-primary-light/60 px-4 py-3 text-[18.5px] text-primary-dark">
                    관리자 의견 · {r.reviewNote}
                  </p>
                )}

                {permission.reviewReport && r.reviewStatus === "검토 대기" && (
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    <button
                      onClick={() => {
                        reviewReport(r.id, "승인");
                        if (r.taskId) updateTask(r.taskId, { status: "승인 완료" });
                        showToast("보고를 승인했습니다");
                      }}
                      className="min-h-[3.5rem] rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => {
                        reviewReport(r.id, "보완 요청", "내용 보완이 필요합니다.");
                        if (r.taskId) updateTask(r.taskId, { status: "보완 요청" });
                        showToast("보완을 요청했습니다");
                      }}
                      className="min-h-[3.5rem] rounded-2xl bg-[#f2f4f6] px-5 text-[20px] font-bold text-ink-2 transition-colors hover:bg-danger-bg hover:text-danger"
                    >
                      보완 요청
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ReportModal open={writeOpen} onClose={() => setWriteOpen(false)} />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="card p-12 text-center text-[20px] text-ink-3">불러오는 중입니다...</div>}>
      <ReportsInner />
    </Suspense>
  );
}
