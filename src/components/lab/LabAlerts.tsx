"use client";

import { useLab, rawStored, resetDamaged } from "@/lib/lab/store";
import { WARN_BYTES } from "@/lib/lab/store";
import { download } from "./common";

/** 저장 실패 · 기록 손상 · 저장공간 경고 — 모든 실증 화면 위쪽에 */
export function LabAlerts() {
  const { loadError, saveError, bytes, unavailable } = useLab();
  return (
    <>
      {loadError && (
        <div role="alert" className="rounded-2xl border border-danger/40 bg-danger-bg px-4 py-3 text-[16.5px]">
          <p className="font-bold text-danger">{loadError}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded-xl bg-white px-3 py-1.5 font-bold" onClick={() => download(`hana-ax-lab-damaged-${Date.now()}.json`, rawStored(), "application/json")}>
              손상된 원문 내려받기
            </button>
            <button
              className="rounded-xl bg-danger px-3 py-1.5 font-bold text-white"
              onClick={() => {
                if (window.confirm("손상된 원문을 옆 칸에 옮겨 두고 빈 기록으로 새로 시작할까요? (먼저 원문을 내려받으세요)")) resetDamaged();
              }}
            >
              새로 시작
            </button>
          </div>
        </div>
      )}
      {saveError && (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger-bg px-4 py-3 text-[16.5px] font-bold text-danger">
          {saveError}
        </p>
      )}
      {!unavailable && bytes > WARN_BYTES && (
        <p role="alert" className="rounded-2xl bg-warning-bg px-4 py-3 text-[16px] font-bold text-warning">
          저장공간을 많이 쓰고 있습니다 ({Math.round(bytes / 1024)}KB) — JSON 백업을 받아 두세요. 공간이 차면 저장이 실패합니다.
        </p>
      )}
    </>
  );
}
