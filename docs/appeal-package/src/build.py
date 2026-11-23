"""보완자료 패키지 생성 — html/*.html 을 만든다. PDF는 render.mjs.
실행: python3 docs/appeal-package/src/build.py [문서번호 …]   (예: 01 04)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit import ROOT, Kit, render  # noqa: E402
import importlib  # noqa: E402

K = Kit()
DOCS = []
for name in ("d_intro", "d_tech", "d_screens", "d_diff", "d_rd", "d_future"):
    try:
        m = importlib.import_module(name)
    except ModuleNotFoundError as e:
        if e.name != name:
            raise
        print(f"(아직 없음) {name}")
        continue
    DOCS += m.docs(K)

want = sys.argv[1:]
(ROOT / "html").mkdir(exist_ok=True)
for meta, fn, art in DOCS:
    if want and meta["code"] not in want:
        continue
    pages = fn()
    (ROOT / "html" / f"{meta['file']}.html").write_text(render(meta, pages, art))
    print(f"{meta['code']} {meta['file']}: {len(pages) + 1}쪽")
K.save()
