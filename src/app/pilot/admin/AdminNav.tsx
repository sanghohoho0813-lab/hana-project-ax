import Link from "next/link";
import type { DataKind } from "@/lib/pilot/core";
import { kindParam } from "@/lib/pilot/board";

/**
 * 관리자 메뉴는 0.4.0부터 왼쪽 메뉴(admin/layout.tsx · AdminSidebar)로 옮겼다.
 * 이 파일에는 화면마다 쓰는 날짜 · 데이터 구분 선택(DayBar)과 데이터 구분 띠(KindBanner)만 남긴다.
 */

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const seg = "inline-flex min-h-[2.5rem] items-center rounded-xl px-3 text-[15px] font-semibold";

/** 날짜 · 데이터 구분 선택 — 주소(?date=&kind=)로만 바뀌어 새로 고쳐도 같은 화면 */
export function DayBar({ path, date, kind, today }: { path: string; date: string; kind: DataKind; today: string }) {
  const q = (d: string, k: DataKind) => `${path}?date=${d}&kind=${kindParam(k)}`;
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div role="group" aria-label="데이터 구분" className="inline-flex rounded-2xl bg-[#e9ebef] p-1">
        {(["실제 업무", "검증 시나리오"] as const).map((k) => (
          <Link key={k} href={q(date, k)} aria-current={kind === k ? "true" : undefined} className={`${seg} ${kind === k ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}>
            {k}
          </Link>
        ))}
      </div>
      <div className="inline-flex items-center gap-1 rounded-2xl bg-white p-1 shadow-[var(--shadow-card)]">
        <Link href={q(shift(date, -1), kind)} className={`${seg} text-ink-2 hover:bg-[#f2f3f5]`}>
          ◀ 전날
        </Link>
        <form action={path} className="flex items-center gap-1">
          <input type="hidden" name="kind" value={kindParam(kind)} />
          <input type="date" name="date" defaultValue={date} aria-label="날짜" className="min-h-[2.5rem] rounded-xl bg-[#f5f6f8] px-2.5 text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-primary" />
          <button className={`${seg} text-ink-2 hover:bg-[#f2f3f5]`}>보기</button>
        </form>
        <Link href={q(shift(date, 1), kind)} className={`${seg} text-ink-2 hover:bg-[#f2f3f5]`}>
          다음날 ▶
        </Link>
      </div>
      {date !== today && (
        <Link href={q(today, kind)} className={`${seg} bg-primary-light font-bold text-primary-dark`}>
          오늘
        </Link>
      )}
    </div>
  );
}

/** 검증 시나리오는 실제 현장 기록이 아님을 늘 보이게 한다 (시험 데이터 = 회청색 점선) */
export function KindBanner({ kind }: { kind: DataKind }) {
  if (kind === "실제 업무") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[14.5px] font-semibold text-ink-2 shadow-[var(--shadow-card)]">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-success" />
        실제 업무 데이터 — 실제 현장 업무로 입력된 일정과 기록입니다.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-2xl border-2 border-dashed border-[#94a3b8] bg-test-bg px-4 py-2.5 text-[14.5px] font-bold text-test">
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-test" />
      검증 시나리오 데이터 — 시스템 확인용 가상 일정입니다. 실제 현장 기록이 아니며, 실제 업무 판단·내보내기와 섞이지 않습니다.
    </p>
  );
}
