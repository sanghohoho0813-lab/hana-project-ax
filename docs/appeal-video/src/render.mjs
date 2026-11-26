// player.html → 프레임 → mp4 (녹음 합성)
// 미리보기: node render.mjs shots <폴더> t1 t2 …
// 영상:     node render.mjs video <출력.mp4> [fps=30] [workers=3]
import { createRequire } from "node:module";
import { execSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(execSync("npm root -g", { encoding: "utf8" }).trim() + "/playwright"); }
const exe = "/opt/pw-browsers/chromium";
const TL = JSON.parse(readFileSync(join(here, "timeline.json"), "utf8"));
const [mode, outArg, ...rest] = process.argv.slice(2);
const out = resolve(outArg); // 상대 경로면 concat 목록이 out/out/… 으로 꼬인다

async function openPage(bro) {
  const page = await bro.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(here, "player.html")).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  return page;
}

const bro = await pw.chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
if (mode === "shots") {
  mkdirSync(out, { recursive: true });
  const page = await openPage(bro);
  for (const t of rest.map(Number)) {
    await page.evaluate((t) => window.seek(t), t);
    await page.screenshot({ path: join(out, `t${String(t.toFixed(1)).padStart(6, "0")}.jpg`), type: "jpeg", quality: 85 });
  }
} else {
  const fps = Number(rest[0] ?? 30), W = Number(rest[1] ?? 3);
  const N = Math.ceil(TL.end * fps);
  const parts = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: W }, async (_, w) => {
    const a = Math.floor((N * w) / W), b = Math.floor((N * (w + 1)) / W);
    const part = join(dirname(out), `part${w}.mp4`);
    parts[w] = part;
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(fps), part], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((r) => ff.on("close", r));
    const page = await openPage(bro);
    for (let f = a; f < b; f++) {
      await page.evaluate((t) => window.seek(t), f / fps);
      const buf = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (w === 0 && (f - a) % 300 === 0) console.log(`w0 ${f - a}/${b - a} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    await page.close();
  }));
  const list = join(dirname(out), "parts.txt");
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const silent = join(dirname(out), "video_silent.mp4");
  execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${list}" -c copy "${silent}"`);
  execSync(`ffmpeg -y -loglevel error -i "${silent}" -i "${join(here, "narration.wav")}" -filter_complex "[1:a]apad,aresample=48000[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "${out}"`);
  console.log(`done ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await bro.close();
