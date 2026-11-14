"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { newOpId } from "@/lib/pilot/op-id";
import { addNoteAction } from "../measures/actions";

/** 현장기사 의견·오류 보내기 — 본인 이름으로 저장 (성과 측정의 의견·오류 이력) */
export function FeedbackForm() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"현장기사 의견" | "오류">("현장기사 의견");
  const [text, setText] = useState("");
  const [opId, setOpId] = useState(newOpId);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="card space-y-2 p-4" aria-label="의견·오류 보내기">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-2 text-[18px] font-extrabold text-ink-2">
        <MessageSquare size={20} /> 프로그램 의견 · 오류 보내기
      </button>
      {open && (
        <>
          <div className="flex gap-1.5" role="radiogroup" aria-label="의견 종류">
            {(["현장기사 의견", "오류"] as const).map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-[2.9rem] rounded-xl px-4 text-[16.5px] font-bold ${kind === k ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
                {k === "오류" ? "오류·불편" : "의견"}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="쓰면서 불편했던 점·바라는 점" aria-label="의견 내용" className="min-h-[5rem] w-full rounded-xl border border-line px-3 py-2 text-[17px]" />
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-[16px] font-semibold ${msg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
              {msg.text}
            </p>
          )}
          <button
            disabled={!text.trim()}
            onClick={async () => {
              const r = await addNoteAction({ opId, kind, text });
              if (!r.ok) return setMsg({ ok: false, text: r.error });
              setMsg({ ok: true, text: `보냈습니다 (기록 #${r.no}). 고맙습니다.` });
              setText("");
              setOpId(newOpId());
            }}
            className="min-h-[3rem] w-full rounded-xl bg-primary text-[17.5px] font-extrabold text-white disabled:opacity-40"
          >
            보내기
          </button>
        </>
      )}
    </section>
  );
}
