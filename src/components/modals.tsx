"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Image as ImageIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
} from "@/components/ui";
import { useApp } from "@/lib/store";
import { TODAY, formatMoney } from "@/lib/format";
import type { DailyLog, Opportunity } from "@/lib/types";

const REGIONS = [
  "충남 보령",
  "충남 서천",
  "충남 홍성",
  "충남 서산",
  "충남 태안",
  "충남 논산",
  "전북 군산",
  "전북 익산",
];

const WORK_TYPES = [
  "전기공사",
  "전기증설",
  "통신배선",
  "네트워크 공사",
  "CCTV 설치",
  "통신·CCTV 설치",
  "전기·통신 통합",
];

/* ─────────────────────────────────────────────
 * 새 문의 등록
 * ───────────────────────────────────────────── */
export function NewInquiryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addOpportunity, showToast } = useApp();
  const [form, setForm] = useState({
    customer: "",
    contact: "",
    region: "충남 보령",
    workType: "전기공사",
    memo: "",
    amount: "",
    needsVisit: true,
    manager: "구본석 이사",
    nextDate: "2026-07-30",
    note: "",
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.customer.trim()) return;
    const o: Opportunity = {
      id: `o-${Date.now()}`,
      customer: form.customer.trim(),
      contact: form.contact.trim() || undefined,
      region: form.region,
      workType: form.workType,
      amount: Number(form.amount) || 0,
      manager: form.manager,
      probability: 30,
      stage: "inquiry",
      nextAction: form.needsVisit ? "방문 일정 확정" : "전화 상담",
      nextDate: form.nextDate,
      needsVisit: form.needsVisit,
      visitConfirmed: false,
      memo: [form.memo.trim(), form.note.trim()].filter(Boolean).join(" · "),
    };
    addOpportunity(o);
    showToast("새 문의가 등록됐어요");
    onClose();
    setForm((f) => ({ ...f, customer: "", contact: "", memo: "", amount: "", note: "" }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 문의 등록"
      desc="전화로 받은 문의를 등록하면 파이프라인 첫 단계에 바로 들어갑니다."
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="고객명" required>
          <input
            className={inputClass}
            value={form.customer}
            onChange={(e) => set("customer", e.target.value)}
            placeholder="예: 보령 웅천읍 ○○공장"
          />
        </Field>
        <Field label="연락처">
          <input
            className={inputClass}
            value={form.contact}
            onChange={(e) => set("contact", e.target.value)}
            placeholder="010-0000-0000"
          />
        </Field>
        <Field label="지역">
          <select
            className={inputClass}
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
          >
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="공사 종류">
          <select
            className={inputClass}
            value={form.workType}
            onChange={(e) => set("workType", e.target.value)}
          >
            {WORK_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="문의 내용">
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={form.memo}
              onChange={(e) => set("memo", e.target.value)}
              placeholder="예: 공장 증축에 따른 전기 증설 문의. 8월 착공 희망"
            />
          </Field>
        </div>
        <Field label="예상금액" hint="만원">
          <input
            className={inputClass}
            type="number"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="예: 8000"
          />
        </Field>
        <Field label="담당자">
          <select
            className={inputClass}
            value={form.manager}
            onChange={(e) => set("manager", e.target.value)}
          >
            {["구본석 이사", "김성태 과장", "대표"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="다음 연락일">
          <input
            className={inputClass}
            type="date"
            value={form.nextDate}
            onChange={(e) => set("nextDate", e.target.value)}
          />
        </Field>
        <Field label="현장방문" group>
          <div className="flex gap-2 pt-1">
            {[
              { v: true, label: "방문 필요" },
              { v: false, label: "방문 불필요" },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => set("needsVisit", o.v)}
                className={`rounded-xl px-3.5 py-2 text-[19.5px] font-semibold transition-colors ${
                  form.needsVisit === o.v
                    ? "bg-primary-light text-primary-dark"
                    : "bg-[#f2f4f6] text-ink-3"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="메모">
            <input
              className={inputClass}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="추가로 기억할 내용"
            />
          </Field>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <GhostButton onClick={onClose}>취소</GhostButton>
        <PrimaryButton onClick={submit} disabled={!form.customer.trim()}>
          문의 등록
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
 * 현장일보 작성 + AI 현장보고서
 * ───────────────────────────────────────────── */
export function DailyLogModal({
  open,
  onClose,
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}) {
  const { projects, addDailyLog, showToast } = useApp();
  const active = projects.filter((p) => p.statusKey !== "done");
  const [form, setForm] = useState({
    projectId: defaultProjectId ?? "p1",
    date: TODAY,
    work: "",
    headcount: "4",
    hours: "8",
    materials: "",
    issues: "",
    tomorrow: "",
    photos: 0,
  });
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const project = projects.find((p) => p.id === form.projectId);

  const generateReport = () => {
    if (!form.work.trim()) return;
    setGenerating(true);
    setAiReport(null);
    setTimeout(() => {
      const parts: string[] = [
        `금일 ${form.headcount}명의 작업자가 ${form.work.trim()} 작업을 ${form.hours}시간 진행했습니다.`,
      ];
      if (project) parts.push(`${project.shortName} 현장의 전체 공정은 약 ${project.progress}% 완료됐습니다.`);
      if (form.materials.trim()) parts.push(`주요 투입 자재는 ${form.materials.trim()}입니다.`);
      if (form.issues.trim())
        parts.push(`현장 이슈로 ${form.issues.trim()} 상황이 있어 일정과 원가 영향 확인이 필요합니다.`);
      if (form.tomorrow.trim()) parts.push(`내일은 ${form.tomorrow.trim()} 작업을 진행할 예정입니다.`);
      setAiReport(parts.join(" "));
      setGenerating(false);
    }, 900);
  };

  const submit = () => {
    if (!form.work.trim()) return;
    const d: DailyLog = {
      id: `d-${Date.now()}`,
      projectId: form.projectId,
      date: form.date,
      work: form.work.trim(),
      headcount: Number(form.headcount) || 0,
      hours: Number(form.hours) || 0,
      materials: form.materials.trim(),
      issues: form.issues.trim(),
      tomorrow: form.tomorrow.trim(),
      photoCount: form.photos,
      aiReport: aiReport ?? undefined,
    };
    addDailyLog(d);
    showToast("현장일보가 저장됐어요");
    onClose();
    setForm((f) => ({ ...f, work: "", materials: "", issues: "", tomorrow: "", photos: 0 }));
    setAiReport(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="현장일보 작성"
      desc="짧게 적어도 괜찮습니다. AI가 보고 가능한 문장으로 정리해 드려요."
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="프로젝트" required>
          <select
            className={inputClass}
            value={form.projectId}
            onChange={(e) => set("projectId", e.target.value)}
          >
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="날짜">
          <input
            className={inputClass}
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="작업내용" required>
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={form.work}
              onChange={(e) => set("work", e.target.value)}
              placeholder="예: 3층 통신배선 및 단자함 결선"
            />
          </Field>
        </div>
        <Field label="투입인원" hint="명">
          <input
            className={inputClass}
            type="number"
            value={form.headcount}
            onChange={(e) => set("headcount", e.target.value)}
          />
        </Field>
        <Field label="작업시간" hint="시간">
          <input
            className={inputClass}
            type="number"
            value={form.hours}
            onChange={(e) => set("hours", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="사용 자재">
            <input
              className={inputClass}
              value={form.materials}
              onChange={(e) => set("materials", e.target.value)}
              placeholder="예: UTP Cat.6 305m 2박스, 몰드 40m"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="현장사진" hint={`${form.photos}장`} group>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[...Array(form.photos)].map((_, i) => (
                <span
                  key={i}
                  className="flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-xl bg-primary-light text-primary"
                >
                  <ImageIcon size={30} />
                </span>
              ))}
              <button
                onClick={() => set("photos", Math.min(12, form.photos + 1))}
                className="flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-xl border-2 border-dashed border-line text-[30px] text-ink-3 transition-colors hover:border-primary hover:text-primary"
              >
                +
              </button>
            </div>
          </Field>
        </div>
        <Field label="발생 이슈">
          <input
            className={inputClass}
            value={form.issues}
            onChange={(e) => set("issues", e.target.value)}
            placeholder="예: 천장 마감 일정이 바뀜"
          />
        </Field>
        <Field label="내일 작업계획">
          <input
            className={inputClass}
            value={form.tomorrow}
            onChange={(e) => set("tomorrow", e.target.value)}
            placeholder="예: 4층 자재 반입"
          />
        </Field>
      </div>

      <div className="mt-5">
        <GhostButton
          onClick={generateReport}
          disabled={!form.work.trim() || generating}
          className="w-full !bg-primary-light !text-primary-dark hover:!bg-[#dcebfd]"
        >
          <Sparkles size={22} />
          {generating ? "보고서를 정리하고 있어요..." : "AI 현장보고서 만들기"}
        </GhostButton>
        {generating && (
          <div className="mt-3 space-y-2 rounded-2xl bg-[#f7f8fa] p-4">
            {[80, 62, 70].map((w, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-[#e5e8eb]"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        )}
        {aiReport && (
          <div className="rise-in mt-3 rounded-2xl border border-primary/15 bg-primary-light/60 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[18.8px] font-bold text-primary-dark">
              <Sparkles size={20} /> AI 현장보고서
            </p>
            <p className="text-[21px] leading-relaxed">{aiReport}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <GhostButton onClick={onClose}>취소</GhostButton>
        <PrimaryButton onClick={submit} disabled={!form.work.trim()}>
          현장일보 저장
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
 * 전화메모 AI 정리
 * ───────────────────────────────────────────── */
interface ParsedMemo {
  customer: string;
  projectId?: string;
  projectName: string;
  requestType: string;
  change: string;
  qty: string;
  action: string;
  estimate: number;
  estimateCost: number;
  approval: string;
  due: string;
  manager: string;
}

const DEFAULT_MEMO =
  "군산 김부장 전화 옴. CCTV 위치 2개 바꾸고 4대 더 달아달라고 함. 금액 다시 줘야 함. 이번 주 금요일 전에 회신 달라고 함.";

export function PhoneMemoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { projects, addChangeOrder, addTodo, showToast } = useApp();
  const [memo, setMemo] = useState(DEFAULT_MEMO);
  const [parsed, setParsed] = useState<ParsedMemo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    setParsed(null);
    setConfirming(false);
  };

  const analyze = () => {
    if (!memo.trim()) return;
    setAnalyzing(true);
    reset();
    setTimeout(() => {
      const text = memo;
      const byRegion = projects.find(
        (p) => p.statusKey !== "done" && text.includes(p.region.split(" ")[1])
      );
      const isCctv = text.includes("CCTV") || text.includes("씨씨티비");
      const proj =
        (isCctv && text.includes("군산")
          ? projects.find((p) => p.id === "p4")
          : undefined) ?? byRegion;
      const qtyMatch = text.match(/(\d+)\s*대/);
      const moveMatch = text.match(/(\d+)\s*개/);
      const qty = qtyMatch ? Number(qtyMatch[1]) : 0;
      const moves = moveMatch ? Number(moveMatch[1]) : 0;
      // 데모 단가: CCTV 1대 설치 매출 130만 원(원가 82만), 위치 변경 1개소 매출 50만 원(원가 31만)
      const estimate = qty * 130 + moves * 50 || 620;
      const estimateCost = qty * 82 + moves * 31 || 390;

      setParsed({
        customer: text.includes("김부장")
          ? "금강테크 김부장 (군산 국가산단)"
          : (proj?.client ?? "고객 확인 필요"),
        projectId: proj?.id,
        projectName: proj?.name ?? "연결된 프로젝트 없음 — 새 문의로 등록하세요",
        requestType: "변경 및 추가공사 요청",
        change: moves ? `CCTV 위치 ${moves}개소 변경` : text.slice(0, 32),
        qty: qty ? `CCTV ${qty}대 추가 설치` : "수량 확인 필요",
        action: "추가견적 작성 후 서면승인 요청",
        estimate,
        estimateCost,
        approval: "전화 요청 · 서면 미승인",
        due: text.includes("금요일") ? "2026년 7월 31일 (금)" : "2026년 7월 30일 (목)",
        manager: "구본석 이사",
      });
      setAnalyzing(false);
    }, 1100);
  };

  const register = () => {
    if (!parsed) return;
    const projectId = parsed.projectId ?? "p4";
    addChangeOrder({
      id: `co-${Date.now()}`,
      projectId,
      requestDate: TODAY,
      requester: parsed.customer,
      content: [parsed.change, parsed.qty].filter(Boolean).join(" · "),
      addRevenue: parsed.estimate,
      addCost: parsed.estimateCost,
      status: "견적 작성",
      verbalOnly: true,
      quoteSent: false,
      billed: false,
      dueDate: "2026-07-31",
    });
    addTodo({
      id: `t-${Date.now()}`,
      title: `${parsed.projectName} — 추가견적 발송 후 서면승인 받기`,
      action: `${parsed.action} · 회신기한 ${parsed.due}`,
      risk: `승인 없이 시공하면 ${formatMoney(parsed.estimate)}을 청구하지 못할 수 있습니다.`,
      amount: parsed.estimate,
      amountLabel: "미승인 추가공사",
      severity: "danger",
      ctaLabel: "추가공사 확인",
      projectId,
      href: `/projects/${projectId}?tab=changes`,
      done: false,
    });
    showToast("추가공사로 등록했어요. 오늘 할 일에도 추가됐습니다");
    onClose();
    reset();
    setTimeout(() => router.push("/change-orders"), 120);
  };

  const registerTodoOnly = () => {
    if (!parsed) return;
    addTodo({
      id: `t-${Date.now()}`,
      title: `${parsed.projectName} — ${parsed.change}`,
      action: `${parsed.action} · 회신기한 ${parsed.due}`,
      risk: "회신이 늦어지면 고객이 다른 업체에 문의할 수 있습니다.",
      amount: parsed.estimate,
      amountLabel: "예상 추가매출",
      severity: "warning",
      ctaLabel: "프로젝트 보기",
      projectId: parsed.projectId,
      href: parsed.projectId ? `/projects/${parsed.projectId}` : undefined,
      done: false,
    });
    showToast("오늘 할 일로 등록했어요");
    onClose();
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="전화메모 정리"
      desc="통화 내용을 적은 그대로 붙여넣으면 고객·프로젝트·조치사항으로 정리해 드립니다."
      size="lg"
    >
      {!confirming ? (
        <>
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 군산 김부장 전화 옴. CCTV 위치 2개 바꾸고 4대 더 달아달라고 함."
          />
          <PrimaryButton
            onClick={analyze}
            disabled={!memo.trim() || analyzing}
            className="mt-3 w-full"
          >
            <Sparkles size={22} />
            {analyzing ? "메모를 정리하고 있어요..." : "AI로 정리하기"}
          </PrimaryButton>

          {analyzing && (
            <div className="mt-4 space-y-2 rounded-2xl bg-[#f7f8fa] p-4">
              {[82, 70, 58, 66].map((w, i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-[#e5e8eb]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          )}

          {parsed && (
            <div className="rise-in mt-4 rounded-2xl border border-primary/15 bg-primary-light/45 p-5">
              <p className="mb-3 flex items-center gap-1.5 text-[18.8px] font-bold text-primary-dark">
                <Sparkles size={20} /> AI 정리 결과
              </p>
              <dl className="stagger space-y-2 text-[21px]">
                {(
                  [
                    ["고객 및 담당자", parsed.customer],
                    ["관련 프로젝트", parsed.projectName],
                    ["요청 유형", parsed.requestType],
                    ["변경 내용", parsed.change],
                    ["추가 수량", parsed.qty],
                    ["필요한 조치", parsed.action],
                    ["예상금액", formatMoney(parsed.estimate)],
                    ["승인상태", parsed.approval],
                    ["회신기한", parsed.due],
                    ["내부 담당자", parsed.manager],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-[10.5rem] shrink-0 font-semibold text-ink-3">{k}</dt>
                    <dd
                      className={`font-medium ${k === "승인상태" ? "text-danger" : "text-ink"}`}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <PrimaryButton onClick={() => setConfirming(true)}>
                  추가공사로 등록
                </PrimaryButton>
                <GhostButton onClick={registerTodoOnly}>할 일로만 등록</GhostButton>
                <GhostButton onClick={reset}>다시 정리</GhostButton>
              </div>
            </div>
          )}
        </>
      ) : (
        parsed && (
          <div className="rise-in">
            <button
              onClick={() => setConfirming(false)}
              className="mb-4 inline-flex items-center gap-1 text-[19.5px] font-semibold text-ink-3 hover:text-ink"
            >
              <ArrowLeft size={21} /> 정리 결과로 돌아가기
            </button>

            <p className="text-[22.5px] font-bold">이 내용으로 추가공사를 등록할까요?</p>
            <p className="mt-1 text-[20.2px] text-ink-2">{parsed.projectName}</p>
            <p className="mt-0.5 text-[20.2px] font-semibold">
              {parsed.change} · {parsed.qty}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                { label: "예상 추가매출", v: parsed.estimate, tone: "" },
                { label: "예상 추가원가", v: parsed.estimateCost, tone: "" },
                {
                  label: "남는 돈",
                  v: parsed.estimate - parsed.estimateCost,
                  tone: "text-success",
                },
              ].map((x) => (
                <div key={x.label} className="rounded-2xl bg-[#f7f8fa] p-3.5">
                  <p className="text-[18px] text-ink-3">{x.label}</p>
                  <p className={`mt-0.5 text-[24px] font-extrabold ${x.tone}`}>
                    {formatMoney(x.v)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2 rounded-2xl bg-danger-bg/60 p-4">
              <p className="flex items-start gap-2 text-[20.2px] font-bold text-danger">
                <AlertTriangle size={22} className="mt-0.5 shrink-0" />
                서면승인이 필요한 요청입니다
              </p>
              <p className="text-[19.5px] leading-relaxed text-ink-2">
                지금은 전화로만 받은 상태입니다. 견적서를 보내고 승인을 받은 뒤 시공해야
                청구할 때 문제가 생기지 않습니다.
              </p>
              <p className="text-[19.5px] font-semibold text-ink-2">
                견적 발송 예정일 · 2026년 7월 29일 (수) · 회신기한 {parsed.due}
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-[#f7f8fa] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[18.8px] font-bold text-ink-2">
                <TrendingUp size={20} className="text-primary" /> 등록하면 이렇게 반영됩니다
              </p>
              <ul className="space-y-1 text-[19.5px] text-ink-2">
                <li>· 오늘 할 일에 서면승인 항목이 추가됩니다</li>
                <li>· 추가공사 목록과 건수가 늘어납니다</li>
                <li>· 위험·누락 가능금액에 {formatMoney(parsed.estimate)}이 반영됩니다</li>
                <li>· 군산 프로젝트 상세의 변경·추가공사 탭에 표시됩니다</li>
              </ul>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <GhostButton onClick={() => setConfirming(false)}>취소</GhostButton>
              <PrimaryButton onClick={register}>추가공사 등록하기</PrimaryButton>
            </div>
          </div>
        )
      )}
    </Modal>
  );
}
