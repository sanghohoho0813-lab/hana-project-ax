// html → png (1920×1080) — node shot.mjs <in.html> <out.png>
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { resolve } from "node:path";
const require = createRequire(import.meta.url); const pw = require("playwright");
const [inp, out] = process.argv.slice(2);
const bro = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await bro.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(inp)).href, { waitUntil: "load" });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))); if (window.seek) window.seek(5); });
await page.screenshot({ path: out });
await bro.close();
