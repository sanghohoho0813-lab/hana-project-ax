"""정답표 독립 검산 — 참가자용 판단 기준표의 문장만 보고 새로 짠 계산기.

AX 엔진(src/lib/risk-engine.ts)의 코드를 가져오거나 옮기지 않았다. 같은 규칙을 다른 언어로 따로 구현해
손계산 정답표(data/answer-key.json)와 한 칸씩 대조한다. 하나라도 다르면 종료 코드 1.

    python3 trial/tools/answer_key.py          # 대조 + data/answer-key.computed.json 작성
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def m(hhmm):
    h, mm = hhmm.split(":")
    return int(h) * 60 + int(mm)


def hm(v):
    return f"{v // 60:02d}:{v % 60:02d}"


def grade(slack, overlap):
    """기준표 4·5·8항 — 겹치면 매우 높음, 여유 10분 이상 없음, 0~9분 주의, 부족 1~9 중간, 10~29 높음, 30 이상 매우 높음"""
    if overlap:
        return "매우 높음"
    if slack >= 10:
        return "없음"
    if slack >= 0:
        return "주의"
    short = -slack
    return "매우 높음" if short >= 30 else "높음" if short >= 10 else "중간"


def own_end(s, as_of):
    """기준표 2항 — 앞 현장이 끝나는 시각을 정하는 순서"""
    ps, pe = m(s["plannedStart"]), m(s["plannedEnd"])
    if s["status"] == "완료" and s.get("actualEnd"):
        return m(s["actualEnd"])  # ① 완료 보고
    if s.get("expectedEnd"):
        return m(s["expectedEnd"])  # ② 현장 예상 종료 보고
    cands = []
    if s.get("actualStart") and m(s["actualStart"]) > ps:
        cands.append(m(s["actualStart"]) + (pe - ps))  # ③ 늦게 시작 → 실제 시작 + 예정 작업시간
    if s["status"] == "진행 중" and as_of > pe:
        cands.append(as_of)  # ④ 작업 중인데 기준시각이 예정 종료를 지남
    return max(cands) if cands else pe  # ③④ 함께면 늦은 값, 없으면 ⑤ 예정 종료


def judge(sc, sites):
    as_of = m(sc["asOf"])
    links, affected = [], {}
    for w in sorted({s["workerId"] for s in sites}):
        day = sorted([s for s in sites if s["workerId"] == w], key=lambda s: m(s["plannedStart"]))
        exp_end = {}
        for i, s in enumerate(day):
            ps, pe = m(s["plannedStart"]), m(s["plannedEnd"])
            if i == 0:
                exp_end[s["id"]] = own_end(s, as_of)
                continue
            p = day[i - 1]
            key = f'{p["id"]}>{s["id"]}'
            if s["status"] != "예정":  # 기준표 7항
                links.append({"key": key, "arrival": None, "slack": None, "grade": "해당 없음"})
                exp_end[s["id"]] = own_end(s, as_of)
                continue
            arrival = exp_end[p["id"]] + s["travelMinutes"]  # 3항
            slack = ps - arrival  # 4항
            overlap = ps < m(p["plannedEnd"])  # 5항
            g = grade(slack, overlap)
            link = {"key": key, "arrival": hm(arrival), "slack": slack, "grade": g}
            if slack < 0 or overlap:
                plan_slack = ps - m(p["plannedEnd"]) - s["travelMinutes"]
                prev_delayed_by_chain = p["id"] in affected
                link["cause"] = ("시간 중복" if overlap else "이동시간 부족" if plan_slack < 0
                                 else "연쇄 지연" if prev_delayed_by_chain else "선행 현장 지연")
                link["planOnly"] = overlap or plan_slack < 0
            links.append(link)
            if slack < 0:  # 6항 연쇄 — 늦게 도착하면 시작·종료가 함께 밀린다
                affected[s["id"]] = -slack
                exp_end[s["id"]] = max(own_end(s, as_of), arrival + (pe - ps))
            else:
                exp_end[s["id"]] = own_end(s, as_of)
    return links, affected


def risky(links):
    return {l["key"] for l in links if l["grade"] in ("중간", "높음", "매우 높음")}


def apply_action(sc):
    """기준표 9항 — 시작 시각만 바꾸고 작업시간은 그대로"""
    a = sc["action"]
    out = []
    for s in sc["sites"]:
        s = dict(s)
        if s["id"] == a["siteId"]:
            dur = m(s["plannedEnd"]) - m(s["plannedStart"])
            s["plannedStart"], s["plannedEnd"] = a["newStart"], hm(m(a["newStart"]) + dur)
        out.append(s)
    return out


def compute(sc):
    links, affected = judge(sc, sc["sites"])
    alinks, aaffected = judge(sc, apply_action(sc))
    before, after = risky(links), risky(alinks)
    return {
        "links": links,
        "affected": affected,
        "after": {
            "links": alinks,
            "affected": aaffected,
            "resolved": sorted(before - after),
            "new": sorted(after - before),
            "remaining": sorted(before & after),
        },
    }


def norm(v):
    """비교용 — 키 순서·리스트 순서 무시"""
    if isinstance(v, dict):
        return {k: norm(x) for k, x in sorted(v.items())}
    if isinstance(v, list):
        items = [norm(x) for x in v]
        return sorted(items, key=lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True))
    return v


def main():
    scen = json.loads((DATA / "scenarios.json").read_text(encoding="utf-8"))
    hand = json.loads((DATA / "answer-key.json").read_text(encoding="utf-8"))["scenarios"]
    computed, bad = {}, []
    for sc in scen["scenarios"]:
        c = compute(sc)
        computed[sc["id"]] = c
        h = hand.get(sc["id"])
        if h is None:
            bad.append(f'{sc["id"]}: 손계산 정답 없음')
            continue
        for part in ("links", "affected"):
            if norm(c[part]) != norm(h[part]):
                bad.append(f'{sc["id"]} {part}: 손계산 {h[part]} ≠ 검산 {c[part]}')
        for part in ("links", "affected", "resolved", "new", "remaining"):
            if norm(c["after"][part]) != norm(h["after"][part]):
                bad.append(f'{sc["id"]} after.{part}: 손계산 {h["after"][part]} ≠ 검산 {c["after"][part]}')
    (DATA / "answer-key.computed.json").write_text(
        json.dumps({"version": "trial-answer-key-computed/1.0.0", "by": "trial/tools/answer_key.py (독립 구현)",
                    "scenarios": computed}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n_links = sum(len(c["links"]) for c in computed.values())
    n_risk = {k: len(risky(c["links"])) for k, c in computed.items()}
    print(f"시나리오 {len(computed)}개 · 연결 {n_links}건 · 위험 {n_risk}")
    if bad:
        print("불일치", len(bad))
        for b in bad:
            print(" -", b)
        sys.exit(1)
    print("손계산 정답표와 독립 검산 결과가 모두 일치합니다.")


if __name__ == "__main__":
    main()
