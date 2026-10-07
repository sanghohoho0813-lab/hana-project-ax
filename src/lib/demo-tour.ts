/** 실사 시연용 라이브 투어 — 실제 화면을 순서대로 열고, 보여줄 곳을 밝히고, 할 말을 띄운다 */

export interface TourStep {
  /** 무엇을 보여주는 장면인지 (짧은 묶음 이름) */
  chapter: string;
  title: string;
  /** 화면에서 가리킬 곳 */
  show: string;
  /** 그대로 읽어도 되는 설명 */
  say: string;
  href: string;
  /** 강조할 요소 — [data-tour="…"] */
  target?: string;
  /** 이 단계에서 보여줄 사용자 (없으면 그대로) */
  as?: string;
}

export const MANAGER_ID = "u2";

export const TOUR_STEPS: TourStep[] = [
  {
    chapter: "관리자의 아침",
    title: "문제가 있는 업무부터 보입니다",
    show: "위쪽 숫자 카드 — 오늘 예정, 아직 확인 안 된 업무, 기한 지난 업무, 결과보고 대기, 일정 충돌",
    say: "아침에 이 화면을 열면, 직원마다 전화하지 않아도 확인이 필요한 업무가 숫자로 먼저 보입니다.",
    href: "/",
    target: "kpi",
    as: MANAGER_ID,
  },
  {
    chapter: "관리자의 아침",
    title: "오늘 챙길 일을 문장으로 정리",
    show: "남색 브리핑 카드 — 줄을 누르면 해당 업무로 바로 이동",
    say: "누가 어떤 업무를 아직 확인하지 않았는지, 어느 일정이 겹치는지를 한 줄씩 정리해 보여줍니다.",
    href: "/",
    target: "brief",
    as: MANAGER_ID,
  },
  {
    chapter: "업무지시",
    title: "전화로 받은 지시도 업무가 됩니다",
    show: "'전화메모 정리' 버튼 — 눌러서 예시 메모를 정리해 보여주세요",
    say: "통화하며 적은 메모를 붙여넣으면 담당자·현장·시간을 나눠 업무와 일정으로 바로 등록합니다.",
    href: "/tasks",
    target: "memo",
    as: MANAGER_ID,
  },
  {
    chapter: "직원 화면",
    title: "직원은 버튼 하나로 확인",
    show: "현장책임자 화면의 '새로 받은 업무' — '업무 확인하기'를 눌러 버튼을 보여주세요",
    say: "현장에서는 긴 보고 대신 '확인했습니다', '일정 조정이 필요합니다' 버튼만 누르면 관리자에게 바로 전달됩니다.",
    href: "/",
    target: "newtask",
    as: "u4",
  },
  {
    chapter: "여러 현장 연결",
    title: "이동시간까지 계산해 미리 경고",
    show: "빨간 테두리 경고 — 같은 직원의 두 일정 사이 이동시간이 모자란 경우",
    say: "아직 시작 전인 일정이라도, 앞 현장 일정과 이동시간을 비교해 늦어질 위험을 먼저 알려줍니다.",
    href: "/schedule",
    target: "conflict",
    as: MANAGER_ID,
  },
  {
    chapter: "여러 현장 연결",
    title: "직원별 하루를 한 줄로",
    show: "오늘 시간표 — 겹친 일정은 빨간색, 세로선은 지금 시각",
    say: "직원마다 하루 일정이 시간축에 놓여서, 겹침과 이동 공백이 한눈에 보입니다.",
    href: "/schedule",
    target: "timeline",
    as: MANAGER_ID,
  },
  {
    chapter: "보고와 검토",
    title: "결과는 사진과 함께, 관리자는 검토만",
    show: "위쪽 숫자 — 검토 대기 보고",
    say: "작업이 끝나면 사진과 간단한 결과가 올라오고, 관리자는 검토 대기 보고만 열어 승인하면 됩니다.",
    href: "/reports",
    target: "reportkpi",
    as: MANAGER_ID,
  },
  {
    chapter: "검증 계획",
    title: "무엇을 숫자로 확인할지",
    show: "도입 전 기준과 목표치 — 아직 실측이 아닌 목표·예시 값",
    say: "업무 누락, 일정 지연, 이동시간 부족, 일정 충돌이 실제로 얼마나 줄었는지 자사 현장 데이터로 측정할 계획입니다.",
    href: "/performance",
    target: "metrics",
    as: MANAGER_ID,
  },
];
