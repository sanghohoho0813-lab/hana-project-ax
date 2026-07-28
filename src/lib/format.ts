// 금액은 모두 "만원" 단위 정수로 저장한다.
export function formatMoney(manwon: number): string {
  if (manwon === 0) return "0원";
  const sign = manwon < 0 ? "-" : "";
  const abs = Math.abs(Math.round(manwon));
  const eok = Math.floor(abs / 10000);
  const rest = abs % 10000;
  if (eok > 0 && rest > 0)
    return `${sign}${eok.toLocaleString()}억 ${rest.toLocaleString()}만 원`;
  if (eok > 0) return `${sign}${eok.toLocaleString()}억 원`;
  return `${sign}${rest.toLocaleString()}만 원`;
}

// 카드 등 좁은 곳에서 쓰는 축약형 (예: 1.35억, 4,800만)
export function formatMoneyShort(manwon: number): string {
  const abs = Math.abs(manwon);
  if (abs >= 10000) {
    const eok = manwon / 10000;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(2).replace(/0$/, "")}억`;
  }
  return `${manwon.toLocaleString()}만`;
}

export function formatPercent(v: number): string {
  return `${Math.round(v)}%`;
}

// 데모 기준일: 2026년 7월 28일 (화)
export const TODAY = "2026-07-28";

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(y, m - 1, d).getDay()
  ];
  return `${m}월 ${d}일 (${day})`;
}

export function formatDateFull(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}
