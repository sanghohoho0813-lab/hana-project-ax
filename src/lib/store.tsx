"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  APPROVALS,
  CHANGE_ORDERS,
  CUSTOMERS,
  DAILY_LOGS,
  OPPORTUNITIES,
  PROJECTS,
  TODOS,
} from "./data";
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

/** 깊은 복사 — 데모 초기화 시 원본 샘플이 오염되지 않게 한다 */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

interface AppState {
  business: BusinessView;
  setBusiness: (b: BusinessView) => void;
  projects: Project[];
  updateProject: (id: string, patch: Partial<Project>) => void;
  toggleCloseoutDoc: (projectId: string, docName: string) => void;
  opportunities: Opportunity[];
  addOpportunity: (o: Opportunity) => void;
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
  /** 시연 모드 */
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  demoStep: number;
  setDemoStep: (n: number) => void;
  /** 데모 데이터 초기화 */
  resetDemo: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [business, setBusiness] = useState<BusinessView>("all");
  const [projects, setProjects] = useState<Project[]>(() => clone(PROJECTS));
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => clone(OPPORTUNITIES));
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(() => clone(CHANGE_ORDERS));
  const [approvals, setApprovals] = useState<Approval[]>(() => clone(APPROVALS));
  const [todos, setTodos] = useState<TodoItem[]>(() => clone(TODOS));
  const [customers, setCustomers] = useState<Customer[]>(() => clone(CUSTOMERS));
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(() => clone(DAILY_LOGS));
  const [toast, setToast] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const resetDemo = useCallback(() => {
    setProjects(clone(PROJECTS));
    setOpportunities(clone(OPPORTUNITIES));
    setChangeOrders(clone(CHANGE_ORDERS));
    setApprovals(clone(APPROVALS));
    setTodos(clone(TODOS));
    setCustomers(clone(CUSTOMERS));
    setDailyLogs(clone(DAILY_LOGS));
    setBusiness("all");
    setDemoStep(0);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      business,
      setBusiness,
      projects,
      updateProject: (id, patch) =>
        setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      toggleCloseoutDoc: (projectId, docName) =>
        setProjects((ps) =>
          ps.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  closeoutDocs: p.closeoutDocs.map((d) =>
                    d.name === docName ? { ...d, done: !d.done } : d
                  ),
                }
              : p
          )
        ),
      opportunities,
      addOpportunity: (o) => setOpportunities((os) => [o, ...os]),
      updateOpportunity: (id, patch) =>
        setOpportunities((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o))),
      changeOrders,
      addChangeOrder: (c) => setChangeOrders((cs) => [c, ...cs]),
      updateChangeOrder: (id, patch) =>
        setChangeOrders((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      approvals,
      decideApproval: (id, decision) =>
        setApprovals((as) => as.map((a) => (a.id === id ? { ...a, status: decision } : a))),
      todos,
      addTodo: (t) => setTodos((ts) => [t, ...ts]),
      toggleTodo: (id) =>
        setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
      customers,
      updateCustomer: (id, patch) =>
        setCustomers((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      dailyLogs,
      addDailyLog: (d) => setDailyLogs((ds) => [d, ...ds]),
      toast,
      showToast,
      demoMode,
      setDemoMode,
      demoStep,
      setDemoStep,
      resetDemo,
    }),
    [
      business,
      projects,
      opportunities,
      changeOrders,
      approvals,
      todos,
      customers,
      dailyLogs,
      toast,
      showToast,
      demoMode,
      demoStep,
      resetDemo,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
