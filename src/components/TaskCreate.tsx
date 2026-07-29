"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Sparkles, UserRound } from "lucide-react";
import { useApp, nextId } from "@/lib/store";
import { NOW } from "@/lib/company";
import { MEMBERS, fullName } from "@/lib/team";
import { parseInstruction, type ParsedInstruction } from "@/lib/ops-calc";
import type { Task, TaskPriority } from "@/lib/ops-types";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
} from "@/components/ui";
import { Avatar } from "@/components/ops";

const PRIORITIES: TaskPriority[] = ["긴급", "보통", "낮음"];

/* ── 새 업무지시 ─────────────────────────────── */

export function TaskCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addTask, addSchedule, addTimeline, projects, currentUserId, showToast } = useApp();
  const [form, setForm] = useState({
    title: "",
    projectId: "",
    content: "",
    assigneeId: "u4",
    watchers: [] as string[],
    startDate: "2026-07-28",
    dueDate: "2026-07-29",
    dueTime: "18:00",
    priority: "보통" as TaskPriority,
    needsReport: true,
    needsPhoto: false,
    location: "",
    repeat: "",
    docNote: "",
    memo: "",
    withSchedule: true,
    scheduleStart: "09:00",
    scheduleEnd: "11:00",
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.title.trim() && form.content.trim();

  const submit = () => {
    if (!valid) return;
    const project = projects.find((p) => p.id === form.projectId);
    const id = nextId("t");
    const task: Task = {
      id,
      title: form.title.trim(),
      projectId: form.projectId || undefined,
      content: form.content.trim(),
      assignerId: currentUserId,
      assigneeId: form.assigneeId,
      watcherIds: form.watchers,
      createdAt: NOW,
      startDate: form.startDate,
      dueAt: `${form.dueDate}T${form.dueTime}`,
      priority: form.priority,
      needsReport: form.needsReport,
      needsPhoto: form.needsPhoto,
      location: form.location.trim() || project?.region || "현장",
      repeat: form.repeat || undefined,
      docNote: form.docNote || undefined,
      memo: form.memo || undefined,
      status: "지시됨",
      progress: 0,
      lastUpdateAt: NOW,
    };
    addTask(task);

    if (form.withSchedule) {
      addSchedule({
        id: nextId("s"),
        title: form.title.trim(),
        projectId: form.projectId || undefined,
        region: task.location,
        assigneeId: form.assigneeId,
        date: form.startDate,
        start: form.scheduleStart,
        end: form.scheduleEnd,
        travelMinutes: 30,
        status: "예정",
        taskId: id,
      });
    }

    addTimeline(
      form.projectId || undefined,
      "업무지시",
      currentUserId,
      `${form.title.trim()} 업무를 ${fullName(form.assigneeId)}에게 전달했습니다.`,
      { taskId: id }
    );

    showToast(`${fullName(form.assigneeId)}에게 업무를 전달했습니다`);
    onClose();
    setForm((f) => ({ ...f, title: "", content: "", location: "", memo: "" }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 업무지시"
      desc="전달하면 담당자 화면에 바로 뜨고, 확인 여부가 추적됩니다."
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="업무 제목" required>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="예: 서천 학교 통신 상태 점검"
            />
          </Field>
        </div>
        <Field label="관련 프로젝트">
          <select
            className={inputClass}
            value={form.projectId}
            onChange={(e) => set("projectId", e.target.value)}
          >
            <option value="">연결 없음</option>
            {projects
              .filter((p) => p.statusKey !== "done")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="위치 또는 현장">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="예: 충남 서천 장항산단"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="업무 내용" required>
            <textarea
              className={`${inputClass} min-h-[7rem] resize-y leading-relaxed`}
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              placeholder="무엇을, 어디까지 해야 하는지 적어 주세요."
            />
          </Field>
        </div>
      </div>

      <div className="mt-4">
        <Field label="담당자" group required>
          <div className="grid gap-2 pt-1 sm:grid-cols-3">
            {MEMBERS.filter((m) => m.id !== currentUserId).map((m) => (
              <button
                key={m.id}
                onClick={() => set("assigneeId", m.id)}
                className={`flex min-h-[3.5rem] items-center gap-2.5 rounded-xl px-3 text-left text-[18.5px] font-semibold transition-colors ${
                  form.assigneeId === m.id
                    ? "bg-primary-light text-primary-dark"
                    : "bg-[#f2f4f6] text-ink-2"
                }`}
              >
                <Avatar id={m.id} size={36} />
                <span className="truncate">
                  {m.name} {m.roleLabel}
                </span>
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="공동 확인자" group>
          <div className="flex flex-wrap gap-2 pt-1">
            {MEMBERS.filter((m) => m.id !== form.assigneeId).map((m) => {
              const on = form.watchers.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() =>
                    set(
                      "watchers",
                      on ? form.watchers.filter((w) => w !== m.id) : [...form.watchers, m.id]
                    )
                  }
                  className={`min-h-[3rem] rounded-xl px-4 text-[18px] font-bold transition-colors ${
                    on ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-3"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="시작일">
          <input
            type="date"
            className={inputClass}
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>
        <Field label="완료기한 날짜">
          <input
            type="date"
            className={inputClass}
            value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </Field>
        <Field label="완료기한 시각">
          <input
            type="time"
            className={inputClass}
            value={form.dueTime}
            onChange={(e) => set("dueTime", e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="중요도" group>
          <div className="flex gap-2 pt-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => set("priority", p)}
                className={`min-h-[3rem] flex-1 rounded-xl text-[18.5px] font-bold transition-colors ${
                  form.priority === p ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-2"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="필요한 결과" group>
          <div className="flex gap-2 pt-1">
            {[
              { k: "needsReport", label: "결과보고" },
              { k: "needsPhoto", label: "사진 첨부" },
            ].map((o) => {
              const on = form[o.k as "needsReport" | "needsPhoto"];
              return (
                <button
                  key={o.k}
                  onClick={() => set(o.k, !on)}
                  className={`min-h-[3rem] flex-1 rounded-xl text-[18.5px] font-bold transition-colors ${
                    on ? "bg-primary-light text-primary-dark" : "bg-[#f2f4f6] text-ink-3"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {o.label}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="반복">
          <select
            className={inputClass}
            value={form.repeat}
            onChange={(e) => set("repeat", e.target.value)}
          >
            <option value="">반복 없음</option>
            <option value="매일">매일</option>
            <option value="매주">매주</option>
            <option value="매월">매월</option>
          </select>
        </Field>
        <Field label="관련 문서">
          <input
            className={inputClass}
            value={form.docNote}
            onChange={(e) => set("docNote", e.target.value)}
            placeholder="예: 도면 3층 평면도"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="메모">
            <input
              className={inputClass}
              value={form.memo}
              onChange={(e) => set("memo", e.target.value)}
              placeholder="추가로 전달할 내용"
            />
          </Field>
        </div>
      </div>

      {/* 일정 함께 등록 */}
      <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
        <button
          onClick={() => set("withSchedule", !form.withSchedule)}
          className="flex items-center gap-2.5 text-[19.5px] font-bold"
        >
          <span
            className={`flex h-[1.6rem] w-[1.6rem] items-center justify-center rounded-md ${
              form.withSchedule ? "bg-primary text-white" : "bg-white text-transparent"
            }`}
          >
            ✓
          </span>
          <CalendarDays size={22} className="text-ink-3" /> 통합일정에도 함께 등록
        </button>
        {form.withSchedule && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="시작 시각">
              <input
                type="time"
                className={inputClass}
                value={form.scheduleStart}
                onChange={(e) => set("scheduleStart", e.target.value)}
              />
            </Field>
            <Field label="종료 시각">
              <input
                type="time"
                className={inputClass}
                value={form.scheduleEnd}
                onChange={(e) => set("scheduleEnd", e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        <GhostButton onClick={onClose} className="min-h-[3.5rem] !text-[20px]">
          취소
        </GhostButton>
        <PrimaryButton onClick={submit} disabled={!valid} className="min-h-[3.5rem] !text-[20px]">
          업무 전달하기
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ── 전화메모 → 업무·일정 ─────────────────────── */

const DEFAULT_MEMO =
  "내일 오전에 박기사 서천 학교 먼저 가서 통신 상태 확인하고 사진 찍어서 올리라고 해. 끝나면 보령 현장으로 이동.";

export function PhoneMemoTaskModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { addTask, addSchedule, addTimeline, currentUserId, showToast, projects } = useApp();
  const [memo, setMemo] = useState(DEFAULT_MEMO);
  const [parsed, setParsed] = useState<ParsedInstruction[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState(false);

  const analyze = () => {
    if (!memo.trim()) return;
    setAnalyzing(true);
    setParsed(null);
    setTimeout(() => {
      setParsed(parseInstruction(memo));
      setAnalyzing(false);
    }, 1000);
  };

  const patch = (i: number, p: Partial<ParsedInstruction>) =>
    setParsed((ps) => (ps ? ps.map((x, idx) => (idx === i ? { ...x, ...p } : x)) : ps));

  const register = () => {
    if (!parsed) return;
    parsed.forEach((p) => {
      const id = nextId("t");
      addTask({
        id,
        title: p.title,
        projectId: p.projectId,
        content: p.content,
        assignerId: currentUserId,
        assigneeId: p.assigneeId,
        watcherIds: [currentUserId],
        createdAt: NOW,
        startDate: p.date,
        dueAt: `${p.date}T${p.end}`,
        priority: "보통",
        needsReport: p.needsReport,
        needsPhoto: p.needsPhoto,
        location: p.location,
        status: "지시됨",
        progress: 0,
        lastUpdateAt: NOW,
      });
      addSchedule({
        id: nextId("s"),
        title: p.title,
        projectId: p.projectId,
        region: p.location,
        assigneeId: p.assigneeId,
        date: p.date,
        start: p.start,
        end: p.end,
        travelMinutes: 40,
        status: "예정",
        taskId: id,
      });
      addTimeline(
        p.projectId,
        "업무지시",
        currentUserId,
        `${p.title} 업무를 ${fullName(p.assigneeId)}에게 전달했습니다. (전화메모에서 등록)`,
        { taskId: id }
      );
    });
    showToast(`업무 ${parsed.length}건과 일정을 등록했습니다`);
    onClose();
    setParsed(null);
    setTimeout(() => router.push("/tasks"), 120);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setParsed(null);
        setEditing(false);
      }}
      title="전화메모 정리"
      desc="통화하면서 적은 메모를 그대로 붙여넣으면 업무와 일정으로 만들어 드립니다."
      size="lg"
    >
      {!parsed ? (
        <>
          <textarea
            className={`${inputClass} min-h-[8rem] resize-y leading-relaxed`}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 내일 오전 박기사 서천 학교 통신 상태 확인하고 사진 올린 다음 보령 현장으로 이동"
          />
          <PrimaryButton
            onClick={analyze}
            disabled={!memo.trim() || analyzing}
            className="mt-3 min-h-[3.5rem] w-full !text-[20px]"
          >
            <Sparkles size={22} />
            {analyzing ? "메모를 정리하고 있어요..." : "업무로 정리하기"}
          </PrimaryButton>
          {analyzing && (
            <div className="mt-4 space-y-2 rounded-2xl bg-[#f7f8fa] p-4">
              {[82, 68, 74].map((w, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-[#e5e8eb]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rise-in">
          <button
            onClick={() => setParsed(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-[18.5px] font-semibold text-ink-3 hover:text-ink"
          >
            <ArrowLeft size={20} /> 메모 다시 입력
          </button>

          <div className="space-y-3">
            {parsed.map((p, i) => {
              const project = projects.find((x) => x.id === p.projectId);
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-primary/20 bg-primary-light/40 p-5"
                >
                  <p className="mb-3 flex items-center gap-1.5 text-[18px] font-bold text-primary-dark">
                    <Sparkles size={19} /> 업무 {i + 1}
                  </p>
                  <dl className="stagger space-y-2 text-[19.5px]">
                    {(
                      [
                        ["담당자", fullName(p.assigneeId)],
                        ["일정", `${p.date} ${p.start} ~ ${p.end}`],
                        ["장소", p.location],
                        ["업무", p.title],
                        ["관련 프로젝트", project?.name ?? "연결 없음"],
                        ["필수 결과", p.needsPhoto ? "현장사진 + 결과보고" : "결과보고"],
                        ...(p.followUp ? [["다음 일정", p.followUp] as [string, string]] : []),
                      ] as [string, string][]
                    ).map(([k, v]) => (
                      <div key={k} className="flex gap-3">
                        <dt className="w-[9.5rem] shrink-0 font-semibold text-ink-3">{k}</dt>
                        <dd className="min-w-0 font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  {editing && (
                    <div className="mt-4 grid gap-3 border-t border-primary/20 pt-4 sm:grid-cols-2">
                      <Field label="담당자 변경" group>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {MEMBERS.filter((m) => m.role !== "ceo").map((m) => (
                            <button
                              key={m.id}
                              onClick={() => patch(i, { assigneeId: m.id })}
                              className={`min-h-[2.8rem] rounded-xl px-3 text-[17.5px] font-bold ${
                                p.assigneeId === m.id
                                  ? "bg-primary text-white"
                                  : "bg-white text-ink-2"
                              }`}
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="시작">
                          <input
                            type="time"
                            className={inputClass}
                            value={p.start}
                            onChange={(e) => patch(i, { start: e.target.value })}
                          />
                        </Field>
                        <Field label="종료">
                          <input
                            type="time"
                            className={inputClass}
                            value={p.end}
                            onChange={(e) => patch(i, { end: e.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
            <p className="mb-2 flex items-center gap-1.5 text-[18px] font-bold text-ink-2">
              <UserRound size={19} className="text-primary" /> 등록하면 이렇게 반영됩니다
            </p>
            <ul className="space-y-1 text-[18.5px] text-ink-2">
              <li>· 업무지시 목록과 통합일정에 추가됩니다</li>
              <li>· 담당자 모바일 첫 화면에 새 업무로 표시됩니다</li>
              <li>· 확인하지 않으면 관리자 미확인 목록에 올라옵니다</li>
              <li>· 관련 프로젝트 타임라인에 기록이 남습니다</li>
            </ul>
          </div>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
            <GhostButton
              onClick={() => setEditing((v) => !v)}
              className="min-h-[3.5rem] !text-[19px]"
            >
              {editing ? "수정 닫기" : "담당자·시간 수정"}
            </GhostButton>
            <GhostButton
              onClick={() => {
                onClose();
                setParsed(null);
              }}
              className="min-h-[3.5rem] !text-[19px]"
            >
              취소
            </GhostButton>
            <PrimaryButton onClick={register} className="min-h-[3.5rem] !text-[19px]">
              업무와 일정으로 등록
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
