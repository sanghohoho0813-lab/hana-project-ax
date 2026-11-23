# 내부용 — 사진 · 화면 제작 지시서 (제출하지 않음)

보완자료 패키지(docs/appeal-package/)를 더 좋게 만들기 위한 다음 작업 목록이다. PDF: `pdf/99_내부용_사진_화면_제작지시서.pdf`

## 1. 사진 칸 P-01~P-12
새 사진을 `assets/photos/new/P-xx.jpg`로 넣고 `python3 src/build.py && node src/render.mjs` 를 다시 돌리면 바뀐다. 실제 현장 사진이면 `P-xx.real` 빈 파일을 같이 둔다(표시가 '현장 사진'으로 바뀜).

| 칸 | 들어갈 곳 | 지금 대신 쓰는 사진 | 목적 | 구도 · 비율 |
|---|---|---|---|---|
| P-01 | 01 3쪽 · 03 4쪽 (문제 1 막힘) | ai-stuck | 기사가 혼자 막혀 있는 순간 — ‘본사는 모른다’ | 4:3 · 기사 뒷모습~옆뒷모습(귀 정도만), 통신실 광분배함 앞, 엉킨 패치코드, 한 손에 휴대폰(화면 흐리게) |
| P-02 | 01 3쪽 · 03 5쪽 (문제 2 안전) | ai-pole | 고소작업의 추락 위험과 안전장구 | 4:3 · 전주 옆 고소작업대 위 기사 뒷모습, 안전모 · 안전대 고리가 보이게, 아래에서 올려다본 구도 |
| P-03 | 01 3쪽 · 03 2쪽 (문제 3 이동 · 지연) | ai-van | 다음 현장으로 늦게 출발하는 이동 | 4:3 · 작업 차량 운전석 뒤에서 본 앞유리 · 계기판 시계(오후) · 도로, 사람은 어깨만 |
| P-04 | 02 2쪽 (본사) | ai-hq | 본사 관리자가 여러 현장을 동시에 챙김 | 4:3 · 관리자 옆뒷모습, 모니터 2대(일정표 · 지도), 전화기, 메모 — 화면 글자는 흐리게 |
| P-05 | 03 5쪽 또는 05 6쪽 (안전점검 클로즈업) | — | 작업 전 안전장구 확인 — 사진으로 남기는 행동 | 1:1 · 장갑 낀 손이 안전모 턱끈을 채우는 클로즈업 + 다른 손에 휴대폰 카메라 |
| P-06 | 03 3쪽 (설치 상태 촬영) | ai-photo | 현장 상태를 휴대폰으로 기록 | 4:3 · 기사 어깨 너머로 휴대폰 화면에 설비함이 찍히는 장면 |
| P-07 | 02 2쪽 · 03 3쪽 · 09 5쪽 (현장 2인 · 시험 A) | ai-tablet | 현장 기사 2명이 휴대폰으로 보고 · 확인 | 16:9 · 두 기사의 뒷모습, 설비함 앞에서 휴대폰 · 태블릿을 함께 봄 |
| P-08 | 02 표지 또는 04 2쪽 (정보통신 설비) | — | 정보통신공사가 다루는 설비 | 16:9 · 사람 없이 패치패널 · 광케이블이 정리된 랙 클로즈업 |
| P-09 | 03 5쪽 (맨홀 · 통신구) | — | 맨홀 작업의 질식 · 추락 위험 | 4:3 · 안전 펜스로 둘러싼 열린 맨홀, 작업자 상체 일부(뒷모습), 송기 장비 |
| P-10 | 03 3쪽 (일정 혼선) | ai-map | 전화 · 메모로 일정을 맞추는 혼선 | 4:3 · 화이트보드 일정표와 포스트잇, 통화 중인 손과 수첩 — 얼굴 없음 |
| P-11 | 03 6쪽 (재방문) | — | 당일 못 가고 다음날 다시 가는 재방문 | 16:9 · 해질녘 고객 건물 앞에 선 작업 차량, 기사 뒷모습이 차로 돌아가는 장면 |
| P-12 | 표지 배경 (모든 자료) | — | 표지 분위기 | 16:9 와이드 · 해질녘 전주 라인과 작업 차량 실루엣, 글자를 얹을 여백 |

### 생성 프롬프트
- **P-01** — Korean telecom technician seen from behind, standing in front of an open fiber distribution cabinet with tangled yellow patch cords, holding a smartphone in a gloved hand, hesitant posture, indoor equipment room, natural light, documentary photo style, no visible face, 4:3
- **P-02** — Telecom line worker from behind on an aerial work platform next to a utility pole, wearing hard hat and full-body safety harness with lanyard clipped, cables overhead, Korean city street, overcast daylight, realistic documentary photo, face not visible, 4:3
- **P-03** — View from behind the driver's seat of a white telecom service van, dashboard clock showing afternoon time, road ahead in a small Korean city, cable reels and ladder visible in the back, slightly hurried mood, realistic photo, no face, 4:3
- **P-04** — Office manager seen from behind-left at a desk with two monitors showing a schedule board and a map (text blurred), desk phone and notes, small construction company office in Korea, daylight, realistic, face not visible, 4:3
- **P-05** — Close-up of gloved hands fastening a white hard hat chin strap, another hand holding a smartphone camera pointed at the safety harness buckle, telecom work site background blurred, realistic photo, no face, 1:1
- **P-06** — Over-the-shoulder shot of a technician photographing a network cabinet with a smartphone, wearing work gloves and reflective vest, focus on the phone and cabinet, realistic, no face, 4:3
- **P-07** — Two Korean telecom technicians from behind in front of an outdoor street cabinet, one holding a tablet and the other a smartphone, discussing work status, reflective vests and helmets, daylight, realistic documentary style, faces not visible, 16:9
- **P-08** — Close-up of a neatly organized network rack with patch panels and fiber optic cables, cable labels, shallow depth of field, cool lighting, no people, realistic, 16:9
- **P-09** — Open telecom manhole surrounded by safety barriers on a Korean street, worker partially visible from behind with ventilation hose, safety cones, realistic photo, no face, 4:3
- **P-10** — Whiteboard with a handwritten daily schedule of several sites and sticky notes, a hand holding a phone during a call and another writing in a notebook, small office, realistic, no face, 4:3
- **P-11** — Telecom service van parked in front of a small commercial building at dusk, technician walking back to the van from behind carrying a tool bag, sense of a delayed schedule, realistic, no face, 16:9
- **P-12** — Wide cinematic shot of utility poles with telecom cables at dusk and a service van silhouette on a rural Korean road, lots of negative space in the sky, muted teal and navy tones, realistic, no people visible, 16:9

## 2. 더 찍을 프로그램 화면
| 화면 | 기기 | 쓸 곳 | 이유 |
|---|---|---|---|
| 판단 기록 상세 — ‘점수 계산 근거’ 펼친 상태 | PC | 04 6쪽 · 07 4쪽 | 우선순위 130점의 요소별 점수가 화면에 그대로 보이게 |
| 일정판 — 같은 날 기사 2명 · 현장 6곳 | PC | 01 2쪽 · 06 3쪽 | ‘여러 기사 × 여러 현장’ 규모감 (지금은 기사 1명 · 3곳) |
| 이동시간 누락 · 중간 일정 취소 → ‘판단 보류’ 표시 | PC | 04 8쪽 · 06 4쪽 | 모르면 ‘위험 없음’이 아니라 ‘확인 필요’ — 독창성 4 |
| 실제 휴대폰(안드로이드 · 아이폰) 화면 녹화 캡처 | 휴대폰 | 05 전체 · 09 5쪽 | 운영 연결 뒤 시험 A에서 — ‘같은 컴퓨터 브라우저’ 한계를 없앰 |
| 사건 증빙 PDF 1쪽 전체(핵심 흐름 요약) | PC 인쇄 | 05 12쪽 · 12 | 제출용 증빙 형식을 그대로 보여 줌 |
| 성과 측정 — 측정 1~10 값이 채워진 화면 | PC | 09 · 10 4쪽 | 현장 실증 뒤 실제 값으로 교체 |
| 기사 ‘내 기록’ — 본인 보고 · 점검 이력 | 휴대폰 | 05 · 02 3쪽 | 기사 쪽 기록 확인 동선 |
| 로그인 · 2단계 인증 · 계정 발급 화면 | PC | 04 3쪽 | 권한 분리 · 보안(관리자 발급 계정) |

## 3. 회사에 요청할 자료
| 자료 | 채워지는 곳 |
|---|---|
| 결과 통지서의 보완 요청 원문 | 00 대응표의 항목 이름을 원문과 똑같이 맞춤 |
| 2025.1~2026.6 활동 기록 (회의록 · 메일 · 기획서 · 계약서) | 08 연혁표 노란 칸 |
| 특허 출원서 · 청구항 원문 · 출원인 정보 | 07 청구항 대조표 |
| 사업자등록증 · 정보통신공사업 등록증 · 회사 기본 정보(설립일 · 인원 · 매출 · 주소) | 02 회사 개요 · 12 첨부 2 |
| 개발 협력 계약서 · 작업지시서 | 02 · 08 개발 체계 · 12 첨부 5 |
| 로고 파일 (PNG · SVG) | 모든 자료 머리 · 표지 |
| 실제 현장 사진 (얼굴 없이, 촬영정보 제거) | 사진 칸 P-01~P-12 교체 |
| 2027~2029 투입 인력 · 예산 · 목표 고객 수 · 가격 정책 | 10 · 11 노란 칸 |
