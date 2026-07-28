export type BusinessView = "all" | "hana" | "consulting";

export type ProjectStatusKey =
  | "normal"
  | "caution"
  | "delayed"
  | "closeout"
  | "done"
  | "preparing";

export interface PhaseStep {
  name: string;
  plannedDate: string;
  doneDate?: string;
  manager: string;
  progress: number;
  status: "완료" | "진행" | "대기" | "지연";
  delayDays?: number;
  memo?: string;
}

export interface CostItem {
  name: string;
  budget: number; // 만원
  actual: number; // 만원
}

export interface CloseoutDoc {
  name: string;
  done: boolean;
}

export interface PaymentInfo {
  advance: number; // 선금
  interim: number; // 중도금
  balance: number; // 잔금
  billed: number; // 청구금액
  received: number; // 입금금액
  dueDate?: string;
  overdueDays?: number;
}

export interface ConsultingInfo {
  scope: string[];
  deliverables: string[];
  fee: number; // 만원
  feeStatus: "정산 완료" | "정산 예정" | "미정산";
  reportsThisMonth: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  region: string;
  workType: string;
  period: string;
  manager: string;
  contractAmount: number; // 만원
  progress: number; // %
  initialCostEstimate: number; // 만원
  expectedProfit: number; // 만원
  statusKey: ProjectStatusKey;
  statusLabel: string;
  risk?: string;
  phases: PhaseStep[];
  costs: CostItem[];
  closeoutDocs: CloseoutDoc[];
  payment: PaymentInfo;
  consulting: ConsultingInfo;
}

export type StageKey =
  | "inquiry"
  | "visit"
  | "drafting"
  | "sent"
  | "negotiating"
  | "won"
  | "hold";

export interface Opportunity {
  id: string;
  customer: string;
  contact?: string;
  region: string;
  workType: string;
  amount: number; // 만원
  manager: string;
  probability: number; // %
  stage: StageKey;
  nextAction: string;
  nextDate: string;
  sentDaysAgo?: number;
  expectedCloseMonth?: number;
  memo?: string;
  needsVisit?: boolean;
}

export type ChangeOrderStatus =
  | "요청 접수"
  | "견적 작성"
  | "견적 발송"
  | "승인 대기"
  | "승인 완료"
  | "공사 완료"
  | "청구 완료";

export interface ChangeOrder {
  id: string;
  projectId: string;
  requestDate: string;
  requester: string;
  content: string;
  addRevenue: number;
  addCost: number;
  status: ChangeOrderStatus;
  verbalOnly: boolean;
  quoteSent: boolean;
  billed: boolean;
}

export interface Approval {
  id: string;
  kind: "견적" | "추가공사" | "자재 발주" | "용역비" | "잔금 청구";
  title: string;
  desc: string;
  amount?: number;
  status: "대기" | "승인" | "반려";
  projectId?: string;
}

export interface TodoItem {
  id: string;
  title: string;
  desc: string;
  severity: "danger" | "warning" | "info" | "success";
  projectId?: string;
  href?: string;
  done: boolean;
}

export interface Customer {
  id: string;
  name: string;
  region: string;
  lastWorkDate: string;
  monthsSince: number;
  totalAmount: number;
  workTypes: string[];
  receivable: number;
  nextProposal: string;
  recommend: string;
  status: "제안 준비" | "연락 예정" | "관심 없음" | "대기";
}

export interface DailyLog {
  id: string;
  projectId: string;
  date: string;
  work: string;
  headcount: number;
  hours: number;
  materials: string;
  issues: string;
  tomorrow: string;
  photoCount: number;
  aiReport?: string;
}

export interface DocItem {
  id: string;
  projectId?: string;
  category: string;
  name: string;
  date: string;
  owner: string;
}
