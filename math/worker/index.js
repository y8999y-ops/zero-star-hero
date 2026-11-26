// 《魔數學院》Cloudflare Worker：學生代碼登入、雲端存檔與錯題／遊玩時長同步、教師後台 API。
// 靜態遊戲與後台頁面透過 env.ASSETS 提供；所有 /api/* 請求由此處理。

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除易混淆的 0/O/1/I
const ALL_BRANCHES = ["big", "mul", "div", "mix", "frac", "dec", "shape", "measure", "round", "seq"];
const UNIT_NAME = {
  big: "大數與加減", mul: "乘法", div: "除法", mix: "四則併式", frac: "分數",
  dec: "小數", shape: "面積、周長與角度", measure: "時間與單位換算", round: "概數與估算", seq: "數量規律",
};

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

const err = (msg, status = 400) => json({ ok: false, error: msg }, status);

function normCode(raw) {
  return String(raw ?? "").toUpperCase().replace(/[\s\-_－—]+/g, "");
}

function cleanPart(raw) {
  return String(raw ?? "").trim().toUpperCase().replace(/[\s\-_－—]+/g, "");
}

function padSeat(raw) {
  const s = cleanPart(raw);
  return /^\d{1,2}$/.test(s) ? s.padStart(2, "0") : s;
}

function randChars(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

function randToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 2026-11-26 使用者：學生只要輸入 4 碼數字就能登入（0000～9999，可以有 0；重複就重抽）
// 舊的「班級-組別-座號-2碼」代碼照樣能登入（比對 login_key）
function buildLoginCode() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  const loginCode = String(n[0] % 10000).padStart(4, "0");
  return { loginCode, loginKey: normCode(loginCode) };
}

function calcProgressPct(save) {
  if (!save || typeof save !== "object") return 0;
  const p = save.practice ?? {};
  const sum = ALL_BRANCHES.reduce((acc, b) => acc + (Math.min(3, Number(p[`${b}-0`]) || 0) + Math.min(3, Number(p[`${b}-1`]) || 0)) / 6, 0);
  return Math.round((sum / ALL_BRANCHES.length) * 100);
}

// ── 教師後台驗證（HMAC-SHA256 Token，有效期 7 天） ──
async function hmacSign(secret, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeAdminToken(secret) {
  const exp = Date.now() + 7 * 864e5;
  const payload = `admin.${exp}`;
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

async function verifyAdmin(req, env) {
  const secret = env.ADMIN_PASSWORD || "";
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (new URL(req.url).searchParams.get("token") ?? "");
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expect = await hmacSign(secret, `admin.${exp}`);
  return safeEq(parts[2], expect);
}

async function readBody(req) {
  const txt = await req.text();
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return null; }
}

// Excel 開 CSV 會把 0427 變成 427 → 用 ="0427" 讓它當文字
const xlText = (v) => (/^\d+$/.test(String(v ?? "")) ? `="${v}"` : v);

function csvCell(v) {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvResponse(filename, header, rows) {
  const body = "\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}

function formatStudentRow(r) {
  return {
    id: r.id,
    classId: r.class_id,
    classCode: r.class_code,
    className: r.class_name,
    groupName: r.group_name,
    seatNo: r.seat_no,
    name: r.name,
    loginCode: r.login_code,
    lv: r.lv,
    progressPct: r.progress_pct,
    reviewCount: r.review_count,
    totalPlaySec: r.total_play_sec,
    weekPlaySec: r.week_play_sec ?? 0,
    sessionCount: r.session_count,
    totalAnswered: r.total_answered,
    totalCorrect: r.total_correct,
    lastSeenAt: r.last_seen_at,
  };
}

async function createUniqueStudent(db, classId, classCode, groupName, seatNo, name) {
  const g = cleanPart(groupName);
  const seat = padSeat(seatNo);
  const cleanName = String(name ?? "").trim();
  if (!cleanName) throw new Error("姓名不能為空");
  for (let tries = 0; tries < 20; tries++) {
    const { loginCode, loginKey } = buildLoginCode(classCode, g, seat);
    const token = randToken();
    try {
      const res = await db.prepare(
        `INSERT INTO students (class_id, group_name, seat_no, name, login_code, login_key, token)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(classId, g, seat, cleanName, loginCode, loginKey, token).run();
      return { id: res.meta?.last_row_id, classId, classCode, groupName: g, seatNo: seat, name: cleanName, loginCode };
    } catch (e) {
      if (!String(e?.message ?? e).includes("UNIQUE")) throw e;
    }
  }
  throw new Error("無法產生不重複的登入碼");
}

// ── API 路由 ──
async function handleApi(req, env) {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method.toUpperCase();
  const db = env.DB;

  if (m === "GET" && p === "/api/health") {
    return json({ ok: true, hasAdminPassword: !!env.ADMIN_PASSWORD });
  }

  // ── 學生端 API ──
  if (m === "POST" && p === "/api/student/login") {
    const body = await readBody(req);
    if (!body) return err("格式錯誤");
    const key = normCode(body.code);
    if (!key) return err("請輸入學生代碼");
    const row = await db.prepare(
      `SELECT s.*, c.code AS class_code, c.name AS class_name
       FROM students s JOIN classes c ON c.id = s.class_id
       WHERE s.login_key = ?`
    ).bind(key).first();
    if (!row) return err("找不到這個代碼，請再檢查一次！", 404);
    const now = new Date().toISOString();
    await db.prepare(`UPDATE students SET last_seen_at = ? WHERE id = ?`).bind(now, row.id).run();
    let save = null;
    if (row.save_json) { try { save = JSON.parse(row.save_json); } catch {} }
    return json({ ok: true, token: row.token, student: formatStudentRow({ ...row, last_seen_at: now }), save });
  }

  if (m === "GET" && p === "/api/student/me") {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return err("未登入", 401);
    const row = await db.prepare(
      `SELECT s.*, c.code AS class_code, c.name AS class_name
       FROM students s JOIN classes c ON c.id = s.class_id
       WHERE s.token = ?`
    ).bind(token).first();
    if (!row) return err("登入已失效，請重新輸入代碼", 401);
    let save = null;
    if (row.save_json) { try { save = JSON.parse(row.save_json); } catch {} }
    return json({ ok: true, student: formatStudentRow(row), save });
  }

  if (m === "POST" && p === "/api/student/sync") {
    const body = await readBody(req);
    if (!body) return err("格式錯誤");
    const auth = req.headers.get("authorization") ?? "";
    const token = (auth.startsWith("Bearer ") ? auth.slice(7).trim() : "") || String(body.token ?? "");
    if (!token) return err("未登入", 401);
    const st = await db.prepare(`SELECT * FROM students WHERE token = ?`).bind(token).first();
    if (!st) return err("憑證無效", 401);

    const now = new Date().toISOString();
    let deltaSec = 0, deltaSessions = 0, deltaAns = 0, deltaOk = 0;

    // 1. 遊玩場次與活躍秒數（以 client_sid 冪等更新，絕不重複累加）
    if (body.session && body.session.clientSid) {
      const sid = String(body.session.clientSid).slice(0, 64);
      const activeSec = Math.max(0, Math.min(86400, Math.round(Number(body.session.activeSec) || 0)));
      const answered = Math.max(0, Math.min(10000, Math.round(Number(body.session.answered) || 0)));
      const correct = Math.max(0, Math.min(answered, Math.round(Number(body.session.correct) || 0)));
      const startedAt = typeof body.session.startedAt === "string" ? body.session.startedAt : now;
      const existing = await db.prepare(`SELECT active_sec, answered, correct FROM sessions WHERE client_sid = ? AND student_id = ?`).bind(sid, st.id).first();
      if (!existing) {
        await db.prepare(
          `INSERT INTO sessions (student_id, client_sid, started_at, ended_at, active_sec, answered, correct)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(st.id, sid, startedAt, now, activeSec, answered, correct).run();
        deltaSessions = 1;
        deltaSec = activeSec;
        deltaAns = answered;
        deltaOk = correct;
      } else {
        const nextSec = Math.max(existing.active_sec, activeSec);
        const nextAns = Math.max(existing.answered, answered);
        const nextOk = Math.max(existing.correct, correct);
        deltaSec = nextSec - existing.active_sec;
        deltaAns = nextAns - existing.answered;
        deltaOk = nextOk - existing.correct;
        await db.prepare(
          `UPDATE sessions SET ended_at = ?, active_sec = ?, answered = ?, correct = ?
           WHERE client_sid = ? AND student_id = ?`
        ).bind(now, nextSec, nextAns, nextOk, sid, st.id).run();
      }
    }

    // 2. 新增錯題事件紀錄（保留歷史，即使之後從錯題本畢業）
    if (Array.isArray(body.mistakes)) {
      for (const mk of body.mistakes.slice(0, 50)) {
        if (!mk?.questionText) continue;
        const mid = mk.clientMid ? String(mk.clientMid).slice(0, 80) : null;
        await db.prepare(
          `INSERT OR IGNORE INTO mistakes (student_id, client_mid, branch, grade, type_key, question_text, student_answer, correct_answer, mode, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          st.id, mid,
          String(mk.branch ?? "").slice(0, 24),
          String(mk.grade ?? "").slice(0, 16),
          String(mk.typeKey ?? "").slice(0, 64),
          String(mk.questionText).slice(0, 400),
          String(mk.studentAnswer ?? "").slice(0, 120),
          String(mk.correctAnswer ?? "").slice(0, 120),
          String(mk.mode ?? "").slice(0, 24),
          typeof mk.createdAt === "string" ? mk.createdAt : now
        ).run();
      }
    }

    // 3. 已畢業的錯題標記 resolved = 1
    if (Array.isArray(body.resolvedKeys) && body.resolvedKeys.length) {
      for (const tk of body.resolvedKeys.slice(0, 50)) {
        if (!tk) continue;
        await db.prepare(
          `UPDATE mistakes SET resolved = 1, resolved_at = ?
           WHERE student_id = ? AND type_key = ? AND resolved = 0`
        ).bind(now, st.id, String(tk)).run();
      }
    }

    // 4. 更新學生主檔與完整存檔
    const save = body.save && typeof body.save === "object" ? body.save : null;
    const saveStr = save ? JSON.stringify(save) : st.save_json;
    const lv = save ? Math.max(1, Math.round(Number(save.lv) || 1)) : st.lv;
    const progressPct = save ? calcProgressPct(save) : st.progress_pct;
    const reviewCount = save ? Object.keys(save.review ?? {}).length : st.review_count;

    await db.prepare(
      `UPDATE students
       SET save_json = ?, lv = ?, progress_pct = ?, review_count = ?,
           total_play_sec = total_play_sec + ?, session_count = session_count + ?,
           total_answered = total_answered + ?, total_correct = total_correct + ?,
           last_seen_at = ?
       WHERE id = ?`
    ).bind(saveStr, lv, progressPct, reviewCount, deltaSec, deltaSessions, deltaAns, deltaOk, now, st.id).run();

    return json({ ok: true, syncedAt: now });
  }

  // ── 教師後台登入 ──
  if (m === "POST" && p === "/api/admin/login") {
    const secret = env.ADMIN_PASSWORD || "";
    if (!secret) return err("尚未設定 ADMIN_PASSWORD，請先於 Cloudflare Secret 或 .dev.vars 設定教師密碼。", 503);
    const body = await readBody(req);
    if (!body || !safeEq(String(body.password ?? ""), secret)) return err("密碼錯誤", 401);
    const token = await makeAdminToken(secret);
    return json({ ok: true, token });
  }

  // ── 以下全部需要教師權限 ──
  if (p.startsWith("/api/admin/")) {
    if (!(await verifyAdmin(req, env))) return err("需要教師登入", 401);

    // 班級列表／新增／刪除
    if (m === "GET" && p === "/api/admin/classes") {
      const { results } = await db.prepare(
        `SELECT c.*, COUNT(s.id) AS student_count
         FROM classes c LEFT JOIN students s ON s.class_id = c.id
         GROUP BY c.id ORDER BY c.code ASC`
      ).all();
      return json({ ok: true, classes: results });
    }

    if (m === "POST" && p === "/api/admin/classes") {
      const body = await readBody(req);
      const code = cleanPart(body?.code);
      const name = String(body?.name ?? "").trim() || code;
      if (!code) return err("請輸入班級代碼（例如 402）");
      try {
        const res = await db.prepare(`INSERT INTO classes (code, name) VALUES (?, ?)`).bind(code, name).run();
        return json({ ok: true, id: res.meta?.last_row_id, code, name });
      } catch (e) {
        if (String(e?.message ?? e).includes("UNIQUE")) return err(`班級代碼「${code}」已存在`, 409);
        throw e;
      }
    }

    // 全班重發 4 碼代碼（舊代碼失效）
    const clsRegen = p.match(/^\/api\/admin\/classes\/(\d+)\/regen-codes$/);
    if (m === "POST" && clsRegen) {
      const { results } = await db.prepare(`SELECT id FROM students WHERE class_id = ?`).bind(Number(clsRegen[1])).all();
      let n = 0;
      for (const r of results) {
        for (let tries = 0; tries < 20; tries++) {
          const { loginCode, loginKey } = buildLoginCode();
          try {
            await db.prepare(`UPDATE students SET login_code = ?, login_key = ?, token = ? WHERE id = ?`).bind(loginCode, loginKey, randToken(), r.id).run();
            n++; break;
          } catch (e) { if (!String(e?.message ?? e).includes("UNIQUE")) throw e; }
        }
      }
      return json({ ok: true, count: n });
    }

    const clsDel = p.match(/^\/api\/admin\/classes\/(\d+)$/);
    if (m === "DELETE" && clsDel) {
      await db.prepare(`DELETE FROM classes WHERE id = ?`).bind(Number(clsDel[1])).run();
      return json({ ok: true });
    }

    // 批量／單筆新增學生
    if (m === "POST" && p === "/api/admin/students/bulk") {
      const body = await readBody(req);
      const classId = Number(body?.classId);
      const cls = await db.prepare(`SELECT * FROM classes WHERE id = ?`).bind(classId).first();
      if (!cls) return err("找不到指定的班級", 404);
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      if (!rows.length) return err("名單是空的");
      const created = [];
      for (const r of rows.slice(0, 200)) {
        const name = String(r?.name ?? "").trim();
        if (!name) continue;
        created.push(await createUniqueStudent(db, cls.id, cls.code, r.group ?? r.groupName ?? "", r.seat ?? r.seatNo ?? "", name));
      }
      return json({ ok: true, created });
    }

    // 單一學生動作：重設進度、重發代碼、刪除、查詢詳情
    const stAct = p.match(/^\/api\/admin\/students\/(\d+)\/(reset|regen-code)$/);
    if (m === "POST" && stAct) {
      const id = Number(stAct[1]), act = stAct[2];
      const st = await db.prepare(
        `SELECT s.*, c.code AS class_code FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?`
      ).bind(id).first();
      if (!st) return err("找不到學生", 404);
      if (act === "reset") {
        await db.prepare(`DELETE FROM sessions WHERE student_id = ?`).bind(id).run();
        await db.prepare(`DELETE FROM mistakes WHERE student_id = ?`).bind(id).run();
        await db.prepare(
          `UPDATE students SET save_json = NULL, lv = 1, progress_pct = 0, review_count = 0,
           total_play_sec = 0, session_count = 0, total_answered = 0, total_correct = 0, last_seen_at = NULL
           WHERE id = ?`
        ).bind(id).run();
        return json({ ok: true });
      }
      for (let tries = 0; tries < 20; tries++) {
        const { loginCode, loginKey } = buildLoginCode(st.class_code, st.group_name, st.seat_no);
        const token = randToken();
        try {
          await db.prepare(`UPDATE students SET login_code = ?, login_key = ?, token = ? WHERE id = ?`).bind(loginCode, loginKey, token, id).run();
          return json({ ok: true, loginCode });
        } catch (e) {
          if (!String(e?.message ?? e).includes("UNIQUE")) throw e;
        }
      }
      return err("重發代碼失敗", 500);
    }

    const stOne = p.match(/^\/api\/admin\/students\/(\d+)$/);
    if (stOne) {
      const id = Number(stOne[1]);
      if (m === "DELETE") {
        await db.prepare(`DELETE FROM students WHERE id = ?`).bind(id).run();
        return json({ ok: true });
      }
      if (m === "GET") {
        const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
        const row = await db.prepare(
          `SELECT s.*, c.code AS class_code, c.name AS class_name,
                  COALESCE((SELECT SUM(active_sec) FROM sessions WHERE student_id = s.id AND started_at >= ?), 0) AS week_play_sec
           FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?`
        ).bind(weekAgo, id).first();
        if (!row) return err("找不到學生", 404);
        const { results: sessions } = await db.prepare(
          `SELECT id, started_at, ended_at, active_sec, answered, correct
           FROM sessions WHERE student_id = ? ORDER BY started_at DESC LIMIT 40`
        ).bind(id).all();
        const { results: mistakes } = await db.prepare(
          `SELECT id, branch, grade, type_key, question_text, student_answer, correct_answer, mode, resolved, created_at, resolved_at
           FROM mistakes WHERE student_id = ? ORDER BY created_at DESC LIMIT 200`
        ).bind(id).all();
        let save = null;
        if (row.save_json) { try { save = JSON.parse(row.save_json); } catch {} }
        return json({ ok: true, student: formatStudentRow(row), save, sessions, mistakes });
      }
    }

    // 全班總覽
    if (m === "GET" && p === "/api/admin/overview") {
      const classId = url.searchParams.get("classId");
      const group = cleanPart(url.searchParams.get("group"));
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

      let sql = `
        SELECT s.*, c.code AS class_code, c.name AS class_name,
               COALESCE((SELECT SUM(active_sec) FROM sessions WHERE student_id = s.id AND started_at >= ?), 0) AS week_play_sec
        FROM students s JOIN classes c ON c.id = s.class_id WHERE 1=1`;
      const binds = [weekAgo];
      if (classId && /^\d+$/.test(classId)) { sql += ` AND s.class_id = ?`; binds.push(Number(classId)); }
      if (group) { sql += ` AND s.group_name = ?`; binds.push(group); }
      sql += ` ORDER BY c.code ASC, s.group_name ASC, s.seat_no ASC, s.name ASC`;

      const { results } = await db.prepare(sql).bind(...binds).all();
      let students = results.map(formatStudentRow);
      if (q) students = students.filter((s) => `${s.name} ${s.seatNo} ${s.groupName} ${s.loginCode} ${s.className}`.toLowerCase().includes(q));
      return json({ ok: true, students });
    }

    // 全班弱點分析
    if (m === "GET" && p === "/api/admin/analytics") {
      const classId = url.searchParams.get("classId");
      const hasClass = classId && /^\d+$/.test(classId);
      const join = hasClass ? `JOIN students s ON s.id = m.student_id WHERE s.class_id = ?` : `WHERE 1=1`;
      const binds = hasClass ? [Number(classId)] : [];

      const { results: byBranch } = await db.prepare(
        `SELECT m.branch, COUNT(*) AS total_mistakes,
                SUM(CASE WHEN m.resolved = 0 THEN 1 ELSE 0 END) AS unresolved_mistakes,
                COUNT(DISTINCT m.student_id) AS student_count
         FROM mistakes m ${join}
         GROUP BY m.branch ORDER BY total_mistakes DESC`
      ).bind(...binds).all();

      const { results: topQuestions } = await db.prepare(
        `SELECT m.branch, m.type_key, m.question_text, m.correct_answer,
                COUNT(*) AS miss_count, COUNT(DISTINCT m.student_id) AS student_count
         FROM mistakes m ${join}
         GROUP BY m.branch, m.type_key, m.question_text
         ORDER BY miss_count DESC LIMIT 20`
      ).bind(...binds).all();

      const since14 = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10);
      const sJoin = hasClass ? `JOIN students s ON s.id = se.student_id WHERE s.class_id = ? AND substr(se.started_at, 1, 10) >= ?` : `WHERE substr(se.started_at, 1, 10) >= ?`;
      const sBinds = hasClass ? [Number(classId), since14] : [since14];
      const { results: daily } = await db.prepare(
        `SELECT substr(se.started_at, 1, 10) AS day,
                COUNT(DISTINCT se.student_id) AS active_students,
                SUM(se.active_sec) AS active_sec,
                SUM(se.answered) AS answered,
                SUM(se.correct) AS correct
         FROM sessions se ${sJoin}
         GROUP BY day ORDER BY day ASC`
      ).bind(...sBinds).all();

      return json({ ok: true, byBranch, topQuestions, daily });
    }

    // 匯出 CSV（Excel UTF-8 BOM）
    if (m === "GET" && p === "/api/admin/export") {
      const type = url.searchParams.get("type") || "overview";
      const classId = url.searchParams.get("classId");
      const hasClass = classId && /^\d+$/.test(classId);
      const today = new Date().toISOString().slice(0, 10);

      if (type === "mistakes") {
        const sql = `
          SELECT c.name AS class_name, s.group_name, s.seat_no, s.name, s.login_code,
                 m.created_at, m.branch, m.question_text, m.student_answer, m.correct_answer, m.resolved
          FROM mistakes m
          JOIN students s ON s.id = m.student_id
          JOIN classes c ON c.id = s.class_id
          ${hasClass ? "WHERE s.class_id = ?" : ""}
          ORDER BY m.created_at DESC LIMIT 5000`;
        const { results } = await (hasClass ? db.prepare(sql).bind(Number(classId)) : db.prepare(sql)).all();
        return csvResponse(
          `魔數學院-錯題明細-${today}.csv`,
          ["班級", "組別", "座號", "姓名", "登入碼", "時間", "單元", "題目", "學生作答", "正確答案", "狀態"],
          results.map((r) => [
            r.class_name, r.group_name, r.seat_no, r.name, xlText(r.login_code),
            r.created_at, UNIT_NAME[r.branch] ?? r.branch, r.question_text,
            r.student_answer, r.correct_answer, r.resolved ? "已畢業" : "未畢業",
          ])
        );
      }

      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const sql = `
        SELECT c.name AS class_name, s.group_name, s.seat_no, s.name, s.login_code,
               s.lv, s.progress_pct, s.review_count, s.session_count, s.total_play_sec,
               COALESCE((SELECT SUM(active_sec) FROM sessions WHERE student_id = s.id AND started_at >= ?), 0) AS week_play_sec,
               s.total_answered, s.total_correct, s.last_seen_at
        FROM students s JOIN classes c ON c.id = s.class_id
        ${hasClass ? "WHERE s.class_id = ?" : ""}
        ORDER BY c.code ASC, s.group_name ASC, s.seat_no ASC`;
      const { results } = await (hasClass ? db.prepare(sql).bind(weekAgo, Number(classId)) : db.prepare(sql).bind(weekAgo)).all();
      return csvResponse(
        `魔數學院-全班學習總表-${today}.csv`,
        ["班級", "組別", "座號", "姓名", "登入碼", "等級", "課程進度(%)", "未畢業錯題數", "遊玩次數", "本週時長(分)", "累積時長(分)", "總答題數", "正確率(%)", "最後上線"],
        results.map((r) => [
          r.class_name, r.group_name, r.seat_no, r.name, xlText(r.login_code),
          r.lv, r.progress_pct, r.review_count, r.session_count,
          Math.round((r.week_play_sec || 0) / 60 * 10) / 10,
          Math.round((r.total_play_sec || 0) / 60 * 10) / 10,
          r.total_answered,
          r.total_answered ? Math.round((r.total_correct / r.total_answered) * 100) : 0,
          r.last_seen_at ?? "",
        ])
      );
    }

    return err("找不到 API", 404);
  }

  return err("找不到 API", 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(req, env); }
      catch (e) { console.error(e); return err("伺服器錯誤：" + (e?.message ?? e), 500); }
    }
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(new URL(`/math/${url.search}`, url), 302);
    }
    if (url.pathname === "/admin") {
      return Response.redirect(new URL(`/admin/${url.search}`, url), 302);
    }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response("Not Found", { status: 404 });
  },
};
