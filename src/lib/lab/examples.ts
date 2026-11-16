/**
 * 예시 기록 2건 — '실증 홈'에서 한 번 눌러 이 브라우저에 만드는 가상 시나리오 (시험 사례 둘러보기와 같은 이야기)
 *
 * - 사례 1: 설치환경 문제 → 숙련 기술자 파견 → 다음 현장 일정 조정 → 1건 해소 · 1건 남음 → 해결
 * - 사례 2: 추가 장비 필요 → 장비 전달 → 예상 종료를 앞당겨 다시 입력(일정은 그대로) → 해소 → 임시 조치
 *
 * 모두 '가상 시나리오' 세트로 만들고 출처에 EXAMPLE_TAG 를 남긴다. 사람 · 현장 이름과 시각은 시험용 가정값이다.
 * 입력은 화면 버튼과 같은 모델 함수(saveSchedule · recordEvent · reportIssue · issueStep · adjustForIssue · issueEnd)로 하고,
 * 위험 판단도 같은 엔진이 계산해 기록한다 — 이 파일은 정해진 순서대로 누르기만 한다.
 */
import { addPerson, createSession, currentSchedules, recordEvent, saveSchedule, type Ctx, type IssueProgress, type IssueType, type LabState, type Resolution, type SupportAction, type SupportNeed } from "./model";
import { adjustForIssue, issueEnd, issueStep, reportIssue, sessionIssues } from "./issues";
import { kst } from "@/lib/pilot/time";

export const EXAMPLE_TAG = "예시 기록 2026-11-16";
const ROLE = "시험용 가상 기사 (예시)";

type Step =
  | { do: "start"; site: number; at: string }
  | { do: "report"; site: number; discovered: string; reported: string; type: IssueType; progress: IssueProgress; needs: SupportNeed[]; request: string; expectedEnd: string }
  | { do: "receive"; at: string }
  | { do: "decide"; at: string; action: SupportAction; text: string }
  | { do: "adjust"; at: string; site: number; start: string; end: string; reason: string }
  | { do: "end"; at: string; expectedEnd: string; text: string }
  | { do: "finish"; site: number; at: string }
  | { do: "resolve"; at: string; resolution: Resolution; text: string };

interface ExampleCase {
  title: string;
  worker: string;
  clock: string;
  sites: { title: string; start: string; end: string; travel: number | null }[];
  script: Step[];
}

export const EXAMPLE_CASES: ExampleCase[] = [
  {
    title: "예시 1 · 설치환경 문제 → 다음 현장 일정 조정",
    worker: "김현장 (예시)",
    clock: "09:00",
    sites: [
      { title: "서초 지사", start: "09:00", end: "10:00", travel: null },
      { title: "강남 물류센터", start: "10:30", end: "11:30", travel: 20 },
      { title: "송파 매장", start: "12:00", end: "12:50", travel: 25 },
    ],
    script: [
      { do: "start", site: 0, at: "09:00" },
      { do: "report", site: 0, discovered: "09:15", reported: "09:20", type: "예상과 다른 현장상황", progress: "분해·설치 시작 후", needs: ["숙련 기술자"], request: "분해해 보니 배선 경로가 도면과 다름", expectedEnd: "11:00" },
      { do: "receive", at: "09:23" },
      { do: "decide", at: "09:25", action: "숙련 기술자 파견", text: "숙련 기술자 30분 안에 도착" },
      { do: "adjust", at: "09:30", site: 1, start: "11:25", end: "12:25", reason: "서초 지원으로 강남 시작 조정 (고객 연락 완료)" },
      { do: "finish", site: 0, at: "10:55" },
      { do: "resolve", at: "10:58", resolution: "해결", text: "배선 경로 변경 후 설치 완료" },
    ],
  },
  {
    title: "예시 2 · 장비 부족 → 예상 종료 다시 입력",
    worker: "이현장 (예시)",
    clock: "13:00",
    sites: [
      { title: "판교 사옥", start: "13:00", end: "14:00", travel: null },
      { title: "분당 매장", start: "14:30", end: "15:30", travel: 15 },
    ],
    script: [
      { do: "start", site: 0, at: "13:00" },
      { do: "report", site: 0, discovered: "13:18", reported: "13:20", type: "추가 장비 필요", progress: "작업 진행 중", needs: ["추가 장비"], request: "교체용 모듈이 부족함", expectedEnd: "14:30" },
      { do: "receive", at: "13:22" },
      { do: "decide", at: "13:25", action: "추가 장비 전달", text: "근처 창고에서 장비 전달" },
      { do: "end", at: "13:40", expectedEnd: "14:05", text: "장비가 빨리 도착해 다시 입력" },
      { do: "finish", site: 0, at: "14:05" },
      { do: "resolve", at: "14:10", resolution: "임시 조치", text: "예비 모듈로 임시 연결 — 정품 교체 필요" },
    ],
  },
];

/** 이 브라우저에 예시 기록이 있는가 */
export const hasExamples = (s: LabState) => s.sessions.some((x) => x.sourceRef.startsWith(EXAMPLE_TAG));

/** 예시 2건 만들기 — 오늘 날짜의 가상 시나리오 세트 2개 · 입력자는 지금 입력자 */
export function loadExamples(s: LabState, by: string, ctx: Ctx): { state: LabState; sessionIds: string[] } {
  if (hasExamples(s)) return { state: s, sessionIds: [] };
  let st = s;
  const workDate = kst(ctx.now).date;
  const sessionIds: string[] = [];
  for (const [n, ex] of EXAMPLE_CASES.entries()) {
    let worker = st.people.find((p) => p.name === ex.worker && p.role === ROLE)?.id;
    if (!worker) {
      const r = addPerson(st, { name: ex.worker, code: "", role: ROLE, org: "예시 기록" }, ctx);
      st = r.state;
      worker = r.id;
    }
    const made = createSession(
      st,
      {
        title: ex.title,
        kind: "가상 시나리오",
        workDate,
        participantId: by,
        informantId: null,
        source: "가상 시나리오",
        sourceRef: `${EXAMPLE_TAG} · ${n + 1}`,
        clock: ex.clock,
        note: "예시 기록 — 화면이 어떻게 이어지는지 보여 주는 시험용 가정값입니다. 실제 현장 기록이 아닙니다.",
        createdBy: by,
      },
      ctx,
    );
    st = made.state;
    sessionIds.push(made.id);
    const prov = { enteredBy: by, informantId: null, source: "가상 시나리오", sourceRef: `${EXAMPLE_TAG} · ${n + 1}` };
    for (const x of ex.sites) {
      st = saveSchedule(
        st,
        { opId: ctx.id(), sessionId: made.id, scheduleId: null, expectedVersion: null, workerId: worker, siteName: x.title, region: "", plannedStart: x.start, plannedEnd: x.end, travelMinutes: x.travel, priority: "보통", note: "", reason: "예시 기록", prov },
        ctx,
      ).state;
    }
    const site = (i: number) => currentSchedules(st, made.id).find((x) => x.siteName === ex.sites[i].title)!;
    const issueId = () => sessionIssues(st, made.id).at(-1)!.id;
    const at = (t: string) => ({ mode: "입력" as const, time: t });
    for (const step of ex.script) {
      if (step.do === "start") {
        st = recordEvent(st, { opId: ctx.id(), sessionId: made.id, scheduleId: site(step.site).id, kind: "작업개시", timeMode: "입력", time: step.at, via: "현장기사 화면", note: "", prov }, ctx).state;
      } else if (step.do === "report") {
        st = reportIssue(st, { opId: ctx.id(), sessionId: made.id, scheduleId: site(step.site).id, type: step.type, progress: step.progress, needs: step.needs, request: step.request, discovered: at(step.discovered), reported: at(step.reported), expectedEnd: step.expectedEnd, via: "현장기사 화면", prov }, ctx).state;
      } else if (step.do === "receive") {
        st = issueStep(st, { opId: ctx.id(), issueId: issueId(), kind: "지원 요청 접수", moment: at(step.at), via: "관리자 화면", prov }, ctx).state;
      } else if (step.do === "decide") {
        st = issueStep(st, { opId: ctx.id(), issueId: issueId(), kind: "지원 조치 결정", moment: at(step.at), action: step.action, text: step.text, via: "관리자 화면", prov }, ctx).state;
      } else if (step.do === "adjust") {
        const x = site(step.site);
        st = adjustForIssue(
          st,
          {
            opId: ctx.id(),
            issueId: issueId(),
            moment: at(step.at),
            schedule: { scheduleId: x.id, expectedVersion: x.version, workerId: x.workerId, siteName: x.siteName, region: x.region, plannedStart: step.start, plannedEnd: step.end, travelMinutes: x.travelMinutes, priority: x.priority, note: x.note, reason: step.reason },
            prov,
          },
          ctx,
        ).state;
      } else if (step.do === "end") {
        st = issueEnd(st, { opId: ctx.id(), issueId: issueId(), expectedEnd: step.expectedEnd, moment: at(step.at), text: step.text, via: "관리자 화면", prov }, ctx).state;
      } else if (step.do === "finish") {
        st = recordEvent(st, { opId: ctx.id(), sessionId: made.id, scheduleId: site(step.site).id, kind: "작업종료", timeMode: "입력", time: step.at, via: "현장기사 화면", note: "", prov }, ctx).state;
      } else {
        st = issueStep(st, { opId: ctx.id(), issueId: issueId(), kind: "해결 여부", moment: at(step.at), resolution: step.resolution, text: step.text, via: "현장기사 화면", prov }, ctx).state;
      }
    }
  }
  return { state: st, sessionIds };
}

/** 예시 기록만 지우기 — 예시 세트와 그 세트의 입력 · 판단 · 현장 문제, 다른 곳에 쓰이지 않은 예시 기사를 뺀다 (다른 기록은 그대로) */
export function removeExamples(s: LabState, ctx: Ctx): LabState {
  const ids = new Set(s.sessions.filter((x) => x.sourceRef.startsWith(EXAMPLE_TAG)).map((x) => x.id));
  if (ids.size === 0) return s;
  const entries = s.entries.filter((e) => !ids.has(e.sessionId));
  const used = new Set<string>();
  for (const e of entries) if (e.type === "schedule") used.add(e.snapshot.workerId);
  return {
    ...s,
    sessions: s.sessions.filter((x) => !ids.has(x.id)),
    entries,
    judgments: s.judgments.filter((j) => !ids.has(j.sessionId)),
    issues: s.issues.filter((i) => !ids.has(i.sessionId)),
    people: s.people.filter((p) => p.role !== ROLE || used.has(p.id)),
    updatedAt: ctx.now.toISOString(),
    changeCount: s.changeCount + 1,
  };
}
