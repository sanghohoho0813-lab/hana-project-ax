"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calculator,
  CheckCircle2,
  FileText,
  Handshake,
  TrendingDown,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { consultingKpi } from "@/lib/calc";
import { formatMoney } from "@/lib/format";
import { SAMPLE_REPORTS, type SampleReport } from "@/lib/reports";
import { Badge, CountUp, Field, Modal, PageIntro, inputClass } from "@/components/ui";

/** 공사 계약금액 구간별 기본 관리비 */
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

/** 하나인사이트 용역비를 빼기 전의 공사 이익률 가정 */
const GROSS_MARGIN = 0.175;

const STEPS = ["프로젝트 기본정보", "수행 업무", "업무량"] as const;

export default function ConsultingPage() {
  const { projects } = useApp();
  const managed = projects.filter((p) => p.consulting.scope.length > 0);
  const kpi = consultingKpi(projects);

  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<SampleReport | null>(null);

  // 기본값은 서천 장항산단 공장 전기증설 공사 기준
  const [contract, setContract] = useState(13500);
  const [months, setMonths] = useState(3);
  const [difficulty, setDifficulty] = useState<"하" | "중" | "상">("중");
  const [preReview, setPreReview] = useState(true);
  const [scheduleMgmt, setScheduleMgmt] = useState(true);
  const [costAnalysis, setCostAnalysis] = useState(true);
  const [changeMgmt, setChangeMgmt] = useState(false);
  const [closeoutMgmt, setCloseoutMgmt] = useState(true);
  const [visits, setVisits] = useState(8);
  const [reports, setReports] = useState(8);
  const [meetings, setMeetings] = useState(2);

  const calc = useMemo(() => {
    const diffAdd = DIFFICULTY.find((d) => d.key === difficulty)!.add;
    const basic =
      baseTier(contract) + Math.max(0, months - 2) * 20 + (preReview ? 40 : 0) + diffAdd;
    const site = visits * 15 + (scheduleMgmt ? 60 : 0);
    const report = reports * 10 + meetings * 5 + (costAnalysis ? 30 : 0);
    const change = changeMgmt ? 50 : 0;
    const closeout = closeoutMgmt ? 90 : 0;
    const total = basic + site + report + change + closeout;
    const grossProfit = Math.round(contract * GROSS_MARGIN);
    return {
      basic,
      site,
      report,
      change,
      closeout,
      total,
      grossProfit,
      netProfit: grossProfit - total,
      netRate: contract > 0 ? ((grossProfit - total) / contract) * 100 : 0,
    };
  }, [
    contract,
    months,
    difficulty,
    preReview,
    scheduleMgmt,
    costAnalysis,
    changeMgmt,
    closeoutMgmt,
    visits,
    reports,
    meetings,
  ]);

  const deliverables = useMemo(() => {
    const list: string[] = [];
    if (preReview) list.push("착수검토서");
    if (scheduleMgmt) list.push("공정계획서");
    if (reports > 0) list.push(`주간보고서 ${reports}회`);
    if (changeMgmt) list.push("변경사항 관리대장");
    if (costAnalysis) list.push("프로젝트 손익분석서");
    if (closeoutMgmt) list.push("준공자료 체크리스트");
    return list;
  }, [preReview, scheduleMgmt, reports, changeMgmt, costAnalysis, closeoutMgmt]);

  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <button
      key={label}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[20.2px] font-semibold transition-colors ${
        checked ? "bg-primary-light text-primary-dark" : "bg-[#f2f4f6] text-ink-3 hover:text-ink-2"
      }`}
    >
      <span
        className={`flex h-[1.5rem] w-[1.5rem] items-center justify-center rounded-md ${
          checked ? "bg-primary text-white" : "bg-white"
        }`}
      >
        {checked && <CheckCircle2 size={16} />}
      </span>
      {label}
    </button>
  );

  return (
    <div className="page-in space-y-5">
      <PageIntro message="수행 업무와 산출물을 기준으로 용역을 관리하세요." />

      {/* 역할 안내 */}
      <div className="card grid min-w-0 gap-4 p-5 md:grid-cols-2">
        <div className="flex gap-3">
          <span className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-2xl bg-info-bg text-info">
            <Building2 size={28} />
          </span>
          <div>
            <p className="text-[21.8px] font-bold">
              하나정보통신 <span className="text-[18.8px] font-semibold text-ink-3">계약·시공·준공 책임</span>
            </p>
            <p className="mt-1 text-[19.5px] leading-relaxed text-ink-2">
              고객 계약, 실제 시공, 자재와 인력, 안전관리, 공사대금 청구를 담당합니다.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-2xl bg-success-bg text-success">
            <Handshake size={28} />
          </span>
          <div>
            <p className="text-[21.8px] font-bold">
              하나인사이트 <span className="text-[18.8px] font-semibold text-ink-3">기획·운영·자료관리</span>
            </p>
            <p className="mt-1 text-[19.5px] leading-relaxed text-ink-2">
              사전 검토, 공정·일정 관리, 원가 분석, 변경사항 정리, 준공자료 취합을 지원합니다.
            </p>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "이번 달 예정 용역매출", value: formatMoney(kpi.monthRevenue) },
          { label: "미정산 용역비", value: formatMoney(kpi.unsettled) },
          { label: "진행 중 관리 프로젝트", value: `${kpi.managedCount}건` },
          { label: "이번 달 작성 보고서", value: `${kpi.monthReports}건` },
          { label: "산출물", value: `${kpi.deliverables}건` },
        ].map((k) => (
          <div key={k.label} className="card p-4.5">
            <p className="text-[18.8px] font-semibold text-ink-3">{k.label}</p>
            <p className="mt-1 text-[28.5px] font-extrabold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      {/* 정산 리스트 */}
      <section>
        <h3 className="mb-3 text-[25.5px] font-bold">프로젝트별 정산</h3>
        <div className="space-y-2.5">
          {managed.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}?tab=insight`}
              className="card card-hover block p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[21.8px] font-bold">{p.name}</p>
                  <p className="mt-1 text-[18.8px] text-ink-3">
                    하나정보통신 계약 {formatMoney(p.contractAmount)} · 업무범위{" "}
                    {p.consulting.scope.join(" · ")}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-[18.8px] text-ink-2">
                    <FileText size={18} className="mt-0.5 shrink-0 text-ink-3" />
                    {p.consulting.deliverables.join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="lg:text-right">
                    <p className="text-[17.2px] text-ink-3">용역비</p>
                    <p className="text-[25.5px] font-extrabold">{formatMoney(p.consulting.fee)}</p>
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
        <div className="mb-1 flex items-center gap-2">
          <Calculator size={26} className="text-primary" />
          <h3 className="text-[24.8px] font-bold">관리용역비 계산기</h3>
        </div>
        <p className="mb-5 text-[20.2px] text-ink-2">
          공사금액을 나누는 방식이 아니라, 실제 업무량과 산출물 기준으로 관리용역비를
          계산합니다.
        </p>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_33rem]">
          {/* 입력 */}
          <div>
            {/* 단계 */}
            <div className="mb-5 flex gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setStep(i)}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    step === i ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-2 hover:bg-[#e8ebee]"
                  }`}
                >
                  <span
                    className={`block text-[16.5px] font-bold ${step === i ? "text-white/65" : "text-ink-3"}`}
                  >
                    {i + 1}단계
                  </span>
                  <span className="block text-[19.5px] font-bold">{s}</span>
                </button>
              ))}
            </div>

            {step === 0 && (
              <div className="rise-in space-y-4">
                <Field label="공사 계약금액" hint={formatMoney(contract)}>
                  <input
                    type="range"
                    min={1000}
                    max={30000}
                    step={500}
                    value={contract}
                    onChange={(e) => setContract(Number(e.target.value))}
                    className="w-full accent-[#3182f6]"
                  />
                  <div className="mt-1 flex justify-between text-[17.2px] text-ink-3">
                    <span>1,000만 원</span>
                    <span>3억 원</span>
                  </div>
                </Field>
                <Field label="프로젝트 기간" hint={`${months}개월`}>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    className="w-full accent-[#3182f6]"
                  />
                </Field>
                <Field label="프로젝트 난이도" group>
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
                        <span className="block text-[21px] font-bold">{d.key}</span>
                        <span
                          className={`block text-[16.5px] ${difficulty === d.key ? "text-white/75" : "text-ink-3"}`}
                        >
                          {d.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="rise-in">
                <Field label="하나인사이트가 수행할 업무" group>
                  <div className="grid gap-2 pt-1 sm:grid-cols-2">
                    {toggle("사전검토", preReview, setPreReview)}
                    {toggle("공정계획·관리", scheduleMgmt, setScheduleMgmt)}
                    {toggle("원가분석", costAnalysis, setCostAnalysis)}
                    {toggle("추가공사 관리", changeMgmt, setChangeMgmt)}
                    {toggle("준공자료 관리", closeoutMgmt, setCloseoutMgmt)}
                  </div>
                </Field>
                <p className="mt-3 text-[18.8px] leading-relaxed text-ink-3">
                  선택한 업무에 따라 산출물과 용역비가 함께 바뀝니다. 시공·안전관리·준공
                  책임은 하나정보통신이 담당합니다.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="rise-in grid gap-4 sm:grid-cols-3">
                <Field label="현장 방문" hint="회">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={visits}
                    onChange={(e) => setVisits(Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
                <Field label="주간보고서" hint="회">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={reports}
                    onChange={(e) => setReports(Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
                <Field label="회의·협의" hint="회">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={meetings}
                    onChange={(e) => setMeetings(Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="rounded-xl bg-[#f2f4f6] px-4 py-2.5 text-[20.2px] font-semibold text-ink-2 transition-colors hover:bg-[#e8ebee] disabled:opacity-40"
              >
                이전
              </button>
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={step === STEPS.length - 1}
                className="rounded-xl bg-primary px-4 py-2.5 text-[20.2px] font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
              >
                다음 단계
              </button>
            </div>
          </div>

          {/* 결과 */}
          <div className="rounded-2xl bg-[#f7f8fa] p-5">
            <p className="text-[19.5px] font-bold text-ink-2">계산 결과</p>
            <div className="mt-3 space-y-2 text-[20.2px]">
              {(
                [
                  ["기본 프로젝트 관리비", calc.basic],
                  ["현장관리 지원비", calc.site],
                  ["보고서·자료 관리비", calc.report],
                  ...(calc.change > 0 ? ([["추가공사 관리비", calc.change]] as [string, number][]) : []),
                  ...(calc.closeout > 0 ? ([["준공관리비", calc.closeout]] as [string, number][]) : []),
                ] as [string, number][]
              ).map(([label, v]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-ink-2">{label}</span>
                  <span className="font-semibold">{formatMoney(v)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[19.5px] font-bold">하나인사이트 예상 용역비</p>
              <p className="mt-1 text-[45px] leading-none font-extrabold tracking-tight text-primary">
                <CountUp value={calc.total} format={(v) => formatMoney(Math.round(v))} />
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              {[
                ["예상 업무기간", `${months}개월`],
                ["포함 산출물", `${deliverables.length}건`],
                ["예상 보고", `${reports + meetings}회`],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[16.5px] text-ink-3">{l}</p>
                  <p className="mt-0.5 text-[21px] font-bold">{v}</p>
                </div>
              ))}
            </div>

            {/* 공사이익 변화 */}
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[18.8px] font-bold text-ink-2">
                <TrendingDown size={20} className="text-ink-3" /> 용역비를 지급하면 얼마가
                남을까요?
              </p>
              <div className="space-y-2 text-[20.2px]">
                <div className="flex justify-between">
                  <span className="text-ink-2">용역비 반영 전 예상 공사이익</span>
                  <span className="font-semibold">{formatMoney(calc.grossProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">하나인사이트 관리용역비</span>
                  <span className="font-semibold text-danger">-{formatMoney(calc.total)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="font-bold">용역비 반영 후 공사이익</span>
                  <span
                    className={`text-[24px] font-extrabold ${calc.netProfit > 0 ? "text-success" : "text-danger"}`}
                  >
                    {formatMoney(calc.netProfit)}
                  </span>
                </div>
                <p className="text-right text-[17.2px] text-ink-3">
                  계약금액 대비 {calc.netRate.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[18.8px] font-bold text-ink-3">예상 산출물</p>
              <div className="flex flex-wrap gap-1.5">
                {deliverables.length === 0 ? (
                  <p className="text-[18.8px] text-ink-3">수행 업무를 선택하면 표시됩니다.</p>
                ) : (
                  deliverables.map((d) => (
                    <Badge key={d} tone="success">
                      {d}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 산출물 미리보기 */}
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-[21px] font-bold">실제로 이런 문서를 받게 됩니다</p>
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            {SAMPLE_REPORTS.map((r) => (
              <button
                key={r.key}
                onClick={() => setPreview(r)}
                className="card card-hover min-w-0 p-5 text-left"
              >
                <span className="flex h-[3.375rem] w-[3.375rem] items-center justify-center rounded-xl bg-success-bg text-success">
                  <FileText size={26} />
                </span>
                <p className="mt-3 truncate text-[21px] font-bold">{r.title}</p>
                <p className="mt-1 truncate text-[18.8px] text-ink-3">{r.subtitle}</p>
                <span className="mt-2.5 inline-block text-[18.8px] font-semibold text-primary">
                  미리 보기
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-[18px] text-ink-3">
          본 계산은 프로젝트 업무량과 산출물을 기준으로 한 내부 참고용 예시입니다.
        </p>
      </section>

      {/* 문서 미리보기 */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        desc={preview?.subtitle}
        size="xl"
      >
        {preview && (
          <div>
            <div className="grid grid-cols-2 gap-y-2 rounded-2xl bg-[#f7f8fa] p-4 sm:grid-cols-4">
              {preview.meta.map((m) => (
                <div key={m.label}>
                  <p className="text-[17.2px] text-ink-3">{m.label}</p>
                  <p className="text-[19.5px] font-semibold">{m.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-5">
              {preview.sections.map((s) => (
                <div key={s.heading}>
                  <p className="mb-2 text-[21.8px] font-bold">{s.heading}</p>
                  {s.rows && (
                    <div className="overflow-hidden rounded-2xl border border-line">
                      {s.rows.map(([k, v], i) => (
                        <div
                          key={k}
                          className={`flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4 ${
                            i % 2 === 1 ? "bg-[#fafbfc]" : ""
                          }`}
                        >
                          <span className="w-[19.5rem] shrink-0 text-[19.5px] font-semibold text-ink-3">
                            {k}
                          </span>
                          <span className="text-[20.2px]">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.body && (
                    <ul className="space-y-1.5">
                      {s.body.map((b) => (
                        <li key={b} className="flex gap-2 text-[20.2px] leading-relaxed text-ink-2">
                          <span className="mt-2 h-[0.45rem] w-[0.45rem] shrink-0 rounded-full bg-ink-3" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-xl bg-[#f7f8fa] px-4 py-3 text-[18px] text-ink-3">
              {preview.footer}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
