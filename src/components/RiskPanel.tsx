"use client";

import { useState } from "react";
import {
  ArrowRight,
  Calculator,
  ChevronDown,
  ClipboardList,
  Download,
  GitBranch,
  History,
  Info,
  ListChecks,
  Route,
  Timer,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { NOW_LABEL } from "@/lib/company";
import { fullName } from "@/lib/team";
import { chainRisk, chainRiskAll, opsPipeline, opsPriority } from "@/lib/ops-calc";
import {
  RISK_RULE_VERSION,
  RISK_RULES,
  gradeRank,
  parseHHMM,
  type RiskLink,
} from "@/lib/risk-engine";
import type { ScheduleItem } from "@/lib/ops-types";
import { Badge, GhostButton, Modal, PrimaryButton, Segment, inputClass, type Tone } from "@/components/ui";
import { PriorityAndDeviation } from "@/components/OpsFlowPanels";

/* ── 공통 ─────────────────────────────────────────── */

export function gradeTone(l: Pick<RiskLink, "status" | "grade">): Tone {
  if (l.status !== "판정") return "neutral";
  if (l.grade === "매우 높음" || l.grade === "높음") return "danger";
  if (l.grade === "중간") return "warning";
  if (l.grade === "주의") return "info";
  return "success";
}

export function gradeLabel(l: Pick<RiskLink, "status" | "grade">): string {
  if (l.status === "판단 보류") return "판단 보류";
  if (l.status === "해당 없음") return "해당 없음";
  return l.grade === "없음" ? "위험 없음" : `위험 ${l.grade}`;
}

/** 브라우저에서 JSON 파일로 내려받는다 */
export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const RULE_NAME: Record<string, string> = Object.fromEntries(RISK_RULES.map((r) => [r.id, r.name]));

function Cell({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#f7f8fa] px-4 py-3">
      <p className="text-[16.5px] font-semibold text-ink-3">{label}</p>
      <p className={`mt-0.5 text-[24px] leading-tight font-extrabold tabular-nums ${strong ? "text-danger" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[15.5px] font-semibold text-ink-3">{sub}</p>}
    </div>
  );
}

/* ── 연결 한 건의 판단 근거 ─────────────────────────── */

export function RiskLinkCard({
  link: l,
  nameOf = fullName,
  titleOf,
  onEstimate,
  defaultOpen = true,
}: {
  link: RiskLink;
  nameOf?: (workerId: string) => string;
  titleOf?: (siteId: string) => string;
  /** 선행 현장 예상 종료를 입력하는 버튼 (관리자 화면에서만) */
  onEstimate?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = gradeTone(l);
  const risky = l.status === "판정" && gradeRank(l.grade) >= 2;
  const judged = l.status === "판정";

  return (
    <div className={`card min-w-0 p-5 ${risky ? "border border-danger/20" : ""}`}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            {risky && <span className="text-[17px] font-extrabold text-danger">[연쇄위험 감지]</span>}
            <Badge tone={tone}>{gradeLabel(l)}</Badge>
            <Badge tone="neutral">{l.cause}</Badge>
            {judged && !l.staticConflict && risky && <Badge tone="info">예정값만으로는 보이지 않는 위험</Badge>}
          </span>
          <span className="mt-1.5 block text-[22px] leading-snug font-bold">
            {nameOf(l.workerId)} · {l.prev.title} <ArrowRight size={20} className="inline align-[-3px] text-ink-3" /> {l.next.title}
          </span>
        </span>
        <ChevronDown size={24} className={`mt-1 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* 입력값 */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <Cell label="선행 현장 예정 종료" value={l.prev.plannedEnd} />
            <Cell
              label="선행 현장 예상 종료"
              value={l.prev.expectedEnd}
              sub={`출처: ${l.prev.endSource}${l.prev.delay ? ` · 지연 ${l.prev.delay}분` : ""}`}
            />
            <Cell
              label="이동 필요시간"
              value={l.travel.minutes === null ? "없음" : `${l.travel.minutes}분`}
              sub={`출처: ${l.travel.source}${l.travel.source === "누락" ? "" : " (실시간 교통정보 아님)"}`}
            />
            <Cell label="후속 현장 예상 도착" value={l.arrival ?? "계산 안 함"} />
            <Cell label="후속 현장 예정 시작" value={l.next.plannedStart} sub={`상태: ${l.next.status}`} />
            <Cell
              label={l.slack !== null && l.slack < 0 ? "예상 지연" : "시간 여유"}
              value={l.slack === null ? "-" : l.slack < 0 ? `${l.shortfall}분` : `${l.slack}분`}
              strong={l.slack !== null && l.slack < 0}
            />
          </div>

          {/* 계산 과정 */}
          {l.formula.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[18px] font-bold text-ink-2">
                <Calculator size={19} /> 계산 과정
              </p>
              <ol className="mt-1.5 space-y-1 rounded-2xl border border-line px-4 py-3">
                {l.formula.map((f, i) => (
                  <li key={i} className="text-[18.5px] leading-relaxed tabular-nums">
                    <span className="mr-2 text-ink-3">{i + 1}.</span>
                    {f}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 판정 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3">
              <p className="flex items-center gap-1.5 text-[18px] font-bold text-ink-2">
                <Info size={19} /> 판단 근거 · 위험등급 {l.status === "판정" ? l.grade : l.status}
              </p>
              <p className="mt-1 text-[19px] leading-relaxed text-ink">{l.reason}</p>
              {l.downstream.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[17.5px] font-semibold text-ink-2">
                  <GitBranch size={18} /> 영향받는 후속 일정:
                  {l.downstream.map((id) => (
                    <span key={id} className="rounded-full bg-white px-2.5 py-0.5">
                      {titleOf ? titleOf(id) : id}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-line px-4 py-3">
              <p className="flex items-center gap-1.5 text-[18px] font-bold text-ink-2">
                <ListChecks size={19} /> 관리자 권장 확인
              </p>
              {l.actions.length === 0 ? (
                <p className="mt-1 text-[18.5px] text-ink-3">추가로 확인할 항목이 없습니다.</p>
              ) : (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.actions.map((a) => (
                    <li key={a} className="rounded-full bg-[#f2f4f6] px-3 py-1 text-[17.5px] font-semibold text-ink-2">
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[15.5px] text-ink-3">시스템이 일정·담당자를 자동으로 바꾸지 않습니다.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15.5px] text-ink-3">
              적용 규칙 {l.rules.map((r) => `${r} ${RULE_NAME[r] ?? ""}`).join(" · ")} · {RISK_RULE_VERSION}
            </p>
            {onEstimate && (
              <button
                onClick={onEstimate}
                className="inline-flex min-h-[3rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[18px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
              >
                <Timer size={19} /> {l.prev.title} 예상 종료 입력
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 일정 화면용: 오늘 연쇄위험 판단 ────────────────── */

export function ChainRiskPanel({ list }: { list: ScheduleItem[] }) {
  const { permission, schedules, tasks, reports } = useApp();
  const [estimate, setEstimate] = useState<ScheduleItem | null>(null);
  const [showOk, setShowOk] = useState(false);
  const r = chainRisk(list);
  const flow = opsPipeline(list, tasks, reports);
  const priority = opsPriority(list, tasks);
  const titleOf = (id: string) => schedules.find((s) => s.id === id)?.title ?? id;

  const main = r.links.filter((l) => l.status === "판단 보류" || (l.status === "판정" && gradeRank(l.grade) >= 1));
  const ok = r.links.filter((l) => !main.includes(l));
  const risky = main.filter((l) => l.status === "판정" && gradeRank(l.grade) >= 2).length;

  return (
    <section data-tour="chainrisk" className="space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[25.5px] font-bold">
          <Route size={26} className="text-primary" /> 위험 판단과 대응 우선순위
          <span className="text-[19px] font-semibold text-ink-3">
            위험 {risky}건 · 연결 {r.links.length}건 확인
          </span>
        </h3>
        <p className="text-[16.5px] text-ink-3">
          규칙 기반 판단 (AI 예측 아님) · 데모 기준시각 {NOW_LABEL} · {RISK_RULE_VERSION} · {flow.stateVersion}
        </p>
      </div>
      <p className="text-[18.5px] leading-relaxed text-ink-2">
        실제 작업 기록(확인·시작·보고)을 예정과 비교하고, 선행 현장의 예상 종료와 이동시간으로 후속 현장 도착을 미리 계산해, 무엇부터 확인할지 순서를 정합니다. 시작
        시각이나 예상 종료를 입력하거나 일정을 조정하면 바로 다시 판단합니다.
      </p>

      <PriorityAndDeviation
        list={list}
        deviations={flow.deviations}
        priority={priority}
        onEstimate={permission.assignTask ? (id) => setEstimate(schedules.find((s) => s.id === id) ?? null) : undefined}
      />

      <h4 className="flex items-center gap-2 pt-1 text-[22px] font-bold">
        <Calculator size={23} className="text-primary" /> 연결별 판단 근거
      </h4>

      {main.length === 0 ? (
        <p className="card px-5 py-5 text-[19px] text-ink-3">주의가 필요한 연결이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {main.map((l) => (
            <RiskLinkCard
              key={l.key}
              link={l}
              titleOf={titleOf}
              defaultOpen={l.status === "판정" && gradeRank(l.grade) >= 2}
              onEstimate={
                permission.assignTask
                  ? () => setEstimate(schedules.find((s) => s.id === l.prev.id) ?? null)
                  : undefined
              }
            />
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
                <RiskLinkCard
                  key={l.key}
                  link={l}
                  titleOf={titleOf}
                  defaultOpen={false}
                  onEstimate={
                    permission.assignTask && l.status !== "해당 없음"
                      ? () => setEstimate(schedules.find((s) => s.id === l.prev.id) ?? null)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {r.issues.length > 0 && (
        <div className="card border border-warning/30 px-5 py-4">
          <p className="text-[19px] font-bold text-warning">일정 데이터 확인 필요 {r.issues.length}건</p>
          <ul className="mt-1.5 space-y-1">
            {r.issues.map((x, i) => (
              <li key={i} className="text-[18px] text-ink-2">
                · {titleOf(x.siteId)} — {x.kind}: {x.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estimate && <EstimateModal schedule={estimate} onClose={() => setEstimate(null)} />}
      <RiskLogPanel />
    </section>
  );
}

/* ── 예상 종료 입력 ────────────────────────────────── */

export function EstimateModal({ schedule: s, onClose }: { schedule: ScheduleItem; onClose: () => void }) {
  const { schedules, setScheduleEstimate, showToast } = useApp();
  const [time, setTime] = useState(s.expectedEnd ?? s.end);
  const [source, setSource] = useState<"현장 보고" | "관리자 입력">(s.expectedEndSource ?? "현장 보고");

  const t = parseHHMM(time);
  const start = parseHHMM(s.start);
  const error = t === null ? "HH:MM 형식으로 입력해 주세요." : start !== null && t <= start ? `시작 ${s.start}보다 늦어야 합니다.` : null;

  // 저장 전 미리보기 — 이 현장에서 출발하는 연결이 어떻게 바뀌는지
  const before = chainRisk(schedules, s.date).links.filter((l) => l.prev.id === s.id);
  const after = error
    ? []
    : chainRisk(
        schedules.map((x) => (x.id === s.id ? { ...x, expectedEnd: time, expectedEndSource: source } : x)),
        s.date,
      ).links;

  return (
    <Modal open onClose={onClose} title="예상 종료 입력" desc={`${s.title} · 예정 ${s.start}~${s.end}`}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[19.5px] font-semibold text-ink-2">예상 종료 시각</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} aria-invalid={!!error} />
          {error && <span className="mt-1 block text-[17.5px] font-semibold text-danger">{error}</span>}
        </label>
        <div>
          <p className="mb-1.5 text-[19.5px] font-semibold text-ink-2">이 값은 어디서 왔나요?</p>
          <Segment<"현장 보고" | "관리자 입력">
            value={source}
            onChange={setSource}
            options={[
              { value: "현장 보고", label: "현장 보고" },
              { value: "관리자 입력", label: "관리자 입력" },
            ]}
          />
        </div>

        <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3">
          <p className="text-[18px] font-bold text-ink-2">저장하면 다시 판단합니다</p>
          {before.length === 0 ? (
            <p className="mt-1 text-[18px] text-ink-3">이 현장 다음에 이어지는 일정이 없습니다.</p>
          ) : (
            before.map((b) => {
              const a = after.find((x) => x.key === b.key);
              return (
                <p key={b.key} className="mt-1 text-[18.5px] leading-relaxed">
                  {b.next.title}: <b>{gradeLabel(b)}</b>
                  {b.slack !== null && ` (여유 ${b.slack}분)`} → <b>{a ? gradeLabel(a) : "-"}</b>
                  {a?.slack !== null && a?.slack !== undefined && ` (${a.slack < 0 ? `${a.shortfall}분 부족` : `여유 ${a.slack}분`})`}
                </p>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            disabled={!!error}
            onClick={() => {
              setScheduleEstimate(s.id, time, source);
              showToast(`${s.title} 예상 종료를 ${time}로 입력하고 위험을 다시 판단했습니다`);
              onClose();
            }}
            className="flex-1"
          >
            저장하고 다시 판단
          </PrimaryButton>
          {s.expectedEnd && (
            <GhostButton
              onClick={() => {
                setScheduleEstimate(s.id, undefined);
                showToast("예상 종료를 지우고 예정 종료로 다시 판단했습니다");
                onClose();
              }}
            >
              예상 종료 지우기
            </GhostButton>
          )}
          <GhostButton onClick={onClose}>취소</GhostButton>
        </div>
        <p className="text-[15.5px] text-ink-3">입력값은 이번 데모 세션에만 저장됩니다. 일정 시간과 담당자는 바뀌지 않습니다.</p>
      </div>
    </Modal>
  );
}

/* ── 판단 이력 ─────────────────────────────────────── */

export function RiskLogPanel() {
  const { riskLog, schedules } = useApp();
  const [open, setOpen] = useState(true);
  const entries = [...riskLog].reverse();

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-2 text-left">
          <History size={23} className="text-primary" />
          <span className="text-[21px] font-bold">판단 이력</span>
          <span className="text-[17.5px] font-semibold text-ink-3">이번 데모 세션 {riskLog.length}건</span>
          <ChevronDown size={21} className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={() =>
            downloadJSON("risk-judgment-log.json", {
              note: "데모 세션 판단 이력입니다. 브라우저 메모리에만 있었던 기록이며 서버 감사로그가 아닙니다. 시각은 데모 기준시각입니다.",
              ruleVersion: RISK_RULE_VERSION,
              rules: RISK_RULES,
              entries: riskLog,
              current: chainRiskAll(schedules),
            })
          }
          className="inline-flex min-h-[2.9rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3.5 text-[17.5px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
        >
          <Download size={18} /> JSON 내보내기
        </button>
      </div>
      <p className="mt-1 text-[16px] text-ink-3">브라우저 메모리에만 남는 기록입니다 (서버 기록 아님 · 새로고침하면 사라짐). 시각은 데모 기준시각입니다.</p>

      {open &&
        (entries.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-[18.5px] text-ink-3">
            <ClipboardList size={20} /> 예상 종료 입력, 시간 변경, 담당자 변경을 하면 변경 전후 판단이 여기에 남습니다.
          </p>
        ) : (
          <ol className="mt-3 space-y-2.5">
            {entries.map((e) => (
              <li key={e.seq} className="rounded-2xl border border-line px-4 py-3">
                <p className="flex flex-wrap items-center gap-2 text-[18.5px] font-bold">
                  <span className="text-ink-3">#{e.seq}</span>
                  <Badge tone="neutral">{e.event.kind}</Badge>
                  {e.event.title} · {e.event.field} {e.event.before} → {e.event.after}
                </p>
                <p className="mt-0.5 text-[15.5px] text-ink-3">
                  데모 기준시각 {e.demoAt.replace("T", " ")} · 입력 {fullName(e.event.actorId)} · {e.ruleVersion}
                </p>
                {e.changes.length === 0 ? (
                  <p className="mt-1.5 text-[17.5px] text-ink-3">위험판단 결과는 바뀌지 않았습니다.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {e.changes.map((c) => {
                      const b = e.before.find((x) => x.key === c.key);
                      const a = e.after.find((x) => x.key === c.key);
                      const g = (x?: typeof b) => (x ? (x.status === "판정" ? (x.grade === "없음" ? "위험 없음" : `위험 ${x.grade}`) : x.status) : "연결 없음");
                      const sl = (x?: typeof b) => (x && x.slack !== null ? ` (${x.slack < 0 ? `${-x.slack}분 부족` : `여유 ${x.slack}분`})` : "");
                      return (
                        <li key={c.key} className="text-[17.5px] leading-relaxed text-ink-2">
                          <Badge tone={c.kind === "신규 위험" || c.kind === "악화" ? "danger" : c.kind === "해소" ? "success" : "neutral"}>{c.kind}</Badge>{" "}
                          {(a ?? b)?.label}: {g(b)}
                          {sl(b)} → {g(a)}
                          {sl(a)}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {e.priorityChanges.length > 0 && (
                  <div className="mt-1.5 rounded-xl bg-[#f7f8fa] px-3 py-2">
                    <p className="text-[16px] font-bold text-ink-2">우선순위 변화</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {e.priorityChanges.map((c) => (
                        <li key={c.key} className="text-[16.5px] text-ink-2">
                          <Badge tone={c.kind === "신규" || c.kind === "상승" ? "danger" : c.kind === "해소" ? "success" : "neutral"}>{c.kind}</Badge>{" "}
                          {c.title}: {c.before ? `${c.before}순위(${c.beforeScore}점)` : "목록 없음"} → {c.after ? `${c.after}순위(${c.afterScore}점)` : "목록에서 빠짐"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {e.affectedSites.length > 0 && (
                  <p className="mt-1 text-[16.5px] text-ink-3">
                    영향받은 일정(예상 시간 변경):{" "}
                    {e.affectedSites
                      .map((x) => `${schedules.find((s) => s.id === x.id)?.title ?? x.id} ${x.before ? `${x.before.start}~${x.before.end}` : "-"} → ${x.after ? `${x.after.start}~${x.after.end}` : "-"}`)
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}
