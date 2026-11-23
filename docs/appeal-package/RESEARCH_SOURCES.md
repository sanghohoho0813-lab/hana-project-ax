# 현장 문제 · 기존 도구 조사 기록 (2026-11-23)

보완자료 03(현장 문제 정의) · 06(차별성) · 11(사업화)에 쓴 외부 근거의 원본 목록이다.
조사 원칙: 원문을 열어 확인한 사실만 적고, 확인하지 못한 것은 "확인 못 함"으로 둔다. 계산값(비율 · 평균)은 원문 숫자로 직접 계산했다고 표시한다.

## 1. 업계 규모
- 2025년도 정보통신공사 실적: 신고 대상 13,096개사 중 11,512개사(87.9%) 신고, 실적 19조 9,698억원(19,969,842백만원), 공사 457,134건, 업체당 평균 17.34억원. 2024년도 대상 12,709개사 · 20조 3,526억원. [S1]
  - 건당 평균 약 4,370만원 — 공식 수치가 아니라 위 실적액 ÷ 건수로 직접 계산한 값.
- 규모별 시공능력평가 현황: 전체 11,722개사 중 30억 미만 6,517개사(55.6%), 10억 미만 1,969개사(16.8%), 100억 이상 970개사(8.3%). 기준연도 표기 없음, 비율은 계산값. [S2]
- 등록 기준: 자본금 1억5천만원 이상, 정보통신기술자 4인 이상(기술계 3인 이상, 그중 1인 중급 이상). [S3]
- 소속 정보통신기술자 63,671명(1만2천여 업체, 2023년 10월 보도) — 업체당 약 5.3명(계산값). [S4]
- 확인 못 함: 상시근로자 규모별 업체 비중 공식 통계.

## 2. 인력
- 업체 소속 특급기술자 5,870명 중 60세 이상 3,783명(64.4%). [S4]
- 20~30대 청년층이 중소 정보통신공사업체 취업을 꺼림(정성 보도). [S5]
- 인력 수급 애로 원인: 고용환경 불안정 25.8%, 3D 업종 이미지 23.8%, 낮은 임금 21%. [S6]
- 확인 못 함: 초급 기술자 비중, 전체 기술자 연령 분포.

## 3. 다현장 · 이동 · 소통
- 케이블 방송 하청 설치기사: 9~18시 30분 간격 배정, "하루 평균 14건"(노조 주장, 2019). [S7]
- 이동노동자 12개 직종 1,210명: 하루 평균 이동시간 88.2분, 이동시간 보상체계 있음 5.6%(통신 업종 한정 아님, 2024). [S8]
- 원청이 SNS 단체대화방 · 자체 메신저로 협력업체 노동자에게 업무 지시 · 진행 보고(2019). [S9]
- 건설 현장에서도 수기 출근부 · 엑셀 공수 관리, 서류 "누락, 분실, 대리 서명 등의 문제가 빈번"(2026). [S19]
- 확인 못 함: 재방문율, 일정 차질 빈도, 하루 현장 수 통계, 메신저 사용률.

## 4. 안전
- 통신3사: 통신작업 중 사고 빈도가 가장 높은 '떨어짐'을 막기 위해 옥탑 기지국 약 2만4,000곳에 안전시설 공동 구축(2024.9.5, 고용노동부 · 안전보건공단 참여). [S10]
- 고용노동부 인용: 중대재해 요인 추락 42.4% · 끼임 11.5% · 부딪힘 8.7%(기준연도 원문 표기 없음), 정보통신 공사현장에서 사다리로 전주에 오르는 일이 많음(2023.10). [S11]
- 사고 사례: 2025.4.16 경남 남해 고소작업차 광케이블 교체 중 약 6m 추락 사망 [S12] · 2026.11.19 경기 남양주 통신선 처리 중 약 3m 추락 사망 [S13].
- 통신망 2차 하청 10곳 점검: 맨홀 작업 호흡용 보호구 미지급 6곳, 고소 크레인 2인 1조 미준수 5곳(2024.10). [S14]
- 중대재해처벌법 2024.1.27부터 5~49인 사업장 · 공사금액 50억원 미만 현장 적용. [S15]
- 위험성평가: 작업 전 안전점검회의(TBM) 상시평가 인정(2023) [S16] · 위험성평가 과태료 신설 — 50인 이상 2027.1.1, 50인 미만 2028.1.1부터, 모바일 위험성평가 지원방안 마련 중(2026.11.4) [S17].
- 2018년 통신사 협력사 '안전모 인증샷' 요구 보도 — 사진으로 착용을 확인하려는 현장 관행이 있었음. [S18]
- 산업안전보건법 제38조(안전조치) · 안전보건규칙 제32조(보호구 지급 · 착용). 정리: `docs/SAFETY_LAW_NOTES.md`(법률 자문 아님). [S20]

## 5. 기존 도구 범주 (특정 제품 평가 아님 — 공식 문서로 확인한 기능)
| 범주 | 예 | 확인한 기능 |
|---|---|---|
| 현장 서비스 관리(FSM) | Microsoft Dynamics 365 Field Service [S21][S22] | 일정 보드, 자동 배정(RSO, 유료 추가 기능) — 이동시간 최소화 · 가동률 · 우선순위 목표, 하루 중 재최적화, 작업지시 점검 양식 |
| | Salesforce Field Service [S23][S24][S25] | 일정 · 경로 최적화(경로 최적화는 AI 사용 명시), 실시간 일정 변경, 기한 놓칠 위험 예약 필터(In Jeopardy), 최종 결정은 디스패처 |
| | ServiceTitan [S26] | 디스패치 보드, GPS 위치, 늦은 도착 빨간 테두리 표시, 끌어 놓아 재일정 |
| 건설 현장관리 | Procore [S27] · 콘업 [S28] | 프로젝트 단위 작업일보 · 투입시간, 검측 체크리스트 · 공사일지 · 안전서류 전자화 |
| 스마트 안전 | 위치 기반 출퇴근 · 무동작 경고 서비스(보도) [S19] | GPS · 지오펜스 출퇴근, 일정 시간 움직임 없으면 관리자 경고 |

비교에 쓰는 원칙: 해외 FSM도 이동시간을 고려한 배정 · 지연 표시 · 재최적화를 제공한다. 따라서 "지연 대응 기능이 없다"고 쓰지 않는다. 차이는 (1) 선행 현장 지연이 후속 현장 각각의 도착을 몇 분 늦추는지 규칙으로 계산하고 조치 후 다시 계산해 전후를 남기는 것, (2) 규칙 기반이라 계산 근거를 화면에서 추적할 수 있는 것, (3) 작업 전 · 중 · 후 안전점검을 같은 일정 흐름의 작업 시작 · 종료와 묶는 것이다. 공식 문서 범위에서 (1) · (3)의 설명은 확인하지 못했다(없다고 단정하지 않음).

## 6. 정책
- 2026년 클린사업장 조성지원 5,334억원, 그중 스마트안전장비 370억원(50인 미만 등). [S29]
- 중기부 · 과기정통부 · 산업부 AX 사업 통합 공고(2026.3). [S30]

## 출처
- S1 한국정보통신공사협회 종합정보시스템, 「실적신고 현황」(2025년도), 2026-11-23 조회, https://ictis.kica.or.kr/construct/statInfo/resultReport
- S2 한국정보통신공사협회 종합정보시스템, 「규모별 시공능력평가 현황」(기준연도 표기 없음), 2026-11-23 조회, https://ictis.kica.or.kr/construct/assessment/currentState
- S3 서울특별시, 「정보통신공사업의 등록기준」, 2026-03-12 수정, https://news.seoul.go.kr/gov/?p=21102
- S4 정보통신신문, 「정보통신공사현장 인력난 해소 '제도적 장치' 절실」, 2023-10-13, https://www.koit.co.kr/news/articleView.html?idxno=117421
- S5 정보통신신문, 「더 빨라진 고령화 시계…산업현장 인력수급 '깊은 고민'」, 2025-02-21, https://www.koit.co.kr/news/articleView.html?idxno=128530
- S6 정보통신신문, 「정보통신공사업 인력수급 어려움, 주된 원인은 고용환경 불안정」, 2023-08-25, https://www.koit.co.kr/news/articleView.html?idxno=116106
- S7 미디어오늘, 「LG헬로비전 설치기사 작업 중 사망에 "격무·착취 시달려"」, 2019-12-31, https://www.mediatoday.co.kr/news/articleView.html?idxno=204441
- S8 경향신문, 「"고객 찾아가고, 콜 기다리는 시간···왜 '노동'이 아닌가요?"」, 2024-03-05, https://www.khan.co.kr/article/202403051531001
- S9 매일노동뉴스, 「SK브로드밴드도 하청노동자 직접 업무지시」, 2019-06-12, https://www.labortoday.co.kr/news/articleView.html?idxno=158820
- S10 SK텔레콤 뉴스룸, 「통신3사, 기지국 안전시설장치 공동 구축」, 2024-09-05, https://news.sktelecom.com/206876
- S11 정보통신신문, 「'K-사다리'로 시공현장 더 안전하게」, 2023-10-26, https://www.koit.co.kr/news/articleView.html?idxno=117824
- S12 경남일보, 「남해서 전신주 통신선 작업 하던 60대 추락」, 2025-04-17, https://www.gnnews.co.kr/news/articleView.html?idxno=608413
- S13 서울신문, 「전신주 작업하러 갔던 60대 추락 사망…」, 2026-11-20, https://www.seoul.co.kr/news/society/accident/2026/11/20/20261120500034
- S14 매일노동뉴스, 「SK브로드밴드·텔레콤 전송망 하도급업체 산안법 무더기 위반」, 2024-10-16, https://www.labortoday.co.kr/news/articleView.html?idxno=224171
- S15 고용노동부, 「중대재해처벌법 전면 시행, 사상 최초의 산업안전 대진단으로 총력 지원한다!」, 2024-01-29, https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=16136
- S16 고용노동부, 「자기규율 예방체계의 핵심 수단인 "위험성평가"를 쉽고 간편하게…」, 2023-03-06, https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=14751
- S17 고용노동부, 「안전 필수템 '위험성평가'를 통해 모든 일터를 안전하게!」, 2026-11-04, https://moel.go.kr/news/enews/report/enewsView.do?news_seq=20194
- S18 시사저널, 「잇단 안전사고에 안전모 인증샷 찍으라는 KT」, 2018-07-27, https://www.sisajournal.com/news/articleView.html?idxno=176645
- S19 머니투데이, 「건설 현장 관리 '삽질' 끝…근태도, 안전도 기술로 챙긴다」, 2026-05-20, https://www.mt.co.kr/future/2026/05/20/2026051109103381335
- S20 법제처 국가법령정보센터 — 산업안전보건법 제38조, 산업안전보건기준에 관한 규칙 제32조 (정리: docs/SAFETY_LAW_NOTES.md)
- S21 Microsoft Learn, "Overview of Resource Scheduling Optimization", 2026-10-30, https://learn.microsoft.com/en-us/dynamics365/field-service/rso-overview
- S22 Microsoft Learn, "Use inspections in work orders", 2026-04-06, https://learn.microsoft.com/en-us/dynamics365/field-service/inspections
- S23 Salesforce, "What Is Dispatch Management?", https://www.salesforce.com/blog/what-is-dispatch-management/
- S24 Salesforce, "What to look for in a route optimisation solution", https://www.salesforce.com/kr/service/field-service-management/field-service-route-optimization/
- S25 Salesforce Trailhead, "Manage Service Appointments", https://trailhead.salesforce.com/content/learn/modules/field-service-dispatcher-console-for-dispatchers/manage-service-appointments
- S26 ServiceTitan Help, "Dispatch & Track Your Technicians", 2026-10-15, https://help.servicetitan.com/residential-s-r/docs/dispatch-track-your-technicians-2
- S27 Procore, "Construction Daily Report Software and App", https://www.procore.com/quality-safety/daily-log
- S28 App Store, 「콘업-공사관리」, https://apps.apple.com/us/app/id1505747343
- S29 파이낸셜뉴스, 「정부, 소규모 사업장 산재 예방 지원나서」, 2026-01-06, https://www.fnnews.com/news/202601061814367113
- S30 MTN, 「중기부·과기정통부·산업부, 'AX 사업 통합 공고'」, 2026-03-12, https://news.mtn.co.kr/news-detail/2026031210172644392

## 회사 근거 (내부)
- 2026-11-13 구본석 이사 인터뷰 · 통화 요약: `docs/FIELD_ISSUE_PILOT.md` 1장, `docs/FOCUS_0.5.0.md` 1장 (녹취 원문은 개인정보 때문에 저장소에 두지 않음)
