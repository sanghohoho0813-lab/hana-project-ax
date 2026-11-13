import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** 프로그램 버전 = package.json 버전 + 커밋 (실증 기록마다 남김 — src/lib/lab/version.ts) */
function appVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
  let commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  let dirty = false;
  if (!commit) {
    try {
      commit = execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      dirty = execSync("git status --porcelain --untracked-files=no", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() !== "";
    } catch {
      commit = "";
    }
  }
  return `${pkg.version}${commit ? `+${commit}${dirty ? ".수정중" : ""}` : ""}`;
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
};

export default nextConfig;
