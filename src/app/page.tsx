"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { NOW_DATE } from "@/lib/company";
import { MEMBERS, fullName, memberById } from "@/lib/team";
import {
  buildAlerts,
  isOverdue,
  isUnacked,
  managerBrief,
  memberSummaries,
  needsResultReport,
  opsKpi,
  schedulesOn,
  whenLabel,
} from "@/lib/ops-calc";
import { companyKpi } from "@/lib/calc";
import { formatMoney } from "@/lib/format";
import { Badge, CountUp } from "@/components/ui";
import { AlertCard, Avatar, ReportModal, TaskCard, TaskDetailModal } from "@/components/ops";
import { PhoneMemoTaskModal, TaskCreateModal } from "@/components/TaskCreate";
import type { Task } from "@/lib/ops-types";

/* ───────────── 관리자 업무통제실 ───────────── */

function ManagerHome() {
  const {
    tasks,
    schedules,
    reports,
    projects,
    opportunities,
    changeOrders,
    currentUserId,
    permission,
  } = useApp();
  const searchParams = useSearchParams();
  const [taskOpen, setTaskOpen] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const memoParam = searchParams.get("memo") === "1";
  const [prevMemo, setPrevMemo] = useState(memoParam);
  if (memoParam !== prevMemo) {
    setPrevMemo(memoParam);
    if (memoParam) setMemoOpen(true);
  }

  const kpi = opsKpi(tasks, schedules);
  const alerts = buildAlerts(tasks, schedules);
  const brief = managerBrief(tasks, schedules);
  const money = companyKpi(projects, opportunities, changeOrders);
  const summaries = memberSummaries(
    tasks,
    schedules,
    reports,
    MEMBERS.filter((m) => m.role !== "ceo" && m.id !== currentUserId).map((m) => m.id)
  );

  const KPIS = [
    { label: "오늘 예정 업무", value: kpi.todayTasks, unit: "건", href: "/tasks", tone: "" },
    { label: "아직 확인하지 않은 업무", value: kpi.unacked, unit: "건", href: "/tasks?filter=unacked", tone: "text-danger" },
    { label: "기한이 지난 업무", value: kpi.overdue, unit: "건", href: "/tasks?filter=overdue", tone: "text-danger" },
    { label: "결과보고 대기", value: kpi.reportPending, unit: "건", href: "/reports", tone: "text-warning" },
    { label: "오늘 일정 충돌", value: kpi.conflicts, unit: "건", href: "/schedule", tone: "text-danger" },
  ];

  return (
    <div className="page-in space-y-6">
      {/* 제목 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[30px] leading-tight font-extrabold lg:text-[34px]">
            {memberById(currentUserId)?.name} {memberById(currentUserId)?.roleLabel}님, 아직
            확인되지 않은 업무부터 살펴보세요.
          </h2>
          <p className="mt-2 text-[20px] text-ink-2">
            누가 업무를 확인했고, 무엇이 지연되고 있으며, 어떤 보고가 빠졌는지 정리했습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
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
        </div>
      </div>

      {/* 핵심 KPI */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {KPIS.map((k) => (
          <Link key={k.label} href={k.href} className="card card-hover block min-w-0 p-5">
            <p className="text-[18.5px] font-semibold text-ink-3">{k.label}</p>
            <p className={`mt-1.5 text-[38px] leading-none font-extrabold tracking-tight ${k.tone}`}>
              <CountUp value={k.value} format={(v) => `${Math.round(v)}`} />
              <span className="ml-1 text-[22px]">{k.unit}</span>
            </p>
          </Link>
        ))}
      </section>

      {/* AI 브리핑 */}
      <section className="hero-navy overflow-hidden rounded-3xl px-6 py-6 text-white lg:px-8">
        <p className="flex items-center gap-2 text-[18.5px] font-bold text-[#8fbcff]">
          <Sparkles size={21} /> AI 관리자 브리핑 · 오늘 아침
        </p>
        <div className="mt-3 space-y-2">
          {brief.map((b, i) =>
            b.href ? (
              <Link
                key={i}
                href={b.href}
                className="block rounded-xl px-3 py-2 text-[21px] leading-relaxed font-medium transition-colors hover:bg-white/10"
              >
                {b.text}
                <ChevronRight size={20} className="ml-1 inline text-white/50" />
              </Link>
            ) : (
              <p key={i} className="px-3 py-2 text-[21px] leading-relaxed">
                {b.text}
              </p>
            )
          )}
        </div>
        <Link
          href="/brief"
          className="mt-4 inline-flex min-h-[3.25rem] items-center gap-2 rounded-xl bg-white/12 px-5 text-[19px] font-bold text-white transition-colors hover:bg-white/20"
        >
          브리핑 전체 보기 <ArrowRight size={20} />
        </Link>
      </section>

      {/* 우선 확인 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[25.5px] font-bold">
            먼저 확인할 일<span className="ml-2 text-[19px] text-ink-3">위험한 순서</span>
          </h3>
          <span className="text-[19px] font-semibold text-ink-3">{alerts.length}건</span>
        </div>
        {alerts.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-12 text-center">
            <CheckCircle2 size={38} className="text-success" />
            <p className="text-[22px] font-bold">확인이 필요한 항목이 없습니다</p>
          </div>
        ) : (
          <div className="stagger space-y-3">
            {alerts.slice(0, 6).map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onOpenTask={(id) => setTaskOpen(tasks.find((t) => t.id === id) ?? null)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 직원별 관리감독 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[25.5px] font-bold">
            <Users size={26} className="text-primary" /> 직원별 진행상황
          </h3>
          <Link href="/reports" className="text-[19px] font-bold text-primary hover:underline">
            업무보고 보기
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((s) => {
            const m = memberById(s.memberId)!;
            const line =
              s.assigned === 0
                ? "오늘 배정된 업무가 없습니다."
                : `오늘 ${s.assigned}건 중 ${s.acked}건 확인${
                    s.assigned - s.acked > 0 ? `, ${s.assigned - s.acked}건 미확인` : ""
                  }`;
            const need: string[] = [];
            if (s.assigned - s.acked > 0) need.push("확인 필요");
            if (s.overdue > 0) need.push("지연 지원 필요");
            if (s.conflict) need.push("일정 겹침");
            if (s.reportPending > 0) need.push("결과보고 필요");
            if (s.reviewPending > 0) need.push("검토 대기");
            return (
              <div key={s.memberId} className="card min-w-0 p-5">
                <div className="flex items-center gap-3">
                  <Avatar id={s.memberId} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[21.8px] font-bold">
                      {m.name} {m.roleLabel}
                    </p>
                    <p className="truncate text-[18px] text-ink-3">
                      오늘 일정 {s.todaySchedules}건 · 마지막 활동{" "}
                      {s.lastActivity ? whenLabel(s.lastActivity) : "없음"}
                    </p>
                  </div>
                  <a
                    href={`tel:${m.phone}`}
                    className="shrink-0 rounded-xl bg-[#f2f4f6] p-3 text-ink-2 transition-colors hover:bg-[#e8ebee]"
                    aria-label={`${m.name}에게 전화`}
                  >
                    <Phone size={22} />
                  </a>
                </div>
                <p className="mt-3 text-[19.5px] font-semibold">{line}</p>
                {need.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {need.map((n) => (
                      <Badge
                        key={n}
                        tone={n === "확인 필요" || n === "일정 겹침" ? "danger" : "warning"}
                      >
                        {n}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 오늘 진행 중 업무 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[25.5px] font-bold">오늘 업무</h3>
          <Link href="/tasks" className="text-[19px] font-bold text-primary hover:underline">
            전체 보기
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tasks
            .filter((t) => t.status !== "승인 완료" && t.status !== "취소")
            .slice(0, 6)
            .map((t) => (
              <TaskCard key={t.id} task={t} onOpen={setTaskOpen} />
            ))}
        </div>
      </section>

      {/* 경영현황 — 금액을 볼 수 있는 역할만 */}
      {permission.seeMoney && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
            <Banknote size={26} className="text-ink-3" /> 경영현황
          </h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "올해 누적 수주", value: formatMoney(money.yearOrders), href: "/profit" },
              { label: "회수 예정금액", value: formatMoney(money.collectible), href: "/closeout" },
              { label: "미수금", value: formatMoney(money.receivables), href: "/closeout", tone: "text-danger" },
              { label: "위험·누락 가능금액", value: formatMoney(money.atRisk), href: "/closeout", tone: "text-danger" },
            ].map((k) => (
              <Link key={k.label} href={k.href} className="card card-hover block min-w-0 p-5">
                <p className="text-[18.5px] font-semibold text-ink-3">{k.label}</p>
                <p className={`mt-1 text-[24px] font-extrabold tracking-tight ${k.tone ?? ""}`}>
                  {k.value}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <TaskDetailModal task={taskOpen} onClose={() => setTaskOpen(null)} />
      <TaskCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <PhoneMemoTaskModal open={memoOpen} onClose={() => setMemoOpen(false)} />
    </div>
  );
}

/* ───────────── 직원 첫 화면 (모바일 우선) ───────────── */

function StaffHome() {
  const { tasks, schedules, currentUserId, acknowledgeSchedule, showToast } = useApp();
  const [taskOpen, setTaskOpen] = useState<Task | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const me = memberById(currentUserId)!;
  const mine = tasks.filter((t) => t.assigneeId === currentUserId && t.status !== "취소");
  const newTasks = mine.filter(isUnacked);
  const inProgress = mine.filter((t) => t.status === "진행 중" || t.status === "확인함");
  const reportNeeded = mine.filter(needsResultReport);
  const overdue = mine.filter(isOverdue);
  const mySchedules = schedulesOn(schedules, NOW_DATE).filter(
    (s) => s.assigneeId === currentUserId
  );

  return (
    <div className="page-in space-y-6">
      <div>
        <h2 className="text-[30px] leading-tight font-extrabold lg:text-[34px]">
          {me.name} {me.roleLabel}님, 오늘 일정과 업무입니다.
        </h2>
        <p className="mt-2 text-[20px] text-ink-2">
          새로 받은 업무를 확인하고, 작업을 시작하면 관리자에게 바로 전달됩니다.
        </p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "오늘 내 일정", value: mySchedules.length, tone: "" },
          { label: "새로 받은 업무", value: newTasks.length, tone: newTasks.length ? "text-danger" : "" },
          { label: "진행 중", value: inProgress.length, tone: "" },
          { label: "제출할 보고", value: reportNeeded.length, tone: reportNeeded.length ? "text-warning" : "" },
        ].map((k) => (
          <div key={k.label} className="card min-w-0 p-5">
            <p className="text-[18.5px] font-semibold text-ink-3">{k.label}</p>
            <p className={`mt-1 text-[38px] leading-none font-extrabold ${k.tone}`}>
              {k.value}
              <span className="ml-1 text-[21px]">건</span>
            </p>
          </div>
        ))}
      </div>

      {/* 긴급 변경사항 */}
      {overdue.length > 0 && (
        <div className="card pulse-danger border border-danger/20 p-5">
          <p className="flex items-center gap-2 text-[21px] font-bold text-danger">
            <AlertTriangle size={24} /> 기한이 지난 업무가 {overdue.length}건 있어요
          </p>
          <p className="mt-1.5 text-[19px] text-ink-2">
            {overdue[0].title} · 기한 {whenLabel(overdue[0].dueAt)}
          </p>
          <button
            onClick={() => setTaskOpen(overdue[0])}
            className="mt-3 min-h-[3.5rem] w-full rounded-2xl bg-danger px-5 text-[20px] font-bold text-white transition-opacity hover:opacity-90 sm:w-auto"
          >
            지금 처리하기
          </button>
        </div>
      )}

      {/* 새로 받은 업무 */}
      {newTasks.length > 0 && (
        <section>
          <h3 className="mb-3 text-[25.5px] font-bold">
            새로 받은 업무 <span className="text-danger">{newTasks.length}건</span>
          </h3>
          <div className="stagger space-y-3">
            {newTasks.map((t) => (
              <div key={t.id} className="card border border-primary/25 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">확인 필요</Badge>
                  {t.priority === "긴급" && <Badge tone="warning">긴급</Badge>}
                </div>
                <p className="mt-2.5 text-[23px] leading-snug font-bold">{t.title}</p>
                <p className="mt-1.5 text-[19px] leading-relaxed text-ink-2">{t.content}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[18px] text-ink-3">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={19} /> {t.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={19} /> 기한 {whenLabel(t.dueAt)}
                  </span>
                  <span>{fullName(t.assignerId)} 지시</span>
                </div>
                <button
                  onClick={() => setTaskOpen(t)}
                  className="mt-4 min-h-[3.75rem] w-full rounded-2xl bg-primary px-5 text-[21px] font-bold text-white transition-colors hover:bg-primary-dark active:scale-[0.99]"
                >
                  업무 확인하기
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 오늘 내 일정 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
          <CalendarDays size={26} className="text-primary" /> 오늘 내 일정
        </h3>
        {mySchedules.length === 0 ? (
          <div className="card p-10 text-center text-[20px] text-ink-3">
            오늘 배정된 현장 일정이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {mySchedules.map((s) => (
              <div key={s.id} className="card min-w-0 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={s.status === "진행 중" ? "warning" : "info"}>{s.status}</Badge>
                  {!s.acknowledgedAt && <Badge tone="danger">일정 미확인</Badge>}
                </div>
                <p className="mt-2.5 text-[23px] font-bold">{s.title}</p>
                <p className="mt-1.5 text-[19.5px] text-ink-2">
                  {s.start} ~ {s.end} · {s.region}
                </p>
                {!s.acknowledgedAt && (
                  <button
                    onClick={() => {
                      acknowledgeSchedule(s.id);
                      showToast("일정을 확인했습니다");
                    }}
                    className="mt-3.5 min-h-[3.5rem] w-full rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
                  >
                    일정 확인
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 진행 중 업무 */}
      {inProgress.length > 0 && (
        <section>
          <h3 className="mb-3 text-[25.5px] font-bold">진행 중인 업무</h3>
          <div className="space-y-3">
            {inProgress.map((t) => (
              <TaskCard key={t.id} task={t} onOpen={setTaskOpen} compact />
            ))}
          </div>
        </section>
      )}

      {/* 빠른 실행 */}
      <section className="card p-5">
        <p className="mb-3 text-[21px] font-bold">빠른 실행</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "진행상황 보고", icon: Sparkles, action: () => setReportOpen(true) },
            { label: "사진 추가", icon: Camera, action: () => setReportOpen(true) },
            { label: "현장 이슈 등록", icon: AlertTriangle, action: () => setReportOpen(true) },
            { label: "일정 조정 요청", icon: CalendarDays, action: () => setReportOpen(true) },
          ].map((b) => (
            <button
              key={b.label}
              onClick={b.action}
              className="inline-flex min-h-[4rem] items-center justify-center gap-2.5 rounded-2xl bg-[#f2f4f6] px-4 text-[19.5px] font-bold text-ink-2 transition-colors hover:bg-primary-light hover:text-primary-dark"
            >
              <b.icon size={23} /> {b.label}
            </button>
          ))}
        </div>
        <Link
          href="/logs"
          className="mt-2.5 inline-flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[20px] font-bold text-white transition-opacity hover:opacity-90"
        >
          <ClipboardList size={22} /> 현장일보 작성
        </Link>
      </section>

      <TaskDetailModal task={taskOpen} onClose={() => setTaskOpen(null)} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

function HomeInner() {
  const { permission } = useApp();
  return permission.managerHome ? <ManagerHome /> : <StaffHome />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={<div className="card p-12 text-center text-[20px] text-ink-3">불러오는 중입니다...</div>}
    >
      <HomeInner />
    </Suspense>
  );
}
