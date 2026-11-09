"use client";

/**
 * 판단 1건 상세용 — 이 판단에서 바뀐 연결의 근거, 판단 후 대응 우선순위, 계기 현장의 작업상태 편차만 보여 준다.
 * (그날 전체 결과는 원본 JSON 에 모두 있다) 데모 표시 부품을 고치지 않고 쓰며 이름은 실증 값으로 넘긴다.
 */
import { Activity, Calculator, ListOrdered } from "lucide-react";
import { RiskLinkCard } from "@/components/RiskPanel";
import { DeviationTable, PriorityList, PriorityNote } from "@/components/OpsFlowPanels";
import { readable } from "@/lib/pilot/display";
import type { PipelineResult } from "@/lib/state-events";

export function JudgmentFocus({
  result: raw,
  changedKeys,
  siteId,
  names,
  titles,
}: {
  result: PipelineResult;
  changedKeys: string[];
  siteId: string | null;
  names: Record<string, string>;
  titles: Record<string, string>;
}) {
  const result = readable(raw, titles);
  const nameOf = (id: string) => names[id] ?? "알 수 없는 직원";
  const titleOf = (id: string) => titles[id] ?? "알 수 없는 현장";
  const links = result.risk.links.filter((l) => changedKeys.includes(l.key));
  const deviations = siteId ? result.deviations.filter((d) => d.siteId === siteId) : [];
  return (
    <section className="space-y-3" aria-label="판단 후 근거">
      <h2 className="flex items-center gap-2 text-[21px] font-extrabold">
        <Calculator size={22} className="text-primary" /> 바뀐 연결의 판단 근거 (판단 후)
      </h2>
      {links.length === 0 ? (
        <p className="card px-5 py-4 text-[17.5px] text-ink-3">이 판단에서 판정이 바뀐 연결이 없습니다.</p>
      ) : (
        links.map((l) => <RiskLinkCard key={l.key} link={l} nameOf={nameOf} titleOf={titleOf} defaultOpen />)
      )}
      <h2 className="flex items-center gap-2 pt-1 text-[21px] font-extrabold">
        <ListOrdered size={22} className="text-primary" /> 대응 우선순위 (판단 후 · 그날 전체)
      </h2>
      <PriorityList result={result.priority} compact />
      <PriorityNote />
      {deviations.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 pt-1 text-[21px] font-extrabold">
            <Activity size={22} className="text-primary" /> 계기 현장의 작업상태 편차 (판단 후)
          </h2>
          <DeviationTable deviations={deviations} nameOf={nameOf} />
        </>
      )}
    </section>
  );
}
