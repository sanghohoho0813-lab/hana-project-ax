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
  collectRate,
  costInputRate,
  costRiskGap,
  currentExpectedProfit,
  receivable,
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
    return (
      <EmptyState
        title="프로젝트를 찾을 수 없어요"
        desc="목록에서 다시 선택해 주세요."
      />
    );
  }

  const p = project;
  const inputRate = costInputRate(p);
  const riskGap = costRiskGap(p);
  const doneDocs = p.closeoutDocs.filter((d) => d.done).length;

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-extrabold">{p.name}</h2>
              <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {p.region} · {p.workType}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} /> {p.period}
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 size={13} /> {p.client}
              </span>
              <span className="inline-flex items-center gap-1">
                <User size={13} /> {p.manager}
              </span>
            </div>
            {p.risk && (
              <p className="mt-3 inline-flex items-start gap-1.5 rounded-xl bg-danger-bg px-3.5 py-2 text-[13px] font-semibold text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {p.risk}
              </p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-4 lg:gap-6">
            <div>
              <p className="text-[12px] text-ink-3">계약금액</p>
              <p className="text-[19px] font-extrabold">
                {formatMoney(p.contractAmount)}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-ink-3">진행률</p>
              <p className="text-[19px] font-extrabold">{p.progress}%</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-3">현재 예상이익</p>
              <p className="text-[19px] font-extrabold text-success">
                {formatMoney(currentExpectedProfit(p))}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar
            value={p.progress}
            tone={p.statusKey === "delayed" ? "danger" : "info"}
          />
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
                tab === t.key
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───── 요약 ───── */}
      {tab === "summary" && (
        <div className="rise-in space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <p className="mb-3 flex items-center gap-2 text-[14.5px] font-bold">
                <Building2 size={16} className="text-primary" /> 하나정보통신
                <Badge tone="info">시공 주체</Badge>
              </p>
              <ul className="grid grid-cols-2 gap-1.5 text-[13.5px] text-ink-2">
                {["발주처 계약", "전기·통신공사 시공", "작업자 투입", "자재 발주", "안전관리", "준공 책임", "공사대금 청구"].map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="shrink-0 text-primary" /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <p className="mb-3 flex items-center gap-2 text-[14.5px] font-bold">
                <Handshake size={16} className="text-success" /> 하나컨설팅
                <Badge tone="success">기획·운영관리</Badge>
              </p>
              <ul className="grid grid-cols-2 gap-1.5 text-[13.5px] text-ink-2">
                {["프로젝트 사전검토", "공정계획 수립 지원", "예상원가 검토", "주간 진행현황 정리", "변경사항 관리", "준공자료 취합", "종료 후 손익분석"].map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="shrink-0 text-success" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "원가 투입률", value: `${inputRate}%`, warn: riskGap >= 8 },
              { label: "수금률", value: `${collectRate(p)}%` },
              { label: "미수금", value: receivable(p) > 0 ? formatMoney(receivable(p)) : "없음" },
              { label: "준공서류", value: `${doneDocs}/${p.closeoutDocs.length || 9}` },
            ].map((k) => (
              <div key={k.label} className="card p-4">
                <p className="text-[12.5px] text-ink-3">{k.label}</p>
                <p
                  className={`mt-1 text-[19px] font-extrabold ${"warn" in k && k.warn ? "text-danger" : ""}`}
                >
                  {k.value}
                </p>
              </div>
            ))}
          </div>
          {riskGap >= 8 && p.statusKey !== "done" && (
            <div className="card pulse-danger border border-danger/15 p-5">
              <p className="flex items-center gap-2 text-[14px] font-bold text-danger">
                <AlertTriangle size={16} /> 수익성 경고
              </p>
              <p className="mt-1.5 text-[14px] text-ink-2">
                현재 원가 투입률은 {inputRate}%지만 공정률은 {p.progress}%입니다.
                자재비와 외주비를 확인하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ───── 공정·일정 ───── */}
      {tab === "schedule" && (
        <div className="rise-in space-y-2.5">
          {p.phases.length === 0 ? (
            <EmptyState title="완료된 프로젝트입니다" desc="공정 단계 기록이 정리 보관됐어요." />
          ) : (
            p.phases.map((ph, i) => (
              <div key={ph.name} className="card flex items-center gap-4 p-4">
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
                      {ph.delayDays ? ` +${ph.delayDays}일` : ""}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">
                    예정 {formatDate(ph.plannedDate)}
                    {ph.doneDate && ` · 완료 ${formatDate(ph.doneDate)}`} ·{" "}
                    {ph.manager}
                    {ph.memo && ` · ${ph.memo}`}
                  </p>
                </div>
                <div className="hidden w-36 shrink-0 sm:block">
                  <div className="mb-1 text-right text-[12px] font-semibold text-ink-3">
                    {ph.progress}%
                  </div>
                  <ProgressBar
                    value={ph.progress}
                    tone={ph.status === "지연" ? "danger" : ph.status === "완료" ? "success" : "info"}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ───── 원가·수익 ───── */}
      {tab === "cost" && (
        <div className="rise-in space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "계약금액", value: formatMoney(p.contractAmount) },
              { label: "최초 예상원가", value: formatMoney(p.initialCostEstimate) },
              { label: "현재 투입원가", value: formatMoney(totalActual(p)) },
              { label: "예상 최종원가", value: formatMoney(totalBudget(p)) },
              { label: "최초 예상이익", value: formatMoney(p.expectedProfit) },
              { label: "현재 예상이익", value: formatMoney(currentExpectedProfit(p)) },
              { label: "예상이익률", value: `${Math.round((currentExpectedProfit(p) / p.contractAmount) * 100)}%` },
              { label: "원가 투입률 / 공정률", value: `${inputRate}% / ${p.progress}%` },
            ].map((k) => (
              <div key={k.label} className="card p-4">
                <p className="text-[12.5px] text-ink-3">{k.label}</p>
                <p className="mt-1 text-[17px] font-extrabold">{k.value}</p>
              </div>
            ))}
          </div>

          {riskGap >= 8 && p.statusKey !== "done" && (
            <div className="card border border-danger/15 bg-danger-bg/40 p-5">
              <p className="flex items-center gap-2 text-[14px] font-bold text-danger">
                <AlertTriangle size={16} /> 원가 위험 감지
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                현재 원가 투입률은 <b>{inputRate}%</b>지만 공정률은{" "}
                <b>{p.progress}%</b>입니다. 자재비와 외주비를 확인하세요.
                {p.statusLabel === "자재 지연" && " 케이블 재발주 시 단가 상승 여부도 함께 점검이 필요합니다."}
              </p>
            </div>
          )}

          {/* 공정률 vs 원가투입률 */}
          <div className="card p-5">
            <p className="mb-4 text-[14.5px] font-bold">공정률 대 원가 투입률</p>
            <div className="space-y-3">
              {[
                { label: "공정률", value: p.progress, color: "bg-primary" },
                { label: "원가 투입률", value: inputRate, color: riskGap >= 8 ? "bg-danger" : "bg-amber-500" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-[13px] font-semibold">
                    <span className="text-ink-2">{row.label}</span>
                    <span>{row.value}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#eceff2]">
                    <div
                      className={`bar-fill h-full rounded-full ${row.color}`}
                      style={{ width: `${Math.min(100, row.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 항목별 예상 vs 투입 */}
          <div className="card p-5">
            <p className="mb-1 text-[14.5px] font-bold">
              원가 항목별 예상 대 투입
            </p>
            <p className="mb-3 text-[12.5px] text-ink-3">단위: 만원</p>
            <div className="h-72 w-full overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={520}>
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
                    width={44}
                  />
                  <Tooltip
                    formatter={(v) => formatMoney(Number(v))}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e8eb", fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12.5 }} />
                  <Bar dataKey="예상원가" fill="#b0b8c1" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="투입원가" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ───── 현장일보·사진 ───── */}
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
                {d.materials && (
                  <p className="mt-1 text-[13px] text-ink-2">자재: {d.materials}</p>
                )}
                {d.issues && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-warning-bg px-2.5 py-1 text-[12.5px] font-semibold text-warning">
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

      {/* ───── 변경·추가공사 ───── */}
      {tab === "changes" && (
        <div className="rise-in space-y-3">
          {projectChangeOrders.length === 0 ? (
            <EmptyState
              title="등록된 추가공사가 없어요"
              desc="전화메모 AI 정리에서 바로 추가공사로 등록할 수 있어요."
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
                  {c.verbalOnly && <Badge tone="danger">구두 요청 · 서면 미승인</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  {formatDate(c.requestDate)} · 요청자 {c.requester}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[
                    { label: "예상 추가매출", v: c.addRevenue },
                    { label: "예상 추가원가", v: c.addCost },
                    { label: "예상 추가이익", v: c.addRevenue - c.addCost },
                  ].map((x) => (
                    <div key={x.label} className="rounded-xl bg-[#f7f8fa] p-3">
                      <p className="text-[12px] text-ink-3">{x.label}</p>
                      <p className="text-[15px] font-extrabold">{formatMoney(x.v)}</p>
                    </div>
                  ))}
                </div>
                {c.verbalOnly && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger-bg px-4 py-3">
                    <p className="text-[13px] font-semibold text-danger">
                      작업 전 서면승인이 필요합니다. 견적서를 발송하고 승인을 받으세요.
                    </p>
                    <button
                      onClick={() => {
                        updateChangeOrder(c.id, {
                          verbalOnly: false,
                          quoteSent: true,
                          status: "승인 대기",
                        });
                        showToast("추가견적이 발송 처리됐어요");
                      }}
                      className="rounded-lg bg-danger px-3.5 py-1.5 text-[12.5px] font-bold text-white transition-colors hover:bg-red-700"
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

      {/* ───── 준공·정산 ───── */}
      {tab === "closeout" && (
        <div className="rise-in grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14.5px] font-bold">준공 체크리스트</p>
              <Badge tone={doneDocs === p.closeoutDocs.length ? "success" : "warning"}>
                {doneDocs}/{p.closeoutDocs.length}
              </Badge>
            </div>
            <ul className="space-y-1">
              {p.closeoutDocs.map((d) => (
                <li key={d.name}>
                  <button
                    onClick={() => toggleCloseoutDoc(p.id, d.name)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] transition-colors hover:bg-[#f7f8fa]"
                  >
                    {d.done ? (
                      <CheckCircle2 size={17} className="shrink-0 text-success" />
                    ) : (
                      <Circle size={17} className="shrink-0 text-ink-3" />
                    )}
                    <span className={d.done ? "text-ink-2 line-through decoration-ink-3/50" : "font-semibold"}>
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
              <div className="space-y-2 text-[14px]">
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
                    <span className="font-bold">{formatMoney(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="font-bold">미수금</span>
                  <span className={`font-extrabold ${receivable(p) > 0 ? "text-danger" : "text-success"}`}>
                    {formatMoney(receivable(p))}
                  </span>
                </div>
              </div>
            </div>
            {p.id === "p6" && (
              <div className="card border border-success/20 bg-success-bg/40 p-5">
                <p className="text-[14px] font-bold text-success">
                  잔금 {formatMoney(p.payment.balance)} 청구 가능
                </p>
                <p className="mt-1 text-[13px] text-ink-2">
                  준공서류 {doneDocs}/{p.closeoutDocs.length} 완료. 대표 승인함에서
                  잔금 청구를 승인하면 바로 청구서가 발행됩니다.
                </p>
                <Link
                  href="/approvals"
                  className="mt-3 inline-block rounded-xl bg-success px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  승인함으로 이동
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───── 문서 ───── */}
      {tab === "docs" && (
        <div className="rise-in space-y-2.5">
          {projectDocs.length === 0 ? (
            <EmptyState title="등록된 문서가 없어요" desc="문서함에서 업로드할 수 있어요." />
          ) : (
            projectDocs.map((d) => (
              <div key={d.id} className="card flex items-center gap-3.5 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{d.name}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {d.category} · {formatDate(d.date)} · {d.owner}
                  </p>
                </div>
                <Badge tone="neutral">{d.category}</Badge>
              </div>
            ))
          )}
        </div>
      )}

      {/* ───── 하나컨설팅 ───── */}
      {tab === "consulting" && (
        <div className="rise-in space-y-4">
          {p.consulting.scope.length === 0 ? (
            <EmptyState
              title="하나컨설팅 관리 대상이 아닌 프로젝트예요"
              desc="이 프로젝트는 하나정보통신이 자체 관리했습니다."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="card p-5">
                  <p className="mb-3 text-[14.5px] font-bold">업무범위</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.consulting.scope.map((s) => (
                      <Badge key={s} tone="success">{s}</Badge>
                    ))}
                  </div>
                  <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
                    하나컨설팅은 프로젝트 기획·운영관리, 자료관리, 원가분석을
                    지원합니다. 시공·안전관리·준공 책임은 하나정보통신이
                    담당합니다.
                  </p>
                </div>
                <div className="card p-5">
                  <p className="mb-3 text-[14.5px] font-bold">산출물</p>
                  <ul className="space-y-1.5 text-[13.5px] text-ink-2">
                    {p.consulting.deliverables.map((d) => (
                      <li key={d} className="flex items-center gap-1.5">
                        <FileText size={13} className="shrink-0 text-success" /> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="text-[12.5px] text-ink-3">관리용역비</p>
                  <p className="text-[22px] font-extrabold">
                    {formatMoney(p.consulting.fee)}
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
                  className="rounded-xl bg-[#f2f4f6] px-4 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-[#e8ebee]"
                >
                  용역비 계산기 열기
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      <DailyLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        defaultProjectId={p.id}
      />
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-ink-3">불러오는 중...</div>}>
      <ProjectDetailInner />
    </Suspense>
  );
}
