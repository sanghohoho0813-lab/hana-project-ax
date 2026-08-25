"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  UserCog,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { NOW_DATE } from "@/lib/company";
import { MEMBERS, fullName, memberById, withRo } from "@/lib/team";
import {
  findConflicts,
  notStarted,
  schedulesOn,
  unackedSchedules,
} from "@/lib/ops-calc";
import { Badge, EmptyState, PageIntro, Segment } from "@/components/ui";
import { Avatar } from "@/components/ops";
import type { ScheduleItem } from "@/lib/ops-types";

type ViewKey = "today" | "week" | "member" | "project" | "region";

const DAYS = [
  "2026-07-28",
  "2026-07-29",
  "2026-07-30",
  "2026-07-31",
  "2026-08-01",
];

function dayTitle(d: string) {
  const [, m, dd] = d.split("-");
  const w = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${d}T00:00`).getDay()
  ];
  return `${Number(m)}월 ${Number(dd)}일 (${w})`;
}

/* ── 오늘 타임라인 — 직원별 행 × 시간축, 충돌이 눈에 보인다 ── */

const TL_START = 7 * 60; // 07:00
const TL_END = 19 * 60; // 19:00

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function pct(min: number): number {
  return ((min - TL_START) / (TL_END - TL_START)) * 100;
}

function TimelineToday({
  items,
  conflictIds,
  onPick,
}: {
  items: ScheduleItem[];
  conflictIds: Set<string>;
  onPick: (s: ScheduleItem) => void;
}) {
  const memberIds = MEMBERS.filter((m) =>
    items.some((s) => s.assigneeId === m.id),
  ).map((m) => m.id);
  const hours = [7, 9, 11, 13, 15, 17, 19];
  const nowPct = pct(10 * 60 + 40); // 데모 기준 10:40

  if (memberIds.length === 0) return null;

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="text-[21px] font-bold">오늘 시간표</p>
        <p className="text-[17.5px] text-ink-3">
          막대를 누르면 아래 일정 카드로 이동합니다
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[860px] px-5 pt-3 pb-5">
          {/* 시간 눈금 */}
          <div className="relative ml-[10.5rem] h-[1.9rem]">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute -translate-x-1/2 text-[16px] font-semibold text-ink-3 tabular-nums"
                style={{ left: `${pct(h * 60)}%` }}
              >
                {String(h).padStart(2, "0")}시
              </span>
            ))}
          </div>

          <div className="space-y-2.5">
            {memberIds.map((mid) => {
              const mine = items.filter((s) => s.assigneeId === mid);
              return (
                <div key={mid} className="flex items-center gap-3">
                  <div className="flex w-[9.75rem] shrink-0 items-center gap-2">
                    <Avatar id={mid} size={38} />
                    <span className="truncate text-[18px] font-bold">
                      {memberById(mid)?.name}
                      <span className="block text-[15px] font-semibold text-ink-3">
                        {memberById(mid)?.roleLabel}
                      </span>
                    </span>
                  </div>
                  <div className="relative h-[3.4rem] flex-1 rounded-xl bg-[#f4f6f8]">
                    {/* 시간 보조선 */}
                    {hours.map((h) => (
                      <span
                        key={h}
                        className="absolute inset-y-0 w-px bg-[#e5e8eb]"
                        style={{ left: `${pct(h * 60)}%` }}
                      />
                    ))}
                    {/* 현재 시각 */}
                    <span
                      className="absolute inset-y-0 z-10 w-[2px] bg-danger/70"
                      style={{ left: `${nowPct}%` }}
                    />
                    {mine.map((sc) => {
                      const left = pct(toMinutes(sc.start));
                      const width = Math.max(4, pct(toMinutes(sc.end)) - left);
                      const conflict = conflictIds.has(sc.id);
                      return (
                        <button
                          key={sc.id}
                          onClick={() => onPick(sc)}
                          title={`${sc.title} · ${sc.start}~${sc.end}`}
                          className={`absolute inset-y-1 z-20 overflow-hidden rounded-lg border px-2 text-left transition-transform hover:-translate-y-[2px] ${
                            conflict
                              ? "border-danger bg-danger-bg"
                              : sc.acknowledgedAt
                                ? "border-primary/30 bg-primary-light"
                                : "border-warning/50 bg-warning-bg"
                          }`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span
                            className={`block truncate text-[15.5px] leading-tight font-bold ${
                              conflict
                                ? "text-danger"
                                : sc.acknowledgedAt
                                  ? "text-primary-dark"
                                  : "text-warning"
                            }`}
                          >
                            {sc.title}
                          </span>
                          <span className="block truncate text-[13.5px] text-ink-3 tabular-nums">
                            {sc.start}~{sc.end}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 pl-[10.5rem] text-[16px] font-semibold text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[0.9rem] w-[1.6rem] rounded border border-primary/30 bg-primary-light" />{" "}
              확인됨
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[0.9rem] w-[1.6rem] rounded border border-warning/50 bg-warning-bg" />{" "}
              미확인
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[0.9rem] w-[1.6rem] rounded border border-danger bg-danger-bg" />{" "}
              충돌
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[0.9rem] w-[2px] bg-danger/70" /> 현재 시각
              10:40
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleCard({
  s,
  onReassign,
}: {
  s: ScheduleItem;
  onReassign: (s: ScheduleItem) => void;
}) {
  const { projects, acknowledgeSchedule, showToast, permission } = useApp();
  const project = projects.find((p) => p.id === s.projectId);
  const member = memberById(s.assigneeId);

  return (
    <div className="card min-w-0 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          tone={
            s.status === "진행 중"
              ? "warning"
              : s.status === "완료"
                ? "success"
                : "info"
          }
        >
          {s.status}
        </Badge>
        {!s.acknowledgedAt && <Badge tone="danger">미확인</Badge>}
        {s.travelMinutes > 0 && (
          <span className="inline-flex items-center gap-1 text-[17.5px] text-ink-3">
            <Navigation size={18} /> 이동 {s.travelMinutes}분
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[23px] leading-snug font-bold">{s.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[18.5px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={19} /> {s.start} ~ {s.end}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={19} /> {s.region}
        </span>
        {project && (
          <Link
            href={`/projects/${project.id}`}
            className="font-semibold text-primary-dark hover:underline"
          >
            {project.shortName}
          </Link>
        )}
      </div>

      <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-[#f7f8fa] px-4 py-3">
        <Avatar id={s.assigneeId} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-[19px] font-bold">
            {member?.name} {member?.roleLabel}
          </span>
          <span
            className={`block text-[17.5px] ${s.acknowledgedAt ? "text-success" : "text-danger"}`}
          >
            {s.acknowledgedAt
              ? "일정을 확인했어요"
              : "아직 일정을 확인하지 않았어요"}
          </span>
        </span>
      </div>

      {permission.assignTask && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!s.acknowledgedAt && (
            <button
              onClick={() =>
                showToast(
                  `${member?.name} ${member?.roleLabel}에게 확인을 요청했습니다`,
                )
              }
              className="inline-flex min-h-[3.25rem] min-w-[9rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3 text-[18px] font-bold whitespace-nowrap text-ink-2 transition-colors hover:bg-[#e8ebee]"
            >
              <Bell size={20} /> 확인 요청
            </button>
          )}
          <button
            onClick={() => onReassign(s)}
            className="inline-flex min-h-[3.25rem] min-w-[9rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3 text-[18px] font-bold whitespace-nowrap text-ink-2 transition-colors hover:bg-[#e8ebee]"
          >
            <UserCog size={20} /> 담당자 변경
          </button>
          <button
            onClick={() => {
              acknowledgeSchedule(s.id);
              showToast("확인 처리했습니다");
            }}
            className="inline-flex min-h-[3.25rem] min-w-[9rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3 text-[18px] font-bold whitespace-nowrap text-ink-2 transition-colors hover:bg-success-bg hover:text-success"
          >
            <CheckCircle2 size={20} /> 확인 처리
          </button>
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const {
    schedules,
    projects,
    updateSchedule,
    showToast,
    permission,
    currentUserId,
  } = useApp();
  const [view, setView] = useState<ViewKey>("today");
  const [reassign, setReassign] = useState<ScheduleItem | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      permission.seeAllMembers
        ? schedules
        : schedules.filter((s) => s.assigneeId === currentUserId),
    [schedules, permission.seeAllMembers, currentUserId],
  );

  const conflicts = findConflicts(visible);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const unacked = unackedSchedules(visible);
  const late = notStarted(visible);
  const today = schedulesOn(visible, NOW_DATE);

  return (
    <div className="page-in space-y-5">
      <PageIntro message="일정을 등록하는 데서 끝내지 않고, 누가 확인했는지까지 봅니다." />

      {/* 위험 탐지 */}
      <div className="grid gap-3 lg:grid-cols-3">
        {[
          { label: "일정 충돌", value: conflicts.length, tone: "text-danger" },
          {
            label: "오늘 미확인 일정",
            value: unacked.length,
            tone: "text-danger",
          },
          {
            label: "시작 시간이 지난 일정",
            value: late.length,
            tone: "text-warning",
          },
        ].map((k) => (
          <div key={k.label} className="card min-w-0 p-5">
            <p className="text-[18.5px] font-semibold text-ink-3">{k.label}</p>
            <p
              className={`mt-1 text-[34px] leading-none font-extrabold ${k.value ? k.tone : ""}`}
            >
              {k.value}
              <span className="ml-1 text-[21px]">건</span>
            </p>
          </div>
        ))}
      </div>

      {conflicts.length > 0 && (
        <div className="card pulse-danger border border-danger/20 p-5">
          <p className="flex items-center gap-2 text-[22px] font-bold text-danger">
            <AlertTriangle size={25} /> 일정이 겹치는 담당자가 있어요
          </p>
          {conflicts.map((c) => (
            <div key={`${c.a.id}-${c.b.id}`} className="mt-3">
              <p className="text-[20px] leading-relaxed text-ink-2">
                <b className="text-ink">{fullName(c.memberId)}</b>가 {c.a.start}{" "}
                {c.a.region} 일정과 {c.b.start} {c.b.region} 일정에 함께
                배정되어 있습니다.
                {c.reason === "이동시간 부족" &&
                  ` 이동에만 약 ${c.b.travelMinutes}분이 걸려 제시간에 도착하기 어렵습니다.`}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <button
                  onClick={() => {
                    updateSchedule(c.b.id, {
                      start: "14:00",
                      end: "15:30",
                      acknowledgedAt: undefined,
                    });
                    showToast(
                      "일정을 오후 2시로 변경했습니다. 담당자 확인을 기다립니다",
                    );
                  }}
                  className="min-h-[3.5rem] rounded-2xl bg-primary px-4 text-[19px] font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  일정 변경 (오후 2시)
                </button>
                <button
                  onClick={() => setReassign(c.b)}
                  className="min-h-[3.5rem] rounded-2xl bg-[#f2f4f6] px-4 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
                >
                  담당자 변경
                </button>
                <button
                  onClick={() =>
                    showToast(`${fullName(c.memberId)}에게 확인을 요청했습니다`)
                  }
                  className="min-h-[3.5rem] rounded-2xl bg-[#f2f4f6] px-4 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
                >
                  직원에게 확인 요청
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 보기 방식 */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-[25.5px] font-bold">
          <CalendarDays size={26} className="text-primary" /> 일정 보기
        </h3>
        <Segment<ViewKey>
          value={view}
          onChange={setView}
          options={[
            { value: "today", label: "오늘" },
            { value: "week", label: "주간" },
            { value: "member", label: "직원별" },
            { value: "project", label: "프로젝트별" },
            { value: "region", label: "지역별" },
          ]}
        />
      </div>

      {view === "today" && (
        <>
          <TimelineToday
            items={today}
            conflictIds={conflictIds}
            onPick={(sc) => {
              document
                .getElementById(`sch-${sc.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
              setHighlight(sc.id);
              setTimeout(() => setHighlight(null), 1600);
            }}
          />
          <p className="text-[20px] font-semibold text-ink-2">
            {dayTitle(NOW_DATE)} · {today.length}건
          </p>
          {today.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={30} />}
              title="오늘 등록된 일정이 없어요"
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {today.map((s) => (
                <div
                  key={s.id}
                  id={`sch-${s.id}`}
                  className={`rounded-3xl transition-shadow ${
                    highlight === s.id ? "ring-4 ring-primary/40" : ""
                  }`}
                >
                  <ScheduleCard s={s} onReassign={setReassign} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === "week" && (
        <div className="space-y-5">
          {DAYS.map((d) => {
            const items = schedulesOn(visible, d);
            return (
              <div key={d}>
                <p className="mb-2 text-[21px] font-bold">
                  {dayTitle(d)}
                  <span className="ml-2 text-[18px] font-semibold text-ink-3">
                    {items.length}건
                  </span>
                </p>
                {items.length === 0 ? (
                  <p className="card px-5 py-6 text-[19px] text-ink-3">
                    일정 없음
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((s) => (
                      <ScheduleCard key={s.id} s={s} onReassign={setReassign} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "member" && (
        <div className="space-y-5">
          {MEMBERS.filter((m) => m.role !== "ceo").map((m) => {
            const items = today.filter((s) => s.assigneeId === m.id);
            const hasConflict = conflicts.some((c) => c.memberId === m.id);
            return (
              <div key={m.id}>
                <p className="mb-2 flex flex-wrap items-center gap-2 text-[21px] font-bold">
                  <Avatar id={m.id} size={38} />
                  {m.name} {m.roleLabel}
                  <span className="text-[18px] font-semibold text-ink-3">
                    오늘 {items.length}건
                  </span>
                  {hasConflict && <Badge tone="danger">일정 겹침</Badge>}
                </p>
                {items.length === 0 ? (
                  <p className="card px-5 py-6 text-[19px] text-ink-3">
                    오늘 일정 없음
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((s) => (
                      <ScheduleCard key={s.id} s={s} onReassign={setReassign} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "project" && (
        <div className="space-y-5">
          {projects
            .filter((p) => p.statusKey !== "done")
            .map((p) => {
              const items = visible.filter((s) => s.projectId === p.id);
              if (items.length === 0) return null;
              return (
                <div key={p.id}>
                  <p className="mb-2 text-[21px] font-bold">
                    {p.name}
                    <span className="ml-2 text-[18px] font-semibold text-ink-3">
                      {items.length}건
                    </span>
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((s) => (
                      <ScheduleCard key={s.id} s={s} onReassign={setReassign} />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {view === "region" && (
        <div className="space-y-5">
          {Array.from(new Set(visible.map((s) => s.region))).map((r) => {
            const items = visible.filter((s) => s.region === r);
            return (
              <div key={r}>
                <p className="mb-2 text-[21px] font-bold">
                  {r}
                  <span className="ml-2 text-[18px] font-semibold text-ink-3">
                    {items.length}건
                  </span>
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((s) => (
                    <ScheduleCard key={s.id} s={s} onReassign={setReassign} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 담당자 변경 */}
      {reassign && (
        <div
          className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center"
          onClick={() => setReassign(null)}
        >
          <div
            className="modal-in w-full max-w-[36rem] rounded-3xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[24px] font-bold">담당자 변경</p>
            <p className="mt-1.5 text-[19px] text-ink-2">{reassign.title}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {MEMBERS.filter(
                (m) => m.id !== reassign.assigneeId && m.role !== "ceo",
              ).map((m) => {
                // 이 사람에게 옮겼을 때 새로운 겹침이 생기는지 미리 계산한다
                const preview = schedules.map((x) =>
                  x.id === reassign.id ? { ...x, assigneeId: m.id } : x,
                );
                const wouldConflict = findConflicts(preview).some(
                  (c) =>
                    c.memberId === m.id &&
                    (c.a.id === reassign.id || c.b.id === reassign.id),
                );
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      updateSchedule(reassign.id, {
                        assigneeId: m.id,
                        acknowledgedAt: undefined,
                      });
                      showToast(
                        wouldConflict
                          ? `${withRo(`${m.name} ${m.roleLabel}`)} 변경했지만 일정이 겹칩니다. 시간을 조정하세요`
                          : `${withRo(`${m.name} ${m.roleLabel}`)} 변경했습니다. 확인 여부를 추적합니다`,
                      );
                      setReassign(null);
                    }}
                    className={`flex min-h-[4.4rem] items-center gap-2.5 rounded-2xl px-4 text-left transition-colors ${
                      wouldConflict
                        ? "bg-danger-bg/60 hover:bg-danger-bg"
                        : "bg-[#f2f4f6] hover:bg-primary-light"
                    }`}
                  >
                    <Avatar id={m.id} size={38} />
                    <span className="min-w-0">
                      <span className="block truncate text-[19.5px] font-bold">
                        {m.name} {m.roleLabel}
                      </span>
                      <span
                        className={`block text-[16px] font-semibold ${
                          wouldConflict ? "text-danger" : "text-success"
                        }`}
                      >
                        {wouldConflict
                          ? "이 시간대 일정 겹침 주의"
                          : "이 시간대 가능"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setReassign(null)}
              className="mt-4 min-h-[3.5rem] w-full rounded-2xl bg-[#f2f4f6] text-[19px] font-bold text-ink-2"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
