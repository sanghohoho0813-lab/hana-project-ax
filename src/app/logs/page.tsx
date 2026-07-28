"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, ClipboardList, Image as ImageIcon, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { Badge, EmptyState, PageIntro } from "@/components/ui";
import { DailyLogModal } from "@/components/modals";

export default function LogsPage() {
  const { dailyLogs, projects } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="page-in space-y-5">
      <PageIntro message="현장 메모를 보고 가능한 기록으로 바꿉니다.">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[21px] font-semibold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
        >
          <ClipboardList size={22} /> 현장일보 작성
        </button>
      </PageIntro>

      {dailyLogs.length === 0 ? (
        <EmptyState
          title="아직 등록된 현장일보가 없어요"
          desc="현장일보 작성 버튼으로 첫 일보를 등록해 보세요."
        />
      ) : (
        <div className="space-y-3">
          {dailyLogs.map((d) => {
            const project = projects.find((p) => p.id === d.projectId);
            return (
              <div key={d.id} className="card card-hover p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {project && (
                    <Link
                      href={`/projects/${project.id}?tab=logs`}
                      className="text-[21.8px] font-bold text-primary-dark hover:underline"
                    >
                      {project.name}
                    </Link>
                  )}
                  <Badge tone="neutral">{formatDate(d.date)}</Badge>
                  <span className="text-[18.8px] text-ink-3">
                    인원 {d.headcount}명 · {d.hours}시간
                  </span>
                </div>
                <p className="mt-2 text-[21px] font-medium">{d.work}</p>
                {d.materials && (
                  <p className="mt-1 text-[19.5px] text-ink-2">자재: {d.materials}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {d.issues && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning-bg px-2.5 py-1 text-[18.8px] font-semibold text-warning">
                      <AlertTriangle size={18} /> {d.issues}
                    </span>
                  )}
                  {d.tomorrow && (
                    <span className="rounded-lg bg-[#f2f4f6] px-2.5 py-1 text-[18.8px] font-semibold text-ink-2">
                      내일: {d.tomorrow}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {[...Array(Math.min(6, d.photoCount))].map((_, i) => (
                    <span
                      key={i}
                      className="flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-lg bg-primary-light text-primary"
                    >
                      <ImageIcon size={22} />
                    </span>
                  ))}
                  {d.photoCount > 0 && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[18.8px] text-ink-3">
                      <Camera size={20} /> {d.photoCount}장
                    </span>
                  )}
                </div>
                {d.aiReport && (
                  <div className="mt-3 rounded-xl bg-primary-light/60 p-3.5 text-[20.2px] leading-relaxed">
                    <span className="inline-flex items-center gap-1 font-bold text-primary-dark">
                      <Sparkles size={18} /> AI 보고서 ·{" "}
                    </span>
                    {d.aiReport}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DailyLogModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
