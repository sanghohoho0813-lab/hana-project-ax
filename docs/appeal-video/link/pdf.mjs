import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { resolve } from "node:path";
const require = createRequire(import.meta.url); const pw = require("playwright");
const bro = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await bro.newPage();
await page.goto(pathToFileURL(resolve("page.html")).href, { waitUntil: "load" });
await page.evaluate(async () => { await document.fonts.ready; });
await page.pdf({ path: process.argv[2], format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: "1" });
await page.screenshot({ path: "page.png", fullPage: true });
await bro.close();
