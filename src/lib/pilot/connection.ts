/**
 * 자동 갱신 연결 상태 (순수) — 화면 자동 갱신이 실패해도 숨기지 않고 보여 주기 위한 상태와 문장.
 *
 * 자동 갱신은 '주기 확인'이다 (몇 초마다 서버에 바뀐 것이 있는지 묻는다). 실시간 감시가 아니다.
 * 확인이 실패하는 동안에는 새 보고 · 본사 조치가 화면에 늦게 나타날 수 있으므로, 그 사실과 마지막 정상 확인 시각을 보여 준다.
 */
import { kst } from "./time";

export type ConnKind = "init" | "ok" | "offline" | "error" | "auth";

export interface ConnState {
  kind: ConnKind;
  /** 마지막으로 서버 확인에 성공한 시각 (ms) */
  lastOkAt: number | null;
  /** 연속 실패 수 */
  fails: number;
}

export const initialConn: ConnState = { kind: "init", lastOkAt: null, fails: 0 };

/** 확인 결과를 반영한다 — ok: 성공 · offline: 기기가 오프라인 · error: 서버 · 네트워크 오류 · auth: 로그인 만료(401) */
export function nextConn(prev: ConnState, result: "ok" | "offline" | "error" | "auth", at: number): ConnState {
  if (result === "ok") return { kind: "ok", lastOkAt: at, fails: 0 };
  return { kind: result, lastOkAt: prev.lastOkAt, fails: prev.fails + 1 };
}

const ago = (ms: number) => {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "1분 안" : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 ${m % 60}분 전`;
};

/**
 * 화면 문장 — tone: ok(평소) · warn(늦어짐 · 다시 시도 중) · danger(끊김 · 로그인 만료 · 여러 번 실패)
 * stale: 성공 기록이 확인 간격의 3배(최소 1분) 넘게 오래됐으면 '확인 늦어짐'으로 본다 (화면이 숨겨져 있었던 경우 등).
 */
export function connSummary(s: ConnState, now: number, seconds: number, label: string): { tone: "ok" | "warn" | "danger"; text: string; detail: string | null } {
  const last = s.lastOkAt ? `마지막 정상 확인 ${kst(new Date(s.lastOkAt)).seconds} (${ago(now - s.lastOkAt)})` : "아직 정상 확인 없음";
  const gap = "이 동안 새 보고 · 본사 조치가 화면에 늦게 보일 수 있습니다. 급하면 전화로 확인하세요.";
  if (s.kind === "auth") return { tone: "danger", text: "로그인이 만료됐을 수 있습니다 — 다시 로그인해 주세요", detail: `${last}. ${gap}` };
  if (s.kind === "offline") return { tone: "danger", text: "인터넷 연결 끊김 — 연결되면 자동으로 다시 확인", detail: `${last}. ${gap}` };
  if (s.kind === "error") return { tone: s.fails >= 3 ? "danger" : "warn", text: `서버 확인 실패 ${s.fails}번 — 다시 시도 중`, detail: `${last}. ${gap}` };
  if (s.kind === "ok" && s.lastOkAt && now - s.lastOkAt > Math.max(60_000, seconds * 3000)) return { tone: "warn", text: `${label} 늦어짐`, detail: `${last}. '지금 확인'을 누르면 바로 다시 읽습니다.` };
  if (s.kind === "ok" && s.lastOkAt) return { tone: "ok", text: `${label} ${seconds}초마다 확인 · 마지막 ${kst(new Date(s.lastOkAt)).seconds}`, detail: null };
  return { tone: "ok", text: `${label} ${seconds}초마다 확인`, detail: null };
}
