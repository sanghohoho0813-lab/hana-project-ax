import { ArrowRight, MapPin } from "lucide-react";
import { cx, Pill, type PillTone } from "./ds";

/**
 * 연쇄 영향 그림 — 사건 현장(A) → 다음 현장(B) → 그다음(C)…
 * 위: 현장 사슬(화살표 색 = 지금 남은 위험) · 아래: 연결마다 '보고 직후'와 '조치 후'를 나란히.
 * 보고 직후 = 사건의 예상 종료를 엔진에 넣은 판단 · 조치 후 = 마지막 관리자 조치의 재판단.
 * 값은 모두 기록된 엔진 판단에서 읽은 것이다 — 이 부품은 계산하지 않고 그리기만 한다.
 */
export interface ChainState {
  /** 등급 또는 상태 (없음 · 주의 · 중간 · 높음 · 매우 높음 · 판단 보류 …) */
  grade: string;
  /** 도착 여유(+) · 부족(−) 분, 계산값 */
  slack: number | null;
}
export interface ChainLink {
  key: string;
  from: string;
  to: string;
  report: ChainState | null;
  action: ChainState | null;
}

const RANK: Record<string, number> = { 없음: 0, 주의: 1, 중간: 2, 높음: 3, "매우 높음": 4 };
const tone = (g?: string): PillTone => (g === "매우 높음" || g === "높음" ? "danger" : g === "중간" || g === "주의" ? "warning" : g === "없음" ? "success" : "neutral");
const slackText = (s: ChainState) => (s.slack === null ? "" : s.slack < 0 ? ` · ${-s.slack}분 늦음` : ` · 여유 ${s.slack}분`);
const LINE: Record<PillTone, string> = { danger: "bg-danger", warning: "bg-[#f59e0b]", success: "bg-success", neutral: "bg-[#c9ced6]", info: "bg-primary", test: "bg-test", dark: "bg-ink" };

/** 조치 전후 결과 — 해소 · 완화 · 남음 · 악화 · 조치 전 */
export function outcome(l: ChainLink): { text: string; tone: PillTone } {
  if (!l.report) return { text: "보고 판단 없음", tone: "neutral" };
  const r = RANK[l.report.grade] ?? -1;
  if (!l.action) return { text: r >= 2 ? "조치 전 · 위험" : "조치 전", tone: r >= 2 ? "danger" : "neutral" };
  const a = RANK[l.action.grade] ?? -1;
  if (r >= 2 && a < 2 && a >= 0) return { text: "해소", tone: "success" };
  if (a >= 2 && a >= r) return { text: a > r ? "악화" : "남음", tone: "danger" };
  if (a < r) return { text: "완화", tone: "warning" };
  return { text: "변화 없음", tone: "neutral" };
}

export function RiskChain({ links, caseSite, hasAction }: { links: ChainLink[]; caseSite: string; hasAction: boolean }) {
  if (links.length === 0) return <p className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-[14.5px] text-ink-3">이 사건 현장 뒤로 이어지는 같은 기사의 현장이 없습니다 (연쇄 영향 없음).</p>;
  const nodes = [caseSite, ...links.map((l) => l.to)];
  return (
    <div aria-label="연쇄 영향 그림" className="space-y-3">
      {/* 현장 사슬 — 화살표 색은 지금(조치 후, 없으면 보고 직후) 남은 위험 */}
      <ol className="flex flex-wrap items-center gap-y-2">
        {nodes.map((n, i) => {
          const l = links[i];
          const now = l ? (l.action ?? l.report) : null;
          return (
            <li key={`${n}-${i}`} className="flex items-center">
              <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14.5px] font-extrabold", i === 0 ? "bg-ink text-white" : "bg-white ring-1 ring-line")}>
                <MapPin size={15} className={i === 0 ? "text-white/80" : "text-ink-3"} />
                {n}
              </span>
              {l && (
                <span className="mx-1.5 flex w-16 flex-col items-center sm:w-24">
                  <span className="text-[12px] font-bold whitespace-nowrap text-ink-3">{now ? now.grade : "—"}</span>
                  <span className="flex w-full items-center">
                    <span className={cx("h-1 flex-1 rounded-full", LINE[tone(now?.grade)])} />
                    <ArrowRight size={14} className="-ml-1 text-ink-3" />
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {/* 연결마다 보고 직후 → 조치 후 */}
      <ul className="divide-y divide-line rounded-2xl bg-[#f7f8fa] px-4">
        {links.map((l) => {
          const o = outcome(l);
          return (
            <li key={l.key} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] md:items-center">
              <p className="min-w-0 text-[14.5px] font-bold">
                {l.from} <span className="text-ink-3">→</span> {l.to}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-ink-3">
                보고 직후
                {l.report ? (
                  <Pill tone={tone(l.report.grade)} className="!text-[13.5px]">
                    {l.report.grade}
                    {slackText(l.report)}
                  </Pill>
                ) : (
                  <span className="font-semibold">기록 없음</span>
                )}
                <ArrowRight size={14} />
                조치 후
                {l.action ? (
                  <Pill tone={tone(l.action.grade)} className="!text-[13.5px]">
                    {l.action.grade}
                    {slackText(l.action)}
                  </Pill>
                ) : (
                  <span className="font-semibold">{hasAction ? "변화 기록 없음" : "조치 전"}</span>
                )}
              </div>
              <Pill tone={o.tone} dot={false} className="justify-self-start !text-[13.5px] md:justify-self-end">
                {o.text}
              </Pill>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
