// 本地動態網站測試伺服器（使用 Node 內建 node:sqlite 模擬 Cloudflare D1，直接執行 worker/index.js）
// 啟動：node tools/local-worker.mjs
// 打開遊戲：http://localhost:8787/math/
// 打開教師後台：http://localhost:8787/admin/

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const dbPath = path.join(root, "worker", ".local.sqlite");
const schemaPath = path.join(root, "worker", "schema.sql");

// 建立與 Cloudflare D1 相容的薄層轉接器
export function createD1Adapter(sqliteDb) {
  sqliteDb.exec("PRAGMA foreign_keys = ON;");
  return {
    prepare(sql) {
      let args = [];
      const stmt = sqliteDb.prepare(sql);
      return {
        bind(...v) { args = v; return this; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() {
          const r = stmt.run(...args);
          return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
      };
    },
  };
}

function readDevPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const f = path.join(root, "worker", ".dev.vars");
  if (fs.existsSync(f)) {
    const m = fs.readFileSync(f, "utf8").match(/^ADMIN_PASSWORD\s*=\s*(.+)$/m);
    if (m) return m[1].trim();
  }
  return "1234";
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
};

function serveStatic(reqUrl) {
  let pathname = decodeURIComponent(reqUrl.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  let filePath = null;
  if (pathname.startsWith("/admin/")) filePath = path.join(root, pathname.slice(1));
  else if (pathname.startsWith("/math/")) filePath = path.join(root, pathname.slice(6));
  else if (pathname.startsWith("/pixelfx/")) filePath = path.join(repoRoot, pathname.slice(1));
  if (!filePath || !filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return new Response("Not Found", { status: 404 });
  }
  const ext = path.extname(filePath).toLowerCase();
  return new Response(fs.readFileSync(filePath), { headers: { "content-type": MIME[ext] || "application/octet-stream" } });
}

// 只有直接執行此檔案時才啟動監聽（供 test-worker.mjs 匯入 createD1Adapter）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec(fs.readFileSync(schemaPath, "utf8"));
  const env = {
    DB: createD1Adapter(sqlite),
    ADMIN_PASSWORD: readDevPassword(),
    ASSETS: { fetch: async (req) => serveStatic(new URL(req.url)) },
  };
  const port = Number(process.env.PORT) || 8787;
  http.createServer(async (req, res) => {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const body = chunks.length && !["GET", "HEAD"].includes(req.method) ? Buffer.concat(chunks) : undefined;
    const url = `http://localhost:${port}${req.url}`;
    const webReq = new Request(url, { method: req.method, headers: req.headers, body });
    const webRes = await worker.fetch(webReq, env);
    res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
    res.end(Buffer.from(await webRes.arrayBuffer()));
  }).listen(port, () => {
    console.log(`《魔數學院》動態網站本地測試中：`);
    console.log(`  遊戲網址：http://localhost:${port}/math/`);
    console.log(`  教師後台：http://localhost:${port}/admin/（本地預設密碼：${env.ADMIN_PASSWORD}）`);
    console.log(`  本地資料庫：${dbPath}`);
  });
}
