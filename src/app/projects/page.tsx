"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Filter } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatMoney, formatPercent } from "@/lib/format";
import { collectRate, costInputRate, costRiskGap, currentProfit } from "@/lib/calc";
import { Badge, EmptyState, PageIntro, ProgressBar, statusTone } from "@/components/ui";
import type { ProjectStatusKey } from "@/lib/types";

const STATUS_FILTERS: { key: "all" | ProjectStatusKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "normal", label: "정상" },
  { key: "caution", label: "주의" },
  { key: "delayed", label: "지연" },
  { key: "closeout", label: "준공 준비" },
  { key: "done", label: "완료" },
];

export default function ProjectsPage() {
  const { projects, business } = useApp();
  const [status, setStatus] = useState<"all" | ProjectStatusKey>("all");
  const [region, setRegion] = useState("전체");
  const [workType, setWorkType] = useState("전체");
  const [manager, setManager] = useState("전체");

  const regions = ["전체", ...Array.from(new Set(projects.map((p) => p.region)))];
  const types = ["전체", ...Array.from(new Set(projects.map((p) => p.workType)))];
  const managers = ["전체", ...Array.from(new Set(projects.map((p) => p.manager)))];

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (status !== "all") {
          if (status === "normal" && !["normal", "preparing"].includes(p.statusKey)) return false;
          if (status !== "normal" && p.statusKey !== status) return false;
        }
        if (region !== "전체" && p.region !== region) return false;
        if (workType !== "전체" && p.workType !== workType) return false;
        if (manager !== "전체" && p.manager !== manager) return false;
        if (business === "consulting" && p.consulting.scope.length === 0) return false;
        return true;
      }),
    [projects, status, region, workType, manager, business]
  );

  const selectClass =
    "rounded-xl border border-line bg-white px-3 py-2 text-[19.5px] font-semibold text-ink-2 outline-none focus:border-primary";

  return (
    <div className="page-in space-y-5">
      <PageIntro message="진행률, 원가, 수금 상태를 현장별로 확인하세요." />

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`rounded-xl px-3.5 py-1.5 text-[19.5px] font-semibold transition-colors ${
                status === f.key
                  ? "bg-primary text-white"
                  : "bg-[#f2f4f6] text-ink-2 hover:bg-[#e8ebee]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={21} className="text-ink-3" />
          <select className={selectClass} value={region} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r === "전체" ? "지역 전체" : r}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t === "전체" ? "공사유형 전체" : t}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={manager}
            onChange={(e) => setManager(e.target.value)}
          >
            {managers.map((m) => (
              <option key={m} value={m}>
                {m === "전체" ? "담당자 전체" : m}
              </option>
            ))}
          </select>
          {business === "consulting" && (
            <Badge tone="info">하나인사이트 관리 프로젝트만 보는 중</Badge>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="조건에 맞는 프로젝트가 없어요" desc="필터를 바꿔서 다시 찾아보세요." />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card card-hover block p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 lg:w-[32%]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[22.5px] font-bold">{p.name}</p>
                    <Badge tone={statusTone(p.statusKey)}>{p.statusLabel}</Badge>
                  </div>
                  <p className="mt-1 text-[18.8px] text-ink-3">
                    {p.client} · {p.region} · {p.manager}
                  </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[17.2px] text-ink-3">계약금액</p>
                    <p className="text-[21.8px] font-extrabold">{formatMoney(p.contractAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[17.2px] text-ink-3">
                      {business === "consulting" ? "관리용역비" : "현재 예상이익"}
                    </p>
                    <p className="text-[21.8px] font-extrabold text-success">
                      {business === "consulting"
                        ? p.consulting.fee > 0
                          ? formatMoney(p.consulting.fee)
                          : "해당 없음"
                        : formatMoney(currentProfit(p))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[17.2px] text-ink-3">원가 투입률</p>
                    <p
                      className={`text-[21.8px] font-extrabold ${
                        costRiskGap(p) >= 8 && p.statusKey !== "done" ? "text-danger" : ""
                      }`}
                    >
                      {formatPercent(costInputRate(p))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[17.2px] text-ink-3">수금률</p>
                    <p className="text-[21.8px] font-extrabold">{formatPercent(collectRate(p))}</p>
                  </div>
                </div>
                <div className="w-full lg:w-[16.5rem]">
                  <div className="mb-1 flex justify-between text-[18px] font-semibold">
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
                          : p.statusKey === "done"
                            ? "success"
                            : "info"
                    }
                  />
                </div>
                <ChevronRight size={26} className="hidden shrink-0 text-ink-3 lg:block" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
