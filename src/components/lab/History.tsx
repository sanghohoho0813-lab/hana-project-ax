"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui";
import { personName, type Entry, type JudgmentEntry, type LabState } from "@/lib/lab/model";
import { kst } from "@/lib/pilot/time";

/** 기록 1건 = 판단 1건 — 무엇이 바뀌었고, 엔진이 어떻게 계산해 판단이 어떻게 바뀌었는지 */
export function JudgmentStory({ s, j, entry, open: start = false }: { s: LabState; j: JudgmentEntry; entry?: Entry; open?: boolean }) {
  const [open, setOpen] = useState(start);
  const sm = j.summary;
  const up = sm.risky_after > sm.risky_before;
  const down = sm.risky_after < sm.risky_before;
  return (
    <li className={`rounded-2xl border px-4 py-3 ${up ? "border-danger/30 bg-danger-bg/30" : down ? "border-success/30 bg-success-bg/30" : "border-line bg-white"}`}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-2 text-left">
        <span className="shrink-0 rounded-lg bg-[#f2f4f6] px-2 py-0.5 text-[14.5px] font-bold tabular-nums text-ink-2">#{j.seq}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16.5px] font-bold">{j.story[0]}</span>
          <span className="mt-0.5 flex flex-wrap gap-1.5 text-[14.5px]">
            <Badge tone={up ? "danger" : down ? "success" : "neutral"} className="!px-2 !py-0 !text-[14px]">
              위험 {sm.risky_before}→{sm.risky_after}
            </Badge>
            {sm.held_before + sm.held_after > 0 && (
              <Badge tone="neutral" className="!px-2 !py-0 !text-[14px]">
                판단 보류 {sm.held_before}→{sm.held_after}
              </Badge>
            )}
            {entry && (
              <span className="text-ink-3">
                입력 {personName(s, entry.enteredBy)} · 제공 {personName(s, entry.informantId)} · {entry.source}
              </span>
            )}
          </span>
        </span>
        <ChevronDown size={20} className={`mt-1 shrink-0 text-ink-3 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2">
          <ol className="space-y-1 text-[15.5px] leading-relaxed">
            {j.story.slice(1).map((l, i) => (
              <li key={i} className={l.startsWith("판단 변화") ? "pl-4 font-bold" : ""}>
                {l.startsWith("판단 변화") ? "→ " : "· "}
                {l}
              </li>
            ))}
          </ol>
          <p className="text-[14px] text-ink-3">
            판단 기준시각 {kst(j.asOf).time} ({j.asOfBasis}) · 1순위 전: {sm.priority_before[0] ?? "없음"} → 후: {sm.priority_after[0] ?? "없음"} · {j.ruleVersion} · {j.stateVersion} · {j.priorityVersion}
          </p>
          <p className="text-[13.5px] text-ink-3">기록값 = 입력·보고된 값 · 계산값 = 엔진이 계산한 값 · 가정값 = 작업시간 유지·재현 기준시각 같은 가정</p>
        </div>
      )}
    </li>
  );
}

export function HistoryList({ s, sessionId, limit }: { s: LabState; sessionId?: string; limit?: number }) {
  const list = s.judgments.filter((j) => !sessionId || j.sessionId === sessionId).slice().reverse();
  const shown = limit ? list.slice(0, limit) : list;
  if (list.length === 0) return <p className="text-[16px] text-ink-3">아직 기록이 없습니다.</p>;
  return (
    <ol className="space-y-2">
      {shown.map((j, i) => (
        <JudgmentStory key={j.seq} s={s} j={j} entry={s.entries.find((e) => e.seq === j.seq)} open={i === 0} />
      ))}
    </ol>
  );
}
