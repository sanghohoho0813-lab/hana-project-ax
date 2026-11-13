const TAG = /\[(권한|입력|중복|충돌|순서|설정|서명|기록 보호)\]/;

/** 다시 보내도 결과가 같은 오류(권한·입력 검사 등)인지 — 아니면 연결 문제일 수 있어 같은 요청 번호로 다시 보낼 수 있다 */
export function isFinalError(message: string | undefined | null): boolean {
  return TAG.test(message ?? "");
}

/** DB 함수 오류([권한]·[입력]·[중복]·[충돌] …)를 화면 문장으로 — 그 밖의 오류는 원문을 숨기고 일반 문장으로 */
export function friendlyError(message: string | undefined | null): string {
  const m = message ?? "";
  const tagged = m.match(/\[(권한|입력|중복|충돌|순서|설정|서명|기록 보호)\][^\n]*/);
  if (tagged) return tagged[0];
  if (/Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (/Email not confirmed/i.test(m)) return "이메일 확인이 끝나지 않은 계정입니다. 초대 메일의 링크를 먼저 눌러 주세요.";
  if (/rate limit|too many/i.test(m)) return "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.";
  if (/fetch failed|network|ECONN|timeout/i.test(m)) return "서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
  if (/weak|password should|Password should/i.test(m)) return "비밀번호는 10자 이상이며 영문 대문자·소문자·숫자를 모두 넣어 주세요.";
  if (/Invalid TOTP|invalid.*code|expired/i.test(m)) return "인증 코드가 맞지 않거나 만료됐습니다.";
  return "처리하지 못했습니다. 잠시 뒤 다시 시도하고, 계속되면 관리자에게 알려 주세요.";
}
