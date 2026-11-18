// 자동 갱신 연결 상태 — 실패를 숨기지 않는다 (0.6.1 안정화)
import { describe, expect, it } from "vitest";
import { connSummary, initialConn, nextConn } from "@/lib/pilot/connection";

const T0 = Date.parse("2026-11-18T01:00:00Z"); // 한국 10:00:00

describe("연결 상태 · 문장", () => {
  it("처음에는 시각 없이 '몇 초마다 확인'만 (서버 · 브라우저 그림이 같게)", () => {
    expect(connSummary(initialConn, 0, 15, "자동 갱신")).toEqual({ tone: "ok", text: "자동 갱신 15초마다 확인", detail: null });
  });

  it("성공하면 마지막 확인 시각을 보여 준다", () => {
    const s = nextConn(initialConn, "ok", T0);
    expect(connSummary(s, T0 + 5000, 15, "자동 갱신")).toEqual({ tone: "ok", text: "자동 갱신 15초마다 확인 · 마지막 10:00:00", detail: null });
  });

  it("오프라인은 바로 '끊김'(빨강) — 마지막 정상 확인 시각과 '늦게 보일 수 있음'을 함께", () => {
    const s = nextConn(nextConn(initialConn, "ok", T0), "offline", T0 + 120_000);
    const r = connSummary(s, T0 + 120_000, 15, "자동 갱신");
    expect(r.tone).toBe("danger");
    expect(r.text).toContain("인터넷 연결 끊김");
    expect(r.detail).toContain("마지막 정상 확인 10:00:00 (2분 전)");
    expect(r.detail).toContain("늦게 보일 수 있습니다");
  });

  it("서버 확인 실패는 1~2번은 주황(다시 시도 중), 3번부터 빨강 — 성공하면 바로 정상", () => {
    let s = nextConn(initialConn, "ok", T0);
    s = nextConn(s, "error", T0 + 15_000);
    expect(connSummary(s, T0 + 15_000, 15, "x")).toMatchObject({ tone: "warn", text: "서버 확인 실패 1번 — 다시 시도 중" });
    s = nextConn(nextConn(s, "error", T0 + 30_000), "error", T0 + 45_000);
    expect(connSummary(s, T0 + 45_000, 15, "x").tone).toBe("danger");
    s = nextConn(s, "ok", T0 + 60_000);
    expect(s).toEqual({ kind: "ok", lastOkAt: T0 + 60_000, fails: 0 });
  });

  it("로그인 만료(401)는 다시 로그인 안내", () => {
    const r = connSummary(nextConn(initialConn, "auth", T0), T0, 15, "x");
    expect(r.tone).toBe("danger");
    expect(r.text).toContain("다시 로그인");
    expect(r.detail).toContain("아직 정상 확인 없음");
  });

  it("성공 기록이 오래되면(간격의 3배 · 최소 1분) '확인 늦어짐'", () => {
    const s = nextConn(initialConn, "ok", T0);
    expect(connSummary(s, T0 + 44_000, 15, "본사 조치 확인").tone).toBe("ok");
    const r = connSummary(s, T0 + 61_000, 15, "본사 조치 확인");
    expect(r).toMatchObject({ tone: "warn", text: "본사 조치 확인 늦어짐" });
    expect(connSummary(s, T0 + 61_000, 30, "x").tone).toBe("ok"); // 30초 간격은 90초까지 정상
  });
});
