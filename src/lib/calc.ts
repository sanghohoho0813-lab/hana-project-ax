import type { Project } from "./types";

export function totalBudget(p: Project): number {
  return p.costs.reduce((s, c) => s + c.budget, 0);
}

export function totalActual(p: Project): number {
  return p.costs.reduce((s, c) => s + c.actual, 0);
}

// 원가 투입률: 현재 투입원가 / 최초 예상원가
export function costInputRate(p: Project): number {
  const b = totalBudget(p);
  return b === 0 ? 0 : Math.round((totalActual(p) / b) * 100);
}

// 원가율: 예상 최종원가 / 계약금액
export function costRate(p: Project): number {
  return Math.round((totalBudget(p) / p.contractAmount) * 100);
}

// 수금률
export function collectRate(p: Project): number {
  return Math.round((p.payment.received / p.contractAmount) * 100);
}

export function receivable(p: Project): number {
  return Math.max(0, p.payment.billed - p.payment.received);
}

// 현재 예상이익 (완료 프로젝트는 실제원가 기준)
export function currentExpectedProfit(p: Project): number {
  if (p.statusKey === "done") return p.contractAmount - totalActual(p);
  return p.contractAmount - totalBudget(p);
}

// 위험: 원가 투입률이 공정률보다 8%p 이상 높은 경우
export function costRiskGap(p: Project): number {
  return costInputRate(p) - p.progress;
}
