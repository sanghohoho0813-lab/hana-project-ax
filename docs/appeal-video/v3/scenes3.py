"""소개 영상 3판 장면 — 실제 화면·사진 위주 + 자료가 필요 없는 곳만 효과 장면 (흐름선 표지 · 계산 타임라인 · 계단 흐름)
python3 scenes3.py → player.html · timeline.json"""
import json
import subprocess

from lib3 import (ATT, CAP, FULL, H, SCENES, SUBS, K, ai, art, at, badge, box, browser, co, head, phone, photo, scene, show)
from assets3 import page

SC = SCREENS = json.loads((H / "screens.json").read_text())
DUR = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(H / "narration.wav")]))
END = round(DUR + 2.0, 2)


def pm(sid, i, t, n=None):
    """휴대폰 촬영본의 i번째 표시 영역 → (x,y,w,h,t,n)"""
    x, y, w, h = SC[sid]["marks"][i]
    return (x, y, w, h, t, n)


def pc(sid, i):
    x, y, w, h = SC[sid]["marks"][i]
    return (x + w / 2, y + h / 2)


def title_card(t, num, kicker, title, sub, flow, sub_at=None, extra=""):
    scene(t, f"""<div class="abs" style="left:150px;top:300px;width:1500px">
{at(t + 0.2, "fade", "num", num)}
{at(t + 0.45, "up", "eyebrow", kicker, style="margin-top:26px;font-size:30px")}
{at(t + 0.6, "up", "h1", title, style="margin-top:12px;font-size:104px")}
{at(sub_at or t + 1.3, "up", "body", sub, style="margin-top:22px;font-size:36px")}{extra}</div>""", bg="flow", flow=flow)


# ════════ 도입 ════════
t = 0.0
x90, x02 = 110, 110 + round(760 * 12 / 36)
scene(t, f"""
<div class="abs" style="left:110px;top:150px;width:820px">
{at(0.25, "up", "eyebrow", "정보통신공사 · 유지보수 전문 기업")}
{at(0.45, "up", "h1", "(주)하나정보통신", style="margin-top:16px;font-size:104px")}
</div>
{at(K("1990년"), "wipe", "ln", style=f"left:{x90}px;top:520px;width:{x02 - x90}px", dur=K("2002년") - K("1990년") + 0.3)}
{at(K("1990년"), "up", "abs", f'<div class="pill">1990</div><div class="body" style="margin-top:14px;font-size:36px;color:var(--ink)">사업 시작</div>', style=f"left:{x90 - 8}px;top:548px")}
{at(K("1990년"), "fade", "abs", '<i style="display:block;width:22px;height:22px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 6px rgba(210,164,95,.25)"></i>', style=f"left:{x90 - 9}px;top:511px")}
{at(K("2002년"), "fade", "abs", '<i style="display:block;width:22px;height:22px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 6px rgba(210,164,95,.25)"></i>', style=f"left:{x02 - 9}px;top:511px")}
{at(K("2002년"), "up", "abs", f'<div class="pill">2002</div><div class="body" style="margin-top:14px;font-size:36px;color:var(--ink)">정보통신공사업<br>면허 취득</div>', style=f"left:{x02 - 8}px;top:548px")}
{at(K("다양한 공공기관과"), "up", "abs", '<span class="chip g"><i></i>공공기관 · 학교 정보통신공사 · 유지보수</span>', style="left:110px;top:760px")}
{box(1010, 120, photo(co("x-012-021"), 800, 494, "co", "현장 작업 차량과 기사", kb=0.035, t=0.5))}
{box(1010, 650, photo(co("x-016-031"), 254, 200, "co", "학교 컴퓨터실", kb=0, t=K("다양한 공공기관과") + 0.2))}
{box(1283, 650, photo(co("x-014-023"), 254, 200, "co", "교실 영상 설비", kb=0, t=K("다양한 공공기관과") + 0.5))}
{box(1556, 650, photo(co("x-016-029"), 254, 200, "co", "CCTV 설치", kb=0, t=K("다양한 공공기관과") + 0.8))}
""")

t = K("오랜 기간 여러 현장을") - 0.4
cards = [("01", "현장 지원 요청의 지연", "막혀도 본사가 늦게 알게 됩니다", co("x-012-020"), "co", K("현장 지원 요청의 지연")),
         ("02", "안전 확인의 누락", "여러 현장을 동시에 보기 어렵습니다", ai("ai-pole"), "ai", K("안전 확인의 누락")),
         ("03", "연쇄적인 일정 지연", "한 현장의 지연이 다음 현장으로", co("x-012-021"), "co", K("연쇄적인 일정 지연"))]
cb = ""
for k, (n, ttl, d, src, kind, tt) in enumerate(cards):
    cb += box(110 + k * 580, 300, at(tt, "card", "glass", f'{photo(src, 500, 280, kind, kb=0)}<div style="padding:26px 6px 4px"><div class="pill">{n}</div><h3 style="font-size:42px;font-weight:800;margin-top:16px;letter-spacing:-1px">{ttl}</h3><p class="note" style="font-size:27px;margin-top:8px;color:var(--ink2)">{d}</p></div>', style="padding:20px"), w=540)
scene(t, head(t, "오랜 기간 여러 현장을 운영하며", "반복적으로 경험해 온 <em>3가지 문제</em>") + cb)

t = K("하나정보통신은 이러한 문제를") - 0.4
aw = 1150
fix = '<span class="fix" style="left:84.45%;top:61.2%;width:13.64%;height:9.35%;font-size:1.92cqw">다음 현장 일정<br>조정 후 재계산</span>'
scene(t, head(t, "전화 · 수기 관리가 아니라", "현장 문제를 <em>기술로</em> 해결합니다")
      + box((1920 - aw) // 2, 196, at(t + 0.5, "card", "", art(ATT / "a7_before_after.jpg", aw, cover=fix, cap="일정은 관리자가 조정하고, 프로그램은 바뀐 일정으로 다시 계산합니다")))
      + at(K("기술적으로"), "mk", "abs", "", style=f"left:{(1920 - aw) // 2 + round(aw * 0.508)}px;top:{196 + 36 + round(aw * 941 / 1672 * 0.238)}px;width:{round(aw * 0.488)}px;height:{round(aw * 941 / 1672 * 0.535)}px;border:4px solid #e0b56f;border-radius:22px;box-shadow:0 0 0 3px rgba(15,18,22,.45)"))

t = K("복수 현장 업무 위험관리 AX 시스템") - 0.45
scene(t, f"""
<div class="abs" style="left:110px;top:58px;width:1700px">
{at(t + 0.1, "up", "eyebrow", "하나정보통신이 개발한 신청기술")}
<div style="display:flex;align-items:baseline;gap:28px;margin-top:10px">{at(t + 0.25, "up", "title", "복수 현장 업무 위험관리 <em>AX 시스템</em>", style="margin-top:0")}{at(t + 0.6, "fade", "pill", "특허출원 10-2026-0173957")}</div>
</div>
{box(250, 196, at(t + 0.5, "card", "", browser("p13_admin_dash", 1000, 600, [(t, 0, 0, 1080), (K("개발했습니다") - 1.7, 0, 0, 1080), (K("개발했습니다") - 0.3, 200, 230, 780)], label="본사 관리자 PC")))}
{box(1330, 196, at(t + 0.9, "card", "", phone("p1_field_ask", 290, label="현장 직원 휴대폰")))}
""")

# ════════ 문제 ① ════════
GAP = json.loads((H / "gaps.json").read_text())
title_card(GAP["P1"] - 0.15, "01", "첫 번째 문제", "현장 지원 요청의 지연", "문제가 커지기 전에, 본사가 먼저 알아야 합니다", 47)

tb = K("하지만 현장 직원이")
t = tb - 0.4
scene(t, head(t, "문제 ① 현장에서는", "혼자 해결하려다 <em>보고가 늦어집니다</em>")
      + box(110, 220, photo(ai("ai-stuck"), 700, 525, "ai", "광분배함 앞 — 예상과 다른 배선 상태 (연출)", t=t + 0.3))
      + show(t, 9999, f"""<div class="abs" style="left:900px;top:250px;width:910px">
{at(tb, "up", "body", "혼자 해결하려다, 작업에 집중하다 보면…", style="font-size:40px;color:var(--ink)")}
<div style="position:relative;height:300px;margin-top:50px">
{at(tb + 0.6, "fade", "abs", '<i style="display:block;width:26px;height:26px;border-radius:50%;background:var(--teal2);box-shadow:0 0 0 7px rgba(47,151,141,.25)"></i>', style="left:0;top:137px")}
{at(tb + 0.6, "up", "abs", '<div class="chip s t"><i></i>현장에서 문제 발견</div>', style="left:-6px;top:200px")}
{at(K("본사에 상황을 전달하는"), "wipe", "abs ln d", style="left:26px;top:148px;width:600px", dur=1.8)}
{at(K("늦어지기도"), "fade", "abs", '<i style="display:block;width:26px;height:26px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 7px rgba(255,138,112,.25)"></i>', style="left:626px;top:137px")}
{at(K("늦어지기도"), "up", "abs", '<div class="chip s w"><i></i>본사가 아는 시점</div>', style="left:520px;top:200px")}
{at(K("늦어지기도") + 0.2, "up", "abs", '<div style="font-size:60px;font-weight:900;color:var(--warn);letter-spacing:-2px">보고가 늦어짐</div>', style="left:150px;top:40px")}
</div></div>"""), chap=1)

t = K("이러한 문제가 장시간") - 0.4
steps = [("장시간 방치", "", K("장시간 방치")), ("작업시간 증가", "불필요하게 늘어남", K("작업시간이 불필요")),
         ("추가 인력 · 장비 투입", "", K("추가 인력이나 장비")), ("인건비 · 공사원가 증가", "", K("인건비와 공사원가")),
         ("공사 일정 · 수익성 영향", "", K("전체 공사 일정과"))]
st = ""
for k, (a, b, tt) in enumerate(steps):
    x, y = 110 + k * 344, 690 - k * 96
    cls = "node g" if k >= 3 else "node"
    st += at(tt, "card", "abs " + cls, a + (f"<small>{b}</small>" if b else ""), style=f"left:{x}px;top:{y}px;width:300px;font-size:34px")
    st += at(tt, "wipev", "abs", '<div style="width:300px;height:100%;background:linear-gradient(180deg,rgba(210,164,95,.10),transparent)"></div>', style=f"left:{x}px;top:{y + 130}px;height:{860 - y - 130}px", dur=0.6)
    if k:
        st += at(tt - 0.15, "fade", "abs arrow", "↗", style=f"left:{x - 40}px;top:{y + 30}px;font-size:40px")
scene(t, head(t, "문제 ① 보고가 늦어지면", "작은 문제가 <em>비용과 일정</em>으로 커집니다") + st
      + box(110, 800, at(K("영향을 미치게 됩니다"), "fade", "note", badge("ex") + " 지연 · 추가 투입 · 원가 증가가 서로 이어지는 구조")), chap=1)

t = K("이를 해결하기 위해 당사는") - 0.4
mk_ask = [pm("p1_field_ask", 0, K("일정 시간이 경과하면"), 1)]
scene(t, head(t, "해결 ① 진행상태 확인 — 실제 화면", "작업 시작 30분째, 보고가 없으면 <em>휴대폰이 먼저 묻습니다</em>")
      + box(1420, 196, at(t + 0.4, "card", "", phone("p1_field_ask", 290, marks=mk_ask, taps=[(*pc("p1_field_ask", 1), K("기능을 개발했습니다") + 0.4)])))
      + box(110, 196, at(K("현장의 진행상태를") - 0.3, "card", "", browser("p1_admin_watch", 1200, 590, [(t, 220, 60, 820)],
                                                                         marks=[(384, 119, 130, 76, K("진행상태를 확인"), 2), (640, 262, 374, 104, K("진행상태를 확인") + 0.5, 3)]))), chap=1)

t = K("현장 직원은 복잡한") - 0.4
r = [("p1_report_type", "문제 유형", K("현장 직원은 복잡한") + 0.2), ("p1_report_state", "지금 상태 · 발견 시각", K("간단한 선택과")),
     ("p1_report_need_end", "필요한 지원 · 바뀐 예상 종료", K("사진 등록을") - 0.4), ("p1_report_photo", "사진 등록 (촬영정보 지움)", K("문제 상황과 필요한")),
     ("p1_report_sent", "보고 완료 — 사건번호", K("전달할 수 있습니다"))]
lst = ""
for k, (_, name, tt) in enumerate(r):
    nxt = r[k + 1][2] if k + 1 < len(r) else 9999
    lst += f'<div class="step" data-on="{tt:.2f},{nxt:.2f}"><i>{k + 1}</i>{name}</div>'
scene(t, head(t, "해결 ① 버튼 몇 번으로 보고 — 실제 화면", "복잡한 글 대신 <em>선택과 사진</em>으로 알립니다")
      + box(230, 270, at(t + 0.3, "up", "steps", lst, style="transform-origin:0 0"), w=880)
      + box(1160, 196, at(t + 0.2, "card", "", phone(None, 290, seq=[(a, s) for s, _, a in r],
                                                       marks=[pm("p1_report_need_end", 0, r[2][2] + 0.5)],
                                                       taps=[(*pc("p1_report_need_end", 0), r[2][2] + 0.9)]))), chap=1)

t = K("시스템은 보고된 문제와") - 0.4
scene(t, head(t, "해결 ① 우선 확인 — 실제 화면", "보고와 진행상태로 <em>먼저 볼 일</em>을 제시합니다")
      + box(260, 196, at(t + 0.3, "card", "", browser("p13_admin_dash", 1400, 600, [(t, 120, 40, 960), (K("관리자가 우선적으로") - 0.6, 120, 40, 960), (K("관리자가 우선적으로") + 0.4, 215, 420, 760)],
                                                     marks=[(230, 555, 425, 140, K("우선적으로 확인") + 0.3, 1), (675, 550, 262, 95, K("업무를 제시합니다"), 2)]))), chap=1)

t = K("본사는 이를 바탕으로") - 0.4
td = K("필요한 조치를 결정")
scene(t, head(t, "해결 ① 지원 결정 → 현장 전달 — 실제 화면", "인력 · 장비 · 조언을 <em>결정하고 바로 전달</em>합니다")
      + box(110, 196, at(t + 0.3, "card", "", browser(None, 1180, 600, [(t, 220, 120, 800)], seq=[(t, "p1_admin_support"), (td + 0.9, "p1_admin_deliver")],
                                                     cur=[(t + 0.6, 760, 560, 0), (K("인력이나 장비 지원") + 0.6, 403, 293, 1), (td, 300, 410, 1), (td + 1.6, 520, 348, 0), (K("현장 직원에게 전달") - 0.2, 301, 390, 1)])))
      + box(1420, 196, at(K("현장 직원에게 전달") + 0.3, "card", "", phone("p1_field_hq", 290, marks=[pm("p1_field_hq", 0, K("현장 직원에게 전달") + 0.9)], label="현장 직원 휴대폰 — 본사 소식"))), chap=1)

t = K("문제가 심화된 이후에") - 0.4
flow1 = [("30분째 먼저 확인", K("발견하고 대응할")), ("선택 · 사진 보고", K("발견하고 대응할") + 0.5), ("우선 확인 제시", K("발견하고 대응할") + 1.0), ("지원 결정 · 전달", K("발견하고 대응할") + 1.5)]
fb = ""
for k, (a, tt) in enumerate(flow1):
    fb += at(tt, "card", "abs node", a, style=f"left:{110 + k * 440}px;top:560px;width:380px;text-align:center")
    if k:
        fb += at(tt - 0.1, "fade", "abs arrow", "→", style=f"left:{110 + k * 440 - 50}px;top:600px")
scene(t, f"""<div class="abs" style="left:110px;top:150px;width:1700px">
{at(t + 0.1, "up", "eyebrow", "문제 ① 정리")}
{at(t + 0.3, "up", "h1", "문제가 커진 뒤가 아니라<br><em>장기화되기 전에</em> 발견하고 대응합니다", style="margin-top:18px;font-size:80px")}</div>{fb}
{box(110, 760, at(K("기술적인 관리체계"), "up", "pill", "기술적인 관리체계 — 현장 휴대폰 · 본사 PC · 판단 엔진"))}""", bg="slate", chap=1)

# ════════ 문제 ② ════════
title_card(K("두 번째 문제") - 0.4, "02", "두 번째 문제", "현장 안전 확인의 누락", "작업 전 · 중 · 후, 하나라도 빠지면 안 됩니다", 7)

t = K("정보통신공사에는 높은") - 0.4
scene(t, head(t, "문제 ② 안전관리가 필요한 일", "정보통신공사에는 <em>위험한 작업</em>이 많습니다")
      + box(110, 220, photo(ai("ai-pole"), 700, 525, "ai", "고소작업 — 안전대 · 안전모 확인이 필요 (연출)", t=t + 0.3))
      + f"""<div class="abs" style="left:900px;top:250px;display:flex;flex-direction:column;gap:26px;align-items:flex-start">
{at(K("높은 곳에서의"), "left", "chip", "<i></i>높은 곳 작업")}{at(K("전기설비 주변"), "left", "chip", "<i></i>전기설비 주변 작업")}{at(K("각종 장비를"), "left", "chip", "<i></i>각종 장비 사용")}
{at(K("안전관리가 필요한"), "up", "body", "→ <span class='em'>안전관리</span>가 필요한 업무", style="margin-top:20px;font-size:46px;color:var(--ink)")}</div>""", chap=2)

t = K("그러나 여러 현장에서") - 0.4
sites = ""
for k in range(4):
    y = 220 + k * 160
    sites += at(K("동시에 진행되는") + 0.15 * k, "card", "abs node t", f"현장 {k + 1}<small>작업 중</small>", style=f"left:1290px;top:{y}px;width:380px")
    sites += at(K("본사 관리자가 모든"), "wipe", "abs ln d", style=f"left:720px;top:{y + 58}px;width:560px", dur=0.9)
    sites += at(K("직접 확인하기는"), "fade", "abs", '<div class="pill" style="background:rgba(255,138,112,.12);color:#ffb3a3;border-color:rgba(255,138,112,.5)">확인?</div>', style=f"left:940px;top:{y + 30}px")
scene(t, head(t, "문제 ② 여러 현장이 동시에", "본사 한 곳에서 <em>모든 현장</em>을 직접 볼 수 없습니다")
      + at(t + 0.4, "card", "abs node g", '본사 관리자<small>안전수칙 준수 여부를 확인해야 함</small>', style="left:200px;top:430px;width:520px;font-size:44px") + sites
      + box(110, 860 - 20, at(t + 1, "fade", "note", badge("ex") + " 설명용 개념도")), chap=2)

t = K("작업 전 안전점검이 누락") - 0.4
a1 = [("안전점검 누락", K("작업 전 안전점검이 누락"), ""), ("위험요소 전달 안 됨", K("작업 도중 발생한"), ""), ("작은 부주의", K("작은 부주의가"), ""), ("심각한 안전사고", K("심각한 안전사고"), "w")]
cs = ""
for k, (a, tt, c) in enumerate(a1):
    cs += at(tt, "card", f"abs node {c}", a, style=f"left:{110 + k * 440}px;top:240px;width:390px;text-align:center")
    if k:
        cs += at(tt - 0.1, "fade", "abs arrow", "→", style=f"left:{110 + k * 440 - 48}px;top:272px")
imp = [("작업자 피해", K("작업자의 피해")), ("공사 중단", K("공사 중단")), ("납기 지연", K("납기 지연")), ("추가 비용", K("추가 비용 발생"))]
for k, (a, tt) in enumerate(imp):
    cs += at(tt, "up", "abs chip w", f"<i></i>{a}", style=f"left:{430 + k * 330}px;top:470px")
cs += at(K("안전사고는 작업자의"), "wipev", "abs lnv", style="left:1625px;top:336px;height:110px", dur=0.5)
cs += at(K("안전사고는 작업자의"), "wipe", "abs ln", style="left:520px;top:446px;width:1109px", dur=0.7)
cs += at(K("경영 전반"), "card", "abs node g", "기업 경영 전반에 영향<small>작업자 피해 · 공사 중단 · 납기 지연 · 추가 비용</small>", style="left:560px;top:640px;width:800px;text-align:center;font-size:44px")
scene(t, head(t, "문제 ② 확인이 빠지면", "작은 부주의가 <em>사고와 경영 손실</em>로") + cs
, chap=2)

t = K("이를 해결하기 위해 당사는", K("경영 전반")) - 0.4
ph3 = [("p2_field_first", "작업 전 · 시작 전 점검", K("작업 전, 작업 중", t)), ("p2_mid_deficient", "작업 중 · 진행 중 점검", K("작업 중, 작업 후", t)), ("p2_gate_end", "작업 후 · 마무리 점검", K("작업 후의", t))]
pb = ""
for k, (sid, lab, tt) in enumerate(ph3):
    x = 330 + k * 450
    mks = [pm(sid, 0, tt + 0.6)] if SC[sid]["marks"] else []
    pb += box(x, 190, at(tt, "card", "", phone(sid, 262, marks=mks, label=lab)))
pb += at(K("현장 업무 흐름에"), "wipe", "abs ln", style="left:470px;top:854px;width:900px", dur=1.0)
pb += at(K("현장 업무 흐름에") + 0.9, "up", "abs pill", "현장 업무 흐름(작업 시작 · 종료 버튼)에 연결", style="left:1390px;top:830px")
scene(t, head(t, "해결 ② 3단계 안전점검 — 실제 화면", "작업 전 · 중 · 후 점검이 <em>작업 버튼과 함께</em> 움직입니다") + pb, chap=2)

t = K("현장 직원은 단계별") - 0.4
scene(t, head(t, "해결 ② 점검 결과 · 사진 → 누락 확인 — 실제 화면", "결과와 사진을 올리면 <em>누락 · 미흡</em>을 확인합니다")
      + box(130, 196, at(t + 0.3, "card", "", phone("p2_pre_check", 290, marks=[pm("p2_pre_check", 1, K("사진을 등록하고"), 1)])))
      + box(600, 196, at(K("시스템은 필수 점검") - 0.4, "card", "", browser("p2_admin_review", 1200, 600, [(t, 230, 110, 800)],
                                                                           marks=[(248, 160, 766, 128, K("필수 점검의 누락"), 2), (248, 420, 330, 30, K("미흡한 항목을"), 3)]))), chap=2)

t = K("미흡한 안전점검이 남아") - 0.4
scene(t, head(t, "해결 ② 시작 제한 · 1순위 표시 — 실제 화면", "점검이 남아 있으면 <em>시작을 막고</em>, 본사 1순위로")
      + box(130, 196, at(t + 0.3, "card", "", phone("p2_gate_start", 290, marks=[pm("p2_gate_start", 1, K("작업 시작을 제한"), 1)], taps=[(*pc("p2_gate_start", 1), K("작업 시작을 제한") + 0.6)])))
      + box(600, 196, at(K("관리자에게 우선적으로") - 0.3, "card", "", browser("p2_admin_dash_safety", 1200, 600, [(t, 215, 120, 800)],
                                                                             marks=[(250, 157, 125, 98, K("관리자에게 우선적으로") + 0.4, 2), (250, 284, 374, 92, K("안전관리 대상으로"), 3)]))), chap=2)

t = K("관리자는 등록된 사진과") - 0.4
tdone = K("다시 확인할 수")
scene(t, head(t, "해결 ② 보완 요청 → 조치 → 재확인 — 실제 화면", "사진을 보고 <em>보완을 요청</em>하고, 조치까지 다시 확인")
      + box(110, 196, at(t + 0.3, "card", "", browser(None, 1200, 600, [(t, 230, 130, 800)], seq=[(t, "p2_admin_supp_req"), (tdone - 0.2, "p2_admin_supp_done")],
                                                     cur=[(t + 0.8, 700, 560, 0), (K("보완을 요청") + 0.3, 441, 487, 1)],
                                                     marks=[(250, 380, 765, 98, tdone + 0.3, 1), (250, 490, 765, 30, tdone + 0.7, 2)])))
      + box(1430, 196, at(K("현장 직원의 조치 결과") - 0.2, "card", "", phone("p2_field_supp", 290, marks=[pm("p2_field_supp", 0, K("현장 직원의 조치 결과") + 0.4)],
                                                                         taps=[(*pc("p2_field_supp", 0), K("현장 직원의 조치 결과") + 0.9)], label="현장 직원 — 보완 제출"))), chap=2)

t = K("또한 점검 과정과") - 0.4
te = K("단순히 안전점검표를") - 0.4
scene(t, head(t, "해결 ② 기록 — 실제 화면", "점검 과정과 조치 이력이 <em>그대로 남습니다</em>")
      + box(110, 196, at(t + 0.3, "card", "", browser(FULL / "f_safety.jpg", 1180, 600, [(t, 300, 60, 1100), (t + 1.2, 300, 60, 1100, "l"), (te - 0.5, 300, 900, 1100, "l")], url="hana-ax · 안전관리 · 검증 시나리오")))
      + f"""<div class="abs" style="left:1350px;top:250px;display:flex;flex-direction:column;gap:20px;align-items:flex-start">
{at(K("체계적으로 기록"), "left", "chip s", "<i></i>점검 단계 · 시각")}{at(K("체계적으로 기록") + 0.4, "left", "chip s", "<i></i>착용 사진")}{at(K("체계적으로 기록") + 0.8, "left", "chip s", "<i></i>보완 요청 · 조치")}{at(K("체계적으로 기록") + 1.2, "left", "chip s", "<i></i>확인한 사람 · 시각")}
{at(K("안전관리의 연속성"), "up", "body", "→ 안전관리의<br><span class='em'>연속성</span> 확보", style="margin-top:16px;font-size:42px;color:var(--ink)")}</div>""", chap=2)

t = te
flow2 = [("누락 · 미흡 발견", K("누락을 발견")), ("본사 1순위 표시", K("누락을 발견") + 0.5), ("보완 요청 · 조치", K("실제 대응과 재확인")), ("재확인 · 기록", K("실제 대응과 재확인") + 0.5)]
fb = ""
for k, (a, tt) in enumerate(flow2):
    fb += at(tt, "card", "abs node" + (" g" if k == 3 else ""), a, style=f"left:{110 + k * 440}px;top:560px;width:380px;text-align:center")
    if k:
        fb += at(tt - 0.1, "fade", "abs arrow", "→", style=f"left:{110 + k * 440 - 50}px;top:600px")
scene(t, f"""<div class="abs" style="left:110px;top:150px;width:1700px">
{at(t + 0.1, "up", "eyebrow", "문제 ② 정리")}
{at(t + 0.3, "up", "h1", "점검표 전산화가 아니라<br><em>누락 발견 → 대응 → 재확인</em>", style="margin-top:18px;font-size:80px")}</div>{fb}""", bg="slate", chap=2)

# ════════ 문제 ③ ════════
title_card(K("세 번째 문제") - 0.4, "03", "세 번째 문제 · 핵심 기술", "복수 현장의 연쇄적인 작업 지연", "하나정보통신이 가장 중점적으로 개발한 기술입니다", 21,
           sub_at=K("가장 중점적으로"), extra=at(K("핵심 기술입니다"), "up", "pill", "핵심 기술 · 특허출원 10-2026-0173957", style="margin-top:26px"))

t = K("정보통신공사업의 특성상") - 0.4
t2 = K("이때 첫 번째 현장의")
nodes = ""
for k in range(3):
    x = 900 + k * 330
    nodes += at(K("여러 현장을 순차적으로") + 0.35 * k, "card", "abs node t", f"현장 {k + 1}", style=f"left:{x}px;top:360px;width:270px;text-align:center")
    if k:
        nodes += at(K("여러 현장을 순차적으로") + 0.35 * k - 0.2, "fade", "abs arrow", "→", style=f"left:{x - 46}px;top:388px")
nodes += at(K("한 명의 직원이"), "up", "abs chip s", "<i></i>직원 1명 · 하루", style="left:900px;top:250px")
bars = [(900, 220, "예정", 0), (1230, 220, "예정", 0), (1560, 220, "예정", 0)]
for k, (x, w, _, _) in enumerate(bars):
    nodes += at(t2, "fade", "abs", '<div style="height:26px;border-radius:8px;border:2px dashed rgba(244,241,236,.45)"></div>', style=f"left:{x + 25}px;top:470px;width:{w}px")
nodes += at(K("예상보다 길어지면"), "wipe", "abs", '<div style="height:26px;border-radius:8px;background:linear-gradient(90deg,var(--gold),var(--warn))"></div>', style="left:925px;top:470px;width:330px", dur=1.0)
nodes += at(K("늦게 도착"), "up", "abs chip s w", "<i></i>늦게 도착", style="left:1235px;top:530px")
nodes += at(K("세 번째 현장으로"), "up", "abs chip s w", "<i></i>영향 이어짐", style="left:1565px;top:530px")
scene(t, show(t, t2 - 0.1, head(t, "문제 ③ 정보통신공사업의 특성", "한 사람이 하루에 <em>여러 현장</em>을 돕니다"))
      + show(t2 - 0.1, 9999, head(t2 - 0.3, "문제 ③ 연쇄 지연", "앞 현장이 길어지면 <em>다음, 그다음 현장</em>까지"))
      + box(110, 220, photo(ai("ai-van"), 700, 525, "ai", "다음 현장으로 이동 — 늦어진 출발이 뒤 일정 전체를 밀어냄 (연출)", t=t + 0.3)) + nodes
      + box(900, 640, at(t2 + 0.5, "fade", "note", badge("ex") + " 설명용 개념도 — 실제 계산 예시는 뒤에서 보여 드립니다")), chap=3)

t = K("이러한 연쇄적인 지연을") - 0.4
rows = [("고객과 약속한 방문시간을 지키기 어려움", K("고객과 약속한"), ""), ("다른 직원의 일정까지 변경", K("다른 직원의 일정까지"), ""),
        ("반복적인 일정 조정 · 추가 인력 투입", K("결국 반복적인"), ""), ("업무 효율성 저하", K("업무 효율성이"), ""), ("공사원가 증가 · 고객 신뢰도 저하", K("공사원가 증가와"), "w")]
rb = "".join(at(tt, "left", "row " + c, a) for a, tt, c in rows)
scene(t, head(t, "문제 ③ 늦게 발견하면", "약속 · 인력 · 원가가 <em>연달아 흔들립니다</em>")
      + f'<div class="abs" style="left:110px;top:230px;width:1050px;display:flex;flex-direction:column;gap:20px">{rb}</div>'
      + box(1240, 230, photo(ai("ai-map"), 570, 428, "ai", "하루 동선 — 여러 현장 (연출)", t=t + 0.4)), chap=3)

t = K("당사는 이러한 문제를 해결하기 위해") - 0.4
blk = [("작업상태 이벤트", "작업 시작 · 종료<br>바뀐 예상 종료 보고", K("작업상태 이벤트")), ("시공간 제약정보", "현장 순서 · 이동시간<br>다음 현장 예정 시작", K("시공간 제약정보")),
       ("연쇄위험 판단", "후속 현장 도착 · 부족 시간<br>위험 등급 · 우선순위", K("연쇄위험 판단 기술"))]
eq = ""
for k, (a, b, tt) in enumerate(blk):
    x = 110 + k * 600
    eq += at(tt, "card", "abs glass card" + (" gline" if k == 2 else ""), f'<h3 style="font-size:48px">{a}</h3><p style="font-size:30px">{b}</p>', style=f"left:{x}px;top:330px;width:500px;height:290px" + (";background:rgba(210,164,95,.14);border-color:rgba(224,181,111,.6)" if k == 2 else ""))
eq += at(K("시공간 제약정보") - 0.15, "fade", "abs", '<div style="font-size:80px;font-weight:300;color:var(--gold)">+</div>', style="left:632px;top:420px")
eq += at(K("연쇄위험 판단 기술") - 0.15, "fade", "abs", '<div style="font-size:70px;font-weight:600;color:var(--gold)">→</div>', style="left:1226px;top:425px")
scene(t, head(t, "해결 ③ 핵심 기술 — 특허출원 10-2026-0173957", "작업상태 + 시공간 제약 → <em>연쇄위험 판단</em>") + eq
      + box(110, 690, at(K("연쇄위험 판단 기술") + 0.8, "fade", "note", "규칙 기반 계산입니다 (AI 예측 아님) · 일정은 관리자가 정하고, 프로그램은 바뀐 조건으로 다시 계산합니다", style="font-size:26px")), chap=3)

# ── 계산 타임라인 (실제 계산값과 같은 숫자 · 시각이 위치를 정함) ──
t = K("예를 들어 한 직원이") - 0.4
X = lambda hh, mm=0: round(330 + ((hh - 11) * 60 + mm) * 6)  # noqa: E731
rows_y = {"보령": 330, "홍성": 500, "예산": 670}
tl = ""
for hh in range(11, 16):
    tl += f'<div class="abs" style="left:{X(hh)}px;top:250px;width:1px;height:520px;background:rgba(23,27,32,.12)"></div><div class="abs note" style="left:{X(hh) - 30}px;top:212px;font-size:24px;font-weight:700">{hh}:00</div>'
for name, lab in [("보령", "1. 보령 지사"), ("홍성", "2. 홍성 물류센터"), ("예산", "3. 예산 매장")]:
    tl += at(K("보령, 홍성, 예산") + 0.3 * list(rows_y).index(name), "left", "abs", f'<div style="font-size:34px;font-weight:800;color:var(--char)">{lab}</div>', style=f"left:110px;top:{rows_y[name] + 8}px")
plan = [("보령", X(11), X(12), "예정 11:00~12:00"), ("홍성", X(12, 30), X(13, 30), "예정 12:30~13:30"), ("예산", X(14), X(14, 50), "예정 14:00~14:50")]
for k, (name, a, b, lab) in enumerate(plan):
    tl += at(K("순차적으로 방문한다고") + 0.3 * k, "fade", "abs", f'<div style="height:60px;border-radius:12px;border:3px dashed rgba(23,27,32,.35);background:rgba(255,255,255,.5)"></div><div class="note" style="margin-top:8px;font-size:22px;font-weight:700">{lab}</div>', style=f"left:{a}px;top:{rows_y[name]}px;width:{b - a}px")
y = rows_y["보령"]
tl += at(K("보령 현장의 예상 종료시각"), "wipe", "abs", '<div style="height:60px;border-radius:12px;background:#b97935"></div>', style=f"left:{X(11)}px;top:{y}px;width:{X(12) - X(11)}px", dur=0.6)
tl += at(K("오후 1시로"), "wipe", "abs", '<div style="height:60px;border-radius:0 12px 12px 0;background:#c0442c"></div>', style=f"left:{X(12) - 8}px;top:{y}px;width:{X(13) - X(12) + 8}px", dur=0.8)
tl += at(K("오후 1시로") + 0.5, "up", "abs", '<div style="font-size:30px;font-weight:850;color:#c0442c">예상 종료 13:00 (+1시간)</div>', style=f"left:{X(13) + 16}px;top:{y + 12}px")
y2 = rows_y["홍성"]
tl += at(K("20분이 필요하다면"), "wipev", "abs", '<div style="width:4px;height:120px;background:repeating-linear-gradient(180deg,#171b20 0 10px,transparent 10px 18px)"></div>', style=f"left:{X(13)}px;top:{y + 60}px", dur=0.5)
tl += at(K("20분이 필요하다면") + 0.4, "wipe", "abs", '<div style="height:6px;margin-top:27px;background:#171b20;border-radius:3px"></div>', style=f"left:{X(13)}px;top:{y2}px;width:{X(13, 20) - X(13)}px", dur=0.5)
tl += at(K("20분이 필요하다면") + 0.5, "up", "abs", '<div class="pill">이동 20분</div>', style=f"left:{X(13) - 40}px;top:{y2 - 52}px")
tl += at(K("오후 1시 20분이"), "fade", "abs", '<div style="width:6px;height:96px;background:#171b20;border-radius:3px"></div>', style=f"left:{X(13, 20) - 3}px;top:{y2 - 18}px")
tl += at(K("오후 1시 20분이") + 0.2, "up", "abs", '<div style="font-size:30px;font-weight:850;color:var(--char)">도착 13:20</div>', style=f"left:{X(13, 20) + 14}px;top:{y2 + 72}px")
tl += at(K("오후 12시 30분이라면"), "fade", "abs", '<div style="width:6px;height:96px;background:#3f8585;border-radius:3px"></div>', style=f"left:{X(12, 30) - 3}px;top:{y2 - 18}px")
tl += at(K("50분의 시간이"), "wipe", "abs", '<div style="height:60px;background:repeating-linear-gradient(45deg,rgba(192,68,44,.35) 0 10px,rgba(192,68,44,.12) 10px 20px);border:3px solid #c0442c;border-radius:10px"></div>', style=f"left:{X(12, 30)}px;top:{y2}px;width:{X(13, 20) - X(12, 30)}px", dur=0.7)
tl += at(K("50분의 시간이") + 0.3, "up", "abs", '<div style="font-size:54px;font-weight:900;color:#c0442c;letter-spacing:-1.5px">50분 부족</div>', style=f"left:{X(12, 30) - 280}px;top:{y2 + 66}px")
y3 = rows_y["예산"]
tl += at(K("그리고 이러한 지연이"), "wipe", "abs", '<div style="height:60px;border-radius:12px;background:#b97935;opacity:.85"></div>', style=f"left:{X(13, 20)}px;top:{y2}px;width:{X(14, 20) - X(13, 20)}px", dur=0.8)
tl += at(K("그리고 이러한 지연이") + 0.6, "up", "abs", '<div style="font-size:26px;font-weight:800;color:var(--char)">종료 14:20</div>', style=f"left:{X(14, 20) + 12}px;top:{y2 + 14}px")
tl += at(K("예산 현장에"), "wipe", "abs", '<div style="height:6px;margin-top:27px;background:#171b20;border-radius:3px"></div>', style=f"left:{X(14, 20)}px;top:{y3}px;width:{X(14, 45) - X(14, 20)}px", dur=0.5)
tl += at(K("예산 현장에") + 0.1, "up", "abs", '<div class="pill">이동 25분</div>', style=f"left:{X(14, 20) - 30}px;top:{y3 - 52}px")
tl += at(K("얼마나 영향을"), "wipe", "abs", '<div style="height:60px;background:repeating-linear-gradient(45deg,rgba(192,68,44,.35) 0 10px,rgba(192,68,44,.12) 10px 20px);border:3px solid #c0442c;border-radius:10px"></div>', style=f"left:{X(14)}px;top:{y3}px;width:{X(14, 45) - X(14)}px", dur=0.7)
tl += at(K("얼마나 영향을") + 0.3, "up", "abs", '<div style="font-size:30px;font-weight:850;color:var(--char)">도착 14:45</div>', style=f"left:{X(14, 45) + 14}px;top:{y3 + 72}px")
tl += at(K("연쇄적으로 산출"), "up", "abs", '<div style="font-size:54px;font-weight:900;color:#c0442c;letter-spacing:-1.5px">45분 부족</div>', style=f"left:{X(14) - 290}px;top:{y3 + 66}px")
scene(t, head(t, "예시 — 보령 → 홍성 → 예산 (김현장 기사 하루 3곳)", "보고 하나로 <em>다음 현장의 부족 시간</em>을 미리 계산", light=True)
      + tl + box(1430, 150, at(t + 0.6, "fade", "", badge("calc", "실제 프로그램 계산값 · 검증 시나리오(시험용 일정)"))), bg="ivory", chap=3)

t = K("시스템은 작업상태의 변화") - 0.4
tB = K("위험의 크기와 영향") - 0.3
fac = [("작업상태 변화", K("작업상태의 변화")), ("예상 종료시각", K("예상 종료시각, 이동시간")), ("이동시간", K("이동시간,", K("예상 종료시각, 이동시간"))), ("위험 크기 · 영향 범위", K("위험의 크기와 영향"))]
fc = "".join(at(tt, "left", "chip s", f"<i></i>{a}") for a, tt in fac)
scene(t, head(t, "해결 ③ 대응 우선순위 — 실제 화면", "여러 조건을 종합해 <em>무엇부터 볼지</em> 정합니다")
      + box(110, 196, at(t + 0.3, "card", "", show(0, tB, browser("p3_chain_report", 1180, 600, [(t, 250, 150, 780)], marks=[(255, 324, 745, 30, K("예상 종료시각, 이동시간"), 1), (255, 358, 745, 30, K("이동시간,", K("예상 종료시각, 이동시간")), 2)], label="본사 PC — 사건 상세 · 후속 현장 위험"))
                                             + show(tB, 9999, browser(FULL / "f_judg.jpg", 1180, 600, [(tB, 320, 3050, 1060)], marks=[(1220, 3140, 130, 40, K("대응 우선순위") - 0.2, 3), (340, 3292, 1000, 186, tB + 0.6, 4)],
                                                                      label="본사 PC — 판단 기록 · 대응 우선순위", url="hana-ax · 판단 기록 · 검증 시나리오"), style="position:absolute;left:0;top:0"), style="position:relative;width:1180px;height:700px"))
      + f'<div class="abs" style="left:1350px;top:250px;display:flex;flex-direction:column;gap:18px;align-items:flex-start">{fc}</div>'
      + box(1350, 600, at(K("대응 우선순위") + 0.2, "card", "glass card gline", '<div class="eyebrow" style="font-size:22px">1순위 · 홍성 물류센터 작업지연</div><div style="font-size:64px;font-weight:900;margin-top:6px">130<span style="font-size:30px;font-weight:700"> 점</span></div><p style="font-size:24px;margin-top:4px">= 60 + 50 + 10 + 10 + 0 · 규칙 기반 점수</p>'), w=460), chap=3)

t = K("관리자가 이를 확인하고") - 0.4
tr = K("변경된 조건을 반영하여")
scene(t, head(t, "해결 ③ 조치 후 다시 계산 — 실제 화면", "일정을 고치면 <em>바뀐 조건으로 다시 계산</em>합니다")
      + box(110, 196, at(t + 0.3, "card", "", browser(None, 1180, 600, [(t, 240, 200, 790), (tr + 0.8, 240, 200, 790), (tr + 1.4, 240, 240, 790)], seq=[(t, "p3_adjust1_form"), (tr + 1.0, "p3_adjust1_result")],
                                                     cur=[(t + 0.6, 700, 560, 0), (K("일정을 조정") + 0.2, 718, 295, 1), (tr, 300, 407, 1)],
                                                     marks=[(250, 300, 765, 48, K("다시 계산합니다") - 0.3, 1)])))
      + f"""<div class="abs" style="left:1360px;top:250px;width:460px">
{at(K("일정을 조정") + 0.4, "up", "glass card", '<div class="eyebrow" style="font-size:22px">1차 조치</div><h3 style="font-size:36px;margin-top:8px">홍성 시작 12:30 → 13:25</h3><p style="font-size:24px">관리자가 고객 연락 후 입력</p>')}
{at(K("다시 계산합니다"), "up", "", '<div class="eyebrow" style="margin-top:40px">위험 연결 수 (그날 전체)</div><div class="big" style="margin-top:10px">2 <span style="color:var(--gold)">→ 1</span></div>')}</div>""", chap=3)

t = K("첫 번째 조치로") - 0.4
scene(t, head(t, "해결 ③ 남은 위험은 다시 제시 — 실제 화면", "한 곳이 풀려도 <em>남은 위험</em>은 다시 올립니다")
      + box(110, 196, at(t + 0.3, "card", "", browser("p3_adjust1_result", 1180, 600, [(t, 240, 240, 790)], marks=[(250, 300, 765, 48, K("일부 위험이 해소"), 1)])))
      + f"""<div class="abs" style="left:1350px;top:240px;width:470px;display:flex;flex-direction:column;gap:20px">
{at(K("일부 위험이 해소"), "left", "row", '보령 → 홍성<small>여유 5분 · 해소</small>', style="border-left-color:var(--teal2);font-size:34px")}
{at(K("위험이 남아 있거나"), "left", "row w", '홍성 → 예산<small>50분 부족 · 남음</small>', style="font-size:34px")}
{at(K("다시 관리자에게 제시"), "up", "glass card gline", '<h3 style="font-size:34px">다시 관리자에게 제시</h3><p style="font-size:24px">2차 조치: 예산 시작 14:00 → 15:00</p>')}</div>
{box(110, 840, at(t + 1, "fade", "note", "1차 조치 후 숫자: 실제 프로그램 계산값 (검증 시나리오)"))}""", chap=3)

t = K("이처럼 개별 현장의 문제를") - 0.4
scene(t, head(t, "문제 ③ 정리 — 핵심 차별성", "시작 전 현장까지 계산하고, <em>조치 뒤에도 다시 판단</em>")
      + box(110, 196, at(t + 0.3, "card", "", browser("p3_chain_after", 1080, 560, [(t, 250, 150, 780)], marks=[(678, 324, 330, 30, K("지속적으로 재판단") - 0.2, 1), (678, 358, 330, 30, K("지속적으로 재판단") + 0.3, 2)], label="본사 PC — 조치 후 연쇄 영향")))
      + f"""<div class="abs" style="left:1260px;top:230px;width:560px;display:flex;flex-direction:column;gap:22px">
{at(K("확인하는 데 그치지"), "left", "row", '기존 — 개별 현장 문제 확인', style="opacity:.6;border-left-color:rgba(244,241,236,.4);font-size:34px")}
{at(K("후속 현장의 위험"), "left", "row", '<span class="em">후속 현장 위험</span>까지 계산', style="font-size:34px")}
{at(K("지속적으로 재판단"), "left", "row", '조치 뒤 <span class="em">지속 재판단</span><small>2 → 1 → 0</small>', style="font-size:34px")}
{at(K("핵심 차별성"), "card", "glass card gline", '<div class="eyebrow">하나정보통신 기술의</div><div class="h1" style="font-size:72px;margin-top:6px"><em>핵심 차별성</em></div>', style="margin-top:12px;background:rgba(210,164,95,.14)")}</div>""", chap=3)

# ════════ 성과 · 계획 ════════
title_card(GAP["P2"] - 0.15, "→", "기술개발 성과 및 향후 방향", "현장 경험을 기술로", "개발 · 특허 · 자체시험, 그리고 정식 운영으로", 47)

t = K("하나정보통신은 이러한 현장 문제를") - 0.4
M = lambda m: round(200 + (m - 6) * 175)  # 2026년 m월 위치 (6월=0)  # noqa: E731
ms = ""
ms += at(t + 0.4, "wipe", "abs ln", style=f"left:{M(6)}px;top:560px;width:{M(12) - M(6)}px", dur=1.2)
ms += at(K("2027년 초 정식 운영"), "wipe", "abs ln d", style=f"left:{M(12)}px;top:560px;width:{M(15) - M(12)}px", dur=1.0)
for m, tt in [(7, K("2026년 7월")), (9, K("특허출원")), (11, K("746건"))]:
    ms += at(tt, "fade", "abs", '<i style="display:block;width:24px;height:24px;border-radius:50%;background:#b97935;box-shadow:0 0 0 7px rgba(185,121,53,.2)"></i>', style=f"left:{M(m) - 12}px;top:550px")
ms += at(K("2026년 7월"), "card", "abs glass card", '<div class="eyebrow" style="font-size:22px">2026.07</div><h3 style="font-size:38px;margin-top:6px">본격 프로그램 개발</h3><p style="font-size:24px">현장 휴대폰 · 본사 PC · 위험 판단 엔진</p>', style=f"left:{M(7) - 60}px;top:250px;width:440px")
ms += at(K("특허출원"), "card", "abs glass card", '<div class="eyebrow" style="font-size:22px">2026.09</div><h3 style="font-size:38px;margin-top:6px">핵심 위험판단 기술<br>특허출원</h3><p style="font-size:24px">출원번호 10-2026-0173957</p>', style=f"left:{M(9) - 60}px;top:610px;width:440px")
ms += at(K("746건"), "card", "abs glass card", f'<div class="eyebrow" style="font-size:22px">2026.11 · 개발환경 자체시험</div><div style="font-size:110px;font-weight:900;letter-spacing:-4px;line-height:1.05;margin-top:4px"><span data-count="746" data-at="{K("746건"):.2f}">0</span><span style="font-size:40px;font-weight:800"> 건 통과</span></div><p style="font-size:22px">lint · build + 시험 7묶음 · 실패 0 (2026-11-18)</p>', style=f"left:{M(11) - 120}px;top:190px;width:560px;background:#171b20;color:#f4f1ec;border-color:#171b20")
ms += at(K("2027년 초 정식 운영"), "card", "abs glass card", '<div style="display:flex;gap:10px;align-items:center"><div class="eyebrow" style="font-size:22px">2027년 초</div>' + badge("plan", "목표") + '</div><h3 style="font-size:38px;margin-top:6px">정식 운영</h3><p style="font-size:24px">검증 · 안정화 진행 중</p>', style=f"left:{M(13) - 40}px;top:610px;width:400px;border-style:dashed")
ms += at(K("현장 데이터"), "up", "abs pill", "→ 쌓이는 현장 데이터로 위험판단을 더 정확하게 (계획)", style=f"left:{M(11) - 120}px;top:820px")
scene(t, head(t, "기술개발 성과", "현장 문제에서 출발해 <em>개발 · 특허 · 검증</em>까지") + ms, bg="ivory", chap=4)

t = K("나아가 정보통신공사업뿐만") - 0.4
hub = at(t + 0.4, "card", "abs node g", '정보통신공사<small>지금 — 하나정보통신의 현장</small>', style="left:1120px;top:430px;width:380px;text-align:center;font-size:40px")
ind = [("전기공사", K("전기공사"), 1000, 230), ("소방공사", K("소방공사"), 1460, 230), ("설비공사", K("설비공사"), 1000, 650), ("시설관리", K("시설관리"), 1460, 650)]
for a, tt, x, y in ind:
    hub += at(tt, "card", "abs node t", a, style=f"left:{x}px;top:{y}px;width:300px;text-align:center;font-size:40px")
hub += at(K("유사한 문제를 경험하는"), "up", "abs pill", "공통 문제: 지원 요청 지연 · 안전 확인 누락 · 연쇄 일정 지연", style="left:110px;top:830px")
pg = ""
for k, (n, cap) in enumerate([("x-017-033", "통신 배선"), ("x-016-029", "CCTV"), ("x-016-030", "방송 · 음향 설비"), ("x-016-031", "학교 시설")]):
    pg += box(110 + (k % 2) * 380, 230 + (k // 2) * 290, photo(co(n), 360, 270, "co", cap, kb=0, t=t + 0.4 + 0.2 * k))
scene(t, head(t, "적용 범위 확대 (계획)", "같은 문제를 겪는 <em>다양한 현장산업</em>으로") + pg + hub, chap=4)

t = K("오랜 현장 경험에서") - 0.4
tl3 = K("이것이 하나정보통신이")
scene(t, f"""<div class="abs" style="left:160px;top:250px;width:1600px;text-align:center">
{at(t + 0.3, "up", "h1", "오랜 현장 경험에서 발견한 문제를 <em>기술로</em>", style="font-size:72px")}
{at(K("문제가 발생한 이후의"), "up", "h1", "문제 이후의 대응을 넘어<br><em>앞으로 발생할 위험까지 사전에 판단</em>", style="font-size:64px;margin-top:30px")}</div>
{show(tl3 - 0.2, 9999, f'''<div class="abs" style="left:0;right:0;top:560px;display:flex;justify-content:center;align-items:center;gap:40px">
{at(tl3, "card", "logo", "H<i></i>")}<div>{at(tl3 + 0.2, "up", "eyebrow", "(주)하나정보통신", style="font-size:30px")}{at(tl3 + 0.35, "up", "h1", "복수 현장 업무 위험관리 <em>AX 시스템</em>", style="font-size:66px;margin-top:6px")}
{at(tl3 + 0.6, "fade", "note", "특허출원 10-2026-0173957 · 화면은 실제 프로그램(v0.6.1) · 사례 일정과 인물은 검증 시나리오(시험용)", style="margin-top:12px")}</div></div>''')}""", bg="flow", flow=7)

# ════════ 조립 ════════
SCENES.sort(key=lambda s: s[0])
html = ""
for k, (st, bg, body) in enumerate(SCENES):
    end = SCENES[k + 1][0] if k + 1 < len(SCENES) else END
    html += f'<section class="scene {bg}" data-start="{st:.2f}" data-end="{end:.2f}">{body}</section>'
subs = [dict(s) for s in SUBS]
for i, s in enumerate(subs):
    s["fi"] = 1; s["fo"] = 1
for i in range(len(subs) - 1):
    if subs[i + 1]["in"] - subs[i]["out"] < 0.3:
        subs[i]["out"] = subs[i + 1]["in"]; subs[i]["fo"] = 0; subs[i + 1]["fi"] = 0
(H / "player.html").write_text(page(html, subs))
json.dump({"end": END, "scenes": [[s[0], s[1]] for s in SCENES]}, open(H / "timeline.json", "w"), ensure_ascii=False, indent=1)
print("scenes", len(SCENES), "end", END)
