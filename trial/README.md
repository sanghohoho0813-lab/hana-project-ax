# 비교시험 자료 — 수기 일정확인 vs 연쇄위험 판단 AX 사용

벤처기업확인 이의신청용 소규모 전후 비교시험 준비 자료입니다. 기존 프로그램(`src/`)의 기능·디자인은 바꾸지 않았습니다.
실제 시험 결과는 아직 없습니다 — 결과 칸은 시험 후 `tools/score.py`가 실측값으로만 채웁니다.

| 순서 | 할 일 | 파일 |
|---|---|---|
| 1 | 설계·공정성·진행 대본 읽기 (진행요원) | `TRIAL_PLAN.md` |
| 2 | 인쇄 | `print/01~06*.pdf` (참가자·기록자용), `print/07_answer_key_CONFIDENTIAL.pdf` (진행요원 전용) |
| 3 | AX 방식 화면 열기 | `dist/AX_trial_screen.html` (크롬·엣지에서 파일 열기, 서버 불필요) |
| 4 | 시간 측정 | `dist/observer_timer.html` (기록자 기기) 또는 스톱워치 + 기록지 |
| 5 | 결과 입력 | `results/timing.csv` · `answers.csv` · `participants.csv` (형식: `results/README.md`) |
| 6 | 채점·보고서 | `python3 trial/tools/score.py` → `report/additional_verification.md` (2~3쪽, 틀: `REPORT_TEMPLATE.md`) |

## 구성

```
trial/
├─ TRIAL_PLAN.md            시험 계획서 (참가자 비공개)
├─ REPORT_TEMPLATE.md       추가 검증자료 틀 — 결과 칸은 채점 프로그램이 실측값으로 채움
├─ data/scenarios.json      가상 시나리오 12개 (연습 2 + A세트 5 + B세트 5) — 입력값만
├─ data/answer-key.json     손계산 정답표 (참가자 비공개)
├─ data/answer-key.computed.json  독립 검산 결과 (tools/answer_key.py 가 만듦)
├─ lib/scenario.ts          시나리오 → 실제 AX 엔진 연결 (화면·교차확인 공용)
├─ ax-screen/main.tsx       AX 시험 화면 — 실제 엔진·판단 근거 카드·우선순위 목록 그대로 사용
├─ check/engine-crosscheck.check.ts  정답표 = 실제 AX 엔진 (62항목)
├─ tools/answer_key.py      정답표 독립 검산 (엔진 코드를 쓰지 않고 판단 기준표대로 새로 구현)
├─ tools/make_print.py      인쇄물 생성 (모두 data/에서 바로 만듦)
├─ tools/build-ax-screen.mjs  AX 시험 화면을 HTML 파일 하나로 묶음
├─ tools/score.py           채점·집계 (+ --selftest)
├─ print/                   인쇄물 HTML·PDF
├─ dist/                    AX 시험 화면 · 기록자 측정 도구
└─ results/                 실측 결과 입력 (지금은 머리글만)
```

## 점검 명령

```bash
python3 trial/tools/answer_key.py                     # 손계산 정답표 = 독립 검산
npx vitest run --config trial/vitest.config.ts        # 정답표 = 실제 AX 엔진 (기존 npm test 113개와 별도)
python3 trial/tools/score.py --selftest               # 채점 규칙 자체 점검
```
