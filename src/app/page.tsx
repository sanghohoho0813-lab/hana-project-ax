"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Info,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { CONSULTING_KPI, KPI } from "@/lib/data";
import { formatMoney, formatPercent } from "@/lib/format";
import { Badge, CountUp, ProgressBar, statusTone, type Tone } from "@/components/ui";
import { DailyLogModal, NewInquiryModal, PhoneMemoModal } from "@/components/modals";

const SEVERITY_META: Record<
  string,
  { tone: Tone; icon: React.ElementType; label: string }
> = {
  danger: { tone: "danger", icon: AlertTriangle, label: "긴급" },
  warning: { tone: "warning", icon: AlertTriangle, label: "주의" },
  success: { tone: "success", icon: CheckCircle2, label: "기회" },
  info: { tone: "info", icon: Info, label: "안내" },
};

function KpiCard({
  label,
  value,
  sub,
  subTone = "neutral",
  format,
}: {
  label: string;
  value: number;
  sub: string;
  subTone?: Tone;
  format: (v: number) => string;
}) {
  return (
    <div className="card card-hover p-5">
      <p className="text-[13px] font-semibold text-ink-3">{label}</p>
      <p className="mt-1.5 text-[22px] leading-tight font-extrabold tracking-tight lg:text-[24px] xl:text-[21px] 2xl:text-[24px]">
        <CountUp value={value} format={format} />
      </p>
      <Badge tone={subTone} className="mt-2.5">
        {sub}
      </Badge>
    </div>
  );
}

export default function TodayPage() {
  const { business, projects, todos, toggleTodo, addTodo, showToast } = useApp();
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [briefingKey, setBriefingKey] = useState(0);

  const active = projects.filter((p) => p.statusKey !== "done");
  const openTodos = todos.filter((t) => !t.done);

  const briefing = useMemo(
    () =>
      `오늘은 ${openTodos.length}개 항목을 먼저 확인해야 합니다. 군산 현장의 추가공사 승인이 완료되지 않았고, 서천 현장은 자재 지연으로 공정이 2일 늦어질 가능성이 있습니다. 보령 공공시설 공사는 잔금 3,800만 원을 바로 청구할 수 있습니다.`,
    [openTodos.length]
  );

  const kpiCards =
    business === "consulting"
      ? [
          { label: "이번 달 예정 용역매출", value: CONSULTING_KPI.monthServiceRevenue, sub: "3개 프로젝트 정산 예정", subTone: "info" as Tone, format: formatMoney },
          { label: "미정산 용역비", value: CONSULTING_KPI.unsettledFee, sub: "승인 대기 740만 원 포함", subTone: "warning" as Tone, format: formatMoney },
          { label: "진행 중 관리 프로젝트", value: CONSULTING_KPI.activeManaged, sub: "전월 대비 +1건", subTone: "success" as Tone, format: (v: number) => `${Math.round(v)}건` },
          { label: "이번 달 작성 보고서", value: CONSULTING_KPI.monthReports, sub: "주간보고 중심", subTone: "neutral" as Tone, format: (v: number) => `${Math.round(v)}건` },
          { label: "완료 산출물", value: CONSULTING_KPI.deliverablesDone, sub: "체크리스트·보고서 포함", subTone: "neutral" as Tone, format: (v: number) => `${Math.round(v)}건` },
          { label: "위험 프로젝트", value: KPI.riskProjects, sub: "변경관리 대상", subTone: "danger" as Tone, format: (v: number) => `${Math.round(v)}건` },
        ]
      : [
          { label: "올해 누적 수주", value: KPI.yearOrders, sub: "전년 동기 대비 +12%", subTone: "success" as Tone, format: formatMoney },
          { label: "예상 연매출", value: KPI.yearForecast, sub: "좋은 해 페이스 유지 중", subTone: "info" as Tone, format: formatMoney },
          { label: "진행 중 공사", value: KPI.activeProjects, sub: "이번 주 신규 착공 1건", subTone: "neutral" as Tone, format: (v: number) => `${Math.round(v)}건` },
          { label: "이번 달 입금 예정", value: KPI.monthExpectedIn, sub: "잔금 청구 시 +3,800만", subTone: "success" as Tone, format: formatMoney },
          { label: "미수금", value: KPI.receivables, sub: "기일 경과 700만 원", subTone: "warning" as Tone, format: formatMoney },
          { label: "위험 프로젝트", value: KPI.riskProjects, sub: "자재 지연·미승인 추가공사", subTone: "danger" as Tone, format: (v: number) => `${Math.round(v)}건` },
        ];

  return (
    <div className="page-in space-y-6">
      {/* 인사 + 주요 버튼 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] leading-snug font-extrabold lg:text-[26px]">
            구본석 이사님, 오늘 먼저 확인할 일이 있어요
          </h2>
          <p className="mt-1 text-[14.5px] text-ink-2">
            진행 중인 현장과 입금·견적 일정을 한눈에 확인하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMemoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-ink-2 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
          >
            <Phone size={15} className="text-primary" />
            전화메모 정리
          </button>
          <button
            onClick={() => setLogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-ink-2 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
          >
            <ClipboardList size={15} className="text-primary" />
            현장일보 작성
          </button>
          <button
            onClick={() => setInquiryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-lg active:scale-[0.98]"
          >
            <Plus size={16} />새 문의 등록
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        {kpiCards.map((k) => (
          <KpiCard key={`${business}-${k.label}`} {...k} />
        ))}
      </div>

      {/* AI 브리핑 */}
      <div
        key={briefingKey}
        className="card rise-in relative overflow-hidden p-6"
        style={{
          background:
            "linear-gradient(120deg, #ffffff 0%, #f3f8ff 55%, #e8f1fe 100%)",
        }}
      >
        <div className="flex items-start gap-4">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white sm:flex">
            <Sparkles size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-primary-dark">
              AI 오늘의 브리핑
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed font-medium">
              {briefing}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setBriefingKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-2 shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
              >
                <RefreshCw size={13} />
                브리핑 다시 보기
              </button>
              <button
                onClick={() => {
                  addTodo({
                    id: `t-brief-${Date.now()}`,
                    title: "AI 브리핑 확인 — 군산 승인·서천 자재·보령 잔금",
                    desc: "브리핑에서 정리된 3개 항목을 순서대로 처리하세요.",
                    severity: "info",
                    done: false,
                  });
                  showToast("브리핑이 할 일로 정리됐어요");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-all hover:bg-primary-dark active:scale-[0.98]"
              >
                할 일로 정리
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 오늘 확인할 일 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold">오늘 확인할 일</h3>
          <span className="text-[13px] font-semibold text-ink-3">
            {openTodos.length}건 남음
          </span>
        </div>
        {openTodos.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[15px] font-semibold text-ink-2">
              오늘 확인할 일을 모두 처리했어요 👏
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {openTodos.map((t) => {
              const meta = SEVERITY_META[t.severity];
              const inner = (
                <div
                  className={`card card-hover flex items-center gap-3.5 p-4 ${t.severity === "danger" ? "pulse-danger" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      meta.tone === "danger"
                        ? "bg-danger-bg text-danger"
                        : meta.tone === "warning"
                          ? "bg-warning-bg text-warning"
                          : meta.tone === "success"
                            ? "bg-success-bg text-success"
                            : "bg-info-bg text-info"
                    }`}
                  >
                    <meta.icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-bold">{t.title}</p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-2">
                      {t.desc}
                    </p>
                  </div>
                  <Badge tone={meta.tone} className="hidden sm:inline-flex">
                    {meta.label}
                  </Badge>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleTodo(t.id);
                      showToast("완료로 처리했어요");
                    }}
                    className="shrink-0 rounded-xl bg-[#f2f4f6] px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors hover:bg-success-bg hover:text-success"
                  >
                    완료
                  </button>
                  <ChevronRight size={16} className="shrink-0 text-ink-3" />
                </div>
              );
              return t.href ? (
                <Link key={t.id} href={t.href} className="block">
                  {inner}
                </Link>
              ) : (
                <div key={t.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </section>

      {/* 진행 중 프로젝트 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold">
            진행 중 프로젝트{" "}
            <span className="text-ink-3">{active.length}건</span>
          </h3>
          <Link
            href="/projects"
            className="inline-flex items-center gap-0.5 text-[13.5px] font-semibold text-primary hover:underline"
          >
            전체 보기 <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="card card-hover block p-5"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-[14.5px] leading-snug font-bold">{p.name}</p>
                <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
              </div>
              <p className="text-[12.5px] text-ink-3">
                {p.region} · {p.workType}
              </p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[12px] text-ink-3">계약금액</p>
                  <p className="text-[16px] font-extrabold">
                    {formatMoney(p.contractAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-ink-3">
                    {business === "consulting" ? "관리용역비" : "예상이익"}
                  </p>
                  <p className="text-[15px] font-bold text-success">
                    {business === "consulting"
                      ? p.consulting.fee > 0
                        ? formatMoney(p.consulting.fee)
                        : "—"
                      : formatMoney(p.expectedProfit)}
                  </p>
                </div>
              </div>
              <div className="mt-3.5">
                <div className="mb-1 flex justify-between text-[12px] font-semibold">
                  <span className="text-ink-3">진행률</span>
                  <span>{formatPercent(p.progress)}</span>
                </div>
                <ProgressBar
                  value={p.progress}
                  tone={
                    p.statusKey === "delayed"
                      ? "danger"
                      : p.statusKey === "caution"
                        ? "warning"
                        : "info"
                  }
                />
              </div>
              {business === "consulting" && p.consulting.scope.length > 0 && (
                <p className="mt-2.5 truncate text-[12px] text-ink-3">
                  하나컨설팅: {p.consulting.scope.join(" · ")}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* 빠른 연결 */}
      <div className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-bg text-info">
            <PhoneCall size={17} />
          </span>
          <div>
            <p className="text-[14.5px] font-bold">
              견적 발송 후 연락을 기다리는 고객이 있어요
            </p>
            <p className="text-[13px] text-ink-2">
              서산 한우정식당 견적 발송 후 7일 경과 — 재연락이 필요합니다.
            </p>
          </div>
        </div>
        <Link
          href="/inquiries"
          className="inline-flex items-center gap-1 rounded-xl bg-primary-light px-4 py-2 text-[13.5px] font-semibold text-primary-dark transition-colors hover:bg-[#dcebfd]"
        >
          문의·견적 보기 <ChevronRight size={14} />
        </Link>
      </div>

      <NewInquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
      <DailyLogModal open={logOpen} onClose={() => setLogOpen(false)} />
      <PhoneMemoModal open={memoOpen} onClose={() => setMemoOpen(false)} />
    </div>
  );
}
