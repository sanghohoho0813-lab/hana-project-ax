"use client";

import { AlertTriangle, Bell, Building2, Info, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PROCUREMENT_AGENCY,
  PROCUREMENT_BRAND,
  PROCUREMENT_COMPETITORS,
  PROCUREMENT_REGION,
  PROCUREMENT_WATCH,
} from "@/lib/ops-data";
import { formatMoney } from "@/lib/format";
import { Badge, PageIntro, ProgressBar } from "@/components/ui";

export default function ProcurementPage() {
  const totalCount = PROCUREMENT_REGION.reduce((s, r) => s + r.count, 0);
  const growing = PROCUREMENT_AGENCY.filter((a) => a.last30 > a.prev30);

  return (
    <div className="page-in space-y-6">
      <PageIntro message="어디서 무엇이 얼마나 발주되는지 흐름을 봅니다." />

      <div className="card flex items-start gap-3 border border-warning/25 bg-warning-bg/40 p-5">
        <Info size={24} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-[19px] leading-relaxed text-ink-2">
          이 화면은 <b>샘플 데이터</b>입니다. 실시간 조달 데이터와 연결돼 있지 않으며, 이후 조달
          정보 API나 수집 시스템을 붙일 수 있도록 데이터 인터페이스만 분리해 두었습니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "최근 30일 발주", value: `${totalCount}건` },
          { label: "발주 증가 기관", value: `${growing.length}곳`, tone: "text-primary" },
          { label: "신규 경쟁업체 감지", value: "1곳", tone: "text-danger" },
          { label: "관심기관", value: `${PROCUREMENT_WATCH.length}곳` },
        ].map((k) => (
          <div key={k.label} className="card min-w-0 p-5">
            <p className="text-[18.5px] font-semibold text-ink-3">{k.label}</p>
            <p className={`mt-1 text-[30px] font-extrabold ${k.tone ?? ""}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* 지역별 */}
      <section className="card p-5">
        <p className="text-[22px] font-bold">지역별 발주량</p>
        <p className="mt-1 mb-4 text-[18px] text-ink-3">최근 30일 · 단위 건 (샘플)</p>
        <div className="w-full overflow-x-auto">
          <div className="h-[20rem] min-w-[840px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PROCUREMENT_REGION} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceff2" vertical={false} />
                <XAxis dataKey="region" tick={{ fontSize: 17, fill: "#8b95a1" }} tickLine={false} axisLine={{ stroke: "#e5e8eb" }} interval={0} />
                <YAxis tick={{ fontSize: 16.5, fill: "#8b95a1" }} tickLine={false} axisLine={false} width={50} />
                <Tooltip
                  cursor={{ fill: "rgba(49,130,246,0.05)" }}
                  formatter={(v, n) => (n === "count" ? [`${v}건`, "발주 건수"] : [formatMoney(Number(v)), "금액"])}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e8eb", fontSize: 19 }}
                />
                <Bar dataKey="count" fill="#3182f6" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 기관별 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
          <Building2 size={26} className="text-primary" /> 기관별 발주 추이
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PROCUREMENT_AGENCY.map((a) => {
            const delta = a.last30 - a.prev30;
            return (
              <div key={a.agency} className="card min-w-0 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[21px] font-bold">{a.agency}</p>
                  {delta > 0 && <Badge tone="success">+{delta}건</Badge>}
                  {delta < 0 && <Badge tone="neutral">{delta}건</Badge>}
                </div>
                <p className="mt-2 text-[19px] text-ink-2">
                  최근 30일 <b className="text-ink">{a.last30}건</b> · 직전 30일 {a.prev30}건
                </p>
                <p className="mt-1 text-[18.5px] text-ink-3">발주금액 {formatMoney(a.amount)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 브랜드 점유 */}
      <section className="card p-5">
        <p className="text-[22px] font-bold">브랜드별 점유율</p>
        <p className="mt-1 mb-4 text-[18px] text-ink-3">지역 내 낙찰 기준 (샘플)</p>
        <div className="space-y-3">
          {PROCUREMENT_BRAND.map((b) => (
            <div key={b.brand}>
              <div className="mb-1.5 flex items-center justify-between text-[19px] font-semibold">
                <span>{b.brand}</span>
                <span>
                  {b.share}%
                  <span className={`ml-2 text-[17.5px] ${b.delta > 0 ? "text-success" : b.delta < 0 ? "text-danger" : "text-ink-3"}`}>
                    {b.delta > 0 ? `+${b.delta}` : b.delta}%p
                  </span>
                </span>
              </div>
              <ProgressBar value={b.share} tone={b.delta > 0 ? "success" : "info"} thick />
            </div>
          ))}
        </div>
      </section>

      {/* 경쟁업체 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
          <AlertTriangle size={26} className="text-warning" /> 경쟁업체 움직임
        </h3>
        <div className="space-y-3">
          {PROCUREMENT_COMPETITORS.map((c) => (
            <div
              key={c.name}
              className={`card min-w-0 p-5 ${c.level === "danger" ? "border border-danger/20" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[21px] font-bold">{c.name}</p>
                <Badge tone={c.level === "danger" ? "danger" : c.level === "warning" ? "warning" : "neutral"}>
                  {c.level === "danger" ? "신규 진입" : c.level === "warning" ? "관심" : "변동 없음"}
                </Badge>
              </div>
              <p className="mt-1.5 text-[19px] text-ink-2">{c.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 관심기관 알림 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
          <Bell size={26} className="text-primary" /> 관심기관 알림
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {PROCUREMENT_WATCH.map((w) => (
            <div key={w.agency} className="card min-w-0 p-5">
              <p className="text-[21px] font-bold">{w.agency}</p>
              <p className="mt-1.5 text-[19px] leading-relaxed text-ink-2">{w.reason}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-[18px] font-bold text-primary">
                <TrendingUp size={20} /> 발주 모니터링 중
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
