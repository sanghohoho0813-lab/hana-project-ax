"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, FlaskConical, History, RotateCcw, Scale, XCircle } from "lucide-react";
import {
  ALL_CASES,
  SCENARIO_AS_OF,
  SCENARIO_WORKERS,
  SCENARIOS,
  checkCase,
  compareWithBaseline,
  runCase,
  type Scenario,
  type ScenarioCase,
} from "@/lib/risk-scenarios";
import { RISK_RULE_VERSION, RISK_RULES, THRESHOLDS, diffRisk, type RiskDiff } from "@/lib/risk-engine";
import { RiskLinkCard, downloadJSON } from "@/components/RiskPanel";
import { Badge, Segment } from "@/components/ui";

const workerName = (id: string) => SCENARIO_WORKERS[id] ?? (id || "(작업자 없음)");
const RULE_NAME: Record<string, string> = Object.fromEntries(RISK_RULES.map((r) => [r.id, r.name]));

function InputTable({ c }: { c: ScenarioCase }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[720px] text-left text-[17.5px]">
        <thead className="bg-[#f7f8fa] text-[16px] text-ink-3">
          <tr>
            {["현장", "작업자", "날짜", "예정 시간", "상태", "예상·실제 종료", "직전 현장에서 이동"].map((h) => (
              <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.inputs.map((s, i) => (
            <tr key={`${s.id}-${i}`} className="border-t border-line tabular-nums">
              <td className="px-3 py-2 font-bold">
                {s.title} <span className="font-medium text-ink-3">({s.id})</span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{workerName(s.workerId)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{s.date}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {s.plannedStart}~{s.plannedEnd}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{s.status}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {s.actualEnd ? `실제 ${s.actualEnd}` : s.expectedEnd ? `${s.expectedEnd} (${s.expectedEndSource ?? "관리자 입력"})` : "-"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {typeof s.travelMinutes === "number" && Number.isFinite(s.travelMinutes) ? `${s.travelMinutes}분 (${s.travelSource ?? "입력값"})` : "없음"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaseView({ c }: { c: ScenarioCase }) {
  const r = runCase(c);
  const bad = checkCase(c, r);
  const cmp = compareWithBaseline(c);
  const rules = [...new Set(r.links.flatMap((l) => l.rules))].sort();
  const titleOf = (id: string) => c.inputs.find((s) => s.id === id)?.title ?? id;

  return (
    <div className="card space-y-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[16px] font-bold text-ink-3">시나리오 {c.id}</p>
          <p className="text-[24px] leading-snug font-extrabold">{c.label}</p>
          <p className="mt-0.5 text-[18.5px] text-ink-2">{c.note}</p>
        </div>
        {bad.length === 0 ? (
          <Badge tone="success">
            <CheckCircle2 size={17} /> 기대 결과와 일치
          </Badge>
        ) : (
          <Badge tone="danger">
            <XCircle size={17} /> 불일치 {bad.length}건
          </Badge>
        )}
      </div>
      {bad.length > 0 && (
        <ul className="rounded-2xl bg-danger-bg px-4 py-3 text-[17.5px] text-danger">
          {bad.map((b) => (
            <li key={b}>· {b}</li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-1.5 text-[18.5px] font-bold text-ink-2">① 입력값</p>
        <InputTable c={c} />
      </div>

      <div>
        <p className="mb-1.5 text-[18.5px] font-bold text-ink-2">② 적용 규칙</p>
        {rules.length === 0 ? (
          <p className="text-[17.5px] text-ink-3">연결된 일정이 없어 판정 규칙이 적용되지 않았습니다 (R1 연결 단계에서 종료).</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {rules.map((id) => (
              <li key={id} className="rounded-full bg-[#f2f4f6] px-3 py-1 text-[16.5px] font-semibold text-ink-2">
                {id} {RULE_NAME[id]}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[18.5px] font-bold text-ink-2">③ 계산 과정 · ④ 위험 판정 · ⑤ 관리자 확인 사항</p>
        {r.links.length === 0 ? (
          <p className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-[18px] text-ink-2">
            같은 작업자·같은 날짜로 이어지는 일정이 없어 연쇄위험이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {r.links.map((l) => (
              <RiskLinkCard key={l.key} link={l} nameOf={workerName} titleOf={titleOf} />
            ))}
          </div>
        )}
      </div>

      {(r.issues.length > 0 || r.excluded.length > 0) && (
        <div className="rounded-2xl border border-warning/30 px-4 py-3">
          <p className="text-[18px] font-bold text-warning">데이터 처리</p>
          <ul className="mt-1 space-y-0.5 text-[17.5px] text-ink-2">
            {r.excluded.map((x, i) => (
              <li key={`x${i}`}>
                · {titleOf(x.id)} — 판정에서 제외 ({x.reason})
              </li>
            ))}
            {r.issues.map((x, i) => (
              <li key={`i${i}`}>
                · {titleOf(x.siteId)} — {x.kind}: {x.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3">
          <p className="text-[16.5px] font-semibold text-ink-3">기준 방식 · 기존 정적 충돌 검사</p>
          <p className="mt-0.5 text-[19px] font-bold">{cmp.baseline.length ? `감지 ${cmp.baseline.join(", ")}` : "감지 없음"}</p>
        </div>
        <div className="rounded-2xl bg-primary-light/60 px-4 py-3">
          <p className="text-[16.5px] font-semibold text-ink-3">개선 방식 · 연쇄위험 판단엔진</p>
          <p className="mt-0.5 text-[19px] font-bold">
            {cmp.engine.length ? `위험 ${cmp.engine.join(", ")}` : "위험 없음"}
            {cmp.held.length > 0 && <span className="text-ink-2"> · 판단 보류 {cmp.held.join(", ")}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── 연속 시험: 정상 → 지연 → 조정 ─────────────────── */

const FLOW = ["A", "B", "C"] as const;

function FlowRun() {
  const [applied, setApplied] = useState<string[]>(["A"]);
  const cases = applied.map((id) => ALL_CASES.find((c) => c.id === id)!);
  const steps: { from: string; to: string; diff: RiskDiff }[] = cases.slice(1).map((c, i) => ({
    from: cases[i].id,
    to: c.id,
    diff: diffRisk(runCase(cases[i]), runCase(c)),
  }));
  const cur = runCase(cases[cases.length - 1]);
  const l = cur.links[0];
  const next = FLOW[applied.length];

  return (
    <div className="card space-y-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[22px] font-bold">
          <History size={23} className="text-primary" /> 연속 시험 — 정상 → 선행 지연 → 일정 조정
        </p>
        <div className="flex flex-wrap gap-2">
          {next && (
            <button
              onClick={() => setApplied((a) => [...a, next])}
              className="inline-flex min-h-[3rem] items-center gap-1.5 rounded-xl bg-primary px-4 text-[18px] font-bold text-white hover:bg-primary-dark"
            >
              다음 단계 적용: 시나리오 {next} <ArrowRight size={19} />
            </button>
          )}
          <button
            onClick={() => setApplied(["A"])}
            className="inline-flex min-h-[3rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[18px] font-bold text-ink-2 hover:bg-[#e8ebee]"
          >
            <RotateCcw size={18} /> 원상복구
          </button>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {FLOW.map((id, i) => {
          const done = i < applied.length;
          const c = ALL_CASES.find((x) => x.id === id)!;
          const lk = runCase(c).links[0];
          return (
            <li key={id} className={`rounded-2xl border px-4 py-3 ${done ? "border-primary/40 bg-primary-light/40" : "border-line opacity-55"}`}>
              <p className="text-[16px] font-bold text-ink-3">
                {i + 1}단계 · 시나리오 {id}
              </p>
              <p className="text-[19px] font-bold">{c.label}</p>
              <p className="text-[17px] text-ink-2 tabular-nums">
                도착 {lk.arrival} · {lk.slack !== null && lk.slack < 0 ? `${lk.shortfall}분 부족` : `여유 ${lk.slack}분`} · {lk.grade === "없음" ? "위험 없음" : `위험 ${lk.grade}`}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3">
        <p className="text-[18px] font-bold text-ink-2">현재 상태 (시나리오 {applied[applied.length - 1]})</p>
        <p className="mt-0.5 text-[19px] tabular-nums">
          A현장 예상 종료 {l.prev.expectedEnd} ({l.prev.endSource}) + 이동 {l.travel.minutes}분 = 도착 {l.arrival} · B현장 시작 {l.next.plannedStart} →{" "}
          <b>{l.grade === "없음" ? "위험 없음" : `위험 ${l.grade}`}</b>
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[18.5px] font-bold text-ink-2">판단 이력 (이 화면 안에서만 · 원상복구하면 사라짐)</p>
        {steps.length === 0 ? (
          <p className="text-[17.5px] text-ink-3">‘다음 단계 적용’을 누르면 변경 전후 판단이 기록됩니다.</p>
        ) : (
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="rounded-2xl border border-line px-4 py-3">
                <p className="text-[18px] font-bold">
                  #{i + 1} 시나리오 {s.from} → {s.to} · {s.diff.ruleVersion}
                </p>
                {s.diff.changes.map((c) => (
                  <p key={c.key} className="mt-0.5 text-[17.5px] text-ink-2">
                    <Badge tone={c.kind === "신규 위험" || c.kind === "악화" ? "danger" : c.kind === "해소" ? "success" : "neutral"}>{c.kind}</Badge> {c.key}:{" "}
                    {c.before?.grade ?? c.before?.status ?? "-"} (여유 {c.before?.slack ?? "-"}분) → {c.after?.grade ?? c.after?.status ?? "-"} (여유 {c.after?.slack ?? "-"}분)
                  </p>
                ))}
                {s.diff.affectedSites.length > 0 && (
                  <p className="mt-0.5 text-[16.5px] text-ink-3">
                    예상 시간이 바뀐 일정:{" "}
                    {s.diff.affectedSites.map((x) => `${x.id} ${x.before?.start ?? "-"}~${x.before?.end ?? "-"} → ${x.after?.start ?? "-"}~${x.after?.end ?? "-"}`).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const [sid, setSid] = useState<Scenario["id"]>("B");
  const scenario = SCENARIOS.find((s) => s.id === sid)!;
  const rows = ALL_CASES.map(compareWithBaseline);
  const allOk = ALL_CASES.every((c) => checkCase(c).length === 0);

  return (
    <div className="page-in space-y-6">
      <div className="hero-navy overflow-hidden rounded-3xl px-6 py-7 text-white lg:px-9">
        <p className="flex items-center gap-2 text-[18px] font-bold tracking-wide text-[#8fbcff]">
          <FlaskConical size={20} /> 기술검증 시뮬레이션
        </p>
        <h1 className="mt-1.5 text-[34px] leading-tight font-extrabold lg:text-[40px]">복수 현장 연쇄위험 사전판단</h1>
        <p className="mt-2 max-w-[56rem] text-[20px] leading-relaxed text-white/75">
          선행 현장의 종료 지연과 현장 간 이동시간을 이어서, 아직 시작하지 않은 후속 현장의 위험을 미리 계산합니다. 시나리오마다{" "}
          <b className="text-white">입력값 → 적용 규칙 → 계산 과정 → 위험 판정 → 관리자 확인 사항</b>을 그대로 보여줍니다.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2 text-[16.5px] font-semibold">
          {[
            "검증용 가상 데이터 · 데모 업무 데이터와 분리",
            "규칙 기반 판단 (AI 예측 아님)",
            "이동시간은 시나리오 입력값 (실시간 교통정보 아님)",
            `기준시각 ${SCENARIO_AS_OF.replace("T", " ")} 고정`,
            RISK_RULE_VERSION,
          ].map((t) => (
            <li key={t} className="rounded-full bg-white/10 px-3 py-1">
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            onClick={() =>
              downloadJSON("risk-verification-results.json", {
                note: "검증용 가상 시나리오의 입력값과 판단 결과입니다. 실제 운영데이터가 아닙니다. 기준 방식 비교는 기존 코드 대비 기능검증이며 외부 제품 비교가 아닙니다.",
                ruleVersion: RISK_RULE_VERSION,
                rules: RISK_RULES,
                thresholds: THRESHOLDS,
                asOf: SCENARIO_AS_OF,
                cases: ALL_CASES.map((c) => ({ id: c.id, label: c.label, inputs: c.inputs, expect: c.expect, result: runCase(c), mismatches: checkCase(c) })),
                baselineComparison: rows,
              })
            }
            className="inline-flex min-h-[3.25rem] items-center gap-2 rounded-2xl bg-white px-5 text-[19px] font-bold text-ink"
          >
            <Download size={20} className="text-primary" /> 검증 결과 JSON 내보내기
          </button>
          <Link
            href="/schedule"
            className="inline-flex min-h-[3.25rem] items-center gap-2 rounded-2xl bg-white/12 px-5 text-[19px] font-bold text-white hover:bg-white/18"
          >
            데모 일정 화면에서 확인 <ArrowRight size={20} />
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segment<Scenario["id"]>
          value={sid}
          onChange={setSid}
          options={SCENARIOS.map((s) => ({ value: s.id, label: `${s.id} ${s.title}` }))}
        />
        <Badge tone={allOk ? "success" : "danger"}>
          전체 {ALL_CASES.length}개 시나리오 {allOk ? "기대 결과와 일치" : "불일치 있음"}
        </Badge>
      </div>

      <div>
        <p className="text-[25px] font-extrabold">
          시나리오 {scenario.id} · {scenario.title}
        </p>
        <p className="mt-0.5 text-[19px] text-ink-2">{scenario.summary}</p>
      </div>
      <div className="space-y-4">
        {scenario.cases.map((c) => (
          <CaseView key={c.id} c={c} />
        ))}
      </div>

      <FlowRun />

      {/* 기준 방식 비교 */}
      <div className="card p-5 lg:p-6">
        <p className="flex items-center gap-2 text-[22px] font-bold">
          <Scale size={23} className="text-primary" /> 기존 정적 충돌 검사와 비교
        </p>
        <p className="mt-1 text-[17.5px] text-ink-3">
          같은 시험 데이터에 기존 코드(findConflicts, 예정값만 비교)와 연쇄위험 엔진을 함께 적용한 결과입니다. 기존 코드 대비 기능검증이며, 외부 상용 제품과 비교한 것이
          아닙니다 (외부 제품 비교는 별도 검증 필요).
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-[17.5px]">
            <thead className="bg-[#f7f8fa] text-[16px] text-ink-3">
              <tr>
                {["시나리오", "기존 정적 검사 감지", "연쇄위험 엔진 위험(중간 이상)", "엔진 판단 보류"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.caseId} className="border-t border-line">
                  <td className="px-3 py-2 font-bold whitespace-nowrap">
                    {r.caseId} {r.label}
                  </td>
                  <td className="px-3 py-2">{r.baseline.join(", ") || "-"}</td>
                  <td className="px-3 py-2 font-semibold">{r.engine.join(", ") || "-"}</td>
                  <td className="px-3 py-2">{r.held.join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
