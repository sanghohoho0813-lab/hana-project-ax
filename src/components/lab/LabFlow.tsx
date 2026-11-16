"use client";

import { Check } from "lucide-react";
import { useCurrentSession } from "./common";

/**
 * PC+Mobile 동시보기 위쪽 — 지금 세트의 마지막 현장 문제가 어디까지 왔는지 6단계로 보여 준다.
 * 현장 문제 발견 → 보고 → 위험 계산 → 관리자 지원 → 일정 조정 → 재판단
 * 값은 이 브라우저에 저장된 실증 기록에서 읽기만 한다 (계산하지 않음). 이 화면은 같은 브라우저 안의 두 화면이며
 * 실제 다른 기기 사이의 시험이 아니다.
 */
export function LabFlow() {
  const [session, , state] = useCurrentSession();
  const issue = state && session ? state.issues.filter((x) => x.sessionId === session.id && !x.voided).at(-1) : undefined;
  const judgment = (seq: number | null | undefined) => (seq != null ? state?.judgments.find((j) => j.seq === seq) : undefined);
  const reportJ = judgment(issue?.linkedSeq);
  const support = issue?.steps.find((s) => s.kind === "지원 요청 접수" || s.kind === "지원 조치 결정");
  const adjust = issue?.steps.filter((s) => s.kind === "일정 조정" || s.kind === "예상 종료 변경").at(-1);
  const adjustJ = judgment(adjust?.linkedSeq);
  const steps = [
    { k: "현장 문제 발견", done: !!issue, note: issue ? (issue.discovered.at ? "발견 시각 기록" : "발견 시각 모름") : "" },
    { k: "보고", done: !!issue, note: issue ? `#${issue.no} ${issue.type}` : "" },
    { k: "위험 계산", done: !!reportJ, note: reportJ ? `위험 연결 ${reportJ.summary.risky_before} → ${reportJ.summary.risky_after}` : issue && !issue.expectedEnd ? "예상 종료 미확인 — 계산 안 함" : "" },
    { k: "관리자 지원", done: !!support, note: support ? (support.action ?? support.kind) : "" },
    { k: "일정 조정", done: !!adjust, note: adjust ? adjust.kind : "" },
    { k: "재판단", done: !!adjustJ, note: adjustJ ? `위험 연결 ${adjustJ.summary.risky_before} → ${adjustJ.summary.risky_after}` : "" },
  ];
  const current = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <section aria-label="현장 문제 처리 흐름" className="border-b border-line bg-white px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-extrabold text-ink">
          처리 흐름 <span className="font-semibold text-ink-3">{issue ? `· 현장 문제 #${issue.no}` : "· 아직 보고된 현장 문제가 없습니다"}</span>
        </p>
        <p className="text-[12.5px] text-ink-3">같은 브라우저 안의 PC 화면과 휴대폰 크기 화면입니다 — 실제 다른 기기 사이 시험이 아닙니다</p>
      </div>
      <ol className="mt-2 grid grid-cols-6 gap-2">
        {steps.map((s, i) => (
          <li
            key={`${s.k}-${s.done ? doneCount : 0}`}
            className={`min-w-0 rounded-xl px-2.5 py-2 ${s.done ? "flash-in bg-success-bg" : i === current ? "bg-primary-light ring-2 ring-primary/40" : "bg-[#f5f6f8]"}`}
          >
            <p className={`flex items-center gap-1 text-[13px] font-extrabold ${s.done ? "text-success" : i === current ? "text-primary-dark" : "text-ink-3"}`}>
              {s.done ? <Check size={14} /> : <span className="tabular-nums">{i + 1}</span>} {s.k}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-2">{s.note || (i === current ? "지금 단계" : "—")}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
