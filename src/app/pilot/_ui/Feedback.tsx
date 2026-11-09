"use client";

import type { OpResult } from "../admin/actions";

/** 저장 결과와 그 변경으로 기록된 위험 판단 전후 요약 */
export function Feedback({ result }: { result: OpResult | null }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-bg/40 px-4 py-3 text-[17.5px]">
        <p className="font-bold text-danger">{result.error}</p>
        {result.retry && <p className="mt-0.5 text-ink-2">저장됐는지 확인되지 않았습니다. 같은 버튼을 다시 누르세요.</p>}
      </div>
    );
  }
  const j = result.judge;
  const s = j?.summary;
  return (
    <div role="status" className="rounded-2xl border border-success/30 bg-success-bg/40 px-4 py-3 text-[17.5px]">
      <p className="font-bold text-success">{result.message}</p>
      {s && (
        <p className="mt-0.5 text-ink-2">
          위험 판단 전후 기록: 위험 연결 {s.risky_before} → {s.risky_after}건 · 판단 보류 {s.held_before} → {s.held_after}건 · 바뀐 연결 {s.changed_links}건 · 영향 현장 {s.affected_sites}곳
          {s.priority_after.length > 0 && <> · 1순위 {s.priority_after[0]}</>}
        </p>
      )}
      {j && !j.recorded && (
        <p className="mt-0.5 font-semibold text-warning">위험 판단 기록이 아직 저장되지 않았습니다 — 대기열에 남아 있어 &lsquo;다시 처리&rsquo;로 기록할 수 있습니다.</p>
      )}
      {j && j.pending > 0 && <p className="mt-0.5 font-semibold text-warning">기록 대기 판단 {j.pending}건</p>}
    </div>
  );
}
