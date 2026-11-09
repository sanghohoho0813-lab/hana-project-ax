"use client";

import { useState } from "react";
import { usePref } from "@/lib/lab/store";
import { personName, SOURCES, type LabState, type Provenance, type Session } from "@/lib/lab/model";
import { useOperator } from "./LabShell";
import { inputSm, labelSm } from "./common";

/** 이번 입력의 출처 — 세트 기본값에서 시작해 화면에서 바꿀 수 있다 (이 브라우저의 모든 화면이 공유) */
export function useProvenance(session: Session | null): [Provenance, (p: Partial<Provenance>) => void] {
  const op = useOperator();
  const [raw, setRaw] = usePref(`prov:${session?.id ?? "-"}`, "");
  let saved: Partial<Provenance> = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }
  const p: Provenance = {
    enteredBy: op,
    informantId: saved.informantId !== undefined ? saved.informantId : (session?.informantId ?? null),
    source: saved.source ?? session?.source ?? SOURCES[1],
    sourceRef: saved.sourceRef ?? session?.sourceRef ?? "",
  };
  return [p, (x) => setRaw(JSON.stringify({ informantId: p.informantId, source: p.source, sourceRef: p.sourceRef, ...x }))];
}

export function ProvenanceBar({ s, session, workerId }: { s: LabState; session: Session; workerId?: string | null }) {
  const [p, setP] = useProvenance(session);
  const [open, setOpen] = useState(false);
  const proxy = workerId !== undefined && workerId !== null && p.enteredBy !== workerId;
  return (
    <div className="rounded-2xl border border-line bg-white px-3.5 py-2.5 text-[15.5px]" aria-label="입력 출처">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span>
          입력자 <b>{personName(s, p.enteredBy)}</b>
        </span>
        {workerId !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-[14px] font-bold ${proxy ? "bg-warning-bg text-warning" : "bg-success-bg text-success"}`}>{proxy ? "대리 입력" : "본인 입력"}</span>
        )}
        <span>
          정보 제공 <b>{personName(s, p.informantId)}</b>
        </span>
        <span>
          출처 <b>{p.source}</b>
          {p.sourceRef && ` · ${p.sourceRef}`}
        </span>
        <button onClick={() => setOpen((v) => !v)} className="ml-auto rounded-lg bg-[#f2f4f6] px-2.5 py-1 font-bold text-ink-2" aria-expanded={open}>
          출처 바꾸기
        </button>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label>
            <span className={labelSm}>정보 제공자</span>
            <select value={p.informantId ?? ""} onChange={(e) => setP({ informantId: e.target.value || null })} className={inputSm}>
              <option value="">없음 (가상·직접 시험)</option>
              {s.people.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelSm}>자료 출처</span>
            <select value={p.source} onChange={(e) => setP({ source: e.target.value })} className={inputSm}>
              {SOURCES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelSm}>원자료 (이름·위치)</span>
            <input value={p.sourceRef} onChange={(e) => setP({ sourceRef: e.target.value })} className={inputSm} placeholder="예: 업무일지 11/12" />
          </label>
          <p className="text-[14px] text-ink-3 sm:col-span-3">입력자는 화면 위쪽 &lsquo;입력자&rsquo;에서 바꿉니다. 정보 제공자가 직접 확인하지 않은 내용은 확인했다고 적지 마세요.</p>
        </div>
      )}
    </div>
  );
}
