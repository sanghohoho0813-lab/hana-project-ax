# 시험 결과 입력 (실측값만)

여기에는 **실제로 시험한 기록만** 넣습니다. 비어 있는 동안 채점 프로그램은 '측정 전'만 씁니다.

## timing.csv — 기록자 측정 (측정 도구 'CSV 저장' 그대로)

| 칸 | 내용 |
|---|---|
| participant · session · method · set | 참가자 코드(P1…) · 회차(1/2) · `수기` 또는 `AX` · `A` 또는 `B` |
| scenario · practice | 시나리오(R1·R2·A1~B5) · 연습이면 1 (채점 안 함) |
| start · part1_end · action_given · part2_end | 기록 시각 HH:MM:SS |
| t1_sec · t2_sec | 1부·2부 소요 초 (측정 도구가 계산, 손으로 옮길 때는 시각 차이) |
| t1_timeout · t2_timeout | 제한시간(10분·5분)을 넘었으면 1 |
| observer · note | 기록자 · 특이사항 |

## answers.csv — 답안지 옮기기 (방식 칸 없음 — 방식을 가린 채 입력)

한 줄에 답 하나. 적힌 그대로 옮기고, 틀린 답도 고치지 않습니다. 읽을 수 없으면 note에 적습니다. 연습(R1·R2)은 옮기지 않습니다.

| item | 뜻 | 쓰는 칸 |
|---|---|---|
| `risk` | 1부 위험 연결 | from, to, minutes(예상 부족 분) |
| `affected` | 1부 시작이 늦어지는 현장 | site, minutes(늦어지는 분) |
| `none` | 1부 '위험 없음' 표시 | — |
| `after_risk` | 2부 조치 후 위험 연결 | from, to, minutes, new(새로 생김 표시면 1) |
| `after_none` | 2부 '조치 후 위험 없음' 표시 | — |
| `resolved` | 2부 조치로 없어진 위험 연결 | from, to |

현장 이름은 시험지의 현장 칸 이름(예: 천안, 아산)으로 씁니다. 예:

```
participant,scenario,item,from,to,site,minutes,new,note
P1,A1,risk,천안,아산,,15,,
P1,A1,affected,,,아산,15,,
P1,A1,resolved,천안,아산,,,,
```

## participants.csv — 참가자 정보

participant, role(직무), years(경력 년), usual_method(평소 일정 확인 방법), ax_experience(없음/시연 봄/써 봄), session1·session2(예: `수기-A`, `AX-B`), date, note
