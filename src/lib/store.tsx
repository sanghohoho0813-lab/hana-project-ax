"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
import { NOW } from "./company";
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
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() =>
    clone(SCHEDULES),
  );
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
    setSchedules(clone(SCHEDULES));
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
        setSchedules((ss) =>
          ss.map((s) =>
            s.taskId === id && s.status === "예정"
              ? { ...s, status: "진행 중" }
              : s,
          ),
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
        setSchedules((ss) =>
          ss.map((s) =>
            s.taskId === id
              ? { ...s, assigneeId: memberId, acknowledgedAt: undefined }
              : s,
          ),
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
      addSchedule: (s) => setSchedules((ss) => [...ss, s]),
      updateSchedule: (id, patch) =>
        setSchedules((ss) =>
          ss.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        ),
      acknowledgeSchedule: (id) =>
        setSchedules((ss) =>
          ss.map((s) => (s.id === id ? { ...s, acknowledgedAt: NOW } : s)),
        ),

      reports,
      addReport: (r) => {
        setReports((rs) => [r, ...rs]);
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
