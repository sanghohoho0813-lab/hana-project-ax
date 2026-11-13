"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLab } from "@/lib/lab/store";
import { currentSchedules, judgeSession, personName, repeatNo, sessionRound, type Entry, type LabState, type Session } from "@/lib/lab/model";
import { issueMetrics, issueRiskChange, issueStatus, maxShortfall, momentText, sessionIssues, QUALITY_DESC } from "@/lib/lab/issues";
import { issueScenarioOf } from "@/lib/lab/issueScenarios";
import { APP_VERSION } from "@/lib/lab/version";
import { kst } from "@/lib/pilot/time";
import { LabAlerts } from "@/components/lab/LabAlerts";
import { JudgmentStory } from "@/components/lab/History";
import { IssueFlowView } from "@/components/lab/Issues";
import { KindBadge, btnPrimary, kstDT, useCurrentSession } from "@/components/lab/common";

/** 시험 1회(실증 세트 1개)의 증거 기록 — 시험번호·날짜 · 버전 · 원자료 · 입력값 · 엔진 처리 · 관리자 조치 · 전후 변화 · 측정 시간 · 발견 문제 · 피드백 */
export default function EvidencePage() {
  return (
    <Suspense fallback={null}>
      <Evidence />
    </Suspense>
  );
}

const h2 = "text-[19px] font-extrabold";
const th = "py-1 pr-2 text-left font-semibold whitespace-nowrap";
const td = "py-1 pr-2 align-top";

function Evidence() {
  const params = useSearchParams();
  const { state } = useLab();
  const [current, setCurrent] = useCurrentSession();
  if (!state) return <LabAlerts />;
  const session = state.sessions.find((x) => x.id === params.get("s")) ?? current;
  if (!session) return <p className="card px-4 py-4 text-[16.5px] text-ink-3">실증 세트가 없습니다.</p>;
  return (
    <div className="mx-auto max-w-[64rem] space-y-4">
      <LabAlerts />
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select
          aria-label="증거를 볼 세트"
          value={session.id}
          onChange={(e) => {
            setCurrent(e.target.value);
            window.history.replaceState(null, "", `/records/evidence?s=${e.target.value}`);
          }}
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-[16.5px] font-semibold"
        >
          {[...state.sessions].reverse().map((x) => (
            <option key={x.id} value={x.id}>
              세트 {x.no} · [{x.kind}] {x.title}
            </option>
          ))}
        </select>
        <button className={btnPrimary} onClick={() => window.print()}>
          인쇄 · PDF로 저장
        </button>
      </div>
      <Sheet s={state} x={session} />
    </div>
  );
}

function Sheet({ s, x }: { s: LabState; x: Session }) {
  const entries = s.entries.filter((e) => e.sessionId === x.id);
  const judgments = s.judgments.filter((j) => j.sessionId === x.id);
  const issues = sessionIssues(s, x.id);
  const titles = new Map(currentSchedules(s, x.id).map((o) => [o.id, o.siteName]));
  const versions = new Map<string, number>();
  for (const v of [...entries.map((e) => e.appVersion ?? "버전 기록 없음(이전 기록)"), ...issues.flatMap((i) => [i.appVersion ?? "버전 기록 없음", ...i.steps.map((o) => o.appVersion ?? "버전 기록 없음")])]) versions.set(v, (versions.get(v) ?? 0) + 1);
  const rules = [...new Set(judgments.map((j) => `${j.ruleVersion} · ${j.stateVersion} · ${j.priorityVersion}`))];
  const notes = s.notes.filter((n) => n.sessionId === x.id);
  const trials = s.trials.filter((t) => t.sessionId === x.id);
  const sc = issueScenarioOf(x.scenarioId);
  const now = judgeSession(s, x.id, new Date());
  const riskyNow = now.result.risk.links.filter((l) => l.status === "판정" && ["중간", "높음", "매우 높음"].includes(l.grade ?? "")).length;
  const adminSchedule = entries.filter((e) => e.type === "schedule" && e.changeKind !== "등록");

  return (
    <article className="card space-y-5 p-5" aria-label="시험 증거 기록">
      <header className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-[23px] font-extrabold">
          시험 증거 기록 — 세트 {x.no} <KindBadge kind={x.kind} big />
        </h1>
        <p className="text-[14.5px] text-ink-3">
          출력 {kstDT(new Date().toISOString())} · 이 브라우저에 저장된 기록만 사용 · 입력값 = 사람이 넣은 값, 계산값 = 기존 엔진이 계산한 값, 가정값 = 재현 기준시각·가상 시나리오 값
        </p>
      </header>

      <section className="space-y-1">
        <h2 className={h2}>1. 시험번호 · 날짜</h2>
        <p className="text-[16px]">
          세트 {x.no} · {x.title} · 현장 업무 날짜 {x.workDate} · 만든 날 {kst(x.createdAt).date} {kst(x.createdAt).time} ({sessionRound(s, x)}회차 · 반복 {repeatNo(s, x)}회) · 핵심 참여자 {personName(s, x.participantId)} · 만든 사람 {personName(s, x.createdBy)}
        </p>
        <p className="text-[16px]">
          시험 방식: <b className={x.testMode ? "" : "text-warning"}>{x.testMode ?? "미지정"}</b>
          {x.changes.length > 0 && <span className="text-ink-3"> (변경 {x.changes.map((c) => `${kst(c.at).date} ${c.from ?? "미지정"}→${c.to}`).join(", ")})</span>}
          {sc && ` · 시험 시나리오 ${sc.id} ${sc.name} (가상 · 시험용 가정값)`}
        </p>
      </section>

      <section className="space-y-1">
        <h2 className={h2}>2. 프로그램 버전</h2>
        <p className="text-[16px]">
          세트를 만든 버전 {x.appVersion ?? "기록 없음(이전 버전에서 만듦)"} · 기록에 남은 버전: {[...versions.entries()].map(([v, n]) => `${v} (${n}건)`).join(", ") || "기록 없음"} · 지금 화면 {APP_VERSION}
        </p>
        <p className="text-[15px] text-ink-3">판단 규칙: {rules.join(" / ") || "판단 기록 없음"} (엔진 변경 없음)</p>
      </section>

      <section className="space-y-1">
        <h2 className={h2}>3. 현장 문제 원자료 · 출처</h2>
        <p className="text-[16px]">
          세트 기본: 출처 {x.source}
          {x.sourceRef && ` · 원자료 ${x.sourceRef}`} · 정보 제공자 {personName(s, x.informantId)}
        </p>
        {issues.length === 0 ? (
          <p className="text-[15.5px] text-ink-3">현장 문제 보고 없음</p>
        ) : (
          <ul className="text-[15.5px]">
            {issues.map((i) => (
              <li key={i.id}>
                · #{i.no} {titles.get(i.scheduleId)} · {i.type} — 출처 {i.source}
                {i.sourceRef && ` (${i.sourceRef})`} · 정보 제공 {personName(s, i.informantId)} · 입력 {personName(s, i.enteredBy)} ({i.via}) · 발견 {momentText(i.discovered)} · 보고 {momentText(i.reported)}
                {i.request && ` · 요청 원문 "${i.request}"`}
                {i.voided && <b className="text-ink-3"> · 무효: {i.voided.reason}</b>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1">
        <h2 className={h2}>4. 입력값 ({entries.length}건 · 현장 문제 {issues.length}건)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[14.5px] tabular-nums">
            <thead className="text-ink-3">
              <tr>
                {["번호", "기록", "현장", "값", "실제 시각 (근거)", "입력자", "정보 제공", "출처", "프로그램 입력", "버전"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <EntryRow key={e.seq} s={s} e={e} site={titles.get(e.scheduleId) ?? ""} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-1.5">
        <h2 className={h2}>5. 엔진 처리 과정 · 결과 (판단 {judgments.length}건 · 기록 1건마다 판단 전→후)</h2>
        <p className="text-[15.5px]">
          지금 판단: 위험 연결 {riskyNow}건 (기준시각 {kst(now.asOf).time} · {now.asOfBasis})
        </p>
        <ol className="space-y-1.5">
          {judgments.map((j) => (
            <JudgmentStory key={j.seq} s={s} j={j} entry={s.entries.find((e) => e.seq === j.seq)} />
          ))}
        </ol>
      </section>

      <section className="space-y-1">
        <h2 className={h2}>6. 관리자 조치</h2>
        {issues.flatMap((i) => i.steps.map((o) => ({ i, o }))).length + adminSchedule.length === 0 && <p className="text-[15.5px] text-ink-3">기록 없음</p>}
        <ul className="text-[15.5px]">
          {issues.flatMap((i) =>
            i.steps.map((o) => (
              <li key={`${i.id}-${o.no}`}>
                · 문제 #{i.no} {o.kind}
                {o.action && ` — ${o.action}`}
                {o.resolution && ` — ${o.resolution}`}
                {o.text && ` · ${o.text}`} · 실제 {momentText(o.moment)} · 입력 {personName(s, o.enteredBy)} ({o.via}){o.linkedSeq !== null && ` · 기록 #${o.linkedSeq}`}
              </li>
            )),
          )}
          {adminSchedule.map((e) =>
            e.type === "schedule" ? (
              <li key={e.seq}>
                · 일정 {e.changeKind} #{e.seq}: {e.snapshot.siteName} {e.snapshot.plannedStart}~{e.snapshot.plannedEnd}
                {e.reason && ` · 사유 ${e.reason}`} · 입력 {personName(s, e.enteredBy)}
              </li>
            ) : null,
          )}
        </ul>
      </section>

      <section className="space-y-1.5">
        <h2 className={h2}>7. 조치 전후 변화 (계산값)</h2>
        {issues.length === 0 && <p className="text-[15.5px] text-ink-3">현장 문제 보고 없음 — 일정 조정의 판단 전후는 5번에 있습니다.</p>}
        {issues.map((i) => {
          const r = issueRiskChange(s, i);
          return (
            <div key={i.id} className="space-y-1 rounded-2xl border border-line p-3">
              <p className="text-[16px] font-bold">
                문제 #{i.no} ({issueStatus(i)}) — 위험 연결: 보고 전 {r.before?.risky ?? "-"} → 보고 후 {r.reported?.risky ?? "-"} → 관리자 조치 후 {r.afterActions?.risky ?? "-"} · 최대 지연: 보고 후 {maxShortfall(r.reported) ?? "-"}분 → 조치 후 {maxShortfall(r.afterActions) ?? "-"}분
              </p>
              <IssueFlowView s={s} issue={i} />
            </div>
          );
        })}
      </section>

      <section className="space-y-1">
        <h2 className={h2}>8. 실제 측정 시간</h2>
        {issues.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-[14.5px] tabular-nums">
              <thead className="text-ink-3">
                <tr>
                  <th className={th}>문제</th>
                  {issueMetrics(s, issues[0]).map((m) => (
                    <th key={m.key} className={th}>
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id} className="border-t border-line">
                    <td className={td}>#{i.no}</td>
                    {issueMetrics(s, i).map((m) => (
                      <td key={m.key} className={td}>
                        {m.minutes === null ? <span className="text-ink-3">{m.missing}</span> : `${m.minutes}분 (${m.quality})`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[13.5px] text-ink-3">
              {Object.entries(QUALITY_DESC)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </p>
          </div>
        )}
        {trials.length > 0 ? (
          <ul className="text-[15.5px]">
            {trials.map((t) => (
              <li key={t.id}>
                · 비교시험 측정 #{t.no} ({t.method} · {t.testMode ?? "방식 미지정"} · {t.valueBasis ?? "근거 미지정"}): 위험 발견 {t.t1Sec ?? "-"}초 · 정확 {t.correct ?? "-"}/{t.expected ?? "-"} · 재판단 {t.t2Sec ?? "-"}초 · {t.measureMethod}
                {t.voided && ` · 무효(${t.voided.reason})`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15.5px] text-ink-3">이 세트에 연결된 비교시험 측정 없음 (전후 비교시험에서 &lsquo;연결 실증 세트&rsquo;로 연결)</p>
        )}
      </section>

      <section className="space-y-1">
        <h2 className={h2}>9. 발견 문제 · 수정사항</h2>
        {notes.filter((n) => n.type !== "참여자 피드백").length + trials.filter((t) => t.issues.trim()).length === 0 && <p className="text-[15.5px] text-ink-3">기록 없음</p>}
        <ul className="text-[15.5px]">
          {notes
            .filter((n) => n.type !== "참여자 피드백")
            .map((n) => (
              <li key={n.id}>
                · [{n.type} · {n.status}] {n.text}
                {n.devLinks.map((d, k) => (
                  <span key={k} className="block pl-4 text-primary-dark">
                    → {d.date} {d.kind}: {d.text} {d.version && `(버전 ${d.version})`}
                  </span>
                ))}
              </li>
            ))}
          {trials
            .filter((t) => t.issues.trim())
            .map((t) => (
              <li key={t.id}>· [측정 #{t.no}] {t.issues}</li>
            ))}
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className={h2}>10. 참여자 실제 피드백</h2>
        {notes.filter((n) => n.type === "참여자 피드백").length === 0 && <p className="text-[15.5px] text-ink-3">기록 없음 (전후 비교시험 화면의 &lsquo;문제·피드백&rsquo;에서 관련 세트를 골라 기록)</p>}
        <ul className="text-[15.5px]">
          {notes
            .filter((n) => n.type === "참여자 피드백")
            .map((n) => (
              <li key={n.id}>
                · {personName(s, n.speakerId)} ({n.confirmation} · {kst(n.at).date}): &ldquo;{n.text}&rdquo;
                {n.devLinks.map((d, k) => (
                  <span key={k} className="block pl-4 text-primary-dark">
                    → {d.date} {d.kind}: {d.text} {d.version && `(버전 ${d.version})`}
                  </span>
                ))}
              </li>
            ))}
        </ul>
      </section>

      {(sc || x.outcomes.length > 0) && (
        <section className="space-y-1">
          <h2 className={h2}>11. 예상 대비 결과 (예상과 달라도 그대로 기록)</h2>
          {sc && (
            <ul className="text-[15.5px]">
              {sc.answer.map((a) => (
                <li key={a.label}>
                  · 정답(손 계산) {a.label}: 위험 연결 {a.risks}건 · A→B {a.links["A>B"]} · B→C {a.links["B>C"]}
                </li>
              ))}
              <li className="font-semibold">
                · 엔진 결과: 보고 직후 위험 연결 {issues[0] ? (issueRiskChange(s, issues[0]).reported?.risky ?? "엔진 전달 없음") : "보고 없음"} · 지금 위험 연결 {riskyNow}건
              </li>
            </ul>
          )}
          {x.outcomes.length === 0 && <p className="text-[15.5px] text-ink-3">예상 대비 기록 없음 (현장 실증 화면 세트 정보에서 기록)</p>}
          <ul className="text-[15.5px]">
            {x.outcomes.map((o, k) => (
              <li key={k}>
                · {o.match}
                {o.text && ` — ${o.text}`} ({personName(s, o.by)} · {kstDT(o.at)} · {o.appVersion ?? "버전 기록 없음"})
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function EntryRow({ s, e, site }: { s: LabState; e: Entry; site: string }) {
  const issue = e.type === "event" && e.issueId ? s.issues.find((i) => i.id === e.issueId) : undefined;
  return (
    <tr className="border-t border-line">
      <td className={td}>{e.seq}</td>
      <td className={`${td} font-semibold`}>
        {e.type === "schedule" ? `일정 ${e.changeKind}` : e.kind}
        {issue && <span className="block text-[13px] font-normal text-danger">현장 문제 #{issue.no}에서</span>}
      </td>
      <td className={td}>{site}</td>
      <td className={td}>{e.type === "schedule" ? `${e.snapshot.plannedStart}~${e.snapshot.plannedEnd}${e.snapshot.travelMinutes !== null ? ` · 이동 ${e.snapshot.travelMinutes}분` : ""}` : (e.expectedEnd ?? (e.voidsSeq !== null ? `#${e.voidsSeq} 대체` : ""))}</td>
      <td className={td}>{e.type === "event" ? `${e.occurredAt ? kst(e.occurredAt).time : "모름"} (${e.timeBasis})` : "-"}</td>
      <td className={td}>{personName(s, e.enteredBy)}</td>
      <td className={td}>{personName(s, e.informantId)}</td>
      <td className={td}>
        {e.source}
        {e.sourceRef && <span className="block text-[13px] text-ink-3">{e.sourceRef}</span>}
      </td>
      <td className={`${td} whitespace-nowrap`}>{kst(e.enteredAt).seconds}</td>
      <td className={td}>{e.appVersion ?? "-"}</td>
    </tr>
  );
}
