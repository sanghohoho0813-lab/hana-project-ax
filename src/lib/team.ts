/** 조직 구성원과 역할별 권한 */

export type RoleKey = "ceo" | "director" | "office" | "siteLead" | "engineer";

export interface Member {
  id: string;
  name: string;
  role: RoleKey;
  roleLabel: string;
  /** 화면에 쓰는 짧은 소개 */
  desc: string;
  phone: string;
  initial: string;
  color: string;
}

export const MEMBERS: Member[] = [
  {
    id: "u1",
    name: "장정순",
    role: "ceo",
    roleLabel: "대표",
    desc: "경영 전반 · 승인 · 권한관리",
    phone: "010-2211-0001",
    initial: "장",
    color: "#1b64da",
  },
  {
    id: "u2",
    name: "구본석",
    role: "director",
    roleLabel: "이사",
    desc: "업무지시 · 일정 · 공사 총괄",
    phone: "010-2211-0002",
    initial: "구",
    color: "#3182f6",
  },
  {
    id: "u3",
    name: "김하늘",
    role: "office",
    roleLabel: "사무담당",
    desc: "일정 등록 · 견적 · 문서 · 수금",
    phone: "010-2211-0003",
    initial: "김",
    color: "#7c5cd6",
  },
  {
    id: "u4",
    name: "박정우",
    role: "siteLead",
    roleLabel: "현장책임자",
    desc: "현장 배정 · 진행 관리 · 보고 검토",
    phone: "010-2211-0004",
    initial: "박",
    color: "#0f766e",
  },
  {
    id: "u5",
    name: "이민수",
    role: "engineer",
    roleLabel: "현장기사",
    desc: "현장 작업 · 진행·완료보고",
    phone: "010-2211-0005",
    initial: "이",
    color: "#b45309",
  },
  {
    id: "u6",
    name: "최영호",
    role: "engineer",
    roleLabel: "현장기사",
    desc: "현장 작업 · 진행·완료보고",
    phone: "010-2211-0006",
    initial: "최",
    color: "#be185d",
  },
];

export function memberById(id: string): Member | undefined {
  return MEMBERS.find((m) => m.id === id);
}

/** '박정우 현장책임자'처럼 자연스러운 호칭 */
export function fullName(id: string): string {
  const m = memberById(id);
  return m ? `${m.name} ${m.roleLabel}` : "담당자 미지정";
}

export function shortName(id: string): string {
  return memberById(id)?.name ?? "미지정";
}

export interface Permission {
  /** 원가·매출·용역비 등 민감한 금액 정보를 볼 수 있는가 */
  seeMoney: boolean;
  /** 업무를 지시할 수 있는가 */
  assignTask: boolean;
  /** 보고를 검토·승인할 수 있는가 */
  reviewReport: boolean;
  /** 전체 직원의 업무를 볼 수 있는가 (false면 본인 관련만) */
  seeAllMembers: boolean;
  /** 관리자 화면(업무통제실)을 첫 화면으로 쓰는가 */
  managerHome: boolean;
  /** 접근 가능한 라우트 */
  routes: string[];
}

const MANAGER_ROUTES = [
  "/",
  "/brief",
  "/tasks",
  "/schedule",
  "/reports",
  "/comms",
  "/projects",
  "/logs",
  "/change-orders",
  "/closeout",
  "/profit",
  "/inquiries",
  "/customers",
  "/insight",
  "/documents",
  "/procurement",
  "/performance",
  "/approvals",
];

export const PERMISSIONS: Record<RoleKey, Permission> = {
  ceo: {
    seeMoney: true,
    assignTask: true,
    reviewReport: true,
    seeAllMembers: true,
    managerHome: true,
    routes: MANAGER_ROUTES,
  },
  director: {
    seeMoney: true,
    assignTask: true,
    reviewReport: true,
    seeAllMembers: true,
    managerHome: true,
    routes: MANAGER_ROUTES,
  },
  office: {
    seeMoney: false,
    assignTask: true,
    reviewReport: false,
    seeAllMembers: true,
    managerHome: true,
    routes: [
      "/",
      "/brief",
      "/tasks",
      "/schedule",
      "/reports",
      "/comms",
      "/projects",
      "/logs",
      "/closeout",
      "/inquiries",
      "/customers",
      "/documents",
    ],
  },
  siteLead: {
    seeMoney: false,
    assignTask: true,
    reviewReport: true,
    seeAllMembers: false,
    managerHome: false,
    routes: ["/", "/tasks", "/schedule", "/reports", "/comms", "/projects", "/logs"],
  },
  engineer: {
    seeMoney: false,
    assignTask: false,
    reviewReport: false,
    seeAllMembers: false,
    managerHome: false,
    routes: ["/", "/tasks", "/schedule", "/reports", "/comms", "/projects", "/logs"],
  },
};

export function permissionOf(id: string): Permission {
  const m = memberById(id);
  return PERMISSIONS[m?.role ?? "engineer"];
}
