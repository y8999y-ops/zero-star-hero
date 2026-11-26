// 端對端測試：以記憶體 SQLite (node:sqlite) 跑完整個 worker/index.js API + admin/qr.js 驗證。

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";
import { createD1Adapter } from "./local-worker.mjs";
import { qrSvg } from "../admin/qr.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(fs.readFileSync(path.join(root, "worker", "schema.sql"), "utf8"));

const env = {
  DB: createD1Adapter(sqlite),
  ADMIN_PASSWORD: "teacher-secret-2026",
  ASSETS: { fetch: async () => new Response("asset-ok") },
};

async function call(method, urlPath, { body, token } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const req = new Request(`https://mosu.example.com${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env);
  const ct = res.headers.get("content-type") || "";
  const raw = new Uint8Array(await res.arrayBuffer());
  const txt = new TextDecoder("utf-8", { ignoreBOM: true }).decode(raw);
  const data = ct.includes("application/json") ? JSON.parse(txt) : txt;
  return { status: res.status, data, raw, headers: res.headers };
}

// 1. Health & Redirects
{
  const r = await call("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.hasAdminPassword, true);

  const rootRedir = await worker.fetch(new Request("https://mosu.example.com/?code=402-1-07-K9"), env);
  assert.equal(rootRedir.status, 302);
  assert.equal(rootRedir.headers.get("location"), "https://mosu.example.com/math/?code=402-1-07-K9");
}

// 2. Admin Auth
{
  const bad = await call("POST", "/api/admin/login", { body: { password: "wrong" } });
  assert.equal(bad.status, 401);
  const unauth = await call("GET", "/api/admin/classes");
  assert.equal(unauth.status, 401);
}
const loginRes = await call("POST", "/api/admin/login", { body: { password: "teacher-secret-2026" } });
assert.equal(loginRes.status, 200);
const adminToken = loginRes.data.token;
assert.ok(adminToken);

// 3. Classes CRUD
const cls1 = await call("POST", "/api/admin/classes", { token: adminToken, body: { code: "402", name: "四年二班" } });
assert.equal(cls1.status, 200);
const dup = await call("POST", "/api/admin/classes", { token: adminToken, body: { code: "402", name: "重複班" } });
assert.equal(dup.status, 409);

// 4. Bulk Create Students（班級-組別-座號-2碼 & 無組別）
const bulk = await call("POST", "/api/admin/students/bulk", {
  token: adminToken,
  body: {
    classId: cls1.data.id,
    rows: [
      { group: "1", seat: "7", name: "王小明" },
      { group: "", seat: "8", name: "陳小美" },
    ],
  },
});
assert.equal(bulk.status, 200);
assert.equal(bulk.data.created.length, 2);
const [st1, st2] = bulk.data.created;
assert.match(st1.loginCode, /^[A-Z2-9]{4}$/);
assert.match(st2.loginCode, /^[A-Z2-9]{4}$/);

// 5. Student Login（不分大小寫、去連字號與空白也能登）
const messyCode = st1.loginCode.toLowerCase().replace(/-/g, " ");
const stLogin = await call("POST", "/api/student/login", { body: { code: messyCode } });
assert.equal(stLogin.status, 200);
assert.equal(stLogin.data.student.name, "王小明");
const stToken = stLogin.data.token;

// 6. Sync Idempotency（活躍時間、場次、錯題與畢業）
const save1 = {
  lv: 4,
  practice: { "big-0": 3, "big-1": 3, "frac-0": 3 }, // (6+3)/60 = 15%
  review: { "frac-e": { left: 3, sample: "2/5 ＋ 1/5 ＝ ？", grade: "g2", branch: "frac" } },
  branches: { frac: { best: 2, recent: [] } },
};
const sync1 = await call("POST", "/api/student/sync", {
  token: stToken,
  body: {
    save: save1,
    session: { clientSid: "sid_1", startedAt: new Date().toISOString(), activeSec: 45, answered: 5, correct: 4 },
    mistakes: [{
      clientMid: "m_1", branch: "frac", grade: "g2", typeKey: "frac-e",
      questionText: "2/5 ＋ 1/5 ＝ ？", studentAnswer: "3/10", correctAnswer: "3/5", mode: "practice",
    }],
  },
});
assert.equal(sync1.status, 200);

// 同一場次再次心跳（activeSec 增到 120、同一 clientMid 不重複插入）
await call("POST", "/api/student/sync", {
  token: stToken,
  body: {
    save: { ...save1, review: {} },
    session: { clientSid: "sid_1", startedAt: new Date().toISOString(), activeSec: 120, answered: 8, correct: 7 },
    mistakes: [{
      clientMid: "m_1", branch: "frac", grade: "g2", typeKey: "frac-e",
      questionText: "2/5 ＋ 1/5 ＝ ？", studentAnswer: "3/10", correctAnswer: "3/5", mode: "practice",
    }],
    resolvedKeys: ["frac-e"],
  },
});

// 驗證總覽與學生詳情數據完全精準
const ov = await call("GET", `/api/admin/overview?classId=${cls1.data.id}`, { token: adminToken });
assert.equal(ov.status, 200);
const st1Ov = ov.data.students.find((x) => x.id === st1.id);
assert.equal(st1Ov.sessionCount, 1);
assert.equal(st1Ov.totalPlaySec, 120);
assert.equal(st1Ov.totalAnswered, 8);
assert.equal(st1Ov.totalCorrect, 7);
assert.equal(st1Ov.progressPct, 15);
assert.equal(st1Ov.reviewCount, 0);

const det = await call("GET", `/api/admin/students/${st1.id}`, { token: adminToken });
assert.equal(det.status, 200);
assert.equal(det.data.mistakes.length, 1);
assert.equal(det.data.mistakes[0].student_answer, "3/10");
assert.equal(det.data.mistakes[0].resolved, 1); // 畢業後仍保留歷史且標記已畢業

// 7. Analytics & CSV Export
const ana = await call("GET", `/api/admin/analytics?classId=${cls1.data.id}`, { token: adminToken });
assert.equal(ana.status, 200);
assert.equal(ana.data.byBranch[0].branch, "frac");
assert.equal(ana.data.byBranch[0].total_mistakes, 1);

const csv1 = await call("GET", `/api/admin/export?type=overview&classId=${cls1.data.id}`, { token: adminToken });
assert.equal(csv1.status, 200);
assert.ok(csv1.data.startsWith("\uFEFF班級,組別,座號,姓名"));
assert.ok(csv1.data.includes("王小明"));

const csv2 = await call("GET", `/api/admin/export?type=mistakes&classId=${cls1.data.id}`, { token: adminToken });
assert.equal(csv2.status, 200);
assert.ok(csv2.data.includes("3/10"));
assert.ok(csv2.data.includes("已畢業"));

// 8. Regen Code & Reset
const regen = await call("POST", `/api/admin/students/${st1.id}/regen-code`, { token: adminToken });
assert.equal(regen.status, 200);
assert.match(regen.data.loginCode, /^[A-Z2-9]{4}$/);
const regenAll = await call("POST", `/api/admin/classes/${st1.classId}/regen-codes`, { token: adminToken });
assert.equal(regenAll.status, 200);
assert.equal(regenAll.data.count, 2);
const reset = await call("POST", `/api/admin/students/${st1.id}/reset`, { token: adminToken });
assert.equal(reset.status, 200);
const detAfter = await call("GET", `/api/admin/students/${st1.id}`, { token: adminToken });
assert.equal(detAfter.data.student.totalPlaySec, 0);
assert.equal(detAfter.data.mistakes.length, 0);

// 9. QR SVG Generator
const svg = qrSvg(`https://mosu-academy.example.workers.dev/math/?code=${st1.loginCode}`, 96);
assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>") && svg.includes("<path d=\"M"));

console.log("ALL WORKER + D1 + QR TESTS PASSED! (9/9)");
