"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { NOW_LABEL } from "@/lib/company";
import { buildAlerts, managerBrief, opsKpi } from "@/lib/ops-calc";
import { EmptyState, PageIntro, Segment } from "@/components/ui";
import { AlertCard, TaskDetailModal } from "@/components/ops";
import type { Task } from "@/lib/ops-types";

type Slot = "morning" | "afternoon" | "evening" | "weekly";

export default function BriefPage() {
  const { tasks, schedules, reports } = useApp();
  const [slot, setSlot] = useState<Slot>("morning");
  const [open, setOpen] = useState<Task | null>(null);

  const kpi = opsKpi(tasks, schedules);
  const brief = managerBrief(tasks, schedules);
  const alerts = buildAlerts(tasks, schedules);
  const reviewPending = reports.filter((r) => r.reviewStatus === "검토 대기").length;

  const TEXT: Record<Slot, string[]> = {
    morning: brief.map((b) => b.text),
    afternoon: [
      `오후 기준 진행 중인 업무는 ${tasks.filter((t) => t.status === "진행 중").length}건입니다.`,
      `아직 확인되지 않은 업무가 ${kpi.unacked}건 남아 있습니다.`,
      `완료보고 ${reviewPending}건이 검토를 기다리고 있습니다.`,
    ],
    evening: [
      `오늘 마감 예정 업무 중 ${kpi.overdue}건이 기한을 넘겼습니다.`,
      `결과보고가 아직 올라오지 않은 업무가 ${kpi.reportPending}건 있습니다.`,
      "퇴근 전에 미완료 업무의 담당자에게 한 번 더 확인해 주세요.",
    ],
    weekly: [
      `이번 주 등록된 업무는 ${tasks.length}건이고, 그중 ${tasks.filter((t) => t.status === "승인 완료").length}건이 승인 완료됐습니다.`,
      `일정 충돌은 ${kpi.conflicts}건 발생했고, 담당자 변경으로 조정할 수 있습니다.`,
      "확인률과 기한 내 완료율은 운영성과 화면에서 확인할 수 있습니다.",
    ],
  };

  return (
    <div className="page-in space-y-5">
      <PageIntro message="오늘 무엇을 먼저 챙겨야 하는지 시간대별로 정리했습니다." />

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[19px] font-semibold text-ink-3">{NOW_LABEL} 기준</p>
        <Segment<Slot>
          value={slot}
          onChange={setSlot}
          options={[
            { value: "morning", label: "오늘 아침" },
            { value: "afternoon", label: "오후 진행상황" },
            { value: "evening", label: "퇴근 전" },
            { value: "weekly", label: "주간 요약" },
          ]}
        />
      </div>

      <section className="hero-navy overflow-hidden rounded-3xl px-6 py-7 text-white lg:px-8">
        <p className="flex items-center gap-2 text-[18.5px] font-bold text-[#8fbcff]">
          <Sparkles size={21} /> AI 관리자 브리핑
        </p>
        <div className="mt-3 space-y-2">
          {slot === "morning"
            ? brief.map((b, i) => (
                <Link
                  key={i}
                  href={b.href ?? "#"}
                  className="block rounded-xl px-3 py-2.5 text-[22px] leading-relaxed font-medium transition-colors hover:bg-white/10"
                >
                  {b.text}
                  <ChevronRight size={21} className="ml-1 inline text-white/50" />
                </Link>
              ))
            : TEXT[slot].map((t, i) => (
                <p key={i} className="px-3 py-2.5 text-[22px] leading-relaxed">
                  {t}
                </p>
              ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[25.5px] font-bold">
          알림 <span className="text-ink-3">{alerts.length}건</span>
        </h3>
        {alerts.length === 0 ? (
          <EmptyState title="지금은 알림이 없습니다" />
        ) : (
          <div className="stagger space-y-3">
            {alerts.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onOpenTask={(id) => setOpen(tasks.find((t) => t.id === id) ?? null)}
              />
            ))}
          </div>
        )}
      </section>

      <TaskDetailModal task={open} onClose={() => setOpen(null)} />
    </div>
  );
}
