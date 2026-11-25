"""녹음 + 실제 화면 → 영상 플레이어 HTML (player.html) 과 시간표(timeline.json)"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from player_lib import (rphoto, ASR, CAP, FULL, PH, VID, XCAP, art, at, badge, cam_frame, photo, seg_end, seg_start, shot, show, size, uri, wt, xshot)  # noqa: E402
from player_assets import page  # noqa: E402

LINES = [
    "1990년 사업을 시작한 하나정보통신은 2002년 정보통신공사업 면허를 취득한 이후,",
    "다양한 공공기관과 학교의 정보통신공사 및 유지보수 업무를 수행해 왔습니다.",
    "오랜 기간 여러 현장을 운영하면서 반복적으로 경험해 온 문제들이 있었습니다.",
    "현장 지원 요청의 지연, 안전 확인의 누락, 그리고 한 현장의 작업 지연이 다른 현장으로 이어지는 연쇄적인 일정 지연입니다.",
    "하나정보통신은 이러한 문제를 기존의 전화나 수기 관리 방식이 아닌 기술적으로 해결하기 위해",
    "‘복수 현장 업무 위험관리 AX 시스템’을 개발했습니다.",
    "",  # 첫 번째 문제 (제목 화면)
    "정보통신공사 현장에서는 장비 이상이나 자재 부족, 기술적인 문제 등 예상하지 못한 상황이 수시로 발생할 수 있습니다.",
    "하지만 현장 직원이 스스로 문제를 해결하려 하거나 작업에 집중하다 보면 본사에 상황을 전달하는 시점이 늦어지기도 합니다.",
    "이러한 문제가 장시간 방치되면 작업시간이 불필요하게 늘어나고, 추가 인력이나 장비를 투입해야 하는 상황으로 이어질 수 있습니다.",
    "결과적으로 인건비와 공사원가가 증가하고, 전체 공사 일정과 수익성에도 영향을 미치게 됩니다.",
    "이를 해결하기 위해 당사는 작업 시작 후 일정 시간이 경과하면 현장의 진행상태를 확인하는 기능을 개발했습니다.",
    "현장 직원은 복잡한 내용을 작성할 필요 없이 간단한 선택과 사진 등록을 통해 문제 상황과 필요한 지원을 전달할 수 있습니다.",
    "시스템은 보고된 문제와 작업 진행상태를 분석하여 관리자가 우선적으로 확인해야 할 업무를 제시합니다.",
    "본사는 이를 바탕으로 인력이나 장비 지원, 기술적인 조언 등 필요한 조치를 결정하고, 현장 직원에게 전달할 수 있습니다.",
    "문제가 심화된 이후에 대응하는 것이 아니라, 문제가 장기화되기 전에 발견하고 대응할 수 있도록 기술적인 관리체계를 구현한 것입니다.",
    "",  # 두 번째 문제
    "정보통신공사에는 높은 곳에서의 작업이나 전기설비 주변 작업, 각종 장비를 사용하는 작업 등 안전관리가 필요한 업무가 많습니다.",
    "그러나 여러 현장에서 작업이 동시에 진행되는 경우, 본사 관리자가 모든 현장의 안전수칙 준수 여부를 직접 확인하기는 어렵습니다.",
    "작업 전 안전점검이 누락되거나 작업 도중 발생한 위험요소가 적절하게 전달되지 않으면, 작은 부주의가 심각한 안전사고로 이어질 수 있습니다.",
    "안전사고는 작업자의 피해뿐만 아니라 공사 중단, 납기 지연, 추가 비용 발생 등 기업의 경영 전반에도 영향을 미칠 수 있습니다.",
    "이를 해결하기 위해 당사는 작업 전, 작업 중, 작업 후의 안전점검을 현장 업무 흐름에 연결했습니다.",
    "현장 직원은 단계별 안전점검 결과와 사진을 등록하고, 시스템은 필수 점검의 누락 여부와 미흡한 항목을 확인합니다.",
    "미흡한 안전점검이 남아 있는 경우 작업 시작을 제한하고, 관리자에게 우선적으로 확인해야 할 안전관리 대상으로 표시합니다.",
    "관리자는 등록된 사진과 점검 결과를 확인하여 보완을 요청하고, 현장 직원의 조치 결과까지 다시 확인할 수 있습니다.",
    "또한 점검 과정과 조치 이력을 체계적으로 기록하여 안전관리의 연속성을 확보하도록 설계했습니다.",
    "단순히 안전점검표를 전산화하는 것이 아니라, 안전관리의 누락을 발견하고 실제 대응과 재확인으로 연결하는 기술입니다.",
    "세 번째는 하나정보통신이 가장 중점적으로 개발한 핵심 기술입니다.",
    "정보통신공사업의 특성상 한 명의 직원이 하루 동안 여러 현장을 순차적으로 방문하는 경우가 많습니다.",
    "이때 첫 번째 현장의 작업이 예상보다 길어지면 두 번째 현장에 늦게 도착하게 되고, 그 영향은 다시 세 번째 현장으로 이어질 수 있습니다.",
    "이러한 연쇄적인 지연을 조기에 발견하지 못하면 고객과 약속한 방문시간을 지키기 어려워지고, 다른 직원의 일정까지 변경해야 하는 상황이 발생합니다.",
    "결국 반복적인 일정 조정과 추가 인력 투입으로 업무 효율성이 떨어지고, 공사원가 증가와 고객 신뢰도 저하로 이어질 수 있습니다.",
    "당사는 이러한 문제를 해결하기 위해 작업상태 이벤트와 현장 간 시공간 제약정보를 결합한 연쇄위험 판단 기술을 개발했습니다.",
    "예를 들어 한 직원이 보령, 홍성, 예산의 세 현장을 순차적으로 방문한다고 가정해 보겠습니다.",
    "보령 현장의 예상 종료시각이 오후 1시로 변경되고, 홍성 현장까지 이동하는 데 20분이 필요하다면 예상 도착시각은 오후 1시 20분이 됩니다.",
    "홍성 현장의 예정된 작업 시작시각이 오후 12시 30분이라면, 시스템은 50분의 시간이 부족하다는 것을 사전에 계산합니다.",
    "그리고 이러한 지연이 이후 예산 현장에 얼마나 영향을 미치는지까지 연쇄적으로 산출합니다.",
    "시스템은 작업상태의 변화, 예상 종료시각, 이동시간, 위험의 크기와 영향 범위 등을 종합하여 관리자의 대응 우선순위를 결정합니다.",
    "관리자가 이를 확인하고 일정을 조정하면 변경된 조건을 반영하여 위험을 다시 계산합니다.",
    "첫 번째 조치로 일부 위험이 해소되더라도 다른 현장에 위험이 남아 있거나 새롭게 발생한다면, 이를 다시 관리자에게 제시합니다.",
    "이처럼 개별 현장의 문제를 확인하는 데 그치지 않고, 아직 시작하지 않은 후속 현장의 위험까지 계산하며,",
    "관리자의 조치 이후에도 위험을 지속적으로 재판단하는 것이 당사 기술의 핵심 차별성입니다.",
    "",  # 기술개발 성과 및 향후 방향
    "하나정보통신은 이러한 현장 문제를 해결하기 위해",
    "2026년 7월부터 본격적인 프로그램 개발을 진행했으며,",
    "같은 해 9월 핵심 위험판단 기술의 특허출원을 완료했습니다.",
    "이후 지속적인 연구개발과 기능 고도화를 통해 총 746건의 개발환경 자체시험을 통과하며",
    "기술의 구현성과 안정성을 높여 왔습니다.",
    "현재는 2027년 초 정식 운영을 목표로 검증과 안정화를 진행하고 있으며,",
    "앞으로 축적되는 현장 데이터를 기반으로 위험판단 기술을 더욱 발전시킬 계획입니다.",
    "나아가 정보통신공사업뿐만 아니라 전기공사, 소방공사, 설비공사, 시설관리 등",
    "유사한 문제를 경험하는 다양한 현장산업으로 기술의 적용 범위를 확대하고자 합니다.",
    "오랜 현장 경험에서 발견한 문제를 기술로 해결하고,",
    "문제가 발생한 이후의 대응을 넘어 앞으로 발생할 위험까지 사전에 판단하는 것.",
    "이것이 하나정보통신이 개발한 복수 현장 업무 위험관리 AX 시스템입니다.",
]
assert len(LINES) == len(ASR) == 55, (len(LINES), len(ASR))
S = [seg_start(i) for i in range(55)]
E = [seg_end(i) for i in range(55)]
END = 440.0
SUBS = []
for i, txt in enumerate(LINES):
    nxt = S[i + 1] if i + 1 < 55 else END
    SUBS.append([round(S[i], 2), round(min(nxt, E[i] + 1.2), 2), txt])

CHAPS = ["도입", "① 지원 요청 지연", "② 안전 확인 누락", "③ 연쇄 일정 지연", "성과 · 계획"]


def hdr(chap, dark=False):
    ch = "".join(f'<span class="{"on" if i == chap else ""}">{c}</span>' for i, c in enumerate(CHAPS))
    return f'<div class="hdr"><div class="logo"><div class="lm">H<i></i></div><div><b>(주)하나정보통신</b><small>복수 현장 업무 위험관리 AX 시스템</small></div></div><div class="chaps">{ch}</div></div>'


SCENES = []


def scene(start, chap, body, dark=False, bg=None):
    bgh = f'<div class="bgph kb" style="background-image:url({uri(PH / (bg + ".jpg"))})"></div>' if bg else ""
    SCENES.append([start, chap, dark, bgh + (hdr(chap, dark) if chap is not None else "") + body])


def title_card(start, num, kicker, title, sub, bg):
    scene(start, None, f"""<div class="abs" style="left:150px;top:300px;right:150px">
{at(start + 0.2, "fade", "secnum", body=num)}
{at(start + 0.5, "up", "kicker", body=kicker, style="margin-top:18px;font-size:30px")}
{at(start + 0.7, "up", "", "h1", title, style="font-size:84px;margin-top:10px")}
{at(start + 1.4, "up", "note", body=sub, style="font-size:30px;margin-top:22px")}</div>""", dark=True, bg=bg)


A_MARKS = lambda st: {n: st + 0.6 + 0.9 * (n - 1) for n in range(1, 5)}  # noqa: E731

# ════ 도입 ════
t0 = 0.0
scene(t0, 0, f"""
<div class="abs" style="left:110px;top:210px;width:900px">
{at(0.4, "up", "kicker", body="정보통신공사 · 유지보수 전문 기업")}
{at(0.8, "up", "", "h1", "(주)하나정보통신", style="font-size:92px;margin-top:12px")}
<div style="display:flex;flex-direction:column;gap:22px;margin-top:56px">
{at(wt(0, "1990"), "left", "chip t", body="<i>1990</i> 사업 시작")}
{at(wt(0, "2002"), "left", "chip t", body="<i>2002</i> 정보통신공사업 면허 취득")}
{at(S[1], "left", "chip n", body="공공기관 · 학교 정보통신공사 및 유지보수")}
</div></div>
<div class="abs" style="left:1010px;top:130px">{at(0.6, "fade", "", body=rphoto("x-012-021", 830, 430, "현장 작업 차량과 기사"))}</div>
<div class="abs" style="left:1010px;top:582px;display:flex;gap:18px">
{at(S[1], "up", "", body=rphoto("x-016-031", 265, 250, "학교 컴퓨터실"))}{at(S[1] + 0.4, "up", "", body=rphoto("x-014-023", 265, 250, "교실 영상 설비"))}{at(S[1] + 0.8, "up", "", body=rphoto("x-016-029", 265, 250, "CCTV 설치"))}</div>
""", dark=True)

st = S[2] - 0.3
scene(st, 0, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="오랜 기간 여러 현장을 운영하며")}{at(st + 0.4, "up", "", "h2", "반복적으로 경험해 온 <em>세 가지 문제</em>")}</div>
<div class="abs" style="left:96px;top:330px;right:96px;display:flex;gap:40px">
{at(wt(3, "현장"), "pop", "card", body=rphoto("x-012-020", 500, 300) + '<h3 style="margin-top:22px">01 · 현장 지원 요청의 지연</h3><p style="margin-top:8px">막혀도 본사가 늦게 알게 됩니다</p>', style="flex:1")}
{at(wt(3, "안전"), "pop", "card", body=photo("ai-pole", 500, 300, kb=False) + '<h3 style="margin-top:22px">02 · 안전 확인의 누락</h3><p style="margin-top:8px">여러 현장을 동시에 확인하기 어렵습니다</p>', style="flex:1")}
{at(wt(3, "그리고"), "pop", "card r", body=rphoto("x-012-021", 500, 300) + '<h3 style="margin-top:22px">03 · 연쇄적인 일정 지연</h3><p style="margin-top:8px">한 현장의 지연이 다음 현장으로</p>', style="flex:1")}
</div>""")

st = S[4] - 0.3
fix = '<span class="fix" style="left:84.6%;top:61%;width:13.6%;height:10.2%;background:#f4fbf7;font-size:2.05cqw">다음 현장 일정<br>조정 후 재계산</span>'
scene(st, 0, show(st, S[5] - 0.2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="전화 · 수기 관리가 아니라")}{at(st + 0.4, "up", "", "h2", "현장 문제를 <em>기술로</em> 해결합니다")}</div>
<div class="abs" style="left:250px;top:300px">{at(st + 0.6, "pop", "", body=art("a7_before_after", 1420, "회사 개념 그림 — 다음 현장 일정은 관리자가 정하고, 프로그램은 바뀐 일정으로 위험을 다시 계산합니다", cover=fix))}</div>""")
      + show(S[5] - 0.2, S[6], f"""
<div class="abs" style="left:110px;top:250px;width:760px">
{at(S[5], "up", "kicker", body="하나정보통신이 개발한 신청기술")}
{at(S[5] + 0.2, "up", "", "h1", "복수 현장 업무<br><em>위험관리 AX 시스템</em>", style="font-size:76px;margin-top:14px")}
{at(S[5] + 0.9, "up", "note", body="현장 휴대폰 · 본사 PC · 위험 판단 엔진 · 판단 기록", style="font-size:28px;margin-top:26px")}
{at(S[5] + 1.2, "up", "", body=badge("특허출원 10-2026-0173957", "plan"), style="margin-top:20px")}</div>
<div class="abs" style="left:880px;top:190px">{at(S[5] + 0.4, "right", "", body=shot("p13_admin_dash", 860, cap="본사 PC — 다음 현장 지연 위험"))}</div>
<div class="abs" style="left:1540px;top:330px">{at(S[5] + 0.8, "up", "", body=shot("p1_field_ask", 300, cap="기사 휴대폰"))}</div>"""))

# ════ 문제 1 ════
title_card(S[6] - 0.3, "01", "첫 번째 문제", "현장 지원 요청의 지연", "문제가 커지기 전에, 본사가 먼저 알아야 합니다", "ai-stuck")

st = S[7] - 0.3
scene(st, 1, f"""
<div class="abs" style="left:96px;top:120px">{photo("ai-stuck", 980, 760, "광분배함 앞 — 예상과 다른 배선 상태 (연출)")}</div>
<div class="abs" style="left:1130px;top:150px;width:700px;display:flex;flex-direction:column;gap:22px">
{at(st + 0.3, "up", "kicker", body="현장에서는 수시로")}
{at(wt(7, "장비"), "right", "chip", body="⚙ 장비 이상")}
{at(wt(7, "자제"), "right", "chip", body="📦 자재 부족")}
{at(wt(7, "기술적인"), "right", "chip", body="🔧 기술적인 문제")}
{at(S[8], "up", "card r", body='<h3>혼자 해결하려다…</h3><p style="margin-top:8px">작업에 집중하다 보면 <b>본사에 알리는 시점이 늦어집니다</b></p>', style="margin-top:18px")}
</div>""")

st = S[9] - 0.3
chain = [("장시간 방치", wt(9, "장시간")), ("작업시간 증가", wt(9, "작업")), ("추가 인력 · 장비 투입", wt(9, "추가")), ("인건비 · 공사원가 증가", wt(10, "인건비")), ("공사 일정 · 수익성 영향", wt(10, "전체"))]
items = ""
for k, (txt, tt) in enumerate(chain):
    if k:
        items += at(tt - 0.15, "fade", "arrow r", body="→")
    items += at(tt, "pop", "chip r" if k >= 3 else "chip", body=txt, style="font-size:38px;padding:24px 30px")
scene(st, 1, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="보고가 늦어지면")}{at(st + 0.4, "up", "", "h2", "작은 문제가 <span class='red'>비용과 일정</span>으로 커집니다")}</div>
<div class="abs" style="left:60px;right:60px;top:400px;display:flex;flex-wrap:wrap;align-items:center;gap:30px 18px;justify-content:center">{items}</div>
<div class="abs" style="left:96px;right:96px;top:640px;text-align:center">{at(S[10] + 3, "up", "note", body="지연 · 추가 투입 · 원가 증가가 서로 이어집니다", style="font-size:30px")}</div>""")

st = S[11] - 0.3
scene(st, 1, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ① 진행상태 확인 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "작업 시작 30분째, 보고가 없으면 <em>휴대폰이 먼저 묻습니다</em>")}</div>
<div class="abs" style="left:150px;top:300px">{at(st + 0.5, "up", "", body=shot("p1_field_ask", 520, t_marks={1: S[11] + 2.4, 2: S[11] + 4.0}, taps={2: S[11] + 4.6}, cap="기사 휴대폰 — ‘예정대로 되고 있나요?’"))}</div>
<div class="abs" style="left:760px;top:330px">{at(S[11] + 3.2, "right", "", body=shot("p1_admin_watch", 1010, t_marks={1: S[11] + 5.2, 2: S[11] + 6.4}, cap="본사 대시보드 — 연락 없이 늦어지는 현장"))}</div>""")

st = S[12] - 0.3
rep = [("p1_report_type", "① 문제 유형"), ("p1_report_state", "② 지금 상태 · 발견 시각"), ("p1_report_need_end", "③ 필요한 지원 · ④ 바뀐 예상 종료"), ("p1_report_photo", "⑤ 사진 등록"), ("p1_report_sent", "⑥ 보고 완료")]
span = (S[13] - 0.3 - S[12]) / len(rep)
phones, steps_ = "", ""
for k, (sid, lab) in enumerate(rep):
    a = S[12] + span * k
    b = S[12] + span * (k + 1) if k < len(rep) - 1 else S[13] + 1
    marks = {1: a + 0.5, 2: a + 1.1} if sid == "p1_report_need_end" else ({1: a + 0.6} if sid == "p1_report_sent" else None)
    ph = shot(sid, 360, box=(0, 0, 1, 0.84)) if sid != "p1_report_sent" else shot(sid, 420, t_marks=marks)
    if sid == "p1_report_need_end":
        ph = shot(sid, 360, box=(0, 0, 1, 0.84), t_marks=marks, taps={1: a + 0.7})
    phones += show(a - 0.1 if k else a - 0.6, b, ph, style="position:absolute;left:0;top:0")
    steps_ += f'<div data-on="{a:.2f},{b:.2f}"><i>{k + 1}</i>{lab}</div>'
scene(st, 1, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ① 버튼 몇 번으로 보고 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "복잡한 글 대신 <em>선택과 사진</em>으로 알립니다")}</div>
<div class="abs" style="left:330px;top:228px;width:460px;height:720px">{phones}</div>
<div class="abs stepl" style="left:900px;top:300px;width:820px;font-size:34px">{steps_}</div>""")

st = S[13] - 0.3
scene(st, 1, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ① 본사가 먼저 볼 것을 제시 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "보고와 진행상태를 분석해 <em>우선 확인할 업무</em>를 보여 줍니다")}</div>
<div class="abs" style="left:96px;top:300px">{at(st + 0.5, "left", "", body=shot("p13_admin_dash", 860, t_marks={1: S[13] + 1.6, 2: S[13] + 2.6}, cap="관리자 대시보드 — 새 보고 · 다음 현장 지연 위험"))}</div>
<div class="abs" style="left:1000px;top:330px">{at(S[13] + 2.2, "right", "", body=shot("p13_case_card", 820, t_marks={1: S[13] + 3.6, 2: S[13] + 5.0}, cap="문제 · 지원 — 우선 확인 이유 (계산값)"))}</div>""")

st = S[14] - 0.3
scene(st, 1, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ① 지원 결정 → 현장 전달 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "인력 · 장비 · 기술 조언을 <em>결정하고 바로 전달</em>합니다")}</div>
<div class="abs" style="left:96px;top:300px;width:1120px;height:600px">
{show(S[14] - 0.2, S[14] + 3.6, shot("p1_admin_support", 1120, t_marks={1: S[14] + 1.0}, taps={1: S[14] + 1.5}, cap="① 지원 조치 결정 — 숙련 직원 투입"), style="position:absolute;left:0;top:0")}
{show(S[14] + 3.6, S[15], shot("p1_admin_deliver", 1120, t_marks={1: S[14] + 4.4}, cap="② 현장 전달 — 기사에게 보낼 말"), style="position:absolute;left:0;top:0")}</div>
<div class="abs" style="left:1300px;top:290px">{at(S[14] + 5.6, "up", "", body=shot("p1_field_hq", 470, t_marks={1: S[14] + 6.4}, cap="③ 기사 휴대폰에 도착"))}</div>""")

st = S[15] - 0.3
fl = [("시작 30분째 확인", 0.4), ("버튼 · 사진 보고", 1.4), ("우선 확인 제시", 2.4), ("지원 결정", 3.4), ("현장 전달", 4.4)]
fh = ""
for k, (txt, d) in enumerate(fl):
    if k:
        fh += at(S[15] + d - 0.15, "fade", "arrow", body="→")
    fh += at(S[15] + d, "pop", "chip t" if k < 4 else "chip n", body=txt)
scene(st, 1, f"""
<div class="abs" style="left:96px;right:96px;top:250px;text-align:center">
{at(st + 0.3, "up", "kicker", body="문제 ① 정리")}
{at(wt(15, "장기화"), "up", "", "h1", "문제가 <em>장기화되기 전에</em><br>발견하고 대응하는 관리체계", style="margin-top:16px")}</div>
<div class="abs flowh" style="left:96px;right:96px;top:640px;justify-content:center">{fh}</div>""", dark=True, bg="ai-hq")

# ════ 문제 2 ════
title_card(S[16] - 0.3, "02", "두 번째 문제", "현장 안전 확인의 누락", "작업 전 · 중 · 후, 하나라도 빠지면 안 됩니다", "ai-pole")

st = S[17] - 0.3
scene(st, 2, f"""
<div class="abs" style="left:96px;top:120px">{photo("ai-pole", 900, 760, "고소작업 — 안전대 · 안전모 확인이 필수입니다 (연출)")}</div>
<div class="abs" style="left:1050px;top:150px;width:780px;display:flex;flex-direction:column;gap:20px">
{at(st + 0.3, "up", "kicker", body="안전관리가 필요한 작업")}
{at(wt(17, "높은"), "right", "chip", body="🪜 높은 곳 작업")}
{at(wt(17, "전기"), "right", "chip", body="⚡ 전기설비 주변 작업")}
{at(wt(17, "각종"), "right", "chip", body="🛠 각종 장비 사용")}
{at(S[18], "up", "card r", body='<h3>여러 현장이 동시에</h3><p style="margin-top:8px">본사 관리자가 모든 현장의 <b>안전수칙 준수를 직접 확인하기 어렵습니다</b></p>', style="margin-top:20px")}
</div>""")

st = S[19] - 0.3
ch2 = [("작업 전 점검 누락", wt(19, "작업")), ("위험요소 전달 안 됨", wt(19, "적절하게")), ("작은 부주의", wt(19, "작은")), ("심각한 안전사고", wt(19, "심각한"))]
it2 = ""
for k, (txt, tt) in enumerate(ch2):
    if k:
        it2 += at(tt - 0.15, "fade", "arrow r", body="→")
    it2 += at(tt, "pop", "chip r" if k == 3 else "chip", body=txt, style="font-size:36px;padding:22px 28px")
cons = [("작업자 피해", wt(20, "작업자")), ("공사 중단", wt(20, "공사")), ("납기 지연", wt(20, "납기")), ("추가 비용", wt(20, "추가"))]
it3 = "".join(at(tt, "up", "chip r", body=txt, style="font-size:34px") for txt, tt in cons)
scene(st, 2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="확인이 빠지면")}{at(st + 0.4, "up", "", "h2", "작은 부주의가 <span class='red'>사고와 경영 손실</span>로 이어집니다")}</div>
<div class="abs flowh" style="left:96px;right:96px;top:380px;justify-content:center">{it2}</div>
<div class="abs flowh" style="left:96px;right:96px;top:560px;justify-content:center;gap:26px">{it3}</div>
<div class="abs" style="left:96px;right:96px;top:700px;text-align:center">{at(wt(20, "기업의"), "up", "note", body="안전사고는 기업의 경영 전반에 영향을 줍니다", style="font-size:30px")}</div>""")

st = S[21] - 0.3
scene(st, 2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ② 안전점검을 업무 흐름에 연결 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "작업 <em>전 · 중 · 후</em> 점검이 작업 버튼과 함께 움직입니다")}</div>
<div class="abs" style="left:140px;top:290px;display:flex;gap:60px;align-items:flex-start">
{at(wt(21, "작업", 0), "up", "", body=shot("p2_field_first", 470, t_marks={1: wt(21, "작업", 0) + 0.6}, cap="작업 전 — 시작 전 안전점검 먼저"))}
{at(wt(21, "작업", 1), "up", "", body=shot("p2_mid_deficient", 470, box=(0, 0.1, 1, 0.62), t_marks={1: wt(21, "작업", 1) + 0.6}, cap="작업 중 — ‘미흡’이면 작업 중지 안내"))}
{at(wt(21, "작업", 2), "up", "", body=shot("p2_gate_end", 470, box=(0, 0.18, 1, 0.62), t_marks={1: wt(21, "작업", 2) + 0.6, 2: wt(21, "작업", 2) + 1.2}, cap="작업 후 — 마무리 점검 없이 종료 전 확인"))}
</div>""")

st = S[22] - 0.3
scene(st, 2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ② 결과와 사진 등록 → 누락 · 미흡 확인 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "단계별 점검 결과와 <em>착용 사진</em>을 남깁니다")}</div>
<div class="abs" style="left:150px;top:270px">{at(st + 0.5, "up", "", body=shot("p2_pre_check", 340, box=(0, 0.06, 1, 0.82), t_marks={1: S[22] + 1.5, 2: S[22] + 3.0}, taps={2: S[22] + 3.4}))}</div>
<div class="abs" style="left:700px;top:330px">{at(S[22] + 4.0, "right", "", body=shot("p2_admin_stage1", 1090, t_marks={1: S[22] + 5.0}, keys=[[S[22] + 5.6, 0, 0, 1, 1], [S[22] + 7.0, 0, 0.12, 0.62, 0.62]], cap="본사 — 현장별 3단계 현황 (시작 전 · 진행 중 · 마친 뒤)"))}</div>""")

st = S[23] - 0.3
scene(st, 2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ② 미흡하면 시작 전 확인 · 본사 1순위 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "점검 없이 <em>작업 시작을 누르면 먼저 막고 묻습니다</em>")}</div>
<div class="abs" style="left:150px;top:270px">{at(st + 0.5, "up", "", body=shot("p2_gate_start", 340, box=(0, 0.06, 1, 0.82), t_marks={1: S[23] + 1.2, 2: S[23] + 2.4}, taps={2: S[23] + 2.9}))}</div>
<div class="abs" style="left:700px;top:330px">{at(wt(23, "관리자"), "right", "", body=shot("p2_admin_dash_safety", 1090, t_marks={1: wt(23, "관리자") + 1.0}, cap="본사 대시보드 — 안전 확인 필요(1순위)"))}</div>""")

st = S[24] - 0.3
scene(st, 2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ② 보완 요청 → 조치 → 재확인 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "사진을 보고 <em>보완을 요청</em>하고, 조치 결과까지 다시 확인합니다")}</div>
<div class="abs" style="left:96px;top:300px">{at(st + 0.5, "left", "", body=shot("p2_admin_supp_req", 940, t_marks={1: S[24] + 1.2, 2: S[24] + 2.0, 3: S[24] + 2.8}, taps={3: S[24] + 3.2}, cap="① 미흡 항목 · ‘적합’은 막힘 · 보완 요청"))}</div>
<div class="abs" style="left:1060px;top:290px">{at(wt(24, "현장"), "up", "", body=shot("p2_field_supp", 340, t_marks={1: wt(24, "현장") + 0.8}, taps={1: wt(24, "현장") + 1.2}, cap="② 기사 — 보완 사진 제출"))}</div>
<div class="abs" style="left:1440px;top:330px">{at(wt(24, "다시"), "up", "", body=shot("p2_admin_supp_done", 400, t_marks={1: wt(24, "다시") + 0.7}, cap="③ 본사 — 재확인 · 이력"))}</div>""")

st = S[25] - 0.3
scene(st, 2, show(st, S[26] - 0.2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ② 점검 과정 · 조치 이력 기록 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "점검 과정과 조치 이력이 <em>끊김 없이 남습니다</em>")}</div>
<div class="abs" style="left:250px;top:290px">{at(st + 0.6, "up", "", body=xshot(FULL / "f_safety.jpg", 1420, "안전관리 화면 (스크롤)", "11:31", box=(320 / 1440, 380 / 2034, 1040 / 1440, 560 / 2034), keys=[[st + 1.0, 320 / 1440, 380 / 2034, 1040 / 1440, 560 / 2034], [S[26] - 1.5, 320 / 1440, 1200 / 2034, 1040 / 1440, 560 / 2034]]))}</div>""")
      + show(S[26] - 0.2, S[27], f"""
<div class="abs" style="left:96px;right:96px;top:240px;text-align:center">
{at(S[26], "up", "kicker", body="문제 ② 정리")}
{at(S[26] + 0.3, "up", "", "h1", "점검표 전산화가 아니라<br><em>누락 발견 → 대응 → 재확인</em>", style="margin-top:16px")}</div>
<div class="abs flowh" style="left:96px;right:96px;top:640px;justify-content:center">
{at(S[26] + 2.2, "pop", "chip", body="누락 · 미흡 발견")}{at(S[26] + 2.9, "fade", "arrow", body="→")}{at(S[26] + 3.1, "pop", "chip", body="본사 1순위 표시")}{at(S[26] + 3.8, "fade", "arrow", body="→")}{at(S[26] + 4.0, "pop", "chip", body="보완 요청 · 조치")}{at(S[26] + 4.7, "fade", "arrow", body="→")}{at(S[26] + 4.9, "pop", "chip n", body="재확인 · 기록")}</div>"""), dark=False)

# ════ 문제 3 ════
title_card(S[27] - 0.3, "03", "세 번째 문제 · 핵심 기술", "복수 현장의 연쇄적인 작업 지연", "하나정보통신이 가장 중점적으로 개발한 기술입니다", "ai-van")

st = S[28] - 0.3
sites = [("보령 지사", "11:00 – 12:00"), ("홍성 물류센터", "12:30 – 13:30"), ("예산 매장", "14:00 – 14:50")]
t_long, t_late, t_third = wt(29, "길어지면"), wt(29, "늦게"), wt(29, "세")
sh = ""
for k, (nm, tm) in enumerate(sites):
    late = ["", f'<div class="st red" data-in="{t_late}" data-fx="up">도착 13:20 · 50분 늦음</div>', f'<div class="st red" data-in="{t_third}" data-fx="up">도착 14:45 · 45분 늦음</div>'][k]
    first = f'<div class="st red" data-in="{t_long}" data-fx="up">예상 종료 13:00 (+1시간)</div>' if k == 0 else ""
    sh += at(st + 0.5 + 0.5 * k, "up", "site", body=f"<h4>{k + 1}. {nm}</h4><div class='tm'>예정 {tm}</div>{first}{late}")
    if k < 2:
        sh += at(st + 0.8 + 0.5 * k, "fade", "travel", body=["🚐 이동 20분", "🚐 이동 25분"][k])
scene(st, 3, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="기사 1명이 하루에 여러 현장을 차례로")}{at(st + 0.4, "up", "", "h2", "앞 현장이 길어지면 <span class='red'>다음 현장, 그다음 현장</span>까지 늦어집니다")}</div>
<div class="abs flowh" style="left:80px;right:80px;top:380px;justify-content:center;gap:16px">{sh}</div>
<div class="abs" style="left:96px;right:96px;top:700px;text-align:center">{at(st + 1.0, "up", "", body=badge("계산 예시 · 시험용 가상 일정", "calc"))}</div>""")

st = S[30] - 0.3
scene(st, 3, f"""
<div class="abs" style="left:96px;top:120px">{photo("ai-van", 900, 760, "다음 현장으로 이동 — 늦어진 출발은 뒤 일정 전체를 밀어냅니다 (연출)")}</div>
<div class="abs" style="left:1050px;top:150px;width:780px;display:flex;flex-direction:column;gap:20px">
{at(st + 0.3, "up", "kicker", body="조기에 발견하지 못하면")}
{at(wt(30, "고객과"), "right", "chip r", body="고객과 약속한 방문시간 못 지킴")}
{at(wt(30, "다른"), "right", "chip r", body="다른 직원 일정까지 변경")}
{at(S[31], "right", "chip", body="반복 일정 조정 · 추가 인력 투입")}
{at(wt(31, "업무"), "right", "chip", body="업무 효율성 저하")}
{at(wt(31, "공사원과"), "right", "chip r", body="공사원가 증가 · 고객 신뢰 저하")}
</div>""")

st = S[32] - 0.3
scene(st, 3, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ③ 핵심 기술")}{at(st + 0.4, "up", "", "h2", "작업상태 이벤트 + 시공간 제약정보 → <em>연쇄위험 판단</em>")}</div>
<div class="abs" style="left:96px;right:96px;top:330px;display:flex;align-items:center;gap:30px;justify-content:center">
<div class="flowv">{at(wt(32, "작업"), "left", "card", body='<h3>작업상태 이벤트</h3><p style="margin-top:8px">작업 시작 · 종료 · 바뀐 예상 종료 보고</p>', style="width:520px")}
{at(wt(32, "현장"), "left", "card", body='<h3>현장 간 시공간 제약정보</h3><p style="margin-top:8px">예정 시작 · 종료 + 현장 간 이동시간</p>', style="width:520px")}</div>
{at(wt(32, "결합한"), "fade", "arrow", body="➜", style="font-size:80px")}
{at(wt(32, "연쇄"), "pop", "card n", body='<h3 style="font-size:40px">연쇄위험 판단</h3><p style="margin-top:10px">다음 현장마다 도착 지연(분)<br>위험 등급 · 영향 범위 · 대응 순서</p>', style="width:560px")}
</div>
<div class="abs" style="left:96px;right:96px;top:760px;text-align:center">{at(wt(32, "연쇄") + 0.6, "up", "note", body="규칙 기반 계산 — 같은 입력이면 같은 결과, 계산 과정을 화면에 공개 (AI 예측 아님)", style="font-size:26px")}</div>""")

st = S[33] - 0.3
t_end1, t_trav, t_arr = wt(34, "1시로"), wt(34, "20분이"), wt(34, "1시", 1)
t_hs, t_short = wt(35, "12시"), wt(35, "50분의")
scene(st, 3, show(st, S[36] - 0.2, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="예시 — 보령 → 홍성 → 예산 " + badge("실제 프로그램 계산값", "calc"))}{at(st + 0.4, "up", "", "h2", "보고 하나로 <em>다음 현장의 부족 시간</em>을 미리 계산합니다")}</div>
<div class="abs" style="left:110px;top:310px;display:flex;gap:26px;align-items:stretch">
{at(st + 0.8, "up", "site", body="<h4>1. 보령 지사</h4><div class='tm'>예정 종료 12:00</div>" + at(t_end1, "pop", "st red", body="예상 종료 13:00"))}
{at(t_trav, "pop", "travel", body="🚐 + 이동 20분", style="align-self:center")}
{at(st + 1.3, "up", "site", body="<h4>2. 홍성 물류센터</h4>" + at(t_arr, "pop", "st", body="예상 도착 13:20") + at(t_hs, "pop", "tm", body="예정 시작 12:30"))}
</div>
<div class="abs" style="left:110px;top:640px;width:1000px">{at(t_short, "pop", "card r", body='<p style="font-size:30px;color:#10283a"><b>여유</b> = 12:30 − 13:20 = <b class="red" style="font-size:44px">−50분 → 50분 부족</b> · 위험 매우 높음</p>')}</div>
<div class="abs" style="left:1240px;top:300px">{at(t_short + 0.8, "right", "", body=shot("p13_admin_dash", 600, t_marks={1: t_short + 1.6}, cap="실제 화면 — 보고 직후 자동 계산"))}</div>""")
      + show(S[36] - 0.2, S[37], f"""
<div class="ttl">{at(S[36], "up", "kicker", body="이어서 계산 — 실제 화면")}{at(S[36] + 0.2, "up", "", "h2", "홍성이 늦게 끝나면 <em>예산 현장</em>까지 <span class='red'>45분 부족</span>")}</div>
<div class="abs" style="left:96px;top:290px">{at(S[36] + 0.3, "up", "", body=shot("p3_chain_report", 1100, t_marks={1: S[36] + 1.0, 2: S[36] + 2.2, 3: S[36] + 3.6}, cap="사건 상세 — 연쇄 영향 (보령 → 홍성 → 예산)"))}</div>
<div class="abs" style="left:1260px;top:320px;width:560px">{at(S[36] + 2.4, "up", "card r", body='<p style="font-size:27px;color:#10283a">홍성 종료 <b>14:20</b><br>+ 이동 25분 = 도착 <b>14:45</b><br>예산 시작 14:00 → <b class="red">45분 부족</b></p>')}</div>"""))

st = S[37] - 0.3
J = FULL / "f_judg.jpg"
JW, JH = 1440, 4456
bx = lambda y, h=600: [320 / JW, y / JH, 1040 / JW, h / JH]  # noqa: E731
scene(st, 3, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ③ 대응 우선순위 — 실제 판단 기록 화면")}{at(st + 0.4, "up", "", "h2", "변화 · 종료시각 · 이동시간 · 위험 크기를 종합해 <em>무엇부터 볼지</em> 정합니다")}</div>
<div class="abs" style="left:96px;top:290px">{at(st + 0.4, "up", "", body=xshot(J, 1150, "판단 기록 상세 (스크롤)", "11:30", box=bx(1290, 540), keys=[[S[37] + 0.4] + bx(1290, 540), [S[37] + 3.6] + bx(1640, 540), [S[37] + 6.4] + bx(3040, 540)], height=560))}</div>
<div class="abs" style="left:1300px;top:300px;width:520px;display:flex;flex-direction:column;gap:14px">
{at(wt(37, "작업"), "right", "chip", body="작업상태 변화")}{at(wt(37, "예상"), "right", "chip", body="예상 종료시각")}{at(wt(37, "이동"), "right", "chip", body="이동시간")}{at(wt(37, "위험의"), "right", "chip", body="위험 크기 · 영향 범위")}
{at(wt(37, "관리자의"), "pop", "chip n", body="1순위 130점 = 60 + 50 + 10 + 10", style="font-size:26px")}</div>""")

st = S[38] - 0.3
seq = [("p3_adjust1_form", S[38] + 0.0, "1차 조치 — 홍성 시작을 13:25로", {1: 0.6, 2: 1.4}, {2: 1.8}), ("p3_adjust1_result", S[38] + 3.6, "저장 즉시 재판단", {}, None),
       ("p3_adjust2_form", S[39] + 3.2, "2차 조치 — 예산 시작을 15:00로", {1: 0.6, 2: 1.4}, {2: 1.8}), ("p3_adjust2_result", S[39] + 6.0, "재판단 — 남은 위험 0", {}, None)]
win = ""
for k, (sid, a, lab, mk, tp) in enumerate(seq):
    b = seq[k + 1][1] if k + 1 < len(seq) else S[40]
    win += show(a - 0.2 if k else a - 0.6, b, shot(sid, 1080, t_marks={n: a + d for n, d in mk.items()}, taps={n: a + d for n, d in (tp or {}).items()}, cap=lab), style="position:absolute;left:0;top:0")
cnt = f"""<div class="card" style="width:560px"><h3>위험 연결 수</h3>
<div style="display:flex;align-items:center;gap:22px;margin-top:18px;font-size:76px;font-weight:900">
<span class="red">2</span>{at(S[38] + 3.8, "fade", "arrow", body="→")}{at(S[38] + 3.9, "pop", "", tag="span", body="1", style="color:#b7700b")}{at(S[39] + 6.2, "fade", "arrow", body="→")}{at(S[39] + 6.3, "pop", "", tag="span", body="0", style="color:#127566")}</div>
<p style="margin-top:16px">1차 조치 뒤 <b>홍성→예산 50분 부족</b>이 남아<br>다시 관리자에게 제시됩니다</p></div>"""
scene(st, 3, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="해결 ③ 조치하면 다시 계산 — 실제 화면")}{at(st + 0.4, "up", "", "h2", "일정을 고치면 <em>바뀐 조건으로 위험을 다시 계산</em>합니다")}</div>
<div class="abs" style="left:96px;top:280px;width:1100px;height:300px">{win}</div>
<div class="abs" style="left:96px;top:560px;width:900px;height:360px">
{show(S[38] - 0.6, S[39] + 6.0, shot("p3_chain_report", 900, show=[3], t_marks={3: S[38] + 0.5}, cap="연쇄 영향 그림 — 조치 전"), style="position:absolute;left:0;top:0")}
{show(S[39] + 6.0, S[40], shot("p3_chain_after", 900, t_marks={1: S[39] + 6.4, 2: S[39] + 6.8, 3: S[39] + 7.2}, cap="연쇄 영향 그림 — 2차 조치 후 남은 위험 0"), style="position:absolute;left:0;top:0")}</div>
<div class="abs" style="left:1250px;top:300px">{at(S[38] + 1.0, "up", "", body=cnt)}</div>
<div class="abs" style="left:1250px;top:640px">{at(S[39] + 1.0, "up", "", body=xshot(XCAP / "x_records__judgments.jpg", 570, "판단 이력", "11:31", box=(0, 0.56, 1, 0.35), marks=[(0.012, 0.585, 0.975, 0.31, S[39] + 2.0, 0)]))}</div>""")

st = S[40] - 0.3
scene(st, 3, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="문제 ③ 정리 — 핵심 차별성")}{at(st + 0.4, "up", "", "h2", "아직 시작하지 않은 현장까지 계산하고, <em>조치 뒤에도 다시 판단</em>합니다")}</div>
<div class="abs" style="left:96px;right:96px;top:330px;display:flex;gap:30px;align-items:stretch">
{at(wt(40, "개별"), "up", "card", body='<div class="kicker">기존</div><h3 style="margin-top:6px">개별 현장 확인</h3><p style="margin-top:10px">예정 시간이 겹치는지만 봄<br>— 늦어진 뒤의 도착은 모름</p>', style="flex:1")}
{at(wt(40, "아직"), "up", "card t", body='<div class="kicker">이 시스템</div><h3 style="margin-top:6px">후속 현장 위험 계산</h3><p style="margin-top:10px">바뀐 종료 + 이동시간으로<br>다음 · 그다음 현장까지</p>', style="flex:1")}
{at(wt(41, "관리자의"), "up", "card n", body='<div class="kicker" style="color:#6fe0c5">이 시스템</div><h3 style="margin-top:6px">조치 후 지속 재판단</h3><p style="margin-top:10px">조치마다 다시 계산하고<br>판단 전 · 후를 기록</p>', style="flex:1")}
</div>
<div class="abs" style="left:560px;top:690px">{at(wt(41, "핵심"), "up", "", body=xshot(XCAP / "x_demo_verify__compare.jpg", 800, "기술검증 — 같은 데이터, 기존 겹침 검사 vs 연쇄위험 엔진", "", box=(0, 0.17, 1, 0.34)))}</div>""")

# ════ 성과 · 계획 ════
title_card(S[42] - 0.3, "→", "기술개발 성과 및 향후 방향", "현장 경험을 기술로", "개발 · 특허 · 자체시험, 그리고 정식 운영으로", "ai-hq")

st = S[43] - 0.3
scene(st, 4, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="기술개발 성과")}{at(st + 0.4, "up", "", "h2", "현장 문제에서 출발해 <em>개발 · 특허 · 검증</em>까지")}</div>
<div class="abs" style="left:96px;right:96px;top:330px;display:flex;gap:30px">
{at(wt(44, "2026"), "up", "card", body='<div class="kicker">2026.07</div><h3 style="margin-top:8px">본격 프로그램 개발</h3><p style="margin-top:10px">현장 휴대폰 · 본사 PC ·<br>위험 판단 엔진</p>', style="flex:1")}
{at(wt(45, "9월"), "up", "card t", body='<div class="kicker">2026.09</div><h3 style="margin-top:8px">핵심 위험판단 기술 특허출원</h3><p style="margin-top:10px">출원번호 10-2026-0173957</p>', style="flex:1")}
{at(wt(46, "이후"), "up", "card n", body='<div class="kicker" style="color:#6fe0c5">2026.11</div><h3 style="margin-top:8px">개발환경 자체시험</h3><p style="margin-top:6px"><span data-count="746" data-at="' + str(wt(46, "746")) + '" style="font-size:72px;font-weight:900;color:#fff">0</span><span style="font-size:32px;color:#fff;font-weight:800"> 건 통과</span></p>', style="flex:1")}
</div>
<div class="abs" style="left:96px;right:96px;top:690px">{at(wt(46, "개발", 1), "up", "term", body='<span class="g"># 0.6.1 전체 회귀 — 로컬 자체 시험 기록 (2026-11-18)</span><br>lint · build 통과 + 113 + 62 + 130 + 57 + 99 + 150 + 135 = <span class="y">746개 통과 · 실패 0</span>')}</div>""")

st = S[48] - 0.3
scene(st, 4, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="향후 방향")}{at(st + 0.4, "up", "", "h2", "2027년 초 <em>정식 운영</em>, 그리고 현장 데이터로 더 정확하게")}</div>
<div class="abs" style="left:96px;top:320px;width:860px;display:flex;flex-direction:column;gap:26px">
{at(wt(48, "2027"), "left", "card t", body='<div class="kicker">2027년 초 목표</div><h3 style="margin-top:8px">정식 운영</h3><p style="margin-top:8px">검증과 안정화 진행 중 — 실제 기기 · 실제 업무 시험</p>')}
{at(S[49], "left", "card", body='<div class="kicker">그다음</div><h3 style="margin-top:8px">현장 데이터 기반 고도화</h3><p style="margin-top:8px">축적되는 실제 작업 · 이동시간으로 위험판단 기준을 더 정확하게</p>')}</div>
<div class="abs" style="left:1020px;top:300px">{rphoto("x-012-021", 800, 520, "정식 운영 — 실제 현장 업무에 적용")}</div>""")

st = S[50] - 0.3
inds = [("정보통신공사", st + 0.6, "chip n"), ("전기공사", wt(50, "전기공사"), "chip t"), ("소방공사", wt(50, "소방공사"), "chip t"), ("설비공사", wt(50, "설비공사"), "chip t"), ("시설관리", wt(50, "시설관리"), "chip t")]
ih = "".join(at(tt, "pop", c, body=n, style="font-size:36px;padding:20px 34px") for n, tt, c in inds)
scene(st, 4, f"""
<div class="ttl">{at(st + 0.2, "up", "kicker", body="적용 범위 확대")}{at(st + 0.4, "up", "", "h2", "같은 문제를 겪는 <em>다양한 현장산업</em>으로")}</div>
<div class="abs" style="left:96px;right:96px;top:285px;display:flex;gap:22px;justify-content:center">{at(st + 0.4, "up", "", body=rphoto("x-017-033", 400, 230, "통신 배선"))}{at(st + 0.6, "up", "", body=rphoto("x-016-029", 400, 230, "CCTV"))}{at(st + 0.8, "up", "", body=rphoto("x-016-030", 400, 230, "방송 · 음향 설비"))}{at(st + 1.0, "up", "", body=rphoto("x-016-031", 400, 230, "학교 시설"))}</div>
<div class="abs" style="left:96px;right:96px;top:560px;display:flex;flex-wrap:wrap;gap:24px;justify-content:center">{ih}</div>
<div class="abs" style="left:96px;right:96px;top:740px;text-align:center">{at(S[51], "up", "note", body="여러 현장을 사람이 이동하며 처리하는 산업 — 지원 요청 · 안전 확인 · 연쇄 지연은 공통 문제입니다", style="font-size:30px")}</div>""")

st = S[52] - 0.3
scene(st, 4, f"""
<div class="abs" style="left:110px;right:110px;top:200px;text-align:center">
{at(st + 0.3, "up", "", "h2", "오랜 현장 경험에서 발견한 문제를 기술로", style="font-size:56px")}
{at(S[53], "up", "", "h2", "문제 이후의 대응을 넘어 <em>앞으로 발생할 위험까지 사전에 판단</em>", style="font-size:56px;margin-top:18px")}
{at(S[54], "pop", "", body='<div style="margin-top:70px;display:inline-flex;align-items:center;gap:26px"><div class="logo"><div class="lm" style="width:90px;height:90px;border-radius:24px;font-size:50px;line-height:90px">H<i style="width:14px;height:14px;right:13px;bottom:13px"></i></div></div><div style="text-align:left"><div style="font-size:34px;font-weight:800;color:#9fb3c2">(주)하나정보통신</div><div style="font-size:64px;font-weight:900;letter-spacing:-2px">복수 현장 업무 위험관리 <span style="color:#6fe0c5">AX 시스템</span></div></div></div>')}
{at(S[54] + 1.5, "up", "note", body="특허출원 10-2026-0173957 · 화면은 실제 프로그램(v0.6.1) · 사례 일정과 인물은 시험용", style="margin-top:40px;font-size:22px")}</div>""", dark=True, bg="ai-pole")

# ── 조립 ──
html = ""
for k, (start, chap, dark, body) in enumerate(SCENES):
    end = SCENES[k + 1][0] if k + 1 < len(SCENES) else END
    html += f'<section class="scene{" dark" if dark else ""}" data-start="{start:.2f}" data-end="{end:.2f}">{body}</section>'
(VID / "player.html").write_text(page(html, SUBS))
json.dump({"end": END, "scenes": [[s[0], s[1]] for s in SCENES], "subs": SUBS}, open(VID / "timeline.json", "w"), ensure_ascii=False, indent=1)
srt = []
for i, (a, b, txt) in enumerate([s for s in SUBS if s[2]], 1):
    f = lambda x: f"{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{int(x % 60):02d},{int(round((x % 1) * 1000)) % 1000:03d}"  # noqa: E731
    srt.append(f"{i}\n{f(a)} --> {f(b)}\n{txt}\n")
(VID / "narration.srt").write_text("\n".join(srt))
print("scenes", len(SCENES), "end", END)
