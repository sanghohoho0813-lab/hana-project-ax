"use client";

import { useState } from "react";
import { useLab } from "@/lib/lab/store";
import { setReportText } from "@/lib/lab/model";
import { buildReport, reportMarkdown, type Stat } from "@/lib/lab/report";
import { kst } from "@/lib/pilot/time";
import { LabAlerts } from "@/components/lab/LabAlerts";
import { MsgBox, btnGhost, btnPrimary, download, useAct } from "@/components/lab/common";

const fmt = (x: Stat) => (x.n === 0 ? "측정 없음" : `중앙값 ${x.median} (범위 ${x.min}~${x.max}, n=${x.n})`);

/** 결과보고서 정리 — 실측 기록만 자동으로 모으고, ②⑥⑦은 사람이 쓴다 (⑥은 '예상'으로 따로) */
export default function ReportPage() {
  const { state } = useLab();
  const { msg, act } = useAct();
  const [draft, setDraft] = useState<{ before: string; expected: string; limits: string } | null>(null);
  if (!state) return <LabAlerts />;
  const r = buildReport(state, new Date());
  const text = draft ?? state.report;
  const edit = (k: keyof typeof text, v: string) => setDraft({ ...text, [k]: v });
  const save = () => act((s, c) => ({ state: setReportText(s, text, c), value: true }), "보고서 글을 저장했습니다.");
  const area = "min-h-[7rem] w-full rounded-xl border border-line px-3 py-2 text-[16px] print:hidden";
  const h2 = "text-[20px] font-extrabold";

  return (
    <div className="mx-auto max-w-[60rem] space-y-4">
      <LabAlerts />
      <div className="flex flex-wrap gap-2 print:hidden">
        <button className={btnPrimary} onClick={() => window.print()}>
          인쇄 · PDF로 저장
        </button>
        <button className={btnGhost} onClick={() => download(`hana-ax-실증결과정리-${kst(new Date()).date}.md`, reportMarkdown({ ...r, before: { ...r.before, text: text.before }, expected: { text: text.expected }, limits: { ...r.limits, text: text.limits } }))}>
          Markdown 받기
        </button>
        {draft && (
          <button className={btnPrimary} onClick={save}>
            글 저장
          </button>
        )}
      </div>
      <MsgBox msg={msg} />

      <article className="card space-y-5 p-5">
        <header>
          <h1 className="text-[24px] font-extrabold">복수 현장 업무 위험관리 AX 시스템 — 실증·전후 비교 결과 정리</h1>
          <p className="text-[14.5px] text-ink-3">자동 정리 {kst(r.generatedAt).date} {kst(r.generatedAt).time} · 이 브라우저에 저장된 실측 기록만 사용 · 측정하지 않은 값은 &lsquo;측정 없음&rsquo;</p>
        </header>

        <section className="space-y-1.5">
          <h2 className={h2}>① 시험 기간·참가자·시험 횟수</h2>
          <p className="text-[16px]">
            기간 {r.period.from ?? "기록 없음"} ~ {r.period.to ?? "기록 없음"} ({r.period.days}일) · 비교시험 {r.counts.trials}회 (수기 {r.counts.trialsByMethod.수기} · AX {r.counts.trialsByMethod.AX} / 가상 시나리오 {r.counts.trialsByType["가상 시나리오"]} · 실제 현장정보 재현{" "}
            {r.counts.trialsByType["실제 현장정보 재현"]}) · 무효 {r.counts.voidedTrials}회 제외
          </p>
          <p className="text-[16px]">
            현장 실증 세트 {r.counts.sessions}개 (실제 업무 {r.counts.sessionsByKind["실제 업무"]} · 사후 재현 {r.counts.sessionsByKind["사후 재현"]} · 가상 시나리오 {r.counts.sessionsByKind["가상 시나리오"]}) · 작업 기록 {r.counts.events}건 · 위험 판단 {r.counts.judgments}건 · 현장 문제 보고 {r.counts.issues}건
          </p>
          <p className="text-[16px]">
            시험 방식:{" "}
            {Object.entries(r.counts.testModes)
              .map(([k, v]) => `${k} 세트 ${v.sessions}·측정 ${v.trials}`)
              .join(" / ")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-[15px]">
              <thead className="text-ink-3">
                <tr>
                  {["참가자", "코드", "역할", "비교시험", "시험한 날", "실증 세트", "직접 입력", "정보 제공"].map((h) => (
                    <th key={h} className="py-1 pr-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.people.map((p) => (
                  <tr key={p.name + p.code} className="border-t border-line">
                    <td className="py-1 pr-2 font-semibold">{p.name}</td>
                    <td className="py-1 pr-2">{p.code}</td>
                    <td className="py-1 pr-2">{p.role}</td>
                    <td className="py-1 pr-2">{p.trials}</td>
                    <td className="py-1 pr-2">{p.days.join(", ")}</td>
                    <td className="py-1 pr-2">{p.sessions}</td>
                    <td className="py-1 pr-2">{p.entered}</td>
                    <td className="py-1 pr-2">{p.informed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>② 적용 전 업무방식과 문제점</h2>
          <textarea value={text.before} onChange={(e) => edit("before", e.target.value)} placeholder="참여자에게 확인한 내용만 적기 — 예: 전화·메신저로 현장 종료 시각을 묻고 수기 일정표로 다음 현장 도착을 계산" className={area} aria-label="적용 전 업무방식과 문제점" />
          <p className="hidden whitespace-pre-wrap text-[16px] print:block">{text.before || "(입력 필요)"}</p>
          <p className="text-[15px] text-ink-3">수기 방식 측정 {r.before.manualTrials}회 — 결과는 ④ 표</p>
        </section>

        <section className="space-y-2">
          <h2 className={h2}>③ AX 적용 후 결과 — 실측 · 현장정보 재현 · 가상 시나리오를 나눔</h2>
          <p className="text-[16px]">AX 방식 비교시험 {r.measured.ax}회</p>
          {(Object.keys(r.measured.field) as (keyof typeof r.measured.field)[]).map((k, i) => {
            const v = r.measured.field[k];
            const iss = r.issues.byKind[k];
            return (
              <div key={k} className={`space-y-1 rounded-2xl p-3 ${k === "실제 업무" ? "bg-[#e8f1fe]/50" : k === "사후 재현" ? "bg-[#fdf3e0]/60" : "border-2 border-dashed border-[#7c3aed]/30 bg-[#faf7ff]"}`}>
                <h3 className="text-[17px] font-bold">
                  ③-{i + 1} {iss.section} ({k})
                </h3>
                <p className="text-[15.5px]">
                  세트 {v.sessions} · 작업 기록 {v.events} · 판단 {v.judgments} · 프로그램이 새로 표시한 위험 {v.newRisks}건 <span className="text-ink-3">(계산값)</span>
                </p>
                <p className="text-[15.5px]">
                  현장 문제 보고 {iss.count}건 · 예상 종료 엔진 전달 {iss.toEngine}건 · 해결 {iss.resolved}건
                </p>
                {iss.count > 0 && (
                  <table className="w-full text-[14.5px] tabular-nums">
                    <thead className="text-ink-3">
                      <tr>
                        <th className="py-0.5 pr-2 text-left font-semibold">소요시간(분)</th>
                        <th className="py-0.5 pr-2 text-left font-semibold">값</th>
                        <th className="py-0.5 pr-2 text-left font-semibold">시각 근거</th>
                        <th className="py-0.5 text-left font-semibold">시각 모름</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iss.spans.map((x) => (
                        <tr key={x.key} className="border-t border-line/70">
                          <td className="py-0.5 pr-2">{x.label}</td>
                          <td className="py-0.5 pr-2">{fmt(x.stat)}</td>
                          <td className="py-0.5 pr-2">
                            {Object.entries(x.qualities)
                              .map(([q, c]) => `${q} ${c}`)
                              .join(", ") || "-"}
                          </td>
                          <td className="py-0.5">{x.missing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          {r.issues.rows.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="text-[17px] font-bold">현장 문제별 관리자 조치 전후 (계산값)</h3>
              <table className="w-full min-w-[44rem] text-[14.5px] tabular-nums">
                <thead className="text-ink-3">
                  <tr>
                    {["문제", "세트·구분", "시험 방식", "유형", "상태", "위험 연결 보고 전→후→조치 후", "최대 지연(분) 보고 후→조치 후"].map((h) => (
                      <th key={h} className="py-0.5 pr-2 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.issues.rows.map((x) => (
                    <tr key={x.no} className="border-t border-line">
                      <td className="py-0.5 pr-2">#{x.no}</td>
                      <td className="py-0.5 pr-2">
                        {x.set} · {x.kind}
                      </td>
                      <td className="py-0.5 pr-2">{x.testMode}</td>
                      <td className="py-0.5 pr-2">{x.type}</td>
                      <td className="py-0.5 pr-2">{x.status}</td>
                      <td className="py-0.5 pr-2">
                        {x.riskBefore ?? "-"}→{x.riskReported ?? "-"}→{x.riskAfter ?? "-"}
                      </td>
                      <td className="py-0.5">
                        {x.delayReported ?? "-"}→{x.delayAfter ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {r.issues.scenarios.length > 0 && (
            <div>
              <h3 className="text-[17px] font-bold">시험 시나리오 정답(손 계산) 대비 엔진 결과 — 예상과 달라도 그대로 기록</h3>
              <ul className="text-[15px]">
                {r.issues.scenarios.map((x) => (
                  <li key={x.set}>
                    · 세트 {x.set} {x.id} {x.name} ({x.testMode}): 정답 위험 {x.expected ?? "-"} · 엔진 {x.got ?? "보고 없음"} · {x.outcomes.map((o) => `${o.match}${o.text ? `: ${o.text}` : ""}`).join(" / ") || "예상 대비 기록 없음"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(r.issues.estimates.length > 0 || r.estimatedTrials.length > 0) && (
            <div>
              <h3 className="text-[17px] font-bold">추정 값 (기억에 의함 — 통계·비교에 넣지 않음)</h3>
              <ul className="text-[15px]">
                {r.issues.estimates.map((x, i) => (
                  <li key={`i${i}`}>
                    · 현장 문제 #{x.no} ({x.kind}) {x.label}: {x.minutes}분 (추정)
                  </li>
                ))}
                {r.estimatedTrials.map((x) => (
                  <li key={`t${x.no}`}>
                    · 비교시험 측정 #{x.no} ({x.method} · {x.scenario}): 위험 발견 {x.t1Sec ?? "-"}초 · 재판단 {x.t2Sec ?? "-"}초 (추정)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>④ 위험 발견시간 및 정확도 비교 (수기 vs AX)</h2>
          <p className="text-[15.5px] font-semibold text-ink-2">{r.comparison.note}</p>
          <table className="w-full text-[15px] tabular-nums">
            <thead className="text-ink-3">
              <tr>
                <th className="py-1 pr-2 text-left font-semibold">측정</th>
                <th className="py-1 pr-2 text-left font-semibold">수기</th>
                <th className="py-1 pr-2 text-left font-semibold">AX</th>
                <th className="py-1 text-left font-semibold">차이(AX−수기)</th>
              </tr>
            </thead>
            <tbody>
              {r.comparison.rows.map((x) => (
                <tr key={x.measure} className="border-t border-line">
                  <td className="py-1 pr-2 font-semibold">{x.measure}</td>
                  <td className="py-1 pr-2">{fmt(x.manual)}</td>
                  <td className="py-1 pr-2">{fmt(x.ax)}</td>
                  <td className="py-1">{x.difference ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>⑤ 실제 사용 중 발견한 개선사항</h2>
          {r.improvements.length + r.trialIssues.length === 0 && <p className="text-[16px] text-ink-3">(기록 없음)</p>}
          <ul className="text-[16px]">
            {r.improvements.map((n) => (
              <li key={n.no}>
                · [{n.type} · {n.status} · {n.confirmation}] {n.text}
              </li>
            ))}
            {r.trialIssues.map((n) => (
              <li key={`t${n.no}`}>· [시험 중 발견 · 측정 {n.no}] {n.text}</li>
            ))}
          </ul>
          <h3 className="pt-1 text-[17px] font-bold">참여자 피드백 (원문 · 확인 여부 그대로)</h3>
          {r.feedback.length === 0 && <p className="text-[16px] text-ink-3">(기록 없음)</p>}
          <ul className="text-[16px]">
            {r.feedback.map((f) => (
              <li key={f.no}>
                · {f.speaker} ({f.confirmation}): {f.text}
              </li>
            ))}
          </ul>
          <h3 className="pt-1 text-[17px] font-bold">의견으로 바뀐 요구사항·프로그램 (날짜·내용)</h3>
          {r.devLinks.length === 0 && <p className="text-[16px] text-ink-3">(기록 없음)</p>}
          <ul className="text-[16px]">
            {r.devLinks.map((d, i) => (
              <li key={i}>
                · {d.date} {d.kind}
                {d.version && ` (버전 ${d.version})`}: {d.text} <span className="text-ink-3">— 근거: 기록 #{d.note} {d.speaker} &ldquo;{d.noteText}&rdquo;</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-1.5 rounded-2xl border-2 border-dashed border-warning/50 p-3">
          <h2 className={h2}>⑥ 향후 예상 효과와 계산 근거 — 예상 (이번 시험에서 측정한 값이 아님)</h2>
          <textarea value={text.expected} onChange={(e) => edit("expected", e.target.value)} placeholder="확대 적용 시 예상 효과와 계산 근거·가정을 함께 적기 (단기 시험 실측과 섞지 않음)" className={area} aria-label="향후 예상 효과" />
          <p className="hidden whitespace-pre-wrap text-[16px] print:block">{text.expected || "(입력 필요)"}</p>
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>⑦ 실증의 한계와 추가 검증계획</h2>
          <ul className="text-[16px]">
            {r.limits.auto.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
          <textarea value={text.limits} onChange={(e) => edit("limits", e.target.value)} placeholder="추가 검증계획" className={area} aria-label="추가 검증계획" />
          <p className="hidden whitespace-pre-wrap text-[16px] print:block">{text.limits}</p>
        </section>
      </article>
    </div>
  );
}
