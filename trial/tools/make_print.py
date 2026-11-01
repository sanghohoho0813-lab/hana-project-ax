"""비교시험 인쇄물 생성 — 판단 기준표·수기 시험지·답안지·조치 카드·기록지·참가자 정보·정답표(진행요원용)

모든 인쇄물은 data/scenarios.json(입력)과 data/answer-key.json(정답)에서 바로 만든다. 손으로 옮겨 적지 않으므로
화면·시험지·정답표의 숫자가 어긋날 수 없다. 결과는 trial/print/*.html (브라우저에서 A4로 인쇄).

    python3 trial/tools/make_print.py
"""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, OUT = ROOT / "data", ROOT / "print"
SCEN = json.loads((DATA / "scenarios.json").read_text(encoding="utf-8"))
KEY = json.loads((DATA / "answer-key.json").read_text(encoding="utf-8"))
WORKERS = SCEN["workers"]
SC = {s["id"]: s for s in SCEN["scenarios"]}
SETS = {"연습": ["R1", "R2"], "A": ["A1", "A2", "A3", "A4", "A5"], "B": ["B1", "B2", "B3", "B4", "B5"]}
DOW = {"2026-07-10": "금", "2026-07-14": "화", "2026-07-16": "목"}
NOTE = "비교시험용 가상 시나리오 · 실제 운영데이터 아님"
CAP1, CAP2 = 10, 5  # 1부·2부 제한시간(분)


def sha(name):
    return hashlib.sha256((DATA / name).read_bytes()).hexdigest()


def e(s):
    return html.escape(str(s))


def m(t):
    h, mm = t.split(":")
    return int(h) * 60 + int(mm)


def hm(v):
    return f"{v // 60:02d}:{v % 60:02d}"


def region(sc, sid):
    return next(s["region"] for s in sc["sites"] if s["id"] == sid)


def pair(sc, key):
    a, b = key.split(">")
    return f"{region(sc, a)} → {region(sc, b)}"


def reports(sc):
    out = []
    for s in sc["sites"]:
        if s["status"] == "완료" and s.get("actualEnd"):
            out.append(f'{s["region"]}: 작업개시 {s["actualStart"]} · 완료 보고 {s["actualEnd"]}')
        elif s.get("actualStart"):
            out.append(f'{s["region"]}: 작업개시 {s["actualStart"]}' + (f' · 현장 보고 예상 종료 {s["expectedEnd"]}' if s.get("expectedEnd") else ""))
    return out


def head(sc):
    return f'{sc["date"]} ({DOW.get(sc["date"], "")}) · 기준시각 {sc["asOf"]}'


def action_text(sc):
    a = sc["action"]
    s = next(x for x in sc["sites"] if x["id"] == a["siteId"])
    dur = m(s["plannedEnd"]) - m(s["plannedStart"])
    return (f'{s["region"]} 현장 시작을 <b>{s["plannedStart"]} → {a["newStart"]}</b>으로 바꿉니다 '
            f'(작업시간 {dur}분 그대로 → {a["newStart"]}~{hm(m(a["newStart"]) + dur)})')


CSS = """
@page { size: A4; margin: 13mm 13mm 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #191f28; font-size: 11.5pt; line-height: 1.45; margin: 0; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 18pt; margin: 0 0 2mm; }
h2 { font-size: 13pt; margin: 4mm 0 2mm; }
.sub { color: #6b7684; font-size: 9.5pt; }
.tag { display: inline-block; border: 1.2pt solid #191f28; border-radius: 3mm; padding: 0.5mm 3mm; font-weight: 800; font-size: 10.5pt; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 0.8pt solid #9aa3ad; padding: 1.6mm 2mm; text-align: left; vertical-align: top; }
th { background: #f2f4f6; font-size: 10pt; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
.box { border: 1pt solid #9aa3ad; border-radius: 2mm; padding: 2.5mm 3.5mm; margin: 2.5mm 0; }
.grid { height: 70mm; border: 1pt dashed #9aa3ad; border-radius: 2mm; background-image: linear-gradient(#eef0f2 0.5pt, transparent 0.5pt), linear-gradient(90deg, #eef0f2 0.5pt, transparent 0.5pt); background-size: 5mm 5mm; }
.blank td { height: 9mm; }
.row { display: flex; gap: 4mm; }
.row > * { flex: 1; }
.card { border: 1.4pt dashed #191f28; border-radius: 3mm; padding: 5mm; height: 60mm; margin-bottom: 6mm; }
.card .big { font-size: 15pt; line-height: 1.5; margin-top: 3mm; }
.warn { border: 1.4pt solid #dc2626; color: #b91c1c; font-weight: 800; padding: 2mm 3mm; border-radius: 2mm; }
ol, ul { margin: 1mm 0 1mm 5mm; padding-left: 3mm; }
li { margin: 0.6mm 0; }
.risk { color: #b91c1c; font-weight: 800; }
.foot { margin-top: 3mm; color: #6b7684; font-size: 8.5pt; }
"""


def doc(title, pages):
    return (f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{e(title)}</title>'
            '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">'
            f'<style>{CSS}</style></head><body>' + "".join(f'<div class="page">{p}</div>' for p in pages) + "</body></html>\n")


def schedule_table(sc):
    rows = "".join(
        f'<tr><td>{e(WORKERS[s["workerId"]])}</td><td><b>{e(s["region"])}</b></td><td>{e(s["title"].split(" · ")[1])}</td>'
        f'<td class="n">{s["plannedStart"]}~{s["plannedEnd"]}</td>'
        f'<td class="n">{"-" if s.get("travelMinutes") is None else str(s["travelMinutes"]) + "분"}</td><td>{e(s["status"])}</td></tr>'
        for s in sc["sites"])
    return ('<table><tr><th>작업자</th><th>현장</th><th>작업</th><th class="n">예정 시간</th><th class="n">직전 현장에서 이동</th><th>상태</th></tr>'
            f'{rows}</table>')


# ── 1. 판단 기준표 (수기·AX 공통, 참가자 배포) ──
RULES = """
<h1>판단 기준표 <span class="tag">수기 · AX 공통</span></h1>
<p class="sub">두 방식 모두 이 기준으로 답을 적습니다. 수기 방식은 계산기·연필을 쓸 수 있습니다. AX 방식은 화면의 판단 결과를 보고 적습니다.</p>
<h2>무엇을 찾나요</h2>
<p>같은 작업자가 앞 현장을 마치고 다음 현장에 <b>예정 시작 시각까지 도착하지 못하는 연결</b>(= 위험)과, 그 때문에 <b>시작이 늦어지는 현장</b>을 찾습니다.</p>
<h2>판단 순서</h2>
<ol>
<li>같은 작업자의 하루 일정을 시작 시각 순서로 이어 봅니다. 앞 현장 → 다음 현장이 <b>연결</b> 1건입니다.</li>
<li>앞 현장이 끝나는 시각(예상 종료)은 다음 순서로 정합니다.
 <ul>
 <li>① 완료 보고가 있으면 → 실제 종료 시각</li>
 <li>② 현장에서 예상 종료를 보고했으면 → 그 시각</li>
 <li>③ 작업을 늦게 시작했으면 → 실제 시작 + 예정 작업시간 (작업시간은 그대로 걸린다고 봅니다)</li>
 <li>④ 작업 중인데 기준시각이 이미 예정 종료를 지났고 보고가 없으면 → 적어도 기준시각까지 걸린다고 봅니다 (③④가 함께면 더 늦은 시각)</li>
 <li>⑤ 위에 해당하지 않으면 → 예정 종료</li>
 </ul></li>
<li><b>예상 도착</b> = 앞 현장 예상 종료 + 직전 현장에서 이동 시간</li>
<li><b>여유</b> = 다음 현장 예정 시작 − 예상 도착. 여유가 0분보다 작으면 <span class="risk">위험</span>이고, 모자란 분이 <b>예상 부족(분)</b>입니다. 여유 0~9분은 '주의'로, 위험으로 적지 않습니다.</li>
<li>두 현장의 예정 시간이 겹쳐도 <span class="risk">위험</span>(시간 중복)입니다. 부족분은 3·4번으로 계산합니다.</li>
<li><b>연쇄</b>: 다음 현장에 늦게 도착하면 그 현장의 시작은 도착 시각으로 늦어지고, 끝나는 시각도 작업시간만큼 뒤로 밀립니다. 밀린 종료 시각으로 그다음 연결을 계산합니다.</li>
<li>이미 시작했거나 끝난 현장은 '다음 현장'으로 판단하지 않습니다.</li>
<li>등급(참고, 답안에 쓰지 않아도 됨): 부족 1~9분 중간 · 10~29분 높음 · 30분 이상 매우 높음.</li>
</ol>
<h2>답안지에 적는 것</h2>
<div class="box">
<b>1부 (위험 인지)</b> — 위험 연결(앞 현장 → 다음 현장, 예상 부족 분)과 시작이 늦어지는 현장(현장, 늦어지는 분). 다 적으면 "1부 끝"이라고 말하고 답안지를 내려놓습니다.<br>
<b>2부 (조치 후 재판단)</b> — 진행요원이 주는 <b>조치 카드</b>대로 시작 시각을 바꾼 뒤의 위험 연결과, 조치로 <b>없어진 위험</b>을 적습니다. 새로 생긴 위험에는 '새로 생김'에 표시합니다. 다 적으면 "2부 끝"이라고 말합니다.<br>
조치는 <b>시작 시각만 바꾸고 작업시간은 그대로</b>입니다 (끝나는 시각도 같은 만큼 바뀝니다).
</div>
<p class="sub">시간 제한: 1부 {cap1}분 · 2부 {cap2}분. 시간이 다 되면 그때까지 적은 것으로 채점합니다. 현장 이름으로 적습니다 (예: 천안 → 아산, 15).</p>
<p class="foot">{note}</p>
"""


def rule_sheet():
    return doc("판단 기준표", [RULES.format(cap1=CAP1, cap2=CAP2, note=NOTE)])


# ── 2. 수기 시험지 (수기 방식 전용) ──
def manual_sheets(ids, label):
    pages = []
    for sid in ids:
        sc = SC[sid]
        pages.append(
            f'<div class="row" style="align-items:baseline"><h1>수기 시험지 · 시나리오 {sid}</h1><div style="text-align:right"><span class="tag">{e(label)}</span></div></div>'
            f'<p><b>{head(sc)}</b> — 아래 일정과 현장 보고를 보고 판단 기준표대로 판단해 답안지에 적으세요.</p>'
            f'<h2>현장 보고 (기준시각까지)</h2><div class="box">' + "<br>".join(e(r) for r in reports(sc)) + "</div>"
            f'<h2>오늘 일정</h2>{schedule_table(sc)}'
            '<h2>계산 칸 (자유롭게 쓰세요 · 채점하지 않음)</h2><div class="grid" style="height:95mm"></div>'
            f'<p class="foot">{NOTE} · 같은 내용이 AX 시험 화면에도 나옵니다.</p>')
    return doc(f"수기 시험지 {label}", pages)


# ── 3. 답안지 (수기·AX 공통) ──
def answer_sheets(ids, label):
    def rows(n, cols):
        return "".join("<tr>" + "".join("<td></td>" for _ in range(cols)) + "</tr>" for _ in range(n))
    pages = []
    for sid in ids:
        sc = SC[sid]
        pages.append(
            f'<div class="row" style="align-items:baseline"><h1>답안지 · 시나리오 {sid}</h1><div style="text-align:right"><span class="tag">{e(label)}</span></div></div>'
            '<table style="margin-bottom:2mm"><tr><th style="width:22%">참가자 코드</th><td style="width:28%"></td>'
            '<th style="width:20%">방식</th><td>□ 수기 &nbsp; □ AX</td></tr></table>'
            f'<p class="sub">{head(sc)} · 현장 이름으로 적습니다 (예: 천안 → 아산, 15). 위험이 없으면 "위험 없음"에 표시합니다.</p>'
            '<h2>1부 · 위험 인지</h2>'
            '<div class="row"><div><table class="blank"><tr><th>위험 연결 (앞 현장 → 다음 현장)</th><th class="n" style="width:26%">예상 부족(분)</th></tr>'
            + rows(5, 2) + '</table><p>□ 위험 없음</p></div>'
            '<div><table class="blank"><tr><th>시작이 늦어지는 현장</th><th class="n" style="width:30%">늦어지는 분</th></tr>'
            + rows(5, 2) + '</table></div></div>'
            '<h2>2부 · 조치 후 재판단 <span class="sub">(조치 카드를 받은 뒤 작성)</span></h2>'
            '<div class="row"><div style="flex:1.35"><table class="blank"><tr><th>조치 후 위험 연결</th><th class="n" style="width:22%">부족(분)</th><th style="width:22%">새로 생김</th></tr>'
            + "".join("<tr><td></td><td></td><td>□</td></tr>" for _ in range(4)) + '</table><p>□ 조치 후 위험 없음</p></div>'
            '<div><table class="blank"><tr><th>조치로 없어진 위험 연결</th></tr>' + rows(4, 1) + '</table></div></div>'
            '<p class="foot">채점자 기록란: 1부 ______ 2부 ______ · 입력 확인 ______</p>')
    return doc(f"답안지 {label}", pages)


# ── 4. 조치 카드 ──
def action_cards():
    ids = SETS["연습"] + SETS["A"] + SETS["B"]
    cards = [f'<div class="card"><span class="tag">조치 카드 · 시나리오 {sid}</span>'
             f'<div class="big">{action_text(SC[sid])}</div>'
             '<p>바꾼 뒤의 위험을 다시 판단해 답안지 <b>2부</b>에 적으세요.<br>AX 방식: 화면의 "일정 시작 조정"에 직접 입력합니다.</p></div>' for sid in ids]
    return doc("조치 카드", ["".join(cards[i:i + 4]) for i in range(0, len(cards), 4)])


# ── 5. 기록지 (기록자용) ──
def observer_log(set_name):
    ids = ["연습"] + SETS[set_name]
    rows = "".join(f'<tr><td><b>{sid}</b></td>' + "<td></td>" * 7 + "</tr>" for sid in ids)
    p = (f'<h1>기록지 (기록자용) · {set_name}세트</h1>'
         '<table style="margin-bottom:3mm"><tr><th>참가자 코드</th><td></td><th>회차</th><td>□ 1회차 &nbsp; □ 2회차</td></tr>'
         '<tr><th>방식</th><td>□ 수기 &nbsp; □ AX</td><th>날짜 · 기록자</th><td></td></tr></table>'
         '<p class="sub">시각은 초까지 적습니다(스톱워치 또는 측정 도구). 시작 = 수기: 시험지를 뒤집는 순간 · AX: 가림막 \'열기\'를 누르는 순간. '
         f'1부 끝 = 참가자가 "1부 끝"이라고 말한 순간. 조치 = 조치 카드를 건넨 순간. 2부 끝 = "2부 끝"이라고 말한 순간. 제한 1부 {CAP1}분 · 2부 {CAP2}분.</p>'
         '<table class="blank"><tr><th>시나리오</th><th>① 시작</th><th>② 1부 끝</th><th>T1 (②−①)</th><th>③ 조치</th><th>④ 2부 끝</th><th>T2 (④−③)</th><th>특이사항 (질문·중단·시간 초과)</th></tr>'
         f'{rows}</table>'
         '<h2>지켜야 할 것</h2><ul>'
         '<li>답을 알려주거나 고개를 끄덕이는 등 힌트를 주지 않습니다. 질문에는 "판단 기준표대로 하시면 됩니다"라고만 답합니다.</li>'
         '<li>두 방식 모두 같은 도구(같은 스톱워치 또는 측정 도구)로 잽니다. 화면의 시각을 쓰지 않습니다.</li>'
         '<li>측정한 값만 적습니다. 빠진 칸은 비워 두고 특이사항에 이유를 적습니다. 나중에 추정해서 채우지 않습니다.</li></ul>'
         f'<p class="foot">{NOTE}</p>')
    return doc(f"기록지 {set_name}세트", [p])


# ── 6. 참가자 정보 ──
def participant_info():
    p = ('<h1>참가자 정보 · 시험 안내 확인</h1>'
         '<div class="box">이 시험은 하나정보통신의 연쇄위험 판단 AX 시스템을 사용할 때와 수기로 일정을 확인할 때의 판단 시간과 정확도를 비교합니다. '
         '<b>개인 평가가 아니며</b>, 결과는 참가자 코드로만 기록해 벤처기업확인 이의신청 검증자료에 씁니다. 시나리오는 모두 가상 데이터입니다.</div>'
         '<table class="blank"><tr><th style="width:32%">참가자 코드</th><td></td></tr>'
         '<tr><th>직무</th><td>□ 대표·임원 &nbsp; □ 현장관리 &nbsp; □ 공무·사무 &nbsp; □ 기타(        )</td></tr>'
         '<tr><th>현장 일정관리 경력</th><td>약 ______ 년</td></tr>'
         '<tr><th>평소 일정 확인 방법</th><td>□ 종이·화이트보드 &nbsp; □ 엑셀 &nbsp; □ 메신저·전화 &nbsp; □ 기타(        )</td></tr>'
         '<tr><th>AX 화면 사용 경험</th><td>□ 없음 &nbsp; □ 시연을 본 적 있음 &nbsp; □ 직접 써 봄</td></tr>'
         '<tr><th>시험 순서 (진행요원 기입)</th><td>1회차 □수기 □AX · □A □B세트 → 2회차 □수기 □AX · □A □B세트</td></tr>'
         '<tr><th>안내를 듣고 참여에 동의합니다</th><td>날짜 ________ &nbsp; 서명 ____________</td></tr></table>'
         '<h2>시험 후 한마디 (선택)</h2><div class="grid" style="height:45mm"></div>'
         f'<p class="foot">{NOTE}</p>')
    return doc("참가자 정보", [p])


# ── 7. 정답표 (진행요원·채점자 전용) ──
def answer_key_doc():
    pages = []
    first = ('<div class="warn">진행요원·채점자 전용 — 시험이 모두 끝날 때까지 참가자에게 보여주지 않습니다.</div>'
             '<h1>정답표</h1>'
             f'<p class="sub">{e(KEY["basis"])}</p>'
             f'<p class="sub">위험 정의: {e(KEY["riskDefinition"])}</p>'
             f'<p class="sub">scenarios.json sha256 <code>{sha("scenarios.json")}</code><br>answer-key.json sha256 <code>{sha("answer-key.json")}</code></p>')
    for i, sid in enumerate(SETS["연습"] + SETS["A"] + SETS["B"]):
        sc, k = SC[sid], KEY["scenarios"][sid]
        site = {s["id"]: s for s in sc["sites"]}

        def link_rows(links):
            out = ""
            for l in links:
                a, b = l["key"].split(">")
                if l["slack"] is None:
                    calc = f'{site[b]["region"]}은 이미 {site[b]["status"]} → 판단 대상 아님'
                else:
                    end = m(l["arrival"]) - site[b]["travelMinutes"]
                    calc = f'{site[a]["region"]} 예상 종료 {hm(end)} + 이동 {site[b]["travelMinutes"]}분 = 도착 {l["arrival"]} · 예정 시작 {site[b]["plannedStart"]}'
                risk = l["grade"] in ("중간", "높음", "매우 높음")
                val = "-" if l["slack"] is None else (f'<span class="risk">{-l["slack"]}분 부족</span>' if l["slack"] < 0 else f'여유 {l["slack"]}분')
                out += (f'<tr><td><b>{pair(sc, l["key"])}</b></td><td>{e(calc)}</td><td class="n">{val}</td>'
                        f'<td>{"<span class=risk>" if risk else ""}{e(l["grade"])}{"</span>" if risk else ""}{(" · " + e(l["cause"])) if l.get("cause") else ""}</td></tr>')
            return out

        def affected(a):
            return ", ".join(f'{region(sc, x)} +{v}분' for x, v in a.items()) or "없음"

        def keys(xs):
            return ", ".join(pair(sc, x) for x in xs) or "없음"

        risks = [l for l in k["links"] if l["grade"] in ("중간", "높음", "매우 높음")]
        after_r = [l for l in k["after"]["links"] if l["grade"] in ("중간", "높음", "매우 높음")]
        body = (f'<h2>시나리오 {sid} · {head(sc)} · {e(sc["set"])}{"" if sc["set"] == "연습" else "세트"}</h2>'
                '<table><tr><th style="width:17%">연결</th><th>계산</th><th class="n" style="width:15%">여유·부족</th><th style="width:22%">등급 · 원인</th></tr>'
                f'{link_rows(k["links"])}</table>'
                f'<p><b>1부 정답</b> — 위험 {len(risks)}건: {", ".join(pair(sc, l["key"]) + " " + str(-l["slack"]) for l in risks) or "없음"} · 늦어지는 현장: {affected(k["affected"])}</p>'
                f'<p><b>조치</b> — {action_text(sc)}</p>'
                '<table><tr><th style="width:17%">연결 (조치 후)</th><th>계산</th><th class="n" style="width:15%">여유·부족</th><th style="width:22%">등급 · 원인</th></tr>'
                f'{link_rows(k["after"]["links"])}</table>'
                f'<p><b>2부 정답</b> — 조치 후 위험 {len(after_r)}건: {", ".join(pair(sc, l["key"]) + " " + str(-l["slack"]) for l in after_r) or "없음"} · '
                f'없어진 위험: {keys(k["after"]["resolved"])} · 새로 생긴 위험: {keys(k["after"]["new"])} · 늦어지는 현장: {affected(k["after"]["affected"])}</p>')
        if i == 0:
            body = first + body
        pages.append(body)
    return doc("정답표 (진행요원용)", ["".join(pages[i:i + 2]) for i in range(0, len(pages), 2)])


def main():
    OUT.mkdir(exist_ok=True)
    files = {
        "01_rule_sheet.html": rule_sheet(),
        "02_manual_sheets_practice.html": manual_sheets(SETS["연습"], "연습"),
        "02_manual_sheets_A.html": manual_sheets(SETS["A"], "A세트"),
        "02_manual_sheets_B.html": manual_sheets(SETS["B"], "B세트"),
        "03_answer_sheets_practice.html": answer_sheets(SETS["연습"], "연습"),
        "03_answer_sheets_A.html": answer_sheets(SETS["A"], "A세트"),
        "03_answer_sheets_B.html": answer_sheets(SETS["B"], "B세트"),
        "04_action_cards.html": action_cards(),
        "05_observer_log_A.html": observer_log("A"),
        "05_observer_log_B.html": observer_log("B"),
        "06_participant_info.html": participant_info(),
        "07_answer_key_CONFIDENTIAL.html": answer_key_doc(),
    }
    for name, text in files.items():
        (OUT / name).write_text(text, encoding="utf-8")
    print(f"인쇄물 {len(files)}개 → trial/print/ (scenarios sha256 {sha('scenarios.json')[:12]} · answer-key sha256 {sha('answer-key.json')[:12]})")


if __name__ == "__main__":
    main()
