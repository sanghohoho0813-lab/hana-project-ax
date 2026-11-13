"use client";

import { useState } from "react";
import { AlertTriangle, CopyPlus, FolderPlus, Upload } from "lucide-react";
import {
  addOutcome,
  createSession,
  currentSchedules,
  KIND_DESC,
  LAB_KINDS,
  OUTCOME_MATCH,
  personName,
  repeatNo,
  repeatSession,
  sessionRound,
  setClock,
  setTestMode,
  SOURCES,
  TEST_MODES,
  type LabKind,
  type LabState,
  type Session,
  type TestMode,
} from "@/lib/lab/model";
import { loadTrialScenario, TRIAL_SCENARIOS } from "@/lib/lab/trialData";
import { ISSUE_SCENARIOS, issueScenarioOf, loadIssueScenario } from "@/lib/lab/issueScenarios";
import { kst } from "@/lib/pilot/time";
import { useOperator } from "./LabShell";
import { KindBadge, MsgBox, btnGhost, btnPrimary, inputSm, labelSm, sessionLabel, useAct, useCurrentSession } from "./common";

/** 실증 세트(회차) — 고르기 · 새로 만들기 · 같은 일정으로 반복 · 비교시험 시나리오 불러오기 · 재현 기준시각 */
export function SessionBar({ compact = false }: { compact?: boolean }) {
  const [session, setSession, state] = useCurrentSession();
  const op = useOperator();
  const { msg, act } = useAct();
  const [panel, setPanel] = useState<"none" | "new" | "trial" | "issue">("none");
  if (!state) return null;

  if (compact) {
    return session ? (
      <div className="card space-y-1 px-3.5 py-2.5">
        <p className="flex items-center gap-2">
          <KindBadge kind={session.kind} />
          <span className="min-w-0 flex-1 truncate text-[16px] font-bold">
            세트 {session.no} · {session.title}
          </span>
        </p>
        <p className="text-[14.5px] text-ink-3">
          현장 업무 {session.workDate}
          {session.clock ? ` · 판단 기준 ${session.clock} (가정값)` : " · 판단 기준 지금"}
          {session.testMode && ` · ${session.testMode}`}
        </p>
        {session.scenarioId && <ScenarioCard id={session.scenarioId} compact />}
      </div>
    ) : (
      <p className="card px-4 py-3 text-[16.5px] text-ink-3">실증 세트가 없습니다. PC 화면의 &lsquo;새 세트&rsquo;에서 먼저 만드세요.</p>
    );
  }

  return (
    <section className="card space-y-3 p-4" aria-label="실증 세트">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[17px] font-bold text-ink-2">실증 세트</span>
        {state.sessions.length > 0 ? (
          <select
            aria-label="실증 세트 고르기"
            value={session?.id ?? ""}
            onChange={(e) => setSession(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-[17px] font-semibold"
          >
            {[...state.sessions].reverse().map((x) => (
              <option key={x.id} value={x.id}>
                [{x.kind}] {sessionLabel(state, x)}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex-1 text-[16.5px] text-ink-3">아직 없습니다 — 새 세트를 만드세요.</span>
        )}
        <button className={btnPrimary} onClick={() => setPanel(panel === "new" ? "none" : "new")}>
          <FolderPlus size={18} /> 새 세트
        </button>
        {session && (
          <button
            className={btnGhost}
            onClick={() => {
              const id = session.scenarioId
                ? act((s, c) => {
                    const r = loadIssueScenario(s, session.scenarioId!, op, session.participantId, c, { testMode: session.testMode, basedOn: session.basedOn ?? session.id });
                    return { state: r.state, value: r.sessionId };
                  }, "같은 현장 문제 시나리오로 반복 회차를 만들었습니다 (시작 상태부터).")
                : act((s, c) => {
                    const r = repeatSession(s, session.id, op, c);
                    return { state: r.state, value: r.id };
                  }, "같은 일정으로 반복 회차를 만들었습니다 (작업 기록은 비어 있음).");
              if (id) setSession(id);
            }}
          >
            <CopyPlus size={18} /> {session.scenarioId ? "같은 시나리오로 반복" : "같은 일정으로 반복"}
          </button>
        )}
        <button className={btnGhost} onClick={() => setPanel(panel === "trial" ? "none" : "trial")}>
          <Upload size={18} /> 비교시험 시나리오 불러오기
        </button>
        <button className={btnGhost} onClick={() => setPanel(panel === "issue" ? "none" : "issue")}>
          <AlertTriangle size={18} /> 현장 문제 시나리오
        </button>
      </div>

      {session && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15.5px] text-ink-2">
          <KindBadge kind={session.kind} big />
          <span>현장 업무 날짜 {session.workDate}</span>
          <span>핵심 참여자 {personName(state, session.participantId)}</span>
          <span>
            {kst(session.createdAt).date} {sessionRound(state, session)}회차 · 반복 {repeatNo(state, session)}회
          </span>
          <span>
            출처 {session.source}
            {session.sourceRef && ` (${session.sourceRef})`}
          </span>
          <span>일정 {currentSchedules(state, session.id).length}건</span>
          <label className="inline-flex items-center gap-1.5">
            시험 방식
            <select
              aria-label="시험 방식"
              value={session.testMode ?? ""}
              onChange={(e) => e.target.value && act((s, c) => ({ state: setTestMode(s, session.id, e.target.value as TestMode, op, c), value: null }), `시험 방식을 '${e.target.value}'(으)로 기록했습니다 (변경 이력 남음).`)}
              className={`rounded-lg border bg-white px-2 py-1 text-[15.5px] ${session.testMode ? "border-line" : "border-warning font-bold text-warning"}`}
            >
              <option value="" disabled>
                미지정 — 고르세요
              </option>
              {TEST_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {session.kind === "실제 업무" ? (
            <span className="font-semibold text-[#1b64da]">판단 기준: 실제 현재 시각</span>
          ) : (
            <label className="inline-flex items-center gap-1.5 font-semibold text-[#8a4b00]">
              재현 기준시각(가정값)
              <input
                type="time"
                aria-label="재현 기준시각"
                defaultValue={session.clock ?? ""}
                key={session.clock}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v && v !== session.clock) act((s, c) => ({ state: setClock(s, session.id, v, op, c), value: null }), `재현 기준시각을 ${v}로 바꿨습니다.`);
                }}
                className="rounded-lg border border-line bg-white px-2 py-1 text-[16px]"
              />
            </label>
          )}
        </div>
      )}
      <MsgBox msg={msg} />
      {session?.scenarioId && <ScenarioCard id={session.scenarioId} />}
      {session && (session.scenarioId || session.outcomes.length > 0) && <Outcomes s={state} session={session} />}

      {panel === "new" && <NewSession onDone={(id) => (setSession(id), setPanel("none"))} />}
      {panel === "issue" && (
        <div className="space-y-2 rounded-2xl border border-line p-3">
          <p className="text-[15.5px] text-ink-2">
            2026-11-13 구본석 이사 인터뷰의 문제 유형을 바탕으로 만든 <b>가상 시나리오</b>입니다. 일정 A·B·C와 A현장 작업 시작(09:00)까지만 들어가고, 문제 보고·관리자 조치는 참여자가 화면에서 직접 입력합니다. 시각·작업시간·이동시간은 시험용 가정값입니다 (실제 발생빈도·실제 효과 아님).
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {ISSUE_SCENARIOS.map((t) => (
              <button
                key={t.id}
                className={btnGhost}
                onClick={() => {
                  const id = act((s, c) => {
                    const r = loadIssueScenario(s, t.id, op, session?.participantId ?? "p-koo", c, { testMode: null });
                    return { state: r.state, value: r.sessionId };
                  }, `현장 문제 시나리오 ${t.id} ${t.name}를 가상 시나리오 세트로 불러왔습니다 — 시험 방식을 고르세요.`);
                  if (id) {
                    setSession(id);
                    setPanel("none");
                  }
                }}
              >
                {t.id} {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {panel === "trial" && (
        <div className="rounded-2xl border border-line p-3">
          <p className="mb-2 text-[15.5px] text-ink-2">
            기존 비교시험(trial/)의 고정 시나리오를 <b>가상 시나리오</b> 세트로 불러옵니다. AX 방식 시험을 이 화면에서 풀 때 씁니다. 정답은 보이지 않습니다.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TRIAL_SCENARIOS.map((t) => (
              <button
                key={t.id}
                className={btnGhost}
                onClick={() => {
                  const id = act((s, c) => {
                    const r = loadTrialScenario(s, t.id, op, session?.participantId ?? "p-koo", c);
                    return { state: r.state, value: r.sessionId };
                  }, `비교시험 ${t.id} 시나리오를 가상 시나리오 세트로 불러왔습니다 (기준시각 ${t.asOf}).`);
                  if (id) {
                    setSession(id);
                    setPanel("none");
                  }
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NewSession({ onDone }: { onDone: (id: string) => void }) {
  const [, , state] = useCurrentSession();
  const op = useOperator();
  const { msg, act } = useAct();
  const today = kst(new Date()).date;
  const [kind, setKind] = useState<LabKind>("사후 재현");
  const [mode, setMode] = useState<TestMode | null>(null);
  if (!state) return null;
  const people = state.people.filter((p) => p.role !== "시험용 가상 기사");
  return (
    <form
      className="space-y-3 rounded-2xl border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const g = (k: string) => String(f.get(k) ?? "");
        const id = act(
          (s, c) => {
            const r = createSession(
              s,
              {
                title: g("title"),
                kind,
                workDate: g("workDate"),
                participantId: g("participantId"),
                informantId: g("informantId") || null,
                source: g("source"),
                sourceRef: g("sourceRef"),
                clock: g("clock") || null,
                note: g("note"),
                createdBy: op,
                testMode: mode,
              },
              c,
            );
            return { state: r.state, value: r.id };
          },
          "새 세트를 만들었습니다.",
        );
        if (id) onDone(id);
      }}
    >
      <div role="radiogroup" aria-label="데이터 구분" className="grid gap-2 sm:grid-cols-3">
        {LAB_KINDS.map((k) => (
          <button
            type="button"
            key={k}
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-2xl border-2 px-3 py-2.5 text-left ${kind === k ? "border-primary bg-primary-light" : "border-line bg-white"}`}
          >
            <KindBadge kind={k} big />
            <span className="mt-1 block text-[14.5px] text-ink-2">{KIND_DESC[k]}</span>
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="시험 방식" className="flex flex-wrap items-center gap-1.5">
        <span className="text-[15.5px] font-semibold text-ink-2">시험 방식</span>
        {TEST_MODES.map((m) => (
          <button type="button" key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-xl px-3 py-2 text-[15.5px] font-bold ${mode === m ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelSm}>세트 이름</span>
          <input name="title" placeholder="예: 11/12 구본석 이사 현장 일정" className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>현장 업무 날짜</span>
          <input name="workDate" type="date" required defaultValue={today} className={inputSm} key={kind} readOnly={kind === "실제 업무"} />
        </label>
        <label>
          <span className={labelSm}>핵심 참여자</span>
          <select name="participantId" defaultValue="p-koo" className={inputSm}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelSm}>기본 정보 제공자</span>
          <select name="informantId" defaultValue={kind === "가상 시나리오" ? "" : "p-koo"} key={`i${kind}`} className={inputSm}>
            <option value="">없음 (가상)</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelSm}>기본 자료 출처</span>
          <select name="source" defaultValue={kind === "실제 업무" ? SOURCES[0] : kind === "가상 시나리오" ? "가상 시나리오" : SOURCES[1]} key={`s${kind}`} className={inputSm}>
            {SOURCES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelSm}>원자료 (업무일지·일정표 이름·위치)</span>
          <input name="sourceRef" placeholder="예: 업무일지 11/12 p.3" className={inputSm} />
        </label>
        {kind !== "실제 업무" && (
          <label>
            <span className={labelSm}>재현 기준시각 (가정값)</span>
            <input name="clock" type="time" required className={inputSm} />
          </label>
        )}
        <label>
          <span className={labelSm}>메모</span>
          <input name="note" className={inputSm} />
        </label>
      </div>
      {kind !== "실제 업무" && <p className="text-[14.5px] text-ink-3">재현 기준시각: 위험 판단을 이 시각에 본 것으로 계산합니다 (가정값). 실제 시각을 넣어 기록하면 그 시각으로 자동으로 옮겨집니다.</p>}
      <MsgBox msg={msg} />
      <button className={btnPrimary}>세트 만들기</button>
    </form>
  );
}

/** 현장 문제 시나리오 카드 — 참여자가 입력할 상황. 정답은 진행요원이 눌러야 보인다 */
function ScenarioCard({ id, compact = false }: { id: string; compact?: boolean }) {
  const sc = issueScenarioOf(id);
  const [open, setOpen] = useState(!compact);
  const [answer, setAnswer] = useState(false);
  if (!sc) return null;
  return (
    <div className={`rounded-2xl border-2 border-dashed border-[#7c3aed]/40 bg-[#faf7ff] ${compact ? "px-3 py-2" : "px-4 py-3"}`} aria-label="시나리오 카드">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full text-left text-[15.5px] font-extrabold text-[#5b21b6]">
        시나리오 카드 {sc.id} · {sc.name} (가상 · 시험용 가정값) {open ? "▲" : "▼"}
      </button>
      {open && (
        <>
          <ol className="mt-1 space-y-0.5 text-[15px] text-ink-2">
            {sc.card.map((l) => (
              <li key={l}>· {l}</li>
            ))}
          </ol>
          {!compact && (
            <>
              <p className="mt-1 text-[13.5px] text-ink-3">근거: {sc.basis}</p>
              <button onClick={() => setAnswer((v) => !v)} className="mt-1 text-[14.5px] font-bold text-[#5b21b6] underline">
                {answer ? "정답 숨기기" : "정답 보기 (진행요원)"}
              </button>
              {answer && (
                <ul className="mt-1 space-y-0.5 text-[14.5px]">
                  {sc.answer.map((a) => (
                    <li key={a.label}>
                      <b>{a.label}</b>: 위험 연결 {a.risks}건 · A→B {a.links["A>B"]} · B→C {a.links["B>C"]}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** 이번 회차 결과가 예상(정답표)과 같았는지 — 달라도 지우지 않고 남긴다 */
function Outcomes({ s, session }: { s: LabState; session: Session }) {
  const op = useOperator();
  const { msg, act } = useAct();
  const [text, setText] = useState("");
  return (
    <div className="space-y-1.5 rounded-2xl bg-[#f7f8fa] px-3.5 py-2.5" aria-label="예상 대비 결과">
      <p className="text-[15.5px] font-bold">이번 회차 결과가 예상과 같았나요? (예상과 달라도 그대로 남깁니다)</p>
      {session.outcomes.map((o, i) => (
        <p key={i} className="text-[14.5px] text-ink-2">
          · {o.match}
          {o.text && ` — ${o.text}`} <span className="text-ink-3">({personName(s, o.by)} · {kst(o.at).time} · {o.appVersion ?? "버전 기록 없음"})</span>
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="달랐다면 어떻게 달랐는지" aria-label="예상과 다른 내용" className="min-w-[12rem] flex-1 rounded-xl border border-line bg-white px-3 py-2 text-[16px]" />
        {OUTCOME_MATCH.map((m) => (
          <button
            key={m}
            className="rounded-xl bg-white px-3 py-2 text-[15px] font-bold text-ink-2 shadow-[var(--shadow-card)]"
            onClick={() => {
              const ok = act((st, c) => ({ state: addOutcome(st, session.id, { match: m, text }, op, c), value: true }), `'${m}'으로 기록했습니다.`);
              if (ok) setText("");
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <MsgBox msg={msg} />
    </div>
  );
}
