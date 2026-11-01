// 비교시험용 AX 화면을 파일 하나(HTML)로 묶는다 — 인터넷 없이 열려도 동작하고(글꼴만 온라인), 서버가 필요 없다.
//   node trial/tools/build-ax-screen.mjs
// 판단 엔진·카드·우선순위 목록은 src/ 의 실제 코드를 그대로 묶고, 스타일은 앱과 같은 globals.css 를 Tailwind 로 만든다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = path.join(root, "trial/dist/AX_trial_screen.html");

const js = await build({
  entryPoints: [path.join(root, "trial/ax-screen/main.tsx")],
  absWorkingDir: root,
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  jsx: "automatic",
  target: "es2019",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const cssSrc = path.join(root, "src/app/globals.css");
const css = await postcss([tailwind({ base: root })]).process(readFileSync(cssSrc, "utf8"), { from: cssSrc });

// 기준 프로그램 커밋 = src/ 를 마지막으로 바꾼 커밋 (trial/ 커밋이 생겨도 바뀌지 않는다)
let commit = "unknown";
try {
  commit = execSync("git log -1 --format=%h -- src", { cwd: root }).toString().trim();
} catch {}
const engineHash = createHash("sha256")
  .update(readFileSync(path.join(root, "src/lib/risk-engine.ts")))
  .update(readFileSync(path.join(root, "src/lib/priority-engine.ts")))
  .digest("hex")
  .slice(0, 12);

const html = `<!doctype html>
<html lang="ko" class="h-full antialiased">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>하나 프로젝트 AX · 비교시험 화면</title>
<!-- 기준 프로그램 커밋 ${commit} (src/ 최종 변경) · 엔진 소스 sha256 ${engineHash} (risk-engine.ts + priority-engine.ts) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${css.css}</style>
</head>
<body class="min-h-full bg-bg text-ink">
<div id="root"></div>
<script>${code}</script>
</body>
</html>
`;
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`AX 시험 화면 → ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB · 기준 프로그램 커밋 ${commit} · 엔진 ${engineHash})`);
