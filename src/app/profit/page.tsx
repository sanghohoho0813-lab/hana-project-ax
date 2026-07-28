"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, TrendingDown } from "lucide-react";
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
  collectRate,
  costInputRate,
  costRiskGap,
  currentProfit,
  initialProfit,
  isCostRisk,
  overrunItems,
  profitDrop,
  revisedCost,
  totalActual,
} from "@/lib/calc";
import { Badge, PageIntro, ProgressBar, statusTone } from "@/components/ui";

export default function ProfitPage() {
  const { projects } = useApp();
  const active = useMemo(
    () => projects.filter((p) => p.statusKey !== "done"),
    [projects]
  );
  const riskProjects = active.filter(isCostRisk);
  const [focusId, setFocusId] = useState(riskProjects[0]?.id ?? active[0]?.id);
  const focus = active.find((p) => p.id === focusId) ?? active[0];

  const totals = {
    contract: active.reduce((s, p) => s + p.contractAmount, 0),
    budget: active.reduce((s, p) => s + revisedCost(p), 0),
    actual: active.reduce((s, p) => s + totalActual(p), 0),
    profit: active.reduce((s, p) => s + currentProfit(p), 0),
    drop: active.reduce((s, p) => s + profitDrop(p), 0),
  };

  const profitChart = active.map((p) => ({
    name: p.shortName,
    "최초 예상이익": initialProfit(p),
    "현재 예상이익": currentProfit(p),
  }));

  const overruns = focus ? overrunItems(focus).slice(0, 3) : [];
  const overrunTotal = overruns.reduce((s, o) => s + o.over, 0);

  return (
    <div className="page-in space-y-5">
      <PageIntro message="매출보다 중요한, 실제 남는 돈을 확인하세요." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "진행 공사 계약 합계", value: formatMoney(totals.contract) },
          { label: "예상 최종원가", value: formatMoney(totals.budget) },
          { label: "현재 투입원가", value: formatMoney(totals.actual) },
          {
            label: "현재 예상이익 합계",
            value: formatMoney(totals.profit),
            sub: totals.drop > 0 ? `계획보다 ${formatMoney(totals.drop)} 감소` : undefined,
            accent: true,
          },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[18.8px] font-semibold text-ink-3">{k.label}</p>
            <p
              className={`mt-1 text-[28.5px] font-extrabold tracking-tight ${k.accent ? "text-success" : ""}`}
            >
              {k.value}
            </p>
            {k.sub && <p className="mt-1 text-[17.2px] text-danger">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* 프로젝트 핵심 비교 */}
      {focus && (
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[24.8px] font-bold">{focus.name}</h3>
                <Badge tone={statusTone(focus.statusKey)}>{focus.statusLabel}</Badge>
              </div>
              <p className="mt-1 text-[18.8px] text-ink-3">
                계약 {formatMoney(focus.contractAmount)} · {focus.region} · {focus.manager}
              </p>
            </div>
            <select
              value={focus.id}
              onChange={(e) => setFocusId(e.target.value)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-[19.5px] font-semibold text-ink-2 outline-none focus:border-primary"
            >
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.shortName}
                </option>
              ))}
            </select>
          </div>

          {/* 3대 지표 */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "공정률", value: focus.progress, tone: "info" as const },
              {
                label: "원가 투입률",
                value: costInputRate(focus),
                tone: (isCostRisk(focus) ? "danger" : "warning") as "danger" | "warning",
              },
              { label: "수금률", value: collectRate(focus), tone: "success" as const },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-[#f7f8fa] p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[19.5px] font-semibold text-ink-2">{m.label}</span>
                  <span
                    className={`text-[39px] leading-none font-extrabold tracking-tight ${
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

          {/* 경고 */}
          {isCostRisk(focus) ? (
            <div className="mt-4 rounded-2xl border border-danger/15 bg-danger-bg/50 p-5">
              <p className="flex items-center gap-2 text-[22.5px] font-bold text-danger">
                <AlertTriangle size={24} />
                공사는 {focus.progress}% 진행됐지만 원가는 {costInputRate(focus)}%
                투입됐습니다.
              </p>
              {overrunTotal > 0 && (
                <p className="mt-1.5 text-[20.2px] leading-relaxed text-ink-2">
                  {overruns
                    .slice(0, 2)
                    .map((o) => o.name)
                    .join("와 ")}
                  가 계획보다 {formatMoney(overrunTotal)} 높습니다.
                </p>
              )}
              <div className="mt-3.5 space-y-1.5">
                {overruns.map((o) => (
                  <div
                    key={o.name}
                    className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-[19.5px]"
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
          ) : (
            <p className="mt-4 rounded-2xl bg-success-bg/50 px-5 py-4 text-[20.2px] font-semibold text-success">
              원가가 공정률 범위 안에서 관리되고 있습니다. 지금 속도를 유지하면 계획한 이익을
              지킬 수 있어요.
            </p>
          )}

          {/* 이익 변화 */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#f7f8fa] p-5">
              <p className="mb-3 text-[20.2px] font-bold">이익 변화</p>
              <div className="space-y-2 text-[20.2px]">
                <div className="flex justify-between">
                  <span className="text-ink-2">최초 예상이익</span>
                  <span className="font-semibold">{formatMoney(initialProfit(focus))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">현재 예상이익</span>
                  <span className="font-extrabold">{formatMoney(currentProfit(focus))}</span>
                </div>
                {profitDrop(focus) > 0 && (
                  <>
                    <div className="flex justify-between border-t border-line pt-2">
                      <span className="font-bold text-danger">감소금액</span>
                      <span className="font-extrabold text-danger">
                        -{formatMoney(profitDrop(focus))}
                      </span>
                    </div>
                    <p className="text-right text-[18px] text-ink-3">
                      최초 대비{" "}
                      {Math.round((profitDrop(focus) / initialProfit(focus)) * 100)}% 감소
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-[#f7f8fa] p-5">
              <p className="mb-3 text-[20.2px] font-bold">감소 원인</p>
              {focus.profitRisks.length === 0 ? (
                <p className="text-[19.5px] text-ink-3">
                  현재까지 이익이 줄어든 원인이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {focus.profitRisks.map((r) => (
                    <div
                      key={r.reason}
                      className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-[19.5px]"
                    >
                      <span className="font-semibold">{r.reason}</span>
                      <span className="font-bold text-danger">-{formatMoney(r.amount)}</span>
                    </div>
                  ))}
                  {focus.statusKey === "caution" && (
                    <p className="text-[18.8px] text-ink-3">
                      추가공사가 미승인 상태라 매출에 반영되지 않았습니다.
                    </p>
                  )}
                </div>
              )}
              <Link
                href={`/projects/${focus.id}?tab=cost`}
                className="mt-3 inline-flex items-center gap-1 text-[19.5px] font-semibold text-primary hover:underline"
              >
                항목별 원가 자세히 보기 <ChevronRight size={20} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 위험 목록 */}
      {riskProjects.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
            <TrendingDown size={26} className="text-danger" /> 수익성 위험 {riskProjects.length}건
          </h3>
          <div className="space-y-2.5">
            {riskProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}?tab=cost`}
                className="card card-hover flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[21.8px] font-bold">{p.name}</p>
                  <p className="mt-1 text-[19.5px] text-ink-2">
                    공정률 {p.progress}% · 원가 투입률{" "}
                    <b className="text-danger">{costInputRate(p)}%</b> · 예상이익{" "}
                    {formatMoney(currentProfit(p))}
                  </p>
                </div>
                <Badge tone="danger">투입률 {costRiskGap(p)}%p 초과</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 프로젝트별 현황 */}
      <section>
        <h3 className="mb-3 text-[25.5px] font-bold">프로젝트별 원가 현황</h3>
        <div className="space-y-2.5">
          {active.map((p) => {
            const gap = costRiskGap(p);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}?tab=cost`}
                className="card card-hover block p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[21.8px] font-bold">{p.name}</p>
                    <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
                  </div>
                  <p className="text-[19.5px] text-ink-3">
                    계약 {formatMoney(p.contractAmount)} · 예상이익{" "}
                    <span className="font-bold text-success">{formatMoney(currentProfit(p))}</span>
                  </p>
                </div>
                <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex justify-between text-[18.8px] font-semibold">
                      <span className="text-ink-3">공정률</span>
                      <span>{p.progress}%</span>
                    </div>
                    <ProgressBar value={p.progress} tone="info" />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[18.8px] font-semibold">
                      <span className="text-ink-3">원가 투입률</span>
                      <span className={gap >= 8 ? "text-danger" : ""}>{costInputRate(p)}%</span>
                    </div>
                    <ProgressBar value={costInputRate(p)} tone={gap >= 8 ? "danger" : "warning"} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 이익 비교 차트 */}
      <section className="card p-5">
        <p className="text-[21.8px] font-bold">공사별 예상이익 비교</p>
        <p className="mt-1 mb-4 text-[18.8px] text-ink-3">
          단위: 만원 · 진행 중 공사 기준. 회색이 계획, 파란색이 지금 예상되는 이익입니다.
        </p>
        <div className="w-full overflow-x-auto">
          <div className="h-72 min-w-[840px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceff2" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 17.2, fill: "#8b95a1" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e8eb" }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 16.5, fill: "#8b95a1" }}
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
                    fontSize: 19.5,
                    boxShadow: "0 8px 24px rgba(25,31,40,0.1)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 18.8 }} />
                <Bar dataKey="최초 예상이익" fill="#b0b8c1" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="현재 예상이익" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
