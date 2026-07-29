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
  budget: number; // 만원 — 최초 예상원가
  actual: number; // 만원 — 현재 투입원가
}

export interface CloseoutDoc {
  name: string;
  done: boolean;
}

export interface PaymentInfo {
  advance: number; // 선금
  interim: number; // 중도금
  balance: number; // 잔금
  billed: number; // 청구금액 (누적)
  received: number; // 입금금액 (누적)
  /** 이번 달(2026년 7월) 회수 예정금액 */
  expectedThisMonth: number;
  /** 이번 달 회수 예정금액에 대한 설명 */
  expectedNote?: string;
  dueDate?: string;
  overdueDays?: number;
  /** 잔금을 지금 청구할 수 있는 상태인지 */
  balanceClaimable?: boolean;
}

/** 예상이익 감소 원인 — 최초 예상이익에서 차감된다 */
export interface ProfitRisk {
  reason: string;
  amount: number; // 만원
}

export interface ConsultingInfo {
  scope: string[];
  deliverables: string[];
  fee: number; // 만원 — 원가 항목의 '하나인사이트 관리용역비'와 반드시 일치
  feeStatus: "정산 완료" | "정산 예정" | "미정산";
  reportsThisMonth: number;
}

export interface Project {
  id: string;
  name: string;
  shortName: string;
  client: string;
  region: string;
  workType: string;
  period: string;
  /** 수주(계약)일 — 올해 누적 수주 집계에 사용 */
  orderDate: string;
  manager: string;
  contractAmount: number; // 만원
  progress: number; // %
  statusKey: ProjectStatusKey;
  statusLabel: string;
  risk?: string;
  phases: PhaseStep[];
  costs: CostItem[];
  profitRisks: ProfitRisk[];
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

/** 문의가 들어온 경로 */
export type LeadSource = "전화" | "서비스몰" | "직접 등록";
/** 서비스몰에서 선택한 문의 유형 */
export type LeadType = "상담신청" | "견적문의" | "주문요청";

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
  /** 견적 발송 후 경과일 */
  sentDaysAgo?: number;
  /** 수주 예상 월 (2026년) */
  expectedCloseMonth?: number;
  memo?: string;
  needsVisit?: boolean;
  /** 현장방문 일정이 확정됐는지 */
  visitConfirmed?: boolean;
  /** 유입 경로 — 서비스몰에서 들어온 건은 '서비스몰' */
  source?: LeadSource;
  /** 서비스몰 문의 유형 */
  leadType?: LeadType;
  /** 서비스몰에서 고른 관심 서비스 */
  interestService?: string;
  interestServiceSlug?: string;
  /** 예산 범위 (서비스몰 입력) */
  budgetRange?: string;
  /** 희망 일정 */
  desiredSchedule?: string;
  /** 접수 일시 표시용 */
  receivedAt?: string;
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
  /** 회신 기한 */
  dueDate?: string;
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
  /** 지금 해야 할 행동 */
  action: string;
  /** 미루면 생기는 위험 */
  risk: string;
  /** 걸려 있는 금액 (만원) */
  amount?: number;
  amountLabel?: string;
  severity: "danger" | "warning" | "info" | "success";
  ctaLabel: string;
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
  /** 재수주를 추천하는 근거 */
  signals: string[];
  /** 예상 제안금액 (만원) */
  proposalAmount: number;
  manager: string;
  status: "제안 준비" | "연락 예정" | "관심 없음" | "대기" | "다음 달 검토";
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
  /** 최근 열어본 문서 */
  recentlyOpened?: boolean;
}
