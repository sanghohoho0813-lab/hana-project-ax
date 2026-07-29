"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  MapPin,
  Phone,
  Play,
  Sparkles,
  UserCog,
} from "lucide-react";
import { useApp, nextId } from "@/lib/store";
import { NOW } from "@/lib/company";
import { MEMBERS, fullName, memberById } from "@/lib/team";
import {
  ackSentence,
  awaitingReview,
  elapsed,
  isOverdue,
  isUnacked,
  summarizeReport,
  whenLabel,
} from "@/lib/ops-calc";
import type { AckResponse, ReportKind, Task, WorkReport } from "@/lib/ops-types";
import {
  Badge,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  type Tone,
} from "@/components/ui";

/* ── 공통 표시 ─────────────────────────────────── */

export function statusTone(s: Task["status"]): Tone {
  if (s === "승인 완료") return "success";
  if (s === "지시됨") return "danger";
  if (s === "보완 요청") return "danger";
  if (s === "완료보고" || s === "검토 중") return "info";
  if (s === "진행 중") return "warning";
  if (s === "취소") return "neutral";
  return "info";
}

export function Avatar({ id, size = 44 }: { id: string; size?: number }) {
  const m = memberById(id);
  if (!m) return null;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl font-bold text-white"
      style={{
        background: m.color,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {m.initial}
    </span>
  );
}

/** 업무 카드 — 누가 지시했고 누가 언제 확인했는지가 항상 보인다 */
export function TaskCard({
  task,
  onOpen,
  compact = false,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  compact?: boolean;
}) {
  const { projects } = useApp();
  const project = projects.find((p) => p.id === task.projectId);
  const ack = ackSentence(task);
  const overdue = isOverdue(task);

  return (
    <button
      onClick={() => onOpen(task)}
      className={`card card-hover block w-full min-w-0 p-5 text-left ${
        overdue || isUnacked(task) ? "border border-danger/20" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(task.status)}>{task.status}</Badge>
        {overdue && <Badge tone="danger">기한 초과</Badge>}
        {task.priority === "긴급" && <Badge tone="warning">긴급</Badge>}
        {awaitingReview(task) && <Badge tone="info">검토 대기</Badge>}
      </div>

      <p className="mt-2.5 text-[23px] leading-snug font-bold">{task.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[18px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={19} /> {task.location}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={19} /> 기한 {whenLabel(task.dueAt)}
        </span>
        {project && <span className="truncate">{project.shortName}</span>}
      </div>

      <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-[#f7f8fa] px-4 py-3">
        <Avatar id={task.assigneeId} size={40} />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[19px] font-bold ${
              ack.tone === "danger"
                ? "text-danger"
                : ack.tone === "warning"
                  ? "text-warning"
                  : "text-success"
            }`}
          >
            {ack.text}
          </span>
          {!compact && (
            <span className="block truncate text-[17px] text-ink-3">
              {fullName(task.assignerId)} 지시 · {whenLabel(task.createdAt)} 전달
            </span>
          )}
        </span>
        {task.needsReport && (
          <span className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[16.5px] font-bold text-ink-2">
            결과보고 필요
          </span>
        )}
      </div>
    </button>
  );
}

/* ── 업무 상세 · 확인 · 진행 ─────────────────────── */

export function TaskDetailModal({
  task,
  onClose,
}: {
  task: Task | null;
  onClose: () => void;
}) {
  const {
    currentUserId,
    permission,
    projects,
    reports,
    acknowledgeTask,
    startTask,
    reviewTask,
    reassignTask,
    nudgeTask,
    showToast,
  } = useApp();
  const [reassign, setReassign] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [ackNote, setAckNote] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  if (!task) return null;

  const project = projects.find((p) => p.id === task.projectId);
  const ack = ackSentence(task);
  const isMine = task.assigneeId === currentUserId;
  const linked = reports.filter((r) => r.taskId === task.id);
  const assignee = memberById(task.assigneeId);

  const respond = (r: AckResponse) => {
    acknowledgeTask(task.id, r, ackNote.trim() || undefined);
    showToast(
      r === "확인했습니다" ? "업무를 확인했습니다" : `관리자에게 "${r}"로 회신했습니다`
    );
    setAckNote("");
    onClose();
  };

  return (
    <>
      <Modal open={!!task} onClose={onClose} title={task.title} desc={task.location} size="lg">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(task.status)}>{task.status}</Badge>
          {isOverdue(task) && <Badge tone="danger">기한 초과</Badge>}
          {task.priority === "긴급" && <Badge tone="warning">긴급</Badge>}
          {task.needsReport && <Badge tone="neutral">결과보고 필요</Badge>}
          {task.needsPhoto && <Badge tone="neutral">사진 필요</Badge>}
        </div>

        <p className="mt-4 rounded-2xl bg-[#f7f8fa] p-5 text-[20px] leading-relaxed">
          {task.content}
        </p>

        {/* 전달·확인 이력 */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
            <Avatar id={task.assignerId} size={44} />
            <div className="min-w-0">
              <p className="text-[19.5px] font-bold">{fullName(task.assignerId)}가 지시</p>
              <p className="text-[17.5px] text-ink-3">
                {whenLabel(task.createdAt)} 전달 · {elapsed(task.createdAt)}
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-3 rounded-2xl border p-4 ${
              ack.tone === "danger"
                ? "border-danger/25 bg-danger-bg/40"
                : ack.tone === "warning"
                  ? "border-warning/25 bg-warning-bg/40"
                  : "border-success/25 bg-success-bg/40"
            }`}
          >
            <Avatar id={task.assigneeId} size={44} />
            <div className="min-w-0">
              <p className="text-[19.5px] font-bold">{ack.text}</p>
              {task.ackNote && <p className="text-[17.5px] text-ink-2">“{task.ackNote}”</p>}
              <p className="text-[17.5px] text-ink-3">
                기한 {whenLabel(task.dueAt)} · 진행률 {task.progress}%
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-2 text-[18.5px] sm:grid-cols-2">
          {[
            ["관련 프로젝트", project?.name ?? "연결 없음"],
            ["공동 확인자", task.watcherIds.map((w) => fullName(w)).join(", ") || "없음"],
            ["시작일", task.startDate],
            ["마지막 업데이트", whenLabel(task.lastUpdateAt)],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="w-[9rem] shrink-0 text-ink-3">{k}</span>
              <span className="min-w-0 font-semibold">{v}</span>
            </div>
          ))}
        </div>

        {linked.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[19px] font-bold">제출된 보고 {linked.length}건</p>
            <div className="space-y-2">
              {linked.map((r) => (
                <div key={r.id} className="rounded-2xl bg-[#f7f8fa] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.reviewStatus === "승인" ? "success" : r.reviewStatus === "보완 요청" ? "danger" : "info"}>
                      {r.reviewStatus}
                    </Badge>
                    <span className="text-[18.5px] font-bold">{r.kind}</span>
                    <span className="text-[17px] text-ink-3">{whenLabel(r.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-[18.5px] leading-relaxed text-ink-2">
                    {r.summary?.done ?? r.raw}
                  </p>
                  {r.photoCount > 0 && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[17px] text-ink-3">
                      <Camera size={18} /> 사진 {r.photoCount}장
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 담당자 행동 */}
        {isMine && task.status === "지시됨" && (
          <div className="mt-6 rounded-2xl border border-primary/25 bg-primary-light/40 p-5">
            <p className="text-[20px] font-bold">이 업무를 확인하셨나요?</p>
            <input
              className={`${inputClass} mt-3`}
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
              placeholder="남길 말이 있으면 적어 주세요 (선택)"
            />
            <div className="mt-3 grid gap-2.5">
              <button
                onClick={() => respond("확인했습니다")}
                className="min-h-[3.5rem] rounded-2xl bg-primary px-5 text-[21px] font-bold text-white transition-colors hover:bg-primary-dark active:scale-[0.99]"
              >
                확인했습니다
              </button>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  onClick={() => respond("일정 조정이 필요합니다")}
                  className="min-h-[3.5rem] rounded-2xl bg-white px-5 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#f2f4f6]"
                >
                  일정 조정이 필요합니다
                </button>
                <button
                  onClick={() => respond("업무 내용 확인이 필요합니다")}
                  className="min-h-[3.5rem] rounded-2xl bg-white px-5 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#f2f4f6]"
                >
                  업무 내용 확인이 필요합니다
                </button>
              </div>
            </div>
          </div>
        )}

        {isMine && (task.status === "확인함" || task.status === "진행 중" || task.status === "보완 요청") && (
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {task.status !== "진행 중" && (
              <button
                onClick={() => {
                  startTask(task.id);
                  showToast("작업을 시작했습니다");
                  onClose();
                }}
                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[20px] font-bold text-white transition-opacity hover:opacity-90"
              >
                <Play size={22} /> 작업 시작
              </button>
            )}
            <button
              onClick={() => setReportOpen(true)}
              className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark sm:col-span-1"
            >
              <Sparkles size={22} /> 진행·완료보고
            </button>
          </div>
        )}

        {/* 관리자 행동 */}
        {permission.assignTask && !isMine && (
          <div className="mt-6 space-y-2.5">
            {awaitingReview(task) && permission.reviewReport && (
              <div className="rounded-2xl border border-primary/25 bg-primary-light/40 p-5">
                <p className="text-[20px] font-bold">완료보고를 검토해 주세요</p>
                <input
                  className={`${inputClass} mt-3`}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="검토 의견 (선택)"
                />
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <button
                    onClick={() => {
                      reviewTask(task.id, "승인", reviewNote.trim() || undefined);
                      showToast("완료보고를 승인했습니다");
                      onClose();
                    }}
                    className="min-h-[3.5rem] rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => {
                      reviewTask(task.id, "보완 요청", reviewNote.trim() || undefined);
                      showToast("보완을 요청했습니다");
                      onClose();
                    }}
                    className="min-h-[3.5rem] rounded-2xl bg-[#f2f4f6] px-5 text-[20px] font-bold text-ink-2 transition-colors hover:bg-danger-bg hover:text-danger"
                  >
                    보완 요청
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-2.5 sm:grid-cols-3">
              <button
                onClick={() => {
                  nudgeTask(task.id);
                  showToast(`${fullName(task.assigneeId)}에게 다시 알렸습니다`);
                }}
                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-[#f2f4f6] px-4 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
              >
                <Bell size={21} /> 다시 알림
              </button>
              <a
                href={`tel:${assignee?.phone ?? ""}`}
                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-[#f2f4f6] px-4 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
              >
                <Phone size={21} /> 전화하기
              </a>
              <button
                onClick={() => setReassign((v) => !v)}
                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl bg-[#f2f4f6] px-4 text-[19px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
              >
                <UserCog size={21} /> 담당자 변경
              </button>
            </div>

            {reassign && (
              <div className="rise-in grid gap-2 rounded-2xl bg-[#f7f8fa] p-4 sm:grid-cols-3">
                {MEMBERS.filter((m) => m.id !== task.assigneeId).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      reassignTask(task.id, m.id);
                      showToast(`담당자를 ${m.name} ${m.roleLabel}로 변경했습니다`);
                      setReassign(false);
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-left text-[18.5px] font-semibold transition-shadow hover:shadow-md"
                  >
                    <Avatar id={m.id} size={36} />
                    <span className="truncate">
                      {m.name} {m.roleLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {project && (
          <Link
            href={`/projects/${project.id}?tab=comms`}
            className="mt-5 inline-flex items-center gap-1.5 text-[19px] font-bold text-primary hover:underline"
          >
            프로젝트 타임라인 보기 <ArrowRight size={20} />
          </Link>
        )}
      </Modal>

      <ReportModal
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          onClose();
        }}
        task={task}
      />
    </>
  );
}

/* ── 업무보고 작성 ─────────────────────────────── */

const REPORT_KINDS: ReportKind[] = [
  "시작 보고",
  "진행 보고",
  "완료 보고",
  "현장 이슈",
  "일정 변경 요청",
  "일일 업무보고",
];

export function ReportModal({
  open,
  onClose,
  task,
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultProjectId?: string;
}) {
  const { addReport, showToast, currentUserId, projects, tasks } = useApp();
  const [kind, setKind] = useState<ReportKind>("진행 보고");
  const [taskId, setTaskId] = useState(task?.id ?? "");
  const [raw, setRaw] = useState("");
  const [progress, setProgress] = useState(task?.progress ?? 50);
  const [photos, setPhotos] = useState(0);
  const [issue, setIssue] = useState("");
  const [support, setSupport] = useState("");
  const [next, setNext] = useState("");
  const [eta, setEta] = useState("");
  const [summary, setSummary] = useState<ReturnType<typeof summarizeReport> | null>(null);
  const [generating, setGenerating] = useState(false);

  const myTasks = tasks.filter((t) => t.assigneeId === currentUserId);
  const activeTask = tasks.find((t) => t.id === (task?.id ?? taskId));
  const projectId = activeTask?.projectId ?? defaultProjectId;
  const project = projects.find((p) => p.id === projectId);

  const generate = () => {
    if (!raw.trim()) return;
    setGenerating(true);
    setSummary(null);
    setTimeout(() => {
      setSummary(summarizeReport(raw));
      setGenerating(false);
    }, 800);
  };

  const submit = () => {
    if (!raw.trim()) return;
    const r: WorkReport = {
      id: nextId("r"),
      taskId: activeTask?.id,
      projectId,
      authorId: currentUserId,
      kind,
      createdAt: NOW,
      raw: raw.trim(),
      progress: kind === "완료 보고" ? 100 : progress,
      photoCount: photos,
      issue: issue.trim() || undefined,
      needSupport: support.trim() || undefined,
      next: next.trim() || undefined,
      eta: eta.trim() || undefined,
      summary: summary ?? summarizeReport(raw),
      reviewStatus: "검토 대기",
    };
    addReport(r);
    showToast(`${kind}를 제출했습니다. 관리자 검토를 기다립니다`);
    onClose();
    setRaw("");
    setSummary(null);
    setPhotos(0);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="업무보고 작성"
      desc="짧게 적어도 괜찮습니다. 정돈된 보고서로 만들어 드려요."
      size="lg"
    >
      <Field label="보고 유형" group>
        <div className="flex flex-wrap gap-2 pt-1">
          {REPORT_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`min-h-[3rem] rounded-xl px-4 text-[18.5px] font-bold transition-colors ${
                kind === k ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-2"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </Field>

      {!task && (
        <div className="mt-4">
          <Field label="관련 업무">
            <select
              className={inputClass}
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">업무 연결 없음</option>
              {myTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {project && (
        <p className="mt-3 rounded-xl bg-[#f7f8fa] px-4 py-3 text-[18.5px] text-ink-2">
          관련 프로젝트 · {project.name}
        </p>
      )}

      <div className="mt-4">
        <Field label="오늘 수행한 내용" required>
          <textarea
            className={`${inputClass} min-h-[8rem] resize-y leading-relaxed`}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="예: 오늘 군산 현장 CCTV 4대 배선 끝냄. 위치 2개 바뀌어서 내일 다시 잡아야 함. 케이블 30m 정도 더 필요."
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={`진행률 · ${kind === "완료 보고" ? 100 : progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={kind === "완료 보고" ? 100 : progress}
            disabled={kind === "완료 보고"}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-[#3182f6]"
          />
        </Field>
        <Field label="예상 완료시간">
          <input
            className={inputClass}
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            placeholder="예: 오늘 오후 5시"
          />
        </Field>
        <Field label="발생한 문제">
          <input
            className={inputClass}
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="예: 자재 부족"
          />
        </Field>
        <Field label="필요한 지원">
          <input
            className={inputClass}
            value={support}
            onChange={(e) => setSupport(e.target.value)}
            placeholder="예: 케이블 추가 발주"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="다음 작업">
            <input
              className={inputClass}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="예: 변경 위치 재시공"
            />
          </Field>
        </div>
      </div>

      <div className="mt-4">
        <Field label={`현장사진 · ${photos}장`} group>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[...Array(photos)].map((_, i) => (
              <span
                key={i}
                className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl bg-primary-light text-primary"
              >
                <ImageIcon size={26} />
              </span>
            ))}
            <button
              onClick={() => setPhotos((p) => Math.min(12, p + 1))}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl border-2 border-dashed border-line text-[26px] text-ink-3 transition-colors hover:border-primary hover:text-primary"
            >
              <Camera size={26} />
            </button>
          </div>
        </Field>
      </div>

      <GhostButton
        onClick={generate}
        disabled={!raw.trim() || generating}
        className="mt-5 min-h-[3.5rem] w-full !bg-primary-light !text-[20px] !text-primary-dark hover:!bg-[#dcebfd]"
      >
        <Sparkles size={22} />
        {generating ? "보고서를 정리하고 있어요..." : "보고서로 정리하기"}
      </GhostButton>

      {summary && (
        <div className="rise-in mt-3 rounded-2xl border border-primary/20 bg-primary-light/50 p-5">
          <p className="mb-3 flex items-center gap-1.5 text-[18px] font-bold text-primary-dark">
            <Sparkles size={19} /> 정리 결과
          </p>
          <dl className="stagger space-y-2 text-[19px]">
            {(
              [
                ["완료 작업", summary.done],
                ["변경사항", summary.changes],
                ["추가 필요자재", summary.materials],
                ["다음 작업", summary.next],
                ["예상 일정", summary.schedule],
                ["관리자 확인 필요", summary.needsManager],
              ] as [string, string | undefined][]
            )
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-[10.5rem] shrink-0 font-semibold text-ink-3">{k}</dt>
                  <dd className="min-w-0 font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        <GhostButton onClick={onClose} className="min-h-[3.5rem] !text-[20px]">
          취소
        </GhostButton>
        <PrimaryButton
          onClick={submit}
          disabled={!raw.trim()}
          className="min-h-[3.5rem] !text-[20px]"
        >
          이 내용으로 보고
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ── 알림 카드 ─────────────────────────────────── */

export function AlertCard({
  alert,
  onOpenTask,
}: {
  alert: import("@/lib/ops-types").OpsAlert;
  onOpenTask?: (id: string) => void;
}) {
  const { nudgeTask, showToast, tasks, acknowledgeSchedule } = useApp();
  const member = memberById(alert.memberId);
  const tone =
    alert.severity === "danger" ? "danger" : alert.severity === "warning" ? "warning" : "info";

  return (
    <div
      className={`card p-5 ${alert.severity === "danger" ? "border border-danger/20 pulse-danger" : ""}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <span
            className={`flex h-[3.4rem] w-[3.4rem] shrink-0 items-center justify-center rounded-xl ${
              tone === "danger"
                ? "bg-danger-bg text-danger"
                : tone === "warning"
                  ? "bg-warning-bg text-warning"
                  : "bg-info-bg text-info"
            }`}
          >
            <AlertTriangle size={26} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[22px] leading-snug font-bold">{alert.title}</p>
              <Badge tone={tone}>{alert.rule}</Badge>
            </div>
            <p className="mt-1.5 text-[19px] leading-relaxed text-ink-2">{alert.detail}</p>
            {alert.elapsed && (
              <p className="mt-0.5 text-[18px] text-ink-3">{alert.elapsed}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {alert.taskId && (
            <button
              onClick={() => {
                nudgeTask(alert.taskId!);
                showToast(`${member?.name} ${member?.roleLabel}에게 다시 알렸습니다`);
              }}
              className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[18.5px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
            >
              <Bell size={20} /> 다시 알림
            </button>
          )}
          {alert.scheduleId && !alert.taskId && (
            <button
              onClick={() => {
                acknowledgeSchedule(alert.scheduleId!);
                showToast("확인 처리했습니다");
              }}
              className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[18.5px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
            >
              <CheckCircle2 size={20} /> 직접 확인 처리
            </button>
          )}
          <a
            href={`tel:${member?.phone ?? ""}`}
            className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-4 text-[18.5px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
          >
            <Phone size={20} /> 전화
          </a>
          {alert.taskId && onOpenTask && (
            <button
              onClick={() => onOpenTask(alert.taskId!)}
              className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-primary px-4 text-[18.5px] font-bold text-white transition-colors hover:bg-primary-dark"
            >
              업무 열기 <ArrowRight size={20} />
            </button>
          )}
          {!alert.taskId && alert.rule === "일정 충돌" && (
            <Link
              href="/schedule"
              className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-primary px-4 text-[18.5px] font-bold text-white transition-colors hover:bg-primary-dark"
            >
              일정 조정 <ArrowRight size={20} />
            </Link>
          )}
          {!alert.taskId && alert.rule !== "일정 충돌" && (
            <Link
              href="/schedule"
              className="inline-flex min-h-[3.25rem] items-center gap-1.5 rounded-xl bg-primary px-4 text-[18.5px] font-bold text-white transition-colors hover:bg-primary-dark"
            >
              일정 상세 <ArrowRight size={20} />
            </Link>
          )}
        </div>
      </div>
      {alert.taskId && !tasks.find((t) => t.id === alert.taskId) && null}
    </div>
  );
}
