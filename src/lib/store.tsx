"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  APPROVALS,
  CHANGE_ORDERS,
  CUSTOMERS,
  DAILY_LOGS,
  OPPORTUNITIES,
  PROJECTS,
  TODOS,
} from "./data";
import { SCHEDULES, TASKS, TIMELINE, WORK_REPORTS } from "./ops-data";
import { NOW, NOW_DATE } from "./company";
import { buildRiskLogEntry, RISK_FIELDS, type RiskEvent, type RiskLogEntry } from "./risk-log";
import { fullName, permissionOf, withRo, type Permission } from "./team";
import type {
  Approval,
  BusinessView,
  ChangeOrder,
  Customer,
  DailyLog,
  Opportunity,
  Project,
  TodoItem,
} from "./types";
import type {
  AckResponse,
  ScheduleItem,
  Task,
  TimelineEvent,
  TimelineKind,
  WorkReport,
} from "./ops-types";

/** 깊은 복사 — 데모 초기화 시 원본 샘플이 오염되지 않게 한다 */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now()}-${seq++}`;

interface AppState {
  /* 사용자·권한 */
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  permission: Permission;

  business: BusinessView;
  setBusiness: (b: BusinessView) => void;

  /* 업무지시 */
  tasks: Task[];
  addTask: (t: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  /** 직원이 업무를 확인 */
  acknowledgeTask: (id: string, response: AckResponse, note?: string) => void;
  /** 직원이 업무를 열어봄 (확인 버튼 전) */
  openTask: (id: string) => void;
  startTask: (id: string) => void;
  /** 관리자가 완료보고를 검토 */
  reviewTask: (
    id: string,
    decision: "승인" | "보완 요청",
    note?: string,
  ) => void;
  reassignTask: (id: string, memberId: string) => void;
  /** 다시 알림 — 마지막 알림 시각만 갱신한다 */
  nudgeTask: (id: string) => void;

  /* 일정 */
  schedules: ScheduleItem[];
  addSchedule: (s: ScheduleItem) => void;
  updateSchedule: (id: string, patch: Partial<ScheduleItem>) => void;
  acknowledgeSchedule: (id: string) => void;
  /** 예상 종료 입력 (없애려면 undefined) — 연쇄위험 판단에 쓴다 */
  setScheduleEstimate: (
    id: string,
    expectedEnd: string | undefined,
    source?: "현장 보고" | "관리자 입력",
  ) => void;
  /** 실제 작업 시작 시각 기록 (없애려면 undefined) — 작업상태 편차·예상 종료 추정에 쓴다 */
  recordActualStart: (
    id: string,
    time: string | undefined,
    source?: "현장 보고" | "관리자 입력",
  ) => void;
  /** 위험판단 이력 — 데모 세션 안에서만 남는다 (서버 기록 아님) */
  riskLog: RiskLogEntry[];

  /* 보고 */
  reports: WorkReport[];
  addReport: (r: WorkReport) => void;
  reviewReport: (
    id: string,
    decision: "승인" | "보완 요청",
    note?: string,
  ) => void;

  /* 현장소통 타임라인 */
  timeline: TimelineEvent[];
  addTimeline: (
    projectId: string | undefined,
    kind: TimelineKind,
    actorId: string,
    text: string,
    extra?: { taskId?: string; photoCount?: number },
  ) => void;

  /* 기존 기능 */
  projects: Project[];
  updateProject: (id: string, patch: Partial<Project>) => void;
  toggleCloseoutDoc: (projectId: string, docName: string) => void;
  opportunities: Opportunity[];
  addOpportunity: (o: Opportunity) => void;
  addLead: (o: Opportunity) => void;
  updateOpportunity: (id: string, patch: Partial<Opportunity>) => void;
  changeOrders: ChangeOrder[];
  addChangeOrder: (c: ChangeOrder) => void;
  updateChangeOrder: (id: string, patch: Partial<ChangeOrder>) => void;
  approvals: Approval[];
  decideApproval: (id: string, decision: "승인" | "반려") => void;
  todos: TodoItem[];
  addTodo: (t: TodoItem) => void;
  toggleTodo: (id: string) => void;
  customers: Customer[];
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  dailyLogs: DailyLog[];
  addDailyLog: (d: DailyLog) => void;

  toast: string | null;
  showToast: (msg: string) => void;
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  demoStep: number;
  setDemoStep: (n: number) => void;
  resetDemo: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState("u2"); // 구본석 이사
  const [business, setBusiness] = useState<BusinessView>("all");

  const [tasks, setTasks] = useState<Task[]>(() => clone(TASKS));
  /** 판단 이력의 우선순위 계산에 쓰는 최신 업무 목록 */
  const tasksRef = useRef<Task[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() =>
    clone(SCHEDULES),
  );
  /** 아직 렌더되지 않은 변경까지 포함한 최신 일정 — 연달아 바꿔도 변경 전후를 정확히 비교한다 */
  const schedRef = useRef<ScheduleItem[]>(schedules);
  const [riskLog, setRiskLog] = useState<RiskLogEntry[]>([]);
  const [reports, setReports] = useState<WorkReport[]>(() =>
    clone(WORK_REPORTS),
  );
  const [timeline, setTimeline] = useState<TimelineEvent[]>(() =>
    clone(TIMELINE),
  );

  const [projects, setProjects] = useState<Project[]>(() => clone(PROJECTS));
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() =>
    clone(OPPORTUNITIES),
  );
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(() =>
    clone(CHANGE_ORDERS),
  );
  const [approvals, setApprovals] = useState<Approval[]>(() =>
    clone(APPROVALS),
  );
  const [todos, setTodos] = useState<TodoItem[]>(() => clone(TODOS));
  const [customers, setCustomers] = useState<Customer[]>(() =>
    clone(CUSTOMERS),
  );
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(() =>
    clone(DAILY_LOGS),
  );
  const [toast, setToast] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2800);
  }, []);

  /** 일정 변경은 모두 여기를 거친다. event 가 있으면 위험판단 전후 결과를 이력에 남긴다 */
  const commitSchedules = useCallback(
    (fn: (ss: ScheduleItem[]) => ScheduleItem[], event?: RiskEvent) => {
      const before = schedRef.current;
      const after = fn(before);
      if (after === before) return;
      schedRef.current = after;
      setSchedules(after);
      if (event)
        setRiskLog((l) => [
          ...l,
          buildRiskLogEntry(l.length + 1, event, before, after, tasksRef.current),
        ]);
    },
    [],
  );

  const pushTimeline = useCallback(
    (
      projectId: string | undefined,
      kind: TimelineKind,
      actorId: string,
      text: string,
      extra?: { taskId?: string; photoCount?: number },
    ) => {
      if (!projectId) return;
      setTimeline((ts) => [
        { id: nextId("e"), projectId, kind, actorId, at: NOW, text, ...extra },
        ...ts,
      ]);
    },
    [],
  );

  const resetDemo = useCallback(() => {
    setTasks(clone(TASKS));
    const fresh = clone(SCHEDULES);
    schedRef.current = fresh;
    setSchedules(fresh);
    setRiskLog([]);
    setReports(clone(WORK_REPORTS));
    setTimeline(clone(TIMELINE));
    setProjects(clone(PROJECTS));
    setOpportunities(clone(OPPORTUNITIES));
    setChangeOrders(clone(CHANGE_ORDERS));
    setApprovals(clone(APPROVALS));
    setTodos(clone(TODOS));
    setCustomers(clone(CUSTOMERS));
    setDailyLogs(clone(DAILY_LOGS));
    setBusiness("all");
    setCurrentUserId("u2");
    setDemoStep(0);
  }, []);

  const value = useMemo<AppState>(() => {
    const patchTask = (id: string, patch: Partial<Task>) =>
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

    return {
      currentUserId,
      setCurrentUserId,
      permission: permissionOf(currentUserId),
      business,
      setBusiness,

      tasks,
      addTask: (t) => setTasks((ts) => [t, ...ts]),
      updateTask: patchTask,
      openTask: (id) =>
        setTasks((ts) =>
          ts.map((t) =>
            t.id === id && t.status === "지시됨" && !t.openedAt
              ? { ...t, openedAt: NOW }
              : t,
          ),
        ),
      acknowledgeTask: (id, response, note) => {
        const task = tasks.find((t) => t.id === id);
        patchTask(id, {
          status: response === "확인했습니다" ? "확인함" : "지시됨",
          acknowledgedAt: response === "확인했습니다" ? NOW : undefined,
          ackResponse: response,
          ackNote: note,
          lastUpdateAt: NOW,
        });
        if (task)
          pushTimeline(
            task.projectId,
            "직원 확인",
            task.assigneeId,
            response === "확인했습니다"
              ? `${fullName(task.assigneeId)}가 업무를 확인했습니다.`
              : `${fullName(task.assigneeId)}가 "${response}"로 회신했습니다.${note ? ` (${note})` : ""}`,
            { taskId: id },
          );
      },
      startTask: (id) => {
        const task = tasks.find((t) => t.id === id);
        patchTask(id, {
          status: "진행 중",
          progress: Math.max(10, task?.progress ?? 0),
          lastUpdateAt: NOW,
        });
        const started = schedRef.current.find(
          (s) => s.taskId === id && s.status === "예정",
        );
        // 오늘(데모 기준일) 일정만 시작 시각을 남긴다 — 데모 기준시각이며 실제 시계가 아니다
        const nowTime = NOW.slice(11);
        const stamp = started?.date === NOW_DATE;
        commitSchedules(
          (ss) =>
            started
              ? ss.map((s) =>
                  s.taskId === id && s.status === "예정"
                    ? {
                        ...s,
                        status: "진행 중",
                        ...(s.date === NOW_DATE
                          ? { actualStart: nowTime, actualStartSource: "작업 시작 버튼" as const }
                          : {}),
                      }
                    : s,
                )
              : ss,
          started && {
            kind: stamp ? "작업개시 기록" : "일정 상태 변경",
            scheduleId: started.id,
            title: started.title,
            field: stamp ? "실제 시작" : "상태",
            before: stamp ? `기록 없음 (예정 ${started.start})` : "예정",
            after: stamp ? `${nowTime} (작업 시작 버튼)` : "진행 중",
            source: stamp ? "작업 시작 버튼" : undefined,
            actorId: task?.assigneeId ?? currentUserId,
          },
        );
        if (task)
          pushTimeline(
            task.projectId,
            "진행보고",
            task.assigneeId,
            `${fullName(task.assigneeId)}가 작업을 시작했습니다.`,
            {
              taskId: id,
            },
          );
      },
      reviewTask: (id, decision, note) => {
        const task = tasks.find((t) => t.id === id);
        patchTask(id, {
          status: decision === "승인" ? "승인 완료" : "보완 요청",
          reviewNote: note,
          reviewedAt: NOW,
          reviewerId: currentUserId,
          lastUpdateAt: NOW,
        });
        setReports((rs) =>
          rs.map((r) =>
            r.taskId === id && r.reviewStatus === "검토 대기"
              ? {
                  ...r,
                  reviewStatus: decision === "승인" ? "승인" : "보완 요청",
                  reviewNote: note,
                  reviewedAt: NOW,
                  reviewerId: currentUserId,
                }
              : r,
          ),
        );
        if (task)
          pushTimeline(
            task.projectId,
            decision === "승인" ? "승인" : "보완 요청",
            currentUserId,
            decision === "승인"
              ? `${fullName(currentUserId)}가 완료보고를 승인했습니다.`
              : `${fullName(currentUserId)}가 보완을 요청했습니다.${note ? ` (${note})` : ""}`,
            { taskId: id },
          );
      },
      reassignTask: (id, memberId) => {
        const task = tasks.find((t) => t.id === id);
        patchTask(id, {
          assigneeId: memberId,
          status: "지시됨",
          acknowledgedAt: undefined,
          openedAt: undefined,
          ackResponse: undefined,
          lastUpdateAt: NOW,
        });
        const moved = schedRef.current.find((s) => s.taskId === id);
        commitSchedules(
          (ss) =>
            moved
              ? ss.map((s) =>
                  s.taskId === id
                    ? { ...s, assigneeId: memberId, acknowledgedAt: undefined }
                    : s,
                )
              : ss,
          moved && {
            kind: "담당자 변경",
            scheduleId: moved.id,
            title: moved.title,
            field: "담당자",
            before: fullName(moved.assigneeId),
            after: fullName(memberId),
            actorId: currentUserId,
          },
        );
        if (task)
          pushTimeline(
            task.projectId,
            "일정 변경",
            currentUserId,
            `담당자가 ${withRo(fullName(memberId))} 변경됐습니다.`,
            {
              taskId: id,
            },
          );
      },
      nudgeTask: (id) => patchTask(id, { lastUpdateAt: NOW }),

      schedules,
      addSchedule: (s) =>
        commitSchedules((ss) => [...ss, s], {
          kind: "일정 추가",
          scheduleId: s.id,
          title: s.title,
          field: "일정",
          before: "-",
          after: `${s.date} ${s.start}~${s.end} · ${fullName(s.assigneeId)}`,
          actorId: currentUserId,
        }),
      updateSchedule: (id, patch) => {
        const cur = schedRef.current.find((s) => s.id === id);
        const touched = cur
          ? RISK_FIELDS.filter((f) => f in patch && patch[f] !== cur[f])
          : [];
        const event: RiskEvent | undefined =
          cur && touched.length > 0
            ? touched.includes("assigneeId")
              ? {
                  kind: "담당자 변경",
                  scheduleId: id,
                  title: cur.title,
                  field: "담당자",
                  before: fullName(cur.assigneeId),
                  after: fullName(patch.assigneeId ?? cur.assigneeId),
                  actorId: currentUserId,
                }
              : touched.includes("status")
                ? {
                    kind: "일정 상태 변경",
                    scheduleId: id,
                    title: cur.title,
                    field: "상태",
                    before: cur.status,
                    after: patch.status ?? cur.status,
                    actorId: currentUserId,
                  }
                : {
                    kind: "일정 시간 변경",
                    scheduleId: id,
                    title: cur.title,
                    field: "예정 시간",
                    before: `${cur.start}~${cur.end}`,
                    after: `${patch.start ?? cur.start}~${patch.end ?? cur.end}`,
                    actorId: currentUserId,
                  }
            : undefined;
        commitSchedules(
          (ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          event,
        );
      },
      acknowledgeSchedule: (id) =>
        commitSchedules((ss) =>
          ss.map((s) => (s.id === id ? { ...s, acknowledgedAt: NOW } : s)),
        ),
      setScheduleEstimate: (id, expectedEnd, source = "관리자 입력") => {
        const cur = schedRef.current.find((s) => s.id === id);
        if (!cur) return;
        const label = (v?: string, src?: string) =>
          v ? `${v} (${src ?? "관리자 입력"})` : `${cur.end} (예정)`;
        commitSchedules(
          (ss) =>
            ss.map((s) =>
              s.id === id
                ? {
                    ...s,
                    expectedEnd,
                    expectedEndSource: expectedEnd ? source : undefined,
                  }
                : s,
            ),
          {
            kind: expectedEnd ? "예상 종료 입력" : "예상 종료 삭제",
            scheduleId: id,
            title: cur.title,
            field: "예상 종료",
            before: label(cur.expectedEnd, cur.expectedEndSource),
            after: label(expectedEnd, source),
            source: expectedEnd ? source : undefined,
            actorId: currentUserId,
          },
        );
      },
      recordActualStart: (id, time, source = "관리자 입력") => {
        const cur = schedRef.current.find((s) => s.id === id);
        if (!cur) return;
        commitSchedules(
          (ss) =>
            ss.map((s) =>
              s.id === id
                ? {
                    ...s,
                    actualStart: time,
                    actualStartSource: time ? source : undefined,
                    status: time && s.status === "예정" ? "진행 중" : s.status,
                  }
                : s,
            ),
          {
            kind: "작업개시 기록",
            scheduleId: id,
            title: cur.title,
            field: "실제 시작",
            before: cur.actualStart ? `${cur.actualStart} (${cur.actualStartSource ?? "기록"})` : `기록 없음 (예정 ${cur.start})`,
            after: time ? `${time} (${source})` : `기록 없음 (예정 ${cur.start})`,
            source: time ? source : undefined,
            actorId: currentUserId,
          },
        );
      },
      riskLog,

      reports,
      addReport: (r) => {
        setReports((rs) => [r, ...rs]);
        // 완료 보고 → 같은 날 연결 일정의 실제 종료로 반영 (보고 시각이 예정 시작 뒤일 때만)
        if (r.kind === "완료 보고" && r.taskId) {
          const day = r.createdAt.slice(0, 10);
          const t = r.createdAt.slice(11);
          const target = schedRef.current.find(
            (s) =>
              s.taskId === r.taskId &&
              s.date === day &&
              (s.status === "예정" || s.status === "진행 중") &&
              t > s.start,
          );
          if (target)
            commitSchedules(
              (ss) =>
                ss.map((s) =>
                  s.id === target.id
                    ? { ...s, status: "완료", actualEnd: t }
                    : s,
                ),
              {
                kind: "작업종료 반영",
                scheduleId: target.id,
                title: target.title,
                field: "실제 종료",
                before: `기록 없음 (예정 ${target.end})`,
                after: `${t} (완료보고 제출)`,
                source: "완료보고 제출",
                actorId: r.authorId,
              },
            );
        }
        if (r.taskId) {
          const isDone = r.kind === "완료 보고";
          patchTask(r.taskId, {
            status: isDone ? "완료보고" : "진행 중",
            progress: r.progress,
            lastUpdateAt: NOW,
          });
        }
        pushTimeline(
          r.projectId,
          r.kind === "완료 보고" ? "완료보고" : "진행보고",
          r.authorId,
          `${fullName(r.authorId)}가 ${r.kind}를 올렸습니다. ${r.summary?.done ?? r.raw.slice(0, 60)}`,
          { taskId: r.taskId, photoCount: r.photoCount },
        );
      },
      reviewReport: (id, decision, note) =>
        setReports((rs) =>
          rs.map((r) =>
            r.id === id
              ? {
                  ...r,
                  reviewStatus: decision === "승인" ? "승인" : "보완 요청",
                  reviewNote: note,
                  reviewedAt: NOW,
                  reviewerId: currentUserId,
                }
              : r,
          ),
        ),

      timeline,
      addTimeline: pushTimeline,

      projects,
      updateProject: (id, patch) =>
        setProjects((ps) =>
          ps.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        ),
      toggleCloseoutDoc: (projectId, docName) =>
        setProjects((ps) =>
          ps.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  closeoutDocs: p.closeoutDocs.map((d) =>
                    d.name === docName ? { ...d, done: !d.done } : d,
                  ),
                }
              : p,
          ),
        ),
      opportunities,
      addOpportunity: (o) => setOpportunities((os) => [o, ...os]),
      addLead: (o) => setOpportunities((os) => [o, ...os]),
      updateOpportunity: (id, patch) =>
        setOpportunities((os) =>
          os.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        ),
      changeOrders,
      addChangeOrder: (c) => setChangeOrders((cs) => [c, ...cs]),
      updateChangeOrder: (id, patch) =>
        setChangeOrders((cs) =>
          cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ),
      approvals,
      decideApproval: (id, decision) =>
        setApprovals((as) =>
          as.map((a) => (a.id === id ? { ...a, status: decision } : a)),
        ),
      todos,
      addTodo: (t) => setTodos((ts) => [t, ...ts]),
      toggleTodo: (id) =>
        setTodos((ts) =>
          ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        ),
      customers,
      updateCustomer: (id, patch) =>
        setCustomers((cs) =>
          cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ),
      dailyLogs,
      addDailyLog: (d) => setDailyLogs((ds) => [d, ...ds]),

      toast,
      showToast,
      demoMode,
      setDemoMode,
      demoStep,
      setDemoStep,
      resetDemo,
    };
  }, [
    currentUserId,
    business,
    tasks,
    schedules,
    reports,
    timeline,
    projects,
    opportunities,
    changeOrders,
    approvals,
    todos,
    customers,
    dailyLogs,
    toast,
    showToast,
    pushTimeline,
    commitSchedules,
    riskLog,
    demoMode,
    demoStep,
    resetDemo,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/** 새 업무·일정·보고 id 생성기 (컴포넌트에서 사용) */
export { nextId };
