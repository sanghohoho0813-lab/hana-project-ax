"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, FileText, Handshake } from "lucide-react";
import { useApp } from "@/lib/store";
import { CONSULTING_KPI } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { Badge, Field, inputClass } from "@/components/ui";

function baseTier(contract: number): number {
  if (contract < 3000) return 120;
  if (contract < 7000) return 180;
  if (contract < 12000) return 220;
  if (contract < 18000) return 250;
  return 320;
}

const DIFFICULTY = [
  { key: "하", add: 0, desc: "단순 반복 공정" },
  { key: "중", add: 40, desc: "일반 공사" },
  { key: "상", add: 100, desc: "복합·대형 공사" },
] as const;

export default function ConsultingPage() {
  const { projects } = useApp();
  const managed = projects.filter((p) => p.consulting.scope.length > 0);

  // 계산기 상태 — 기본값은 서천 장항산단 전기증설 기준
  const [contract, setContract] = useState(13500);
  const [months, setMonths] = useState(3);
  const [visits, setVisits] = useState(8);
  const [reports, setReports] = useState(8);
  const [preReview, setPreReview] = useState(true);
  const [scheduleMgmt, setScheduleMgmt] = useState(true);
  const [costAnalysis, setCostAnalysis] = useState(true);
  const [changeMgmt, setChangeMgmt] = useState(false);
  const [closeoutMgmt, setCloseoutMgmt] = useState(true);
  const [difficulty, setDifficulty] = useState<"하" | "중" | "상">("중");

  const calc = useMemo(() => {
    const durationAdd = Math.max(0, months - 2) * 20;
    const diffAdd = DIFFICULTY.find((d) => d.key === difficulty)!.add;
    const basic = baseTier(contract) + durationAdd + (preReview ? 40 : 0) + diffAdd;
    const site = visits * 15 + (scheduleMgmt ? 60 : 0);
    const report = reports * 10 + (costAnalysis ? 40 : 0);
    const change = changeMgmt ? 50 : 0;
    const closeout = closeoutMgmt ? 90 : 0;
    return {
      basic,
      site,
      report,
      change,
      closeout,
      total: basic + site + report + change + closeout,
    };
  }, [contract, months, visits, reports, preReview, scheduleMgmt, costAnalysis, changeMgmt, closeoutMgmt, difficulty]);

  const deliverables = useMemo(() => {
    const list: string[] = [];
    if (preReview) list.push("착수검토서");
    if (scheduleMgmt) list.push("공정계획서");
    list.push(`주간보고서 ${reports}회`);
    if (changeMgmt) list.push("변경사항 관리대장");
    if (costAnalysis) list.push("프로젝트 손익분석서");
    if (closeoutMgmt) list.push("준공자료 체크리스트");
    return list;
  }, [preReview, scheduleMgmt, reports, changeMgmt, costAnalysis, closeoutMgmt]);

  const checkbox = (
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void
  ) => (
    <button
      key={label}
      onClick={() => onChange(!checked)}
      className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
        checked
          ? "bg-primary-light text-primary-dark"
          : "bg-[#f2f4f6] text-ink-3 hover:text-ink-2"
      }`}
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );

  return (
    <div className="page-in space-y-6">
      <div className="card flex items-start gap-3.5 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success-bg text-success">
          <Handshake size={19} />
        </span>
        <div>
          <p className="text-[15px] font-bold">
            하나컨설팅 — 프로젝트 기획·운영관리 파트너
          </p>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">
            하나정보통신이 계약·시공·자재·안전·준공을 책임지고, 하나컨설팅은
            사전검토, 공정계획 지원, 자료관리, 원가분석 등 프로젝트 운영을
            지원합니다.
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "이번 달 예정 용역매출", value: formatMoney(CONSULTING_KPI.monthServiceRevenue) },
          { label: "미정산 용역비", value: formatMoney(CONSULTING_KPI.unsettledFee) },
          { label: "진행 중 관리 프로젝트", value: `${managed.length}건` },
          { label: "이번 달 작성 보고서", value: `${CONSULTING_KPI.monthReports}건` },
          { label: "완료 산출물", value: `${CONSULTING_KPI.deliverablesDone}건` },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[12.5px] font-semibold text-ink-3">{k.label}</p>
            <p className="mt-1 text-[19px] font-extrabold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* 정산 리스트 */}
      <section>
        <h3 className="mb-3 text-[17px] font-bold">프로젝트별 정산</h3>
        <div className="space-y-2.5">
          {managed.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}?tab=consulting`}
              className="card card-hover block p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-bold">{p.name}</p>
                  <p className="mt-1 text-[12.5px] text-ink-3">
                    하나정보통신 계약 {formatMoney(p.contractAmount)} · 업무범위:{" "}
                    {p.consulting.scope.join(" · ")}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[12.5px] text-ink-2">
                    <FileText size={12} className="shrink-0" />
                    {p.consulting.deliverables.join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="text-[12px] text-ink-3">용역비</p>
                    <p className="text-[17px] font-extrabold">
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
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 계산기 */}
      <section className="card p-6">
        <h3 className="mb-1 flex items-center gap-2 text-[16px] font-bold">
          <Calculator size={17} className="text-primary" /> 관리용역비 계산기
        </h3>
        <p className="mb-5 text-[13px] text-ink-3">
          공사금액 비율이 아니라 실제 업무량과 산출물 기준으로 계산합니다. 값을
          바꾸면 즉시 반영됩니다.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 입력 */}
          <div className="space-y-4">
            <Field label={`공사 계약금액 — ${formatMoney(contract)}`}>
              <input
                type="range"
                min={1000}
                max={30000}
                step={500}
                value={contract}
                onChange={(e) => setContract(Number(e.target.value))}
                className="w-full accent-[#3182f6]"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="기간 (개월)">
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={inputClass}
                  value={months}
                  onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <Field label="현장 방문 (회)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={visits}
                  onChange={(e) => setVisits(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
              <Field label="주간보고서 (회)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={reports}
                  onChange={(e) => setReports(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
            </div>
            <Field label="포함 업무">
              <div className="flex flex-wrap gap-2 pt-1">
                {checkbox("사전검토", preReview, setPreReview)}
                {checkbox("공정관리", scheduleMgmt, setScheduleMgmt)}
                {checkbox("원가분석", costAnalysis, setCostAnalysis)}
                {checkbox("추가공사 관리", changeMgmt, setChangeMgmt)}
                {checkbox("준공자료 취합", closeoutMgmt, setCloseoutMgmt)}
              </div>
            </Field>
            <Field label="프로젝트 난이도">
              <div className="flex gap-2 pt-1">
                {DIFFICULTY.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    className={`flex-1 rounded-xl px-3 py-2.5 text-center transition-colors ${
                      difficulty === d.key
                        ? "bg-primary text-white"
                        : "bg-[#f2f4f6] text-ink-2 hover:bg-[#e8ebee]"
                    }`}
                  >
                    <span className="block text-[14px] font-bold">{d.key}</span>
                    <span
                      className={`block text-[11px] ${difficulty === d.key ? "text-white/80" : "text-ink-3"}`}
                    >
                      {d.desc}
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* 결과 */}
          <div className="rounded-2xl bg-[#f7f8fa] p-5">
            <p className="text-[13px] font-bold text-ink-2">계산 결과</p>
            <div className="mt-3 space-y-2 text-[14px]">
              {[
                ["기본 프로젝트 관리비", calc.basic],
                ["현장관리 지원비", calc.site],
                ["보고서·자료 관리비", calc.report],
                ...(calc.change > 0 ? [["추가공사 관리비", calc.change] as [string, number]] : []),
                ...(calc.closeout > 0 ? [["준공관리비", calc.closeout] as [string, number]] : []),
              ].map(([label, v]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-ink-2">{label}</span>
                  <span className="font-bold">{formatMoney(v as number)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-[14px] font-bold">하나컨설팅 예상 용역비</span>
              <span className="text-[28px] font-extrabold tracking-tight text-primary">
                {formatMoney(calc.total)}
              </span>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[12.5px] font-bold text-ink-3">예상 산출물</p>
              <div className="flex flex-wrap gap-1.5">
                {deliverables.map((d) => (
                  <Badge key={d} tone="success">{d}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] text-ink-3">
          본 계산은 프로젝트 업무량과 산출물을 기준으로 한 내부 참고용
          예시입니다.
        </p>
      </section>
    </div>
  );
}
