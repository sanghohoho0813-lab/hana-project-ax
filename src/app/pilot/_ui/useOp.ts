"use client";

import { useRef, useState } from "react";
import { newOpId } from "@/lib/pilot/op-id";
import type { OpResult } from "../admin/actions";

export const NETWORK_ERROR: OpResult = {
  ok: false,
  error: "서버에 연결하지 못했습니다. 다시 누르면 같은 요청 번호로 보내므로 두 번 저장되지 않습니다.",
  retry: true,
};

/**
 * 저장 요청 하나 — 요청 번호(op_id)는 성공 응답을 받을 때까지 그대로 둔다.
 * 연결이 끊겨 결과를 모를 때 다시 누르면 같은 번호로 보내고, DB 는 처음 결과를 돌려준다(중복 저장 없음).
 */
export function useOp() {
  const op = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OpResult | null>(null);

  async function run(send: (opId: string) => Promise<OpResult>): Promise<OpResult> {
    op.current ??= newOpId();
    setBusy(true);
    let r: OpResult;
    try {
      r = await send(op.current);
    } catch {
      r = NETWORK_ERROR;
    }
    if (r.ok) op.current = null;
    setResult(r);
    setBusy(false);
    return r;
  }

  return { run, busy, result, clear: () => setResult(null) };
}
