import { createRequire } from "node:module"; import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url); const pw = require("playwright");
const bro = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await bro.newPage({ viewport: { width: 2400, height: 1350 } });
for (const s of process.argv.slice(2)) {
  await page.goto(pathToFileURL(process.cwd() + "/flowbg.html").href + "?seed=" + s);
  await page.waitForFunction(() => document.title === "done", null, { timeout: 120000 });
  await page.screenshot({ path: `bg/flow_${s}.jpg`, type: "jpeg", quality: 92 });
}
await bro.close();
