"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Download, Footprints } from "lucide-react";
import { FLOW_ASSUME_DURATION_KEPT, FLOW_CONTEXTS, FLOW_STATES, FLOW_STEPS, runFlow, type FlowState } from "@/lib/state-scenarios";
import { SCENARIO_WORKERS } from "@/lib/risk-scenarios";
import { RISK_RULES, diffRisk, gradeRank } from "@/lib/risk-engine";
import { PRIORITY_RULES, diffPriority } from "@/lib/priority-engine";
import { STATE_RULES } from "@/lib/state-events";
import { Badge } from "@/components/ui";
import { RiskLinkCard, downloadJSON } from "@/components/RiskPanel";
import { DeviationTable, PriorityList, PriorityNote, RiskSummaryTable } from "@/components/OpsFlowPanels";

const ALL_RULES: Record<string, string> = Object.fromEntries(
  [...STATE_RULES, ...RISK_RULES, ...PRIORITY_RULES].map((r) => [r.id, `${r.id} ${r.name}`]),
);
const RULE_DESC: Record<string, string> = Object.fromEntries([...STATE_RULES, ...RISK_RULES, ...PRIORITY_RULES].map((r) => [r.id, r.desc]));
const workerName = (id: string) => SCENARIO_WORKERS[id] ?? id;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[18.5px] font-bold text-ink-2">{title}</p>
      {children}
    </div>
  );
}

export function StateFlowVerify() {
  const [n, setN] = useState(1);
  const step = FLOW_STEPS[n - 1];
  const after = runFlow(step.after);
  const before = step.before ? runFlow(step.before) : null;
  const aState = FLOW_STATES[step.after];
  const bState: FlowState | null = step.before ? FLOW_STATES[step.before] : null;
  const newEventIds = new Set(aState.events.filter((e) => !bState?.events.some((x) => x.id === e.id)).map((e) => e.id));
  const changedSites = aState.planned
    .filter((p) => {
      const b = bState?.planned.find((x) => x.id === p.id);
      return b && (b.plannedStart !== p.plannedStart || b.plannedEnd !== p.plannedEnd);
    })
    .map((p) => p.id);
  const titleOf = (id: string) => aState.planned.find((p) => p.id === id)?.title ?? id;

  return (
    <section className="card space-y-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-[16.5px] font-bold text-primary-dark">
            <Footprints size={19} /> 상태이벤트 연속 검증
          </p>
          <p className="text-[24px] leading-snug font-extrabold">실제 작업 이벤트 → 편차 → 예상 종료 → 연쇄위험 → 우선순위 → 조치 → 재판단</p>
          <p className="mt-0.5 text-[17px] text-ink-3">
            검증용 가상 데이터 · 단계마다 기준시각 고정 · 가정: 늦게 시작해도 예정 작업시간 유지 ({FLOW_ASSUME_DURATION_KEPT ? "적용" : "미적용"}) · 시스템은 일정을 바꾸지 않음
          </p>
        </div>
        <button
          onClick={() =>
            downloadJSON("state-flow-verification.json", {
              note: "검증용 가상 시나리오입니다. 실제 운영데이터가 아닙니다. 점수는 관리자 판단 보조용 규칙 점수이며 사고 확률이 아닙니다.",
              contexts: FLOW_CONTEXTS,
              states: Object.values(FLOW_STATES).map((s) => ({ ...s, result: runFlow(s.id) })),
              steps: FLOW_STEPS,
            })
          }
          className="inline-flex min-h-[3rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[17.5px] font-bold text-ink-2 hover:bg-[#e8ebee]"
        >
          <Download size={18} /> 연속 검증 JSON
        </button>
      </div>

      {/* 단계 선택 */}
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9" aria-label="검증 단계">
        {FLOW_STEPS.map((s) => (
          <li key={s.n}>
            <button
              onClick={() => setN(s.n)}
              aria-current={s.n === n ? "step" : undefined}
              className={`flex h-full w-full flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-colors ${
                s.n === n ? "border-primary bg-primary text-white" : s.n < n ? "border-primary/30 bg-primary-light/50" : "border-line hover:bg-[#f7f8fa]"
              }`}
            >
              <span className={`text-[14px] font-extrabold ${s.n === n ? "text-white/80" : "text-ink-3"}`}>STEP {s.n}</span>
              <span className="text-[15px] leading-snug font-bold break-keep">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3">
        <p className="text-[21px] font-extrabold">
          STEP {step.n}. {step.title}
        </p>
        <p className="mt-0.5 text-[18px] leading-relaxed text-ink-2">{step.desc}</p>
        <p className="mt-1 text-[16px] text-ink-3 tabular-nums">
          기준시각 {aState.asOf.replace("T", " ")}
          {bState && ` (변경 전 ${bState.asOf.slice(11)})`} · 데이터 구분: 검증 시나리오
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {step.rules.map((r) => (
            <li key={r} title={RULE_DESC[r]} className="rounded-full bg-white px-2.5 py-0.5 text-[15.5px] font-semibold text-ink-2">
              {ALL_RULES[r] ?? r}
            </li>
          ))}
        </ul>
      </div>

      {/* 입력값 */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="입력값 ① 일정 (예정)">
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[460px] text-left text-[16px]">
              <thead className="bg-[#f7f8fa] text-[14.5px] text-ink-3">
                <tr>
                  {["현장", "작업자", "예정", "이동", "업무 우선순위"].map((h) => (
                    <th key={h} className="px-2.5 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aState.planned.map((p) => (
                  <tr key={p.id} className={`border-t border-line tabular-nums ${changedSites.includes(p.id) ? "bg-warning-bg/60" : ""}`}>
                    <td className="px-2.5 py-1.5 font-bold">
                      {p.title} {changedSites.includes(p.id) && <Badge tone="warning" className="!text-[13.5px]">관리자 조정</Badge>}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{workerName(p.workerId)}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {p.plannedStart}~{p.plannedEnd}
                    </td>
                    <td className="px-2.5 py-1.5">{p.travelMinutes ? `${p.travelMinutes}분` : "-"}</td>
                    <td className="px-2.5 py-1.5">{FLOW_CONTEXTS.find((c) => c.siteId === p.id)?.priority ?? "연결 업무 없음"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
        <Block title="입력값 ② 실제 상태이벤트 (발생시각 · 출처)">
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[460px] text-left text-[16px]">
              <thead className="bg-[#f7f8fa] text-[14.5px] text-ink-3">
                <tr>
                  {["이벤트", "현장", "발생시각", "출처", "구분"].map((h) => (
                    <th key={h} className="px-2.5 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aState.events.map((e) => (
                  <tr key={e.id} className={`border-t border-line tabular-nums ${newEventIds.has(e.id) && bState ? "bg-primary-light/60" : ""}`}>
                    <td className="px-2.5 py-1.5 font-bold whitespace-nowrap">
                      {e.kind} {newEventIds.has(e.id) && bState && <Badge tone="info" className="!text-[13.5px]">새 이벤트</Badge>}
                    </td>
                    <td className="px-2.5 py-1.5">{titleOf(e.siteId)}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{e.at?.replace("T", " ") ?? "-"}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{e.source}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{e.origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {after.eventIssues.length > 0 && <p className="mt-1 text-[15.5px] text-warning">이벤트 문제 {after.eventIssues.length}건</p>}
        </Block>
      </div>

      {/* 계산 과정 */}
      <Block title="계산 과정">
        {step.focus === "상태" && (
          <div className="space-y-3">
            <p className="text-[17px] text-ink-2">예정값으로 계산한 현재 판단입니다. 작업자 2의 D → E는 예정 단계부터 이동 가능시간(30분)이 필요 이동시간(35분)보다 5분 모자랍니다.</p>
            <div className="rounded-2xl border border-line px-4 py-2">
              <div className="overflow-x-auto"><RiskSummaryTable r={after.risk} /></div>
            </div>
          </div>
        )}
        {step.focus === "이벤트" && (
          <ul className="space-y-1 rounded-2xl border border-line px-4 py-3 text-[17px]">
            {after.deviations
              .filter((d) => d.passedToEngine.length > 0)
              .map((d) => (
                <li key={d.siteId}>
                  · {d.title}: 엔진에 넘긴 값 — {d.passedToEngine.join(", ")}
                </li>
              ))}
            <li className="text-ink-3">· 업무 확인 이벤트(B현장 09:20)는 일정에 반영하지 않습니다 (S4 — 예상 종료와 무관).</li>
            <li className="text-ink-3">
              · 정규화 결과: 이벤트 {aState.events.length}건 중 사용 {after.accepted.length}건, 문제 {after.eventIssues.length}건
            </li>
          </ul>
        )}
        {step.focus === "편차" && <DeviationTable deviations={after.deviations} nameOf={workerName} highlight={["A", "B", "D"]} />}
        {step.focus === "예상 종료" && (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-left text-[16.5px]">
              <thead className="bg-[#f7f8fa] text-[15px] text-ink-3">
                <tr>
                  {["현장", "변경 전 예상 종료", "변경 후 예상 종료", "근거"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {after.deviations.map((d) => {
                  const b = before?.deviations.find((x) => x.siteId === d.siteId);
                  const changed = b && (b.end.time !== d.end.time || b.end.source !== d.end.source);
                  return (
                    <tr key={d.siteId} className={`border-t border-line tabular-nums ${changed ? "bg-warning-bg/60" : ""}`}>
                      <td className="px-3 py-2 font-bold">{d.title}</td>
                      <td className="px-3 py-2">{b ? `${b.end.time} (${b.end.source})` : "-"}</td>
                      <td className="px-3 py-2 font-bold">
                        {d.end.time} ({d.end.source}){!d.end.determined && " · 미확정"}
                      </td>
                      <td className="px-3 py-2 text-[15.5px] text-ink-2">{d.end.basis}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {step.focus === "연쇄위험" && (
          <div className="space-y-3">
            {after.risk.links
              .filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2)
              .map((l) => (
                <RiskLinkCard key={l.key} link={l} nameOf={workerName} titleOf={titleOf} />
              ))}
          </div>
        )}
        {(step.focus === "우선순위" || step.focus === "재판단") && (
          <div className="space-y-2">
            <PriorityNote />
            <PriorityList result={after.priority} />
          </div>
        )}
        {step.focus === "조치" && (
          <ul className="space-y-1 rounded-2xl border border-line px-4 py-3 text-[17.5px]">
            {aState.actions
              .filter((a) => !bState?.actions.includes(a))
              .map((a) => (
                <li key={a}>
                  · 관리자 조치: <b>{a}</b>
                </li>
              ))}
            <li className="text-ink-3">· 조치는 관리자가 직접 입력합니다. 엔진은 권장 확인만 돌려주고 일정을 바꾸지 않습니다 (R9).</li>
          </ul>
        )}
        {step.focus === "재판단" && before && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-line px-4 py-3">
              <p className="text-[17px] font-bold text-ink-2">위험 판정 변화</p>
              {diffRisk(before.risk, after.risk).changes.map((c) => (
                <p key={c.key} className="mt-0.5 text-[16.5px]">
                  <Badge tone={c.kind === "신규 위험" || c.kind === "악화" ? "danger" : c.kind === "해소" ? "success" : "neutral"}>{c.kind}</Badge> {c.key}:{" "}
                  {c.before?.grade ?? c.before?.status ?? "-"} (여유 {c.before?.slack ?? "-"}분) → {c.after?.grade ?? c.after?.status ?? "-"} (여유 {c.after?.slack ?? "-"}분)
                </p>
              ))}
            </div>
            <div className="rounded-2xl border border-line px-4 py-3">
              <p className="text-[17px] font-bold text-ink-2">우선순위 변화</p>
              {diffPriority(before.priority, after.priority).map((c) => (
                <p key={c.key} className="mt-0.5 text-[16.5px]">
                  <Badge tone={c.kind === "신규" || c.kind === "상승" ? "danger" : c.kind === "해소" ? "success" : "neutral"}>{c.kind}</Badge> {c.title}:{" "}
                  {c.before ? `${c.before}순위` : "없음"} → {c.after ? `${c.after}순위` : "목록에서 빠짐"}
                </p>
              ))}
            </div>
          </div>
        )}
      </Block>

      {/* 변경 전 · 후 결과 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-line px-4 py-3">
          <p className="text-[17.5px] font-bold text-ink-3">변경 전 결과 {bState ? `(${bState.asOf.slice(11)})` : ""}</p>
          {before ? (
            <>
              <div className="overflow-x-auto"><RiskSummaryTable r={before.risk} /></div>
              <p className="mt-2 text-[16px] text-ink-2">우선순위: {before.priority.items.map((i) => `${i.rank}. ${i.title}(${i.score}점)`).join(" · ") || "없음"}</p>
            </>
          ) : (
            <p className="text-[16.5px] text-ink-3">첫 단계 — 비교할 이전 상태 없음</p>
          )}
        </div>
        <div className="min-w-0 rounded-2xl border-2 border-primary/30 px-4 py-3">
          <p className="text-[17.5px] font-bold text-primary-dark">변경 후 결과 ({aState.asOf.slice(11)})</p>
          <div className="overflow-x-auto"><RiskSummaryTable r={after.risk} /></div>
          <p className="mt-2 text-[16px] text-ink-2">우선순위: {after.priority.items.map((i) => `${i.rank}. ${i.title}(${i.score}점)`).join(" · ") || "없음"}</p>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        <button
          onClick={() => setN((v) => Math.max(1, v - 1))}
          disabled={n === 1}
          className="inline-flex min-h-[3rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[18px] font-bold text-ink-2 disabled:opacity-40"
        >
          <ArrowLeft size={19} /> 이전 단계
        </button>
        <button
          onClick={() => setN((v) => Math.min(FLOW_STEPS.length, v + 1))}
          disabled={n === FLOW_STEPS.length}
          className="inline-flex min-h-[3rem] items-center gap-1.5 rounded-xl bg-primary px-4 text-[18px] font-bold text-white disabled:opacity-40"
        >
          다음 단계 <ArrowRight size={19} />
        </button>
      </div>
    </section>
  );
}
