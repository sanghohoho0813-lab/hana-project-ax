"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
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

interface AppState {
  business: BusinessView;
  setBusiness: (b: BusinessView) => void;
  projects: Project[];
  updateProject: (id: string, patch: Partial<Project>) => void;
  toggleCloseoutDoc: (projectId: string, docName: string) => void;
  opportunities: Opportunity[];
  addOpportunity: (o: Opportunity) => void;
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
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [business, setBusiness] = useState<BusinessView>("all");
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(OPPORTUNITIES);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(CHANGE_ORDERS);
  const [approvals, setApprovals] = useState<Approval[]>(APPROVALS);
  const [todos, setTodos] = useState<TodoItem[]>(TODOS);
  const [customers, setCustomers] = useState<Customer[]>(CUSTOMERS);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(DAILY_LOGS);
  const [toast, setToast] = useState<string | null>(null);

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
      showToast: (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2600);
      },
    }),
    [business, projects, opportunities, changeOrders, approvals, todos, customers, dailyLogs, toast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
