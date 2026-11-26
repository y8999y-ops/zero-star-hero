// 打包 Cloudflare Workers 靜態資源到 dist/：
//   dist/math/      遊戲前端、程式像素圖、美術資源與建置好的題庫（不含 raw/art/docs）
//   dist/admin/     教師管理後台
//   dist/pixelfx/   戰鬥特效相依模組（從 ../pixelfx/src 複製）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

function copy(src, dst) {
  if (!fs.existsSync(src)) { console.warn("略過不存在的路徑：", src); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1. 遊戲本體 -> dist/math/
for (const rel of ["index.html", "manifest.json", "style.css", "src", "fx", "assets", "data/questions/built", "data/quiz"]) {
  copy(path.join(root, rel), path.join(dist, "math", rel));
}

// 2. 教師後台 -> dist/admin/
copy(path.join(root, "admin"), path.join(dist, "admin"));

// 3. pixelfx 特效庫 -> dist/pixelfx/src/
const pixelfxSrc = path.resolve(root, "..", "pixelfx", "src");
if (!fs.existsSync(pixelfxSrc)) {
  // Cloudflare 自動部署時 pixelfx（git submodule）可能還沒抓下來 → 先抓
  console.log("抓取 pixelfx 子模組…");
  try { execSync("git submodule update --init --depth 1 pixelfx", { cwd: path.resolve(root, ".."), stdio: "inherit" }); } catch {}
}
if (fs.existsSync(pixelfxSrc)) {
  copy(pixelfxSrc, path.join(dist, "pixelfx", "src"));
} else {
  console.error("❌ 找不到 ../pixelfx/src（戰鬥特效會壞掉），停止打包");
  process.exit(1);
}

// 統計打包檔案數與大小
let files = 0, bytes = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
}
walk(dist);
console.log(`打包完成：dist/（${files} 個檔案，約 ${(bytes / 1024 / 1024).toFixed(2)} MB）`);
