"""보완자료 00~12를 PDF 한 개로 합친다 — 맨 앞에 합본 차례 1쪽, 자료마다 책갈피(목차).
내부용 99는 넣지 않는다(제출하지 않는 자료).
실행: python3 docs/appeal-package/src/merge.py   (pypdf 필요: pip install pypdf)
결과: docs/appeal-package/merged/하나정보통신_벤처확인_보완자료_전체합본.pdf
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pypdf import PdfReader, PdfWriter  # noqa: E402

from kit import COMMIT, COMPANY, PATENT_NO, TECH, WRITTEN, B, head, key, table  # noqa: E402
from d_intro import ITEMS, PKG  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "merged" / "하나정보통신_벤처확인_보완자료_전체합본.pdf"

pdfs = sorted(p for p in (ROOT / "pdf").glob("*.pdf") if p.name[:2].isdigit() and p.name[:2] != "99")
if len(pdfs) != 13:
    sys.exit(f"자료가 13개가 아님: {[p.name for p in pdfs]}")
readers = [PdfReader(str(p)) for p in pdfs]

# 쪽 번호(합본 기준) — 차례 1쪽 다음부터
start, rows = 2, []
by_doc = {}
for n, it, _b, _w, pdf, _l in ITEMS:
    for code in pdf.replace(" ", "").split("·"):
        by_doc.setdefault(code, []).append(str(n))
for (code, title, desc, _kind), r in zip(PKG, readers):
    n = len(r.pages)
    rows.append([f"<b>{code}</b>", f"<b>{title}</b><br><small style='color:#75818a'>{desc}</small>", ", ".join(by_doc.get(code, [])) or "전체", f"<b>{start}</b> ~ {start + n - 1}", str(n)])
    start += n
total = start - 1

body = "".join([
    head("합본 차례", f"보완자료 13종 · <em>합본 {total}쪽</em>", f"{COMPANY} · {TECH} · 관련 특허출원 {PATENT_NO}. 각 자료는 따로 제출한 PDF와 내용이 같고, 이 합본에서는 아래 쪽 번호(합본 기준)에서 시작합니다. PDF 책갈피로도 바로 이동할 수 있습니다."),
    table(["번호", "자료", "답하는 보완 요청", "합본 쪽", "쪽수"], rows, cls="", widths=["7%", "55%", "14%", "14%", "10%"]),
    key("처음 보시는 경우 — <em>00 대응표(2쪽) → 01 핵심 요약(5쪽~)</em>을 먼저 보시면 전체가 10분 안에 잡힙니다.", f"표시: {B('real')} 실제 프로그램 화면 · {B('calc')} 프로그램 계산 예시 · {B('plan')} 계획 · {B('fill')} 회사 기재 · {B('zero')} — 측정하지 않은 효과 수치는 넣지 않았습니다."),
])
html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>합본 차례</title><link rel="stylesheet" href="../../src/pkg.css"></head><body>
<section class="page"><header class="top"><div class="logo"><div class="mk">H<i></i></div><div><b>{COMPANY}</b><small>{TECH}</small></div></div>
<div class="doccode"><span class="no">합본</span>벤처기업확인 이의신청 보완자료 전체</div></header>
<main>{body}</main>
<footer class="bot"><span><b>합본 차례</b> · 기준 프로그램 v0.6.1 · {COMMIT} · 작성 {WRITTEN}</span><span>1 / {total}</span></footer></section></body></html>"""
tdir = ROOT / "html" / "toc"
tdir.mkdir(parents=True, exist_ok=True)
(tdir / "toc.html").write_text(html)
build = ROOT / "merged" / ".toc"
subprocess.run(["node", str(ROOT / "src" / "render.mjs")], check=True, env={**__import__("os").environ, "RENDER_DIR": "html/toc", "PDF_DIR": "merged/.toc"})
toc = PdfReader(str(build / "toc.pdf"))
if len(toc.pages) != 1:
    sys.exit("차례가 1쪽이 아님")

w = PdfWriter()
w.append(toc)
w.add_outline_item(title="합본 차례", page_number=0)
page = 1
for (code, title, *_r), r in zip(PKG, readers):
    w.append(r)
    w.add_outline_item(title=f"{code} {title}", page_number=page)
    page += len(r.pages)
w.add_metadata({"/Title": f"{COMPANY} 벤처기업확인 이의신청 보완자료 전체 합본", "/Author": COMPANY, "/Subject": TECH})
w.page_mode = "/UseOutlines"
OUT.parent.mkdir(exist_ok=True)
with open(OUT, "wb") as f:
    w.write(f)
print(f"{OUT.name}: {page}쪽 (차례 1 + 자료 {page - 1})")
