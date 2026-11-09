"use client";

/**
 * 실증 화면의 위험 판단 표시 — 데모 통합일정 화면과 같은 표시 부품(RiskLinkCard · PriorityList · DeviationTable)을
 * 고치지 않고 쓴다. 이 부품들은 받은 값만 그리며, 직원 이름·현장 이름은 실증 DB 값을 넘긴다 (데모 데이터를 읽지 않음).
 */
import { useState } from "react";
import { Calculator, ChevronDown, ListOrdered, Route, Activity } from "lucide-react";
import { RiskLinkCard } from "@/components/RiskPanel";
import { DeviationTable, PriorityList, PriorityNote } from "@/components/OpsFlowPanels";
import { RISK_RULE_VERSION, gradeRank } from "@/lib/risk-engine";
import type { PipelineResult } from "@/lib/state-events";
import { readable } from "@/lib/pilot/display";

export function JudgmentNow({
  result: raw,
  names,
  titles,
  asOfLabel,
  deviationsOpen = false,
}: {
  result: PipelineResult;
  names: Record<string, string>;
  titles: Record<string, string>;
  asOfLabel: string;
  /** 작업상태 편차를 처음부터 펼칠지 (작업 기록이 있는 날) */
  deviationsOpen?: boolean;
}) {
  const [showOk, setShowOk] = useState(false);
  const [showDev, setShowDev] = useState(deviationsOpen);
  const result = readable(raw, titles);
  const nameOf = (id: string) => names[id] ?? "알 수 없는 직원";
  const titleOf = (id: string) => titles[id] ?? "알 수 없는 현장";
  const r = result.risk;
  const main = r.links.filter((l) => l.status === "판단 보류" || (l.status === "판정" && gradeRank(l.grade) >= 1));
  const ok = r.links.filter((l) => !main.includes(l));
  const risky = main.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2).length;
  const issues = [...r.issues.map((x) => ({ siteId: x.siteId, kind: x.kind as string, detail: x.detail })), ...result.eventIssues];

  return (
    <section className="space-y-3" aria-label="현재 위험 판단">
      <div>
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[24px] font-extrabold">
          <Route size={25} className="text-primary" /> 위험 판단과 대응 우선순위
          <span className="text-[18px] font-semibold text-ink-3">
            위험 {risky}건 · 연결 {r.links.length}건 확인
          </span>
        </h2>
        <p className="text-[16px] text-ink-3">
          규칙 기반 판단 (AI 예측 아님) · 기준시각 {asOfLabel} (지금) · {RISK_RULE_VERSION} · {result.stateVersion} · 점수는 관리자 판단을 돕는 순서이며 사고 확률이 아닙니다
        </p>
      </div>

      <h3 className="flex items-center gap-2 text-[21px] font-bold">
        <ListOrdered size={22} className="text-primary" /> 대응 우선순위
      </h3>
      <PriorityList result={result.priority} />
      <PriorityNote />

      {result.deviations.length > 0 && (
        <>
          <button
            onClick={() => setShowDev((v) => !v)}
            aria-expanded={showDev}
            className="flex items-center gap-2 pt-1 text-[21px] font-bold"
          >
            <Activity size={22} className="text-primary" /> 작업상태 편차 (예정 대비 실제 기록) {result.deviations.length}건
            <ChevronDown size={21} className={`text-ink-3 ${showDev ? "rotate-180" : ""}`} />
          </button>
          {showDev && <DeviationTable deviations={result.deviations} nameOf={nameOf} />}
        </>
      )}

      <h3 className="flex items-center gap-2 pt-1 text-[21px] font-bold">
        <Calculator size={22} className="text-primary" /> 연결별 판단 근거
      </h3>
      {main.length === 0 ? (
        <p className="card px-5 py-5 text-[18.5px] text-ink-3">주의가 필요한 연결이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {main.map((l) => (
            <RiskLinkCard key={l.key} link={l} nameOf={nameOf} titleOf={titleOf} defaultOpen={l.status === "판정" && gradeRank(l.grade) >= 2} />
          ))}
        </div>
      )}
      {ok.length > 0 && (
        <div>
          <button
            onClick={() => setShowOk((v) => !v)}
            aria-expanded={showOk}
            className="inline-flex items-center gap-1.5 text-[18px] font-bold text-primary-dark hover:underline"
          >
            위험 없는 연결 {ok.length}건 {showOk ? "접기" : "보기"} <ChevronDown size={19} className={showOk ? "rotate-180" : ""} />
          </button>
          {showOk && (
            <div className="mt-2 space-y-3">
              {ok.map((l) => (
                <RiskLinkCard key={l.key} link={l} nameOf={nameOf} titleOf={titleOf} defaultOpen={false} />
              ))}
            </div>
          )}
        </div>
      )}
      {issues.length > 0 && (
        <div className="card border border-warning/30 px-5 py-4">
          <p className="text-[19px] font-bold text-warning">데이터 확인 필요 {issues.length}건</p>
          <ul className="mt-1.5 space-y-1">
            {issues.map((x, i) => (
              <li key={i} className="text-[17.5px] text-ink-2">
                · {titleOf(x.siteId)} — {x.kind}: {x.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
