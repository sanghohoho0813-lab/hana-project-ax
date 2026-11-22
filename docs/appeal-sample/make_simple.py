"""이의신청 보완자료 — 간결판 (2026-11-22)

원칙: 한 쪽 = 한 메시지 · 제목 1개 + '기존 → 이후' 한 줄 + 화면 3장(각 10자 안팎 설명) · 긴 설명은 상세판(make.py)에.
실행: python3 docs/appeal-sample/make_simple.py <촬영 폴더> <사진 폴더>
결과: docs/appeal-sample/simple.html · img-simple/  →  APPEAL_HTML=simple.html node docs/appeal-sample/render.mjs <PDF>
"""
import sys
from pathlib import Path

from appeal_lib import Kit

HERE = Path(__file__).resolve().parent
K = Kit(Path(sys.argv[1]), Path(sys.argv[2]), HERE / "img-simple", "img-simple")
F, hm = K.F, K.hm

pages: list[str] = []
LOGO = """<div class="logo"><span class="mark">H<i></i></span><div><b>하나정보통신</b><small>HANA INFORMATION &amp; COMMUNICATION</small></div></div>"""
FOOT = "화면: 실제 개발한 프로그램 (시험용 가상 일정) · 사진: AI 연출"


def page(body: str, cls: str = "") -> None:
    n = len(pages) + 1
    pages.append(f"""<section class="page s {cls}"><header>{LOGO}<span class="ref">VENTURE APPEAL / 2026.11</span></header><main>{body}</main><footer><span>{FOOT}</span><b>{n:02d}</b></footer></section>""")


def head(tag: str, title: str, cls: str = "") -> str:
    return f"""<p class="s-tag {cls}">{tag}</p><h2 class="s-h">{title}</h2>"""


def ba(before: str, after: str) -> str:
    return f"""<div class="s-ba"><div><small>기존</small>{before}</div><i></i><div class="a"><small>이 프로그램</small>{after}</div></div>"""


def item(n: int, t: str, fig: str) -> str:
    return f'<div class="s-item"><p><b>{n}</b>{t}</p>{fig}</div>'


def duo(left: str, *right: str) -> str:
    return f'<div class="s-duo"><div class="s-col">{left}</div><div class="s-col">{"".join(right)}</div></div>'


def story(*cols: tuple[str, str]) -> str:
    return '<div class="s-story">' + "".join(f'<div><p><b>{n}</b>{t}</p>{fig}</div>' for n, (t, fig) in enumerate(cols, 1)) + "</div>"


# 01 표지
pages.append(
    f"""<section class="page s cover"><header>{LOGO}<span class="pill">벤처기업확인 이의신청 · 보완자료</span></header><main>
<p class="eyebrow">THREE FIELD PROBLEMS · ONE WORKING PROGRAM</p>
<h1>현장에서 생긴 문제가<br><em>다음 현장까지 번지기 전에.</em></h1>
<p class="s-lead">현장 기록으로 <b>다음 현장 지연을 자동 계산</b>하고,<br>본사가 <b>먼저 할 일</b>을 알려 줍니다.</p>
<div class="trio s-trio">{K.photo("ai-stuck")}{K.photo("ai-hq")}{K.photo("ai-van")}</div>
<div class="s-facts"><div><small>신청기술</small><b>복수 현장 업무 위험관리 AX 시스템</b></div><div><small>관련 특허</small><b>10-2026-0173957</b><span>출원 · 등록 아님</span></div><div><small>프로그램</small><b>v0.6.1</b><span>현장기사 휴대폰 + 관리자 PC</span></div></div>
</main><footer><span>{FOOT} · 실제 현장 성과 아님</span><b>01</b></footer></section>"""
)

# 02 한 장 그림
page(
    f"""{head("한 장으로 보는 기술", "기록을 받아,<br><em>먼저 할 일을 알려 줍니다.</em>")}
<div class="s-ov">
  <div class="box1"><h4>현장 기사 휴대폰</h4><p>작업 시작 · 종료</p><p>문제 보고</p><p>안전점검</p></div>
  <i></i>
  <div class="box2"><h4>자동 계산<small>정해진 규칙 · AI 예측 아님</small></h4><p><b class="n1">1</b>연락 없이 늦어짐</p><p><b class="n2">2</b>안전점검 빠짐 · 미흡</p><p class="core"><b class="n3">3</b>다음 현장 지연<em>특허 핵심</em></p></div>
  <i></i>
  <div class="box1"><h4>본사 관리자 PC</h4><p>먼저 볼 일</p><p>지원 결정</p><p>일정 조정</p></div>
</div>
<p class="s-loop">조치하면 <b>다시 계산</b> → 기사 휴대폰에 <b>바로 전달</b></p>
<div class="s-rows">
  <div><b class="n1">1</b><span>혼자 오래 붙잡음</span><i></i><strong>30분째 먼저 묻기</strong></div>
  <div><b class="n2">2</b><span>안전확인이 늦음</span><i></i><strong>점검 먼저 · 미흡은 즉시 중지</strong></div>
  <div><b class="n3">3</b><span>다음 현장까지 지연</span><i></i><strong>몇 분 늦는지 자동 계산</strong></div>
</div>"""
)

# 03 문제 1
page(
    f"""{head("문제 1 · 초급 기술자가 혼자 오래 붙잡음", "30분째 연락이 없으면,<br><em>먼저 묻습니다.</em>", "c1")}
{ba("혼자 해결하다 늦게 전화", "시스템이 먼저 묻고, 터치로 보고")}
{duo(
    item(1, "휴대폰이 먼저 묻기", K.shot("p1_field_ask", show=[1, 2])),
    item(2, "본사도 같은 시각에 확인", K.shot("p1_admin_watch", show=[1], focus=90)),
    item(3, "바로 지원 결정 → 기사에게", K.shot("p1_field_hq", show=[1])),
)}
<p class="s-note">{F['started']} 작업 시작 → <b>{K.at('p1_field_ask')} 중간 확인</b> → ‘막혔어요’ 보고 → 지원 결정</p>""",
)

# 04 문제 2
page(
    f"""{head("문제 2 · 안전확인이 뒤늦게 이루어짐", "점검이 먼저,<br><em>미흡은 바로 멈춤.</em>", "c2")}
{ba("점검 · 사진을 나중에 정리", "작업 단계마다 점검 먼저, 미흡은 즉시 중지")}
{duo(
    item(1, "점검 없이 시작 → 먼저 묻기", K.shot("p2_gate_start", show=[1, 2], focus=60, aspect=0.66)),
    item(2, "미흡 → 작업 중지 · 직접 전화", K.shot("p2_mid_deficient", focus=50, aspect=1.5)),
    item(3, "본사 1순위로 표시", K.shot("p2_admin_dash_safety", show=[1])),
)}
<p class="s-note">사진으로 자동 판정하지 않습니다 — <b>관리자가 눈으로 확인</b></p>""",
)

# 05 문제 3 — 계산
page(
    f"""{head("문제 3 · 핵심 기술", "한 곳이 늦으면,<br><em>다음 현장에 몇 분 늦는지.</em>", "c3")}
{ba("‘늦는다’는 사실만 공유", "다음 현장 도착을 자동 계산")}
<div class="s-sites"><div><b>보령</b>{hm(0)}~{hm(60)}</div><i>20분</i><div><b>홍성</b>{hm(90)}~{hm(150)}</div><i>25분</i><div><b>예산</b>{hm(180)}~{hm(230)}</div></div>
<div class="s-calc"><div><small>보령 끝 예상</small><b>{F['new_end']}</b></div><i>+</i><div><small>이동</small><b>20분</b></div><i>=</i><div class="d"><small>홍성 도착</small><b>{hm(140)}</b></div><i>vs</i><div><small>홍성 시작</small><b>{hm(90)}</b></div><div class="r"><small>늦음</small><b>50분</b></div></div>
<div class="s-calc"><div><small>홍성 끝 예상</small><b>{hm(200)}</b></div><i>+</i><div><small>이동</small><b>25분</b></div><i>=</i><div class="d"><small>예산 도착</small><b>{hm(225)}</b></div><i>vs</i><div><small>예산 시작</small><b>{hm(180)}</b></div><div class="r"><small>늦음</small><b>45분</b></div></div>
<div class="s-proof"><p>프로그램 화면에서도 바로 보입니다</p>{K.shot("p13_admin_dash", show=[1, 2], name="s_nextsite")}</div>
<p class="s-note"><b>AI 예측 아님</b> · 정해진 규칙 · 같은 입력이면 같은 결과</p>""",
)

# 06 문제 3 — 조치 후 다시 계산
page(
    f"""{head("문제 3 · 핵심 기술", "조치하면 다시 계산,<br><em>남은 위험 0까지.</em>", "c3")}
<p class="s-cap"><b>보고 직후</b> — 홍성 50분 · 예산 45분 늦음</p>
{K.shot("p3_chain_report", show=[1, 2, 3], name="s_chain_before")}
<p class="s-arrow">관리자가 홍성 {hm(145)} · 예산 {hm(240)}으로 일정 조정</p>
<p class="s-cap"><b>조치 후</b> — 여유 5분 · 여유 10분 · <b>남은 위험 0</b></p>
{K.shot("p3_chain_after", show=[1, 2, 3], name="s_chain_after")}""",
)

# 07 증거
page(
    f"""{head("근거", "확인된 것,<br><em>남은 것.</em>")}
<div class="s-cards">
  <div><small>특허</small><b>출원 1건</b><span>10-2026-0173957 · 등록 아님</span></div>
  <div><small>자동 시험</small><b>746개</b><span>통과 · 개발환경</span></div>
  <div><small>실행 화면</small><b>{len(K.meta['steps'])}장</b><span>실제 프로그램 · 가상 일정</span></div>
  <div class="r"><small>현장 실증</small><b>0건</b><span>다음 단계</span></div>
</div>
<div class="s-two">
  <div><h4>확인됨</h4><p>세 문제를 다루는 기능</p><p>다음 현장 지연 자동 계산</p><p>가상 시나리오 시험</p></div>
  <div class="r"><h4>남음</h4><p>실제 현장 사용 기록</p><p>시간 · 비용 효과 측정</p><p>효과 수치는 측정 뒤에만</p></div>
</div>
<div class="s-tl"><div><b>09.11</b>특허 출원</div><div><b>10.28</b>계산 기능 구현</div><div><b>11.13</b>현장 인터뷰 반영</div><div><b>11.18</b>v0.6.1 · 자체 시험</div><div><b>11.22</b>실행 화면 촬영</div></div>""",
)

# 08 심사 답변
page(
    f"""{head("심사 의견에 답합니다", "질문 하나에,<br><em>한 줄로.</em>")}
<p class="s-fill">아래 질문은 예시입니다 — 결과 통지서의 보완 사유 문장으로 바꿔 넣으세요</p>
<div class="s-qa">
  <div><p>무슨 기술인가?</p><strong>다음 현장에 몇 분 늦는지 자동 계산하고, 먼저 할 일을 정하는 기술</strong><span>2 · 5쪽</span></div>
  <div><p>차별성은?</p><strong>기록만이 아니라 앞 · 뒤 현장을 이어 계산, 조치하면 다시 계산</strong><span>6쪽</span></div>
  <div><p>근거는?</p><strong>실행 화면 {len(K.meta['steps'])}장 · 자동 시험 746개 · 특허 출원</strong><span>7쪽</span></div>
  <div><p>개발 가능성은?</p><strong>세 문제 절차가 이미 동작 — 남은 것은 현장 실증</strong><span>9쪽</span></div>
</div>""",
)

# 09 다음 단계
page(
    f"""{head("다음 단계", "다음은,<br><em>실제 현장 기록입니다.</em>")}
<div class="s-next">
  <div>{K.photo("ai-stuck")}<p><b>1</b>실제 현장 사례 확인</p></div>
  <div>{K.photo("ai-tablet")}<p><b>2</b>실제 기기로 사용</p></div>
  <div>{K.photo("ai-map")}<p><b>3</b>실제 업무 1건 기록</p></div>
</div>
<div class="navy s-msg"><p>핵심 기술은 구현했습니다.<br>현장 적용으로 효과를 검증하겠습니다.</p></div>""",
)

CSS = (HERE / "style.css").read_text() + (HERE / "style-simple.css").read_text()
(HERE / "simple.html").write_text(f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>하나정보통신 이의신청 보완자료 (간결판)</title><style>{CSS}</style></head><body>{''.join(pages)}</body></html>""")
print("pages", len(pages))
