/**
 * 공개용 서비스몰(하나정보통신 서비스·상담센터) 카탈로그.
 * 내부 운영 SaaS와 분리된 고객용 데이터다.
 */

export type ServiceCategoryKey =
  | "electric"
  | "telecom"
  | "security"
  | "network"
  | "maintenance"
  | "consulting";

export interface ServiceCategory {
  key: ServiceCategoryKey;
  name: string;
  short: string;
  desc: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    key: "electric",
    name: "전기공사",
    short: "전기",
    desc: "전기증설, 배선 정비, 공장·상가 전기설비 공사",
  },
  {
    key: "telecom",
    name: "정보통신공사",
    short: "통신",
    desc: "통신배선, 사무실·공장 통신 인프라 정비",
  },
  {
    key: "security",
    name: "CCTV·보안설비",
    short: "보안",
    desc: "CCTV 설치, 출입통제 장비, 보안설비 점검·교체",
  },
  {
    key: "network",
    name: "네트워크·사무환경",
    short: "네트워크",
    desc: "사무실 네트워크 구축, 랜 공사, 장비 이전·재배치",
  },
  {
    key: "maintenance",
    name: "유지보수·점검",
    short: "유지보수",
    desc: "정기 점검, 장애 대응, 노후 장비 교체",
  },
  {
    key: "consulting",
    name: "하나컨설팅 연계",
    short: "컨설팅",
    desc: "공사 전 사전 검토, 공정·자료·원가 관리 지원",
  },
];

/** 가격 표기 방식 — 전기·통신공사는 현장에 따라 달라져 확정 금액을 쓰지 않는다 */
export type PriceKind = "from" | "quote" | "consult";

export interface ServiceFaq {
  q: string;
  a: string;
}

export interface ServiceItem {
  slug: string;
  name: string;
  category: ServiceCategoryKey;
  tagline: string;
  /** 카드/상세 대표 이미지 — 나중에 실제 사진으로 교체하기 쉽게 경로만 둔다 */
  image?: string;
  /** 이미지가 없을 때 쓰는 일러스트 키 */
  visual: "electric" | "cable" | "network" | "cctv" | "access" | "wrench" | "report";
  priceKind: PriceKind;
  /** priceKind가 from일 때의 시작 금액 (만원) */
  priceFrom?: number;
  priceNote: string;
  duration: string;
  /** 시공 주체 — 컨설팅 상품은 하나컨설팅이 운영관리만 담당한다 */
  provider: "하나정보통신" | "하나컨설팅";
  popular?: boolean;
  /** 문의 많은 순 정렬용 샘플 지표 */
  inquiryCount: number;
  overview: string;
  fitFor: string[];
  includes: string[];
  steps: string[];
  effects: string[];
  notes: string[];
  faqs: ServiceFaq[];
  related: string[];
}

export const SERVICES: ServiceItem[] = [
  {
    slug: "factory-power-upgrade",
    name: "공장 전기증설 공사",
    category: "electric",
    tagline: "설비를 늘리기 전에 전기 용량부터 맞춰 드립니다.",
    visual: "electric",
    priceKind: "quote",
    priceNote: "현장 확인 후 견적",
    duration: "보통 3주 ~ 3개월",
    provider: "하나정보통신",
    popular: true,
    inquiryCount: 42,
    overview:
      "생산설비를 늘리거나 노후 수전설비를 바꿀 때 필요한 공사입니다. 계약전력 변경 신청부터 수전설비 증설, 분전반 신설, 동력 배선과 접지까지 함께 진행합니다. 공장을 멈추기 어려운 현장은 주말이나 야간으로 작업을 나눠 계획합니다.",
    fitFor: [
      "설비 추가로 전기 용량이 부족한 공장",
      "노후 분전반·차단기 교체가 필요한 사업장",
      "증축이나 라인 이설을 앞둔 제조업체",
    ],
    includes: [
      "현장 조사 및 기존 수전 용량 확인",
      "계약전력 변경 신청 지원",
      "수전설비 증설, 분전반 신설",
      "동력 배선, 케이블 트레이, 접지 공사",
      "시험·검수 및 준공서류 제출",
    ],
    steps: [
      "현장 조사 (1~2일)",
      "요구사항 정리 및 견적 제출",
      "계약 및 자재 발주",
      "배관·배선, 설비 설치",
      "시험·검수",
      "준공서류 제출 및 정산",
    ],
    effects: [
      "설비 증설 일정에 맞춰 전기 용량 확보",
      "과부하로 인한 정전·설비 손상 예방",
      "준공서류까지 한 번에 정리",
    ],
    notes: [
      "현장 수전 상황과 한전 협의 일정에 따라 기간이 달라질 수 있습니다.",
      "가동 중인 공장은 정전 가능한 시간대를 먼저 협의합니다.",
    ],
    faqs: [
      {
        q: "공장을 세우지 않고도 공사가 가능한가요?",
        a: "대부분 가능합니다. 결선처럼 정전이 필요한 작업만 주말이나 야간으로 나눠서 진행합니다.",
      },
      {
        q: "견적까지 얼마나 걸리나요?",
        a: "현장 확인 후 보통 2~3일 안에 견적서를 보내 드립니다.",
      },
    ],
    related: ["shop-telecom-wiring", "project-pre-review"],
  },
  {
    slug: "shop-telecom-wiring",
    name: "상가·건물 통신배선 공사",
    category: "telecom",
    tagline: "인터넷과 전화가 끊기지 않는 배선 기본기를 잡습니다.",
    visual: "cable",
    priceKind: "from",
    priceFrom: 300,
    priceNote: "300만 원부터 (규모에 따라 조정)",
    duration: "보통 1주 ~ 6주",
    provider: "하나정보통신",
    popular: true,
    inquiryCount: 38,
    overview:
      "상가, 사무빌딩, 소규모 공장의 통신배선을 새로 깔거나 정비하는 공사입니다. UTP 배선, 단자함 정리, 층별 분배까지 진행해 입주사가 바로 인터넷과 전화를 쓸 수 있게 합니다.",
    fitFor: [
      "신축·리모델링 상가와 사무빌딩",
      "입주사가 자주 바뀌어 배선이 엉킨 건물",
      "층별 통신 분배가 필요한 건물주",
    ],
    includes: [
      "층별 배선 경로 설계 지원",
      "UTP Cat.6 배선 및 몰드 마감",
      "단자함·패치패널 정리",
      "회선 라벨링 및 성능 측정",
      "준공사진·시험성적서 정리",
    ],
    steps: ["현장 조사", "견적 제출", "자재 발주", "배관·배선", "단자 결선 및 측정", "준공자료 제출"],
    effects: [
      "입주사 이동 시 재작업 최소화",
      "회선 장애 원인 파악이 쉬워짐",
      "건물 가치와 임대 경쟁력 향상",
    ],
    notes: [
      "천장 마감 일정과 겹치면 공정이 조정될 수 있습니다.",
      "기존 배선 철거가 필요한 경우 별도로 산정합니다.",
    ],
    faqs: [
      { q: "층수에 따라 금액이 많이 달라지나요?", a: "네, 배선 길이와 단자 수량이 기준이라 현장 확인 후 정확한 금액을 드립니다." },
      { q: "야간 작업도 가능한가요?", a: "영업 중인 상가는 야간이나 휴무일 작업으로 협의해 진행합니다." },
    ],
    related: ["office-network-build", "factory-power-upgrade"],
  },
  {
    slug: "office-network-build",
    name: "사무실 네트워크 구축",
    category: "network",
    tagline: "이사하거나 새로 여는 사무실, 네트워크만 맡기세요.",
    visual: "network",
    priceKind: "from",
    priceFrom: 200,
    priceNote: "200만 원부터 (인원·면적에 따라 조정)",
    duration: "보통 3일 ~ 3주",
    provider: "하나정보통신",
    popular: true,
    inquiryCount: 51,
    overview:
      "사무실 이전이나 신규 오픈에 맞춰 랜 배선, 스위치·공유기 설치, 무선 AP 배치, 회선 개통까지 한 번에 진행합니다. 자리 배치도만 주시면 필요한 포트 수와 AP 위치를 정리해 드립니다.",
    fitFor: [
      "사무실을 새로 열거나 이전하는 회사",
      "무선 신호가 약해 불편한 사업장",
      "직원이 늘어 포트가 부족한 사무실",
    ],
    includes: [
      "자리 배치 기준 포트 수량 산정",
      "랜 배선 및 몰드 마감",
      "스위치·공유기·무선 AP 설치",
      "인터넷 회선 개통 입회",
      "속도 측정 및 인수인계",
    ],
    steps: ["자리 배치도 확인", "견적 제출", "자재 준비", "배선 및 장비 설치", "속도 측정", "사용 안내"],
    effects: ["입주 첫날부터 바로 업무 가능", "무선 음영 구간 해소", "장애 시 원인 추적이 쉬워짐"],
    notes: [
      "인터넷 회선 개통 일정은 통신사 사정에 따라 달라질 수 있습니다.",
      "장비를 직접 준비하시면 설치 비용만 산정합니다.",
    ],
    faqs: [
      { q: "쓰던 장비를 그대로 옮겨도 되나요?", a: "가능합니다. 이전 설치와 재배치만 진행하면 비용이 줄어듭니다." },
      { q: "주말에 이사하는데 가능할까요?", a: "주말·공휴일 작업도 진행합니다. 일정만 미리 알려 주세요." },
    ],
    related: ["shop-telecom-wiring", "cctv-package", "regular-inspection"],
  },
  {
    slug: "cctv-package",
    name: "CCTV 설치 패키지",
    category: "security",
    tagline: "필요한 위치만 골라 소규모로도 시작할 수 있습니다.",
    visual: "cctv",
    priceKind: "from",
    priceFrom: 150,
    priceNote: "150만 원부터 (4대 기준, 현장에 따라 조정)",
    duration: "보통 1일 ~ 1주",
    provider: "하나정보통신",
    popular: true,
    inquiryCount: 64,
    overview:
      "공장 외곽, 상가 주차장, 창고 출입구 등 꼭 필요한 위치부터 CCTV를 설치합니다. 카메라와 저장장치, 배관·배선, 모니터 연결까지 포함하고 휴대폰으로 보는 설정도 함께 잡아 드립니다.",
    fitFor: [
      "야간 보안이 필요한 공장·창고",
      "주차장 분쟁이 잦은 상가",
      "기존 CCTV 화질이 나빠 교체가 필요한 곳",
    ],
    includes: [
      "설치 위치 협의 및 화각 확인",
      "카메라 4대 + 저장장치 설치",
      "배관·배선 및 전원 작업",
      "모니터 연결 및 휴대폰 원격보기 설정",
      "사용 방법 안내",
    ],
    steps: ["현장 확인", "위치·수량 확정", "견적 제출", "설치 및 배선", "설정 및 시연", "인수인계"],
    effects: ["도난·분쟁 발생 시 확인 가능", "야간 무인 관리 부담 감소", "보험·행정 자료로 활용"],
    notes: [
      "매설 배관이 필요한 외곽 구간은 별도로 산정합니다.",
      "카메라를 추가하면 저장장치 용량도 함께 확인해야 합니다.",
    ],
    faqs: [
      { q: "몇 대부터 설치가 가능한가요?", a: "2대부터 가능합니다. 다만 4대 이상이 단가 면에서 유리합니다." },
      { q: "기존 CCTV에 몇 대만 추가할 수 있나요?", a: "가능합니다. 저장장치 용량과 채널 수를 먼저 확인해 드립니다." },
    ],
    related: ["access-control", "regular-inspection", "office-network-build"],
  },
  {
    slug: "access-control",
    name: "출입통제 시스템 구축",
    category: "security",
    tagline: "누가 언제 드나들었는지 기록으로 남깁니다.",
    visual: "access",
    priceKind: "from",
    priceFrom: 180,
    priceNote: "180만 원부터 (출입구 1개소 기준)",
    duration: "보통 2일 ~ 2주",
    provider: "하나정보통신",
    inquiryCount: 21,
    overview:
      "카드·지문 인식기와 전기정을 설치해 출입을 통제하고 기록을 남깁니다. 사무실 현관, 공장 자재창고, 서버실처럼 관리가 필요한 공간에 적합합니다.",
    fitFor: [
      "자재·재고 관리가 중요한 창고",
      "외부인 출입이 잦은 사무실",
      "서버실·전기실 등 제한구역이 있는 사업장",
    ],
    includes: [
      "출입구별 장비 선정",
      "인식기·전기정 설치 및 배선",
      "출입 권한 등록 및 관리 프로그램 설정",
      "비상 개방 장치 연동",
      "관리자 교육",
    ],
    steps: ["출입구 확인", "장비 선정", "견적 제출", "설치 및 배선", "권한 등록", "사용 교육"],
    effects: ["출입 이력 자동 기록", "열쇠 분실·복제 위험 제거", "인원별 권한 분리 관리"],
    notes: [
      "소방법상 비상시 개방 조건을 반드시 함께 검토합니다.",
      "기존 문틀 상태에 따라 보강 작업이 필요할 수 있습니다.",
    ],
    faqs: [
      { q: "정전되면 문이 안 열리나요?", a: "비상 개방 장치와 예비 전원을 함께 설치해 정전 시에도 대피가 가능합니다." },
      { q: "직원 카드는 몇 장까지 등록되나요?", a: "장비에 따라 다르지만 보통 수백 명 단위까지 등록할 수 있습니다." },
    ],
    related: ["cctv-package", "regular-inspection"],
  },
  {
    slug: "regular-inspection",
    name: "소규모 유지보수·정기점검",
    category: "maintenance",
    tagline: "고장 나기 전에 한 번 봐 드립니다.",
    visual: "wrench",
    priceKind: "from",
    priceFrom: 30,
    priceNote: "30만 원부터 (방문 1회 기준)",
    duration: "방문 1회 반나절 · 연간 계약 가능",
    provider: "하나정보통신",
    popular: true,
    inquiryCount: 47,
    overview:
      "전기설비와 통신·CCTV 설비를 정기적으로 점검하고 간단한 고장은 현장에서 바로 처리합니다. 연간 계약을 하시면 장애가 생겼을 때 우선 대응합니다.",
    fitFor: [
      "설비를 관리할 담당자가 따로 없는 사업장",
      "CCTV·네트워크 장애가 반복되는 곳",
      "노후 설비 교체 시기를 알고 싶은 업체",
    ],
    includes: [
      "분전반·차단기 상태 점검",
      "통신 단자함 및 회선 점검",
      "CCTV 화질·저장 상태 확인",
      "간단 고장 현장 조치",
      "점검 결과 정리 및 교체 권고",
    ],
    steps: ["점검 일정 협의", "현장 방문 점검", "간단 조치", "결과 정리 전달", "필요 시 교체 견적"],
    effects: ["갑작스러운 정전·장애 예방", "교체 시기를 미리 계획", "관리 담당자 부담 감소"],
    notes: [
      "부품 교체가 필요하면 자재비는 별도로 산정합니다.",
      "연간 계약은 방문 횟수에 따라 금액이 달라집니다.",
    ],
    faqs: [
      { q: "연간 계약을 하면 어떤 점이 좋은가요?", a: "정기 방문과 함께 장애 발생 시 우선 대응해 드립니다." },
      { q: "점검만 받고 공사는 나중에 해도 되나요?", a: "물론입니다. 점검 결과와 권고 사항만 정리해 드립니다." },
    ],
    related: ["cctv-package", "public-telecom-replace"],
  },
  {
    slug: "public-telecom-replace",
    name: "공공시설 통신설비 교체",
    category: "telecom",
    tagline: "관공서·공공시설 발주에 맞춰 서류까지 챙깁니다.",
    visual: "cable",
    priceKind: "quote",
    priceNote: "발주 조건 확인 후 견적",
    duration: "보통 1개월 ~ 3개월",
    provider: "하나정보통신",
    inquiryCount: 12,
    overview:
      "시청·군청·공공기관의 통신설비 교체 공사를 수행합니다. 시공뿐 아니라 준공계, 자재승인서, 시험성적서, 검수확인서 등 발주처가 요구하는 서류를 빠짐없이 정리해 제출합니다.",
    fitFor: [
      "관공서·공공기관 통신설비 교체 발주",
      "준공서류 요건이 까다로운 공사",
      "정해진 예산과 기한이 있는 사업",
    ],
    includes: [
      "발주 사양 검토",
      "통신설비 철거 및 신규 설치",
      "시험·검수 입회",
      "준공서류 일괄 작성 및 제출",
      "하자 대응",
    ],
    steps: ["발주 사양 확인", "견적 제출", "계약 및 착수", "시공", "시험·검수", "준공서류 제출 및 정산"],
    effects: ["서류 누락으로 인한 정산 지연 방지", "검수 일정에 맞춘 공정 관리", "하자 대응까지 일원화"],
    notes: [
      "발주처 검수 일정에 따라 준공 시점이 조정될 수 있습니다.",
      "관급자재가 있는 경우 조달 일정을 함께 확인합니다.",
    ],
    faqs: [
      { q: "준공서류도 대신 준비해 주시나요?", a: "네, 하나컨설팅과 함께 준공자료를 정리해 제출까지 지원합니다." },
      { q: "보령 외 지역도 가능한가요?", a: "충남과 전북 인접 지역까지 대응하고 있습니다." },
    ],
    related: ["project-pre-review", "regular-inspection"],
  },
  {
    slug: "equipment-relocation",
    name: "장비 이전·재배치 작업",
    category: "network",
    tagline: "사무실을 옮겨도 전산 환경은 그대로.",
    visual: "network",
    priceKind: "from",
    priceFrom: 120,
    priceNote: "120만 원부터 (장비 수량에 따라 조정)",
    duration: "보통 1일 ~ 3일",
    provider: "하나정보통신",
    inquiryCount: 18,
    overview:
      "사무실 이전이나 내부 자리 이동에 맞춰 서버·스위치·PC·전화기 등을 안전하게 옮기고 다시 연결합니다. 이전 전 구성 상태를 기록해 두었다가 그대로 복구합니다.",
    fitFor: ["사무실을 이전하는 회사", "층간 자리 이동이 있는 사업장", "서버·전산실을 옮기는 곳"],
    includes: [
      "기존 결선 상태 기록",
      "장비 해체 및 안전 이송",
      "신규 위치 설치 및 재결선",
      "동작 확인 및 정리",
      "잔여 배선 마감",
    ],
    steps: ["현장 확인", "이전 계획 수립", "장비 해체", "이송 및 설치", "동작 확인"],
    effects: ["이전 다음 날 바로 업무 가능", "결선 오류로 인한 장애 예방", "이전 기록 자료 확보"],
    notes: [
      "장거리 이전은 운반비가 별도로 산정됩니다.",
      "서버 이전은 데이터 백업을 먼저 확인해 주세요.",
    ],
    faqs: [
      { q: "주말 이전도 되나요?", a: "가능합니다. 업무에 지장이 없도록 주말·야간 작업을 많이 진행합니다." },
      { q: "이전하면서 배선도 정리해 주시나요?", a: "네, 재배치하면서 노후 배선 정리와 라벨링을 함께 진행합니다." },
    ],
    related: ["office-network-build", "shop-telecom-wiring"],
  },
  {
    slug: "project-pre-review",
    name: "공사 전 사전 검토 (하나컨설팅)",
    category: "consulting",
    tagline: "착공 전에 일정과 원가를 먼저 점검합니다.",
    visual: "report",
    priceKind: "from",
    priceFrom: 120,
    priceNote: "120만 원부터 (공사 규모·기간에 따라 조정)",
    duration: "보통 1주 ~ 2주",
    provider: "하나컨설팅",
    inquiryCount: 15,
    overview:
      "공사를 시작하기 전에 요구사항과 도면을 검토하고, 공정계획과 예상원가를 정리해 착수검토서로 드립니다. 하나컨설팅은 기획과 운영관리를 담당하며 시공은 하나정보통신이 수행합니다.",
    fitFor: [
      "여러 업체 견적을 비교하고 싶은 발주처",
      "일정이 빠듯해 공정계획이 필요한 공사",
      "예상원가를 미리 확인하고 싶은 경우",
    ],
    includes: [
      "요구사항 및 도면 검토",
      "공정계획 초안 작성",
      "예상원가 항목별 정리",
      "위험요소와 대응 방안 정리",
      "착수검토서 제출",
    ],
    steps: ["자료 수령", "현장 확인 동행", "검토 및 분석", "착수검토서 작성", "결과 설명"],
    effects: ["착공 후 변경으로 인한 손실 감소", "일정 지연 요인 사전 파악", "원가 기준선 확보"],
    notes: [
      "하나컨설팅은 프로젝트 기획·운영관리와 자료 정리를 담당합니다. 설계·감리 업무는 수행하지 않습니다.",
      "시공과 준공 책임은 하나정보통신이 담당합니다.",
    ],
    faqs: [
      { q: "설계도 함께 해 주시나요?", a: "설계와 감리는 별도 자격이 필요한 업무라 수행하지 않습니다. 검토와 운영관리를 지원합니다." },
      { q: "공사를 맡기지 않아도 검토만 받을 수 있나요?", a: "가능합니다. 검토 결과만 정리해 드립니다." },
    ],
    related: ["process-doc-support", "factory-power-upgrade"],
  },
  {
    slug: "process-doc-support",
    name: "공정·자료관리 지원 (하나컨설팅)",
    category: "consulting",
    tagline: "현장 자료가 흩어지지 않게 주간 단위로 정리합니다.",
    visual: "report",
    priceKind: "from",
    priceFrom: 150,
    priceNote: "150만 원부터 (기간·보고 횟수에 따라 조정)",
    duration: "공사 기간 동안 (보통 1개월 ~ 3개월)",
    provider: "하나컨설팅",
    inquiryCount: 9,
    overview:
      "공사가 진행되는 동안 공정 현황을 주간으로 정리하고, 현장사진·작업일보·변경사항·준공자료를 프로젝트별로 모읍니다. 준공 시점에 서류가 없어 정산이 늦어지는 일을 막습니다.",
    fitFor: [
      "여러 현장을 동시에 관리하는 발주처",
      "준공서류 준비가 늘 늦어지는 현장",
      "변경·추가공사가 자주 생기는 공사",
    ],
    includes: [
      "주간 공정관리 보고서 작성",
      "현장사진·작업일보 정리",
      "변경사항 관리대장 운영",
      "준공자료 체크리스트 관리",
      "월간 원가 현황 정리",
    ],
    steps: ["관리 범위 협의", "자료 수집 체계 구성", "주간 보고", "변경사항 정리", "준공자료 취합"],
    effects: ["준공서류 누락으로 인한 잔금 지연 방지", "추가공사 미청구 예방", "현장 상황 공유가 쉬워짐"],
    notes: [
      "하나컨설팅은 자료 정리와 운영관리를 담당하며 직접 시공하지 않습니다.",
      "보고 횟수와 방문 횟수에 따라 금액이 달라집니다.",
    ],
    faqs: [
      { q: "우리 회사 양식으로 받을 수 있나요?", a: "네, 사용하시는 양식에 맞춰 정리해 드립니다." },
      { q: "공사 도중에도 시작할 수 있나요?", a: "가능합니다. 지금까지 자료를 넘겨주시면 정리부터 시작합니다." },
    ],
    related: ["project-pre-review", "total-consulting"],
  },
  {
    slug: "total-consulting",
    name: "프로젝트 종합 운영 컨설팅 (하나컨설팅)",
    category: "consulting",
    tagline: "사전 검토부터 손익분석까지 한 번에 맡기세요.",
    visual: "report",
    priceKind: "consult",
    priceNote: "별도 상담",
    duration: "프로젝트 전체 기간",
    provider: "하나컨설팅",
    inquiryCount: 7,
    overview:
      "사전 검토, 공정계획, 원가 분석, 변경사항 관리, 준공자료 취합, 종료 후 손익분석까지 프로젝트 운영 전반을 지원합니다. 업무량과 산출물을 기준으로 용역비를 산정합니다.",
    fitFor: [
      "규모가 크거나 기간이 긴 공사",
      "손익을 정확히 확인하고 싶은 발주처",
      "관리 인력이 부족한 시공업체",
    ],
    includes: [
      "착수검토서",
      "공정계획서",
      "주간 공정관리 보고서",
      "변경사항 관리대장",
      "준공자료 체크리스트",
      "프로젝트 손익분석서",
    ],
    steps: ["범위·업무량 협의", "용역비 산정", "착수검토", "기간 중 운영관리", "종료 후 손익분석"],
    effects: ["프로젝트별 실제 이익 확인", "누락 청구와 서류 지연 예방", "다음 공사 기준자료 확보"],
    notes: [
      "용역비는 공사금액 비율이 아니라 업무량과 산출물 기준으로 산정합니다.",
      "시공·안전관리·준공 책임은 하나정보통신이 담당합니다.",
    ],
    faqs: [
      { q: "용역비는 어떻게 정해지나요?", a: "현장 방문 횟수, 보고 횟수, 포함 업무, 난이도를 기준으로 산정합니다." },
      { q: "다른 시공사 공사도 관리해 주시나요?", a: "상담을 통해 범위를 정해 진행할 수 있습니다." },
    ],
    related: ["project-pre-review", "process-doc-support"],
  },
  {
    slug: "shop-electric-repair",
    name: "상가·점포 전기 개보수",
    category: "electric",
    tagline: "차단기가 자꾸 내려간다면 점검부터 시작하세요.",
    visual: "electric",
    priceKind: "from",
    priceFrom: 80,
    priceNote: "80만 원부터 (작업 범위에 따라 조정)",
    duration: "보통 1일 ~ 2주",
    provider: "하나정보통신",
    inquiryCount: 29,
    overview:
      "점포 인테리어 변경, 주방설비 추가, 노후 배선 교체에 맞춰 전기 회로를 정리합니다. 차단기 용량을 다시 계산하고 회로를 나눠 과부하를 막습니다.",
    fitFor: [
      "차단기가 자주 내려가는 점포",
      "주방·냉난방 설비를 추가하는 상가",
      "인테리어 공사를 앞둔 매장",
    ],
    includes: [
      "부하 계산 및 회로 분리",
      "분전반 정비·교체",
      "노후 배선 교체",
      "콘센트·조명 회로 정리",
      "절연 측정 및 확인",
    ],
    steps: ["현장 확인", "회로 계획", "견적 제출", "작업 진행", "절연 측정 및 마무리"],
    effects: ["과부하 차단 문제 해소", "화재 위험 감소", "설비 추가 여유 확보"],
    notes: [
      "영업 중인 매장은 정전 가능한 시간대를 먼저 협의합니다.",
      "건물 인입 용량이 부족하면 증설이 별도로 필요합니다.",
    ],
    faqs: [
      { q: "하루 만에 끝날 수 있나요?", a: "회로 정리 정도면 하루면 충분합니다. 배선 전체 교체는 며칠 걸립니다." },
      { q: "영업하면서 공사가 가능한가요?", a: "부분 정전으로 나눠 진행하면 대부분 가능합니다." },
    ],
    related: ["factory-power-upgrade", "regular-inspection"],
  },
];

export const SERVICE_REGIONS = [
  "충남 보령",
  "충남 서천",
  "충남 홍성",
  "충남 서산",
  "충남 태안",
  "충남 논산",
  "전북 군산",
  "전북 익산",
  "기타 지역",
];

export const BUDGET_RANGES = [
  "미정 (상담 후 결정)",
  "500만 원 미만",
  "500만 ~ 2,000만 원",
  "2,000만 ~ 5,000만 원",
  "5,000만 ~ 1억 원",
  "1억 원 이상",
];

export function serviceBySlug(slug: string): ServiceItem | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

export function categoryOf(key: ServiceCategoryKey): ServiceCategory {
  return SERVICE_CATEGORIES.find((c) => c.key === key)!;
}

/** 서비스몰 진행 절차 (공통) */
export const STORE_PROCESS = [
  { step: "01", title: "상담 신청", desc: "필요한 서비스와 현장 상황을 남겨 주세요." },
  { step: "02", title: "현장 확인", desc: "담당자가 연락드리고 필요하면 현장을 방문합니다." },
  { step: "03", title: "견적 제출", desc: "확인 후 보통 2~3일 안에 견적서를 보내 드립니다." },
  { step: "04", title: "계약·시공", desc: "일정을 협의해 하나정보통신이 시공합니다." },
  { step: "05", title: "준공·정산", desc: "준공자료를 정리해 제출하고 정산합니다." },
];

export const STORE_FAQS: ServiceFaq[] = [
  {
    q: "어느 지역까지 가능한가요?",
    a: "보령을 중심으로 서천, 홍성, 서산, 태안, 논산과 전북 군산·익산까지 대응합니다. 그 밖의 지역은 상담 후 안내드립니다.",
  },
  {
    q: "견적은 비용이 드나요?",
    a: "현장 확인과 견적 제출까지는 비용이 들지 않습니다. 별도 검토 용역이 필요한 경우에만 미리 안내드립니다.",
  },
  {
    q: "표시된 금액이 최종 금액인가요?",
    a: "아닙니다. 전기·통신공사는 현장 상황에 따라 물량이 달라져 시작 금액만 안내드리고, 정확한 금액은 현장 확인 후 견적서로 드립니다.",
  },
  {
    q: "하나컨설팅은 어떤 일을 하나요?",
    a: "프로젝트 기획과 운영관리, 자료 정리, 원가 분석을 지원합니다. 시공과 준공 책임은 하나정보통신이 담당합니다.",
  },
];
