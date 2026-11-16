# 0.6.0 화면 캡처 — 안전 1순위 (2026-11-16)

- 만든 방법: 로컬 Supabase(개발 DB)를 초기화한 뒤 `PILOT_E2E_OUT=docs/evidence/ui-0.6.0 node tests-pilot/e2e/watch.mjs`를 돌렸다.
  - 관리자 PC와 현장 직원 휴대폰(390px)이 각자 로그인했다.
- 사람 이름 · 현장 이름 · 시각은 시험용 가정값이다. 실제 현장 기록이 아니다.
- 내용: [`docs/SAFETY_FIRST_0.6.0.md`](../../SAFETY_FIRST_0.6.0.md)

| 파일 | 화면 | 보이는 것 |
| --- | --- | --- |
| `w00_field_safety_gate.png` | 현장 휴대폰 | 시작 전 점검 없이 '작업 시작' → "시작 전 안전점검을 먼저 보내 주세요" (점검 하기 · 점검 없이 시작) |
| `w01_field_mid_check.png` | 현장 휴대폰 | 작업 시작 40분째 · 진행 보고 없음 → "예정대로 되고 있나요?" |
| `w02_admin_watch_mid.png` | 관리자 대시보드 | 안전 확인 필요(1순위) · 연락 없이 늦어지는 현장(공동 1순위) 나란히 |
| `w03_field_overdue.png` | 현장 휴대폰 | 예상 종료 70분 지남 → 막혔어요 · 늦어져요 |
| `w04_admin_watch_overdue.png` | 관리자 대시보드 | 예정 넘김 70분 · '지금 끝나면 다음 현장 영향' 계산값 · 점검 전 시작 표시 |
| `w05_admin_after_report.png` | 관리자 대시보드 | 문제 보고 뒤 우선 처리할 사건으로 |
| `w06_field_safety_missing.png` | 현장 휴대폰 | 점검 없이 마친 현장 → '안전점검 빠짐' 알림 |
| `w07_admin_safety_stages.png` | 관리자 안전관리 | 현장별 3단계 현황 (누락 · 없이 시작 · 없이 종료) |
| `w08_admin_measures_focus.png` | 관리자 성과 측정 | 핵심 지표(안전 1순위) · 측정 10 (제때 제출 · 관리자 확인 시간) |
| `w09_admin_safety_first.png` | 관리자 대시보드 | 안전 확인 필요: 점검 전 시작 · 마무리 점검 없음 · 단계 누락 · 사진 확인 대기 |
