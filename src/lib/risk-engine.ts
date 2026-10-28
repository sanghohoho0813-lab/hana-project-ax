/**
 * 복수 현장 연쇄위험 사전판단 엔진 (규칙 기반)
 *
 * - 같은 작업자·같은 날짜의 일정을 시간순으로 연결하고, 선행 현장의 예상 종료시각과
 *   현장 간 이동 필요시간으로 후속 현장의 예상 도착·여유(부족)·위험등급을 계산한다.
 * - 선행 현장의 지연은 작업시간을 유지한 채 다음 현장, 그다음 현장으로 전파한다.
 * - AI·통계 예측이 아니다. 판단은 모두 아래 RISK_RULES 에 적힌 규칙으로만 한다.
 * - 순수 함수다. 현재 시각을 스스로 읽지 않고(기준시각은 옵션으로 받는다), 입력이 같으면 결과가 같다.
 * - 일정이나 담당자를 바꾸지 않는다. 관리자가 확인할 항목만 돌려준다.
 * - 이 파일은 다른 모듈을 가져오지 않는다 (독립 테스트용).
 */

export const RISK_RULE_VERSION = "chain-risk/1.0.0";

/** 등급 기준 (분) */
export const THRESHOLDS = {
  /** 여유가 이보다 작으면 '주의' */
  cautionBufferMin: 10,
  /** 부족분이 이 이상이면 '높음' */
  highShortfallMin: 10,
  /** 부족분이 이 이상이면 '매우 높음' */
  criticalShortfallMin: 30,
} as const;

/* ── 입력 ─────────────────────────────────────────── */

export type SiteStatus = "예정" | "진행 중" | "완료" | "취소";
/** 예상 종료시각을 누가 알려줬는지 */
export type ReportedEndSource = "현장 보고" | "관리자 입력";
/** 계산에 쓴 종료시각의 출처 */
export type EndSource =
  | "실제 종료"
  | ReportedEndSource
  | "추정 규칙"
  | "연쇄 계산"
  | "예정";
/** 이동시간 출처 — 실시간 교통정보가 아니다 */
export type TravelSource = "입력값" | "데모 가정값";

export interface SiteInput {
  id: string;
  title: string;
  workerId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  plannedStart: string;
  plannedEnd: string;
  status: SiteStatus;
  region?: string;
  /** 실제 종료 시각 (완료 보고) */
  actualEnd?: string;
  /** 예상 종료 시각 (현장 보고 또는 관리자 입력) */
  expectedEnd?: string;
  expectedEndSource?: ReportedEndSource;
  /** 직전 현장에서 이 현장까지 이동하는 데 필요한 시간(분). 없으면 판단하지 않는다 */
  travelMinutes?: number | null;
  travelSource?: TravelSource;
  /** 이동시간이 어느 현장에서 출발한 기준인지 (알 때만) */
  travelFromId?: string;
}

export interface EvaluateOptions {
  /** 기준시각 YYYY-MM-DDTHH:MM — '진행 중인데 예정 종료가 지난' 일정의 추정에만 쓴다 */
  asOf?: string;
}

/* ── 출력 ─────────────────────────────────────────── */

export type RiskGrade = "없음" | "주의" | "중간" | "높음" | "매우 높음";
export type LinkStatus = "판정" | "판단 보류" | "해당 없음";
export type RiskCause =
  | "정상"
  | "시간 중복"
  | "이동시간 부족"
  | "선행 현장 지연"
  | "연쇄 지연"
  | "데이터 확인 필요"
  | "이미 시작";

export type IssueKind =
  | "작업자 누락"
  | "날짜 오류"
  | "시각 형식 오류"
  | "시간 역전"
  | "예상 종료 오류"
  | "이동시간 누락"
  | "이동 기준 불일치"
  | "중복 데이터";

export interface DataIssue {
  siteId: string;
  kind: IssueKind;
  detail: string;
}

export interface ProjectedSite {
  id: string;
  title: string;
  workerId: string;
  date: string;
  region?: string;
  status: SiteStatus;
  plannedStart: string;
  plannedEnd: string;
  /** 연쇄 영향을 반영한 예상 시작 */
  expectedStart: string;
  /** 연쇄 영향을 반영한 예상 종료 */
  expectedEnd: string;
  endSource: EndSource;
  /** 예상 시작 − 예정 시작 (분) */
  startDelay: number;
  /** 예상 종료 − 예정 종료 (분) */
  endDelay: number;
  /** 지연이 처음 시작된 현장 */
  delayRootId?: string;
}

export interface RiskLink {
  /** `${선행 id}>${후속 id}` */
  key: string;
  workerId: string;
  date: string;
  /** 작업자 하루 중 몇 번째 연결인지 (1부터) */
  order: number;
  prev: {
    id: string;
    title: string;
    region?: string;
    plannedEnd: string;
    expectedEnd: string;
    endSource: EndSource;
    /** 선행 현장 지연 (분) */
    delay: number;
  };
  next: {
    id: string;
    title: string;
    region?: string;
    plannedStart: string;
    status: SiteStatus;
  };
  travel: { minutes: number | null; source: TravelSource | "누락" };
  /** 후속 예정 시작 − 선행 예정 종료 (분) */
  plannedGap: number;
  /** 예상 도착 HH:MM */
  arrival: string | null;
  /** 후속 예정 시작 − 예상 도착 (분). 양수 여유, 음수 부족 */
  slack: number | null;
  /** 부족분 (분) */
  shortfall: number;
  status: LinkStatus;
  grade: RiskGrade | null;
  cause: RiskCause;
  /** 예정값만으로도 걸리는 문제인지 — 기존 정적 충돌 검사가 잡는 것과 같은 조건 */
  staticConflict: boolean;
  /** 이 연결의 지연으로 예상 시작이 늦어지는 후속 현장들 (연쇄 영향) */
  downstream: string[];
  rootId?: string;
  /** 계산 과정 */
  formula: string[];
  /** 판단 근거 */
  reason: string;
  /** 관리자 권장 확인 — 시스템이 자동으로 실행하지 않는다 */
  actions: string[];
  /** 적용 규칙 id */
  rules: string[];
}

export interface RiskResult {
  ruleVersion: string;
  asOf?: string;
  sites: ProjectedSite[];
  links: RiskLink[];
  issues: DataIssue[];
  excluded: { id: string; reason: "취소" | "데이터 오류" | "중복" }[];
}

/* ── 규칙 ─────────────────────────────────────────── */

export const RISK_RULES = [
  { id: "R1", name: "연결", desc: "같은 작업자·같은 날짜의 취소되지 않은 유효 일정을 예정 시작 순으로 연결한다." },
  {
    id: "R2",
    name: "종료시각 결정",
    desc: "선행 현장의 종료시각은 실제 종료 > 예상 종료(현장 보고·관리자 입력) > 추정 규칙 > 예정 종료 순으로 쓰고, 출처를 함께 남긴다.",
  },
  {
    id: "R2-1",
    name: "추정 규칙",
    desc: "진행 중인데 기준시각이 예정 종료를 지났고 종료·예상 보고가 없으면, 종료시각을 최소 기준시각으로 본다.",
  },
  { id: "R3", name: "예상 도착", desc: "예상 도착 = 선행 예상 종료 + 이동 필요시간." },
  {
    id: "R4",
    name: "여유·부족",
    desc: "여유 = 후속 예정 시작 − 예상 도착. 10분 이상 여유 없음, 0~9분 여유 주의, 1~9분 부족 중간, 10~29분 부족 높음, 30분 이상 부족 매우 높음.",
  },
  {
    id: "R5",
    name: "연쇄 전파",
    desc: "후속 현장 예상 시작 = max(예정 시작, 예상 도착). 작업시간을 유지해 예상 종료를 다시 계산하고 다음 연결에 쓴다.",
  },
  { id: "R6", name: "시간 중복", desc: "같은 작업자의 예정 시간이 겹치면 '매우 높음'으로 본다." },
  {
    id: "R7",
    name: "데이터 확인",
    desc: "시각 형식 오류·시간 역전·날짜 오류·이동시간 누락·취소로 인한 이동 기준 불일치가 있으면 판정하지 않고 '판단 보류'로 표시한다.",
  },
  { id: "R8", name: "시작된 일정", desc: "이미 진행 중이거나 완료된 후속 일정은 사전 위험 판정 대상에서 뺀다 (해당 없음)." },
  { id: "R9", name: "자동 변경 금지", desc: "엔진은 권장 확인 항목만 돌려주고 일정·담당자를 바꾸지 않는다." },
] as const;

const GRADE_RANK: Record<RiskGrade, number> = { 없음: 0, 주의: 1, 중간: 2, 높음: 3, "매우 높음": 4 };

export function gradeRank(g: RiskGrade | null | undefined): number {
  return g ? GRADE_RANK[g] : -1;
}

/** 부족분·여유로 등급을 정한다 (R4) */
export function gradeOf(slack: number): RiskGrade {
  if (slack >= THRESHOLDS.cautionBufferMin) return "없음";
  if (slack >= 0) return "주의";
  const short = -slack;
  if (short >= THRESHOLDS.criticalShortfallMin) return "매우 높음";
  if (short >= THRESHOLDS.highShortfallMin) return "높음";
  return "중간";
}

/* ── 시간 ─────────────────────────────────────────── */

const HHMM = /^(\d{2}):(\d{2})$/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "HH:MM" → 분. 형식이 틀리거나 범위를 벗어나면 null */
export function parseHHMM(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = HHMM.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** 분 → "HH:MM" (자정을 넘으면 "익일 HH:MM") */
export function fmtHHMM(min: number): string {
  const day = Math.floor(min / 1440);
  const r = ((min % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
  return day > 0 ? `익일 ${s}` : s;
}

export function isValidDate(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const m = YMD.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function validTravel(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}

/* ── 엔진 ─────────────────────────────────────────── */

interface Valid {
  s: SiteInput;
  ps: number;
  pe: number;
  /** R2 로 정한 자기 종료시각 (연쇄 전) */
  ownEnd: number;
  ownSource: EndSource;
}

interface Breaker {
  id: string;
  /** 위치를 알 수 있으면 예정 시작(분), 모르면 null */
  at: number | null;
  why: "취소" | "데이터 오류";
}

const groupKey = (workerId: string, date: string) => `${workerId}|${date}`;

/** 자기 종료시각 결정 (R2, R2-1) */
function ownEndOf(s: SiteInput, ps: number, pe: number, asOf: { date: string; min: number } | null, issues: DataIssue[]) {
  if (s.status === "완료" && s.actualEnd !== undefined) {
    const a = parseHHMM(s.actualEnd);
    if (a !== null && a > ps) return { end: a, source: "실제 종료" as EndSource };
    issues.push({ siteId: s.id, kind: "예상 종료 오류", detail: `실제 종료 '${s.actualEnd}'를 쓸 수 없어 예정 종료로 계산했습니다.` });
  }
  if (s.expectedEnd !== undefined && s.expectedEnd !== "") {
    const e = parseHHMM(s.expectedEnd);
    if (e !== null && e > ps) return { end: e, source: (s.expectedEndSource ?? "관리자 입력") as EndSource };
    issues.push({
      siteId: s.id,
      kind: "예상 종료 오류",
      detail: `예상 종료 '${s.expectedEnd}'가 형식에 맞지 않거나 시작보다 빨라 사용하지 않았습니다.`,
    });
  }
  if (s.status === "진행 중" && asOf && asOf.date === s.date && asOf.min > pe) {
    return { end: asOf.min, source: "추정 규칙" as EndSource };
  }
  return { end: pe, source: "예정" as EndSource };
}

export function evaluateChainRisk(inputs: SiteInput[], opts: EvaluateOptions = {}): RiskResult {
  const issues: DataIssue[] = [];
  const excluded: RiskResult["excluded"] = [];
  const asOf = (() => {
    if (!opts.asOf) return null;
    const [d, t] = opts.asOf.split("T");
    const min = parseHHMM(t);
    return isValidDate(d) && min !== null ? { date: d, min } : null;
  })();

  // 1) 중복 제거 — 같은 id 는 처음 것만 쓴다
  const seen = new Set<string>();
  const unique: SiteInput[] = [];
  for (const s of inputs) {
    if (seen.has(s.id)) {
      issues.push({ siteId: s.id, kind: "중복 데이터", detail: "같은 일정이 두 번 들어와 처음 것만 판단에 썼습니다." });
      excluded.push({ id: s.id, reason: "중복" });
      continue;
    }
    seen.add(s.id);
    unique.push(s);
  }

  // 2) 검증 — 취소·오류 일정은 빼되, 이동 기준 불일치를 찾기 위해 위치를 기억한다
  const groups = new Map<string, Valid[]>();
  const breakers = new Map<string, Breaker[]>();
  const addBreaker = (s: SiteInput, why: Breaker["why"]) => {
    if (!s.workerId || !isValidDate(s.date)) return;
    const k = groupKey(s.workerId, s.date);
    breakers.set(k, [...(breakers.get(k) ?? []), { id: s.id, at: parseHHMM(s.plannedStart), why }]);
  };

  for (const s of unique) {
    if (s.status === "취소") {
      excluded.push({ id: s.id, reason: "취소" });
      addBreaker(s, "취소");
      continue;
    }
    if (!s.workerId) {
      issues.push({ siteId: s.id, kind: "작업자 누락", detail: "담당 작업자가 없어 연결할 수 없습니다." });
      excluded.push({ id: s.id, reason: "데이터 오류" });
      continue;
    }
    if (!isValidDate(s.date)) {
      issues.push({ siteId: s.id, kind: "날짜 오류", detail: `날짜 '${s.date}'가 올바르지 않습니다.` });
      excluded.push({ id: s.id, reason: "데이터 오류" });
      continue;
    }
    const ps = parseHHMM(s.plannedStart);
    const pe = parseHHMM(s.plannedEnd);
    if (ps === null || pe === null) {
      issues.push({
        siteId: s.id,
        kind: "시각 형식 오류",
        detail: `예정 시각 '${s.plannedStart}~${s.plannedEnd}'를 읽을 수 없습니다 (HH:MM, 00:00~23:59).`,
      });
      excluded.push({ id: s.id, reason: "데이터 오류" });
      addBreaker(s, "데이터 오류");
      continue;
    }
    if (pe <= ps) {
      issues.push({ siteId: s.id, kind: "시간 역전", detail: `종료 ${s.plannedEnd}가 시작 ${s.plannedStart}보다 빠르거나 같습니다.` });
      excluded.push({ id: s.id, reason: "데이터 오류" });
      addBreaker(s, "데이터 오류");
      continue;
    }
    const own = ownEndOf(s, ps, pe, asOf, issues);
    const k = groupKey(s.workerId, s.date);
    groups.set(k, [...(groups.get(k) ?? []), { s, ps, pe, ownEnd: own.end, ownSource: own.source }]);
  }

  const sites: ProjectedSite[] = [];
  const links: RiskLink[] = [];

  // 3) 작업자·날짜별로 시간순 연결
  const keys = [...groups.keys()].sort();
  for (const k of keys) {
    const chain = groups
      .get(k)!
      .slice()
      .sort((a, b) => a.ps - b.ps || a.pe - b.pe || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0));
    const brk = breakers.get(k) ?? [];
    const unknownPos = brk.filter((b) => b.at === null);

    const proj: ProjectedSite[] = [];
    /** 연쇄 반영 예상 종료(분) — 자정을 넘으면 1440 이상 */
    const endMin: number[] = [];
    let order = 0;
    for (let i = 0; i < chain.length; i++) {
      const cur = chain[i];
      const s = cur.s;
      const dur = cur.pe - cur.ps;
      let expStart = cur.ps;
      let expEnd = cur.ownEnd;
      let endSource: EndSource = cur.ownSource;
      let rootId: string | undefined;

      if (i > 0) {
        const prevV = chain[i - 1];
        const prevP = proj[i - 1];
        order += 1;
        const link = buildLink({ prevV, prevP, prevEndMin: endMin[i - 1], cur, order, brk, unknownPos, issues });
        links.push(link);

        // 연쇄 전파 (R5) — 아직 시작 전인 후속 현장만
        if (link.status === "판정" && link.slack !== null && link.slack < 0 && s.status === "예정") {
          expStart = cur.ps + link.shortfall;
          rootId = prevP.delayRootId ?? prevP.id;
          if (expStart + dur > expEnd) {
            expEnd = expStart + dur;
            endSource = "연쇄 계산";
          }
        }
      }
      if (!rootId && expEnd > cur.pe) rootId = s.id;
      endMin.push(expEnd);

      proj.push({
        id: s.id,
        title: s.title,
        workerId: s.workerId,
        date: s.date,
        region: s.region,
        status: s.status,
        plannedStart: fmtHHMM(cur.ps),
        plannedEnd: fmtHHMM(cur.pe),
        expectedStart: fmtHHMM(expStart),
        expectedEnd: fmtHHMM(expEnd),
        endSource,
        startDelay: expStart - cur.ps,
        endDelay: expEnd - cur.pe,
        delayRootId: expEnd > cur.pe || expStart > cur.ps ? rootId : undefined,
      });
    }

    // 연쇄 영향 — 지연된 연결 뒤로 예상 시작이 늦어지는 현장을 모은다
    const chainLinks = links.filter((l) => groupKey(l.workerId, l.date) === k);
    chainLinks.forEach((l) => {
      if (l.shortfall <= 0 || l.status !== "판정") return;
      const from = proj.findIndex((p) => p.id === l.next.id);
      for (let j = from; j >= 0 && j < proj.length; j++) {
        if (proj[j].startDelay > 0) l.downstream.push(proj[j].id);
        else break;
      }
      l.rootId = proj.find((p) => p.id === l.prev.id)?.delayRootId;
    });

    sites.push(...proj);
  }

  return { ruleVersion: RISK_RULE_VERSION, asOf: opts.asOf, sites, links, issues, excluded };
}

function buildLink(a: {
  prevV: Valid;
  prevP: ProjectedSite;
  prevEndMin: number;
  cur: Valid;
  order: number;
  brk: Breaker[];
  unknownPos: Breaker[];
  issues: DataIssue[];
}): RiskLink {
  const { prevV, prevP, prevEndMin, cur, order, brk, unknownPos, issues } = a;
  const next = cur.s;
  const prevDelay = prevEndMin - prevV.pe;
  const travel = validTravel(next.travelMinutes);
  const plannedGap = cur.ps - prevV.pe;

  const base: RiskLink = {
    key: `${prevV.s.id}>${next.id}`,
    workerId: next.workerId,
    date: next.date,
    order,
    prev: {
      id: prevV.s.id,
      title: prevV.s.title,
      region: prevV.s.region,
      plannedEnd: fmtHHMM(prevV.pe),
      expectedEnd: fmtHHMM(prevEndMin),
      endSource: prevP.endSource,
      delay: prevDelay,
    },
    next: { id: next.id, title: next.title, region: next.region, plannedStart: fmtHHMM(cur.ps), status: next.status },
    travel: { minutes: travel, source: travel === null ? "누락" : (next.travelSource ?? "입력값") },
    plannedGap,
    arrival: null,
    slack: null,
    shortfall: 0,
    status: "판정",
    grade: null,
    cause: "정상",
    staticConflict: plannedGap < 0 || (travel !== null && travel > plannedGap),
    downstream: [],
    formula: [],
    reason: "",
    actions: [],
    rules: ["R1", "R2"],
  };

  const hold = (why: string, actions: string[], kind?: IssueKind) => {
    if (kind) issues.push({ siteId: next.id, kind, detail: why });
    return { ...base, status: "판단 보류" as LinkStatus, cause: "데이터 확인 필요" as RiskCause, reason: why, actions, rules: [...base.rules, "R7", "R9"] };
  };

  // 이미 시작·완료된 후속 일정 (R8)
  if (next.status !== "예정") {
    return {
      ...base,
      status: "해당 없음",
      cause: "이미 시작",
      reason: `${next.title} 일정은 이미 ${next.status === "완료" ? "완료" : "시작"}되어 사전 위험 판정 대상이 아닙니다.`,
      rules: [...base.rules, "R8"],
    };
  }
  // 같은 날 위치를 알 수 없는 오류 일정이 있으면 연결 순서를 확정할 수 없다 (R7)
  if (unknownPos.length > 0) {
    return hold(`같은 날 시각을 읽을 수 없는 일정(${unknownPos.map((b) => b.id).join(", ")})이 있어 현장 연결 순서를 확정할 수 없습니다.`, [
      "해당 일정의 시각 입력 확인",
    ]);
  }
  // 사이에 취소·오류 일정이 있거나, 이동 출발 현장이 다르면 이동시간 기준이 맞지 않는다 (R7)
  const between = brk.filter((b) => b.at !== null && b.at > prevV.ps && b.at < cur.ps);
  if (between.length > 0 || (next.travelFromId && next.travelFromId !== prevV.s.id)) {
    const what =
      between.length > 0
        ? `사이 일정(${between.map((b) => `${b.id} ${b.why}`).join(", ")})`
        : `이동 출발 현장(${next.travelFromId})`;
    return hold(
      `${what} 때문에 ${next.title}의 이동시간이 ${prevV.s.title}에서 출발하는 기준인지 알 수 없습니다.`,
      [`${prevV.s.title} → ${next.title} 이동시간 재확인`],
      "이동 기준 불일치",
    );
  }
  if (travel === null) {
    return hold(`${prevV.s.title} → ${next.title} 이동 필요시간이 없어 도착 가능 여부를 판단하지 않았습니다.`, ["이동 필요시간 입력"], "이동시간 누락");
  }

  // 계산 (R3, R4)
  const arrival = prevEndMin + travel;
  const slack = cur.ps - arrival;
  const shortfall = Math.max(0, -slack);
  const overlap = plannedGap < 0;
  const plannedSlack = plannedGap - travel;
  const grade: RiskGrade = overlap ? "매우 높음" : gradeOf(slack);
  const cause: RiskCause = overlap
    ? "시간 중복"
    : slack >= 0
      ? "정상"
      : plannedSlack < 0
        ? "이동시간 부족"
        : prevP.endSource === "연쇄 계산"
          ? "연쇄 지연"
          : "선행 현장 지연";

  const rules = [...base.rules, "R3", "R4"];
  if (prevP.endSource === "추정 규칙") rules.push("R2-1");
  if (prevP.endSource === "연쇄 계산" || shortfall > 0) rules.push("R5");
  if (overlap) rules.push("R6");
  rules.push("R9");

  const prevEndLabel = fmtHHMM(prevEndMin);
  const formula: string[] = [];
  formula.push(`${prevV.s.title} 예상 종료 ${prevEndLabel} (${prevP.endSource})`);
  if (prevDelay !== 0) formula.push(`선행 지연 = ${prevEndLabel} − 예정 종료 ${fmtHHMM(prevV.pe)} = ${prevDelay}분`);
  formula.push(`예상 도착 = ${prevEndLabel} + 이동 ${travel}분 = ${fmtHHMM(arrival)}`);
  formula.push(
    `여유 = ${next.title} 예정 시작 ${fmtHHMM(cur.ps)} − 예상 도착 ${fmtHHMM(arrival)} = ${slack}분` +
      (slack < 0 ? ` → ${shortfall}분 부족` : ""),
  );
  if (overlap) formula.push(`예정 시간 겹침 = ${-plannedGap}분 (${fmtHHMM(cur.ps)} 시작 < ${fmtHHMM(prevV.pe)} 종료)`);

  const reason =
    cause === "시간 중복"
      ? `두 일정의 예정 시간이 ${-plannedGap}분 겹칩니다. 같은 작업자가 같은 시간에 두 현장에 있을 수 없습니다.`
      : cause === "정상"
        ? `예상 도착 ${fmtHHMM(arrival)}, 후속 현장 시작까지 ${slack}분 여유가 있습니다.` +
          (grade === "주의" ? ` 여유가 ${THRESHOLDS.cautionBufferMin}분 미만이라 주의가 필요합니다.` : "")
        : cause === "이동시간 부족"
          ? `예정 종료 ${fmtHHMM(prevV.pe)}에 이동 ${travel}분을 더하면 예정대로 진행해도 후속 현장 시작 ${fmtHHMM(cur.ps)}보다 늦습니다` +
            (prevDelay > 0 ? `. 선행 현장 지연 ${prevDelay}분까지 반영하면 ${shortfall}분 부족합니다.` : ` (${shortfall}분 부족).`)
          : cause === "연쇄 지연"
            ? `앞선 현장의 지연이 ${prevV.s.title}의 시작과 종료를 늦추고, 그 영향으로 후속 현장 예정 시작 ${fmtHHMM(cur.ps)}보다 ${shortfall}분 늦게 도착합니다.`
            : `선행 현장의 종료 지연(${prevDelay}분)과 현장 간 이동시간(${travel}분)을 합산하면 후속 현장 예정 시작 ${fmtHHMM(cur.ps)}을 ${shortfall}분 초과합니다. 후속 현장은 아직 시작 전이지만 늦어질 가능성이 있습니다.`;

  const actions: string[] = [];
  if (prevP.endSource === "추정 규칙" && grade !== "없음") actions.push("현장에 종료 예상시각 보고 요청");
  if (cause === "시간 중복") actions.push("중복 배정 확인", "담당자 또는 시간 조정 검토");
  else if (grade === "주의") actions.push("선행 현장 종료 예상시각 확인");
  else if (gradeRank(grade) >= GRADE_RANK["중간"]) {
    if (cause === "이동시간 부족") actions.push("일정 시간 또는 이동시간 재확인");
    else actions.push("선행 현장 진행상황 확인");
    actions.push("후속 현장 일정 조정 검토");
    if (gradeRank(grade) >= GRADE_RANK["높음"]) actions.push("대체 작업자 가능 여부 확인", "후속 현장 고객에게 지연 가능성 안내 검토");
  }

  return {
    ...base,
    arrival: fmtHHMM(arrival),
    slack,
    shortfall,
    grade,
    cause,
    formula,
    reason,
    actions,
    rules,
  };
}

/* ── 요약·비교 ─────────────────────────────────────── */

/** 위험으로 보는 연결 — 판정됐고 '중간' 이상 */
export function riskyLinks(r: RiskResult): RiskLink[] {
  return r.links.filter((l) => l.status === "판정" && gradeRank(l.grade) >= GRADE_RANK["중간"]);
}

export function summarize(r: RiskResult) {
  const count = (g: RiskGrade) => r.links.filter((l) => l.status === "판정" && l.grade === g).length;
  return {
    links: r.links.length,
    risky: riskyLinks(r).length,
    byGrade: { 없음: count("없음"), 주의: count("주의"), 중간: count("중간"), 높음: count("높음"), "매우 높음": count("매우 높음") },
    held: r.links.filter((l) => l.status === "판단 보류").length,
    notApplicable: r.links.filter((l) => l.status === "해당 없음").length,
    issues: r.issues.length,
  };
}

export type ChangeKind = "신규 위험" | "악화" | "완화" | "해소" | "유지" | "연결 생김" | "연결 해제" | "판단 상태 변경";

export interface LinkChange {
  key: string;
  kind: ChangeKind;
  before: { status: LinkStatus; grade: RiskGrade | null; slack: number | null } | null;
  after: { status: LinkStatus; grade: RiskGrade | null; slack: number | null } | null;
}

export interface RiskDiff {
  ruleVersion: string;
  changes: LinkChange[];
  /** 예상 시작·종료가 바뀐 현장 */
  affectedSites: { id: string; before: { start: string; end: string } | null; after: { start: string; end: string } | null }[];
}

/** 변경 전후 판단 결과를 비교한다 — 판단 이력에 쓴다 */
export function diffRisk(before: RiskResult, after: RiskResult): RiskDiff {
  const b = new Map(before.links.map((l) => [l.key, l]));
  const a = new Map(after.links.map((l) => [l.key, l]));
  const keys = [...new Set([...b.keys(), ...a.keys()])].sort();
  const snap = (l?: RiskLink) => (l ? { status: l.status, grade: l.grade, slack: l.slack } : null);
  const risky = (l?: RiskLink) => !!l && l.status === "판정" && gradeRank(l.grade) >= GRADE_RANK["중간"];

  const changes: LinkChange[] = [];
  for (const k of keys) {
    const x = b.get(k);
    const y = a.get(k);
    let kind: ChangeKind;
    if (!x) kind = risky(y) ? "신규 위험" : "연결 생김";
    else if (!y) kind = "연결 해제";
    else if (x.status !== y.status) kind = risky(y) ? "신규 위험" : risky(x) ? "해소" : "판단 상태 변경";
    else {
      const d = gradeRank(y.grade) - gradeRank(x.grade);
      if (d > 0) kind = risky(x) ? "악화" : risky(y) ? "신규 위험" : "악화";
      else if (d < 0) kind = risky(x) && !risky(y) ? "해소" : "완화";
      else kind = "유지";
      if (kind === "유지" && x.slack === y.slack) continue;
    }
    changes.push({ key: k, kind, before: snap(x), after: snap(y) });
  }

  const bs = new Map(before.sites.map((s) => [s.id, s]));
  const as = new Map(after.sites.map((s) => [s.id, s]));
  const ids = [...new Set([...bs.keys(), ...as.keys()])].sort();
  const affectedSites: RiskDiff["affectedSites"] = [];
  for (const id of ids) {
    const x = bs.get(id);
    const y = as.get(id);
    const xs = x ? { start: x.expectedStart, end: x.expectedEnd } : null;
    const ys = y ? { start: y.expectedStart, end: y.expectedEnd } : null;
    if (JSON.stringify(xs) !== JSON.stringify(ys)) affectedSites.push({ id, before: xs, after: ys });
  }
  return { ruleVersion: after.ruleVersion, changes, affectedSites };
}
