"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListChecks, Phone, Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { MEMBERS } from "@/lib/team";
import { awaitingReview, isOverdue, isUnacked, needsResultReport } from "@/lib/ops-calc";
import { EmptyState, PageIntro } from "@/components/ui";
import { TaskCard, TaskDetailModal } from "@/components/ops";
import { PhoneMemoTaskModal, TaskCreateModal } from "@/components/TaskCreate";
import type { Task } from "@/lib/ops-types";

type Filter = "all" | "unacked" | "overdue" | "progress" | "review" | "report" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unacked", label: "미확인" },
  { key: "overdue", label: "기한 초과" },
  { key: "progress", label: "진행 중" },
  { key: "report", label: "결과보고 대기" },
  { key: "review", label: "검토 대기" },
  { key: "done", label: "완료" },
];

function TasksInner() {
  const searchParams = useSearchParams();
  const { tasks, currentUserId, permission } = useApp();
  const initial = (searchParams.get("filter") as Filter) ?? "all";
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.key === initial) ? initial : "all"
  );
  const [assignee, setAssignee] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const taskParam = searchParams.get("task");
  const [prevParam, setPrevParam] = useState(taskParam);
  const [open, setOpen] = useState<Task | null>(
    taskParam ? (tasks.find((t) => t.id === taskParam) ?? null) : null
  );
  if (taskParam !== prevParam) {
    setPrevParam(taskParam);
    if (taskParam) setOpen(tasks.find((t) => t.id === taskParam) ?? null);
  }

  const visible = useMemo(
    () => (permission.seeAllMembers ? tasks : tasks.filter((t) => t.assigneeId === currentUserId || t.watcherIds.includes(currentUserId))),
    [tasks, permission.seeAllMembers, currentUserId]
  );

  const list = useMemo(() => {
    let l = visible;
    if (assignee !== "all") l = l.filter((t) => t.assigneeId === assignee);
    switch (filter) {
      case "unacked": return l.filter(isUnacked);
      case "overdue": return l.filter(isOverdue);
      case "progress": return l.filter((t) => t.status === "진행 중" || t.status === "확인함");
      case "report": return l.filter(needsResultReport);
      case "review": return l.filter(awaitingReview);
      case "done": return l.filter((t) => t.status === "승인 완료");
      default: return l.filter((t) => t.status !== "취소");
    }
  }, [visible, filter, assignee]);

  const count = (f: Filter) => {
    const l = visible;
    if (f === "unacked") return l.filter(isUnacked).length;
    if (f === "overdue") return l.filter(isOverdue).length;
    if (f === "report") return l.filter(needsResultReport).length;
    if (f === "review") return l.filter(awaitingReview).length;
    return 0;
  };

  return (
    <div className="page-in space-y-5">
      <PageIntro message="업무를 전달한 순간부터 확인·진행·완료까지 추적합니다.">
        {permission.assignTask && (
          <>
            <button
              onClick={() => setMemoOpen(true)}
              className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-white px-5 text-[20px] font-bold text-ink-2 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
            >
              <Phone size={22} className="text-primary" /> 전화메모 정리
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
            >
              <Plus size={24} /> 새 업무지시
            </button>
          </>
        )}
      </PageIntro>

      <div className="card space-y-3 p-4">
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex min-w-max gap-2">
            {FILTERS.map((f) => {
              const c = count(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex min-h-[3.25rem] shrink-0 items-center gap-2 rounded-xl px-4 text-[19px] font-bold transition-colors ${
                    filter === f.key ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-2 hover:bg-[#e8ebee]"
                  }`}
                >
                  {f.label}
                  {c > 0 && (
                    <span className={`rounded-md px-1.5 text-[16px] ${filter === f.key ? "bg-white/25" : "bg-danger text-white"}`}>
                      {c}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {permission.seeAllMembers && (
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex min-w-max gap-2">
              <button
                onClick={() => setAssignee("all")}
                className={`min-h-[3rem] shrink-0 rounded-xl px-4 text-[18.5px] font-bold transition-colors ${
                  assignee === "all" ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"
                }`}
              >
                담당자 전체
              </button>
              {MEMBERS.filter((m) => m.role !== "ceo").map((m) => (
                <button
                  key={m.id}
                  onClick={() => setAssignee(m.id)}
                  className={`min-h-[3rem] shrink-0 rounded-xl px-4 text-[18.5px] font-bold transition-colors ${
                    assignee === m.id ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"
                  }`}
                >
                  {m.name} {m.roleLabel}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={30} />}
          title="해당하는 업무가 없어요"
          desc="다른 조건으로 다시 찾아보세요."
        />
      ) : (
        <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={setOpen} />
          ))}
        </div>
      )}

      <TaskDetailModal task={open} onClose={() => setOpen(null)} />
      <TaskCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <PhoneMemoTaskModal open={memoOpen} onClose={() => setMemoOpen(false)} />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="card p-12 text-center text-[20px] text-ink-3">불러오는 중입니다...</div>}>
      <TasksInner />
    </Suspense>
  );
}
