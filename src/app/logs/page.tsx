"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, ClipboardList, Image as ImageIcon, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { Badge, EmptyState } from "@/components/ui";
import { DailyLogModal } from "@/components/modals";

export default function LogsPage() {
  const { dailyLogs, projects } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="page-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14.5px] text-ink-2">
          현장에서 짧게 남긴 메모가 AI 보고서와 공사 기록으로 정리됩니다.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
        >
          <ClipboardList size={15} /> 현장일보 작성
        </button>
      </div>

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
                      className="text-[14.5px] font-bold text-primary-dark hover:underline"
                    >
                      {project.name}
                    </Link>
                  )}
                  <Badge tone="neutral">{formatDate(d.date)}</Badge>
                  <span className="text-[12.5px] text-ink-3">
                    인원 {d.headcount}명 · {d.hours}시간
                  </span>
                </div>
                <p className="mt-2 text-[14px] font-medium">{d.work}</p>
                {d.materials && (
                  <p className="mt-1 text-[13px] text-ink-2">자재: {d.materials}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {d.issues && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning-bg px-2.5 py-1 text-[12.5px] font-semibold text-warning">
                      <AlertTriangle size={12} /> {d.issues}
                    </span>
                  )}
                  {d.tomorrow && (
                    <span className="rounded-lg bg-[#f2f4f6] px-2.5 py-1 text-[12.5px] font-semibold text-ink-2">
                      내일: {d.tomorrow}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {[...Array(Math.min(6, d.photoCount))].map((_, i) => (
                    <span
                      key={i}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary"
                    >
                      <ImageIcon size={15} />
                    </span>
                  ))}
                  {d.photoCount > 0 && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[12.5px] text-ink-3">
                      <Camera size={13} /> {d.photoCount}장
                    </span>
                  )}
                </div>
                {d.aiReport && (
                  <div className="mt-3 rounded-xl bg-primary-light/60 p-3.5 text-[13.5px] leading-relaxed">
                    <span className="inline-flex items-center gap-1 font-bold text-primary-dark">
                      <Sparkles size={12} /> AI 보고서 ·{" "}
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
