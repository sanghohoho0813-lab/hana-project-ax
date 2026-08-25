"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, MessageSquarePlus, MessagesSquare } from "lucide-react";
import { useApp } from "@/lib/store";
import { fullName } from "@/lib/team";
import { whenLabel } from "@/lib/ops-calc";
import { Badge, EmptyState, PageIntro, inputClass } from "@/components/ui";
import { Avatar } from "@/components/ops";
import type { TimelineKind } from "@/lib/ops-types";

const KIND_TONE: Record<
  TimelineKind,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  업무지시: "info",
  "직원 확인": "success",
  "일정 변경": "warning",
  진행보고: "info",
  사진: "neutral",
  "관리자 댓글": "neutral",
  "보완 요청": "danger",
  완료보고: "info",
  승인: "success",
  추가공사: "warning",
  문서: "neutral",
};

export function Timeline({ projectId }: { projectId?: string }) {
  const { timeline, currentUserId, addTimeline, showToast } = useApp();
  const [comment, setComment] = useState("");

  const items = useMemo(
    () =>
      timeline
        .filter((e) => !projectId || e.projectId === projectId)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [timeline, projectId],
  );

  if (items.length === 0 && !projectId)
    return (
      <EmptyState
        icon={<MessagesSquare size={30} />}
        title="아직 기록이 없어요"
      />
    );

  return (
    <div>
      {projectId && (
        <div className="card mb-4 flex flex-col gap-2.5 p-4 sm:flex-row">
          <input
            className={inputClass}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="현장에 전달할 내용을 남겨 주세요"
          />
          <button
            onClick={() => {
              if (!comment.trim()) return;
              addTimeline(
                projectId,
                "관리자 댓글",
                currentUserId,
                comment.trim(),
              );
              showToast("현장에 전달했습니다");
              setComment("");
            }}
            disabled={!comment.trim()}
            className="inline-flex min-h-[3.5rem] shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[19px] font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            <MessageSquarePlus size={22} /> 남기기
          </button>
        </div>
      )}

      <ol className="relative space-y-3 pl-[1.4rem]">
        {/* 세로 레일 */}
        <span
          className="absolute top-3 bottom-3 left-[0.45rem] w-[3px] rounded-full bg-[#e5e8eb]"
          aria-hidden
        />
        {items.map((e) => (
          <li key={e.id} className="relative">
            <span
              className={`absolute top-7 -left-[1.32rem] h-[1rem] w-[1rem] rounded-full border-[3px] border-white ${
                e.kind === "승인" || e.kind === "직원 확인"
                  ? "bg-success"
                  : e.kind === "보완 요청"
                    ? "bg-danger"
                    : e.kind === "업무지시"
                      ? "bg-primary"
                      : "bg-ink-3"
              }`}
              aria-hidden
            />
            <div className="card min-w-0 p-5">
              <div className="flex items-start gap-3">
                <Avatar id={e.actorId} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[20px] font-bold">
                      {fullName(e.actorId)}
                    </span>
                    <Badge tone={KIND_TONE[e.kind]}>{e.kind}</Badge>
                    <span className="text-[17.5px] text-ink-3">
                      {whenLabel(e.at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[19.5px] leading-relaxed text-ink-2">
                    {e.text}
                  </p>
                  {e.photoCount ? (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[18px] text-ink-3">
                      <Camera size={19} /> 사진 {e.photoCount}장
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function CommsPage() {
  const { projects, timeline } = useApp();
  const [projectId, setProjectId] = useState<string>("all");

  const active = projects.filter((p) => p.statusKey !== "done");

  return (
    <div className="page-in space-y-5">
      <PageIntro message="누가 언제 지시하고 확인하고 보고했는지 프로젝트별로 남습니다." />

      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex min-w-max gap-2">
          <button
            onClick={() => setProjectId("all")}
            className={`min-h-[3.25rem] shrink-0 rounded-xl px-4 text-[19px] font-bold transition-colors ${
              projectId === "all"
                ? "bg-primary text-white"
                : "bg-[#f2f4f6] text-ink-2"
            }`}
          >
            전체 {timeline.length}
          </button>
          {active.map((p) => {
            const n = timeline.filter((e) => e.projectId === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setProjectId(p.id)}
                className={`min-h-[3.25rem] shrink-0 rounded-xl px-4 text-[19px] font-bold transition-colors ${
                  projectId === p.id
                    ? "bg-primary text-white"
                    : "bg-[#f2f4f6] text-ink-2"
                }`}
              >
                {p.shortName} {n}
              </button>
            );
          })}
        </div>
      </div>

      {projectId !== "all" && (
        <Link
          href={`/projects/${projectId}`}
          className="inline-block text-[19px] font-bold text-primary hover:underline"
        >
          프로젝트 상세 열기
        </Link>
      )}

      <Timeline projectId={projectId === "all" ? undefined : projectId} />
    </div>
  );
}
