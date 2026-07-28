"use client";

import Link from "next/link";
import { AlertTriangle, TrendingDown } from "lucide-react";
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
import { formatMoney } from "@/lib/format";
import {
  costInputRate,
  costRiskGap,
  currentExpectedProfit,
  totalActual,
  totalBudget,
} from "@/lib/calc";
import { Badge, ProgressBar, statusTone } from "@/components/ui";

export default function ProfitPage() {
  const { projects } = useApp();
  const active = projects.filter((p) => p.statusKey !== "done");

  const riskProjects = active.filter((p) => costRiskGap(p) >= 8);

  const profitChart = active.map((p) => ({
    name: p.name.split(" ")[0] + " " + (p.name.split(" ")[1] ?? ""),
    "예상이익": currentExpectedProfit(p),
  }));

  const totals = {
    contract: active.reduce((s, p) => s + p.contractAmount, 0),
    budget: active.reduce((s, p) => s + totalBudget(p), 0),
    actual: active.reduce((s, p) => s + totalActual(p), 0),
    profit: active.reduce((s, p) => s + currentExpectedProfit(p), 0),
  };

  return (
    <div className="page-in space-y-5">
      <p className="text-[14.5px] text-ink-2">
        공사별 수익성 악화를 조기에 발견하세요. 원가 투입률이 공정률보다 높으면
        경고가 표시됩니다.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "진행 공사 계약 합계", value: formatMoney(totals.contract) },
          { label: "예상 최종원가 합계", value: formatMoney(totals.budget) },
          { label: "현재 투입원가 합계", value: formatMoney(totals.actual) },
          { label: "현재 예상이익 합계", value: formatMoney(totals.profit), accent: true },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[12.5px] font-semibold text-ink-3">{k.label}</p>
            <p className={`mt-1 text-[19px] font-extrabold tracking-tight ${"accent" in k && k.accent ? "text-success" : ""}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* 위험 탐지 */}
      {riskProjects.length > 0 && (
        <div className="card border border-danger/15 bg-danger-bg/30 p-5">
          <p className="mb-2.5 flex items-center gap-2 text-[14.5px] font-bold text-danger">
            <TrendingDown size={16} /> 수익성 위험 감지 {riskProjects.length}건
          </p>
          <div className="space-y-2">
            {riskProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}?tab=cost`}
                className="flex flex-col gap-1 rounded-xl bg-white p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[14px] font-bold">{p.name}</p>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    현재 원가 투입률은 <b className="text-danger">{costInputRate(p)}%</b>지만
                    공정률은 <b>{p.progress}%</b>입니다. 자재비와 외주비를 확인하세요.
                  </p>
                </div>
                <Badge tone="danger" className="self-start sm:self-center">
                  투입률 {costInputRate(p) - p.progress}%p 초과
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 프로젝트별 원가 현황 */}
      <section className="space-y-3">
        <h3 className="text-[17px] font-bold">프로젝트별 원가 현황</h3>
        {active.map((p) => {
          const inputRate = costInputRate(p);
          const gap = costRiskGap(p);
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}?tab=cost`}
              className="card card-hover block p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-[14.5px] font-bold">{p.name}</p>
                  <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
                  {gap >= 8 && (
                    <Badge tone="danger">
                      <AlertTriangle size={11} /> 원가 초과
                    </Badge>
                  )}
                </div>
                <p className="text-[13px] text-ink-3">
                  계약 {formatMoney(p.contractAmount)} · 예상이익{" "}
                  <span className="font-bold text-success">
                    {formatMoney(currentExpectedProfit(p))}
                  </span>
                </p>
              </div>
              <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex justify-between text-[12.5px] font-semibold">
                    <span className="text-ink-3">공정률</span>
                    <span>{p.progress}%</span>
                  </div>
                  <ProgressBar value={p.progress} tone="info" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[12.5px] font-semibold">
                    <span className="text-ink-3">원가 투입률</span>
                    <span className={gap >= 8 ? "text-danger" : ""}>{inputRate}%</span>
                  </div>
                  <ProgressBar value={inputRate} tone={gap >= 8 ? "danger" : "warning"} />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* 공사별 예상이익 비교 */}
      <section className="card p-5">
        <p className="mb-1 text-[14.5px] font-bold">공사별 현재 예상이익 비교</p>
        <p className="mb-3 text-[12.5px] text-ink-3">단위: 만원 · 진행 중 공사 기준</p>
        <div className="h-72 w-full overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%" minWidth={480}>
            <BarChart data={profitChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceff2" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11.5, fill: "#8b95a1" }}
                tickLine={false}
                axisLine={{ stroke: "#e5e8eb" }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: "#8b95a1" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                formatter={(v) => formatMoney(Number(v))}
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e8eb", fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 12.5 }} />
              <Bar dataKey="예상이익" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
