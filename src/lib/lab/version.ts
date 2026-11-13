/**
 * 프로그램 버전 — 빌드할 때 next.config.ts 가 package.json 버전 + git 커밋(앞 7자리)으로 정한다.
 * 기록·세트·시험마다 이 값을 남겨, 어떤 프로그램으로 시험했는지 확인할 수 있게 한다.
 * (커밋하지 않은 수정이 있는 상태로 빌드하면 '.수정중'이 붙는다)
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
