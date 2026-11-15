# Supabase · Vercel 수동 설정 가이드 (현장 실사용 AX 시스템 0.3.2)

대상: 기존 Vercel 프로젝트 + **새 Supabase 프로젝트 1개**. 새 프로그램을 만들지 않고, 저장소의 `/pilot`(로그인·DB·RLS·사진 저장소)을 그대로 연결합니다.
방식: 명령어 없이 **대시보드 화면에서** 합니다. SQL은 저장소의 파일을 열어 복사한 뒤 SQL Editor에 붙여 넣고 Run만 누르면 됩니다.
작성: 2026-11-15. 메뉴 이름은 Supabase·Vercel 화면 개편에 따라 조금 다를 수 있습니다.

> **이 가이드의 모든 단계는 승인 뒤에 진행합니다.** 새 Supabase 프로젝트 생성, 유료 플랜 변경, Vercel 환경변수 입력은 운영 인프라 변경입니다.
>
> **비밀정보 원칙**
> - DB 비밀번호, 서명키, 서비스 키(secret / service_role), 접근 토큰, 임시 비밀번호는 **채팅·메일·메신저·문서·GitHub에 붙여 넣지 않습니다.**
> - 비밀번호 관리자나 Supabase·Vercel의 설정 화면에만 둡니다.
> - 개발자(저)는 이 값들이 필요하지 않습니다. 앱은 Supabase 서비스 키를 쓰지 않습니다.

---

## 0. 준비할 것과 비용 (2026-11-14~15 공식 페이지 확인 · USD · 부가세 별도)

| 항목 | 권장 | 비용 | 이유 |
|---|---|---|---|
| Supabase 플랜 | **Pro** | $25/월부터 (컴퓨트 크레딧 $10 포함) | 일일 백업 7일 보관. Free는 1주 무활동 시 일시 정지되고 자동 백업이 없음 |
| Vercel 플랜 | **Pro** (지금 Hobby라면) | Developer 좌석 1개당 $20/월 | Vercel 이용약관 4조: Hobby는 "개인적 또는 비상업적 용도로만" 사용. 회사 업무에는 Pro 필요 |
| 메일 발송(SMTP) | 시험 A에서는 없어도 됨 | 회사 메일 서버나 메일 발송 서비스 (필요 시 별도 승인) | Supabase 기본 메일은 프로젝트 팀원에게만, 시간당 2통 (3-4 참고) |
| 비밀번호 관리자 | 회사에서 쓰는 것 | — | DB 비밀번호 · 서명키 · 임시 비밀번호 보관 |

**지금 Vercel 플랜 확인**: Vercel 대시보드 → 왼쪽 위 팀(계정) 이름 → **Settings → Billing**. 'Hobby'로 보이면 회사 업무용으로 쓰기 전에 Pro로 바꿀지 결정해 주세요(유료 · 승인 사항).

---

## 1. Supabase — 새 프로젝트 만들기 (사용자 작업 ①)

1. https://supabase.com/dashboard → **New project**
2. **Organization**: 회사 조직을 고릅니다. 플랜은 조직 단위입니다. Pro로 하려면 조직의 Billing에서 바꿉니다.
3. **Project name**: 예) `hana-ax-pilot`
4. **Database Password**: **Generate a password** → 바로 비밀번호 관리자에 저장합니다. 앱 설정에는 쓰지 않습니다.
5. **Region**: **Northeast Asia (Seoul)**
6. 보안 옵션이 보이면 **Data API는 켠 채로** 둡니다. 앱이 DB 함수를 부르는 통로입니다. 나머지는 기본값으로 둡니다.
7. **Create new project** → 1~2분 기다립니다.

---

## 2. Supabase — DB 구조 적용 (사용자 작업 ②, SQL 4개를 차례로)

저장소 폴더 `supabase/production/`의 파일을 씁니다. GitHub 저장소에서 파일을 열고 **Raw** 또는 복사 버튼으로 전체를 복사합니다.

| 순서 | 파일 | 하는 일 | 실행 |
|---|---|---|---|
| 2-1 | `01_apply_all_migrations.sql` | 표 15개, 권한(RLS), 기록 함수, 비공개 사진 저장소, 사진 접근 정책을 만듭니다. 마이그레이션 6개를 한 트랜잭션으로 묶었습니다 | **한 번만** |
| 2-2 | `02_set_judge_secret.sql` | 판단 기록 서명키(64자 무작위)를 DB 안에서 만들고 그 값을 결과 칸에 보여 줍니다 | 한 번 (다시 실행해도 같은 값) |
| 2-3 | `03_bootstrap_admin.sql` | 최초 관리자 1명을 지정합니다 (3-3 다음에 실행) | 한 번 |
| 2-4 | `04_verify_setup.sql` | 13개 항목을 점검합니다 (읽기만) | 언제든 |

**실행 방법 (각 파일 공통)**
1. 왼쪽 메뉴 **SQL Editor** → **New query**(+)
2. 복사한 내용을 붙여 넣고 **Run** (Ctrl+Enter)
3. 아래 '결과 확인'처럼 나오는지 봅니다

**결과 확인**
- 2-1: `Success. No rows returned`가 나오면 됩니다.
  - 알림(NOTICE) 몇 줄은 정상입니다: `extension "pgcrypto" already exists`, `identifier ... will be truncated`.
  - **오류(ERROR)가 나오면** 아무것도 적용되지 않은 상태입니다. 다시 실행하지 말고 오류 문구를 알려 주세요.
- 2-2: 결과 칸에 64자 값이 나옵니다.
  - 이 값을 복사해 **5-2의 `PILOT_JUDGE_SECRET`** 에 붙여 넣습니다.
  - 붙여 넣은 뒤 SQL Editor 탭을 닫습니다. 채팅·메일에는 붙여 넣지 않습니다.
- 2-4: '결과' 열이 모두 **정상**이어야 합니다. 단, 관리자·현장기사 항목(11·12)은 3장을 마친 뒤 정상이 됩니다.

> 2-1은 seed 없는 별도 로컬 Supabase(PostgreSQL 17, 운영과 같은 비슈퍼유저 `postgres` 계정)에서 실제로 적용해 확인했습니다. 적용 뒤 점검 13항목이 정상이었고, DB 시험 53건이 그 DB에서 통과했습니다. 운영 프로젝트에서 처음 적용할 때 오류가 나면 바로 알려 주세요.
>
> `supabase/seed.sql`은 **운영에 넣지 않습니다**(개발용 서명키). 2-2가 개발용 값을 발견하면 무작위 값으로 바꿉니다.
>
> SQL Editor로 적용하면 Supabase CLI의 마이그레이션 이력표에는 남지 않습니다. 이후 변경도 같은 방식(새 묶음 파일)으로 적용합니다.

---

## 3. Supabase — 로그인 설정과 계정 (사용자 작업 ③)

### 3-1. 공개 가입 끄기
**Authentication → Sign In / Providers**(또는 Providers / Auth Settings)
- **Allow new users to sign up**: **끔**. 아무나 가입하지 못하게 합니다. 계정은 관리자가 만듭니다.
- **Email** 제공자: 켬 (이메일·비밀번호 로그인)

### 3-2. 주소 설정
**Authentication → URL Configuration**
- **Site URL**: Vercel 운영 주소. 예) `https://<프로젝트>.vercel.app` 또는 회사 도메인
- **Redirect URLs**: `https://<운영 주소>/pilot/auth/confirm` 추가

### 3-3. 계정 만들기 — 메일 없이 (권장)
Supabase 기본 메일은 **프로젝트 팀원 주소에만, 시간당 2통**까지 보냅니다(공식 문서). 그래서 현장기사에게 초대 메일이 가지 않습니다. 계정은 아래처럼 직접 만듭니다.

1. **Authentication → Users → Add user → Create new user**
2. 이메일 · 임시 비밀번호 입력 → **Auto Confirm User** 켬 → **Create user**
3. 만들 계정
   - 관리자 1~2명
   - 현장기사 A · 현장기사 B (시험 A)
   - 시험용이면 이메일 앞에 `test-`를 붙여 실제 사람 계정과 구분합니다
4. 임시 비밀번호는 **직접 만나서** 알려 줍니다. 첫 로그인 뒤 **계정 → 비밀번호 바꾸기**에서 바꾸게 합니다.
5. 관리자 1명은 SQL Editor에서 `03_bootstrap_admin.sql`의 이메일·이름 칸을 바꿔 실행합니다.
   - 계정이 없으면 `[입력] … 계정이 없습니다` 오류가 납니다.
6. 그 관리자가 운영 주소 `/pilot/login`으로 로그인합니다. **2단계 인증(TOTP) 등록** 화면이 나오면 휴대폰 인증 앱(Google Authenticator, Microsoft Authenticator 등)으로 QR을 찍습니다.
7. 관리자 화면 **계정** 탭에서 현장기사 계정을 **활성화**하고 이름을 넣습니다. 새 계정은 처음에 비활성입니다.

### 3-4. 메일 양식 · 사용자 SMTP (선택)
- **Authentication → Emails(Templates)**
  - **Invite user**와 **Reset password** 양식을 저장소 `supabase/templates/invite.html`, `recovery.html` 내용으로 바꿉니다.
  - 링크가 `/pilot/auth/confirm`으로 가게 됩니다.
- 로그인 화면의 **'비밀번호를 잊었어요'** 는 Supabase 공식 비밀번호 재설정 메일 흐름(`resetPasswordForEmail`)입니다.
  - 기본 메일로는 현장기사에게 도착하지 않습니다(팀원에게만 · 시간당 2통).
  - 현장기사가 직접 재설정하게 하려면 **Authentication → Emails → SMTP Settings**에 회사 메일 서버나 메일 발송 서비스를 넣어야 합니다(별도 승인). 실제 업무 시험(B·C·D) 전에 정하기를 권합니다.

### 3-5. 2단계 인증 확인
**Authentication → Multi-Factor**(또는 MFA)에서 **TOTP가 켜져(Enabled)** 있는지 봅니다. 관리자 화면은 TOTP 인증을 마쳐야 열립니다.
관리자는 **2명 이상** 두기를 권합니다. 한 사람이 인증 앱 휴대폰을 잃어도 다른 관리자가 업무를 이어 갈 수 있습니다.

### 3-6. 계정 복구 — 공식 방법만 씁니다
`auth` 스키마의 표(`auth.users`, `auth.mfa_factors`)는 SQL로 직접 고치지 않습니다. Supabase가 관리하는 표라서, 직접 고치면 공식 동작(로그인 기록 · 세션 정리)을 건너뛸 수 있습니다.

| 상황 | 1순위 (지원되는 관리 기능) | 2순위 (공식 Auth Admin API · DB 소유자 PC에서만) |
|---|---|---|
| 비밀번호를 잊음 | 사용자 SMTP를 설정한 뒤 본인이 로그인 화면 **'비밀번호를 잊었어요'** → 메일 링크 → 새 비밀번호 | `node scripts/auth-admin.mjs reset-password 이메일` → 새 임시 비밀번호(16자)를 화면에 한 번 표시 → 본인에게 직접 전달 → 첫 로그인 뒤 **계정 → 비밀번호 바꾸기** (`auth.admin.updateUserById`) |
| 관리자가 인증 앱 휴대폰을 잃음 | 다른 관리자가 업무를 이어 감 (관리자 2명 이상) | `node scripts/auth-admin.mjs list-mfa 이메일`로 확인 → `remove-mfa 이메일`로 2단계 인증 요소 삭제(`auth.admin.mfa.deleteFactor`) → 그 사람의 로그인이 모두 끊기고, 다음 로그인 때 2단계 인증을 다시 등록 |

Supabase 대시보드에서 사용자별 2단계 인증 요소를 지우는 기능은 공식 문서에서 확인하지 못했습니다. 그래서 2순위는 공식 Auth Admin API를 부르는 관리 스크립트로 정했습니다.

**2순위 실행 방법 (DB 소유자만 · 필요할 때만)**
1. Node.js가 설치된 **DB 소유자 본인의 PC**에서 저장소를 받고, 저장소 폴더에서 `npm install`을 한 번 합니다.
2. 위 명령을 실행합니다. 프로젝트 주소와 **Secret key**를 묻습니다.
   - Secret key: Supabase → **Project Settings → API Keys → Secret key**. 입력해도 화면에 보이지 않습니다.
   - `yes`를 입력해야 실행됩니다.
3. 끝나면 터미널 창을 닫고, 실행 일시와 대상(이메일)을 운영 기록에 남깁니다.

**Secret key 원칙**
- 이 키는 이 스크립트를 실행하는 순간에만 DB 소유자 PC의 터미널에 입력합니다.
- **앱 · Vercel 환경변수 · 브라우저 · 채팅 · 메일 · GitHub에 넣지 않습니다.** 앱은 이 키를 쓰지 않습니다. 앱 코드에 서비스 키나 관리자 API가 없는지는 자동 시험이 확인합니다.
- 키가 노출됐다고 의심되면 Supabase **API Keys** 화면에서 새 키를 만들고, 옛 키를 폐기합니다.

로컬 확인 (`tests-pilot/db-auth-admin.test.ts`, 로컬 Supabase · 개발용 키):
- 새 임시 비밀번호로 로그인되고, 옛 비밀번호는 거절됩니다. 없는 계정은 오류가 납니다.
- 2단계 인증 요소를 지우면 0개가 됩니다.
- 공개 키로는 실행되지 않습니다.

---

## 4. Supabase — 사진 저장소 · 백업 확인 (사용자 작업 ④)

- **Storage**: `field-photos`가 보이고 **Public 표시가 없어야** 합니다(비공개).
  - 2-1이 만듭니다. 대시보드에서 Public으로 바꾸지 않습니다.
- **Database → Backups**
  - Pro면 일일 백업 목록이 보입니다(7일 보관).
  - Free면 백업이 없습니다. 매일 증빙 PDF·JSON·CSV를 내려받아 보관합니다.
- **주의 — 사진 파일은 DB 백업에 들어가지 않습니다** (Supabase 공식 문서: "Database backups do not include objects you store via the Storage API").
  - 사진 기록(지문·크기·경로)은 DB 백업에 들어갑니다. 사진 파일 자체는 저장소에만 있습니다.
  - 시험 기간에는 사건 증빙 PDF(사진 포함 인쇄본)를 날짜별로 보관합니다.
  - 장기 운영 전에 사진 파일 백업 방법을 정합니다 (`FIELD_SYSTEM_OPERATIONS_READINESS.md` ⑦).
- **Project Settings → API Keys**
  - **Publishable key**(`sb_publishable_…`)를 5-2에 씁니다. 브라우저에 보여도 되는 공개 키입니다.
  - **Secret key / service_role**은 어디에도 넣지 않습니다.
- **Project URL**: Project Settings → Data API(또는 상단 Connect) 의 `https://<참조>.supabase.co`

---

## 5. Vercel — 기존 프로젝트에 연결 (사용자 작업 ⑤)

### 5-1. 함수 실행 지역을 서울로
**Project → Settings → Functions → Function Regions → Seoul (icn1)**
- 새 프로젝트의 기본값은 미국 워싱턴 D.C.(`iad1`)입니다(공식 문서).
- 서울 DB와 멀면 버튼 한 번에 DB 왕복이 여러 번 생겨 느려집니다.
- Hobby도 지역 1개는 고를 수 있습니다.

### 5-2. 환경변수 4개
**Project → Settings → Environment Variables → Add**. 4개 모두 적용 범위는 **Production만** 체크하고, Preview·Development는 끕니다.
- 미리보기 배포가 운영 DB에 기록하지 않게 하려는 것입니다.
- 미리보기 화면은 '설정 안 됨'으로 보이고, 데모 화면은 그대로 동작합니다.

| Key | Value | 표시 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 4장의 Project URL | 일반 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 4장의 Publishable key | 일반 |
| `NEXT_PUBLIC_PILOT_DB_LABEL` | `실증 DB` | 일반 |
| `PILOT_JUDGE_SECRET` | 2-2 결과의 64자 값 | **Sensitive** 켬 |

### 5-3. 다시 배포
**Deployments → 맨 위 Production 배포 → … → Redeploy**
- `NEXT_PUBLIC_` 값은 빌드할 때 프로그램에 들어갑니다. 그래서 환경변수를 넣은 뒤에는 **반드시 다시 배포**해야 합니다.
- 'Use existing Build Cache'는 끄고 배포합니다.
- 배포가 **Ready**가 되면 6장으로 갑니다.

### 5-4. 접근 보호 (현장기사 접속 주소)
**Project → Settings → Deployment Protection**
- 범위는 **Standard Protection**(기본 권장)으로 둡니다.
  - 운영 도메인은 공개되고, 미리보기 주소만 보호됩니다.
- 운영 도메인에는 Vercel 로그인을 걸지 않습니다.
  - **All Deployments**에 Vercel Authentication을 켜면 현장기사도 Vercel 계정이 있어야 들어옵니다.
  - 접근은 앱 로그인으로 막습니다. 현장기사는 본인 자료만, 관리자는 TOTP까지 마쳐야 합니다.
- 현장기사에게 알려 줄 주소: **Project → Domains**의 운영 도메인 + `/pilot/login`
  - 휴대폰에서 열고 '홈 화면에 추가'하면 앱처럼 쓸 수 있습니다.
- `/pilot` 화면은 검색엔진에 노출되지 않게 막아 두었습니다(noindex · 보안 헤더).

---

## 6. 연결 확인 (사용자 작업 ⑥ — 10분)

1. PC 브라우저에서 `https://<운영 도메인>/pilot/login` → 화면 띠에 **`실증 DB`** 가 보입니다.
   - '설정 안 됨'이면 5-2·5-3을 다시 확인합니다.
2. 관리자 로그인 → TOTP 등록 → 일정판이 열립니다.
3. 관리자 **계정** 탭에 현장기사 A·B가 보입니다. 활성화합니다.
4. SQL Editor에서 `04_verify_setup.sql` 실행 → 13항목 모두 **정상**
5. 관리자 일정판에서 **검증 시나리오** 날짜로 시험 일정을 하나 등록합니다. 판단 이력에 판단이 생기는지 봅니다.
   - '판단 대기'가 계속 남으면 서명키가 서로 다른 것입니다: Vercel `PILOT_JUDGE_SECRET` ≠ DB 값.
   - 이때는 2-2를 다시 실행하고, 나온 값을 5-2에 다시 넣은 뒤 다시 배포합니다.
6. 이상이 없으면 `docs/FIELD_TEST_EXECUTION.md` **시험 A**(실제 기기 연동)로 넘어갑니다.

---

## 7. 사용자 작업 요약 (체크리스트)

| # | 할 일 | 어디서 | 비밀정보 |
|---|---|---|---|
| ① | Supabase 새 프로젝트 (서울 · 플랜 결정) | supabase.com/dashboard | DB 비밀번호 → 비밀번호 관리자 |
| ② | SQL 01 → 02 → (③ 뒤) 03 → 04 | SQL Editor | 02의 서명키 → Vercel에만 |
| ③ | 가입 끄기 · 주소 · 계정 만들기 · 관리자 TOTP (관리자 2명 이상) | Authentication | 임시 비밀번호 → 직접 전달 |
| ④ | 사진 저장소 비공개 · 백업 · 키 확인 | Storage · Database · Project Settings | Secret key는 쓰지 않음 |
| ⑤ | 서울 지역 · 환경변수 4개(Production) · 다시 배포 · Standard Protection | Vercel Project Settings | `PILOT_JUDGE_SECRET` Sensitive |
| ⑥ | 연결 확인 6단계 | 운영 주소 · SQL Editor | — |
| (선택) | Vercel Pro · Supabase Pro · 사용자 SMTP | Billing · Emails | 별도 승인 |
| (필요할 때) | 계정 복구: 비밀번호 · 2단계 인증 요소 (3-6) | DB 소유자 PC · 공식 Auth Admin API | Secret key는 그 터미널에만 |

문제가 생기면 화면에 나온 **오류 문구**와 **어느 단계였는지**만 알려 주세요. 비밀번호·키 값은 보내지 않습니다.
