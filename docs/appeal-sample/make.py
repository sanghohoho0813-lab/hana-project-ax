"""이의신청 보완자료(샘플) HTML 만들기 — 실제 프로그램 화면(tests-pilot/e2e/appeal-shots.mjs 촬영) + 참고 PDF의 AI 연출 사진.

실행: python3 docs/appeal-sample/make.py <촬영 폴더> <사진 폴더>
  - 촬영 폴더: steps.json · facts.json · *.jpg (appeal-shots.mjs 결과)
  - 사진 폴더: 참고 PDF에서 뽑은 연출 사진 (ai-*.jpg)
결과: docs/appeal-sample/appeal.html · docs/appeal-sample/img/*.jpg  →  node docs/appeal-sample/render.mjs 로 PDF
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
IMG.mkdir(exist_ok=True)

meta = json.loads((SHOTS / "steps.json").read_text())
facts = json.loads((SHOTS / "facts.json").read_text())
STEPS = {s["id"]: s for s in meta["steps"]}


def hm(m: int) -> str:
    """P(보령 예정 시작) + m분 → HH:MM"""
    h, mi = map(int, meta["P"].split(":"))
    t = h * 60 + mi + m
    return f"{t // 60:02d}:{t % 60:02d}"


def at(i: str) -> str:
    return STEPS[i]["at"][:5]


# 화면 자르기 (원본 px: PC 2160×1350 · 휴대폰 780×1688). None = 전체
CROPS = {
    "setup_board": (470, 255, 1580, 870),
    "p1_admin_watch": (1250, 440, 790, 450),
    "p13_case_card": (470, 190, 1580, 1070),
    "p1_admin_support": (480, 310, 1560, 570),
    "p3_chain_report": (500, 300, 1480, 580),
    "p3_chain_after": (500, 300, 1480, 580),
    "p3_adjust1_form": (480, 235, 1560, 630),
    "p3_adjust1_result": (470, 530, 1580, 650),
    "p3_adjust2_result": (470, 530, 1580, 650),
    "p2_admin_review": (480, 665, 1560, 660),
    "p2_admin_stage1": (480, 375, 1560, 380),
    "p2_admin_dash_safety": (470, 300, 1580, 520),
    "p2_admin_supp_req": (480, 310, 1560, 700),
    "p2_admin_supp_done": (480, 280, 1560, 770),
    "p2_admin_stage3": (480, 130, 1560, 400),
    "ev_case_print": (500, 140, 1480, 1000),
    "p13_admin_dash": (1440, 1110, 620, 440),
    "p3_field_next": (0, 0, 780, 1120),
}
CROPS.update(facts.get("crops", {}))


def shot(i: str) -> str:
    """잘라서 img/ 에 두고 상대 경로를 돌려준다"""
    src = SHOTS / STEPS[i]["img"]
    out = IMG / f"{i}.jpg"
    c = CROPS.get(i)
    phone = STEPS[i]["device"] == "phone"
    args = ["convert", str(src)]
    if c:
        args += ["-crop", f"{c[2]}x{c[3]}+{c[0]}+{c[1]}", "+repage"]
    args += ["-resize", "640x>" if phone else "1600x>", "-quality", "84", str(out)]
    subprocess.run(args, check=True)
    return f"img/{i}.jpg"


def photo(name: str) -> str:
    out = IMG / f"{name}.jpg"
    shutil.copy(PHOTOS / f"{name}.jpg", out)
    return f"img/{name}.jpg"


# ── 조각 ─────────────────────────────────────────────
TAG_REAL = '<span class="tag real">실제 화면</span>'
TAG_AI = '<span class="tag ai">AI 연출 사진</span>'


def pc(i: str, cap: str, who: str = "관리자 PC") -> str:
    return f"""<figure class="pc"><div class="bar">{TAG_REAL}<b>{who}</b><span>{at(i)}</span></div><img src="{shot(i)}" alt=""><figcaption>{cap}</figcaption></figure>"""


def phone(i: str, cap: str, n: str = "") -> str:
    num = f'<span class="num">{n}</span>' if n else ""
    return f"""<figure class="phone"><div class="bezel"><img src="{shot(i)}" alt=""></div><figcaption>{num}<span class="t">{at(i)} · 기사 휴대폰</span>{cap}</figcaption></figure>"""


def pic(name: str, cap: str = "", cls: str = "") -> str:
    c = f"<figcaption>{cap}</figcaption>" if cap else ""
    return f"""<figure class="pic {cls}"><img src="{photo(name)}" alt="">{TAG_AI}{c}</figure>"""


def thumb(i: str, pos: str = "50% 50%", fit: str = "cover") -> str:
    shot(i)
    return f"""<div class="thumb"><img src="img/{i}.jpg" style="object-position:{pos};object-fit:{fit}" alt="">{TAG_REAL}</div>"""


def thumb_crop(src: str, c: tuple, name: str) -> str:
    """요지 쪽 작은 화면 — 원본에서 따로 잘라 쓴다"""
    out = IMG / f"{name}.jpg"
    subprocess.run(["convert", str(SHOTS / STEPS[src]["img"]), "-crop", f"{c[2]}x{c[3]}+{c[0]}+{c[1]}", "+repage", "-resize", "900x>", "-quality", "86", str(out)], check=True)
    return f"""<div class="thumb"><img src="img/{name}.jpg" style="object-fit:contain;padding:2mm;background:#fff" alt="">{TAG_REAL}</div>"""


def step(n: str, title: str, desc: str = "", cls: str = "") -> str:
    d = f"<p>{desc}</p>" if desc else ""
    return f"""<div class="step {cls}"><span class="n">{n}</span><div><h4>{title}</h4>{d}</div></div>"""


pages: list[str] = []


def page(left: str, right: str, body: str) -> None:
    n = len(pages) + 1
    pages.append(
        f"""<section class="page">
  <header><div class="logo"><span class="mark">H<i></i></span><div><b>하나정보통신</b><small>HANA INFORMATION &amp; COMMUNICATION</small></div></div><span class="ref">VENTURE APPEAL / 2026.11</span></header>
  <div class="rule"><span>{left}</span><b>{right}</b></div>
  <main>{body}</main>
  <footer><span>검토용 샘플 · AI 연출 사진과 실제 프로그램 화면을 구분 표기 · 화면은 개발환경의 가상 시나리오 데이터</span><b>HANA / {n:02d}</b></footer>
</section>"""
    )


F = facts
S = {"A": "보령 지사", "B": "홍성 물류센터", "C": "예산 매장"}

# ═════ 01 표지 ═════
pages.append(
    f"""<section class="page cover">
  <header><div class="logo"><span class="mark">H<i></i></span><div><b>하나정보통신</b><small>HANA INFORMATION &amp; COMMUNICATION</small></div></div><span class="pill">벤처기업확인 이의신청 · 보완자료 (샘플)</span></header>
  <main>
    <p class="eyebrow">THREE FIELD PROBLEMS · ONE WORKING PROGRAM</p>
    <h1>현장에서 생긴 문제가<br><em>다음 현장까지 번지기 전에.</em></h1>
    <p class="lead">현장 문제 세 가지를 <b>실제로 개발한 프로그램</b>이 어떤 절차로 해결하는지, <b>현장기사 휴대폰과 관리자 PC 화면</b>으로 순서대로 보여 드립니다.</p>
    <div class="trio">{pic("ai-stuck", "")}{pic("ai-hq", "")}{pic("ai-van", "")}</div>
    <div class="navy one"><small>핵심 기술 · 한 문장</small><p>현장 상태의 변화를 받아, 후속 현장의 지연 위험을 계산하고, 관리자의 대응 순서를 정하는 기술</p></div>
    <div class="facts3">
      <div><small>신청기술</small><b>복수 현장 업무 위험관리 AX 시스템</b></div>
      <div><small>관련 특허</small><b>10-2026-0173957</b><span>2026.09.11 출원 · 등록 아님</span></div>
      <div><small>프로그램</small><b>v0.6.1 · 현장기사 모바일 + 관리자 PC</b><span>화면 촬영 2026.11.21</span></div>
    </div>
    <p class="fine">사진은 AI 생성 연출 이미지입니다. 화면은 실제 개발한 프로그램을 개발환경(로컬 서버·DB)에서 가상 시나리오로 실행해 촬영했습니다. 실제 현장 성과가 아닙니다.</p>
  </main>
  <footer><span>검토용 샘플 · AI 연출 사진과 실제 프로그램 화면을 구분 표기</span><b>HANA / 01</b></footer>
</section>"""
)

# ═════ 02 요지 ═════
page(
    "SUMMARY",
    "보완 요지",
    f"""
<p class="kicker">01 / 세 가지 현장 문제 → 프로그램 절차 → 확인할 화면</p>
<h2>세 문제를, 프로그램은<br><em>이 순서로 다룹니다.</em></h2>
<p class="lead">2026년 11월 현장 책임자 인터뷰에서 나온 핵심은 ‘현장의 상태가 본사에 늦게 전달된다’는 점입니다. 아래 세 문제를 각각 <b>누가 · 무엇을 누르면 · 무엇이 바뀌는지</b> 실제 화면으로 이어서 보여 드립니다.</p>
<div class="probs">
  <article>{thumb("p1_field_ask", "50% 76%")}<span class="pno">01</span><h3>초급 기술자가 오래 붙잡는 문제</h3><p class="why">예상과 다른 설치환경을 만나도 혼자 해결하려다 본사 연락이 늦어집니다.</p>
    <ol><li><b>보고가 없어도</b> 30분째(예정 소요의 절반)에 휴대폰과 본사 화면에 ‘중간 확인’</li><li>‘막혔어요’ → <b>터치 6단계</b> 보고 (발견·보고 시각 따로 기록)</li><li>본사 <b>우선 확인 → 지원 결정 → 현장 전달</b>이 기사 휴대폰까지</li></ol><p class="go">화면 4~7쪽</p></article>
  <article>{thumb("p2_mid_deficient", "50% 40%")}<span class="pno">02</span><h3>안전확인이 뒤늦게 이루어짐</h3><p class="why">작업 전·중·후 점검과 사진이 늦게 정리되면 누락·미흡을 제때 알기 어렵습니다.</p>
    <ol><li>점검 없이 <b>작업 시작 · 종료</b>를 누르면 먼저 점검을 요청</li><li>‘미흡’이면 즉시 <b>작업 중지 · 직접 전화</b> 안내 + 본사 1순위 표시</li><li>관리자 <b>사진 육안 확인 → 보완 요청 → 조치 완료</b> 이력</li></ol><p class="go">화면 8~11쪽</p></article>
  <article>{thumb_crop("p13_admin_dash", (1460, 1125, 590, 270), "thumb3")}<span class="pno">03</span><h3>앞 현장 지연이 다음 현장으로 전파</h3><p class="why">한 곳이 늦어지면 같은 기사가 갈 다음 현장의 도착 가능 시간도 바뀝니다.</p>
    <ol><li>바뀐 예상 종료 + 이동시간으로 <b>다음 현장 도착</b>을 계산</li><li>홍성 <b>50분</b> · 예산 <b>45분 부족</b>을 바로 표시 (계산값)</li><li>일정 조정마다 <b>다시 판단</b> → 남은 위험 0까지 확인</li></ol><p class="go">화면 12~14쪽</p></article>
</div>
<div class="legend"><b>이 자료의 표시</b>{TAG_REAL}<span>개발한 프로그램을 실제로 실행해 찍은 화면</span>{TAG_AI}<span>분위기 전달용 생성 이미지</span><span class="tag calc">계산값</span><span>규칙 기반 판단엔진 결과 (AI 예측 아님)</span><span class="tag virt">가상 시나리오</span><span>시험용 일정·인물·사진</span></div>
""",
)

# ═════ 03 시험 사례 ═════
tl = [
    (at("p2_pre_check"), "시작 전 안전점검 (착용 사진)", "2"),
    (at("p2_started"), "작업 시작", "2"),
    (at("p1_field_ask") if "p1_field_ask" in STEPS else "-", "30분째 진행 보고 없음 → 중간 확인", "1"),
    (F["reported"], "문제 보고 · 숙련 기술자 지원 요청 (발견 " + F["discovered"] + ")", "1"),
    (F["decided"], "본사 접수 → 지원 결정 → 현장 전달", "1"),
    (F["adjust1"], "1차 조치: 홍성 일정 조정 → 재판단", "3"),
    (F["adjust2"], "2차 조치: 예산 일정 조정 → 재판단", "3"),
    (at("p2_mid_deficient"), "진행 중 점검 ‘미흡’ → 보완 요청 → 조치 완료", "2"),
    (at("p2_ended"), "마무리 점검 → 작업 종료 → 해결 확인", "2"),
]
tl_html = "".join(f'<li><time>{t}</time><span class="p p{p}">문제 {p}</span>{escape(x)}</li>' for t, x, p in tl)
page(
    "TEST CASE",
    "한 사례로 세 문제를 끝까지",
    f"""
<p class="kicker">02 / 시험 사례 — 김현장 기사의 하루 3곳</p>
<h2>하나의 사례로<br><em>세 문제를 끝까지 따라갑니다.</em></h2>
<div class="sites">
  <div><small>앞 현장 A</small><b>{S['A']}</b><span>{hm(0)} ~ {hm(60)}</span></div><i>이동 20분 →</i>
  <div><small>다음 현장 B</small><b>{S['B']}</b><span>{hm(90)} ~ {hm(150)}</span></div><i>이동 25분 →</i>
  <div><small>그다음 현장 C</small><b>{S['C']}</b><span>{hm(180)} ~ {hm(230)}</span></div>
</div>
{pc("setup_board", "관리자 ‘현장·일정’에서 기사 · 현장 · 예정 시각 · 이동시간을 등록합니다. 등록할 때마다 판단엔진이 다음 현장 도착을 계산합니다(이 시점: 위험 0건 — 보령→홍성 여유 10분, 홍성→예산 여유 5분 ‘주의’).")}
<div class="two">
  <div class="box"><h4>실제 진행 순서 (화면 촬영 시각)</h4><ol class="tl">{tl_html}</ol></div>
  <div class="box soft"><h4>촬영 조건 — 그대로 밝힙니다</h4><ul class="dots">
    <li>개발환경(로컬 서버 · 로컬 DB)에서 <b>실제 프로그램</b>을 실행해 찍었습니다. 화면을 꾸미거나 합성하지 않았습니다.</li>
    <li>관리자 PC(1440×900)와 기사 휴대폰(390×844)은 <b>같은 컴퓨터의 별도 브라우저 세션</b>입니다. 실제 휴대폰 시험은 Supabase 연결 뒤 진행합니다.</li>
    <li>자료 구분은 <b>‘검증 시나리오(가상)’</b>, 인물·현장·사진(‘시험용 이미지’)은 시험용입니다.</li>
    <li>화면 시각은 촬영한 실제 시각입니다. 일정 간격·이동시간이 핵심 사례(09:00 기준)와 같아 계산 결과(50분·45분 부족)도 같습니다.</li>
    <li>‘중간 확인’은 실제로 30분을 기다려 찍었습니다.</li></ul></div>
</div>
""",
)

# ═════ 04 문제 1 정의 ═════
page(
    "DEEP DIVE 01",
    "왜 보고가 늦어지는가",
    f"""
<p class="kicker">03 / 문제 1 · 초급 기술자 지원 지연</p>
<h2>왜 현장기사는<br><em>혼자 오래 붙잡을까?</em></h2>
<p class="lead">직원의 능력 부족이 아니라, <b>예상하지 못한 설치 상황에서 누구에게 · 언제 · 어떤 지원을 요청해야 하는지 분명하지 않은 운영 구조</b>가 문제입니다.</p>
<div class="feature">{pic("ai-stuck", "")}<div><small>현장 인터뷰(2026-11-13)에서 확인한 상황</small><h3>장비를 열어 보니<br>예상과 다른 조건.</h3><p>혼자 원인을 찾다가 시간이 흐른 뒤에야 본사에 연락하는 경우가 있었습니다. 본사가 일찍 알았다면 숙련자를 보내거나 원격으로 도울 수 있었다는 의견도 확인했습니다.</p></div></div>
<h3 class="sec"><span>WHY</span>지연이 커지는 세 단계</h3>
<div class="cols3">
  <div class="card"><b class="big">01</b><h4>예상 밖의 작업조건</h4><p>분해·설치 뒤에야 설비·연결 조건이 계획과 다르다는 사실이 드러납니다.</p></div>
  <div class="card"><b class="big">02</b><h4>보고 시점의 불확실성</h4><p>스스로 해결할 수 있는지 판단하다 보고를 미룹니다. 본사는 막힌 사실을 모릅니다.</p></div>
  <div class="card"><b class="big">03</b><h4>지원 결정까지 추가 대기</h4><p>본사가 뒤늦게 상황을 듣고 숙련자·장비·다음 일정을 다시 확인합니다.</p></div>
</div>
<h3 class="sec"><span>HOW</span>프로그램이 바꾸는 절차 — 다음 3쪽에서 화면으로</h3>
<div class="flow">
  {step("1", "보고가 없어도 먼저 묻기", "예정 소요의 절반(최소 20분)이 지나도 진행 보고가 없으면 휴대폰·본사 화면에 ‘중간 확인’")}
  {step("2", "터치 6단계로 바로 보고", "유형 → 상태·발견시각 → 필요한 지원 → 바뀐 예상 종료 → 사진 → 보내기")}
  {step("3", "본사 우선 확인", "지원 요청 · 후속 현장 위험(계산값)으로 먼저 볼 사건을 위에 올림")}
  {step("4", "지원 결정 · 현장 전달", "접수 → 지원 결정(숙련 직원 투입) → 기사 휴대폰에 ‘본사에서 온 소식’")}
</div>
<p class="note">기록되는 시각: 문제 발견 · 보고(기기 시각) · 서버 기록 · 접수 · 지원 결정 · 현장 전달. 실제 현장에서 ‘발견 → 보고’, ‘보고 → 지원 결정’ 시간을 이 기록으로 잽니다. 중간 확인 기준(절반 · 20분)은 초안이며 회사 운영 기준으로 확정합니다.</p>
""",
)

# ═════ 05 문제 1 — STEP 1 ═════
page(
    "PROCEDURE 01-1",
    "보고가 없어도 시스템이 먼저 묻는다",
    f"""
<p class="kicker">문제 1 · STEP 1 — {at('p1_field_ask')} (작업 시작 {at('p2_started')} + 30분)</p>
<h2>30분째 연락이 없으면,<br><em>휴대폰과 본사가 동시에 압니다.</em></h2>
<div class="row ph-pc big">
  {phone("p1_field_ask", "<b>‘작업 시작 30분째예요 — 예정대로 되고 있나요?’</b> 버튼 세 개: <b>막혔어요(지원 요청)</b> · 예정대로 · 늦어져요. 같은 때 안전점검 칸에 ‘진행 중 점검 차례’도 표시됩니다.", "1-1")}
  <div class="stack">
    {pc("p1_admin_watch", "<b>관리자 대시보드 ‘연락 없이 늦어지는 현장(공동 1순위)’</b> — 보령 지사 ‘중간 확인 · 진행 보고 없음’. 본사는 기사의 연락을 기다리지 않고 먼저 전화할 수 있습니다.")}
    <div class="box soft"><h4>판단 규칙 (규칙 기반 · AI 예측 아님)</h4><ul class="dots">
      <li><b>중간 확인</b>: 예정 소요시간의 절반(최소 20분)이 지났는데 작업 시작 뒤 진행 보고가 없음</li>
      <li><b>예정 넘김</b>: 예상 종료를 지났는데 새 예상 종료도 문제 보고도 없음</li>
      <li><b>지원 중</b>: 처리 중인 문제 보고가 있으면 목록에서 빠짐 (본사가 이미 앎)</li>
      <li>이미 있는 기록(작업 시작·예상 종료 보고·문제 보고)만 봅니다. 기준 분은 초안입니다.</li></ul></div>
  </div>
</div>
<div class="kv"><div><small>작업 시작</small><b>{F['started']}</b><span>시작 전 점검 뒤</span></div><div><small>중간 확인 시각</small><b>{at('p1_field_ask')}</b><span>예정 60분의 절반</span></div><div><small>그동안 진행 보고</small><b>없음</b><span>기사도 본사도 연락 전</span></div><div><small>기사 응답</small><b>‘막혔어요’ {F['reported']}</b><span>→ 바로 문제 보고 (다음 쪽)</span></div></div>
<p class="note">관리자 화면의 ‘전화 확인 → 대리 보고’로 본사가 먼저 전화해 받은 내용을 대신 기록할 수도 있습니다(출처: 관리자 대리 보고로 구분). 실제로 30분을 기다려 찍은 화면입니다.</p>
""",
)

# ═════ 06 문제 1 — STEP 2 보고 ═════
page(
    "PROCEDURE 01-2",
    "막혔어요 → 터치 6단계 보고",
    f"""
<p class="kicker">문제 1 · STEP 2 — 글자 입력 없이 고르기만 합니다</p>
<h2>‘막혔어요’ 한 번이면<br><em>보고가 바로 열립니다.</em></h2>
<div class="row phones4">
  {phone("p1_report_type", "<b>① 유형</b> — ‘예상과 다른 설치환경’. 맨 위 막대가 6단계 중 어디인지 보여 줍니다.", "2-1")}
  {phone("p1_report_state", "<b>② 지금 상태 · 발견 시각</b> — ‘분해·설치 시작 후’, 처음 발견 ‘10분 전’. 발견과 보고 시각을 따로 남깁니다.", "2-2")}
  {phone("p1_report_need_end", "<b>③ 지원 · ④ 예상 종료</b> — ‘숙련 기술자 지원’, ‘+1시간’. <b>‘이 값으로 다음 현장 도착·위험을 다시 계산’</b> 안내가 바로 뜹니다.", "2-3")}
  {phone("p1_report_sent", f"<b>⑥ 보고 완료</b> — 사건번호 {F['case_no']} · ‘본사 확인 전’. ⑤ 사진은 촬영정보(위치 등)를 지우고 비공개로 저장합니다.", "2-4")}
</div>
<div class="kv"><div><small>문제 발견</small><b>{F['discovered']}</b><span>현장 직원 진술</span></div><div><small>보고(누른 시각)</small><b>{F['reported']}</b><span>즉시 기록</span></div><div><small>발견 → 보고</small><b>{F['disc_to_report']}</b><span>이 시험 기록</span></div><div><small>바뀐 예상 종료</small><b>{F['new_end']}</b><span>예정 {hm(60)} + 1시간</span></div></div>
<div class="two">
  <div class="box"><h4>보고 방식이 이렇게 바뀝니다</h4><p class="vs"><span class="tag">기존</span>혼자 해결을 시도 → 늦게 전화 → 말로 설명 → 본사가 받아 적고 다음 일정을 따로 계산</p><p class="vs"><span class="tag teal">프로그램</span>막히면 바로 ‘막혔어요’ → 고르기만 하는 6단계 → 발견·보고 시각 자동 기록 → 바뀐 예상 종료로 다음 현장 계산</p></div>
  <div class="box soft"><h4>이 보고 한 건에 남는 것</h4><ul class="dots"><li>문제 유형 · 진행상황 · 요청 지원 · 긴급 여부 · 사진(촬영정보 제거)</li><li>발견 시각(진술) · 보고 시각(누른 시각) · 서버 기록 시각</li><li>바뀐 예상 종료 → ‘예상 종료 보고’ 1건으로 엔진 입력</li><li>사건번호 · 입력자 · 프로그램 버전</li></ul></div>
</div>
<p class="note">끊긴 곳에서 보내면 ‘다시 보내기’가 나오고, 같은 요청 번호로 보내 한 건만 저장됩니다(자동 시험으로 확인). 이 쪽의 시간은 가상 시나리오 시험 기록이며 실제 현장 측정값이 아닙니다.</p>
""",
)

# ═════ 07 문제 1 — STEP 3~4 본사 ═════
page(
    "PROCEDURE 01-3",
    "본사 우선 확인 → 지원 결정 → 현장 전달",
    f"""
<p class="kicker">문제 1 · STEP 3~4 — 본사가 먼저 볼 일을 위로, 결정은 기사 휴대폰까지</p>
<h2>본사는 무엇을 먼저 할지<br><em>이유와 함께 봅니다.</em></h2>
{pc("p13_case_card", f"<b>문제·지원 — 사건 카드</b>. 우선 확인 이유: <b>지원 요청(숙련 기술자) · 후속 현장 2곳 위험(최대 50분 늦음, 계산값)</b>. 발견·보고 시각, 바뀐 예상 종료로 엔진이 다시 판단한 결과, 다음 조치가 한 카드에 있습니다.")}
<div class="row pc-ph">
  {pc("p1_admin_support", "<b>접수 → 지원 결정</b> — ‘숙련 직원 투입’을 고르고 기록. 조치마다 누가·언제 했는지 이력에 쌓입니다(지우지 않음).")}
  {phone("p1_field_hq", "<b>기사 휴대폰 ‘본사에서 온 소식’</b> — 본사 지원 결정과 현장 전달(‘숙련 기술자가 30분 안에 도착합니다…’)이 자동 갱신으로 도착.", "3")}
</div>
<div class="kv"><div><small>보고 → 접수</small><b>{F['report_to_ack']}</b><span>이 시험 기록</span></div><div><small>접수 → 지원 결정</small><b>{F['ack_to_decide']}</b><span>이 시험 기록</span></div><div><small>지원 결정 → 현장 전달</small><b>{F['decide_to_deliver']}</b><span>이 시험 기록</span></div><div><small>우선 확인 순서</small><b>안전 → 긴급 → 미접수 → 지원 요청 → 후속 위험</b><span>규칙</span></div></div>
<p class="note">위 소요시간은 프로그램을 자동으로 조작한 시험이라 초 단위입니다. 실제 업무에서는 같은 항목을 같은 방식으로 기록해 비교합니다. 자동 갱신은 10~15초 주기 확인이며 실시간 감시가 아닙니다.</p>
""",
)

# ═════ 08 문제 2 정의 ═════
page(
    "DEEP DIVE 02",
    "안전점검 관리의 원인과 해법",
    f"""
<p class="kicker">04 / 문제 2 · 안전점검 누락 및 확인 지연</p>
<h2>안전은 ‘점검을 했는가’보다<br><em>제때 확인했는가.</em></h2>
<p class="lead">현장과 본사가 떨어져 있어 작업 전·중·후 상태를 같은 시각에 확인하기 어렵습니다. 문제는 점검 자체의 부재라기보다 <b>점검 시점 · 사진 · 관리자 확인의 연결이 느슨해질 수 있다</b>는 것입니다.</p>
<div class="trio">{pic("ai-pole", "")}{pic("ai-photo", "")}{pic("ai-hq", "")}</div>
<div class="two">
  <div class="box"><h4>기존 업무에서 생길 수 있는 틈</h4><ol class="num"><li>현장마다 작업 착수·종료 시점이 달라 본사가 직접 보지 못합니다.</li><li>사진이나 체크를 나중에 정리하면 어느 단계에서 점검했는지 알기 어렵습니다.</li><li>미흡 항목을 발견해도 보완 요청·재확인 이력이 이어지지 않으면 조치 상황이 흐려집니다.</li></ol></div>
  <div class="box teal"><h4>지금 구현된 처리 방식</h4><ol class="num"><li>작업 시작·종료 전에 그 단계 점검을 먼저 요청하고, 점검 없이 진행하면 본사에 표시합니다.</li><li>작업 전·중·후 사진과 제출 시각을 남겨 누락·늦은 제출을 구분합니다. 사진이 실제로 올라간 점검만 제출로 셉니다(v0.6.1).</li><li>관리자가 사진을 눈으로 확인하고, 미흡하면 보완을 요청·기록합니다.</li></ol></div>
</div>
<h3 class="sec"><span>HOW</span>점검 시점을 업무 흐름에 넣습니다 — 다음 3쪽에서 화면으로</h3>
<div class="flow f4">
  {step("작업 전", "안전장비 · 작업환경", "‘작업 시작’ 전에 점검을 먼저 요청")}
  {step("작업 중", "진행 상태 · 추가 위험", "예정의 절반쯤 ‘진행 중 점검 차례’ 표시")}
  {step("작업 종료", "마무리 점검 · 사진", "‘작업 종료’ 전에 마무리 점검 요청")}
  {step("본사 확인", "사진 육안 확인 · 보완 요청", "적합 · 보완 요청 · 조치 완료 이력")}
</div>
<p class="note"><b>중요한 한계</b> — 사진만으로 안전 적합성을 자동 판정하지 않습니다(사람이 눈으로 확인). 위험한 작업은 시스템 표시를 기다리지 말고 중단하고 직접 연락하도록 화면마다 안내합니다.</p>
""",
)

# ═════ 09 문제 2 — 작업 전 ═════
page(
    "PROCEDURE 02-1",
    "작업 전 — 점검이 먼저",
    f"""
<p class="kicker">문제 2 · STEP 1 — 작업 시작보다 점검이 먼저 기록되게</p>
<h2>점검 없이 시작하려 하면,<br><em>먼저 묻습니다.</em></h2>
<div class="row phones4">
  {phone("p2_field_first", "<b>기사 첫 화면</b> — ‘지금 할 일’ 맨 위가 <b>① 시작 전 안전점검 → ② 작업 시작</b>.", "1-1")}
  {phone("p2_gate_start", "<b>점검 없이 ‘작업 시작’</b>을 누르면 확인 창. 그래도 시작하면 본사에 ‘점검 전 작업 시작’으로 표시됩니다.", "1-2")}
  {phone("p2_pre_check", "<b>시작 전 점검</b> — 항목마다 확인 + 착용 사진(필수). 사진은 촬영정보를 지웁니다.", "1-3")}
  {phone("p2_started", f"<b>점검을 낸 뒤 작업 시작</b> — 묻지 않고 바로 기록(서버 시각 함께). 점검 {at('p2_pre_check')} → 시작 {at('p2_started')}.", "1-4")}
</div>
<div class="row pc2">
  {pc("p2_admin_review", "<b>관리자 ‘안전관리’</b> — 사진 확인 대기 점검. 사진을 눈으로 본 뒤 ‘적합(육안)’ 또는 보완 요청.")}
  {pc("p2_admin_stage1", "<b>현장별 3단계 현황</b> — 보령 지사 시작 전 ‘적합(육안 확인)’, 진행 중·마친 뒤는 아직.")}
</div>
<div class="kv"><div><small>시작 전 점검 (착용 사진)</small><b>{F['checks']['작업 전']['at']}</b><span>기사 휴대폰</span></div><div><small>작업 시작</small><b>{F['started']}</b><span>점검 뒤에 기록</span></div><div><small>점검 시점 판정</small><b>‘제때’</b><span>점검 시각 ≤ 작업 시작 (기록 비교)</span></div><div><small>관리자 육안 확인</small><b>{F['checks']['작업 전']['review']}</b><span>적합(육안)</span></div></div>
<p class="note">‘제때 · 시작 뒤 제출 · 없음’은 기록 시각만 비교한 표시이며 위반 판정이 아닙니다. 현장 사정은 관리자가 전화로 확인합니다.</p>
""",
)

# ═════ 10 문제 2 — 작업 중 미흡 ═════
page(
    "PROCEDURE 02-2",
    "작업 중 — 미흡이면 멈추고, 본사 1순위로",
    f"""
<p class="kicker">문제 2 · STEP 2 — 미흡 발견 → 작업 중지 안내 → 본사 1순위 표시 → 보완 요청</p>
<h2>‘미흡’을 고르는 순간,<br><em>현장은 멈추고 본사는 압니다.</em></h2>
<div class="row ph-pc big">
  {phone("p2_mid_deficient", "<b>진행 중 점검에서 ‘미흡’</b>(작업구역 표시·통제)을 고르면 빨간 안내: <b>프로그램 확인을 기다리지 말고 작업을 멈추고 관리자에게 직접 전화</b>. 이 점검은 기록용입니다.", "2-1")}
  <div class="stack">
    {pc("p2_admin_dash_safety", "<b>관리자 대시보드 맨 앞 ‘안전 확인 필요(1순위)’</b>에 보령 지사 미흡이 바로 올라옵니다(10~15초 주기 확인).")}
    {pc("p2_admin_supp_req", "<b>미흡 점검</b>은 ‘적합’ 버튼이 막히고 <b>보완 요청</b>만 보낼 수 있습니다. 사진은 관리자가 눈으로 확인합니다.")}
  </div>
</div>
""",
)

# ═════ 11 문제 2 — 보완 · 작업 종료 ═════
page(
    "PROCEDURE 02-3",
    "보완 → 조치 완료 → 마무리 점검",
    f"""
<p class="kicker">문제 2 · STEP 3~4 — 보완 제출 → 조치 완료 / 마무리 점검 없이 끝내려 하면 먼저 묻기</p>
<h2>보완 이력과 세 단계 점검이<br><em>한 곳에 남습니다.</em></h2>
<div class="row ph-pc n40">
  {phone("p2_field_supp", "<b>보완 요청 도착</b> → 보완 사진 + ‘통제선 설치 완료’ → 보완 제출. 처음 점검은 그대로 두고 보완 이력이 덧붙습니다.", "3")}
  {pc("p2_admin_supp_done", "<b>보완 확인 → 조치 완료</b> — 확인 이력: 관리자 확인(보완 필요) → 보완 제출 → 조치 완료. 모두 시각·입력자와 함께 남습니다.")}
</div>
<div class="row ph2-pc">
  <div class="stack ph2">
    {phone("p2_gate_end", "<b>마무리 점검 없이 ‘작업 종료’</b> → ‘마무리 안전점검을 먼저 보내 주세요’.", "4-1")}
    {phone("p2_ended", "<b>마무리 점검 → 작업 종료</b> — 화면은 다음 현장으로 넘어갑니다.", "4-2")}
  </div>
  <div class="stack">
    {pc("p2_admin_stage3", "<b>현장별 3단계 현황</b> — 시작 전 ‘적합(육안)’ · 진행 중 ‘조치 완료’ · 마친 뒤 ‘적합(육안)’. 점검 없이 시작·종료했거나 늦게 냈으면 따로 표시됩니다.")}
    <div class="box soft"><h4>실제 현장에서 잴 항목 (성과 측정 화면에 있음)</h4><ul class="dots">
      <li><b>제때 제출 비율</b> — 시작 전 점검은 작업 시작 전에, 마무리 점검은 종료 전에</li>
      <li><b>누락 · 사진 없는 점검 수</b> — 사진이 안 올라간 점검은 제출로 세지 않음</li>
      <li><b>관리자 첫 확인 소요시간</b> — 제출 → 육안 확인</li></ul></div>
  </div>
</div>
""",
)

# ═════ 12 문제 3 정의 ═════
page(
    "DEEP DIVE 03",
    "연쇄 지연의 원인과 계산",
    f"""
<p class="kicker">05 / 문제 3 · 연속 현장 일정의 파급효과</p>
<h2>한 현장이 늦어지면,<br><em>왜 다음 현장도 흔들릴까?</em></h2>
<p class="lead">예정된 작업시간만 보는 일정표에는 ‘앞 현장에서 얼마나 더 걸리는가’와 ‘다음 현장까지 이동하는 시간’이 함께 반영되지 않습니다. 그래서 지연 사실을 알아도 <b>다음 고객에게 얼마나 일찍 연락해야 하는지</b> 판단이 늦어질 수 있습니다.</p>
<div class="feature">{pic("ai-van", "")}<div><small>문제가 생기는 구조</small><h3>종료시간이 바뀌면<br>도착 가능시간도 바뀝니다.</h3><p>같은 기사가 하루에 여러 현장을 방문하면, 앞 작업의 종료 예상이 뒤로 밀릴 때 다음 현장으로의 이동 가능시간이 부족해집니다.</p><span class="chip">연쇄 지연은 일부 사례만 확인 · 발생 빈도 미검증</span></div></div>
<h3 class="sec"><span>CALC</span>이 사례에서 엔진이 한 계산 <span class="tag calc">계산값</span></h3>
<div class="calc">
  <div class="c"><small>보령 종료 예상 (보고값)</small><b>{F['new_end']}</b></div><i>+</i>
  <div class="c"><small>이동</small><b>20분</b></div><i>=</i>
  <div class="c dark"><small>홍성 도착 예상</small><b>{hm(140)}</b></div><i>vs</i>
  <div class="c"><small>홍성 예정 시작</small><b>{hm(90)}</b></div><i>→</i>
  <div class="c red"><small>부족</small><b>50분</b><span>매우 높음</span></div>
</div>
<div class="calc">
  <div class="c"><small>홍성 종료 예상 (60분 유지 가정)</small><b>{hm(200)}</b></div><i>+</i>
  <div class="c"><small>이동</small><b>25분</b></div><i>=</i>
  <div class="c dark"><small>예산 도착 예상</small><b>{hm(225)}</b></div><i>vs</i>
  <div class="c"><small>예산 예정 시작</small><b>{hm(180)}</b></div><i>→</i>
  <div class="c red"><small>부족</small><b>45분</b><span>매우 높음</span></div>
</div>
<div class="two">
  <div class="box"><h4>이 계산을 자동 시험으로 고정했습니다 <span class="tag teal">tests-pilot/core-case.test.ts · 9건</span></h4><ul class="dots"><li>보고 전: 보령→홍성 여유 10분 ‘없음’ · 홍성→예산 여유 5분 ‘주의’ — 위험 0</li><li>보고 직후: 50분 · 45분 부족, 둘 다 ‘매우 높음’ · 이 사건 관련 위험 2</li><li>1차 조치 뒤: 여유 5분 ‘주의’ · 50분 부족 (남음 1)</li><li>2차 조치 뒤: 여유 5분 · 여유 10분 — 위험 0</li><li>입력 순서를 섞어도 같은 결과</li></ul></div>
  <div class="box soft"><h4>판단에 쓰는 값</h4><ul class="dots"><li><b>입력</b>: 예정 시작·종료 · 이동시간 · 작업 시작 · 예상 종료 보고 · 작업 종료</li><li><b>가정</b>: 늦게 시작한 현장도 예정 소요시간만큼 걸린다</li><li><b>결과</b>: 연결마다 도착 예상 · 여유/부족 · 등급 · 판단 근거 문장</li><li><b>기록</b>: 입력 · 결과 · 규칙 버전(chain-risk/1.1.0) 저장, 다시 계산해 일치 확인</li></ul></div>
</div>
<p class="note">등급 기준(설정값): 여유 10분 이상 ‘없음’ · 여유 0~9분 ‘주의’ · 부족 1~9분 ‘중간’ · 10~29분 ‘높음’ · 30분 이상 ‘매우 높음’. 회사 운영 기준으로 확정하기 전의 값입니다. 같은 입력이면 항상 같은 결과가 나오며(자동 시험 9건으로 고정), AI 학습·예측 모델이 아닙니다.</p>
""",
)

# ═════ 13 문제 3 — 보고 직후 ═════
page(
    "PROCEDURE 03-1",
    "보고 직후 — 다음 현장 2곳 위험",
    f"""
<p class="kicker">문제 3 · STEP 1 — 기사가 예상 종료를 바꾸는 순간 다시 계산 ({F['reported']})</p>
<h2>‘보령이 늦는다’가 아니라<br><em>‘홍성 50분 · 예산 45분 부족’.</em></h2>
{pc("p3_chain_report", "<b>사건 상세 ‘후속 현장 위험 · 조치 전후’</b> — 보령 지사 → 홍성 물류센터 <b>매우 높음 · 50분 늦음</b>, 홍성 물류센터 → 예산 매장 <b>매우 높음 · 45분 늦음</b>. 이 사건으로 새로 생긴 위험 2 · 남은 위험 2.")}
<div class="row pc2">
  {pc("p13_admin_dash", "<b>관리자 대시보드</b> — ‘우선 처리할 사건’ 옆 <b>‘다음 현장 지연 위험(2순위)’</b>에 두 연결이 계산값과 함께 바로 올라옵니다.")}
  <div class="box"><h4>단순 기록과 다른 점</h4><p class="vs"><span class="tag">단순 기록</span>“보령 작업이 늦는다”는 사실을 저장합니다.</p><p class="vs"><span class="tag teal">이 프로그램</span>“홍성 시작까지 50분 부족하고, 홍성을 늦추면 예산에도 영향이 남는다”는 <b>연결 결과를 계산</b>합니다. 고객에게 얼마나 일찍 연락할지 판단할 근거가 생깁니다.</p></div>
</div>
""",
)

# ═════ 14 문제 3 — 조치 → 재판단 ═════
page(
    "PROCEDURE 03-2",
    "조치하면 다시 판단 — 남은 위험을 숨기지 않음",
    f"""
<p class="kicker">문제 3 · STEP 2~3 — 일정 조정 → 재판단 → 2차 조정 → 남은 위험 0</p>
<h2>조치할 때마다 다시 계산해,<br><em>남은 위험을 보여 줍니다.</em></h2>
<div class="row pc2">
  {pc("p3_adjust1_form", f"<b>1차 조치 입력</b> — 사건 카드 ‘일정 조정’: 홍성 물류센터를 {hm(145)}~{hm(205)}로(고객 연락 완료). 시스템이 일정을 정하지 않고, 관리자가 넣은 값으로 다시 판단합니다.")}
  {pc("p3_adjust1_result", "<b>1차 재판단</b> — 풀린 위험 1건(보령→홍성) · 부족시간이 바뀐 위험 1건(홍성→예산). 우선 확인 이유가 ‘후속 현장 1곳 위험(최대 50분 늦음)’으로 바뀝니다.")}
</div>
<div class="row pc2">
  {pc("p3_adjust2_result", f"<b>2차 조치 → 재판단</b> — 예산 매장을 {hm(240)}~{hm(290)}로 조정. 풀린 위험 1건, 그날 위험 연결 1 → 0건.")}
  <div class="box"><h4>조치마다 바뀐 판단 (엔진 계산값)</h4>
    <table class="mini"><thead><tr><th>연결</th><th>보고 직후</th><th>1차 조치 후</th><th>2차 조치 후</th></tr></thead><tbody>
    <tr><td>보령 → 홍성</td><td class="r">50분 부족</td><td>여유 5분 · 주의</td><td>여유 5분 · 주의</td></tr>
    <tr><td>홍성 → 예산</td><td class="r">45분 부족</td><td class="r">50분 부족</td><td class="g">여유 10분 · 없음</td></tr></tbody></table>
    <p>1차 조치로 앞 연결은 풀렸지만 홍성을 늦춘 만큼 예산 부족이 커졌습니다. 프로그램은 이것을 숨기지 않고 보여 주고, 관리자는 2차 조치를 합니다.</p></div>
</div>
<div class="row pc-ph">
  {pc("p3_chain_after", "<b>사건 상세 ‘조치 전후’</b> — 보령→홍성 ‘매우 높음 · 50분 늦음’ → ‘주의 · 여유 5분’(해소), 홍성→예산 ‘매우 높음 · 45분 늦음’ → ‘없음 · 여유 10분’(해소). 조치로 풀린 위험 2 · 남은 위험 0.")}
  {phone("p3_field_next", "<b>기사 휴대폰</b> — 조정된 홍성 물류센터 시각이 카드에 바로 반영됩니다.", "3")}
</div>
""",
)

# ═════ 15 전체 흐름 · 증빙 ═════
page(
    "RECORD",
    "한 사건의 기록이 증빙이 됩니다",
    f"""
<p class="kicker">06 / 사건 하나 = 문제 보고 → 엔진 계산 → 관리자 조치 → 조치 전후</p>
<h2>화면에서 한 일이<br><em>그대로 증빙으로 남습니다.</em></h2>
{pc("ev_case_print", f"<b>사건 증빙 {F['case_no']} — 핵심 흐름 요약</b>. 현장 문제(입력값) → 엔진 입력·계산(보고 직후) → 관리자 조치·처리 시간 → 조치 전후 → 측정. 인쇄(PDF) · CSV · JSON으로 내보내며, 맨 위에 ‘가상 시나리오’가 자동 표기됩니다.")}
<div class="two">
  <div class="box soft"><h4>무엇이 남나</h4><ul class="dots">
    <li>시각 3종 구분: 누른 시각 · 서버 기록 시각 · 사후 입력한 시각</li>
    <li>입력자 · 출처(현장 직원 / 관리자 대리 보고) · 프로그램 버전</li>
    <li>고치지 않고 추가만 — 정정 · 무효도 기록으로 남김</li>
    <li>같은 요청은 한 번만 저장(요청 번호)</li>
    <li>자료 구분: 실제 업무 / 현장정보 재현 / 가상 시나리오 — 섞이지 않음</li></ul></div>
<div class="metrics m2"><h4>현장 실증에서 모을 핵심 지표 — 같은 정의로 잽니다</h4>
  <div><b>①</b><span>문제 발견 → 보고 시간</span></div><div><b>②</b><span>보고 → 지원 결정 시간</span></div><div><b>③</b><span>다음 현장 지연을 미리 안 시간 (계산 시점 → 실제 도착)</span></div><div><b>④</b><span>안전점검 제때 제출 비율 · 관리자 확인 소요시간</span></div>
</div>
</div>
<p class="note">개선율 · 원가 절감액은 실제 비교 기록이 생기기 전에는 쓰지 않습니다. 이 문서의 수치는 계산값이거나 가상 시나리오 시험 기록입니다.</p>
""",
)

# ═════ 16 증거 구분 ═════
page(
    "EVIDENCE",
    "개발 · 검증 근거",
    f"""
<p class="kicker">07 / 증거가 있는 것과 없는 것을 구분합니다</p>
<h2>우리는 지금<br><em>어디까지 만들었나.</em></h2>
<div class="big2"><div class="navy"><small>구현 상태</small><b>v0.6.1</b><span>현장기사 모바일 · 관리자 PC · 안전점검 · 문제 보고 · 연쇄위험 판단</span></div><div class="navy blue"><small>개발환경 회귀시험 기록</small><b>746<i>개</i></b><span>lint · build 및 단위 · DB · 화면 시험 통과 (2026-11-18, 저장소 기록) · 현장 검증 아님</span></div></div>
<table class="ev">
  <thead><tr><th>구분</th><th>이 자료에서 해당하는 것</th><th>상태</th></tr></thead>
  <tbody>
    <tr><td><b>실제 구현한 기능</b></td><td>이 문서의 모든 화면(휴대폰 · PC) — 안전점검 · 문제 보고 · 지원 처리 · 일정 조정 · 판단 기록 · 증빙</td><td><span class="ok">구현 · 화면 확인</span></td></tr>
    <tr><td><b>자동화 · 규칙 기반 판단</b></td><td>다음 현장 도착 여유/부족 · 위험 등급 · 우선 확인 순서 · 조치 후 재판단 · 중간 확인 · 점검 시점</td><td><span class="ok">구현 · 자동시험</span> 기준값은 초안</td></tr>
    <tr><td><b>가상 시나리오 시험</b></td><td>보령 → 홍성 → 예산 사례 (계산값 자동시험 9건 + 이 문서의 실제 실행 화면)</td><td><span class="ok">완료</span></td></tr>
    <tr><td><b>실제 현장 실증 결과</b></td><td>실제 직원 · 실제 휴대폰 · 실제 업무 기록</td><td><span class="pno">0건 · 계획</span></td></tr>
    <tr><td><b>아직 검증되지 않은 효과</b></td><td>보고 시간 단축 · 지원 결정 단축 · 고객 연락 앞당김 · 원가 절감</td><td><span class="no">측정 전 · 수치 쓰지 않음</span></td></tr>
  </tbody>
</table>
<div class="cards4">
  <div class="card"><small>01</small><h4>특허 출원</h4><b class="big">1건</b><p>10-2026-0173957<br>2026.09.11 출원</p><span class="t-no">등록된 특허가 아님</span></div>
  <div class="card"><small>02</small><h4>판단엔진</h4><b class="big">구현</b><p>예상 종료 · 이동 · 후속 시작시각 비교 · 조정 후 재판단</p><span class="t-ok">코드 · 시험 보유</span></div>
  <div class="card"><small>03</small><h4>실행 화면</h4><b class="big">{len(STEPS)}장</b><p>2026.11.21 실제 프로그램 실행 촬영</p><span class="t-ok">가상 시나리오 데이터</span></div>
  <div class="card warn"><small>04</small><h4>실제 현장성과</h4><b class="big red">미확보</b><p>직원 실제 사용기록 · 절감시간 · 효과 측정</p><span class="t-no">단기 실증 계획</span></div>
</div>
<div class="timeline"><h4>개발 경과</h4><div><b>09.11</b><span>관련 특허 출원</span></div><div><b>10.28</b><span>연쇄 위험판단 엔진 구현</span></div><div><b>11.13</b><span>현장 책임자 인터뷰 반영</span></div><div><b>11.16</b><span>안전 1순위 · 조기 확인</span></div><div><b>11.18</b><span>v0.6.1 안정화 · 자체 시험</span></div><div><b>11.21</b><span>실행 화면 촬영</span></div></div>
<p class="note">출원 뒤에 추가한 기능(현장 문제 보고 · 안전점검 · 조기 확인 · v0.6.1 안정화)은 출원 당시부터 있던 것으로 쓰지 않습니다. 특허 기술구성과의 대응은 용어 대응이며 청구항 대조 결과가 아닙니다.</p>
""",
)

# ═════ 17 심사 지적 답변 ═════
page(
    "REVIEW RESPONSE",
    "보완사유별 답변",
    f"""
<p class="kicker">08 / 이의신청 보완 논리 + 실제 자료 확보</p>
<h2>심사위원의 질문에<br><em>화면으로 답합니다.</em></h2>
<div class="qa">
  <div class="card"><small>지적 01</small><h4>“무슨 기술인지 명확하지 않다.”</h4><p>현장 상태 변화(예상 종료)를 받아 다음 현장 도착 부족을 계산하고, 먼저 조치할 일을 정합니다. → <b>12~14쪽</b> 홍성 50분 · 예산 45분 부족 → 조치 후 0</p></div>
  <div class="card"><small>지적 02</small><h4>“차별성이 잘 보이지 않는다.”</h4><p>기록 공유를 넘어 앞·뒤 현장을 연결해 이동·시작시간 부족을 계산하고, 조치 뒤 다시 판단합니다. → <b>13쪽</b> 단순 기록과 비교</p></div>
  <div class="card"><small>지적 03</small><h4>“구현·시험 근거가 부족하다.”</h4><p>실제 실행 화면 {len(STEPS)}장, 개발환경 회귀시험 746개, 핵심 사례 계산 자동시험 9건. 실제 현장 실증과는 구분합니다. → <b>3 · 16쪽</b></p></div>
  <div class="card"><small>지적 04</small><h4>“개발 가능성이 불명확하다.”</h4><p>세 문제 각각의 절차가 이미 동작합니다(4~14쪽). 남은 것은 운영 연결과 현장 실증이며 단계별 계획을 아래에 둡니다.</p></div>
</div>
<h3 class="sec"><span>NEXT</span>짧은 기간에도 가능한 증거 확보 — 기록을 꾸미지 않고 단계별로 구분</h3>
<div class="next">
  <div>{pic("ai-stuck", "")}<div><b>1</b><h4>실제 현장 문제 1~3건 확인</h4><p>현장 책임자와 최근 사례를 확인하고, 가능한 경우 원본 작업일지 · 메신저 · 사진을 확보합니다.</p><span>구분: 과거 사례 사실 확인 (현장정보 재현)</span></div></div>
  <div>{pic("ai-tablet", "")}<div><b>2</b><h4>실제 기기로 프로그램 사용</h4><p>운영 DB 연결 뒤 관리자 PC · 기사 휴대폰 2대로 이 문서의 흐름을 실제 기기에서 실행하고 기록을 저장합니다.</p><span>구분: 실제 기기 연동시험 (시험 A)</span></div></div>
  <div>{pic("ai-map", "")}<div><b>3</b><h4>실제 업무 1건 이상 기록</h4><p>실제 현장 작업 1건 이상에서 안전점검 · 문제 보고 · 지원 결정 · 일정 조정을 기록하고, 계산 결과를 실무 책임자가 확인합니다.</p><span>구분: 실제 업무 (가장 강한 증거)</span></div></div>
</div>
<div class="navy msg"><small>이의신청 보완의 핵심 메시지</small><p>“복잡한 AX 플랫폼 전체를 내세우기보다, 여러 현장의 지연 위험을 계산하고 관리자 대응을 돕는 핵심기술을 구현했습니다. 세 가지 현장 문제를 다루는 절차가 실제 프로그램에서 동작함을 화면으로 확인했고, 실제 현장 적용으로 판단 기준과 업무효과를 검증해 가겠습니다.”</p></div>
""",
)

CSS = (HERE / "style.css").read_text()
html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>하나정보통신 이의신청 보완자료 (샘플)</title><style>{CSS}</style></head><body>{''.join(pages)}</body></html>"""
(HERE / "appeal.html").write_text(html)
print("pages", len(pages), "shots", len(list(IMG.glob("*.jpg"))))
