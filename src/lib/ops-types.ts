/** 업무지시 · 일정 · 보고 · 소통 타임라인 도메인 타입 */

export type TaskStatus =
  | "지시됨"
  | "확인함"
  | "진행 중"
  | "완료보고"
  | "검토 중"
  | "승인 완료"
  | "보완 요청"
  | "취소";

export type TaskPriority = "긴급" | "보통" | "낮음";

/** 직원이 업무를 받고 선택하는 응답 */
export type AckResponse =
  | "확인했습니다"
  | "일정 조정이 필요합니다"
  | "업무 내용 확인이 필요합니다";

export interface Task {
  id: string;
  title: string;
  projectId?: string;
  content: string;
  /** 지시한 사람 */
  assignerId: string;
  /** 담당자 */
  assigneeId: string;
  /** 공동 확인자 */
  watcherIds: string[];
  /** 전달 시각 (ISO, 분 단위) */
  createdAt: string;
  startDate: string;
  /** 완료기한 */
  dueAt: string;
  priority: TaskPriority;
  needsReport: boolean;
  needsPhoto: boolean;
  location: string;
  repeat?: string;
  docNote?: string;
  memo?: string;
  status: TaskStatus;
  /** 업무를 열어본 시각 (확인 버튼은 아직 안 누른 상태 추적용) */
  openedAt?: string;
  /** 확인 버튼을 누른 시각 */
  acknowledgedAt?: string;
  ackResponse?: AckResponse;
  /** 담당자가 남긴 질문·요청 */
  ackNote?: string;
  progress: number;
  lastUpdateAt: string;
  /** 관리자 검토 결과 메모 */
  reviewNote?: string;
  reviewedAt?: string;
  reviewerId?: string;
}

export type ScheduleStatus = "예정" | "진행 중" | "완료" | "취소";

export interface ScheduleItem {
  id: string;
  title: string;
  projectId?: string;
  region: string;
  assigneeId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  start: string;
  end: string;
  /** 직전 일정에서 이동하는 데 걸리는 예상 시간(분) */
  travelMinutes: number;
  status: ScheduleStatus;
  /** 담당자가 일정을 확인했는지 */
  acknowledgedAt?: string;
  taskId?: string;
  note?: string;
}

export type ReportKind =
  | "시작 보고"
  | "진행 보고"
  | "완료 보고"
  | "현장 이슈"
  | "일정 변경 요청"
  | "일일 업무보고";

export type ReviewStatus = "검토 대기" | "승인" | "보완 요청";

/** 짧은 메모를 정돈된 보고로 바꾼 결과 */
export interface ReportSummary {
  done: string;
  changes?: string;
  materials?: string;
  next?: string;
  schedule?: string;
  needsManager?: string;
}

export interface WorkReport {
  id: string;
  taskId?: string;
  projectId?: string;
  authorId: string;
  kind: ReportKind;
  createdAt: string;
  /** 직원이 입력한 원문 */
  raw: string;
  progress: number;
  photoCount: number;
  issue?: string;
  needSupport?: string;
  next?: string;
  eta?: string;
  summary?: ReportSummary;
  reviewStatus: ReviewStatus;
  reviewNote?: string;
  reviewedAt?: string;
  reviewerId?: string;
}

export type TimelineKind =
  | "업무지시"
  | "직원 확인"
  | "일정 변경"
  | "진행보고"
  | "사진"
  | "관리자 댓글"
  | "보완 요청"
  | "완료보고"
  | "승인"
  | "추가공사"
  | "문서";

export interface TimelineEvent {
  id: string;
  projectId: string;
  kind: TimelineKind;
  actorId: string;
  at: string;
  text: string;
  taskId?: string;
  photoCount?: number;
}

/** 규칙 기반 알림 — 데이터에서 파생해 항상 화면과 일치한다 */
export type AlertRule =
  | "미확인 업무"
  | "당일 일정 미확인"
  | "일정 시작 임박"
  | "시작 미등록"
  | "기한 임박"
  | "기한 초과"
  | "검토 지연"
  | "일정 충돌"
  | "결과보고 미제출";

export interface OpsAlert {
  id: string;
  rule: AlertRule;
  severity: "danger" | "warning" | "info";
  title: string;
  detail: string;
  memberId: string;
  taskId?: string;
  scheduleId?: string;
  projectId?: string;
  /** 경과 시간 설명 (예: 18시간 경과) */
  elapsed?: string;
}
