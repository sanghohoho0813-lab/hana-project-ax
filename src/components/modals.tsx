"use client";

import React, { useState } from "react";
import { Sparkles, Image as ImageIcon } from "lucide-react";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
} from "@/components/ui";
import { useApp } from "@/lib/store";
import { TODAY } from "@/lib/format";
import type { DailyLog, Opportunity } from "@/lib/types";

// ─────────────────────────────────────────────
// 새 문의 등록
// ─────────────────────────────────────────────
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

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

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
      nextAction: form.needsVisit ? "현장방문 일정 협의" : "전화 상담",
      nextDate: form.nextDate,
      needsVisit: form.needsVisit,
      memo: [form.memo.trim(), form.note.trim()].filter(Boolean).join(" · "),
    };
    addOpportunity(o);
    showToast("새 문의가 등록됐어요");
    onClose();
    setForm((f) => ({ ...f, customer: "", contact: "", memo: "", amount: "", note: "" }));
  };

  return (
    <Modal open={open} onClose={onClose} title="새 문의 등록" wide>
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
            {["충남 보령", "충남 서천", "충남 홍성", "충남 서산", "충남 태안", "충남 논산", "전북 군산", "전북 익산"].map(
              (r) => (
                <option key={r}>{r}</option>
              )
            )}
          </select>
        </Field>
        <Field label="공사 종류">
          <select
            className={inputClass}
            value={form.workType}
            onChange={(e) => set("workType", e.target.value)}
          >
            {["전기공사", "전기증설", "통신배선", "네트워크 공사", "CCTV 설치", "통신·CCTV 설치", "전기·통신 통합"].map(
              (t) => (
                <option key={t}>{t}</option>
              )
            )}
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
        <Field label="예상금액 (만원)">
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
        <Field label="현장방문 필요 여부">
          <div className="flex gap-2 pt-1.5">
            {[
              { v: true, label: "방문 필요" },
              { v: false, label: "불필요" },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => set("needsVisit", o.v)}
                className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
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
              placeholder="추가 메모"
            />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>취소</GhostButton>
        <PrimaryButton onClick={submit} disabled={!form.customer.trim()}>
          문의 등록
        </PrimaryButton>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// 현장일보 작성 (+ AI 현장보고서)
// ─────────────────────────────────────────────
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

  const set = (k: string, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const project = projects.find((p) => p.id === form.projectId);

  const generateReport = () => {
    if (!form.work.trim()) return;
    setGenerating(true);
    setAiReport(null);
    setTimeout(() => {
      const parts: string[] = [];
      parts.push(
        `금일 ${form.headcount}명의 작업자가 ${form.work.trim()} 작업을 ${form.hours}시간 진행했습니다.`
      );
      if (project)
        parts.push(
          `${project.name}의 전체 공정은 약 ${project.progress}% 수준입니다.`
        );
      if (form.materials.trim())
        parts.push(`주요 투입 자재는 ${form.materials.trim()}입니다.`);
      if (form.issues.trim())
        parts.push(
          `현장 이슈: ${form.issues.trim()} — 일정과 원가 영향 확인이 필요합니다.`
        );
      if (form.tomorrow.trim())
        parts.push(`익일 작업계획은 ${form.tomorrow.trim()}입니다.`);
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
    <Modal open={open} onClose={onClose} title="현장일보 작성" wide>
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
        <Field label="투입인원 (명)">
          <input
            className={inputClass}
            type="number"
            value={form.headcount}
            onChange={(e) => set("headcount", e.target.value)}
          />
        </Field>
        <Field label="작업시간 (시간)">
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
          <Field label="현장사진">
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[...Array(form.photos)].map((_, i) => (
                <span
                  key={i}
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light text-primary"
                >
                  <ImageIcon size={20} />
                </span>
              ))}
              <button
                onClick={() => set("photos", Math.min(12, form.photos + 1))}
                className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-dashed border-line text-ink-3 transition-colors hover:border-primary hover:text-primary"
              >
                +
              </button>
              <span className="text-[12.5px] text-ink-3">
                데모에서는 샘플 사진 추가 방식으로 동작합니다 ({form.photos}장)
              </span>
            </div>
          </Field>
        </div>
        <Field label="발생 이슈">
          <input
            className={inputClass}
            value={form.issues}
            onChange={(e) => set("issues", e.target.value)}
            placeholder="예: 천장 마감 일정 변경"
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

      <div className="mt-4">
        <GhostButton
          onClick={generateReport}
          disabled={!form.work.trim() || generating}
          className="w-full !bg-primary-light !text-primary-dark hover:!bg-[#dcebfd]"
        >
          <Sparkles size={15} />
          {generating ? "보고서 생성 중..." : "AI 현장보고서 만들기"}
        </GhostButton>
        {generating && (
          <div className="mt-3 space-y-2 rounded-2xl bg-[#f7f8fa] p-4">
            <div className="h-3 w-4/5 animate-pulse rounded bg-[#e5e8eb]" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-[#e5e8eb]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-[#e5e8eb]" />
          </div>
        )}
        {aiReport && (
          <div className="rise-in mt-3 rounded-2xl border border-primary/20 bg-primary-light/60 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-primary-dark">
              <Sparkles size={13} /> AI 현장보고서
            </p>
            <p className="text-[14px] leading-relaxed text-ink">{aiReport}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>취소</GhostButton>
        <PrimaryButton onClick={submit} disabled={!form.work.trim()}>
          현장일보 저장
        </PrimaryButton>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// 전화메모 AI 정리
// ─────────────────────────────────────────────
interface ParsedMemo {
  customer: string;
  projectId?: string;
  projectName: string;
  request: string;
  qty?: string;
  action: string;
  approval: string;
  manager: string;
  due: string;
}

export function PhoneMemoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { projects, addChangeOrder, addTodo, showToast } = useApp();
  const [memo, setMemo] = useState(
    "군산 김부장 전화 옴. CCTV 위치 2개 바꾸고 4대 더 달아달라고 함. 금액 다시 줘야 함."
  );
  const [parsed, setParsed] = useState<ParsedMemo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyze = () => {
    if (!memo.trim()) return;
    setAnalyzing(true);
    setParsed(null);
    setTimeout(() => {
      const text = memo;
      // 키워드 기반 프로젝트 매칭
      const match = projects.find(
        (p) =>
          p.statusKey !== "done" &&
          (text.includes(p.region.split(" ")[1]) ||
            p.workType.split("·").some((w) => text.includes(w)))
      );
      const isGunsanCctv = text.includes("군산") || text.includes("CCTV");
      const proj = isGunsanCctv
        ? (projects.find((p) => p.id === "p4") ?? match)
        : match;
      const qtyMatch = text.match(/(\d+)\s*대/);
      const moveMatch = text.match(/(\d+)\s*개/);
      setParsed({
        customer: text.includes("김부장")
          ? "군산 산업단지 김부장"
          : (proj?.client ?? "미확인 고객 (확인 필요)"),
        projectId: proj?.id,
        projectName: proj?.name ?? "연결 프로젝트 없음 — 새 문의로 등록 권장",
        request: text.includes("위치")
          ? `CCTV 위치 ${moveMatch?.[1] ?? "2"}개 변경`
          : text.slice(0, 40),
        qty: qtyMatch ? `${qtyMatch[1]}대 추가` : undefined,
        action: text.includes("금액") || text.includes("견적")
          ? "추가견적 작성"
          : "내용 확인 후 회신",
        approval: "미승인 (구두 요청)",
        manager: "구본석 이사",
        due: "2026년 7월 30일",
      });
      setAnalyzing(false);
    }, 1100);
  };

  const registerChangeOrder = () => {
    if (!parsed) return;
    addChangeOrder({
      id: `co-${Date.now()}`,
      projectId: parsed.projectId ?? "p4",
      requestDate: TODAY,
      requester: parsed.customer,
      content: [parsed.request, parsed.qty].filter(Boolean).join(" 및 "),
      addRevenue: 620,
      addCost: 390,
      status: "요청 접수",
      verbalOnly: true,
      quoteSent: false,
      billed: false,
    });
    showToast("추가공사로 등록됐어요");
    onClose();
    setParsed(null);
  };

  const registerTodo = () => {
    if (!parsed) return;
    addTodo({
      id: `t-${Date.now()}`,
      title: `${parsed.projectName} — ${[parsed.request, parsed.qty].filter(Boolean).join(", ")}`,
      desc: `${parsed.action} · 완료기한 ${parsed.due} · ${parsed.approval}`,
      severity: "warning",
      projectId: parsed.projectId,
      href: parsed.projectId ? `/projects/${parsed.projectId}` : undefined,
      done: false,
    });
    showToast("할 일로 등록됐어요");
    onClose();
    setParsed(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="전화메모 AI 정리" wide>
      <p className="mb-3 text-[13.5px] text-ink-2">
        통화 내용을 메모 그대로 붙여넣으면 AI가 고객·프로젝트·조치사항으로
        정리합니다.
      </p>
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
        <Sparkles size={15} />
        {analyzing ? "AI가 메모를 정리하는 중..." : "AI로 정리하기"}
      </PrimaryButton>

      {analyzing && (
        <div className="mt-4 space-y-2 rounded-2xl bg-[#f7f8fa] p-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-[#e5e8eb]"
              style={{ width: `${80 - i * 12}%` }}
            />
          ))}
        </div>
      )}

      {parsed && (
        <div className="rise-in mt-4 rounded-2xl border border-primary/20 bg-primary-light/50 p-5">
          <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold text-primary-dark">
            <Sparkles size={13} /> AI 정리 결과
          </p>
          <dl className="space-y-2 text-[14px]">
            {[
              ["고객", parsed.customer],
              ["관련 프로젝트", parsed.projectName],
              ["요청사항", parsed.request],
              ...(parsed.qty ? [["추가수량", parsed.qty]] : []),
              ["필요한 조치", parsed.action],
              ["승인상태", parsed.approval],
              ["담당자", parsed.manager],
              ["완료기한", parsed.due],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-24 shrink-0 font-semibold text-ink-3">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={registerChangeOrder}>
              추가공사로 등록
            </PrimaryButton>
            <GhostButton onClick={registerTodo}>할 일로 등록</GhostButton>
            <GhostButton onClick={() => setParsed(null)}>취소</GhostButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
