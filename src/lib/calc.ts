import { OPPORTUNITIES, SECOND_HALF_ASSUMPTION } from "./data";
import type { ChangeOrder, Opportunity, Project } from "./types";

/* ── 프로젝트 단위 계산 ───────────────────────────── */

export function totalBudget(p: Project): number {
  return p.costs.reduce((s, c) => s + c.budget, 0);
}

export function totalActual(p: Project): number {
  return p.costs.reduce((s, c) => s + c.actual, 0);
}

/** 최초 예상이익 = 계약금액 - 최초 예상원가 */
export function initialProfit(p: Project): number {
  return p.contractAmount - totalBudget(p);
}

/** 예상이익 감소분 (원가 상승 요인 합계) */
export function profitDrop(p: Project): number {
  return p.profitRisks.reduce((s, r) => s + r.amount, 0);
}

/** 현재 예상이익 — 완료 공사는 실제 투입원가 기준 */
export function currentProfit(p: Project): number {
  if (p.statusKey === "done") return p.contractAmount - totalActual(p);
  return initialProfit(p) - profitDrop(p);
}

/** 예상 최종원가 */
export function revisedCost(p: Project): number {
  if (p.statusKey === "done") return totalActual(p);
  return totalBudget(p) + profitDrop(p);
}

export function profitRate(p: Project): number {
  return Math.round((currentProfit(p) / p.contractAmount) * 100);
}

/** 원가 투입률 = 현재 투입원가 / 최초 예상원가 */
export function costInputRate(p: Project): number {
  const b = totalBudget(p);
  return b === 0 ? 0 : Math.round((totalActual(p) / b) * 100);
}

export function collectRate(p: Project): number {
  return Math.round((p.payment.received / p.contractAmount) * 100);
}

export function receivable(p: Project): number {
  return Math.max(0, p.payment.billed - p.payment.received);
}

/** 원가 투입률 - 공정률 (양수가 클수록 위험) */
export function costRiskGap(p: Project): number {
  return costInputRate(p) - p.progress;
}

export function isCostRisk(p: Project): boolean {
  return p.statusKey !== "done" && costRiskGap(p) >= 8;
}

/** 공정률 대비 초과 투입된 원가 항목 */
export function overrunItems(p: Project) {
  return p.costs
    .map((c) => ({
      name: c.name,
      expected: Math.round((c.budget * p.progress) / 100),
      actual: c.actual,
      over: c.actual - Math.round((c.budget * p.progress) / 100),
    }))
    .filter((c) => c.over > 0)
    .sort((a, b) => b.over - a.over);
}

export function closeoutDone(p: Project): number {
  return p.closeoutDocs.filter((d) => d.done).length;
}

export function missingCloseoutDocs(p: Project): string[] {
  return p.closeoutDocs.filter((d) => !d.done).map((d) => d.name);
}

/* ── 영업기회 계산 ───────────────────────────────── */

/** 예상금액 × 수주 가능성 */
export function weightedAmount(o: Opportunity): number {
  return Math.round((o.amount * o.probability) / 100);
}

export function isOpenStage(o: Opportunity): boolean {
  return o.stage !== "won" && o.stage !== "hold";
}

/** 견적을 보낸 지 3일 이상 지나 후속 연락이 필요한 건 */
export function needsFollowUp(o: Opportunity): boolean {
  return isOpenStage(o) && (o.sentDaysAgo ?? 0) >= 3;
}

/* ── 회사 전체 KPI (전부 위 데이터에서 파생) ───────── */

export interface CompanyKpi {
  /** 올해 계약된 공사 총액 (완료 + 진행 + 확정계약) */
  yearOrders: number;
  yearOrdersDone: number;
  yearOrdersActive: number;
  yearOrdersConfirmed: number;
  /** 파이프라인 가중 예상매출 */
  pipelineWeighted: number;
  /** 하반기 통상 신규수주 가정 */
  secondHalfAssumption: number;
  /** 예상 연매출 */
  yearForecast: number;
  activeCount: number;
  /** 청구했으나 아직 못 받은 돈 */
  receivables: number;
  overdueReceivables: number;
  /** 지금 청구 가능한 잔금 */
  claimableBalance: number;
  /** 앞으로 받을 돈 = 미수금 + 청구 가능 잔금 */
  collectible: number;
  /** 이번 달 회수 예정금액 */
  expectedThisMonth: number;
  /** 미승인 추가공사 금액 */
  unapprovedChangeOrders: number;
  /** 후속 연락이 필요한 견적의 가중금액 */
  staleQuoteWeighted: number;
  /** 위험·누락 가능금액 */
  atRisk: number;
  riskProjectCount: number;
  /** 다음 달(8월) 예상 신규수주 */
  nextMonthOrders: number;
  nextMonthConfirmed: number;
  nextMonthWeighted: number;
}

export function companyKpi(
  projects: Project[],
  opportunities: Opportunity[] = OPPORTUNITIES,
  changeOrders: ChangeOrder[] = []
): CompanyKpi {
  const done = projects.filter((p) => p.statusKey === "done");
  const active = projects.filter((p) => p.statusKey !== "done");
  const won = opportunities.filter((o) => o.stage === "won");

  const yearOrdersDone = done.reduce((s, p) => s + p.contractAmount, 0);
  const yearOrdersActive = active.reduce((s, p) => s + p.contractAmount, 0);
  const yearOrdersConfirmed = won.reduce((s, o) => s + o.amount, 0);
  const yearOrders = yearOrdersDone + yearOrdersActive + yearOrdersConfirmed;

  const pipelineWeighted = opportunities
    .filter(isOpenStage)
    .reduce((s, o) => s + weightedAmount(o), 0);

  const receivables = projects.reduce((s, p) => s + receivable(p), 0);
  const overdueReceivables = projects
    .filter((p) => (p.payment.overdueDays ?? 0) > 0)
    .reduce((s, p) => s + receivable(p), 0);
  const claimableBalance = projects
    .filter((p) => p.payment.balanceClaimable)
    .reduce((s, p) => s + p.payment.balance, 0);
  const expectedThisMonth = projects.reduce(
    (s, p) => s + p.payment.expectedThisMonth,
    0
  );

  const unapprovedChangeOrders = changeOrders
    .filter((c) => c.verbalOnly || c.status === "승인 대기")
    .reduce((s, c) => s + c.addRevenue, 0);
  const staleQuoteWeighted = opportunities
    .filter(needsFollowUp)
    .reduce((s, o) => s + weightedAmount(o), 0);

  const nextMonthConfirmed = won
    .filter((o) => o.expectedCloseMonth === 8)
    .reduce((s, o) => s + o.amount, 0);
  const nextMonthWeighted = opportunities
    .filter((o) => isOpenStage(o) && o.expectedCloseMonth === 8)
    .reduce((s, o) => s + weightedAmount(o), 0);

  return {
    yearOrders,
    yearOrdersDone,
    yearOrdersActive,
    yearOrdersConfirmed,
    pipelineWeighted,
    secondHalfAssumption: SECOND_HALF_ASSUMPTION,
    yearForecast: yearOrders + pipelineWeighted + SECOND_HALF_ASSUMPTION,
    activeCount: active.length,
    receivables,
    overdueReceivables,
    claimableBalance,
    collectible: receivables + claimableBalance,
    expectedThisMonth,
    unapprovedChangeOrders,
    staleQuoteWeighted,
    atRisk: claimableBalance + unapprovedChangeOrders + staleQuoteWeighted,
    riskProjectCount: active.filter(
      (p) => isCostRisk(p) || p.statusKey === "delayed" || p.statusKey === "caution"
    ).length,
    nextMonthOrders: nextMonthConfirmed + nextMonthWeighted,
    nextMonthConfirmed,
    nextMonthWeighted,
  };
}

/** 하나인사이트 KPI */
export function consultingKpi(projects: Project[]) {
  const managed = projects.filter((p) => p.consulting.scope.length > 0);
  return {
    managedCount: managed.length,
    monthRevenue: managed
      .filter((p) => p.consulting.feeStatus === "정산 예정")
      .reduce((s, p) => s + p.consulting.fee, 0),
    unsettled: managed
      .filter((p) => p.consulting.feeStatus === "미정산")
      .reduce((s, p) => s + p.consulting.fee, 0),
    monthReports: managed.reduce((s, p) => s + p.consulting.reportsThisMonth, 0),
    deliverables: managed.reduce((s, p) => s + p.consulting.deliverables.length, 0),
  };
}
