/**
 * 결과보고서 정리 — 저장된 실측 기록만으로 ①~⑦ 항목을 모은다.
 *
 * - 측정하지 않은 소요시간·개선율·정확도는 만들지 않는다. 값이 없으면 '측정 없음'.
 * - 비교값은 수기·AX 실측이 모두 있을 때만, "이번 시험 측정값(n=…)"으로 낸다.
 * - 단기 시험에서 확인한 결과(③④)와 향후 예상 효과(⑥ — 사람이 쓴 글)를 나눈다.
 */
import { kst } from "@/lib/pilot/time";
import { gradeRank } from "@/lib/risk-engine";
import { personName, sessionEvents, sessionRound, TEST_MODES, trialRound, type LabKind, type LabState, type TrialRun } from "./model";
import { issueMetrics, issueRiskChange, issueStatus, maxShortfall, type Quality, type Span } from "./issues";
import { issueScenarioOf, keyRisks } from "./issueScenarios";

export interface Stat {
  n: number;
  median: number | null;
  min: number | null;
  max: number | null;
}

export function stat(values: (number | null)[]): Stat {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, median: null, min: null, max: null };
  const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return { n: v.length, median: Math.round(m * 10) / 10, min: v[0], max: v[v.length - 1] };
}

const accuracy = (t: TrialRun) => (t.expected && t.correct !== null ? Math.round((t.correct / t.expected) * 1000) / 10 : null);

const MEASURES: { measure: string; pick: (t: TrialRun) => number | null }[] = [
  { measure: "위험 발견 소요시간(초)", pick: (t) => t.t1Sec },
  { measure: "일정 조정 후 재판단 소요시간(초)", pick: (t) => t.t2Sec },
  { measure: "정확히 발견한 위험(건)", pick: (t) => t.correct },
  { measure: "놓친 위험(건)", pick: (t) => t.missed },
  { measure: "잘못 판단한 위험(건)", pick: (t) => t.wrong },
  { measure: "정확도(정답 위험 대비 %, 정답 수가 있을 때만)", pick: accuracy },
];

const KIND_SECTION: Record<LabKind, string> = { "실제 업무": "실측 결과", "사후 재현": "현장정보 재현 결과", "가상 시나리오": "가상 시나리오 결과" };

/** 현장 문제 보고 — 데이터 구분별로 따로 (실측·재현·가상을 섞지 않음). '추정' 값은 통계에서 빼고 따로 적는다 */
function issueSection(s: LabState) {
  const issues = (s.issues ?? []).filter((i) => !i.voided);
  const kindOf = (sid: string) => s.sessions.find((x) => x.id === sid)!.kind;
  const rows = issues.map((i) => {
    const x = s.sessions.find((o) => o.id === i.sessionId)!;
    const m = issueMetrics(s, i);
    const r = issueRiskChange(s, i);
    return {
      no: i.no,
      set: x.no,
      kind: x.kind,
      testMode: x.testMode ?? "미지정",
      scenario: x.scenarioId ? `${x.scenarioId} ${issueScenarioOf(x.scenarioId)?.name ?? ""}` : "",
      type: i.type,
      status: issueStatus(i),
      expectedEnd: i.expectedEnd,
      metrics: m,
      riskBefore: r.before?.risky ?? null,
      riskReported: r.reported?.risky ?? null,
      riskAfter: r.afterActions?.risky ?? null,
      delayReported: maxShortfall(r.reported),
      delayAfter: maxShortfall(r.afterActions),
    };
  });
  const SPAN_KEYS: Span["key"][] = ["발견→보고", "보고→접수", "보고→지원 결정", "지원 요청→해결"];
  const byKind = Object.fromEntries(
    (["실제 업무", "사후 재현", "가상 시나리오"] as LabKind[]).map((k) => {
      const mine = rows.filter((r) => r.kind === k);
      return [
        k,
        {
          section: KIND_SECTION[k],
          count: mine.length,
          resolved: mine.filter((r) => r.status === "해결").length,
          toEngine: mine.filter((r) => r.expectedEnd !== null).length,
          spans: SPAN_KEYS.map((key) => {
            const vals = mine.map((r) => r.metrics.find((x) => x.key === key)!).filter((x) => x.minutes !== null && x.quality !== "추정");
            const qualities: Partial<Record<Quality, number>> = {};
            for (const v of vals) qualities[v.quality!] = (qualities[v.quality!] ?? 0) + 1;
            return { key, label: mine[0]?.metrics.find((x) => x.key === key)?.label ?? key, stat: stat(vals.map((v) => v.minutes)), qualities, missing: mine.filter((r) => r.metrics.find((x) => x.key === key)!.minutes === null).length };
          }),
        },
      ];
    }),
  ) as Record<LabKind, { section: string; count: number; resolved: number; toEngine: number; spans: { key: Span["key"]; label: string; stat: Stat; qualities: Partial<Record<Quality, number>>; missing: number }[] }>;
  const estimates = rows.flatMap((r) => r.metrics.filter((m) => m.quality === "추정").map((m) => ({ no: r.no, kind: r.kind, key: m.key, label: m.label, minutes: m.minutes, quality: m.quality })));
  // 시나리오 정답 대비 — 정답표(손 계산)와 실제 엔진 결과
  const scenarios = s.sessions
    .filter((x) => x.scenarioId)
    .map((x) => {
      const sc = issueScenarioOf(x.scenarioId)!;
      const first = issues.find((i) => i.sessionId === x.id);
      const got = first ? (issueRiskChange(s, first).reported?.risky ?? null) : null;
      return { set: x.no, id: sc.id, name: sc.name, testMode: x.testMode ?? "미지정", expected: keyRisks(sc), got, outcomes: x.outcomes ?? [] };
    });
  return { total: issues.length, voided: (s.issues ?? []).length - issues.length, rows, byKind, estimates, scenarios, kindOf };
}

export function buildReport(s: LabState, now: Date) {
  const valid = s.trials.filter((t) => !t.voided);
  // 기억에 의한 추정 소요시간은 비교 통계에 넣지 않고 따로 적는다
  const trials = valid.filter((t) => t.valueBasis !== "기억 추정");
  const estimatedTrials = valid.filter((t) => t.valueBasis === "기억 추정");
  const voided = s.trials.length - valid.length;
  const usedSessions = s.sessions.filter((x) => sessionEvents(s, x.id).length > 0 || s.entries.some((e) => e.sessionId === x.id));
  const dates = [...valid.map((t) => t.date), ...usedSessions.map((x) => kst(x.createdAt).date)].sort();

  const kinds: Record<LabKind, number> = { "실제 업무": 0, "사후 재현": 0, "가상 시나리오": 0 };
  for (const x of usedSessions) kinds[x.kind]++;
  const eventsByKind: Record<LabKind, number> = { "실제 업무": 0, "사후 재현": 0, "가상 시나리오": 0 };
  for (const x of s.sessions) eventsByKind[x.kind] += sessionEvents(s, x.id).length;

  const people = s.people
    .map((p) => ({
      name: p.name,
      code: p.code,
      role: p.role,
      org: p.org,
      sessions: usedSessions.filter((x) => x.participantId === p.id).length,
      trials: valid.filter((t) => t.participantId === p.id).length,
      entered: s.entries.filter((e) => e.enteredBy === p.id).length,
      informed: s.entries.filter((e) => e.informantId === p.id).length,
      days: [...new Set(valid.filter((t) => t.participantId === p.id).map((t) => t.date))].sort(),
    }))
    .filter((p) => p.sessions + p.trials + p.entered + p.informed > 0);

  const manual = trials.filter((t) => t.method === "수기");
  const ax = trials.filter((t) => t.method === "AX");
  const rows = MEASURES.map((m) => {
    const a = stat(manual.map(m.pick));
    const b = stat(ax.map(m.pick));
    return { measure: m.measure, manual: a, ax: b, difference: a.median !== null && b.median !== null ? Math.round((b.median - a.median) * 10) / 10 : null };
  });
  const note =
    manual.length === 0 && ax.length === 0
      ? "비교시험 측정 기록이 없습니다."
      : manual.length === 0
        ? "수기 방식 측정이 없어 비교값을 내지 않습니다 (개선율을 만들지 않음)."
        : ax.length === 0
          ? "AX 방식 측정이 없어 비교값을 내지 않습니다."
          : `이번 시험 측정값 기준 (수기 n=${manual.length}, AX n=${ax.length}) · 중앙값 차이 = AX − 수기 · 통계적 유의성 검정 아님`;

  // 같은 참가자·같은 대응 묶음의 수기·AX 쌍
  const pairs: { participant: string; pairKey: string; manual: TrialRun[]; ax: TrialRun[] }[] = [];
  for (const t of trials) {
    if (!t.pairKey) continue;
    let p = pairs.find((x) => x.participant === t.participantId && x.pairKey === t.pairKey);
    if (!p) pairs.push((p = { participant: t.participantId, pairKey: t.pairKey, manual: [], ax: [] }));
    (t.method === "수기" ? p.manual : p.ax).push(t);
  }

  const judgedRisk = s.judgments.filter((j) => j.changes.some((c) => c.after && c.after.status === "판정" && gradeRank(c.after.grade) >= 2 && c.kind === "신규 위험"));
  const fieldBy = (k: LabKind) => ({
    sessions: kinds[k],
    events: eventsByKind[k],
    judgments: s.judgments.filter((j) => s.sessions.find((x) => x.id === j.sessionId)?.kind === k).length,
    newRisks: judgedRisk.filter((j) => s.sessions.find((x) => x.id === j.sessionId)?.kind === k).length,
  });

  const issues = issueSection(s);
  const testModes = Object.fromEntries(
    [...TEST_MODES, "미지정"].map((m) => [m, { sessions: usedSessions.filter((x) => (x.testMode ?? "미지정") === m).length, trials: valid.filter((t) => (t.testMode ?? "미지정") === m).length }]),
  ) as Record<string, { sessions: number; trials: number }>;
  const devLinks = s.notes.flatMap((n) => (n.devLinks ?? []).map((d) => ({ note: n.no, speaker: personName(s, n.speakerId), noteText: n.text, ...d })));

  const autoLimits = [
    `참가자 ${people.filter((p) => p.trials > 0).length}명 · 비교시험 ${trials.length}회 (무효 처리 ${voided}회 제외) — 표본이 작아 통계적 결론을 내지 않습니다.`,
    `현장 실증 세트: 실제 업무 ${kinds["실제 업무"]} · 사후 재현 ${kinds["사후 재현"]} · 가상 시나리오 ${kinds["가상 시나리오"]}`,
    kinds["실제 업무"] === 0 ? "실제 업무를 실시간으로 입력한 세트가 없습니다 — 사후 재현·가상 시나리오 결과는 실제 운영 효과가 아닙니다." : "",
    (() => {
      const told = s.entries.filter((e) => e.informantId);
      const proxy = told.filter((e) => e.enteredBy !== e.informantId).length;
      return told.length ? `정보 제공자가 있는 기록 ${told.length}건 중 ${proxy}건은 제공자가 아닌 사람이 전달받아 대신 입력했습니다 (기록마다 입력자·정보 제공자 구분).` : "";
    })(),
    issues.estimates.length || estimatedTrials.length ? `기억에 의한 추정 값 ${issues.estimates.length + estimatedTrials.length}건은 '추정'으로 따로 적고 비교 통계에서 뺐습니다.` : "",
    "가상 시나리오의 시각·작업시간·이동시간은 시험용 가정값입니다 — 실제 발생빈도·실제 지연·실제 개선효과가 아닙니다.",
    "기록은 한 브라우저에만 저장되었습니다 (중앙 DB 아님) — 백업 JSON 파일이 원자료입니다. PC+Mobile 동시 보기는 같은 브라우저 안의 시험 화면이며, 현장과 본사 사이 실시간 연동이 아닙니다.",
    "위험 점수·우선순위는 규칙 기반 관리자 판단 지원값이며 사고 확률이 아닙니다.",
  ].filter(Boolean);

  return {
    generatedAt: now.toISOString(),
    period: { from: dates[0] ?? null, to: dates.at(-1) ?? null, days: [...new Set(dates)].length },
    people,
    counts: {
      sessions: usedSessions.length,
      sessionsByKind: kinds,
      trials: trials.length,
      voidedTrials: voided,
      trialsByMethod: { 수기: manual.length, AX: ax.length },
      trialsByType: { "가상 시나리오": trials.filter((t) => t.scenarioType === "가상 시나리오").length, "실제 현장정보 재현": trials.filter((t) => t.scenarioType === "실제 현장정보 재현").length },
      estimatedTrials: estimatedTrials.length,
      testModes,
      issues: issues.total,
      events: s.entries.filter((e) => e.type === "event").length,
      judgments: s.judgments.length,
      notes: s.notes.length,
    },
    rounds: valid.map((t) => ({ no: t.no, date: t.date, participant: personName(s, t.participantId), round: trialRound(s, t), method: t.method, scenario: t.scenario })),
    sessionRounds: usedSessions.map((x) => ({ no: x.no, title: x.title, kind: x.kind, participant: personName(s, x.participantId), round: sessionRound(s, x) })),
    before: { text: s.report.before, manualTrials: manual.length },
    measured: { trials: trials.length, ax: ax.length, field: { "실제 업무": fieldBy("실제 업무"), "사후 재현": fieldBy("사후 재현"), "가상 시나리오": fieldBy("가상 시나리오") } },
    comparison: {
      rows,
      note,
      pairs: pairs
        .filter((p) => p.manual.length > 0 && p.ax.length > 0)
        .map((p) => ({ participant: personName(s, p.participant), pairKey: p.pairKey, manualT1: p.manual.map((t) => t.t1Sec), axT1: p.ax.map((t) => t.t1Sec), manualCorrect: p.manual.map((t) => t.correct), axCorrect: p.ax.map((t) => t.correct) })),
    },
    improvements: s.notes.filter((n) => n.type !== "참여자 피드백").map((n) => ({ no: n.no, type: n.type, text: n.text, status: n.status, confirmation: n.confirmation })),
    feedback: s.notes.filter((n) => n.type === "참여자 피드백").map((n) => ({ no: n.no, speaker: personName(s, n.speakerId), text: n.text, confirmation: n.confirmation, at: n.at })),
    trialIssues: valid.filter((t) => t.issues.trim()).map((t) => ({ no: t.no, text: t.issues })),
    devLinks,
    issues,
    estimatedTrials: estimatedTrials.map((t) => ({ no: t.no, method: t.method, scenario: t.scenario, t1Sec: t.t1Sec, t2Sec: t.t2Sec })),
    expected: { text: s.report.expected },
    limits: { auto: autoLimits, text: s.report.limits },
  };
}

export type Report = ReturnType<typeof buildReport>;

const fmt = (x: Stat) => (x.n === 0 ? "측정 없음" : `중앙값 ${x.median} (범위 ${x.min}~${x.max}, n=${x.n})`);

export function reportMarkdown(r: Report): string {
  const L: string[] = [];
  L.push(`# 복수 현장 업무 위험관리 AX 시스템 — 실증·전후 비교 결과 정리`, "");
  L.push(`> 자동 정리 ${kst(r.generatedAt).date} ${kst(r.generatedAt).time} · 이 브라우저에 저장된 실측 기록만 사용 · 측정하지 않은 값은 '측정 없음'`, "");
  L.push(`## ① 시험 기간·참가자·시험 횟수`, "");
  L.push(`- 기간: ${r.period.from ?? "기록 없음"} ~ ${r.period.to ?? "기록 없음"} (${r.period.days}일)`);
  L.push(`- 비교시험 ${r.counts.trials}회 (수기 ${r.counts.trialsByMethod.수기} · AX ${r.counts.trialsByMethod.AX} / 가상 시나리오 ${r.counts.trialsByType["가상 시나리오"]} · 실제 현장정보 재현 ${r.counts.trialsByType["실제 현장정보 재현"]}) · 무효 ${r.counts.voidedTrials}회 제외`);
  L.push(`- 현장 실증 세트 ${r.counts.sessions}개 (실제 업무 ${r.counts.sessionsByKind["실제 업무"]} · 사후 재현 ${r.counts.sessionsByKind["사후 재현"]} · 가상 시나리오 ${r.counts.sessionsByKind["가상 시나리오"]}) · 작업 기록 ${r.counts.events}건 · 위험 판단 ${r.counts.judgments}건`, "");
  L.push(`| 참가자 | 코드 | 역할 | 비교시험 | 시험한 날 | 실증 세트 | 직접 입력 | 정보 제공 |`, `|---|---|---|---|---|---|---|---|`);
  for (const p of r.people) L.push(`| ${p.name} | ${p.code} | ${p.role} | ${p.trials} | ${p.days.join(", ")} | ${p.sessions} | ${p.entered} | ${p.informed} |`);
  L.push("", `## ② 적용 전 업무방식과 문제점`, "", r.before.text || "(입력 필요 — 참여자 확인 내용만 적기)", "");
  L.push(`- 시험 방식: ${Object.entries(r.counts.testModes).map(([k, v]) => `${k} 세트 ${v.sessions}·측정 ${v.trials}`).join(" / ")}`, "");
  L.push(`## ③ AX 적용 후 결과 — 실측 · 현장정보 재현 · 가상 시나리오를 나눔`, "");
  L.push(`- AX 방식 비교시험 ${r.measured.ax}회`, "");
  for (const [k, v] of Object.entries(r.measured.field) as [keyof typeof r.measured.field, (typeof r.measured.field)[keyof typeof r.measured.field]][]) {
    const iss = r.issues.byKind[k];
    L.push(`### ③-${k === "실제 업무" ? 1 : k === "사후 재현" ? 2 : 3} ${iss.section} (${k})`, "");
    L.push(`- 세트 ${v.sessions} · 작업 기록 ${v.events} · 판단 ${v.judgments} · 프로그램이 새로 표시한 위험 ${v.newRisks}건 (계산값)`);
    L.push(`- 현장 문제 보고 ${iss.count}건 (예상 종료를 엔진에 전달 ${iss.toEngine}건 · 해결 ${iss.resolved}건)`);
    if (iss.count > 0) {
      L.push("", `| 소요시간(분) | 값 | 시각 근거 | 시각 모름 |`, `|---|---|---|---|`);
      for (const x of iss.spans) L.push(`| ${x.label} | ${fmt(x.stat)} | ${Object.entries(x.qualities).map(([q, c]) => `${q} ${c}`).join(", ") || "-"} | ${x.missing} |`);
    }
    L.push("");
  }
  if (r.issues.rows.length) {
    L.push(`#### 현장 문제별 관리자 조치 전후 (계산값)`, "", `| 문제 | 세트 | 구분 | 시험 방식 | 유형 | 상태 | 위험 연결 보고 전→보고 후→조치 후 | 최대 지연(분) 보고 후→조치 후 |`, `|---|---|---|---|---|---|---|---|`);
    for (const x of r.issues.rows) L.push(`| #${x.no} | ${x.set} | ${x.kind} | ${x.testMode} | ${x.type} | ${x.status} | ${x.riskBefore ?? "-"}→${x.riskReported ?? "-"}→${x.riskAfter ?? "-"} | ${x.delayReported ?? "-"}→${x.delayAfter ?? "-"} |`);
    L.push("");
  }
  if (r.issues.scenarios.length) {
    L.push(`#### 시험 시나리오 정답(손 계산) 대비 엔진 결과 — 예상과 달라도 그대로 기록`, "", `| 세트 | 시나리오 | 시험 방식 | 정답 위험 수 | 엔진 결과 | 예상 대비 기록 |`, `|---|---|---|---|---|---|`);
    for (const x of r.issues.scenarios) L.push(`| ${x.set} | ${x.id} ${x.name} | ${x.testMode} | ${x.expected ?? "-"} | ${x.got ?? "보고 없음"} | ${x.outcomes.map((o) => `${o.match}${o.text ? `: ${o.text}` : ""}`).join(" / ") || "-"} |`);
    L.push("");
  }
  if (r.issues.estimates.length || r.estimatedTrials.length) {
    L.push(`#### 추정 값 (기억에 의함 — 위 통계와 비교에 넣지 않음)`, "");
    for (const x of r.issues.estimates) L.push(`- 현장 문제 #${x.no} (${x.kind}) ${x.label}: ${x.minutes}분 (추정)`);
    for (const x of r.estimatedTrials) L.push(`- 비교시험 측정 #${x.no} (${x.method} · ${x.scenario}): 위험 발견 ${x.t1Sec ?? "-"}초 · 재판단 ${x.t2Sec ?? "-"}초 (추정)`);
    L.push("");
  }
  L.push("", `## ④ 위험 발견시간 및 정확도 비교 (수기 vs AX)`, "", `> ${r.comparison.note}`, "");
  L.push(`| 측정 | 수기 | AX | 중앙값 차이(AX−수기) |`, `|---|---|---|---|`);
  for (const x of r.comparison.rows) L.push(`| ${x.measure} | ${fmt(x.manual)} | ${fmt(x.ax)} | ${x.difference === null ? "-" : x.difference} |`);
  L.push("", `## ⑤ 실제 사용 중 발견한 개선사항`, "");
  if (r.improvements.length + r.trialIssues.length === 0) L.push("(기록 없음)");
  for (const n of r.improvements) L.push(`- [${n.type} · ${n.status} · ${n.confirmation}] ${n.text}`);
  for (const n of r.trialIssues) L.push(`- [시험 중 발견 · 측정 ${n.no}] ${n.text}`);
  L.push("", `### 참여자 피드백 (원문 · 확인 여부 그대로)`, "");
  if (r.feedback.length === 0) L.push("(기록 없음)");
  for (const f of r.feedback) L.push(`- ${f.speaker} (${f.confirmation}): ${f.text}`);
  L.push("", `### 의견으로 바뀐 요구사항·프로그램 (날짜·내용)`, "");
  if (r.devLinks.length === 0) L.push("(기록 없음)");
  for (const d of r.devLinks) L.push(`- ${d.date} ${d.kind}${d.version ? ` (버전 ${d.version})` : ""}: ${d.text} — 근거: 기록 #${d.note} ${d.speaker} "${d.noteText}"`);
  L.push("", `## ⑥ 향후 예상 효과와 계산 근거 (예상 — 이번 시험에서 측정한 값이 아님)`, "", r.expected.text || "(입력 필요 — 계산 근거와 가정을 함께 적기)", "");
  L.push(`## ⑦ 실증의 한계와 추가 검증계획`, "");
  for (const x of r.limits.auto) L.push(`- ${x}`);
  if (r.limits.text) L.push("", r.limits.text);
  return L.join("\n") + "\n";
}
