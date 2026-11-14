"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { newOpId } from "@/lib/pilot/op-id";
import { addNoteAction, addTrialAction, voidTrialAction } from "../../measures/actions";

const input = "w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px]";
const label = "mb-1 block text-[14.5px] font-semibold text-ink-2";
const chip = (on: boolean) => `rounded-xl px-3 py-2 text-[15.5px] font-bold ${on ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`;

/** 측정 7 입력 (수기·AX) · 측정 8·9 입력 (의견·오류·개선) */
export function MeasureForms({
  staff,
  cases,
  notes,
  classes,
  version,
}: {
  staff: { id: string; name: string }[];
  cases: { id: string; no: string; cls: string }[];
  notes: { id: string; no: number; text: string }[];
  classes: string[];
  version: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 print:hidden">
      <TrialForm staff={staff} cases={cases} classes={classes} />
      <NoteForm staff={staff} cases={cases} notes={notes} version={version} />
    </div>
  );
}

function TrialForm({ staff, cases, classes }: { staff: { id: string; name: string }[]; cases: { id: string; no: string; cls: string }[]; classes: string[] }) {
  const router = useRouter();
  const [opId, setOpId] = useState(newOpId);
  const [v, setV] = useState<Record<string, string>>({ evidenceClass: classes[0], method: "수기", valueBasis: "시험 실측", measureMethod: "앱 측정기", participantId: staff[0]?.id ?? "" });
  const [stamps, setStamps] = useState<{ a?: number; b?: number; c?: number; d?: number }>({});
  const [now, setNow] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const set = (k: string, x: string) => setV((o) => ({ ...o, [k]: x }));
  const press = (k: "a" | "b" | "c" | "d") => {
    const t = Date.now();
    const s = { ...stamps, [k]: t };
    setStamps(s);
    if (s.a && s.b) set("findSec", String(Math.round((s.b - s.a) / 100) / 10));
    if (s.c && s.d) set("rejudgeSec", String(Math.round((s.d - s.c) / 100) / 10));
  };
  const run = (x?: number, y?: number) => (x ? Math.max(0, Math.round(((y ?? now) - x) / 1000)) : 0);
  const b = "rounded-xl px-3 py-2 text-[15px] font-extrabold disabled:opacity-35";
  return (
    <section className="card space-y-2.5 p-4" aria-label="수기·AX 측정 입력">
      <h2 className="text-[19px] font-extrabold">측정 7 입력 — 같은 시나리오를 수기·AX로 판단한 시간·정확도</h2>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="자료 구분">
        {classes.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={v.evidenceClass === c} className={chip(v.evidenceClass === c)} onClick={() => set("evidenceClass", c)}>
            {c}
          </button>
        ))}
        {(["수기", "AX"] as const).map((x) => (
          <button key={x} type="button" role="radio" aria-checked={v.method === x} className={chip(v.method === x)} onClick={() => set("method", x)}>
            {x === "수기" ? "수기 (기존 방식)" : "AX 시스템"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#f7f8fa] p-2" aria-label="앱 측정기">
        <button className={`${b} bg-primary text-white`} disabled={!!stamps.a} onClick={() => press("a")}>
          시작
        </button>
        <button className={`${b} bg-ink text-white`} disabled={!stamps.a || !!stamps.b} onClick={() => press("b")}>
          위험 파악 끝
        </button>
        <span className="w-14 text-[17px] font-extrabold tabular-nums">{run(stamps.a, stamps.b)}초</span>
        <button className={`${b} bg-primary text-white`} disabled={!stamps.b || !!stamps.c} onClick={() => press("c")}>
          조치 전달
        </button>
        <button className={`${b} bg-ink text-white`} disabled={!stamps.c || !!stamps.d} onClick={() => press("d")}>
          재판단 끝
        </button>
        <span className="w-14 text-[17px] font-extrabold tabular-nums">{run(stamps.c, stamps.d)}초</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          <span className={label}>시나리오 (같은 묶음끼리 비교)</span>
          <input value={v.scenario ?? ""} onChange={(e) => set("scenario", e.target.value)} placeholder="예: I3 지원 요청 지연 / 사건 HX-…" className={input} aria-label="시나리오" />
        </label>
        <label>
          <span className={label}>대응 묶음</span>
          <input value={v.pairKey ?? ""} onChange={(e) => set("pairKey", e.target.value)} placeholder="예: I3" className={input} aria-label="대응 묶음" />
        </label>
        <label>
          <span className={label}>참가자</span>
          <select value={v.participantId} onChange={(e) => set("participantId", e.target.value)} className={input} aria-label="참가자">
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>연결 사건 (있으면)</span>
          <select value={v.caseId ?? ""} onChange={(e) => set("caseId", e.target.value)} className={input} aria-label="연결 사건">
            <option value="">없음</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.no} ({c.cls})
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["findSec", "위험 파악 시간(초)"],
            ["rejudgeSec", "재판단 시간(초)"],
            ["correct", "정확히 찾은 위험"],
            ["expected", "정답 위험 수"],
            ["missed", "놓친 위험"],
            ["wrong", "잘못 판단"],
          ] as const
        ).map(([k, l]) => (
          <label key={k}>
            <span className={label}>{l}</span>
            <input inputMode="decimal" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={input} aria-label={l} />
          </label>
        ))}
        <label>
          <span className={label}>값의 근거</span>
          <select value={v.valueBasis} onChange={(e) => set("valueBasis", e.target.value)} className={input} aria-label="값의 근거">
            <option>시험 실측</option>
            <option>과거 기록</option>
            <option>기억 추정</option>
          </select>
        </label>
        <label>
          <span className={label}>측정 방법</span>
          <select value={v.measureMethod} onChange={(e) => set("measureMethod", e.target.value)} className={input} aria-label="측정 방법">
            {["앱 측정기", "스톱워치", "기록지", "화면 녹화", "원자료"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={label}>원자료 · 비고</span>
          <input value={v.rawRef ?? ""} onChange={(e) => set("rawRef", e.target.value)} placeholder="기록지 번호·녹화 파일 이름" className={input} aria-label="원자료" />
        </label>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-[15.5px] font-semibold ${msg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
          {msg.text}
        </p>
      )}
      <button
        disabled={!v.scenario?.trim() || !v.participantId}
        className="min-h-[2.9rem] rounded-xl bg-primary px-4 text-[16.5px] font-bold text-white disabled:opacity-40"
        onClick={async () => {
          const r = await addTrialAction({
            ...v,
            opId,
            startedAt: stamps.a ? new Date(stamps.a).toISOString() : null,
            endedAt: stamps.d ? new Date(stamps.d).toISOString() : stamps.b ? new Date(stamps.b).toISOString() : null,
          });
          if (!r.ok) return setMsg({ ok: false, text: r.error });
          setMsg({ ok: true, text: `측정 #${r.no} 저장${r.duplicated ? " (이미 저장된 요청)" : ""}` });
          setOpId(newOpId());
          setStamps({});
          setV((o) => ({ ...o, findSec: "", rejudgeSec: "", correct: "", missed: "", wrong: "" }));
          router.refresh();
        }}
      >
        측정 저장
      </button>
    </section>
  );
}

function NoteForm({ staff, cases, notes, version }: { staff: { id: string; name: string }[]; cases: { id: string; no: string }[]; notes: { id: string; no: number; text: string }[]; version: string }) {
  const router = useRouter();
  const [opId, setOpId] = useState(newOpId);
  const [v, setV] = useState<Record<string, string>>({ kind: "관리자 의견", confirmation: "입력자 기록 (본인 미확인)", devVersion: version.replace(/^[^@]+@/, "") });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: string, x: string) => setV((o) => ({ ...o, [k]: x }));
  return (
    <section className="card space-y-2.5 p-4" aria-label="의견·오류·개선 입력">
      <h2 className="text-[19px] font-extrabold">측정 8·9 입력 — 의견 · 오류 · 개선 이력</h2>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="종류">
        {["현장기사 의견", "관리자 의견", "오류", "개선 요청", "개선 반영"].map((k) => (
          <button key={k} type="button" role="radio" aria-checked={v.kind === k} className={chip(v.kind === k)} onClick={() => set("kind", k)}>
            {k}
          </button>
        ))}
      </div>
      <textarea value={v.text ?? ""} onChange={(e) => set("text", e.target.value)} maxLength={1000} placeholder="들은 그대로 · 확인하지 않은 의견을 만들지 않음" className={`${input} min-h-[5rem]`} aria-label="내용" />
      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          <span className={label}>말한 사람 (계정)</span>
          <select value={v.speakerId ?? ""} onChange={(e) => set("speakerId", e.target.value)} className={input} aria-label="말한 사람">
            <option value="">계정 없음</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>또는 이름</span>
          <input value={v.speakerName ?? ""} onChange={(e) => set("speakerName", e.target.value)} placeholder="예: 구본석 이사" className={input} aria-label="말한 사람 이름" />
        </label>
        <label>
          <span className={label}>확인</span>
          <select value={v.confirmation} onChange={(e) => set("confirmation", e.target.value)} className={input} aria-label="확인 여부">
            <option>입력자 기록 (본인 미확인)</option>
            <option>본인이 확인함</option>
          </select>
        </label>
        <label>
          <span className={label}>관련 사건</span>
          <select value={v.caseId ?? ""} onChange={(e) => set("caseId", e.target.value)} className={input} aria-label="관련 사건">
            <option value="">없음</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.no}
              </option>
            ))}
          </select>
        </label>
        {v.kind === "개선 반영" && (
          <>
            <label className="sm:col-span-2">
              <span className={label}>반영한 원래 기록</span>
              <select value={v.refNoteId ?? ""} onChange={(e) => set("refNoteId", e.target.value)} className={input} aria-label="원래 기록">
                <option value="">고르세요</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    #{n.no} {n.text}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>바뀐 날짜</span>
              <input type="date" value={v.devDate ?? ""} onChange={(e) => set("devDate", e.target.value)} className={input} aria-label="바뀐 날짜" />
            </label>
            <label>
              <span className={label}>프로그램 버전</span>
              <input value={v.devVersion ?? ""} onChange={(e) => set("devVersion", e.target.value)} className={input} aria-label="프로그램 버전" />
            </label>
          </>
        )}
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-[15.5px] font-semibold ${msg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
          {msg.text}
        </p>
      )}
      <button
        disabled={!v.text?.trim()}
        className="min-h-[2.9rem] rounded-xl bg-primary px-4 text-[16.5px] font-bold text-white disabled:opacity-40"
        onClick={async () => {
          const r = await addNoteAction({ ...v, opId });
          if (!r.ok) return setMsg({ ok: false, text: r.error });
          setMsg({ ok: true, text: `기록 #${r.no} 저장` });
          setOpId(newOpId());
          setV((o) => ({ ...o, text: "" }));
          router.refresh();
        }}
      >
        기록 저장
      </button>
    </section>
  );
}

export function VoidTrialButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="rounded-lg bg-[#f2f4f6] px-2 py-1 text-[13.5px] font-bold text-danger"
      onClick={async () => {
        const reason = window.prompt("무효 사유 (기록은 지우지 않고 무효로 남깁니다)");
        if (!reason) return;
        await voidTrialAction(id, reason);
        router.refresh();
      }}
    >
      무효
    </button>
  );
}
