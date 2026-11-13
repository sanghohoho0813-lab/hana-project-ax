import Link from "next/link";
import type { DataKind } from "@/lib/pilot/core";
import { kindParam } from "@/lib/pilot/board";

const TABS = [
  { key: "board", href: "/pilot/admin", label: "일정판" },
  { key: "cases", href: "/pilot/admin/cases", label: "현장 문제·지원" },
  { key: "safety", href: "/pilot/admin/safety", label: "안전점검" },
  { key: "records", href: "/pilot/admin/records", label: "기록·판단 이력" },
  { key: "staff", href: "/pilot/admin/staff", label: "계정" },
] as const;

export function AdminNav({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="관리자 메뉴" className="flex flex-wrap gap-1.5 print:hidden">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={`rounded-xl px-3.5 py-1.5 text-[18px] font-bold ${current === t.key ? "bg-ink text-white" : "bg-white text-ink-2 hover:bg-[#e8ebee]"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 날짜 · 데이터 구분 선택 — 주소(?date=&kind=)로만 바뀌어 새로 고쳐도 같은 화면 */
export function DayBar({ path, date, kind, today }: { path: string; date: string; kind: DataKind; today: string }) {
  const q = (d: string, k: DataKind) => `${path}?date=${d}&kind=${kindParam(k)}`;
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div role="group" aria-label="데이터 구분" className="inline-flex rounded-xl bg-[#e8ebee] p-1">
        {(["실제 업무", "검증 시나리오"] as const).map((k) => (
          <Link
            key={k}
            href={q(date, k)}
            aria-current={kind === k ? "true" : undefined}
            className={`rounded-lg px-3.5 py-1.5 text-[18px] font-semibold ${kind === k ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}
          >
            {k}
          </Link>
        ))}
      </div>
      <Link href={q(shift(date, -1), kind)} className="rounded-xl bg-white px-3 py-1.5 text-[18px] font-semibold text-ink-2 hover:bg-[#e8ebee]">
        ◀ 전날
      </Link>
      <form action={path} className="flex items-center gap-1.5">
        <input type="hidden" name="kind" value={kindParam(kind)} />
        <input type="date" name="date" defaultValue={date} aria-label="날짜" className="rounded-xl border border-line bg-white px-3 py-1.5 text-[18px]" />
        <button className="rounded-xl bg-white px-3 py-1.5 text-[18px] font-semibold text-ink-2 hover:bg-[#e8ebee]">보기</button>
      </form>
      <Link href={q(shift(date, 1), kind)} className="rounded-xl bg-white px-3 py-1.5 text-[18px] font-semibold text-ink-2 hover:bg-[#e8ebee]">
        다음날 ▶
      </Link>
      {date !== today && (
        <Link href={q(today, kind)} className="rounded-xl bg-primary-light px-3 py-1.5 text-[18px] font-bold text-primary-dark">
          오늘
        </Link>
      )}
    </div>
  );
}

/** 검증 시나리오는 실제 현장 기록이 아님을 늘 보이게 한다 */
export function KindBanner({ kind }: { kind: DataKind }) {
  if (kind === "실제 업무") {
    return <p className="rounded-xl bg-white px-4 py-2 text-[16.5px] font-semibold text-ink-2">실제 업무 데이터 — 실제 현장 업무로 입력된 일정과 기록입니다.</p>;
  }
  return (
    <p className="rounded-xl border-2 border-dashed border-[#7c3aed]/50 bg-[#f5f0ff] px-4 py-2 text-[16.5px] font-bold text-[#5b21b6]">
      검증 시나리오 데이터 — 시스템 확인용 가상 일정입니다. 실제 현장 기록이 아니며, 실제 업무 판단·내보내기와 섞이지 않습니다.
    </p>
  );
}
