"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Handshake,
  Image as ImageIcon,
  MapPin,
  User,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/lib/store";
import { DOCUMENTS } from "@/lib/data";
import { formatDate, formatMoney } from "@/lib/format";
import {
  closeoutDone,
  collectRate,
  costInputRate,
  currentProfit,
  initialProfit,
  isCostRisk,
  overrunItems,
  profitDrop,
  profitRate,
  receivable,
  revisedCost,
  totalActual,
  totalBudget,
} from "@/lib/calc";
import { Badge, EmptyState, ProgressBar, statusTone, type Tone } from "@/components/ui";
import { DailyLogModal } from "@/components/modals";
import type { ChangeOrderStatus } from "@/lib/types";

const TABS = [
  { key: "summary", label: "요약" },
  { key: "schedule", label: "공정·일정" },
  { key: "cost", label: "원가·수익" },
  { key: "logs", label: "현장일보·사진" },
  { key: "changes", label: "변경·추가공사" },
  { key: "closeout", label: "준공·정산" },
  { key: "docs", label: "문서" },
  { key: "consulting", label: "하나컨설팅" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const HANA_TASKS = [
  "고객 계약",
  "실제 시공",
  "자재 및 인력",
  "안전관리",
  "공사대금 청구",
];

const CONSULTING_TASKS = [
  "사전 검토",
  "공정·일정 관리",
  "원가 분석",
  "변경사항 정리",
  "준공자료 취합",
  "프로젝트 보고서",
];

function coTone(status: ChangeOrderStatus): Tone {
  if (status === "승인 완료" || status === "청구 완료") return "success";
  if (status === "승인 대기") return "danger";
  if (status === "공사 완료") return "info";
  return "warning";
}

function phaseTone(status: string): Tone {
  if (status === "완료") return "success";
  if (status === "진행") return "info";
  if (status === "지연") return "danger";
  return "neutral";
}

function ProjectDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const {
    projects,
    changeOrders,
    dailyLogs,
    updateChangeOrder,
    toggleCloseoutDoc,
    showToast,
  } = useApp();
  const initialTab = (searchParams.get("tab") as TabKey) || "summary";
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : "summary"
  );
  const [logOpen, setLogOpen] = useState(false);

  const project = projects.find((p) => p.id === params.id);
  const projectChangeOrders = useMemo(
    () => changeOrders.filter((c) => c.projectId === params.id),
    [changeOrders, params.id]
  );
  const projectLogs = useMemo(
    () => dailyLogs.filter((d) => d.projectId === params.id),
    [dailyLogs, params.id]
  );
  const projectDocs = DOCUMENTS.filter((d) => d.projectId === params.id);

  if (!project) {
    return <EmptyState title="프로젝트를 찾을 수 없어요" desc="목록에서 다시 선택해 주세요." />;
  }

  const p = project;
  const inputRate = costInputRate(p);
  const doneDocs = closeoutDone(p);
  const overruns = overrunItems(p).slice(0, 3);

  const costChartData = p.costs.map((c) => ({
    name: c.name.replace("하나컨설팅 관리용역비", "컨설팅 용역비"),
    "예상원가": c.budget,
    "투입원가": c.actual,
  }));

  return (
    <div className="page-in space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={15} /> 프로젝트 목록
      </Link>

      {/* 헤더 */}
      <div className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-extrabold">{p.name}</h2>
              <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-ink-3" /> {p.region} · {p.workType}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} className="text-ink-3" /> {p.period}
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 size={13} className="text-ink-3" /> {p.client}
              </span>
              <span className="inline-flex items-center gap-1">
                <User size={13} className="text-ink-3" /> {p.manager}
              </span>
            </div>
            {p.risk && (
              <p
                className={`mt-3.5 inline-flex items-start gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold ${
                  p.statusKey === "closeout"
                    ? "bg-success-bg text-success"
                    : p.statusKey === "delayed"
                      ? "bg-danger-bg text-danger"
                      : "bg-warning-bg text-warning"
                }`}
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {p.risk}
              </p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-5 lg:gap-7">
            <div>
              <p className="text-[11.5px] text-ink-3">계약금액</p>
              <p className="text-[19px] font-extrabold tracking-tight">
                {formatMoney(p.contractAmount)}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] text-ink-3">진행률</p>
              <p className="text-[19px] font-extrabold tracking-tight">{p.progress}%</p>
            </div>
            <div>
              <p className="text-[11.5px] text-ink-3">현재 예상이익</p>
              <p className="text-[19px] font-extrabold tracking-tight text-success">
                {formatMoney(currentProfit(p))}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <ProgressBar
            value={p.progress}
            tone={p.statusKey === "delayed" ? "danger" : p.statusKey === "done" ? "success" : "info"}
            thick
          />
        </div>
      </div>

      {/* 업무 주체 */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-bg text-info">
              <Building2 size={17} />
            </span>
            <div>
              <p className="text-[14.5px] font-bold">하나정보통신</p>
              <p className="text-[12px] text-ink-3">계약·시공·준공 책임</p>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {HANA_TASKS.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-[#f2f4f6] px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-2"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-bg text-success">
              <Handshake size={17} />
            </span>
            <div>
              <p className="text-[14.5px] font-bold">하나컨설팅</p>
              <p className="text-[12px] text-ink-3">기획·운영·자료관리</p>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {CONSULTING_TASKS.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-[#f2f4f6] px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-2"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex min-w-max gap-1.5 rounded-2xl bg-[#e8ebee] p-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-all ${
                tab === t.key ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 요약 ── */}
      {tab === "summary" && (
        <div className="rise-in space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "원가 투입률",
                value: `${inputRate}%`,
                sub: `공정률 ${p.progress}%`,
                warn: isCostRisk(p),
              },
              { label: "수금률", value: `${collectRate(p)}%`, sub: `입금 ${formatMoney(p.payment.received)}` },
              {
                label: "미수금",
                value: receivable(p) > 0 ? formatMoney(receivable(p)) : "없음",
                sub: p.payment.overdueDays ? `기일 ${p.payment.overdueDays}일 경과` : "정상",
                warn: receivable(p) > 0,
              },
              {
                label: "준공서류",
                value: `${doneDocs}/${p.closeoutDocs.length}`,
                sub: doneDocs === p.closeoutDocs.length ? "제출 준비 완료" : "누락 확인 필요",
              },
            ].map((k) => (
              <div key={k.label} className="card p-4.5">
                <p className="text-[12.5px] font-semibold text-ink-3">{k.label}</p>
                <p
                  className={`mt-1 text-[19px] font-extrabold tracking-tight ${k.warn ? "text-danger" : ""}`}
                >
                  {k.value}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-3">{k.sub}</p>
              </div>
            ))}
          </div>

          {isCostRisk(p) && (
            <div className="card border border-danger/15 p-5">
              <p className="flex items-center gap-2 text-[14.5px] font-bold text-danger">
                <AlertTriangle size={16} /> 공사는 {p.progress}% 진행됐지만 원가는 {inputRate}%
                투입됐습니다.
              </p>
              <p className="mt-1.5 text-[13.5px] text-ink-2">
                자재비와 외주비를 확인하세요. 지금 추세면 예상이익이{" "}
                {formatMoney(profitDrop(p))} 줄어듭니다.
              </p>
              <button
                onClick={() => setTab("cost")}
                className="mt-3 rounded-xl bg-danger px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              >
                원가 자세히 보기
              </button>
            </div>
          )}

          <div className="card p-5">
            <p className="mb-3 text-[14.5px] font-bold">이 프로젝트 한눈에 보기</p>
            <div className="grid gap-x-8 gap-y-2.5 text-[13.5px] sm:grid-cols-2">
              {[
                ["계약금액", formatMoney(p.contractAmount)],
                ["최초 예상원가", formatMoney(totalBudget(p))],
                ["현재 투입원가", formatMoney(totalActual(p))],
                ["예상 최종원가", formatMoney(revisedCost(p))],
                ["최초 예상이익", formatMoney(initialProfit(p))],
                ["현재 예상이익", formatMoney(currentProfit(p))],
                ["예상이익률", `${profitRate(p)}%`],
                ["하나컨설팅 관리용역비", p.consulting.fee > 0 ? formatMoney(p.consulting.fee) : "해당 없음"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-line/70 pb-2">
                  <span className="text-ink-2">{l}</span>
                  <span className="font-bold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 공정·일정 ── */}
      {tab === "schedule" && (
        <div className="rise-in space-y-2.5">
          {p.phases.length === 0 ? (
            <EmptyState title="완료된 프로젝트입니다" desc="공정 기록은 문서함에 보관돼 있어요." />
          ) : (
            p.phases.map((ph, i) => (
              <div key={ph.name} className="card flex items-center gap-4 p-4.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    ph.status === "완료"
                      ? "bg-success-bg text-success"
                      : ph.status === "진행"
                        ? "bg-info-bg text-info"
                        : ph.status === "지연"
                          ? "bg-danger-bg text-danger"
                          : "bg-[#f2f4f6] text-ink-3"
                  }`}
                >
                  {ph.status === "완료" ? <CheckCircle2 size={16} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-bold">{ph.name}</p>
                    <Badge tone={phaseTone(ph.status)}>
                      {ph.status}
                      {ph.delayDays ? ` ${ph.delayDays}일 지연` : ""}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">
                    예정 {formatDate(ph.plannedDate)}
                    {ph.doneDate && ` · 완료 ${formatDate(ph.doneDate)}`} · {ph.manager}
                    {ph.memo && ` · ${ph.memo}`}
                  </p>
                </div>
                <div className="hidden w-36 shrink-0 sm:block">
                  <div className="mb-1 text-right text-[12px] font-semibold text-ink-3">
                    {ph.progress}%
                  </div>
                  <ProgressBar
                    value={ph.progress}
                    tone={
                      ph.status === "지연" ? "danger" : ph.status === "완료" ? "success" : "info"
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 원가·수익 ── */}
      {tab === "cost" && (
        <div className="rise-in space-y-4">
          <div className="card p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "공정률", value: p.progress, tone: "info" as const },
                {
                  label: "원가 투입률",
                  value: inputRate,
                  tone: (isCostRisk(p) ? "danger" : "warning") as "danger" | "warning",
                },
                { label: "수금률", value: collectRate(p), tone: "success" as const },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl bg-[#f7f8fa] p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-ink-2">{m.label}</span>
                    <span
                      className={`text-[26px] leading-none font-extrabold tracking-tight ${
                        m.tone === "danger" ? "text-danger" : ""
                      }`}
                    >
                      {m.value}%
                    </span>
                  </div>
                  <ProgressBar value={m.value} tone={m.tone} thick />
                </div>
              ))}
            </div>

            {isCostRisk(p) && (
              <div className="mt-4 rounded-2xl border border-danger/15 bg-danger-bg/50 p-5">
                <p className="flex items-center gap-2 text-[14.5px] font-bold text-danger">
                  <AlertTriangle size={16} /> 공사는 {p.progress}% 진행됐지만 원가는{" "}
                  {inputRate}% 투입됐습니다.
                </p>
                <div className="mt-3 space-y-1.5">
                  {overruns.map((o) => (
                    <div
                      key={o.name}
                      className="flex flex-wrap items-center justify-between gap-1 rounded-xl bg-white px-4 py-2.5 text-[13px]"
                    >
                      <span className="font-semibold">{o.name}</span>
                      <span className="text-ink-3">
                        공정률 기준 {formatMoney(o.expected)} → 실제{" "}
                        <b className="text-ink">{formatMoney(o.actual)}</b>
                        <b className="ml-2 text-danger">+{formatMoney(o.over)}</b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <p className="mb-3 text-[14.5px] font-bold">금액 요약</p>
              <div className="space-y-2 text-[13.5px]">
                {[
                  ["계약금액", formatMoney(p.contractAmount)],
                  ["최초 예상원가", formatMoney(totalBudget(p))],
                  ["현재 투입원가", formatMoney(totalActual(p))],
                  ["예상 최종원가", formatMoney(revisedCost(p))],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-ink-2">{l}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <p className="mb-3 text-[14.5px] font-bold">이익 변화</p>
              <div className="space-y-2 text-[13.5px]">
                <div className="flex justify-between">
                  <span className="text-ink-2">최초 예상이익</span>
                  <span className="font-semibold">{formatMoney(initialProfit(p))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">현재 예상이익</span>
                  <span className="font-extrabold">{formatMoney(currentProfit(p))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">예상이익률</span>
                  <span className="font-semibold">{profitRate(p)}%</span>
                </div>
                {p.profitRisks.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-t border-line pt-3">
                    <p className="text-[12.5px] font-bold text-ink-3">감소 원인</p>
                    {p.profitRisks.map((r) => (
                      <div key={r.reason} className="flex justify-between text-[13px]">
                        <span className="text-ink-2">{r.reason}</span>
                        <span className="font-bold text-danger">-{formatMoney(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="text-[14.5px] font-bold">원가 항목별 예상 대 투입</p>
            <p className="mt-1 mb-3 text-[12.5px] text-ink-3">단위: 만원</p>
            <div className="w-full overflow-x-auto">
              <div className="h-72 min-w-[560px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eceff2" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#8b95a1" }}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e8eb" }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8b95a1" }}
                      tickLine={false}
                      axisLine={false}
                      width={46}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(49,130,246,0.05)" }}
                      formatter={(v) => formatMoney(Number(v))}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e8eb",
                        fontSize: 13,
                        boxShadow: "0 8px 24px rgba(25,31,40,0.1)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12.5 }} />
                    <Bar dataKey="예상원가" fill="#b0b8c1" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="투입원가" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 현장일보·사진 ── */}
      {tab === "logs" && (
        <div className="rise-in space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setLogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <ClipboardList size={15} /> 현장일보 작성
            </button>
          </div>
          {projectLogs.length === 0 ? (
            <EmptyState
              title="아직 등록된 현장일보가 없어요"
              desc="현장일보 작성 버튼으로 첫 일보를 등록해 보세요."
            />
          ) : (
            projectLogs.map((d) => (
              <div key={d.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14.5px] font-bold">{formatDate(d.date)}</p>
                  <span className="text-[12.5px] text-ink-3">
                    인원 {d.headcount}명 · {d.hours}시간
                  </span>
                </div>
                <p className="mt-2 text-[14px]">{d.work}</p>
                {d.materials && <p className="mt-1 text-[13px] text-ink-2">자재: {d.materials}</p>}
                {d.issues && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-warning-bg px-2.5 py-1.5 text-[12.5px] font-semibold text-warning">
                    <AlertTriangle size={12} /> {d.issues}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5">
                  {[...Array(Math.min(6, d.photoCount))].map((_, i) => (
                    <span
                      key={i}
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-light text-primary"
                    >
                      <ImageIcon size={16} />
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
                    <span className="font-bold text-primary-dark">AI 보고서 · </span>
                    {d.aiReport}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 변경·추가공사 ── */}
      {tab === "changes" && (
        <div className="rise-in space-y-3">
          {projectChangeOrders.length === 0 ? (
            <EmptyState
              title="등록된 추가공사가 없어요"
              desc="전화메모 정리에서 바로 추가공사로 등록할 수 있어요."
            />
          ) : (
            projectChangeOrders.map((c) => (
              <div
                key={c.id}
                className={`card p-5 ${c.verbalOnly ? "pulse-danger border border-danger/15" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-bold">{c.content}</p>
                  <Badge tone={coTone(c.status)}>{c.status}</Badge>
                  {c.verbalOnly && <Badge tone="danger">전화 요청 · 서면 미승인</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  {formatDate(c.requestDate)} · 요청자 {c.requester}
                  {c.dueDate && ` · 회신기한 ${formatDate(c.dueDate)}`}
                </p>
                <div className="mt-3.5 grid grid-cols-3 gap-3">
                  {[
                    { label: "예상 추가매출", v: c.addRevenue },
                    { label: "예상 추가원가", v: c.addCost },
                    { label: "남는 돈", v: c.addRevenue - c.addCost, accent: true },
                  ].map((x) => (
                    <div key={x.label} className="rounded-xl bg-[#f7f8fa] p-3.5">
                      <p className="text-[11.5px] text-ink-3">{x.label}</p>
                      <p
                        className={`mt-0.5 text-[15px] font-extrabold ${x.accent ? "text-success" : ""}`}
                      >
                        {formatMoney(x.v)}
                      </p>
                    </div>
                  ))}
                </div>
                {c.verbalOnly && (
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-bg px-4 py-3.5">
                    <p className="text-[13px] font-semibold text-danger">
                      작업 전 서면승인이 필요합니다. 견적서를 보내고 승인을 받으세요.
                    </p>
                    <button
                      onClick={() => {
                        updateChangeOrder(c.id, {
                          verbalOnly: false,
                          quoteSent: true,
                          status: "견적 발송",
                        });
                        showToast("추가견적을 발송 처리했어요");
                      }}
                      className="shrink-0 rounded-lg bg-danger px-3.5 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
                    >
                      추가견적 발송
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 준공·정산 ── */}
      {tab === "closeout" && (
        <div className="rise-in grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14.5px] font-bold">준공 체크리스트</p>
              <Badge tone={doneDocs === p.closeoutDocs.length ? "success" : "warning"}>
                {doneDocs}/{p.closeoutDocs.length} 완료
              </Badge>
            </div>
            <p className="mb-2 text-[12.5px] text-ink-3">
              항목을 누르면 완료 여부가 바로 반영됩니다.
            </p>
            <ul className="space-y-0.5">
              {p.closeoutDocs.map((d) => (
                <li key={d.name}>
                  <button
                    onClick={() => toggleCloseoutDoc(p.id, d.name)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[14px] transition-colors hover:bg-[#f7f8fa]"
                  >
                    {d.done ? (
                      <CheckCircle2 size={18} className="shrink-0 text-success" />
                    ) : (
                      <Circle size={18} className="shrink-0 text-ink-3" />
                    )}
                    <span className={d.done ? "text-ink-3 line-through" : "font-semibold"}>
                      {d.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <p className="mb-3 text-[14.5px] font-bold">수금 현황</p>
              <div className="space-y-2 text-[13.5px]">
                {[
                  ["계약금액", p.contractAmount],
                  ["선금", p.payment.advance],
                  ["중도금", p.payment.interim],
                  ["잔금", p.payment.balance],
                  ["청구금액", p.payment.billed],
                  ["입금금액", p.payment.received],
                ].map(([label, v]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-ink-2">{label}</span>
                    <span className="font-semibold">{formatMoney(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-line pt-2.5">
                  <span className="font-bold">미수금</span>
                  <span
                    className={`text-[15px] font-extrabold ${receivable(p) > 0 ? "text-danger" : "text-success"}`}
                  >
                    {receivable(p) > 0 ? formatMoney(receivable(p)) : "없음"}
                  </span>
                </div>
                {p.payment.expectedNote && (
                  <p className="rounded-xl bg-[#f7f8fa] px-3.5 py-2.5 text-[12.5px] text-ink-2">
                    {p.payment.expectedNote}
                  </p>
                )}
              </div>
            </div>

            {p.payment.balanceClaimable && (
              <div className="card border border-success/20 bg-success-bg/40 p-5">
                <p className="text-[15px] font-bold text-success">
                  잔금 {formatMoney(p.payment.balance)}을 지금 청구할 수 있어요
                </p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
                  준공서류 {doneDocs}/{p.closeoutDocs.length} 완료.{" "}
                  {doneDocs === p.closeoutDocs.length
                    ? "서류가 모두 준비됐습니다. 대표 승인만 받으면 청구서가 나갑니다."
                    : "남은 서류를 체크하면 바로 청구서 제출이 가능합니다."}
                </p>
                <Link
                  href="/approvals"
                  className="mt-3.5 inline-block rounded-xl bg-success px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  승인함에서 잔금 청구 승인
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 문서 ── */}
      {tab === "docs" && (
        <div className="rise-in space-y-2.5">
          {projectDocs.length === 0 ? (
            <EmptyState title="등록된 문서가 없어요" desc="문서함에서 자료를 모을 수 있어요." />
          ) : (
            projectDocs.map((d) => (
              <div key={d.id} className="card flex items-center gap-3.5 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info">
                  <FileText size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{d.name}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {formatDate(d.date)} · {d.owner}
                  </p>
                </div>
                <Badge tone="neutral">{d.category}</Badge>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 하나컨설팅 ── */}
      {tab === "consulting" && (
        <div className="rise-in space-y-4">
          {p.consulting.scope.length === 0 ? (
            <EmptyState
              title="하나컨설팅 관리 대상이 아닌 프로젝트예요"
              desc="이 공사는 하나정보통신이 자체 관리했습니다."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="card p-5">
                  <p className="mb-3 text-[14.5px] font-bold">수행 업무</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.consulting.scope.map((s) => (
                      <Badge key={s} tone="success">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
                    하나컨설팅은 프로젝트 기획·운영관리와 자료·원가 관리를 지원합니다. 시공,
                    안전관리, 준공 책임은 하나정보통신이 담당합니다.
                  </p>
                </div>
                <div className="card p-5">
                  <p className="mb-3 text-[14.5px] font-bold">산출물</p>
                  <ul className="space-y-1.5 text-[13.5px] text-ink-2">
                    {p.consulting.deliverables.map((d) => (
                      <li key={d} className="flex items-center gap-2">
                        <FileText size={13} className="shrink-0 text-success" /> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="text-[12px] text-ink-3">관리용역비</p>
                  <p className="text-[22px] font-extrabold tracking-tight">
                    {formatMoney(p.consulting.fee)}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-3">
                    공사 원가에 포함돼 예상이익에 반영돼 있습니다
                  </p>
                </div>
                <Badge
                  tone={
                    p.consulting.feeStatus === "정산 완료"
                      ? "success"
                      : p.consulting.feeStatus === "정산 예정"
                        ? "info"
                        : "warning"
                  }
                >
                  {p.consulting.feeStatus}
                </Badge>
                <Link
                  href="/consulting"
                  className="rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-[#e8ebee]"
                >
                  용역비 계산기 열기
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      <DailyLogModal open={logOpen} onClose={() => setLogOpen(false)} defaultProjectId={p.id} />
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense
      fallback={<div className="card p-10 text-center text-ink-3">불러오는 중입니다...</div>}
    >
      <ProjectDetailInner />
    </Suspense>
  );
}
