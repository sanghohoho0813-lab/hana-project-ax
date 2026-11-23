"""05 실제 구현 화면 절차서 — 핵심 사례(보령 → 홍성 → 예산)를 실제 프로그램으로 처음부터 끝까지"""
from kit import (B, card, col, flow, grid, head, key, marks, sec, table, ul)


def docs(K):
    F, hm, at = K.F, K.hm, K.at

    m05 = dict(code="05", file="05_실제구현_화면절차서", short="실제 구현 화면 절차서",
               title_html="세 가지 현장 문제를<br>프로그램이 다루는 <em>순서 그대로</em>",
               sub="기사 1명의 하루(보령 → 홍성 → 예산)를 실제 프로그램으로 처음부터 끝까지 진행하며 찍은 화면입니다. 화면마다 볼 곳에 빨간 테두리와 번호를 붙였고, 아래 설명 번호와 같습니다.",
               tags=["실제 화면 41장 중 선별", "기사 휴대폰 · 관리자 PC", f"{K.meta['date']} {K.meta['P']} 시작"],
               answers=["실제로 구현된 기술인가 — 화면 · 절차로 확인 (보완 요청 8)", "문제 1 막힘 · 문제 2 안전 · 문제 3 다음 현장이 각각 어떻게 처리되는가", "기록이 어떻게 남는가 — 사건 증빙 · 판단 이력"])

    def ex(*items):
        return marks(items)

    def pages():
        pg = []
        # 2 시험 조건
        pg.append("".join([
            head("읽기 전에", "이 절차서의 사례와 <em>촬영 조건</em>", "로컬 서버 · 로컬 DB에서 실제 프로그램을 자동으로 조작하며 찍었습니다. 화면 속 사람 · 현장 이름과 일정은 시험용입니다."),
            table(["현장", "예정 시간", "앞 현장에서 이동", "담당"], [
                [f"<b>① 보령 지사</b>", f"{hm(0)} ~ {hm(60)}", "—", "김현장 기사 (시험용)"],
                [f"<b>② 홍성 물류센터</b>", f"{hm(90)} ~ {hm(150)}", "20분", "김현장 기사"],
                [f"<b>③ 예산 매장</b>", f"{hm(180)} ~ {hm(230)}", "25분", "김현장 기사"],
            ], cls="lg", widths=["30%", "24%", "22%", "24%"]),
            K.shot("setup_board", name="s05_board", cap="관리자 일정판 — ①②③ 김현장 기사의 하루 3곳. 이동시간은 관리자가 입력한 값입니다(실시간 교통정보 아님)."),
            grid([
                card(ul(["관리자 PC와 기사 휴대폰은 <b>같은 컴퓨터의 별도 브라우저 · 별도 로그인</b>입니다(실제 휴대폰 아님).", "관리자는 2단계 인증으로 로그인합니다.", "화면 시각은 실제 촬영 시각입니다 — ‘중간 확인’은 실제로 30분을 기다려 찍었습니다."]), "", "촬영 방법"),
                card(ul([f"자료 구분 ‘검증 시나리오(가상)’ · 사건번호 <b>{F['case_no']}</b>", f"촬영 {K.meta['date']} · 보령 예정 시작 {K.meta['P']}", "프로그램 v0.6.1 · 규칙 chain-risk/1.1.0", "실제 현장 업무 기록이 아닙니다 " + B("zero")]), "s", "자료 구분"),
            ], "g2"),
            sec("순서", "이 자료의 순서"),
            flow([("2~4쪽", "문제 1 · 막힘", "30분째 묻기 → 보고 → 본사 지원"), ("5~7쪽", "문제 2 · 안전", "시작 전 · 진행 중 · 마친 뒤 점검"), ("8~10쪽", "문제 3 · 다음 현장", "자동 계산 → 조치 → 재계산", "hot"), ("11~12쪽", "기록 · 증빙", "사건 증빙 · 판단 이력 · 시간표", "dark")]),
        ]))
        # 3 문제1-①
        pg.append("".join([
            head(f"문제 1 · 막힘 조기 확인 ① <span class='tag-time'>{at('p1_field_ask')}</span>", "작업 시작 30분째, 진행 보고가 없자 <em>휴대폰이 먼저 묻고 본사에도 표시</em>됩니다"),
            grid([
                col(K.shot("p1_field_ask", name="s05_ask", cap="기사 휴대폰 — ‘지금 할 일’ 카드"),
                    ex("‘작업 시작 30분째예요 — 예정대로 되고 있나요?’ 프로그램이 먼저 묻습니다.", "<b>막혔어요</b> · 예정대로 · 늦어져요 — 버튼 하나로 답합니다.")),
                col(K.shot("p1_admin_watch", name="s05_watch", cap="관리자 대시보드 — 연락 없이 늦어지는 현장"),
                    ex("같은 시각 본사 대시보드 맨 앞에 ‘연락 없이 늦어지는 현장(중간 확인)’이 뜹니다.", "<b>전화 확인</b> — 관리자가 바로 연락할 수 있습니다."),
                    card(ul(["조건: 작업 시작 뒤 예정 소요(60분)의 절반이 지났는데 진행 보고 없음", "판정 규칙: 조기 확인 규칙 0.1 (규칙 기반, AI 아님)", "새 기록을 만들지 않고 기존 기록(시작 · 보고)만 봅니다"]), "s", "규칙")),
            ], "g2", style="grid-template-columns:1fr 1.25fr"),
            grid([K.photo("ai-stuck", style="height:44mm", cap="현장 — 예상과 다른 배선 앞에서 혼자 붙잡고 있는 시간이 길어지기 쉽습니다(연출)"),
                  K.photo("ai-hq", style="height:44mm", cap="본사 — 기사가 연락하기 전에는 알 길이 없던 상황을 화면이 먼저 보여 줍니다(연출)")], "g2"),
            key("기사가 먼저 전화하지 않아도, <em>‘연락 없는 현장’을 프로그램이 찾아 양쪽에 알립니다.</em>", "인터뷰: “실시간으로 알면 먼저 제가 확인해서 바로 백업해 줬을 텐데.”"),
        ]))
        # 4 문제1-② 보고
        pg.append("".join([
            head(f"문제 1 · 막힘 조기 확인 ② <span class='tag-time'>{at('p1_report_type')}</span>", "‘막혔어요’ → <em>버튼 여섯 번</em>으로 본사에 보고합니다", f"문제를 처음 발견한 시각({F['discovered']})과 보고 시각({F['reported']})을 따로 남깁니다 — 발견에서 보고까지 {F['disc_to_report']}."),
            grid([
                K.shot("p1_report_type", aspect=0.72, name="s05_r1", cap="① 유형 — ‘예상과 다른 설치환경’"),
                K.shot("p1_report_state", aspect=0.72, name="s05_r2", cap="② 지금 상태 · 처음 발견한 시각"),
                K.shot("p1_report_need_end", show=[1, 2], focus=60, aspect=0.72, name="s05_r3", cap="③ 필요한 지원 ④ 바뀐 예상 종료"),
            ], "g3"),
            grid([
                K.shot("p1_report_photo", aspect=0.72, name="s05_r4", cap="⑤ 사진 — 촬영정보를 지우고 비공개 저장"),
                K.shot("p1_report_sent", name="s05_r5", cap="⑥ 보고 완료 — 사건번호 · ‘본사 확인 전’"),
                col(card(ul(["<b>유형</b>: 예상과 다른 설치환경 · 추가 장비 · 기술 지원 등", "<b>필요한 지원</b>: 숙련 기술자 · 장비 · 원격 지원 · 일정 조정(여러 개)", f"<b>바뀐 예상 종료</b>: +30분 · <b>+1시간</b> · +2시간 · 직접 · 아직 모름 → {F['new_end']}", "<b>사진</b>: 위치 등 촬영정보 제거 후 업로드"]), "t", "보고에 담기는 것"),
                    card(f"<p>‘바뀐 예상 종료’가 있으면 같은 순간 <b>예상 종료 보고 1건</b>이 함께 기록되고, 연쇄위험 계산이 바로 돌아갑니다(문제 3). 모르면 ‘아직 모름’ — 문제 기록만 남고 위험 계산은 하지 않습니다.</p>", "r", "다음 현장 계산과 연결")),
            ], "g3"),
        ]))
        # 5 문제1-③ 본사 조치
        pg.append("".join([
            head(f"문제 1 · 막힘 조기 확인 ③ <span class='tag-time'>{at('p13_case_card')}</span>", "본사는 <em>우선 확인 이유</em>를 보고 접수 → 지원 결정 → 현장 전달까지 바로 처리합니다"),
            K.shot("p13_case_card", focus=40, aspect=2.6, name="s05_case", cap="문제 · 지원 목록 — 사건 카드: ① <b>우선 확인 이유</b> ‘지원 요청 · 후속 현장 2곳 위험(최대 50분, 계산값)’ ② 기사가 보고한 변경 예상 종료 13:00"),
            grid([K.shot("p1_admin_support", focus=40, aspect=3.2, name="s05_support", cap="① 지원 조치 — ‘숙련 직원 투입’ 선택"),
                  K.shot("p1_admin_deliver", focus=40, aspect=3.2, name="s05_deliver", cap="① 현장 전달 — 기사에게 보낼 말")], "g2"),
            grid([
                K.shot("p1_field_hq", name="s05_hq", cap="기사 휴대폰 — ① 본사에서 온 소식"),
                col(
                    card(table(["단계", "시각", "걸린 시간"], [["보고", F["reported"], "—"], ["본사 접수", F["decided"], F["report_to_ack"]], ["지원 결정", F["decided"], F["ack_to_decide"]], ["현장 전달", F["decided"], F["decide_to_deliver"]]], cls="sm"), "s", f"{B('virt')} 이번 시험 기록"),
                    '<p class="fine">걸린 시간은 자동 시험의 초 단위 기록입니다(사람이 실제로 처리한 시간이 아님). 실제 현장의 보고 → 지원 결정 시간은 시험 B에서 잽니다.</p>'),
            ], "g2", style="grid-template-columns:1fr 1.3fr"),
        ]))
        # 6 문제2-① 시작 전
        pg.append("".join([
            head(f"문제 2 · 안전점검 ① 시작 전 <span class='tag-time'>{F['checks']['작업 전']['at']}</span>", "안전점검을 내기 전에는 <em>‘작업 시작’이 바로 되지 않습니다</em>"),
            grid([
                K.shot("p2_field_first", name="s05_first", cap="기사 첫 화면 — ① 시작 전 안전점검 안내"),
                K.shot("p2_gate_start", show=[1, 2], focus=50, aspect=0.72, name="s05_gate", cap="① 점검 없이 시작을 누르면 먼저 묻기 ② ‘시작 전 점검 하기’"),
                K.shot("p2_pre_check", show=[1, 2], focus=50, aspect=0.72, name="s05_pre", cap="① 필수 항목 확인 ② 착용 사진 첨부"),
            ], "g3"),
            grid([
                K.shot("p2_admin_review", name="s05_review", cap="관리자 안전관리 — ① 점검 사진 ② ‘적합(육안)’ 확인"),
                col(K.shot("p2_admin_stage1", name="s05_stage1", cap="현장별 3단계 현황 — ① 보령: 시작 전 ‘적합(육안)’"),
                    card("<p>사진으로 착용 여부를 <b>자동 판정하지 않습니다.</b> 관리자가 눈으로 확인한 결과와 시각을 남깁니다. 그래도 점검 없이 시작하면 그 사실이 기록에 남습니다.</p>", "s", "원칙")),
            ], "g2"),
        ]))
        # 7 문제2-② 진행 중 미흡
        pg.append("".join([
            head(f"문제 2 · 안전점검 ② 진행 중 <span class='tag-time'>{F['checks']['작업 중']['at']}</span>", "‘미흡’이 나오면 <em>작업 중지 안내 → 본사 1순위 → 보완 요청 → 보완 확인</em>"),
            grid([
                K.shot("p2_mid_deficient", show=[1], focus=50, aspect=0.86, name="s05_def", cap="① ‘미흡’이면 프로그램을 기다리지 말고 작업 중지 · 본사 직접 전화"),
                col(K.shot("p2_admin_dash_safety", focus=50, aspect=2.4, name="s05_dsafe", cap="관리자 대시보드 — ① ‘안전 확인 필요(1순위)’에 미흡 점검"),
                    K.shot("p2_admin_supp_req", show=[1, 2, 3], focus=40, aspect=1.9, name="s05_suppreq", cap="① 미흡 항목 ② ‘적합’은 누를 수 없음 ③ ‘보완 요청’")),
            ], "g2", style="grid-template-columns:1fr 1.7fr"),
            grid([
                K.shot("p2_field_supp", focus=60, aspect=1.25, name="s05_fsupp", cap="기사 휴대폰 — 보완 요청 도착 → ① 보완 사진 · 내용 제출"),
                K.shot("p2_admin_supp_done", focus=60, aspect=1.6, name="s05_suppdone", cap="관리자 — 보완 확인 → 조치 완료, ① 확인 이력이 남음"),
            ], "g2", style="grid-template-columns:1fr 1.6fr"),
        ]))
        # 8 문제2-③ 마무리
        pg.append("".join([
            head(f"문제 2 · 안전점검 ③ 마친 뒤 <span class='tag-time'>{F['checks']['작업 종료']['at']}</span>", "마무리 점검 없이 <em>‘작업 종료’도 바로 되지 않습니다</em> — 3단계가 한 표에 모입니다"),
            grid([
                K.shot("p2_gate_end", show=[1, 2], focus=50, aspect=0.72, name="s05_gateend", cap="① 마무리 점검 먼저 ② ‘마무리 점검 하기’"),
                K.shot("p2_ended", aspect=0.72, name="s05_ended", cap="마무리 점검 → 작업 종료 기록"),
                col(K.shot("p2_admin_stage3", name="s05_stage3", cap="현장별 3단계 현황 — ① 보령: 시작 전 · 진행 중 · 마친 뒤 모두 확인"),
                    card(ul(["시작 전 점검 없이 시작한 현장", "마무리 점검 없이 종료한 현장", "미흡 · 보완 중인 점검", "→ 안전관리 화면 맨 앞에 최근 것부터 표시"]), "r", "놓친 점검이 먼저 보이는 순서")),
            ], "g3", style="grid-template-columns:1fr 1fr 1.6fr"),
            K.xshot("x_safety__top.jpg", "s05_safety_tbl", t="안전관리 · 현장별 3단계 현황", cap="보령은 3단계 모두 ‘적합(육안)’, 홍성 · 예산은 아직 시작 전이라 ‘—’ / ‘늦지 않음’. 표 아래에는 점검별 사진 · 확인 이력이 이어집니다."),
        ]))
        # 9 문제3-① 보고 직후
        pg.append("".join([
            head(f"문제 3 · 다음 현장 ① 보고 직후 <span class='tag-time'>{at('p13_admin_dash')}</span>", "‘1시간 더’ 보고가 들어온 순간 <em>다음 현장 두 곳의 지연</em>이 계산됩니다"),
            grid([
                K.shot("p13_admin_dash", name="s05_next", cap="관리자 대시보드 — 다음 현장 지연 위험"),
                col(ex("<b>보령 → 홍성</b>: 도착 13:20, 예정 12:30보다 50분 부족 · 매우 높음", "<b>홍성 → 예산</b>: 홍성이 늦게 끝나 예산 도착 14:45, 45분 부족 · 매우 높음"),
                    card(f"""<p><b>예상 도착</b> = {F['new_end']} + 20분 = {hm(140)}<br><b>여유</b> = {hm(90)} − {hm(140)} = <b class="no">−50분</b><br>홍성 종료 {hm(200)} + 25분 = {hm(225)} → <b class="no">45분 부족</b></p>""", "r", f"{B('calc')} 계산")),
            ], "g2", style="grid-template-columns:1.4fr 1fr"),
            K.shot("p3_chain_report", name="s05_chain1", cap="사건 상세 — 연쇄 영향 그림: ① 홍성 50분 늦음 ② 예산 45분 늦음 ③ 남은 위험 2"),
            key("일정표에는 시간이 겹치지 않아 아무 표시도 없지만, <em>바뀐 종료 + 이동시간</em>으로 계산하면 두 현장이 위험합니다.", "계산 근거(입력 6칸 · 계산 과정 1~5)는 판단 기록 상세 화면에 그대로 남습니다 — 04 자료 4쪽."),
        ]))
        # 10 문제3-② 조치
        pg.append("".join([
            head(f"문제 3 · 다음 현장 ② 조치 <span class='tag-time'>{at('p3_adjust1_form')}</span>", "관리자가 일정을 고치면 <em>저장 즉시 다시 계산</em>합니다 — 두 번의 조치"),
            sec("1차", f"홍성 물류센터 시작을 {hm(90)} → {hm(145)}로"),
            K.shot("p3_adjust1_form", name="s05_a1f", cap="① 조정할 일정 ② 새 예정 시작"),
            K.shot("p3_adjust1_result", name="s05_a1r", cap="재판단 — 보령→홍성 풀림(여유 5분 · 주의), 홍성→예산은 50분 부족으로 남음"),
            sec("2차", f"예산 매장 시작을 {hm(180)} → {hm(240)}로"),
            K.shot("p3_adjust2_form", name="s05_a2f", cap="① 조정할 일정 ② 새 예정 시작"),
            K.shot("p3_adjust2_result", name="s05_a2r", cap="재판단 — 홍성→예산 여유 10분, 남은 위험 0"),
            '<p class="small">1차 조치 뒤 홍성 → 예산 부족이 45분에서 50분으로 늘어난 것은, 홍성 시작이 13:25로 확정되어 종료가 14:25로 계산되기 때문입니다(예상 도착 14:50). 프로그램은 조치마다 이런 변화를 그대로 보여 줍니다.</p>',
        ]))
        # 11 문제3-③ 결과
        pg.append("".join([
            head(f"문제 3 · 다음 현장 ③ 결과 <span class='tag-time'>{at('p3_chain_after')}</span>", "같은 그림이 <em>남은 위험 0</em>으로 바뀌고, 바뀐 시각이 기사 휴대폰까지 갑니다"),
            K.shot("p3_chain_after", focus=30, aspect=3.1, name="s05_chain2", cap="연쇄 영향 그림 — ① 홍성 여유 5분 ② 예산 여유 10분 ③ 남은 위험 0"),
            grid([
                K.shot("p3_board_after", focus=40, aspect=2.2, name="s05_board2", cap="일정판 — ① 홍성 13:25 ② 예산 15:00 (조정된 시각)"),
                K.shot("p3_field_next", aspect=1.3, name="s05_fnext", cap="기사 휴대폰 — 조정된 다음 현장 시각"),
            ], "g2", style="grid-template-columns:1.6fr 1fr"),
            K.xshot("x_records__revisions.jpg", "s05_revs", t="기록 · 일정 변경 이력", cap="일정 변경 이력 — 등록 3건 · 수정 2건(관리자 · 시각). 변경은 덮어쓰지 않고 판(版)으로 쌓입니다."),
        ]))
        # 12 증빙
        pg.append("".join([
            head("기록 · 증빙", "사건 하나에 대해 <em>무엇이 · 언제 · 누구에 의해</em> 일어났는지 한 장으로 나옵니다"),
            grid([
                K.shot("ev_case_print", aspect=1.3, name="s05_print", cap="사건 증빙 — 핵심 흐름 요약(인쇄 · PDF 저장)"),
                col(K.shot("ev_case_top", aspect=1.75, name="s05_casetop", cap="사건 상세 — 처리 흐름(시각 기록)"),
                    K.shot("ev_measures", aspect=1.75, name="s05_measures", cap="성과 측정 — 보고 · 확인 · 해결 시간 항목")),
            ], "g2"),
            K.xshot("x_records__events.jpg", "s05_events", t="기록 · 작업 기록", cap="작업 기록 4건 — 발생 · 입력 · DB 기록 시각과 입력자가 함께 남고, CSV · JSON으로 내려받습니다."),
        ]))
        # 13 시간표 정리
        rows = [[F["checks"]["작업 전"]["at"], "기사", "시작 전 안전점검 · 착용 사진", "2"], [F["checks"]["작업 전"]["review"], "관리자 · 기사", "적합(육안) 확인 · 작업 시작", "2"],
                [hm(30), "프로그램", "‘30분째 진행 보고 없음’ — 기사에게 묻기 · 본사 표시", "1"], [F["discovered"], "기사", "문제 처음 발견 (보고 때 입력)", "1"],
                [F["reported"], "기사", "문제 보고 · 숙련 기술자 요청 · 예상 종료 13:00", "1 · 3"], [F["reported"], "프로그램", "다음 현장 위험 계산 — 홍성 50분 · 예산 45분 부족", "3"],
                [F["decided"], "관리자", "접수 → 숙련 직원 투입 결정 → 현장 전달", "1"], [F["adjust1"], "관리자 · 프로그램", "홍성 13:25로 조정 → 재계산(위험 1)", "3"],
                [F["adjust2"], "관리자 · 프로그램", "예산 15:00로 조정 → 재계산(위험 0)", "3"], [F["checks"]["작업 중"]["at"], "기사 · 관리자", "진행 중 점검 ‘미흡’ → 보완 요청 → 보완 확인", "2"],
                [F["ended"], "기사", "마무리 점검 → 작업 종료", "2"]]
        pg.append("".join([
            head("전체 시간표", "한 사건이 처음부터 끝까지 <em>어떤 순서로</em> 처리됐나", "시험 진행을 위해 30분 대기 뒤의 단계는 몇 초 간격으로 이어서 눌렀습니다. 실제 현장에서는 각 단계 사이에 사람의 처리 시간이 들어갑니다."),
            table(["시각", "누가", "무엇을", "문제"], rows, cls="lg", widths=["12%", "20%", "58%", "10%"], hl=(5, 7, 8)),
            sec("정리", "세 문제 × 프로그램이 한 일"),
            grid([
                card(ul(["30분째 먼저 묻기 · 본사 표시", "버튼 6번 보고 · 발견/보고 시각 분리", "우선 확인 이유 · 지원 결정 · 현장 전달"]), "", "문제 1 · 막힘"),
                card(ul(["점검 없이 시작 · 종료하면 먼저 묻기", "미흡 → 작업 중지 안내 · 1순위", "보완 요청 · 확인 이력 · 3단계 현황"]), "", "문제 2 · 안전"),
                card(ul(["보고 즉시 다음 현장 2곳 계산", "조치마다 재계산(2 → 1 → 0)", "바뀐 시각이 기사 휴대폰까지"]), "r", "문제 3 · 다음 현장"),
            ], "g3"),
        ]))
        return pg

    return [(m05, pages, "photos/ai-photo.jpg")]
