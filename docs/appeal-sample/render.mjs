// appeal.html(또는 APPEAL_HTML=simple.html) → PDF (A4) · 쪽 미리보기 PNG
// 실행: [APPEAL_HTML=simple.html] node docs/appeal-sample/render.mjs <출력 PDF 경로> [미리보기 폴더]
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, "appeal-sample.pdf"));
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright");
}
const exe = "/opt/pw-browsers/chromium";
const bro = await pw.chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const page = await bro.newPage();
await page.goto(pathToFileURL(join(here, process.env.APPEAL_HTML ?? "appeal.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// 쪽 넘침 점검 — 내용이 쪽 높이를 넘으면 알린다
const over = await page.evaluate(() =>
  [...document.querySelectorAll(".page")].map((p, i) => {
    const m = p.querySelector("main");
    return m.scrollHeight > m.clientHeight + 1 ? `${i + 1}쪽 넘침 ${m.scrollHeight - m.clientHeight}px` : null;
  }).filter(Boolean),
);
console.log(over.length ? over.join("\n") : "넘침 없음");
await page.pdf({ path: out, format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
await bro.close();
console.log("PDF", out);
if (process.argv[3]) {
  mkdirSync(process.argv[3], { recursive: true });
  execSync(`pdftoppm -r 70 -png "${out}" "${join(process.argv[3], "p")}"`);
}
