/**
 * 관리자 대응 우선순위 엔진 (규칙 기반 점수)
 *
 * 연쇄위험 판단 결과(RiskResult)를 받아 '무엇부터 확인할지' 순서를 정한다.
 * - 점수는 관리자 의사결정 보조용이다. 사고 확률·발생률이 아니며 통계적 타당성은 검증되지 않았다.
 * - 가중치는 '초기 운영 가정값'이며 설정(PriorityConfig)으로 바꿀 수 있다.
 * - 같은 입력이면 항상 같은 순서가 나온다 (동점이면 가장 이른 영향 현장 시작 → 항목 키 순).
 * - 같은 후속 현장의 위험은 한 항목에만 들어간다 (지연 출발점이 같은 연쇄는 한 항목으로 묶음).
 * - 판단 보류 연결은 점수를 매기지 않고 '데이터 확인 대상'으로 따로 돌려준다.
 * - 일정을 바꾸지 않는다.
 */
import { gradeRank, parseAsOf, parseHHMM, type RiskGrade, type RiskLink, type RiskResult } from "./risk-engine";

export const PRIORITY_VERSION = "response-priority/1.0.0";

export const PRIORITY_RULES = [
  { id: "P1", name: "묶음·중복 방지", desc: "같은 지연 출발점에서 나온 연쇄 위험은 한 항목으로 묶는다. 이동시간 부족·일정 중복은 연결별 항목. 각 후속 현장은 한 항목에만 들어가 두 번 집계되지 않는다." },
  { id: "P2", name: "점수", desc: "점수 = 위험등급 기본점수 + 예상 지연(상한 적용) + 추가 영향 현장 + 대응 시한 + 업무 중요도. 가중치는 초기 운영 가정값(설정으로 변경 가능). 데이터가 없는 요소는 0점." },
  { id: "P3", name: "정렬·보류", desc: "점수 내림차순 → 가장 이른 영향 현장 시작 → 항목 키 순. 판단 보류 연결은 점수 없이 '데이터 확인 대상'으로 따로 둔다." },
] as const;

export interface PriorityConfig {
  /** 위험등급별 기본점수 */
  gradePoints: Record<"중간" | "높음" | "매우 높음", number>;
  /** 예상 지연 1분당 점수 */
  perShortfallMin: number;
  /** 예상 지연 반영 상한 (분) — 한 요소가 점수를 독차지하지 않게 */
  shortfallCapMin: number;
  /** 영향받는 후속 현장이 1곳보다 많을 때 추가 1곳당 점수 */
  perExtraSite: number;
  /** 대응 시한(가장 이른 영향 현장의 예정 시작까지 남은 시간) 구간별 점수 — 위에서부터 처음 맞는 구간 */
  urgency: { withinMin: number; points: number }[];
  /** 연결된 업무의 우선순위 점수 — 연결된 업무가 없으면 0점 (데이터 없음은 높게 평가하지 않음) */
  taskPriorityPoints: Record<"긴급" | "보통" | "낮음", number>;
}

/** 초기 운영 가정값 — 실증 데이터로 정한 값이 아니다 */
export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  gradePoints: { 중간: 20, 높음: 40, "매우 높음": 60 },
  perShortfallMin: 1,
  shortfallCapMin: 60,
  perExtraSite: 10,
  urgency: [
    { withinMin: 30, points: 15 },
    { withinMin: 60, points: 10 },
    { withinMin: 120, points: 5 },
  ],
  taskPriorityPoints: { 긴급: 10, 보통: 0, 낮음: 0 },
};

/** 일정별 업무 정보 (있을 때만) */
export interface SiteMeta {
  siteId: string;
  priority?: "긴급" | "보통" | "낮음";
}

export interface ScoreFactor {
  factor: "위험등급" | "예상 지연" | "후속 현장 영향" | "대응 시한" | "업무 중요도";
  value: string;
  points: number;
  reason: string;
}

export type PriorityKind = "작업지연 위험" | "이동시간 부족" | "일정 중복";

export interface PriorityItem {
  rank: number;
  /** 묶음 키 — root:<지연 출발 현장> 또는 link:<연결 키> */
  key: string;
  kind: PriorityKind;
  title: string;
  grade: RiskGrade;
  /** 묶음 안 가장 큰 예상 지연 (분) */
  maxShortfall: number;
  /** 지연 출발 현장 (작업지연 위험일 때) */
  root?: { id: string; title: string };
  /** 영향받는 후속 현장 — 각 현장은 한 항목에만 들어간다 */
  sites: { id: string; title: string; plannedStart: string; shortfall: number; grade: RiskGrade }[];
  /** 가장 이른 영향 현장 예정 시작 */
  earliestStart: string;
  /** 기준시각부터 가장 이른 영향 현장 시작까지 (분, 기준시각이 없으면 null) */
  minutesUntil: number | null;
  score: number;
  breakdown: ScoreFactor[];
  basis: string;
  actions: string[];
  linkKeys: string[];
}

export interface HeldItem {
  key: string;
  title: string;
  reason: string;
  actions: string[];
}

export interface PriorityResult {
  version: string;
  ruleVersion: string;
  asOf?: string;
  config: PriorityConfig;
  items: PriorityItem[];
  /** 판단 보류 — 위험 없음이 아니라 데이터 확인 대상 */
  held: HeldItem[];
  /** 위험은 아니지만 여유가 적은 연결 (주의) */
  watch: string[];
}

const KIND_OF = (l: RiskLink): PriorityKind =>
  l.cause === "시간 중복" ? "일정 중복" : l.cause === "이동시간 부족" ? "이동시간 부족" : "작업지연 위험";

/** 같은 연쇄(같은 지연 출발점)는 한 묶음으로 — 같은 후속 현장을 두 번 세지 않는다 */
function groupKeyOf(l: RiskLink): string {
  if (l.cause === "시간 중복" || l.cause === "이동시간 부족") return `link:${l.key}`;
  return `root:${l.workerId}|${l.date}|${l.rootId ?? l.prev.id}`;
}

export function rankResponses(
  r: RiskResult,
  opts: { asOf?: string; meta?: SiteMeta[]; config?: PriorityConfig } = {},
): PriorityResult {
  const cfg = opts.config ?? DEFAULT_PRIORITY_CONFIG;
  const asOf = parseAsOf(opts.asOf ?? r.asOf);
  const meta = new Map((opts.meta ?? []).map((m) => [m.siteId, m]));
  const title = (id: string) => r.sites.find((s) => s.id === id)?.title ?? id;

  const risky = r.links.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2);
  const groups = new Map<string, RiskLink[]>();
  for (const l of risky) groups.set(groupKeyOf(l), [...(groups.get(groupKeyOf(l)) ?? []), l]);

  const items: PriorityItem[] = [];
  for (const [key, ls] of groups) {
    const links = ls.slice().sort((a, b) => a.order - b.order);
    const first = links[0];
    const kind = KIND_OF(first);
    const grade = links.reduce<RiskGrade>((g, l) => (gradeRank(l.grade) > gradeRank(g) ? (l.grade as RiskGrade) : g), first.grade as RiskGrade);
    const maxShortfall = Math.max(...links.map((l) => l.shortfall));
    const sites = links.map((l) => ({ id: l.next.id, title: l.next.title, plannedStart: l.next.plannedStart, shortfall: l.shortfall, grade: l.grade as RiskGrade }));
    const earliest = sites.map((s) => parseHHMM(s.plannedStart) ?? 0).reduce((m, v) => Math.min(m, v), Infinity);
    const sameDay = asOf && asOf.date === first.date;
    const minutesUntil = sameDay ? Math.max(0, earliest - asOf.min) : null;
    const rootId = kind === "작업지연 위험" ? (first.rootId ?? first.prev.id) : undefined;

    // 점수 계산 — 요소별 근거를 함께 남긴다
    const breakdown: ScoreFactor[] = [];
    const gp = cfg.gradePoints[grade as "중간" | "높음" | "매우 높음"];
    breakdown.push({ factor: "위험등급", value: grade, points: gp, reason: `등급별 기본점수 (${grade} = ${gp}점)` });
    const capped = Math.min(maxShortfall, cfg.shortfallCapMin);
    breakdown.push({
      factor: "예상 지연",
      value: `${maxShortfall}분`,
      points: capped * cfg.perShortfallMin,
      reason: `가장 큰 예상 지연 ${capped}분 × ${cfg.perShortfallMin}점${maxShortfall > cfg.shortfallCapMin ? ` (상한 ${cfg.shortfallCapMin}분)` : ""}`,
    });
    const extra = Math.max(0, sites.length - 1);
    breakdown.push({
      factor: "후속 현장 영향",
      value: `${sites.length}곳`,
      points: extra * cfg.perExtraSite,
      reason: extra > 0 ? `영향 현장 ${sites.length}곳 — 첫 현장 외 ${extra}곳 × ${cfg.perExtraSite}점` : "영향 현장 1곳 — 추가 점수 없음",
    });
    const band = minutesUntil === null ? undefined : cfg.urgency.find((u) => minutesUntil <= u.withinMin);
    breakdown.push({
      factor: "대응 시한",
      value: minutesUntil === null ? "기준시각 없음" : `${minutesUntil}분 남음`,
      points: band?.points ?? 0,
      reason:
        minutesUntil === null
          ? "기준시각이 없어 시한 점수를 매기지 않음"
          : band
            ? `가장 이른 영향 현장 시작 ${fmt(earliest)}까지 ${minutesUntil}분 (${band.withinMin}분 이내 = ${band.points}점)`
            : `가장 이른 영향 현장 시작 ${fmt(earliest)}까지 ${minutesUntil}분 — 시한 점수 없음`,
    });
    const prios = sites.map((s) => meta.get(s.id)?.priority).filter((p): p is "긴급" | "보통" | "낮음" => !!p);
    const topPrio = prios.includes("긴급") ? "긴급" : prios.includes("보통") ? "보통" : prios.includes("낮음") ? "낮음" : undefined;
    breakdown.push({
      factor: "업무 중요도",
      value: topPrio ?? "연결 업무 없음",
      points: topPrio ? cfg.taskPriorityPoints[topPrio] : 0,
      reason: topPrio ? `영향 현장에 연결된 업무 우선순위 '${topPrio}' = ${cfg.taskPriorityPoints[topPrio]}점` : "연결된 업무 정보가 없어 0점 (데이터 없음은 높게 평가하지 않음)",
    });
    const score = breakdown.reduce((n, f) => n + f.points, 0);

    const siteNames = sites.map((s) => s.title).join(", ");
    const basis =
      kind === "작업지연 위험"
        ? `선행 현장(${title(rootId!)}) 작업지연이 후속 일정 ${sites.length}곳(${siteNames})에 영향을 미칩니다. 가장 큰 예상 지연 ${maxShortfall}분.`
        : kind === "이동시간 부족"
          ? `이동 가능시간이 필요 이동시간보다 ${maxShortfall}분 부족합니다 (${first.prev.title} → ${first.next.title}).`
          : `${first.prev.title}와 ${first.next.title}의 예정 시간이 겹칩니다.`;
    const actions = [...new Set(links.flatMap((l) => l.actions))];

    items.push({
      rank: 0,
      key,
      kind,
      title: `${sites[0].title} ${kind}`,
      grade,
      maxShortfall,
      root: rootId ? { id: rootId, title: title(rootId) } : undefined,
      sites,
      earliestStart: fmt(earliest),
      minutesUntil,
      score,
      breakdown,
      basis,
      actions,
      linkKeys: links.map((l) => l.key),
    });
  }

  items.sort((a, b) => b.score - a.score || (parseHHMM(a.earliestStart) ?? 0) - (parseHHMM(b.earliestStart) ?? 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  items.forEach((it, i) => (it.rank = i + 1));

  const held: HeldItem[] = r.links
    .filter((l) => l.status === "판단 보류")
    .map((l) => ({ key: l.key, title: `${l.prev.title} → ${l.next.title}`, reason: l.reason, actions: l.actions }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  const watch = r.links.filter((l) => l.status === "판정" && l.grade === "주의").map((l) => l.key).sort();

  return { version: PRIORITY_VERSION, ruleVersion: r.ruleVersion, asOf: opts.asOf ?? r.asOf, config: cfg, items, held, watch };
}

function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export interface PriorityChange {
  key: string;
  title: string;
  before: number | null;
  after: number | null;
  beforeScore: number | null;
  afterScore: number | null;
  kind: "신규" | "상승" | "하락" | "유지" | "해소";
}

/** 우선순위 변경 전후 비교 — 조치 후 재판단 기록에 쓴다 */
export function diffPriority(before: PriorityResult, after: PriorityResult): PriorityChange[] {
  const b = new Map(before.items.map((i) => [i.key, i]));
  const a = new Map(after.items.map((i) => [i.key, i]));
  const keys = [...new Set([...b.keys(), ...a.keys()])].sort();
  return keys
    .map((k) => {
      const x = b.get(k);
      const y = a.get(k);
      const kind: PriorityChange["kind"] = !x ? "신규" : !y ? "해소" : y.rank < x.rank ? "상승" : y.rank > x.rank ? "하락" : "유지";
      return { key: k, title: (y ?? x)!.title, before: x?.rank ?? null, after: y?.rank ?? null, beforeScore: x?.score ?? null, afterScore: y?.score ?? null, kind };
    })
    .sort((p, q) => (p.after ?? 99) - (q.after ?? 99) || (p.before ?? 99) - (q.before ?? 99));
}
