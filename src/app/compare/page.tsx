"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, Timer } from "lucide-react";
import { useLab } from "@/lib/lab/store";
import {
  addNote,
  addTrial,
  CONFIRMATION,
  editNote,
  editTrial,
  FOLLOW_UP,
  MEASURE_METHODS,
  NOTE_TYPES,
  personName,
  SCENARIO_TYPES,
  trialRound,
  trialValues,
  voidTrial,
  type LabState,
  type Note,
  type NoteValues,
  type TrialValues,
} from "@/lib/lab/model";
import { pairKeyOf, TRIAL_SCENARIOS } from "@/lib/lab/trialData";
import { buildReport } from "@/lib/lab/report";
import { kst } from "@/lib/pilot/time";
import { LabAlerts } from "@/components/lab/LabAlerts";
import { useOperator } from "@/components/lab/LabShell";
import { MsgBox, btnGhost, btnPrimary, inputSm, labelSm, useAct, type Msg } from "@/components/lab/common";

export default function ComparePage() {
  const { state } = useLab();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [notice, setNotice] = useState<Msg>(null);
  const done = (text?: string) => {
    setEditing(null);
    if (text) setNotice({ ok: true, text });
  };
  if (!state) return <LabAlerts />;
  const active = state.trials.filter((t) => !t.voided);
  return (
    <div className="space-y-4">
      <LabAlerts />
      <section className="card space-y-1.5 p-4 text-[16px] text-ink-2">
        <h2 className="text-[20px] font-extrabold text-ink">기존 방식(전화·메신저·수기 일정확인) vs AX 시스템 — 같은 수준의 시나리오로 잰다</h2>
        <p>
          측정 기준은 비교시험 계획서(<code>trial/TRIAL_PLAN.md</code> 5장)를 그대로 씁니다: ① 위험 발견 소요시간 ② 정확히 발견한 위험 ③ 후속 현장 영향 파악 ④ 일정 조정 후 재판단 소요시간. 가상 시나리오(A1~B5)는 정답표가 시험 전에 고정돼 있습니다.
        </p>
        <p className="text-ink-3">측정하지 않은 값은 비워 둡니다 — 개선율은 수기·AX 실측이 모두 있을 때만, 이번 시험 측정값으로만 계산합니다.</p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[21px] font-extrabold">
          측정 기록 <span className="text-[16px] font-semibold text-ink-3">{active.length}회 (무효 {state.trials.length - active.length})</span>
        </h2>
        <button className={btnPrimary} onClick={() => setEditing(editing === "new" ? null : "new")}>
          <Timer size={18} /> 새 측정 기록
        </button>
      </div>
      <MsgBox msg={notice} />
      {editing === "new" && <MeasureForm s={state} onDone={done} />}
      <TrialTable s={state} editing={editing} setEditing={setEditing} onDone={done} />
      <Comparison s={state} />
      <Notes s={state} />
    </div>
  );
}

/* ── 측정 입력 ─────────────────────────────────────── */

const blank = (op: string, participant: string): TrialValues => ({
  date: kst(new Date()).date,
  participantId: participant,
  operatorId: op,
  method: "수기",
  scenarioType: "가상 시나리오",
  scenario: "",
  pairKey: "",
  t1Sec: null,
  t2Sec: null,
  t1Timeout: false,
  t2Timeout: false,
  stamps: {},
  correct: null,
  expected: null,
  missed: null,
  missedNote: "",
  wrong: null,
  wrongNote: "",
  followUp: null,
  followUpNote: "",
  measureMethod: "앱 측정기",
  rawRef: "",
  issues: "",
  confirmedByParticipant: false,
  note: "",
});

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function MeasureForm({ s, initialId, onDone }: { s: LabState; initialId?: string; onDone: (text?: string) => void }) {
  const op = useOperator();
  const init = initialId ? s.trials.find((t) => t.id === initialId) : undefined;
  const [v, setV] = useState<TrialValues>(init ? trialValues(init) : blank(op, "p-koo"));
  const { msg, act } = useAct();
  const set = (p: Partial<TrialValues>) => setV((x) => ({ ...x, ...p }));
  const people = s.people.filter((p) => p.role !== "시험용 가상 기사");
  const trial = TRIAL_SCENARIOS.find((t) => t.id === v.scenario);

  return (
    <section className="card space-y-3 p-4" aria-label="측정 입력">
      <h3 className="text-[19px] font-extrabold">{init ? `측정 #${init.no} 고치기 (이전 값은 이력으로 남음)` : "새 측정 기록"}</h3>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelSm}>시험 날짜</span>
          <input type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>참가자</span>
          <select value={v.participantId} onChange={(e) => set({ participantId: e.target.value })} className={inputSm}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.code && `(${p.code})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelSm}>실제 입력자(진행자)</span>
          <select value={v.operatorId} onChange={(e) => set({ operatorId: e.target.value })} className={inputSm}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className={labelSm}>시험 유형</span>
          <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="시험 유형">
            {(["수기", "AX"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={v.method === m} onClick={() => set({ method: m })} className={`rounded-xl py-2 text-[17px] font-extrabold ${v.method === m ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
                {m === "수기" ? "수기 (기존 방식)" : "AX 시스템"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={labelSm}>시나리오 구분</span>
          <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="시나리오 구분">
            {SCENARIO_TYPES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={v.scenarioType === m} onClick={() => set({ scenarioType: m })} className={`rounded-xl px-1 py-2 text-[15px] font-bold ${v.scenarioType === m ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className={labelSm}>시나리오</span>
          <input
            list="scenario-options"
            value={v.scenario}
            onChange={(e) => {
              const sc = e.target.value;
              set({ scenario: sc, pairKey: pairKeyOf(sc) || v.pairKey, scenarioType: TRIAL_SCENARIOS.some((t) => t.id === sc) ? "가상 시나리오" : v.scenarioType });
            }}
            placeholder="A1~B5 또는 세트 이름"
            className={inputSm}
          />
          <datalist id="scenario-options">
            {TRIAL_SCENARIOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
            {s.sessions.map((x) => (
              <option key={x.id} value={`세트 ${x.no}`}>
                {x.title} ({x.kind})
              </option>
            ))}
          </datalist>
        </label>
        <label>
          <span className={labelSm}>대응 묶음 (같은 묶음의 수기·AX를 비교)</span>
          <input value={v.pairKey} onChange={(e) => set({ pairKey: e.target.value })} placeholder="예: 비교시험 쌍 1" className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>측정 방법</span>
          <select value={v.measureMethod} onChange={(e) => set({ measureMethod: e.target.value })} className={inputSm}>
            {MEASURE_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <Stopwatch stamps={v.stamps} onStamps={(st, t1, t2) => set({ stamps: st, t1Sec: t1 ?? v.t1Sec, t2Sec: t2 ?? v.t2Sec, measureMethod: "앱 측정기" })} />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelSm}>① 위험 발견 소요시간(초)</span>
          <input inputMode="numeric" value={v.t1Sec ?? ""} onChange={(e) => set({ t1Sec: num(e.target.value) })} className={inputSm} aria-label="위험 발견 소요시간(초)" />
        </label>
        <label>
          <span className={labelSm}>② 정확히 발견한 위험(건)</span>
          <input inputMode="numeric" value={v.correct ?? ""} onChange={(e) => set({ correct: num(e.target.value) })} className={inputSm} aria-label="정확히 발견한 위험" />
        </label>
        <label>
          <span className={labelSm}>놓친 위험(건)</span>
          <input inputMode="numeric" value={v.missed ?? ""} onChange={(e) => set({ missed: num(e.target.value) })} className={inputSm} aria-label="놓친 위험" />
        </label>
        <label>
          <span className={labelSm}>잘못 판단한 위험(건)</span>
          <input inputMode="numeric" value={v.wrong ?? ""} onChange={(e) => set({ wrong: num(e.target.value) })} className={inputSm} aria-label="잘못 판단한 위험" />
        </label>
        <label className="sm:col-span-2">
          <span className={labelSm}>놓친 위험 내용</span>
          <input value={v.missedNote} onChange={(e) => set({ missedNote: e.target.value })} className={inputSm} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelSm}>잘못 판단한 위험 내용</span>
          <input value={v.wrongNote} onChange={(e) => set({ wrongNote: e.target.value })} className={inputSm} />
        </label>
        <div className="sm:col-span-2">
          <span className={labelSm}>③ 후속 현장 영향 파악</span>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="후속 현장 영향 파악">
            {FOLLOW_UP.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={v.followUp === m} onClick={() => set({ followUp: v.followUp === m ? null : m })} className={`rounded-xl py-2 text-[15.5px] font-bold ${v.followUp === m ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <label className="sm:col-span-2">
          <span className={labelSm}>후속 현장 영향 내용</span>
          <input value={v.followUpNote} onChange={(e) => set({ followUpNote: e.target.value })} className={inputSm} />
        </label>
        <label>
          <span className={labelSm}>④ 일정 조정 후 재판단 소요시간(초)</span>
          <input inputMode="numeric" value={v.t2Sec ?? ""} onChange={(e) => set({ t2Sec: num(e.target.value) })} className={inputSm} aria-label="재판단 소요시간(초)" />
        </label>
        <label className="flex items-center gap-2 pt-6 text-[16px] font-semibold">
          <input type="checkbox" checked={v.t1Timeout} onChange={(e) => set({ t1Timeout: e.target.checked })} className="h-5 w-5" /> 1부 시간 초과
        </label>
        <label className="flex items-center gap-2 pt-6 text-[16px] font-semibold">
          <input type="checkbox" checked={v.t2Timeout} onChange={(e) => set({ t2Timeout: e.target.checked })} className="h-5 w-5" /> 2부 시간 초과
        </label>
        <div>
          <span className={labelSm}>정답 위험 수 (진행요원)</span>
          <div className="flex gap-1">
            <input inputMode="numeric" value={v.expected ?? ""} onChange={(e) => set({ expected: num(e.target.value) })} className={inputSm} aria-label="정답 위험 수" />
            {trial && (
              <button type="button" className="shrink-0 rounded-xl bg-[#f2f4f6] px-2 text-[14px] font-bold" onClick={() => set({ expected: trial.risks })}>
                정답표 값
              </button>
            )}
          </div>
        </div>
        <label className="sm:col-span-2">
          <span className={labelSm}>원자료 (기록지 번호·파일 이름)</span>
          <input value={v.rawRef} onChange={(e) => set({ rawRef: e.target.value })} className={inputSm} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelSm}>시험 중 발견된 오류·수정사항</span>
          <input value={v.issues} onChange={(e) => set({ issues: e.target.value })} className={inputSm} />
        </label>
        <label className="flex items-center gap-2 text-[16px] font-semibold sm:col-span-2">
          <input type="checkbox" checked={v.confirmedByParticipant} onChange={(e) => set({ confirmedByParticipant: e.target.checked })} className="h-5 w-5" /> 참여자가 이 결과를 직접 확인함
        </label>
        <label className="sm:col-span-2">
          <span className={labelSm}>비고</span>
          <input value={v.note} onChange={(e) => set({ note: e.target.value })} className={inputSm} />
        </label>
      </div>
      <MsgBox msg={msg} />
      <div className="flex gap-2">
        <button
          className={btnPrimary}
          onClick={() => {
            const text = init ? `측정 #${init.no}을 고쳤습니다 (이전 값은 이력에 남음).` : "측정 기록을 저장했습니다.";
            const ok = init
              ? act((st, c) => ({ state: editTrial(st, init.id, v, op, c), value: true }), text)
              : act((st, c) => {
                  const r = addTrial(st, v, op, c);
                  return { state: r.state, value: true };
                }, text);
            if (ok) onDone(text);
          }}
        >
          저장
        </button>
        <button className={btnGhost} onClick={() => onDone()}>
          닫기
        </button>
      </div>
    </section>
  );
}

/** 앱 측정기 — 1부 시작/끝(위험 발견) · 조치 카드 전달/2부 끝(재판단) */
function Stopwatch({ stamps, onStamps }: { stamps: TrialValues["stamps"]; onStamps: (s: TrialValues["stamps"], t1: number | null, t2: number | null) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const sec = (a?: string, b?: string) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : null);
  const run = (a?: string, b?: string) => (a ? Math.max(0, Math.round(((b ? Date.parse(b) : now) - Date.parse(a)) / 1000)) : 0);
  const stamp = (k: keyof TrialValues["stamps"]) => {
    const next = { ...stamps, [k]: new Date().toISOString() };
    onStamps(next, sec(next.part1Start, next.part1End), sec(next.actionGiven, next.part2End));
  };
  const b = "min-h-[2.9rem] rounded-xl px-3 text-[16.5px] font-extrabold disabled:opacity-35";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#f7f8fa] p-3" aria-label="앱 측정기">
      <span className="text-[16px] font-bold">앱 측정기</span>
      <button type="button" className={`${b} bg-primary text-white`} disabled={!!stamps.part1Start} onClick={() => stamp("part1Start")}>
        1부 시작
      </button>
      <button type="button" className={`${b} bg-ink text-white`} disabled={!stamps.part1Start || !!stamps.part1End} onClick={() => stamp("part1End")}>
        1부 끝 (위험 발견)
      </button>
      <span className="w-[5.5rem] text-[20px] font-extrabold tabular-nums">{run(stamps.part1Start, stamps.part1End)}초</span>
      <button type="button" className={`${b} bg-primary text-white`} disabled={!stamps.part1End || !!stamps.actionGiven} onClick={() => stamp("actionGiven")}>
        조치 전달
      </button>
      <button type="button" className={`${b} bg-ink text-white`} disabled={!stamps.actionGiven || !!stamps.part2End} onClick={() => stamp("part2End")}>
        2부 끝 (재판단)
      </button>
      <span className="w-[5.5rem] text-[20px] font-extrabold tabular-nums">{run(stamps.actionGiven, stamps.part2End)}초</span>
      <button type="button" className="text-[15px] font-bold text-ink-3 underline" onClick={() => onStamps({}, null, null)}>
        초기화
      </button>
    </div>
  );
}

/* ── 측정 목록 ─────────────────────────────────────── */

function TrialTable({ s, editing, setEditing, onDone }: { s: LabState; editing: string | null; setEditing: (v: string | null) => void; onDone: (text?: string) => void }) {
  const op = useOperator();
  const { msg, act } = useAct();
  if (s.trials.length === 0) return <p className="card px-4 py-4 text-[16.5px] text-ink-3">측정 기록이 없습니다. &lsquo;새 측정 기록&rsquo;으로 시작하세요.</p>;
  const th = "py-1.5 pr-2 text-left font-semibold whitespace-nowrap";
  return (
    <section className="card overflow-x-auto p-3.5" aria-label="측정 목록">
      <MsgBox msg={msg} />
      <table className="w-full min-w-[64rem] text-[15.5px] tabular-nums">
        <thead className="text-[14px] text-ink-3">
          <tr>
            <th className={th}>#</th>
            <th className={th}>날짜 · 회차</th>
            <th className={th}>참가자</th>
            <th className={th}>입력자</th>
            <th className={th}>유형</th>
            <th className={th}>시나리오</th>
            <th className={th}>발견(초)</th>
            <th className={th}>정확/정답</th>
            <th className={th}>놓침 · 오판</th>
            <th className={th}>후속 영향</th>
            <th className={th}>재판단(초)</th>
            <th className={th}>확인</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {[...s.trials].reverse().map((t) => (
            <Frag key={t.id}>
              <tr className={`border-t border-line align-top ${t.voided ? "text-ink-3 line-through" : ""}`}>
                <td className="py-1.5 pr-2">{t.no}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {t.date} · {trialRound(s, t)}회차
                </td>
                <td className="py-1.5 pr-2">{personName(s, t.participantId)}</td>
                <td className="py-1.5 pr-2">{personName(s, t.operatorId)}</td>
                <td className="py-1.5 pr-2 font-bold">{t.method}</td>
                <td className="py-1.5 pr-2">
                  {t.scenario}
                  <span className="block text-[13.5px] text-ink-3">{t.scenarioType}</span>
                </td>
                <td className="py-1.5 pr-2">
                  {t.t1Sec ?? "-"}
                  {t.t1Timeout && " ⏱"}
                </td>
                <td className="py-1.5 pr-2">
                  {t.correct ?? "-"}/{t.expected ?? "-"}
                </td>
                <td className="py-1.5 pr-2">
                  {t.missed ?? "-"} · {t.wrong ?? "-"}
                </td>
                <td className="py-1.5 pr-2">{t.followUp ?? "-"}</td>
                <td className="py-1.5 pr-2">
                  {t.t2Sec ?? "-"}
                  {t.t2Timeout && " ⏱"}
                </td>
                <td className="py-1.5 pr-2 text-[14px]">{t.confirmedByParticipant ? "참여자 확인" : "미확인"}</td>
                <td className="py-1.5 whitespace-nowrap no-underline">
                  {t.voided ? (
                    <span className="text-[14px]">무효: {t.voided.reason}</span>
                  ) : (
                    <span className="inline-flex gap-1">
                      <button className="rounded-lg bg-[#f2f4f6] px-2 py-1 text-[14.5px] font-bold" onClick={() => setEditing(editing === t.id ? null : t.id)}>
                        고치기
                      </button>
                      <button
                        className="rounded-lg bg-[#f2f4f6] px-2 py-1 text-[14.5px] font-bold text-danger"
                        onClick={() => {
                          const reason = window.prompt("무효 사유 (기록은 지우지 않고 무효로 남깁니다)");
                          if (reason !== null) act((st, c) => ({ state: voidTrial(st, t.id, reason, op, c), value: true }), `측정 #${t.no}을 무효 처리했습니다.`);
                        }}
                      >
                        무효
                      </button>
                    </span>
                  )}
                  {t.history.length > 0 && <span className="ml-1 text-[13.5px] text-ink-3">정정 {t.history.length}회</span>}
                </td>
              </tr>
              {editing === t.id && (
                <tr>
                  <td colSpan={13} className="pb-2">
                    <MeasureForm s={s} initialId={t.id} onDone={onDone} />
                  </td>
                </tr>
              )}
            </Frag>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Frag({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ── 비교 (실측만) ─────────────────────────────────── */

function Comparison({ s }: { s: LabState }) {
  const r = buildReport(s, new Date());
  return (
    <section className="card space-y-2 p-4" aria-label="수기 대 AX 비교">
      <h2 className="text-[20px] font-extrabold">수기 vs AX — 이번 시험 측정값</h2>
      <p className="text-[15.5px] font-semibold text-ink-2">{r.comparison.note}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-[15.5px] tabular-nums">
          <thead className="text-[14px] text-ink-3">
            <tr>
              <th className="py-1 pr-2 text-left font-semibold">측정</th>
              <th className="py-1 pr-2 text-left font-semibold">수기 (중앙값 · 범위 · n)</th>
              <th className="py-1 pr-2 text-left font-semibold">AX (중앙값 · 범위 · n)</th>
              <th className="py-1 text-left font-semibold">차이 (AX − 수기)</th>
            </tr>
          </thead>
          <tbody>
            {r.comparison.rows.map((x) => (
              <tr key={x.measure} className="border-t border-line">
                <td className="py-1.5 pr-2 font-semibold">{x.measure}</td>
                <td className="py-1.5 pr-2">{x.manual.n ? `${x.manual.median} · ${x.manual.min}~${x.manual.max} · n=${x.manual.n}` : "측정 없음"}</td>
                <td className="py-1.5 pr-2">{x.ax.n ? `${x.ax.median} · ${x.ax.min}~${x.ax.max} · n=${x.ax.n}` : "측정 없음"}</td>
                <td className="py-1.5">{x.difference === null ? "-" : x.difference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.comparison.pairs.length > 0 && (
        <p className="text-[15px] text-ink-3">
          같은 참가자의 대응 쌍: {r.comparison.pairs.map((p) => `${p.participant} · ${p.pairKey} (수기 ${p.manualT1.join("/")}초 · AX ${p.axT1.join("/")}초)`).join(" / ")}
        </p>
      )}
    </section>
  );
}

/* ── 문제·피드백 ───────────────────────────────────── */

function Notes({ s }: { s: LabState }) {
  const op = useOperator();
  const { msg, act } = useAct();
  const [v, setV] = useState<NoteValues>({ type: "참여자 피드백", text: "", speakerId: "p-koo", confirmation: "미확인 (입력자 기록)", status: "열림", sessionId: null, trialId: null });
  return (
    <section className="card space-y-3 p-4" aria-label="문제·피드백 기록">
      <h2 className="text-[20px] font-extrabold">문제·수정사항·참여자 피드백</h2>
      <div className="grid gap-2 sm:grid-cols-[10rem_10rem_14rem_1fr]">
        <select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as NoteValues["type"] })} className={inputSm} aria-label="종류">
          {NOTE_TYPES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={v.speakerId ?? ""} onChange={(e) => setV({ ...v, speakerId: e.target.value || null })} className={inputSm} aria-label="말한 사람">
          <option value="">말한 사람 없음</option>
          {s.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={v.confirmation} onChange={(e) => setV({ ...v, confirmation: e.target.value as NoteValues["confirmation"] })} className={inputSm} aria-label="확인 여부">
          {CONFIRMATION.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} placeholder="들은 그대로 적기 (확인하지 않은 의견을 만들지 않음)" className={inputSm} aria-label="내용" />
      </div>
      <button
        className={btnPrimary}
        onClick={() => {
          const ok = act((st, c) => {
            const r = addNote(st, v, op, c);
            return { state: r.state, value: true };
          }, "기록했습니다.");
          if (ok) setV({ ...v, text: "" });
        }}
      >
        <MessageSquarePlus size={18} /> 기록 추가
      </button>
      <MsgBox msg={msg} />
      <ul className="divide-y divide-line">
        {[...s.notes].reverse().map((n) => (
          <NoteRow key={n.id} s={s} n={n} />
        ))}
      </ul>
    </section>
  );
}

function NoteRow({ s, n }: { s: LabState; n: Note }) {
  const op = useOperator();
  const { act } = useAct();
  const values: NoteValues = { type: n.type, text: n.text, speakerId: n.speakerId, confirmation: n.confirmation, status: n.status, sessionId: n.sessionId, trialId: n.trialId };
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-[16px]">
      <span className="text-ink-3 tabular-nums">#{n.no}</span>
      <span className="rounded-full bg-[#f2f4f6] px-2 py-0.5 text-[14px] font-bold">{n.type}</span>
      <span className="min-w-0 flex-1">{n.text}</span>
      <span className="text-[14px] text-ink-3">
        {personName(s, n.speakerId)} · {n.confirmation} · 기록 {personName(s, n.recordedBy)} {kst(n.at).date}
      </span>
      <select
        value={n.status}
        aria-label="처리 상태"
        onChange={(e) => act((st, c) => ({ state: editNote(st, n.id, { ...values, status: e.target.value as Note["status"] }, op, c), value: true }), "처리 상태를 바꿨습니다.")}
        className="rounded-lg border border-line px-2 py-1 text-[14.5px]"
      >
        <option>열림</option>
        <option>반영함</option>
        <option>보류</option>
      </select>
      {n.confirmation !== "참여자가 직접 확인" && (
        <button className="rounded-lg bg-[#f2f4f6] px-2 py-1 text-[14px] font-bold" onClick={() => act((st, c) => ({ state: editNote(st, n.id, { ...values, confirmation: "참여자가 직접 확인" }, op, c), value: true }), "참여자 확인으로 바꿨습니다 (이력 남음).")}>
          참여자 확인함
        </button>
      )}
    </li>
  );
}
