"""이의신청 보완자료(샘플) HTML 만들기 — '처음 보는 사람이 바로 이해하는' 구성 (2026-11-22 개정)

원칙: 한 쪽 = 한 메시지 · 핵심 화면은 크게 잘라 ①②③ 표시 · 쉬운 말(자동 계산 · 다시 계산 · 다음 현장 지연)
화면: tests-pilot/e2e/appeal-shots.mjs 가 찍은 실제 프로그램 화면 (crop · marks 좌표 포함)
사진: 참고 PDF의 AI 연출 사진 — 문서에 'AI 연출 사진'으로 표시

실행: python3 docs/appeal-sample/make.py <촬영 폴더> <사진 폴더>
결과: docs/appeal-sample/appeal.html · img/  →  node docs/appeal-sample/render.mjs 로 PDF
"""
import json
import shutil
import subprocess
import sys
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHOTS = Path(sys.argv[1])
PHOTOS = Path(sys.argv[2])
IMG = HERE / "img"
if IMG.exists():
    shutil.rmtree(IMG)
IMG.mkdir()

meta = json.loads((SHOTS / "steps.json").read_text())
F = json.loads((SHOTS / "facts.json").read_text())
STEPS = {s["id"]: s for s in meta["steps"]}
S = {"A": "보령 지사", "B": "홍성 물류센터", "C": "예산 매장"}
N_SHOTS = len(meta["steps"])


def hm(m: int) -> str:
    """P(보령 예정 시작) + m분 → HH:MM"""
    h, mi = map(int, meta["P"].split(":"))
    t = h * 60 + mi + m
    return f"{t // 60:02d}:{t % 60:02d}"


def at(i: str) -> str:
    return STEPS[i]["at"][:5]


def size(p: Path) -> tuple[int, int]:
    w, h = subprocess.check_output(["identify", "-format", "%w %h", str(p)]).split()
    return int(w), int(h)


# ── 화면 · 사진 ─────────────────────────────────────────
TAG_REAL = '<span class="tag real">실제 화면</span>'
TAG_AI = '<span class="tag ai">AI 연출 사진</span>'


def shot(i: str, show=None, aspect: float | None = None, who: str | None = None, cls: str = "", time: str | None = None, focus=False, name: str | None = None) -> str:
    """실제 화면 한 장 — 핵심 부분(crop)에 ①②③ 표시를 겹친다.
    show: 보일 표시 번호(기록 순서 1부터)
    aspect: 가로/세로 — 표시들을 가운데 두고 잘라 맞춘다
    focus: 표시들 둘레만 남기고 잘라 크게 보인다 (숫자면 여백 px)"""
    st = STEPS[i]
    c = st.get("crop")
    phone = st["device"] == "phone"
    src = SHOTS / (c["img"] if c else st["img"])
    W, H = size(src)
    marks = []
    if c:
        for k, m in enumerate(c["marks"], 1):
            if not m or (show and k not in show):
                continue
            if m["y"] + m["h"] < 0.01 or m["y"] > 0.99:  # 화면 밖
                continue
            marks.append([m["x"] * W, m["y"] * H, m["w"] * W, m["h"] * H])
    x0, y0, cw, ch = 0.0, 0.0, float(W), float(H)
    if focus and marks:
        pad = 48 if focus is True else focus
        ux0 = max(0, min(b[0] for b in marks) - pad)
        uy0 = max(0, min(b[1] for b in marks) - pad)
        ux1 = min(W, max(b[0] + b[2] for b in marks) + pad)
        uy1 = min(H, max(b[1] + b[3] for b in marks) + pad)
        x0, y0, cw, ch = ux0, uy0, ux1 - ux0, uy1 - uy0
        if aspect:
            if cw / ch < aspect:
                nw = min(W, ch * aspect)
                x0, cw = max(0, min(W - nw, x0 - (nw - cw) / 2)), nw
            else:
                nh = min(H, cw / aspect)
                y0, ch = max(0, min(H - nh, y0 - (nh - ch) / 2)), nh
    elif aspect and W / H < aspect:
        ch = round(W / aspect)
        cy = (min(b[1] for b in marks) + max(b[1] + b[3] for b in marks)) / 2 if marks else H / 2
        y0 = max(0, min(H - ch, cy - ch / 2))
    x0, y0, cw, ch = round(x0), round(y0), round(cw), round(ch)
    name = name or i
    out = IMG / f"{name}.jpg"
    subprocess.run(["convert", str(src), "-crop", f"{cw}x{ch}+{x0}+{y0}", "+repage", "-resize", "1500x>", "-quality", "86", str(out)], check=True)
    mk = ""
    for n, (x, y, w, hh) in enumerate(marks, 1):
        pad = 6
        L, T = max(0, x - x0 - pad) / cw * 100, max(0, y - y0 - pad) / ch * 100
        R, B = min(cw, x - x0 + w + pad) / cw * 100, min(ch, y - y0 + hh + pad) / ch * 100
        mk += f'<i class="mk" style="left:{L:.2f}%;top:{T:.2f}%;width:{R - L:.2f}%;height:{B - T:.2f}%"><b>{n}</b></i>'
    who = who or ("기사 휴대폰" if phone else "관리자 PC")
    t = time or at(i)
    return f"""<figure class="shot {'phone' if phone else 'pc'} {cls}"><div class="bar">{TAG_REAL}<b>{who}</b><span>{t}</span></div><div class="frame"><img src="img/{name}.jpg" alt="">{mk}</div></figure>"""


def photo(name: str, cls: str = "") -> str:
    shutil.copy(PHOTOS / f"{name}.jpg", IMG / f"{name}.jpg")
    return f"""<figure class="pic {cls}"><img src="img/{name}.jpg" alt="">{TAG_AI}</figure>"""


def marks_list(*items: str) -> str:
    return '<ol class="mkl">' + "".join(f"<li><b>{n}</b><span>{t}</span></li>" for n, t in enumerate(items, 1)) + "</ol>"


def stp(n: int, time: str, title: str, body: str, cls: str = "") -> str:
    return f"""<div class="stp {cls}"><div class="stp-h"><span class="sn">STEP {n}</span><time>{time}</time></div><h3>{title}</h3>{body}</div>"""


ICON_PHONE = '<svg viewBox="0 0 24 24" class="ic"><rect x="6" y="2" width="12" height="20" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="10" y1="18.5" x2="14" y2="18.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
ICON_PC = '<svg viewBox="0 0 24 24" class="ic"><rect x="2" y="3" width="20" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12" y2="21" stroke="currentColor" stroke-width="2"/></svg>'
ICON_CALC = '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

pages: list[str] = []
HEAD = """<header><div class="logo"><span class="mark">H<i></i></span><div><b>하나정보통신</b><small>HANA INFORMATION &amp; COMMUNICATION</small></div></div><span class="ref">VENTURE APPEAL / 2026.11</span></header>"""
FOOT = "검토용 샘플 · 화면은 실제 개발한 프로그램(개발환경 · 시험용 가상 일정) · 사진은 AI 연출"


def page(left: str, right: str, body: str, cls: str = "") -> None:
    n = len(pages) + 1
    pages.append(f"""<section class="page {cls}">{HEAD}<div class="rule"><span>{left}</span><b>{right}</b></div><main>{body}</main><footer><span>{FOOT}</span><b>HANA / {n:02d}</b></footer></section>""")


def ba(before: str, after: str) -> str:
    return f"""<div class="ba"><div class="b"><small>기존</small><p>{before}</p></div><i>→</i><div class="a"><small>이 프로그램</small><p>{after}</p></div></div>"""


# ═════ 01 표지 ═════
pages.append(
    f"""<section class="page cover">
<header><div class="logo"><span class="mark">H<i></i></span><div><b>하나정보통신</b><small>HANA INFORMATION &amp; COMMUNICATION</small></div></div><span class="pill">벤처기업확인 이의신청 · 보완자료 (샘플)</span></header>
<main>
  <p class="eyebrow">THREE FIELD PROBLEMS · ONE WORKING PROGRAM</p>
  <h1>현장에서 생긴 문제가<br><em>다음 현장까지 번지기 전에.</em></h1>
  <p class="lead">현장 작업이 막혔을 때 <b>누가 먼저 알리고, 본사는 무엇부터 해결해야 하는지</b> 알려 주는 기술입니다. 실제로 개발한 프로그램의 휴대폰 · PC 화면으로 순서대로 보여 드립니다.</p>
  <div class="trio">{photo("ai-stuck")}{photo("ai-hq")}{photo("ai-van")}</div>
  <div class="navy one"><small>핵심 기술 · 한 문장</small><p>현장 상태의 변화를 받아, <span class="hl">다음 현장의 지연 위험을 자동 계산</span>하고, 관리자가 먼저 할 일을 정해 주는 기술</p></div>
  <div class="facts3">
    <div><small>신청기술</small><b>복수 현장 업무 위험관리 AX 시스템</b></div>
    <div><small>관련 특허</small><b>10-2026-0173957</b><span>2026.09.11 출원 · 등록 아님</span></div>
    <div><small>프로그램</small><b>v0.6.1 · 현장기사 휴대폰 + 관리자 PC</b><span>화면 촬영 {meta['date'].replace('-', '.')}</span></div>
  </div>
</main>
<footer><span>사진은 AI 생성 연출 이미지 · 화면은 실제 개발한 프로그램을 개발환경에서 시험용 가상 일정으로 실행해 촬영 · 실제 현장 성과 아님</span><b>HANA / 01</b></footer>
</section>"""
)

# ═════ 02 한 장 그림 ═════
page(
    "OVERVIEW",
    "이 기술을 한 장으로",
    f"""
<p class="kicker">01 / 처음 보시는 분을 위한 한 장 요약</p>
<h2>현장의 기록을 받아,<br><em>본사가 먼저 할 일을 알려 줍니다.</em></h2>
<div class="ov">
  <div class="ov-box field"><div class="ov-t">{ICON_PHONE}<b>현장 기사 휴대폰</b></div><ul><li>작업 시작 · 종료</li><li>문제 보고 · 지원 요청</li><li>안전점검 (착용 사진)</li></ul></div>
  <div class="ov-ar"><span>기록</span></div>
  <div class="ov-box engine"><div class="ov-t">{ICON_CALC}<b>자동 계산</b><small>정해진 규칙 · AI 예측 아님</small></div>
    <div class="ov-r r1"><b>1</b>연락 없이 늦어지는 현장 찾기</div>
    <div class="ov-r r2"><b>2</b>안전점검 빠짐 · 미흡 찾기</div>
    <div class="ov-r r3"><b>3</b>다음 현장 도착 계산<em>특허 핵심</em></div></div>
  <div class="ov-ar"><span>먼저 볼 일</span></div>
  <div class="ov-box hq"><div class="ov-t">{ICON_PC}<b>본사 관리자 PC</b></div><ul><li>먼저 볼 순서와 이유</li><li>지원 결정 · 현장 전달</li><li>다음 현장 일정 조정</li></ul></div>
</div>
<div class="ov-loop"><b>↺</b> 본사가 지원을 정하거나 일정을 바꾸면 <b>다시 계산</b>하고, 그 결과가 <b>기사 휴대폰에 바로 전달</b>됩니다. 같은 입력이면 언제 계산해도 같은 결과가 나옵니다.</div>
<table class="tri">
  <thead><tr><th>세 가지 현장 문제</th><th>기존</th><th>이 프로그램</th><th>화면</th></tr></thead>
  <tbody>
  <tr><td><span class="pn p1">1</span><b>초급 기술자가 혼자 오래 붙잡음</b></td><td>혼자 해결하려다 늦게 전화</td><td><b>30분째 연락이 없으면</b> 휴대폰과 본사에 자동 확인 → 터치 몇 번으로 보고 → 바로 지원 결정</td><td>4–5쪽</td></tr>
  <tr><td><span class="pn p2">2</span><b>안전확인이 뒤늦게 이루어짐</b></td><td>사진 · 점검을 나중에 정리, 미흡을 늦게 앎</td><td>작업 시작 · 종료 <b>전에 점검을 먼저 요청</b>, 미흡이면 즉시 작업 중지 안내 + 본사 1순위</td><td>6–7쪽</td></tr>
  <tr><td><span class="pn p3">3</span><b>앞 현장 지연이 다음 현장으로 번짐</b></td><td>늦는다는 사실만 공유, 다음 현장 영향은 사람이 계산</td><td>다음 현장에 <b>몇 분 늦는지 자동 계산</b>(예: 50분 부족), 일정을 바꾸면 다시 계산</td><td>8–10쪽</td></tr>
  </tbody>
</table>
<div class="thumbs">
  <div><p><span class="pn p1">1</span>30분째 연락이 없으면 <b>휴대폰이 먼저 묻는</b> 화면</p>{shot("p1_field_ask", show=[1, 2], focus=40, aspect=1.5, name="t1")}</div>
  <div><p><span class="pn p2">2</span>‘미흡’이면 <b>작업 중지 · 직접 전화</b> 안내</p>{shot("p2_mid_deficient", focus=40, aspect=1.5, name="t2")}</div>
  <div><p><span class="pn p3">3</span>다음 현장 <b>50분 · 45분 늦음</b> 자동 계산</p>{shot("p13_admin_dash", focus=24, aspect=1.5, name="t3")}</div>
</div>
<div class="legend"><b>이 자료의 표시</b>{TAG_REAL}<span>개발한 프로그램을 실제로 실행해 찍은 화면</span><span class="mk-demo"><b>1</b></span><span>화면에서 볼 곳 — 아래 설명 번호와 같음</span>{TAG_AI}<span>분위기 전달용 생성 이미지</span><span class="tag virt">시험용 가상 일정</span><span>인물 · 현장 · 사진은 시험용</span></div>
""",
)

# ═════ 03 한 사례 ═════
tl = [
    (at("p2_started"), "2", "시작 전 안전점검(착용 사진) → 작업 시작"),
    (at("p1_field_ask") if "p1_field_ask" in STEPS else hm(30), "1", "30분째 진행 보고 없음 → 휴대폰 · 본사에 ‘중간 확인’"),
    (F["reported"], "1", f"기사 ‘막혔어요’ → 문제 보고 · 숙련 기술자 요청 (발견 {F['discovered']})"),
    (F["reported"], "3", f"바뀐 예상 종료 {F['new_end']} → 홍성 50분 · 예산 45분 늦음 자동 계산"),
    (F["decided"], "1", "본사 지원 결정(숙련 직원 투입) → 기사 휴대폰에 도착"),
    (F["adjust1"], "3", "홍성 · 예산 일정 조정 → 다시 계산 → 남은 위험 0"),
    (at("p2_mid_deficient"), "2", "진행 중 점검 ‘미흡’ → 작업 중지 안내 → 보완 → 조치 완료"),
    (at("p2_ended"), "2", "마무리 점검 → 작업 종료 → 사건 해결 확인"),
]
tl_html = "".join(f'<li><time>{t}</time><span class="pn p{p}">{p}</span>{escape(x)}</li>' for t, p, x in tl)
page(
    "TEST CASE",
    "한 사례로 세 문제를 끝까지",
    f"""
<p class="kicker">02 / 김현장 기사의 하루 — 세 현장을 연달아 갑니다</p>
<h2>한 사례로<br><em>세 문제를 끝까지 따라갑니다.</em></h2>
<div class="sites">
  <div><small>앞 현장</small><b>{S['A']}</b><span>{hm(0)} ~ {hm(60)}</span></div><i>이동 20분</i>
  <div><small>다음 현장</small><b>{S['B']}</b><span>{hm(90)} ~ {hm(150)}</span></div><i>이동 25분</i>
  <div><small>그다음 현장</small><b>{S['C']}</b><span>{hm(180)} ~ {hm(230)}</span></div>
</div>
{shot("setup_board")}
<p class="cap">관리자가 <b>현장 · 예정 시각 · 이동시간</b>을 등록하면, 등록할 때마다 다음 현장에 제때 도착하는지 자동 계산합니다. 이때는 여유가 있어 위험 0건입니다.</p>
<div class="two">
  <div class="box"><h4>이 사례에서 일어난 일 (화면 촬영 시각)</h4><ol class="tl">{tl_html}</ol></div>
  <div class="box soft"><h4>촬영 조건 — 그대로 밝힙니다</h4><ul class="dots">
    <li>실제 개발한 프로그램을 개발환경(로컬 서버 · DB)에서 실행해 찍었습니다. 화면을 꾸미거나 합성하지 않았습니다.</li>
    <li>관리자 PC와 기사 휴대폰은 같은 컴퓨터의 별도 브라우저 화면입니다. 실제 휴대폰 시험은 운영 서버 연결 뒤 합니다.</li>
    <li>‘중간 확인’은 실제로 30분을 기다려 찍었습니다. 그 뒤 단계는 자동 조작이라 몇 분 안에 이어집니다.</li>
    <li>인물 · 현장 · 사진(‘시험용 이미지’)은 시험용입니다.</li></ul></div>
</div>
""",
)

# ═════ 04 문제 1 — 왜 ═════
page(
    "PROBLEM 1",
    "왜 보고가 늦어지는가",
    f"""
<p class="kicker">03 / 문제 1 · 초급 기술자 지원 지연</p>
<h2>왜 현장기사는<br><em>혼자 오래 붙잡을까?</em></h2>
<div class="feature">{photo("ai-stuck")}<div><small>현장 책임자 인터뷰 (2026-11-13)</small><h3>장비를 열어 보니<br>예상과 다른 조건.</h3><p>혼자 원인을 찾다가 시간이 흐른 뒤에야 본사에 연락하는 경우가 있었습니다. 본사가 일찍 알았다면 숙련자를 보내거나 원격으로 도울 수 있었다는 의견도 확인했습니다.</p></div></div>
<p class="lead">직원의 능력 문제가 아닙니다. <b>예상 밖 상황에서 누구에게 · 언제 · 어떤 지원을 요청할지 분명하지 않은 구조</b>가 문제입니다.</p>
<div class="why3">
  <div><b>1</b><h4>예상 밖 작업조건</h4><p>분해 · 설치 뒤에야 설비 조건이 다르다는 것이 드러납니다.</p></div>
  <div><b>2</b><h4>보고를 미룸</h4><p>스스로 해결할 수 있는지 판단하다 연락이 늦어집니다. 본사는 모릅니다.</p></div>
  <div><b>3</b><h4>지원 결정도 늦어짐</h4><p>본사가 뒤늦게 듣고 숙련자 · 장비 · 다음 일정을 다시 확인합니다.</p></div>
</div>
{ba("혼자 해결을 시도 → 늦게 전화 → 말로 설명 → 본사가 받아 적고 다음 일정을 따로 계산", "<b>30분째 연락이 없으면 시스템이 먼저 묻고</b>, 기사는 고르기만 해서 보고 → 본사가 이유와 함께 보고 바로 지원 결정")}
<h3 class="sec"><span>RECORD</span>이 사례에서 남은 시각 기록 <span class="tag virt">시험용 가상 일정</span></h3>
<div class="kv"><div><small>문제 발견 → 보고</small><b>{F['disc_to_report']}</b><span>{F['discovered']} → {F['reported']}</span></div><div><small>보고 → 본사 접수</small><b>{F['report_to_ack']}</b><span>자동 조작 시험</span></div><div><small>접수 → 지원 결정</small><b>{F['ack_to_decide']}</b><span>자동 조작 시험</span></div><div><small>화면 새로 고침</small><b>10~15초</b><span>주기 확인 · 실시간 감시 아님</span></div></div>
<p class="note">‘30분’은 예정 작업시간(60분)의 절반입니다(최소 20분) — 회사 기준으로 확정할 초안 값입니다. 초 단위 시간은 자동 조작이라 짧으며 업무 효과를 뜻하지 않습니다. 실제 현장에서 같은 항목으로 잽니다.</p>
""",
)

# ═════ 05 문제 1 — 해결 ═════
page(
    "SOLUTION 1",
    "보고가 없어도 먼저 묻고, 바로 지원",
    f"""
<p class="kicker">문제 1 · 이렇게 해결합니다 — 화면에서 볼 곳에 번호를 달았습니다</p>
<h2>30분째 연락이 없으면,<br><em>휴대폰과 본사가 동시에 압니다.</em></h2>
<div class="grid2">
  {stp(1, at('p1_field_ask'), "휴대폰이 먼저 묻습니다", shot("p1_field_ask", aspect=1.4) + marks_list("‘작업 시작 30분째예요 — 예정대로 되고 있나요?’", "막혔으면 <b>‘막혔어요’</b> 한 번으로 지원 요청"))}
  {stp(2, at('p1_admin_watch'), "같은 시각, 본사 화면에도 뜹니다", shot("p1_admin_watch") + marks_list("보령 지사 · <b>중간 확인</b> — 작업 시작 30분째 · 진행 보고 없음", "본사가 먼저 전화해 받은 내용을 대신 기록하는 바로가기"))}
  {stp(3, F['reported'], "고르기만 하면 보고 끝", shot("p1_report_need_end", aspect=1.4) + marks_list("필요한 지원: <b>숙련 기술자 지원</b>", f"바뀐 예상 종료 <b>{F['new_end']}</b> → ‘다음 현장 도착을 다시 계산합니다’"))}
  {stp(4, F['decided'], "본사는 이유와 함께 보고 바로 지원", shot("p13_case_card", show=[1], focus=True, aspect=2.6) + marks_list("먼저 볼 이유: <b>지원 요청 · 다음 현장 2곳 위험(최대 50분)</b> — 자동 계산") + shot("p1_field_hq", cls="mini") + marks_list("기사 휴대폰에 ‘숙련 기술자 30분 안에 도착’ 전달"))}
</div>
""",
)

# ═════ 06 문제 2 — 왜 ═════
pre_at = F["checks"].get("작업 전", {}).get("at", "-")
page(
    "PROBLEM 2",
    "안전점검 관리의 원인",
    f"""
<p class="kicker">04 / 문제 2 · 안전점검 누락 및 확인 지연</p>
<h2>안전은 ‘점검을 했는가’보다<br><em>제때 확인했는가.</em></h2>
<div class="trio">{photo("ai-pole")}{photo("ai-photo")}{photo("ai-hq")}</div>
<p class="lead">현장과 본사가 떨어져 있어 작업 전 · 중 · 후 상태를 같은 시각에 보기 어렵습니다. 문제는 점검이 없다는 것보다 <b>점검 시점 · 사진 · 관리자 확인이 따로 놀 수 있다</b>는 것입니다.</p>
<div class="flow4">
  <div><span>작업 전</span><b>장비 · 작업환경</b><p>‘작업 시작’ 전에 점검을 먼저 요청</p></div>
  <div><span>작업 중</span><b>진행 상태 · 추가 위험</b><p>예정의 절반쯤 ‘진행 중 점검 차례’ 표시</p></div>
  <div><span>작업 종료</span><b>마무리 · 사진</b><p>‘작업 종료’ 전에 마무리 점검 요청</p></div>
  <div class="hq"><span>본사 확인</span><b>사진 눈으로 확인</b><p>적합 · 보완 요청 · 조치 완료 이력</p></div>
</div>
{ba("현장마다 점검 시점이 다르고, 사진과 체크를 나중에 정리 → 미흡을 늦게 알고 조치 여부가 흐려짐", "점검을 <b>작업 단계 안에 넣고</b>, 미흡이면 즉시 작업 중지 안내 · 본사 1순위 표시 → 보완 → 조치 완료까지 <b>이력으로</b>")}
<div class="kv"><div><small>시작 전 점검</small><b>{pre_at}</b><span>착용 사진 포함</span></div><div><small>작업 시작</small><b>{F['started']}</b><span>점검 뒤에 기록</span></div><div><small>점검 시점</small><b>‘제때’</b><span>점검 시각 ≤ 작업 시작</span></div><div><small>사진 안 올라간 점검</small><b>제출로 안 셈</b><span>v0.6.1</span></div></div>
<p class="note"><b>중요한 한계</b> — 사진만으로 안전 적합성을 자동 판정하지 않습니다(관리자가 눈으로 확인). 위험하면 시스템을 기다리지 말고 작업을 멈추고 직접 연락하도록 화면마다 안내합니다. ‘제때 · 늦게 제출’은 기록 시각 비교이며 위반 판정이 아닙니다.</p>
""",
)

# ═════ 07 문제 2 — 해결 ═════
page(
    "SOLUTION 2",
    "점검이 먼저, 미흡은 끝까지",
    f"""
<p class="kicker">문제 2 · 이렇게 해결합니다</p>
<h2>점검 없이는 시작부터 묻고,<br><em>‘미흡’은 조치 완료까지 따라갑니다.</em></h2>
<div class="grid2">
  {stp(1, at('p2_gate_start'), "점검 없이 ‘작업 시작’을 누르면 먼저 묻습니다", shot("p2_gate_start", aspect=1.4) + marks_list("‘시작 전 안전점검을 먼저 보내 주세요’ — 그래도 시작하면 본사에 표시", "착용 사진과 함께 점검 → 그다음 작업 시작"))}
  {stp(2, at('p2_mid_deficient'), "‘미흡’이면 바로 작업 중지 안내", shot("p2_mid_deficient", aspect=1.4) + marks_list("‘프로그램 확인을 기다리지 말고 <b>작업을 멈추고 직접 전화</b>’"))}
  {stp(3, at('p2_admin_supp_req'), "본사 1순위에 뜨고, ‘적합’은 막힙니다", shot("p2_admin_dash_safety") + marks_list("대시보드 맨 앞 <b>‘안전 확인 필요(1순위)’</b>에 미흡") + shot("p2_admin_supp_req", show=[2, 3], focus=True, aspect=3.4) + marks_list("미흡이 있으면 ‘적합’ 버튼이 잠김", "<b>보완 요청</b>만 보낼 수 있음 (보완할 내용 입력)"))}
  {stp(4, at('p2_admin_stage3'), "보완 → 조치 완료 → 세 단계가 한 줄에", shot("p2_admin_stage3", focus=True, aspect=3.4) + marks_list("보령 지사: 시작 전 ‘적합’ · 진행 중 ‘조치 완료’ · 마친 뒤 ‘적합’") + shot("p2_admin_supp_done", focus=True, aspect=3.2) + marks_list("확인 이력: 보완 요청 → 보완 제출 → 조치 완료 (시각 · 입력자)"))}
</div>
""",
)

# ═════ 08 문제 3 — 왜 · 계산 원리 ═════
page(
    "PROBLEM 3 · CORE",
    "핵심 기술 — 다음 현장 지연 계산",
    f"""
<p class="kicker">05 / 문제 3 · 연속 현장 일정의 파급효과 — 특허와 연결되는 핵심 기술</p>
<h2>한 현장이 늦어지면,<br><em>왜 다음 현장도 흔들릴까?</em></h2>
<div class="feature">{photo("ai-van")}<div><small>문제가 생기는 구조</small><h3>종료시간이 바뀌면<br>도착 가능시간도 바뀝니다.</h3><p>같은 기사가 하루에 여러 현장을 갑니다. 앞 작업이 늦어지면 다음 현장 도착이 늦어지는데, 일정표는 이 연결을 보여 주지 않습니다. 그래서 <b>다음 고객에게 얼마나 일찍 연락할지</b> 판단이 늦어집니다.</p><span class="chip">연쇄 지연은 일부 사례만 확인 · 발생 빈도 미검증</span></div></div>
<h3 class="sec"><span>CALC</span>이 사례에서 프로그램이 한 계산 <span class="tag calc">자동 계산</span></h3>
<div class="calc">
  <div class="c"><small>보령 끝나는 예상</small><b>{F['new_end']}</b><span class="g">기사가 보고</span></div><i>+</i>
  <div class="c"><small>이동</small><b>20분</b></div><i>=</i>
  <div class="c dark"><small>홍성 도착 예상</small><b>{hm(140)}</b></div><i>vs</i>
  <div class="c"><small>홍성 원래 시작</small><b>{hm(90)}</b></div><i>→</i>
  <div class="c red"><small>늦음</small><b>50분</b><span>매우 높음</span></div>
</div>
<div class="calc">
  <div class="c"><small>홍성 끝나는 예상</small><b>{hm(200)}</b><span class="g">60분 작업 가정</span></div><i>+</i>
  <div class="c"><small>이동</small><b>25분</b></div><i>=</i>
  <div class="c dark"><small>예산 도착 예상</small><b>{hm(225)}</b></div><i>vs</i>
  <div class="c"><small>예산 원래 시작</small><b>{hm(180)}</b></div><i>→</i>
  <div class="c red"><small>늦음</small><b>45분</b><span>매우 높음</span></div>
</div>
<div class="two">
  <div class="box"><h4>위험 정도 (설정값 · 회사 기준으로 확정 예정)</h4><div class="grade"><span class="g0">여유 10분 이상<b>없음</b></span><span class="g1">여유 0~9분<b>주의</b></span><span class="g2">1~9분 늦음<b>중간</b></span><span class="g3">10~29분 늦음<b>높음</b></span><span class="g4">30분 이상 늦음<b>매우 높음</b></span></div></div>
  <div class="box soft"><h4>믿을 수 있는 계산인가</h4><ul class="dots"><li>입력된 기록과 정해진 규칙으로 계산 — <b>AI 예측이 아닙니다</b></li><li>같은 입력이면 언제 · 몇 번 계산해도 같은 결과</li><li>이 사례의 숫자는 자동 시험 9건으로 고정 (숫자가 바뀌면 시험이 실패)</li></ul></div>
</div>
""",
)

# ═════ 09 문제 3 — 해결 ① ═════
page(
    "SOLUTION 3-1",
    "보고 직후 — 다음 현장 2곳 자동 계산",
    f"""
<p class="kicker">문제 3 · 이렇게 해결합니다 ① — 기사가 예상 종료를 바꾸는 순간 ({F['reported']})</p>
<h2>‘보령이 늦는다’가 아니라<br><em>‘홍성 50분 · 예산 45분 늦는다’.</em></h2>
{shot("p3_chain_report")}
{marks_list("보령 지사 → 홍성 물류센터: <b>매우 높음 · 50분 늦음</b>", "홍성 물류센터 → 예산 매장: <b>매우 높음 · 45분 늦음</b> (앞 현장이 밀린 만큼 뒤도 밀림)", "아직 조치 전 — <b>남은 위험 2</b>")}
<div class="row2">
  <div>{shot("p13_admin_dash")}{marks_list("대시보드 ‘다음 현장 지연 위험’에 두 연결이 바로 올라옴")}</div>
  <div class="box"><h4>단순 기록과 다른 점</h4><p class="vs"><span class="tag">단순 기록</span>“보령 작업이 늦는다”는 사실만 남습니다. 다음 현장 영향은 사람이 따로 계산합니다.</p><p class="vs"><span class="tag teal">이 프로그램</span>“홍성 시작까지 50분 부족, 홍성을 늦추면 예산에도 영향이 남는다”는 <b>연결 결과를 바로 계산</b>합니다. 고객에게 언제 연락할지 근거가 생깁니다.</p></div>
</div>
""",
)

# ═════ 10 문제 3 — 해결 ② ═════
page(
    "SOLUTION 3-2",
    "조치하면 다시 계산 — 남은 위험까지",
    f"""
<p class="kicker">문제 3 · 이렇게 해결합니다 ② — 관리자가 일정을 바꿀 때마다 다시 계산</p>
<h2>조치할 때마다 다시 계산해,<br><em>남은 위험이 0이 될 때까지.</em></h2>
<div class="grid2">
  {stp(1, F['adjust1'], f"1차 조치 — 홍성 시작을 {hm(145)}로", shot("p3_adjust1_form", focus=True, aspect=2.4) + marks_list("조정할 일정: 홍성 물류센터", f"새 시작 {hm(145)} — 시스템이 정하지 않고 관리자가 넣은 값으로 다시 계산"))}
  {stp(2, F['adjust1'], "다시 계산 — 하나는 풀리고, 하나는 남음", shot("p3_adjust1_result") + '<p class="cap">보령→홍성은 풀렸지만 홍성을 늦춘 만큼 <b>예산 부족이 45분 → 50분으로 커짐</b>. 숨기지 않고 보여 줍니다.</p>' + shot("p3_adjust2_result") + f'<p class="cap"><b>2차 조치</b> — 예산 시작을 {hm(240)}로 → 그날 위험 1 → <b>0건</b></p>')}
</div>
{shot("p3_chain_after")}
{marks_list("보령 → 홍성: 50분 늦음 → <b>여유 5분</b> (주의)", "홍성 → 예산: 45분 늦음 → <b>여유 10분</b> (없음)", "<b>남은 위험 0</b> — 조치로 풀린 위험 2")}
<table class="mini"><thead><tr><th>연결</th><th>보고 직후</th><th>1차 조치 후</th><th>2차 조치 후</th></tr></thead><tbody>
<tr><td>보령 → 홍성</td><td class="r">50분 늦음</td><td>여유 5분 · 주의</td><td>여유 5분 · 주의</td></tr>
<tr><td>홍성 → 예산</td><td class="r">45분 늦음</td><td class="r">50분 늦음</td><td class="g">여유 10분 · 없음</td></tr></tbody></table>
""",
)

# ═════ 11 증거 ═════
page(
    "EVIDENCE",
    "확인된 것과 남은 것",
    f"""
<p class="kicker">06 / 증거가 있는 것과 없는 것을 나눠 적습니다</p>
<h2>지금 어디까지<br><em>만들고 확인했나.</em></h2>
<div class="big2"><div class="navy"><small>구현 상태</small><b>v0.6.1</b><span>현장기사 휴대폰 · 관리자 PC · 안전점검 · 문제 보고 · 다음 현장 지연 계산</span></div><div class="navy blue"><small>개발환경 자동 시험</small><b>746<i>개 통과</i></b><span>2026-11-18 저장소 기록 · 현장 검증 아님</span></div></div>
<table class="ev">
  <thead><tr><th>구분</th><th>이 자료에서 해당하는 것</th><th>상태</th></tr></thead>
  <tbody>
    <tr><td><b>실제 구현한 기능</b></td><td>이 자료의 모든 화면 — 안전점검 · 문제 보고 · 지원 처리 · 일정 조정 · 증빙</td><td><span class="ok">구현 · 화면 확인</span></td></tr>
    <tr><td><b>자동 계산 (규칙)</b></td><td>다음 현장 도착 · 위험 정도 · 먼저 볼 순서 · 다시 계산 · 중간 확인</td><td><span class="ok">구현 · 시험</span> 기준값은 초안</td></tr>
    <tr><td><b>가상 시나리오 시험</b></td><td>보령 → 홍성 → 예산 (자동 시험 9건 + 실제 실행 화면 {N_SHOTS}장)</td><td><span class="ok">완료</span></td></tr>
    <tr><td><b>실제 현장 실증</b></td><td>실제 직원 · 실제 휴대폰 · 실제 업무 기록</td><td><span class="no">0건 · 계획</span></td></tr>
    <tr><td><b>검증 전 효과</b></td><td>보고 · 지원 시간 단축, 고객 연락 앞당김, 원가 절감</td><td><span class="no">측정 전 · 수치 안 씀</span></td></tr>
  </tbody>
</table>
<div class="cards4">
  <div class="card"><small>특허</small><b class="big">출원 1건</b><p>10-2026-0173957<br>2026.09.11 · 등록 아님</p></div>
  <div class="card"><small>핵심 계산</small><b class="big">구현</b><p>다음 현장 도착 · 조치 후 다시 계산 (2026-10-28~)</p></div>
  <div class="card"><small>실행 화면</small><b class="big">{N_SHOTS}장</b><p>실제 프로그램 실행 · 시험용 가상 일정</p></div>
  <div class="card warn"><small>현장 성과</small><b class="big red">미확보</b><p>실제 사용 기록 · 시간 측정 — 단기 실증 예정</p></div>
</div>
<div class="timeline"><h4>개발 경과</h4><div><b>09.11</b><span>관련 특허 출원</span></div><div><b>10.28</b><span>다음 현장 지연 계산 구현</span></div><div><b>11.13</b><span>현장 책임자 인터뷰 반영</span></div><div><b>11.16</b><span>안전 1순위 · 중간 확인</span></div><div><b>11.18</b><span>v0.6.1 안정화 · 자체 시험</span></div><div><b>{meta['date'][5:].replace('-', '.')}</b><span>실행 화면 촬영</span></div></div>
<p class="note">출원 뒤 추가한 기능(문제 보고 · 안전점검 · 중간 확인 · v0.6.1)은 출원 당시부터 있던 것으로 쓰지 않습니다. 특허 기술구성과의 대응은 용어 대응이며 청구항 대조 결과가 아닙니다.</p>
""",
)

# ═════ 12 심사 답변 ═════
page(
    "REVIEW RESPONSE",
    "보완사유별 답변",
    f"""
<p class="kicker">07 / 심사 의견에 화면으로 답합니다</p>
<h2>심사위원의 질문에<br><em>한 줄로, 화면으로.</em></h2>
<p class="fill">※ 아래 ‘지적’ 문장은 예시입니다. 결과 통지서의 보완 사유 문장을 그대로 옮겨 넣으세요.</p>
<div class="qa">
  <div class="card"><small>지적 1 (예시)</small><h4>“무슨 기술인지 명확하지 않다.”</h4><p>현장 기록(예상 종료)을 받아 <b>다음 현장에 몇 분 늦는지 자동 계산</b>하고 먼저 할 일을 정합니다. → <b>2쪽 한 장 그림 · 9쪽</b></p></div>
  <div class="card"><small>지적 2 (예시)</small><h4>“차별성이 잘 보이지 않는다.”</h4><p>기록 공유에서 그치지 않고 앞 · 뒤 현장을 이어 <b>부족 시간을 계산하고, 조치하면 다시 계산</b>합니다. → <b>9 · 10쪽</b></p></div>
  <div class="card"><small>지적 3 (예시)</small><h4>“구현 · 시험 근거가 부족하다.”</h4><p>실제 실행 화면 {N_SHOTS}장, 자동 시험 746개, 핵심 계산 시험 9건. 현장 실증과는 구분해 적었습니다. → <b>11쪽</b></p></div>
  <div class="card"><small>지적 4 (예시)</small><h4>“개발 가능성이 불명확하다.”</h4><p>세 문제를 다루는 절차가 이미 동작합니다. 남은 것은 운영 서버 연결과 현장 실증이며 단계별로 진행합니다. → <b>아래</b></p></div>
</div>
<h3 class="sec"><span>NEXT</span>짧은 기간에 확보할 실제 증거 — 기록을 꾸미지 않고 구분해 남깁니다</h3>
<div class="next">
  <div>{photo("ai-stuck")}<div><b>1</b><h4>실제 현장 문제 1~3건 확인</h4><p>현장 책임자와 최근 사례를 확인하고 원본 작업일지 · 메신저 · 사진을 확보합니다.</p><span>구분: 과거 사례 사실 확인</span></div></div>
  <div>{photo("ai-tablet")}<div><b>2</b><h4>실제 기기로 사용</h4><p>운영 서버 연결 뒤 관리자 PC · 기사 휴대폰으로 이 자료의 흐름을 그대로 실행하고 기록을 남깁니다.</p><span>구분: 실제 기기 연동 시험</span></div></div>
  <div>{photo("ai-map")}<div><b>3</b><h4>실제 업무 1건 이상 기록</h4><p>실제 작업에서 안전점검 · 문제 보고 · 지원 결정 · 일정 조정을 기록하고, 계산 결과를 실무 책임자가 확인합니다.</p><span>구분: 실제 업무 (가장 강한 증거)</span></div></div>
</div>
<div class="navy msg"><small>핵심 메시지</small><p>“여러 현장의 지연 위험을 계산하고 관리자 대응을 돕는 핵심기술을 구현했습니다. 세 가지 현장 문제를 다루는 절차가 실제 프로그램에서 동작함을 화면으로 확인했고, 현장 적용으로 판단 기준과 업무 효과를 검증하겠습니다.”</p></div>
""",
)

# ═════ 부록 A — 증빙 ═════
page(
    "APPENDIX A",
    "기록이 그대로 증빙이 됩니다",
    f"""
<p class="kicker">부록 A / 사건 하나 = 문제 보고 → 자동 계산 → 관리자 조치 → 조치 전후</p>
<h2>화면에서 한 일이<br><em>그대로 증빙으로 남습니다.</em></h2>
{shot("ev_case_print", who=f"관리자 PC · 사건 증빙 {F['case_no']}")}
<div class="two">
  <div class="box soft"><h4>무엇이 남나</h4><ul class="dots">
    <li>시각 3가지를 따로: 누른 시각 · 서버 기록 시각 · 나중에 입력한 시각</li>
    <li>입력자 · 출처(현장 직원 / 관리자 대리 보고) · 프로그램 버전</li>
    <li>고치지 않고 추가만 — 정정 · 무효도 기록으로 남김</li>
    <li>같은 요청은 한 번만 저장 · 계산마다 입력 · 결과 · 규칙 버전 저장</li></ul></div>
  <div class="box"><h4>현장 실증에서 모을 핵심 지표 (같은 정의로)</h4><ol class="num">
    <li>문제 발견 → 보고 시간</li><li>보고 → 지원 결정 시간</li><li>다음 현장 지연을 미리 안 시간 (계산 시점 → 실제 도착)</li><li>안전점검 제때 제출 비율 · 관리자 확인 소요시간</li></ol></div>
</div>
<p class="note">개선율 · 원가 절감액은 실제 비교 기록이 생기기 전에는 쓰지 않습니다. 인쇄(PDF) · CSV · JSON으로 내보내며, 맨 위에 자료 구분(가상 시나리오)이 자동 표기됩니다.</p>
""",
)

# ═════ 부록 B — 용어 ═════
page(
    "APPENDIX B",
    "쉬운 용어 풀이",
    """
<p class="kicker">부록 B / 화면과 이 자료에 나오는 말</p>
<h2>처음 보시는 분을 위한<br><em>용어 풀이.</em></h2>
<table class="gl"><tbody>
<tr><th>자동 계산</th><td>입력된 기록(예정 시각 · 이동시간 · 작업 시작 · 예상 종료)과 정해진 규칙으로 계산합니다. 학습하는 AI가 아닙니다. 같은 입력이면 같은 결과가 나옵니다. 화면에는 ‘엔진 판단 · 계산값’으로 표시됩니다.</td></tr>
<tr><th>예상 종료</th><td>지금 현장이 끝날 것으로 보이는 시각. 기사가 보고하면 그 값을, 보고가 없으면 ‘예정 작업시간만큼 걸린다’고 보고 계산합니다.</td></tr>
<tr><th>다음 현장 지연</th><td>앞 현장 예상 종료 + 이동시간이 다음 현장 시작보다 늦는 것. 화면에는 ‘후속 현장 위험 · 연쇄 위험’으로도 표시됩니다.</td></tr>
<tr><th>여유 · 늦음</th><td>다음 현장 시작까지 남는 분(여유) 또는 모자라는 분(늦음). 계산값이며 실제 도착 시각이 아닙니다.</td></tr>
<tr><th>위험 정도</th><td>여유 10분 이상 없음 · 여유 0~9분 주의 · 1~9분 늦음 중간 · 10~29분 높음 · 30분 이상 매우 높음 (회사 기준으로 확정할 설정값).</td></tr>
<tr><th>다시 계산</th><td>관리자가 일정을 바꾸거나 예상 종료를 고치면 그 값으로 다시 계산하고, 풀린 위험과 남은 위험을 따로 보여 줍니다. 화면에는 ‘재판단’으로 표시됩니다.</td></tr>
<tr><th>중간 확인</th><td>예정 작업시간의 절반(최소 20분)이 지났는데 진행 보고가 없으면 휴대폰과 본사에 뜨는 표시 (초안 기준).</td></tr>
<tr><th>예정 넘김</th><td>예상 종료를 지났는데 새 보고가 없으면 뜨는 표시.</td></tr>
<tr><th>안전점검 3단계</th><td>작업 전 · 작업 중 · 작업 종료. 사진이 실제로 올라간 점검만 낸 것으로 셉니다. 적합 여부는 관리자가 눈으로 확인합니다.</td></tr>
<tr><th>자동 갱신</th><td>10~15초마다 새 기록이 있는지 확인해 화면을 바꿉니다. 실시간 감시가 아니며, 연결이 끊기면 화면에 표시합니다.</td></tr>
<tr><th>자료 구분</th><td>실제 업무 / 현장정보 재현(원자료 있을 때) / 가상 시나리오. 서로 섞이지 않고, 증빙에 자동 표기됩니다. 이 자료는 가상 시나리오입니다.</td></tr>
</tbody></table>
""",
)

CSS = (HERE / "style.css").read_text()
html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>하나정보통신 이의신청 보완자료 (샘플)</title><style>{CSS}</style></head><body>{''.join(pages)}</body></html>"""
(HERE / "appeal.html").write_text(html)
print("pages", len(pages), "images", len(list(IMG.glob("*.jpg"))))
