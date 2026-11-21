# 이의신청 보완자료 샘플 (2026-11-21)

세 가지 현장 문제(초급 기술자 보고 지연 · 안전확인 지연 · 다음 현장 지연 전파)를 **실제 프로그램 화면**으로 절차대로 보여 주는 A4 자료의 샘플이다.
구성·문구는 회사가 만든 참고 PDF(「이의신청 보완자료 구성 예시」 12쪽)를 따랐다.

| 파일 | 내용 |
|---|---|
| `appeal-sample.pdf` | 완성본 (A4) |
| `appeal.html` · `style.css` · `img/` | PDF의 원본 (브라우저로 열어도 됨) |
| `photos/ai-*.jpg` | 참고 PDF에서 꺼낸 **AI 생성 연출 사진** — 문서에 'AI 연출 사진'으로 표시 |
| `facts.py` · `make.py` · `render.mjs` | 다시 만들기 |

## 화면은 어떻게 찍었나
- `tests-pilot/e2e/appeal-shots.mjs` — 로컬 서버 · 로컬 DB에서 실제 프로그램을 자동으로 조작하며 찍는다 (약 45분: '중간 확인'은 실제로 30분이 지나야 뜬다).
- 자료 구분은 '검증 시나리오(가상)', 인물 · 현장 · 사진('시험용 이미지')은 시험용이다. 관리자 PC와 기사 휴대폰은 같은 컴퓨터의 별도 브라우저 세션이다 (실제 휴대폰 아님).
- 화면 시각은 촬영한 실제 시각이다. 일정 간격 · 이동시간이 핵심 사례(`docs/VENTURE_CORE_CASE.md`, 09:00 기준)와 같아 계산 결과(50분 · 45분 부족)도 같다.

## 쓰지 않은 것
- 참고 PDF 7쪽의 '70분 → 15분'처럼 측정하지 않은 개선 수치는 넣지 않았다. 대신 실제 현장에서 같은 정의로 잴 지표를 적었다.
- 실제 현장 실증 결과는 0건이다. 문서에도 그렇게 적었다.

## 다시 만들기
```bash
# 1) 화면 촬영 (로컬 Supabase · next start -p 3197 실행 중, 한국 시각 05~19시)
APPEAL_OUT=/tmp/appeal node tests-pilot/e2e/appeal-shots.mjs
python3 docs/appeal-sample/facts.py /tmp/appeal/facts.json   # 2) 시험 기록(로컬 DB)에서 사건번호 · 발견/보고 · 조치 시각
# 3) 문서 · PDF
python3 docs/appeal-sample/make.py /tmp/appeal docs/appeal-sample/photos
node docs/appeal-sample/render.mjs docs/appeal-sample/appeal-sample.pdf
```
글꼴은 Pretendard(OFL)를 쓴다. `fonts/`에 없으면 CDN에서 받는다.
