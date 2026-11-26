// 打包「離線版」：把遊戲整個塞進一個 html，不用伺服器、不用網路，點兩下就能玩。
//   node tools/build-offline.mjs      → offline/魔數學院-離線版.html
//
// 做法：
//   1. 從 src/main.js 開始跟著 import 找出所有用到的程式（含 ../pixelfx），每個檔案的 import 路徑改成「@mosu/路徑」，
//      import.meta.url 改成假網址 https://mosu.offline/路徑；開頁時把每個檔案變成 blob 網址，用 import map 接起來。
//   2. assets/ 的圖片、題庫 JSON 都轉成 base64 放進 html；開頁時攔下 fetch、圖片 src、背景圖，把假網址換成內嵌的資料。
//   3. 雲端功能（登入、雲端存檔）連不到伺服器會自動退回本機存檔，不用改。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");   // math/
const repo = path.resolve(root, "..");                                            // 有 math/ 和 pixelfx/ 的那層
const ORIGIN = "https://mosu.offline/";
const rel = (abs) => path.relative(repo, abs).split(path.sep).join("/");

// ── 1. 程式：跟著 import 走 ──
const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(?\s*|\bexport\s*\*\s*from\s*)(["'])([^"'\n]+)\2/g;
const modules = new Map();     // 相對路徑 → 改寫後的原始碼
function addModule(abs) {
  const id = rel(abs);
  if (modules.has(id)) return;
  modules.set(id, "");
  let src = fs.readFileSync(abs, "utf8");
  src = src.replace(IMPORT_RE, (all, pre, q, spec) => {
    if (!spec.startsWith(".") && !spec.startsWith("/")) return all;
    const dep = path.resolve(path.dirname(abs), spec);
    if (!fs.existsSync(dep)) throw new Error(`找不到 ${spec}（${id}）`);
    addModule(dep);
    return `${pre}${q}@mosu/${rel(dep)}${q}`;
  });
  src = src.replace(/\bimport\.meta\.url\b/g, JSON.stringify(ORIGIN + id));
  modules.set(id, src);
}
addModule(path.join(root, "src", "main.js"));

// ── 2. 素材：圖片與資料 ──
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", json: "application/json", webp: "image/webp", gif: "image/gif" };
const assets = {};
function addDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { addDir(p); continue; }
    const ext = e.name.split(".").pop().toLowerCase();
    if (!MIME[ext]) continue;
    assets[rel(p)] = `data:${MIME[ext]};base64,${fs.readFileSync(p).toString("base64")}`;
  }
}
for (const d of ["assets", "data/questions/built", "data/quiz"]) addDir(path.join(root, d));

// ── 3. 組成 html ──
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const body = indexHtml.slice(indexHtml.indexOf("<body>") + 6, indexHtml.indexOf("<script"));
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

const boot = `
(() => {
  const ORIGIN = ${JSON.stringify(ORIGIN)};
  const A = JSON.parse(document.getElementById("mosu-assets").textContent);
  const M = JSON.parse(document.getElementById("mosu-modules").textContent);
  // 假網址 → 內嵌資料
  const local = (u) => {
    const s = String(u);
    if (!s.startsWith(ORIGIN)) return s;
    const k = decodeURI(s.slice(ORIGIN.length).split(/[?#]/)[0]);
    return A[k] ?? s;
  };
  // fetch：題庫 JSON
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (u && u.startsWith(ORIGIN)) {
      const d = local(u);
      if (d === u) return Promise.resolve(new Response("Not Found", { status: 404 }));
      return realFetch(d);
    }
    return realFetch(input, init);
  };
  // 圖片 src
  const imgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", { ...imgSrc, set(v) { imgSrc.set.call(this, local(v)); } });
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { return setAttr.call(this, n, (n === "src" || n === "href") ? local(v) : v); };
  // 背景圖 url(...)
  const fixUrl = (v) => typeof v === "string" ? v.replace(/url\\((["']?)(https:\\/\\/mosu\\.offline\\/[^"')]+)\\1\\)/g, (a, q, u) => "url(" + q + local(u) + q + ")") : v;
  // 背景圖（Chrome 的 style 屬性攔不到）→ 看到 style 裡有假網址就換掉
  const fixEl = (e) => { const st = e.getAttribute?.("style"); if (st && st.includes(ORIGIN)) e.setAttribute("style", fixUrl(st)); };
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "attributes") fixEl(m.target);
      else for (const n of m.addedNodes) if (n.nodeType === 1) { fixEl(n); n.querySelectorAll?.("[style]").forEach(fixEl); }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
  // 程式：每個檔案變成 blob 網址，用 import map 接起來
  const imports = {};
  for (const [id, code] of Object.entries(M)) imports["@mosu/" + id] = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const map = document.createElement("script");
  map.type = "importmap";
  map.textContent = JSON.stringify({ imports });
  document.head.append(map);
  const main = document.createElement("script");
  main.type = "module";
  main.textContent = 'import "@mosu/math/src/main.js";';
  document.body.append(main);
})();`;

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>魔數學院（離線版）</title>
<meta name="theme-color" content="#17122a">
<style>
${css}
</style>
</head>
<body>${body}
<script type="application/json" id="mosu-assets">${json(assets)}</script>
<script type="application/json" id="mosu-modules">${json(Object.fromEntries(modules))}</script>
<script>${boot}</script>
</body>
</html>
`;

const outDir = path.join(root, "offline");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "魔數學院-離線版.html");
fs.writeFileSync(out, html);
console.log(`離線版完成：${rel(out)}（程式 ${modules.size} 個、素材 ${Object.keys(assets).length} 個，${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB）`);
