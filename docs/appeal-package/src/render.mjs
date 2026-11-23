// html/*.html → pdf/*.pdf (A4) · 쪽 넘침 점검 · 미리보기 PNG(선택)
// 실행: node docs/appeal-package/src/render.mjs [이름 일부 …]   (예: 04 05)  PREVIEW=<폴더> 이면 쪽 그림도 남긴다
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright");
}
const want = process.argv.slice(2);
const files = readdirSync(join(root, "html"))
  .filter((f) => f.endsWith(".html"))
  .filter((f) => !want.length || want.some((w) => f.includes(w)))
  .sort();
const exe = "/opt/pw-browsers/chromium";
const bro = await pw.chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
mkdirSync(join(root, "pdf"), { recursive: true });
let bad = 0;
for (const f of files) {
  const page = await bro.newPage();
  await page.goto(pathToFileURL(join(root, "html", f)).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const out = [];
    const pages = [...document.querySelectorAll(".page")];
    pages.forEach((p, i) => {
      const m = p.querySelector("main") ?? p.querySelector(".in");
      if (m && m.scrollHeight > m.clientHeight + 1) out.push(`${i + 1}쪽 넘침 ${m.scrollHeight - m.clientHeight}px`);
      // 가로로 넘친 요소(표 · 그림)
      for (const e of p.querySelectorAll("table, figure, .flow, .card")) {
        if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== "hidden") out.push(`${i + 1}쪽 가로 넘침 ${e.className}`);
      }
      for (const img of p.querySelectorAll("img")) if (!img.complete || !img.naturalWidth) out.push(`${i + 1}쪽 그림 없음 ${img.getAttribute("src")}`);
    });
    return { n: pages.length, out };
  });
  const pdf = join(root, "pdf", f.replace(/\.html$/, ".pdf"));
  await page.pdf({ path: pdf, format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  await page.close();
  bad += r.out.length;
  console.log(`${f}: ${r.n}쪽 ${r.out.length ? "\n  " + r.out.join("\n  ") : "· 넘침 없음"}`);
  if (process.env.PREVIEW) {
    const d = join(process.env.PREVIEW, f.replace(/\.html$/, ""));
    mkdirSync(d, { recursive: true });
    execSync(`rm -f "${d}"/p-*.png; pdftoppm -r ${process.env.DPI ?? 60} -png "${pdf}" "${join(d, "p")}"`);
  }
}
await bro.close();
if (bad) process.exitCode = 1;
