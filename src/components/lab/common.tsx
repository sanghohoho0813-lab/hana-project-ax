"use client";

import { useState } from "react";
import { commit, useLab, usePref } from "@/lib/lab/store";
import { personName, type LabKind, type LabState, type Session } from "@/lib/lab/model";
import { kst } from "@/lib/pilot/time";

/** 데이터 구분 표시 — 실제 업무 · 사후 재현 · 가상 시나리오를 색과 모양으로 늘 구분 */
export function KindBadge({ kind, big = false }: { kind: LabKind; big?: boolean }) {
  const cls =
    kind === "실제 업무"
      ? "bg-[#e8f1fe] text-[#1b64da] border border-[#1b64da]/30"
      : kind === "사후 재현"
        ? "bg-[#fdf3e0] text-[#8a4b00] border border-[#b45309]/40"
        : "bg-[#f5f0ff] text-[#5b21b6] border-2 border-dashed border-[#7c3aed]/50";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-bold whitespace-nowrap ${big ? "text-[17px]" : "text-[14.5px]"} ${cls}`}>{kind}</span>;
}

export type Msg = { ok: boolean; text: string } | null;

export function MsgBox({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={`rounded-2xl px-4 py-2.5 text-[16.5px] font-semibold ${msg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
      {msg.text}
    </p>
  );
}

/** 저장 한 번 — 결과 문장을 함께 돌려준다 */
export function useAct() {
  const [msg, setMsg] = useState<Msg>(null);
  function act<T>(change: Parameters<typeof commit<T>>[0], okText: string | ((v: T) => string)): T | null {
    const r = commit(change);
    if (r.ok) {
      setMsg({ ok: true, text: typeof okText === "function" ? okText(r.value) : okText });
      return r.value;
    }
    setMsg({ ok: false, text: r.error });
    return null;
  }
  return { msg, setMsg, act };
}

export function download(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const kstDT = (iso: string | null | undefined) => (iso ? `${kst(iso).date} ${kst(iso).time}` : "-");

/** 지금 다루는 실증 세트 — 이 브라우저의 모든 화면(PC·모바일)이 같은 세트를 본다 */
export function useCurrentSession(): [Session | null, (id: string) => void, LabState | null] {
  const { state } = useLab();
  const [id, setId] = usePref("session", "");
  const session = state?.sessions.find((x) => x.id === id) ?? state?.sessions.at(-1) ?? null;
  return [session, setId, state];
}

export function sessionLabel(s: LabState, x: Session) {
  return `세트 ${x.no} · ${x.title} · ${x.workDate} · ${personName(s, x.participantId)}`;
}

export const inputSm = "w-full rounded-xl border border-line bg-white px-3 py-2 text-[17.5px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
export const labelSm = "mb-1 block text-[15.5px] font-semibold text-ink-2";
export const btnPrimary = "inline-flex min-h-[2.9rem] items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[17.5px] font-bold text-white hover:bg-primary-dark disabled:opacity-40";
export const btnGhost = "inline-flex min-h-[2.9rem] items-center justify-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[17.5px] font-bold text-ink-2 hover:bg-[#e8ebee] disabled:opacity-40";
