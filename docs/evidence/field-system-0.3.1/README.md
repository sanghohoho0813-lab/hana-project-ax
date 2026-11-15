# 현장 실사용 AX 시스템 0.3.1 — 로컬 자체 시험 기록 (2026-11-15)

> **현장 실증 자료가 아닙니다.**
> - 이 개발 환경의 로컬 Supabase(도커)에서 자동 시험이 만든 기록입니다.
> - 사건은 모두 시험 기록(`HT-`)입니다. 인물·현장·사진은 시험용이고, 사진은 화면 캡처를 JPEG로 저장한 **시험용 이미지**입니다.
> - 관리자 PC · 기사 A · 기사 B는 한 컴퓨터 안의 서로 다른 브라우저 세션 3개입니다. 실제 서로 다른 기기 시험은 아직 하지 않았습니다.

| 파일 · 폴더 | 내용 |
|---|---|
| `test-run-0.3.1-4d523e7.txt` | 0.3.1 전체 회귀 원문 (커밋 `4d523e7`, 11:11~11:17 KST)<br>`test:pilot:e2e`의 첫 실패 · 재실행 실패 · 단독 재실행 · 최종 재실행(98/98)을 모두 그대로 실었습니다 |
| `case_HT-20261115-007_evidence.pdf` · `.json` · `.csv` | 0.3.1 화면시험이 만든 사건 — **가상 시나리오**로 저장 (A4 2쪽 · 시험용 이미지 · 초 단위 · 이 사건 관련 위험과 그날 전체 구분) |
| `pdf-before-after/` | 같은 사건 `HT-20261114-003`의 수정 전(0.3.0, 3쪽) · 수정 뒤(0.3.1, 2쪽) PDF와 쪽 그림 — 기록은 고치지 않고 출력만 다시 함 |
| `screens/` | 0.3.1 화면시험 화면 사진 (기사 휴대폰 화면 · 관리자 화면 · 사건 증빙 · 안전점검) |
| `production-sim/` | 운영 적용 모의시험: seed 없는 별도 로컬 Supabase(PG 17 · 비슈퍼유저 postgres)에 `supabase/production/01_apply_all_migrations.sql` 적용 |
| `production-sim/01_apply_notices.log` | 적용 때 나온 알림 3줄 (오류 0) |
| `production-sim/db_tests_on_fresh_db.txt` | 그 DB에서 DB 시험 53건 통과 |
| `production-sim/04_verify_after_db_tests.txt` | 점검 SQL 13항목 결과 (시험 계정이 들어간 뒤라 관리자·기사 수가 있음) |

해설: `docs/FIELD_SYSTEM_OPERATIONS_READINESS.md` (③ 오류와 수정 · ⑥ PDF 수정 전후 · ⑧ 최종 상태표)
