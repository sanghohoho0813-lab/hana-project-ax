/**
 * 비교시험용 AX 화면 — 관리자가 'AX 시스템 사용 방식'으로 시험할 때 쓰는 화면
 *
 * - 판단 엔진(evaluateChainRisk·rankResponses), 연결별 판단 근거 카드(RiskLinkCard),
 *   대응 우선순위 목록(PriorityList)은 실제 프로그램 코드를 수정 없이 그대로 쓴다.
 * - 시험용으로 더한 것은 시나리오 선택·가림막(열기)·시작 조정 입력뿐이다. 시간 측정은 이 화면이 아니라
 *   기록자가 수기 방식과 같은 방법으로 따로 한다(공정성).
 * - 정답표는 이 화면에 들어 있지 않다 (data/scenarios.json 의 입력값만 쓴다).
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Calculator, ChevronDown, FlaskConical, Megaphone, RotateCcw, Route, Timer } from "lucide-react";
import { RiskLinkCard, gradeLabel } from "@/components/RiskPanel";
import { PriorityList, PriorityNote } from "@/components/OpsFlowPanels";
import { GhostButton, PrimaryButton, inputClass } from "@/components/ui";
import { RISK_RULE_VERSION, gradeRank, type RiskResult } from "@/lib/risk-engine";
import type { PriorityResult } from "@/lib/priority-engine";
import { SCENARIOS, TRIAL_VERSION, adjustStart, judge, reportsOf, workerName, type TrialScenario, type TrialSite } from "../lib/scenario";

const NOTE = "비교시험용 가상 시나리오 · 검증용 데이터 (실제 운영데이터 아님)";

/** 조치 전후 바뀐 연결 — 통합일정 '일정 시작 조정' 미리보기와 같은 형식 */
function changeLines(before: RiskResult, after: RiskResult): string[] {
  const keys = [...new Set([...before.links, ...after.links].map((l) => l.key))].sort();
  return keys
    .map((k) => {
      const b = before.links.find((l) => l.key === k);
      const a = after.links.find((l) => l.key === k);
      if (b && a && b.grade === a.grade && b.slack === a.slack && b.status === a.status) return null;
      const lab = (a ?? b)!;
      return `${lab.prev.title} → ${lab.next.title}: ${b ? gradeLabel(b) : "연결 없음"} → ${a ? gradeLabel(a) : "연결 없음"}`;
    })
    .filter((x): x is string => !!x);
}

const ranks = (p: PriorityResult) => p.items.map((i) => `${i.rank}. ${i.title}`).join(" · ") || "없음";

function InputTable({ sites }: { sites: TrialSite[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[820px] text-left text-[18px]">
        <thead className="bg-[#f7f8fa] text-[16.5px] text-ink-3">
          <tr>
            {["작업자", "현장", "작업", "예정 시간", "직전 현장에서 이동", "상태"].map((h) => (
              <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id} className="border-t border-line tabular-nums">
              <td className="px-3 py-2 whitespace-nowrap">{workerName(s.workerId)}</td>
              <td className="px-3 py-2 font-bold whitespace-nowrap">{s.region}</td>
              <td className="px-3 py-2">{s.title.split(" · ")[1] ?? s.title}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {s.plannedStart}~{s.plannedEnd}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{s.travelMinutes === undefined ? "-" : `${s.travelMinutes}분`}</td>
              <td className="px-3 py-2 whitespace-nowrap">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 통합일정 '위험 판단과 대응 우선순위'와 같은 구성 (우선순위 → 연결별 판단 근거 → 위험 없는 연결) */
function Judgment({ risk, priority, titleOf, asOf }: { risk: RiskResult; priority: PriorityResult; titleOf: (id: string) => string; asOf: string }) {
  const [showOk, setShowOk] = useState(false);
  const main = risk.links.filter((l) => l.status === "판단 보류" || (l.status === "판정" && gradeRank(l.grade) >= 1));
  const ok = risk.links.filter((l) => !main.includes(l));
  const risky = main.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2).length;
  return (
    <section className="space-y-3">
      <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[25.5px] font-bold">
        <Route size={26} className="text-primary" /> 위험 판단과 대응 우선순위
        <span className="text-[19px] font-semibold text-ink-3">
          위험 {risky}건 · 연결 {risk.links.length}건 확인
        </span>
      </h3>
      <p className="text-[16.5px] text-ink-3">
        규칙 기반 판단 (AI 예측 아님) · 기준시각 {asOf} · {RISK_RULE_VERSION}
      </p>
      <h4 className="pt-1 text-[22px] font-bold">관리자 대응 우선순위</h4>
      <PriorityList result={priority} />
      <PriorityNote />
      <h4 className="flex items-center gap-2 pt-1 text-[22px] font-bold">
        <Calculator size={23} className="text-primary" /> 연결별 판단 근거
      </h4>
      {main.length === 0 ? (
        <p className="card px-5 py-5 text-[19px] text-ink-3">주의가 필요한 연결이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {main.map((l) => (
            <RiskLinkCard key={l.key} link={l} nameOf={workerName} titleOf={titleOf} defaultOpen={l.status === "판정" && gradeRank(l.grade) >= 2} />
          ))}
        </div>
      )}
      {ok.length > 0 && (
        <div>
          <button
            onClick={() => setShowOk((v) => !v)}
            aria-expanded={showOk}
            className="inline-flex items-center gap-1.5 text-[18.5px] font-bold text-primary-dark hover:underline"
          >
            위험 없는 연결 {ok.length}건 {showOk ? "접기" : "보기"} <ChevronDown size={19} className={showOk ? "rotate-180" : ""} />
          </button>
          {showOk && (
            <div className="mt-2 space-y-3">
              {ok.map((l) => (
                <RiskLinkCard key={l.key} link={l} nameOf={workerName} titleOf={titleOf} defaultOpen={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ScenarioView({ sc, onBack }: { sc: TrialScenario; onBack: () => void }) {
  const [sites, setSites] = useState<TrialSite[]>(sc.sites);
  const [pick, setPick] = useState("");
  const [time, setTime] = useState("");
  const [last, setLast] = useState<{ lines: string[]; before: string; after: string; what: string } | null>(null);
  const cur = judge(sc, sites);
  const titleOf = (id: string) => sc.sites.find((s) => s.id === id)?.region ?? id;
  const target = sites.find((s) => s.id === pick);
  const preview = target && time ? adjustStart(sc, sites, pick, time) : null;
  const error = target && time && !preview ? "HH:MM 형식으로 입력해 주세요." : null;

  const apply = () => {
    if (!target || !preview) return;
    const next = judge(sc, preview);
    const moved = preview.find((s) => s.id === pick)!;
    setLast({
      lines: changeLines(cur.risk, next.risk),
      before: ranks(cur.priority),
      after: ranks(next.priority),
      what: `${target.region} 시작 ${target.plannedStart} → ${moved.plannedStart} (작업시간 유지, ${moved.plannedStart}~${moved.plannedEnd})`,
    });
    setSites(preview);
    setPick("");
    setTime("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold text-primary-dark">시나리오 {sc.id}</p>
          <h1 className="text-[32px] leading-tight font-extrabold tabular-nums">
            {sc.date} · 기준시각 {sc.asOf}
          </h1>
          <p className="mt-1 text-[16px] text-ink-3">{NOTE}</p>
        </div>
        <GhostButton onClick={onBack}>
          <ArrowLeft size={20} /> 시나리오 목록
        </GhostButton>
      </div>

      <div className="card px-5 py-4">
        <p className="flex items-center gap-2 text-[19.5px] font-bold">
          <Megaphone size={21} className="text-primary" /> 현장 보고 (기준시각까지)
        </p>
        <ul className="mt-1.5 space-y-0.5 text-[19px] tabular-nums">
          {reportsOf(sc).map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-[22px] font-bold">오늘 일정 {last && <span className="text-[18px] font-semibold text-primary-dark">(조치 반영)</span>}</h2>
        <InputTable sites={sites} />
      </div>

      <div className="card space-y-3 px-5 py-4">
        <p className="flex items-center gap-2 text-[21px] font-bold">
          <Timer size={22} className="text-primary" /> 일정 시작 조정 (관리자 조치)
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[14rem]">
            <span className="mb-1.5 block text-[18px] font-semibold text-ink-2">조정할 현장</span>
            <select value={pick} onChange={(e) => { setPick(e.target.value); setTime(""); }} className={inputClass}>
              <option value="">현장 선택</option>
              {sites
                .filter((s) => s.status === "예정")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.region} ({s.plannedStart}~{s.plannedEnd})
                  </option>
                ))}
            </select>
          </label>
          <label className="block w-[11rem]">
            <span className="mb-1.5 block text-[18px] font-semibold text-ink-2">새 시작 시각</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!target} className={inputClass} />
          </label>
          <PrimaryButton disabled={!preview} onClick={apply}>
            조정하고 다시 판단
          </PrimaryButton>
          {last && (
            <GhostButton
              onClick={() => {
                setSites(sc.sites);
                setLast(null);
              }}
            >
              <RotateCcw size={19} /> 처음 상태로
            </GhostButton>
          )}
        </div>
        {error && <p className="text-[17.5px] font-semibold text-danger">{error}</p>}
        <p className="text-[15.5px] text-ink-3">작업시간은 그대로 두고 시작 시각만 바꿉니다. 시스템이 일정을 스스로 바꾸지 않습니다.</p>
        {last && (
          <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-[18px] leading-relaxed">
            <p className="font-bold text-ink-2">{last.what} — 위험과 우선순위를 다시 판단했습니다</p>
            {last.lines.length === 0 ? <p className="text-ink-3">위험 판정 변화 없음</p> : last.lines.map((l) => <p key={l}>{l}</p>)}
            <p className="mt-1 text-ink-2">
              우선순위: {last.before} → <b>{last.after}</b>
            </p>
          </div>
        )}
      </div>

      <Judgment risk={cur.risk} priority={cur.priority} titleOf={titleOf} asOf={sc.asOf} />
      <p className="pb-6 text-[15px] text-ink-3">
        판단 엔진·판단 근거 카드·우선순위 목록은 실제 프로그램 코드 그대로입니다 · {TRIAL_VERSION}
      </p>
    </div>
  );
}

function Cover({ sc, onOpen, onBack }: { sc: TrialScenario; onOpen: () => void; onBack: () => void }) {
  return (
    <div className="card mx-auto max-w-[44rem] space-y-5 px-8 py-10 text-center">
      <p className="text-[19px] font-bold text-primary-dark">{sc.set === "연습" ? "연습 문제" : `${sc.set}세트`}</p>
      <h1 className="text-[44px] font-extrabold">시나리오 {sc.id}</h1>
      <p className="text-[20px] text-ink-2">기록자가 준비되면 &lsquo;열기&rsquo;를 누르세요. 누르는 순간부터 시간을 잽니다.</p>
      <div className="flex justify-center gap-3">
        <PrimaryButton onClick={onOpen} className="min-w-[10rem]">
          열기
        </PrimaryButton>
        <GhostButton onClick={onBack}>목록</GhostButton>
      </div>
    </div>
  );
}

function App() {
  const [id, setId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const sc = SCENARIOS.find((s) => s.id === id) ?? null;
  const back = () => {
    setId(null);
    setOpen(false);
  };
  return (
    <main className="mx-auto max-w-[1180px] px-5 py-6 lg:px-8">
      {!sc ? (
        <div className="space-y-6">
          <div className="hero-navy rounded-3xl px-7 py-7 text-white">
            <p className="flex items-center gap-2 text-[18px] font-bold text-white/70">
              <FlaskConical size={20} /> 하나 프로젝트 AX · 비교시험용 화면
            </p>
            <h1 className="mt-1 text-[34px] leading-tight font-extrabold">복수 현장 연쇄위험 판단 — AX 사용 방식</h1>
            <p className="mt-2 text-[19px] text-white/75">진행요원이 안내하는 시나리오를 고른 뒤, 가림막의 &lsquo;열기&rsquo;를 누르면 시작합니다. {NOTE}</p>
          </div>
          {["연습", "A", "B"].map((set) => (
            <div key={set} className="space-y-2">
              <h2 className="text-[22px] font-bold">{set === "연습" ? "연습 문제" : `${set}세트`}</h2>
              <div className="flex flex-wrap gap-2.5">
                {SCENARIOS.filter((s) => s.set === set).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setId(s.id);
                      setOpen(false);
                    }}
                    className="card min-w-[7.5rem] px-5 py-4 text-[24px] font-extrabold transition-colors hover:bg-[#f7f8fa]"
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : open ? (
        <ScenarioView key={sc.id} sc={sc} onBack={back} />
      ) : (
        <Cover sc={sc} onOpen={() => setOpen(true)} onBack={back} />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
