"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Phone,
  Plus,
  Stamp,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { formatMoney, formatMoneyShort, formatPercent } from "@/lib/format";
import { companyKpi, currentProfit } from "@/lib/calc";
import { Badge, CountUp, ProgressBar, statusTone, type Tone } from "@/components/ui";
import { DailyLogModal, NewInquiryModal, PhoneMemoModal } from "@/components/modals";

const SEVERITY: Record<
  string,
  { tone: Tone; chip: string; icon: React.ElementType; label: string }
> = {
  danger: { tone: "danger", chip: "bg-danger-bg text-danger", icon: AlertTriangle, label: "지금 처리" },
  warning: { tone: "warning", chip: "bg-warning-bg text-warning", icon: AlertTriangle, label: "확인 필요" },
  success: { tone: "success", chip: "bg-success-bg text-success", icon: Banknote, label: "지금 청구 가능" },
  info: { tone: "info", chip: "bg-info-bg text-info", icon: Phone, label: "연락 필요" },
};

function ClockChip() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-xl bg-white px-3.5 py-2 shadow-[var(--shadow-card)]">
      <p className="text-[11px] text-ink-3">현재 시각</p>
      <p className="text-[14px] font-bold tabular-nums">{time ?? "--:--"}</p>
    </div>
  );
}

function TodayInner() {
  const searchParams = useSearchParams();
  const { business, projects, todos, toggleTodo, changeOrders, opportunities, approvals } =
    useApp();
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);

  // 시연 모드 2단계에서 ?memo=1 로 들어오면 전화메모를 바로 열어준다
  const memoParam = searchParams.get("memo") === "1";
  const [prevMemoParam, setPrevMemoParam] = useState(memoParam);
  const [memoOpen, setMemoOpen] = useState(memoParam);
  if (memoParam !== prevMemoParam) {
    setPrevMemoParam(memoParam);
    if (memoParam) setMemoOpen(true);
  }

  const kpi = useMemo(
    () => companyKpi(projects, opportunities, changeOrders),
    [projects, opportunities, changeOrders]
  );
  const active = projects.filter((p) => p.statusKey !== "done");
  const openTodos = todos.filter((t) => !t.done);
  const pendingApprovals = approvals.filter((a) => a.status === "대기").length;
  const isConsulting = business === "consulting";

  const complete = (id: string) => {
    setClosing(id);
    setTimeout(() => {
      toggleTodo(id);
      setClosing(null);
    }, 300);
  };

  return (
    <div className="page-in space-y-5">
      {/* 페이지 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[21px] leading-tight font-extrabold lg:text-[24px]">
            지금 돈과 일정이 걸린 일부터 확인하세요.
          </h2>
          <p className="mt-1 text-[14px] text-ink-2">
            문의·견적·공정·추가공사·수금 위험을 한 화면에서 봅니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white px-3.5 py-2 shadow-[var(--shadow-card)]">
            <p className="text-[11px] text-ink-3">기준일</p>
            <p className="text-[14px] font-bold">7월 28일 (화)</p>
          </div>
          <ClockChip />
        </div>
      </div>

      {/* 브리핑 히어로 */}
      <section className="hero-navy overflow-hidden rounded-3xl px-6 py-6 text-white lg:px-8 lg:py-7">
        <div className="flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 xl:max-w-xl">
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {["대표 브리핑", "전화 문의 정리", "공사용 샘플 데이터"].map((t) => (
                <span
                  key={t}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-white/80"
                >
                  {t}
                </span>
              ))}
            </div>
            <h3 className="text-[24px] leading-[1.32] font-extrabold lg:text-[28px]">
              구본석 이사님,
              <br />
              오늘 돈과 일정이 걸린 {openTodos.length}가지부터 확인하세요.
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-white/70">
              추가공사 승인, 잔금 청구, 자재 지연, 견적 후속 연락을 놓치지 않도록
              정리했습니다.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setInquiryOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-[#4a92f8] active:scale-[0.98]"
              >
                <Plus size={16} /> 새 문의 등록
              </button>
              <button
                onClick={() => setMemoOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-4 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
              >
                <Phone size={15} /> 전화메모 정리
              </button>
              <button
                onClick={() => setLogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-white/65 transition-colors hover:text-white"
              >
                <ClipboardList size={15} /> 현장일보 작성
              </button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2.5 xl:w-[26rem]">
            {[
              { label: "위험 프로젝트", value: `${kpi.riskProjectCount}건`, icon: AlertTriangle },
              { label: "승인 대기", value: `${pendingApprovals}건`, icon: Stamp },
              { label: "미수금", value: formatMoneyShort(kpi.receivables), icon: Wallet },
              {
                label: "추가공사 기회",
                value: `${changeOrders.filter((c) => !c.billed).length}건`,
                icon: TrendingUp,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/8 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-white/60">{s.label}</span>
                  <s.icon size={14} className="text-white/40" />
                </div>
                <p className="text-[21px] font-extrabold tracking-tight">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 핵심 숫자 3개 */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card card-hover p-5.5">
          <p className="text-[13px] font-semibold text-ink-3">올해 누적 수주</p>
          <p className="mt-1.5 text-[30px] leading-none font-extrabold tracking-tight lg:text-[34px]">
            <CountUp value={kpi.yearOrders} format={(v) => formatMoney(Math.round(v))} />
          </p>
          <div className="mt-3.5 space-y-1 border-t border-line pt-3 text-[12.5px]">
            {[
              ["완료 공사", kpi.yearOrdersDone],
              ["진행 중 공사", kpi.yearOrdersActive],
              ["계약 확정", kpi.yearOrdersConfirmed],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between">
                <span className="text-ink-3">{l}</span>
                <span className="font-semibold">{formatMoney(v as number)}</span>
              </div>
            ))}
          </div>
        </div>

        <Link href="/closeout" className="card card-hover block p-5.5">
          <p className="text-[13px] font-semibold text-ink-3">회수 예정금액</p>
          <p className="mt-1.5 text-[30px] leading-none font-extrabold tracking-tight text-success lg:text-[34px]">
            <CountUp value={kpi.collectible} format={(v) => formatMoney(Math.round(v))} />
          </p>
          <div className="mt-3.5 space-y-1 border-t border-line pt-3 text-[12.5px]">
            {[
              ["청구했지만 못 받은 돈", kpi.receivables],
              ["지금 청구 가능한 잔금", kpi.claimableBalance],
              ["이번 달 입금 예정", kpi.expectedThisMonth],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between">
                <span className="text-ink-3">{l}</span>
                <span className="font-semibold">{formatMoney(v as number)}</span>
              </div>
            ))}
          </div>
        </Link>

        <div className="card card-hover p-5.5">
          <p className="text-[13px] font-semibold text-ink-3">위험·누락 가능금액</p>
          <p className="mt-1.5 text-[30px] leading-none font-extrabold tracking-tight text-danger lg:text-[34px]">
            <CountUp value={kpi.atRisk} format={(v) => formatMoney(Math.round(v))} />
          </p>
          <div className="mt-3.5 space-y-1 border-t border-line pt-3 text-[12.5px]">
            {[
              ["잔금 청구 가능", kpi.claimableBalance],
              ["미승인 추가공사", kpi.unapprovedChangeOrders],
              ["후속 필요 견적 (가중)", kpi.staleQuoteWeighted],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between">
                <span className="text-ink-3">{l}</span>
                <span className="font-semibold">{formatMoney(v as number)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 보조 KPI */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "진행 중 공사",
            value: `${kpi.activeCount}건`,
            sub: `정상 ${active.filter((p) => !["delayed", "caution"].includes(p.statusKey)).length}건 · 주의 ${kpi.riskProjectCount}건`,
            href: "/projects",
          },
          {
            label: "예상 연매출",
            value: formatMoney(kpi.yearForecast),
            sub: `누적 수주 + 견적 가중 + 하반기 ${formatMoneyShort(kpi.secondHalfAssumption)} 가정`,
            href: "/profit",
          },
          {
            label: "다음 달 예상 신규수주",
            value: formatMoney(kpi.nextMonthOrders),
            sub: `확정 ${formatMoneyShort(kpi.nextMonthConfirmed)} + 가중 ${formatMoneyShort(kpi.nextMonthWeighted)}`,
            href: "/inquiries",
          },
          {
            label: "미수금",
            value: formatMoney(kpi.receivables),
            sub: `기일 경과 ${formatMoney(kpi.overdueReceivables)}`,
            href: "/closeout",
            tone: "danger" as const,
          },
        ].map((k) => (
          <Link key={k.label} href={k.href} className="card card-hover block p-4.5">
            <p className="text-[12.5px] font-semibold text-ink-3">{k.label}</p>
            <p
              className={`mt-1 text-[19px] leading-tight font-extrabold tracking-tight ${
                k.tone === "danger" ? "text-danger" : ""
              }`}
            >
              {k.value}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3">{k.sub}</p>
          </Link>
        ))}
      </section>

      {/* 오늘 먼저 처리할 일 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold">
            오늘 먼저 처리할 일
            <span className="ml-2 text-[13px] font-semibold text-ink-3">
              금액이 큰 순서
            </span>
          </h3>
          <span className="text-[13px] font-semibold text-ink-3">
            {openTodos.length}건 남음
          </span>
        </div>

        {openTodos.length === 0 ? (
          <div className="card flex flex-col items-center gap-1.5 p-10 text-center">
            <CheckCircle2 size={26} className="text-success" />
            <p className="text-[15px] font-bold">오늘 확인할 일을 모두 처리했어요</p>
            <p className="text-[13px] text-ink-3">
              새 문의가 들어오거나 현장 상황이 바뀌면 여기에 다시 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="stagger space-y-2.5">
            {openTodos.map((t) => {
              const meta = SEVERITY[t.severity];
              return (
                <div
                  key={t.id}
                  className={`card p-5 ${closing === t.id ? "collapse-out" : ""} ${
                    t.severity === "danger" ? "pulse-danger" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 gap-3.5">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.chip}`}
                      >
                        <meta.icon size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15.5px] leading-snug font-bold">{t.title}</p>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
                          {t.action}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                          미루면 · {t.risk}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-4 lg:justify-end">
                      {t.amount !== undefined && (
                        <div className="lg:text-right">
                          <p className="text-[11.5px] text-ink-3">{t.amountLabel}</p>
                          <p
                            className={`text-[19px] font-extrabold tracking-tight ${
                              t.severity === "success"
                                ? "text-success"
                                : t.severity === "danger"
                                  ? "text-danger"
                                  : ""
                            }`}
                          >
                            {formatMoney(t.amount)}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {t.href && (
                          <Link
                            href={t.href}
                            className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                          >
                            {t.ctaLabel} <ChevronRight size={14} />
                          </Link>
                        )}
                        <button
                          onClick={() => complete(t.id)}
                          className="rounded-xl bg-[#f2f4f6] px-3.5 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-success-bg hover:text-success"
                        >
                          완료
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 이번 달 회수·추가 매출 */}
      <section className="card flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[14px] font-bold">이번 달 챙기면 들어오는 돈</p>
          <p className="mt-1.5 text-[30px] leading-none font-extrabold tracking-tight text-primary">
            {formatMoney(kpi.expectedThisMonth + kpi.claimableBalance + kpi.unapprovedChangeOrders)}
          </p>
          <p className="mt-2 text-[13px] text-ink-2">
            이번 달 입금 예정 {formatMoney(kpi.expectedThisMonth)} + 청구 가능 잔금{" "}
            {formatMoney(kpi.claimableBalance)} + 미승인 추가공사{" "}
            {formatMoney(kpi.unapprovedChangeOrders)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/closeout"
            className="inline-flex items-center gap-1 rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-[#e8ebee]"
          >
            준공·수금 보기
          </Link>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            대표 승인함 <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* 진행 중 프로젝트 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold">
            진행 중 프로젝트 <span className="text-ink-3">{active.length}건</span>
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
            <Link key={p.id} href={`/projects/${p.id}`} className="card card-hover block p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-[14.5px] leading-snug font-bold">{p.name}</p>
                <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
              </div>
              <p className="text-[12.5px] text-ink-3">
                {p.region} · {p.workType} · {p.manager}
              </p>
              <div className="mt-3.5 flex items-end justify-between">
                <div>
                  <p className="text-[11.5px] text-ink-3">계약금액</p>
                  <p className="text-[16.5px] font-extrabold">
                    {formatMoney(p.contractAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11.5px] text-ink-3">
                    {isConsulting ? "관리용역비" : "현재 예상이익"}
                  </p>
                  <p className="text-[15px] font-extrabold text-success">
                    {isConsulting
                      ? p.consulting.fee > 0
                        ? formatMoney(p.consulting.fee)
                        : "해당 없음"
                      : formatMoney(currentProfit(p))}
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
              {isConsulting && p.consulting.scope.length > 0 && (
                <p className="mt-2.5 flex items-center gap-1 truncate text-[12px] text-ink-3">
                  <FileText size={11} className="shrink-0" />
                  {p.consulting.scope.join(" · ")}
                </p>
              )}
              {business === "hana" && (
                <p className="mt-2.5 flex items-center gap-1 truncate text-[12px] text-ink-3">
                  <Building2 size={11} className="shrink-0" />
                  발주처 {p.client}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <NewInquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
      <DailyLogModal open={logOpen} onClose={() => setLogOpen(false)} />
      <PhoneMemoModal open={memoOpen} onClose={() => setMemoOpen(false)} />
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<div className="card p-10 text-center text-ink-3">불러오는 중입니다...</div>}>
      <TodayInner />
    </Suspense>
  );
}
