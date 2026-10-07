import type { VideoInfo } from "@/components/VideoPage";

/** 영상 두 편 — 가로(16:9)·세로(9:16) 두 판이 같은 시간축이라, 바꿔도 보던 곳에서 이어진다. 자막은 영상 안에 들어가 있다. */
export const PATENT_NO = "10-2026-0173957";

export const VIDEOS: Record<"inspection" | "guide", VideoInfo> = {
  inspection: {
    src: { h: "/videos/inspection-h.mp4", v: "/videos/inspection-v.mp4" },
    poster: { h: "/videos/inspection-h.jpg", v: "/videos/inspection-v.jpg" },
    title: "복수 현장 업무 위험관리 AX 소개",
    audience: "실사용 · 시스템 소개",
    desc: "하나정보통신이 현장에서 겪어 온 문제, 복수 현장 위험관리 시스템의 처리 구조, 특허출원과 현재 단계, 앞으로의 검증 계획을 소개합니다.",
    duration: 235.97,
    chapters: [
      { at: 0, label: "시스템 소개 · 특허출원" },
      { at: 6.6, label: "현장에서 반복되던 문제" },
      { at: 48.8, label: "기록보다 더 큰 문제" },
      { at: 56.9, label: "사례 · A현장에서 B현장으로" },
      { at: 91.7, label: "해결 방식 · 상태 흐름과 위험 판단" },
      { at: 128.3, label: "대응 우선순위와 핵심 차별점" },
      { at: 149.7, label: "현장에서 시작해 만든 MVP" },
      { at: 168.6, label: "특허출원 10-2026-0173957" },
      { at: 182.9, label: "현재 단계" },
      { at: 188.9, label: "검증과 확대 계획" },
      { at: 212.6, label: "정리" },
    ],
    notes: [
      `특허는 2026년 9월 11일 출원을 마친 상태(출원번호 ${PATENT_NO})이며, 등록된 특허가 아닙니다.`,
      "사례의 시각(11:00 · 11:25 · 11:40)과 이동시간은 이해를 돕기 위한 예시입니다.",
      "영상 속 앱 화면은 실제 MVP 화면이며, 업무와 인물은 예시 데이터입니다.",
    ],
    srt: "/videos/inspection.srt",
    other: { href: "/videos/guide", label: "사용법 영상 보기" },
  },
  guide: {
    src: { h: "/videos/guide-h.mp4", v: "/videos/guide-v.mp4" },
    poster: { h: "/videos/guide-h.jpg", v: "/videos/guide-v.jpg" },
    title: "MVP로 보는 달라지는 운영 방식",
    audience: "사용법 · 대표님 · 이사님께",
    desc: "정식으로 쓰게 되면 하루 업무가 어떻게 달라지는지, 여러 현장을 연결해 보는 기능, 지금 MVP의 범위와 작게 시작하는 도입 방법을 안내합니다.",
    duration: 270.72,
    chapters: [
      { at: 0, label: "들어가며" },
      { at: 5.3, label: "지금 반복되는 일" },
      { at: 27.6, label: "MVP로 먼저 보여드리는 것" },
      { at: 33.8, label: "달라지는 점 ① 아침 화면" },
      { at: 56.2, label: "달라지는 점 ② 업무지시" },
      { at: 70.1, label: "버튼 하나로 상태 공유" },
      { at: 93.1, label: "여러 현장을 연결해서 보기" },
      { at: 134.8, label: "효과 · 반복 확인과 누락 감소" },
      { at: 160.0, label: "현재 MVP의 범위" },
      { at: 182.7, label: "정식 운영으로 고도화" },
      { at: 214.8, label: "작게 시작하는 도입 방법" },
      { at: 238.0, label: "목표" },
    ],
    notes: [
      "지금 화면은 구조를 먼저 보여드리기 위한 MVP이며, 정식 운영용 DB · 실제 계정 · 실시간 알림 · 지도 연동은 아직 포함되지 않았습니다.",
      "영상 속 앱 화면은 실제 MVP 화면이며, 업무와 인물은 예시 데이터입니다.",
    ],
    srt: "/videos/guide.srt",
    other: { href: "/demo", label: "실사 시연 · 실사용 영상 보기" },
  },
};
