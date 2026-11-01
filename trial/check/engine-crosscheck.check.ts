/**
 * 정답표 ↔ 실제 AX 엔진 교차확인
 *
 * 손계산 정답표(data/answer-key.json)를 실제 프로그램 엔진 출력과 한 칸씩 대조한다.
 * 시험 화면(ax-screen)이 보여줄 판단이 정답표와 같은지, 정답표가 엔진에 맞춰 만들어진 것이 아닌지를
 * 독립 검산(tools/answer_key.py)과 함께 확인한다.
 */
import { describe, expect, it } from "vitest";
import { diffRisk, gradeRank, type RiskLink, type RiskResult } from "@/lib/risk-engine";
import { SCENARIOS, adjustStart, judge } from "../lib/scenario";
import key from "../data/answer-key.json";

interface KeyLink {
  key: string;
  arrival: string | null;
  slack: number | null;
  grade: string;
  cause?: string;
  planOnly?: boolean;
}
interface KeyPart {
  links: KeyLink[];
  affected: Record<string, number>;
}
interface KeyScenario extends KeyPart {
  after: KeyPart & { resolved: string[]; new: string[]; remaining: string[] };
}
const KEY = key.scenarios as Record<string, KeyScenario>;

const isRisk = (l: RiskLink) => l.status === "판정" && gradeRank(l.grade) >= 2;

function asKey(r: RiskResult): KeyPart {
  const links = r.links.map((l) => {
    const k: KeyLink = {
      key: l.key,
      arrival: l.status === "판정" ? l.arrival : null,
      slack: l.status === "판정" ? l.slack : null,
      grade: l.status === "판정" ? l.grade! : l.status,
    };
    if (isRisk(l)) {
      k.cause = l.cause;
      k.planOnly = l.staticConflict;
    }
    return k;
  });
  const affected = Object.fromEntries(r.sites.filter((s) => s.startDelay > 0).map((s) => [s.id, s.startDelay]));
  return { links, affected };
}

const byKey = (xs: KeyLink[]) => [...xs].sort((a, b) => a.key.localeCompare(b.key));
const riskKeys = (r: RiskResult) => r.links.filter(isRisk).map((l) => l.key).sort();

describe("비교시험 정답표 = 실제 AX 엔진 판단", () => {
  it("시나리오 12개(연습 2 + A세트 5 + B세트 5)가 모두 정답표에 있다", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["R1", "R2", "A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"]);
    expect(Object.keys(KEY).sort()).toEqual(SCENARIOS.map((s) => s.id).sort());
  });

  for (const sc of SCENARIOS) {
    describe(sc.id, () => {
      const k = KEY[sc.id];
      const before = judge(sc);
      const adjusted = adjustStart(sc, sc.sites, sc.action.siteId, sc.action.newStart);
      const after = adjusted ? judge(sc, adjusted) : null;

      it("데이터 오류·판단 보류 없이 모든 연결을 판단한다", () => {
        expect(before.risk.issues).toEqual([]);
        expect(before.risk.links.filter((l) => l.status === "판단 보류")).toEqual([]);
        expect(after).not.toBeNull();
        expect(after!.risk.issues).toEqual([]);
      });

      it("조치 전: 연결별 도착·여유·등급·원인과 영향 현장이 정답표와 같다", () => {
        const got = asKey(before.risk);
        expect(byKey(got.links)).toEqual(byKey(k.links));
        expect(got.affected).toEqual(k.affected);
      });

      it("조치 후: 연결별 판정과 영향 현장이 정답표와 같다", () => {
        const got = asKey(after!.risk);
        expect(byKey(got.links)).toEqual(byKey(k.after.links));
        expect(got.affected).toEqual(k.after.affected);
      });

      it("조치 전후 변화(해소·신규·유지)가 정답표와 같고, 엔진의 변경 비교(diffRisk)와도 맞는다", () => {
        const b = riskKeys(before.risk);
        const a = riskKeys(after!.risk);
        expect(b.filter((x) => !a.includes(x))).toEqual([...k.after.resolved].sort());
        expect(a.filter((x) => !b.includes(x))).toEqual([...k.after.new].sort());
        expect(a.filter((x) => b.includes(x))).toEqual([...k.after.remaining].sort());
        const d = diffRisk(before.risk, after!.risk);
        for (const r of k.after.resolved) expect(d.changes.find((c) => c.key === r)?.kind).toBe("해소");
        for (const n of k.after.new) expect(d.changes.find((c) => c.key === n)?.kind).toBe("신규 위험");
      });

      it("우선순위 목록은 위험 건만 순위를 매긴다 (같은 지연에서 나온 위험은 한 항목으로 묶일 수 있음)", () => {
        const sites = new Set(before.priority.items.flatMap((i) => i.sites.map((s) => s.id)));
        expect(before.priority.items.length > 0).toBe(riskKeys(before.risk).length > 0);
        for (const id of Object.keys(k.affected)) expect(sites.has(id)).toBe(true);
      });
    });
  }

  it("세트별 문항 수가 같다 — A·B 모두 위험 10건, 영향 현장 10곳, 조치 후 위험 7건, 해소 4건, 신규 1건", () => {
    const tally = (set: string) => {
      const ids = SCENARIOS.filter((s) => s.set === set).map((s) => s.id);
      const sum = (f: (k: KeyScenario) => number) => ids.reduce((n, id) => n + f(KEY[id]), 0);
      const risk = (p: KeyPart) => p.links.filter((l) => ["중간", "높음", "매우 높음"].includes(l.grade)).length;
      return {
        risks: sum((k) => risk(k)),
        affected: sum((k) => Object.keys(k.affected).length),
        afterRisks: sum((k) => risk(k.after)),
        resolved: sum((k) => k.after.resolved.length),
        newRisks: sum((k) => k.after.new.length),
        planOnly: sum((k) => k.links.filter((l) => l.planOnly).length),
        links: sum((k) => k.links.length),
      };
    };
    const want = { risks: 10, affected: 10, afterRisks: 7, resolved: 4, newRisks: 1, planOnly: 2, links: 20 };
    expect(tally("A")).toEqual(want);
    expect(tally("B")).toEqual(want);
  });
});
