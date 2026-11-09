/**
 * 실증용 시각 도우미 — 모든 판단은 한국 시각(Asia/Seoul) 기준이다.
 * 서버(Vercel)와 DB(Supabase)는 UTC 로 돌기 때문에 시간대를 항상 명시한다. 데모 기준시각(NOW)은 쓰지 않는다.
 */

const FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface KstParts {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  /** HH:MM:SS */
  seconds: string;
  /** YYYY-MM-DDTHH:MM — 판단엔진 입력 형식 (분 단위, 초는 버린다) */
  minute: string;
}

export function kst(at: Date | string): KstParts {
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) throw new Error(`시각을 읽을 수 없습니다: ${String(at)}`);
  const p = Object.fromEntries(FMT.formatToParts(d).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}`;
  return { date, time, seconds: `${time}:${p.second}`, minute: `${date}T${time}` };
}

/** 화면 표시용 — 2026-11-09 10:40:12 */
export function kstLabel(at: Date | string | null | undefined): string {
  if (!at) return "-";
  const k = kst(at);
  return `${k.date} ${k.seconds}`;
}

/** DB time 값(HH:MM:SS) → HH:MM */
export function hhmm(v: string | null | undefined): string | undefined {
  return v ? v.slice(0, 5) : undefined;
}
