"""영상 썸네일 (1920×1080) — 영상과 같은 디자인(남색 · 금 · 흐름선 · 실제 화면 기기 틀)"""
import sys

from lib3 import H, badge, box, browser, phone, uri
from assets3 import CSS, JS
from lib3 import FONT

DUR = sys.argv[1] if len(sys.argv) > 1 else "7:12"
flow = uri(H / "bg" / "flow_47.jpg")
body = f"""
<section class="scene navy" data-start="0" data-end="99" style="display:block">
<div class="bgimg" style="background-image:url({flow});opacity:.55"></div><div class="grid"></div>
<div class="abs" style="left:96px;top:118px;width:900px">
  <div class="eyebrow" style="font-size:30px">(주)하나정보통신 · 기술검증영상</div>
  <div class="h1" style="font-size:96px;margin-top:22px;line-height:1.12">복수 현장 업무<br><em>위험관리 AX 시스템</em></div>
  <div style="display:flex;flex-direction:column;gap:18px;margin-top:46px;align-items:flex-start">
    <span class="chip s"><i></i>① 현장 지원 요청의 지연</span>
    <span class="chip s"><i></i>② 현장 안전 확인의 누락</span>
    <span class="chip s g"><i></i>③ 복수 현장 연쇄 지연 · 핵심 기술</span>
  </div>
  <div class="pill" style="margin-top:36px;font-size:28px">특허출원 10-2026-0173957</div>
</div>
{box(880, 170, browser("p13_admin_dash", 650, 440, [(0, 232, 470, 760)], marks=[(675, 550, 262, 95, 0, 1)], label="본사 관리자 PC"))}
{box(1572, 220, phone("p1_field_ask", 252, marks=[(50, 233, 290, 50, 0, 2)], label="현장 휴대폰"))}
<div class="abs" style="left:96px;bottom:70px;display:flex;align-items:center;gap:16px">{badge("real")}<span class="note" style="font-size:26px;color:var(--ink2)">실제 프로그램 작동 화면 · {DUR}</span></div>
<div class="abs" style="right:84px;bottom:58px;display:flex;align-items:center;gap:16px;background:#fff;color:#171b20;border-radius:16px;padding:20px 34px;font-size:38px;font-weight:800;box-shadow:0 20px 50px rgba(0,0,0,.45)">
  <svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L24 15 L2 28 Z" fill="#171b20"/></svg>영상 보기</div>
</section>"""
html = ("<!doctype html><html lang='ko'><head><meta charset='utf-8'><style>" + CSS.replace("%FONT%", uri(FONT))
        + ".mk{opacity:1}</style></head><body>" + body + "<div id='sub'></div><script>window.SUBS=[];" + JS + "seek(5);</script></body></html>")
(H / "thumb.html").write_text(html)
print("thumb.html")
