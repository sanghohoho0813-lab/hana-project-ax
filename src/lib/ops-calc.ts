import { NOW, NOW_DATE } from "./company";
import { fullName, memberById } from "./team";
import type {
  OpsAlert,
  ReportSummary,
  ScheduleItem,
  Task,
  WorkReport,
} from "./ops-types";

/* ── 시간 유틸 ─────────────────────────────────── */

export function dt(v: string): Date {
  return new Date(v.length === 10 ? `${v}T00:00` : v);
}

export function minutesFromNow(v: string): number {
  return Math.round((dt(v).getTime() - dt(NOW).getTime()) / 60000);
}

/** 경과 시간을 사람이 읽는 문장으로 (예: 18시간 경과) */
export function elapsed(v: string): string {
  const m = -minutesFromNow(v);
  if (m < 0) return `${untilLabel(v)} 남음`;
  if (m < 60) return `${m}분 경과`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 경과`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간 경과`;
}

export function untilLabel(v: string): string {
  const m = minutesFromNow(v);
  const abs = Math.abs(m);
  if (abs < 60) return `${abs}분`;
  const h = Math.floor(abs / 60);
  if (h < 24) return `${h}시간`;
  return `${Math.floor(h / 24)}일`;
}

/** 2026-07-28T10:40 → 오전 10:40 */
export function timeLabel(v: string): string {
  const d = dt(v);
  const h = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${mm}`;
}

/** 오늘/어제/내일을 알아보게 표시 */
export function dayLabel(v: string): string {
  const day = v.slice(0, 10);
  const diff = Math.round(
    (dt(day).getTime() - dt(NOW_DATE).getTime()) / 86400000
  );
  if (diff === 0) return "오늘";
  if (diff === -1) return "어제";
  if (diff === 1) return "내일";
  const [, m, d] = day.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

export function whenLabel(v: string): string {
  return v.length > 10 ? `${dayLabel(v)} ${timeLabel(v)}` : dayLabel(v);
}

/* ── 업무 상태 판정 ─────────────────────────────── */

const CLOSED: Task["status"][] = ["승인 완료", "취소"];
const SUBMITTED: Task["status"][] = ["완료보고", "검토 중", "승인 완료"];

export function isActive(t: Task): boolean {
  return !CLOSED.includes(t.status);
}

/** 아직 확인 버튼을 누르지 않은 업무 */
export function isUnacked(t: Task): boolean {
  return t.status === "지시됨";
}

/** 열어보기만 하고 확인하지 않은 상태 */
export function isOpenedNotAcked(t: Task): boolean {
  return t.status === "지시됨" && !!t.openedAt;
}

export function isOverdue(t: Task): boolean {
  return isActive(t) && !SUBMITTED.includes(t.status) && minutesFromNow(t.dueAt) < 0;
}

/** 결과보고가 필요한데 아직 제출하지 않은 업무 (기한 초과 건은 따로 센다) */
export function needsResultReport(t: Task): boolean {
  return (
    t.needsReport &&
    (t.status === "확인함" || t.status === "진행 중") &&
    !isOverdue(t)
  );
}

/** 관리자 검토를 기다리는 업무 */
export function awaitingReview(t: Task): boolean {
  return t.status === "완료보고" || t.status === "검토 중";
}

/** 담당자 확인 상태를 자연스러운 문장으로 */
export function ackSentence(t: Task): { text: string; tone: "danger" | "warning" | "success" | "info" } {
  const who = fullName(t.assigneeId);
  if (t.ackResponse === "일정 조정이 필요합니다")
    return { text: `${who}가 일정 조정을 요청했어요.`, tone: "warning" };
  if (t.ackResponse === "업무 내용 확인이 필요합니다")
    return { text: `${who}가 업무 내용을 물어봤어요.`, tone: "warning" };
  if (t.acknowledgedAt)
    return { text: `${who}가 ${whenLabel(t.acknowledgedAt)}에 확인했어요.`, tone: "success" };
  if (t.openedAt)
    return {
      text: `${who}가 열어봤지만 아직 확인 버튼을 누르지 않았어요.`,
      tone: "warning",
    };
  return { text: `${who}가 아직 확인하지 않았어요.`, tone: "danger" };
}

/* ── 일정 ──────────────────────────────────────── */

export function schedulesOn(list: ScheduleItem[], date: string): ScheduleItem[] {
  return list
    .filter((s) => s.date === date && s.status !== "취소")
    .sort((a, b) => a.start.localeCompare(b.start));
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface ScheduleConflict {
  memberId: string;
  a: ScheduleItem;
  b: ScheduleItem;
  /** 시간이 겹침 / 이동시간 부족 */
  reason: "겹침" | "이동시간 부족";
  gap: number;
}

/** 같은 담당자의 시간 중복과 이동시간 부족을 찾는다 */
export function findConflicts(list: ScheduleItem[], date = NOW_DATE): ScheduleConflict[] {
  const out: ScheduleConflict[] = [];
  const byMember = new Map<string, ScheduleItem[]>();
  schedulesOn(list, date).forEach((s) => {
    byMember.set(s.assigneeId, [...(byMember.get(s.assigneeId) ?? []), s]);
  });
  byMember.forEach((items, memberId) => {
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i];
      const b = items[i + 1];
      const gap = toMin(b.start) - toMin(a.end);
      if (gap < 0) out.push({ memberId, a, b, reason: "겹침", gap });
      else if (b.travelMinutes > gap)
        out.push({ memberId, a, b, reason: "이동시간 부족", gap });
    }
  });
  return out;
}

/** 시작시간이 지났는데 아직 시작되지 않은 일정 */
export function notStarted(list: ScheduleItem[]): ScheduleItem[] {
  return schedulesOn(list, NOW_DATE).filter(
    (s) => s.status === "예정" && minutesFromNow(`${s.date}T${s.start}`) < 0
  );
}

/** 당일 일정인데 아직 확인하지 않은 것 */
export function unackedSchedules(list: ScheduleItem[]): ScheduleItem[] {
  return schedulesOn(list, NOW_DATE).filter((s) => !s.acknowledgedAt);
}

/* ── 첫 화면 KPI ───────────────────────────────── */

export interface OpsKpi {
  todayTasks: number;
  unacked: number;
  overdue: number;
  reportPending: number;
  conflicts: number;
  reviewPending: number;
}

export function opsKpi(
  tasks: Task[],
  schedules: ScheduleItem[]
): OpsKpi {
  const active = tasks.filter(isActive);
  return {
    todayTasks: active.length,
    unacked: active.filter(isUnacked).length,
    overdue: active.filter(isOverdue).length,
    reportPending: active.filter(needsResultReport).length,
    conflicts: findConflicts(schedules).length,
    reviewPending: active.filter(awaitingReview).length,
  };
}

/* ── 알림·에스컬레이션 ───────────────────────────── */

export function buildAlerts(tasks: Task[], schedules: ScheduleItem[]): OpsAlert[] {
  const out: OpsAlert[] = [];

  tasks.filter(isActive).forEach((t) => {
    // 지시 후 2시간 넘게 미확인
    if (isUnacked(t) && -minutesFromNow(t.createdAt) >= 120) {
      out.push({
        id: `a-unack-${t.id}`,
        rule: "미확인 업무",
        severity: "danger",
        title: `${t.title} 업무가 아직 확인되지 않았어요.`,
        detail: ackSentence(t).text,
        memberId: t.assigneeId,
        taskId: t.id,
        projectId: t.projectId,
        elapsed: `전달 후 ${elapsed(t.createdAt)}`,
      });
    }
    // 기한 초과
    if (isOverdue(t)) {
      out.push({
        id: `a-over-${t.id}`,
        rule: "기한 초과",
        severity: "danger",
        title: `${t.title} 업무가 기한을 넘겼어요.`,
        detail: `기한 ${whenLabel(t.dueAt)} · 마지막 보고 ${elapsed(t.lastUpdateAt)}`,
        memberId: t.assigneeId,
        taskId: t.id,
        projectId: t.projectId,
        elapsed: `기한 ${elapsed(t.dueAt)}`,
      });
    }
    // 기한 2시간 전
    const left = minutesFromNow(t.dueAt);
    if (!isOverdue(t) && left > 0 && left <= 120 && !SUBMITTED.includes(t.status)) {
      out.push({
        id: `a-soon-${t.id}`,
        rule: "기한 임박",
        severity: "warning",
        title: `${t.title} 완료기한이 ${untilLabel(t.dueAt)} 남았어요.`,
        detail: `담당 ${fullName(t.assigneeId)} · 진행률 ${t.progress}%`,
        memberId: t.assigneeId,
        taskId: t.id,
        projectId: t.projectId,
      });
    }
    // 결과보고 미제출
    if (needsResultReport(t) && t.progress === 0) {
      out.push({
        id: `a-report-${t.id}`,
        rule: "결과보고 미제출",
        severity: "warning",
        title: `${t.title} 결과보고가 아직 제출되지 않았어요.`,
        detail: `필요한 결과: ${t.needsPhoto ? "현장사진 포함 " : ""}완료보고 · 담당 ${fullName(t.assigneeId)}`,
        memberId: t.assigneeId,
        taskId: t.id,
        projectId: t.projectId,
      });
    }
    // 완료보고 후 관리자 미검토
    if (awaitingReview(t) && -minutesFromNow(t.lastUpdateAt) >= 60) {
      out.push({
        id: `a-review-${t.id}`,
        rule: "검토 지연",
        severity: "info",
        title: `${t.title} 완료보고를 검토해 주세요.`,
        detail: `${fullName(t.assigneeId)}가 ${whenLabel(t.lastUpdateAt)}에 제출했어요.`,
        memberId: t.assigneeId,
        taskId: t.id,
        projectId: t.projectId,
      });
    }
  });

  // 당일 일정 미확인
  unackedSchedules(schedules).forEach((s) => {
    out.push({
      id: `a-sunack-${s.id}`,
      rule: "당일 일정 미확인",
      severity: "warning",
      title: `${s.title} 일정이 아직 확인되지 않았어요.`,
      detail: `${fullName(s.assigneeId)} · ${s.start} 시작 예정`,
      memberId: s.assigneeId,
      scheduleId: s.id,
      projectId: s.projectId,
    });
  });

  // 시작시간이 지났는데 시작 미등록
  notStarted(schedules).forEach((s) => {
    out.push({
      id: `a-nostart-${s.id}`,
      rule: "시작 미등록",
      severity: "warning",
      title: `${s.title} 일정이 시작시간을 지났어요.`,
      detail: `${fullName(s.assigneeId)} · ${s.start} 시작 예정이었어요.`,
      memberId: s.assigneeId,
      scheduleId: s.id,
      projectId: s.projectId,
    });
  });

  // 일정 충돌
  findConflicts(schedules).forEach((c) => {
    out.push({
      id: `a-conf-${c.a.id}-${c.b.id}`,
      rule: "일정 충돌",
      severity: "danger",
      title: `${fullName(c.memberId)}의 일정이 겹쳐요.`,
      detail:
        c.reason === "겹침"
          ? `${c.a.start} ${c.a.region} 일정과 ${c.b.start} ${c.b.region} 일정이 같은 시간대에 배정됐습니다.`
          : `${c.a.end}에 ${c.a.region}에서 끝나고 ${c.b.start}에 ${c.b.region}으로 이동해야 하는데, 이동에만 약 ${c.b.travelMinutes}분이 걸립니다.`,
      memberId: c.memberId,
      scheduleId: c.b.id,
      projectId: c.b.projectId,
    });
  });

  const order = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ── 직원별 관리감독 요약 ────────────────────────── */

export interface MemberSummary {
  memberId: string;
  assigned: number;
  acked: number;
  overdue: number;
  reportPending: number;
  reviewPending: number;
  todaySchedules: number;
  lastActivity?: string;
  conflict: boolean;
}

export function memberSummaries(
  tasks: Task[],
  schedules: ScheduleItem[],
  reports: WorkReport[],
  memberIds: string[]
): MemberSummary[] {
  const conflicts = findConflicts(schedules);
  return memberIds.map((id) => {
    const mine = tasks.filter((t) => t.assigneeId === id && isActive(t));
    const lastReport = reports
      .filter((r) => r.authorId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const lastTask = mine
      .map((t) => t.lastUpdateAt)
      .sort((a, b) => b.localeCompare(a))[0];
    const last = [lastReport?.createdAt, lastTask].filter(Boolean).sort().pop();
    return {
      memberId: id,
      assigned: mine.length,
      acked: mine.filter((t) => !isUnacked(t)).length,
      overdue: mine.filter(isOverdue).length,
      reportPending: mine.filter(needsResultReport).length,
      reviewPending: mine.filter(awaitingReview).length,
      todaySchedules: schedulesOn(schedules, NOW_DATE).filter((s) => s.assigneeId === id).length,
      lastActivity: last,
      conflict: conflicts.some((c) => c.memberId === id),
    };
  });
}

/* ── AI 관리자 브리핑 ────────────────────────────── */

export interface BriefLine {
  text: string;
  href?: string;
}

export function managerBrief(tasks: Task[], schedules: ScheduleItem[]): BriefLine[] {
  const k = opsKpi(tasks, schedules);
  const lines: BriefLine[] = [];

  lines.push({
    text: `오늘 ${k.todayTasks}개 업무 중 ${k.unacked}개가 아직 확인되지 않았습니다.`,
    href: "/tasks?filter=unacked",
  });

  const firstUnacked = tasks.filter(isActive).find(isUnacked);
  if (firstUnacked) {
    lines.push({
      text: `${fullName(firstUnacked.assigneeId)}는 ${firstUnacked.title} 업무를 확인하지 않았습니다.`,
      href: `/tasks?task=${firstUnacked.id}`,
    });
  }

  const firstOverdue = tasks.filter(isActive).find(isOverdue);
  if (firstOverdue) {
    lines.push({
      text: `${fullName(firstOverdue.assigneeId)}의 ${firstOverdue.title} 업무는 완료기한을 ${untilLabel(firstOverdue.dueAt)} 넘겼습니다.`,
      href: `/tasks?task=${firstOverdue.id}`,
    });
  }

  const conflicts = findConflicts(schedules);
  if (conflicts.length > 0) {
    lines.push({
      text: `${fullName(conflicts[0].memberId)}의 오늘 일정이 겹쳐 있어 조정이 필요합니다.`,
      href: "/schedule",
    });
  }

  if (k.reviewPending > 0) {
    lines.push({
      text: `완료보고 ${k.reviewPending}건이 검토를 기다리고 있습니다.`,
      href: "/reports?filter=review",
    });
  }

  return lines;
}

/* ── 짧은 메모를 정돈된 보고로 ───────────────────── */

export function summarizeReport(raw: string): ReportSummary {
  const text = raw.trim();
  const sentences = text
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pick = (re: RegExp) => sentences.find((s) => re.test(s));

  const doneSentence =
    pick(/끝|완료|마무리|했음|했습니다|진행함/) ?? sentences[0] ?? text;
  const changeSentence = pick(/바뀌|변경|바꿔|수정/);
  const materialSentence = pick(/자재|케이블|부족|더 필요|추가로/);
  const nextSentence = pick(/내일|다음|이어서|다시|재시공|예정/);
  const qtyMatch = text.match(/(\d+\s*(?:m|미터|개|대|박스|롤))/);

  return {
    done: doneSentence.replace(/^\s*[-·]\s*/, ""),
    changes: changeSentence,
    materials: materialSentence
      ? qtyMatch
        ? `${materialSentence} (약 ${qtyMatch[1]})`
        : materialSentence
      : undefined,
    next: nextSentence,
    schedule: /내일/.test(text) ? "내일" : /오늘/.test(text) ? "오늘 중" : undefined,
    needsManager:
      changeSentence || materialSentence
        ? [changeSentence ? "일정·범위 변경 확인" : null, materialSentence ? "추가자재 확인" : null]
            .filter(Boolean)
            .join(" · ")
        : undefined,
  };
}

/* ── 전화메모 → 업무·일정 ───────────────────────── */

export interface ParsedInstruction {
  assigneeId: string;
  title: string;
  content: string;
  location: string;
  projectId?: string;
  date: string;
  start: string;
  end: string;
  needsPhoto: boolean;
  needsReport: boolean;
  followUp?: string;
}

const PLACE_HINTS: { key: string; region: string; projectId?: string }[] = [
  { key: "서천", region: "충남 서천", projectId: "p2" },
  { key: "보령", region: "충남 보령", projectId: "p6" },
  { key: "홍성", region: "충남 홍성", projectId: "p3" },
  { key: "군산", region: "전북 군산", projectId: "p4" },
  { key: "익산", region: "전북 익산", projectId: "p5" },
];

/** 통화 메모에서 담당자·장소·시간·업무를 뽑아낸다 */
export function parseInstruction(memo: string): ParsedInstruction[] {
  const text = memo.trim();

  // 담당자 추정 (성씨 + 기사/책임자/담당)
  let assigneeId = "u4";
  if (/박\s*(기사|책임|정우)/.test(text)) assigneeId = "u4";
  else if (/이\s*(기사|민수)/.test(text)) assigneeId = "u5";
  else if (/최\s*(기사|영호)/.test(text)) assigneeId = "u6";
  else if (/김\s*(하늘|담당|사무)/.test(text)) assigneeId = "u3";

  const places = PLACE_HINTS.filter((p) => text.includes(p.key));
  const main = places[0] ?? { key: "현장", region: "충남 보령", projectId: undefined };
  const follow = places[1];

  const tomorrow = /내일/.test(text);
  const morning = /오전|아침/.test(text);
  const date = tomorrow ? "2026-07-29" : "2026-07-28";
  const start = morning ? "09:00" : "14:00";
  const end = morning ? "11:00" : "16:00";

  const needsPhoto = /사진/.test(text);
  const isCheck = /확인|점검|체크/.test(text);

  const school = /학교/.test(text);
  const placeLabel = `${main.region}${school ? " 학교" : ""}`;

  const title = `${main.key}${school ? " 학교" : ""} ${
    /통신/.test(text) ? "통신 상태" : isCheck ? "현장" : "작업"
  } ${isCheck ? "점검" : "진행"}`;

  const list: ParsedInstruction[] = [
    {
      assigneeId,
      title,
      content: text,
      location: placeLabel,
      projectId: main.projectId,
      date,
      start,
      end,
      needsPhoto,
      needsReport: true,
      followUp: follow ? `${follow.region} 현장으로 이동` : undefined,
    },
  ];

  if (follow) {
    list.push({
      assigneeId,
      title: `${follow.key} 현장 이동 및 작업`,
      content: `${main.key} 일정 종료 후 ${follow.region} 현장으로 이동`,
      location: follow.region,
      projectId: follow.projectId,
      date,
      start: morning ? "13:30" : "16:30",
      end: morning ? "16:00" : "18:00",
      needsPhoto: false,
      needsReport: true,
    });
  }

  return list;
}

/** 담당자 이름 헬퍼 (컴포넌트에서 쓰기 편하게 재수출) */
export { fullName, memberById };
