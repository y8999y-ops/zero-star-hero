// 《魔數學院》教師管理後台（/admin）
// 功能：全班學習總覽、單一學生錯題本與遊玩時長明細、全班弱點排行、班級與批量建帳、QR 登入小卡列印、CSV 匯出。

import { qrSvg } from "./qr.js";

const UNIT_NAME = {
  big: "大數與加減", mul: "乘法", div: "除法", mix: "四則併式", frac: "分數",
  dec: "小數", shape: "面積、周長與角度", measure: "時間與單位換算", round: "概數與估算", seq: "數量規律",
};
const ALL_BRANCHES = Object.keys(UNIT_NAME);
const TOKEN_KEY = "mosu-admin-token-v1";

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || "",
  tab: "overview",        // overview | analytics | manage
  classes: [],
  students: [],
  analytics: null,
  classId: "",
  group: "",
  q: "",
  sortBy: "seat",
  sortDir: 1,
  detail: null,           // { student, save, sessions, mistakes, filter: 'all'|'open'|'resolved' }
  printCards: null,
};

const root = document.querySelector("#root");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtDur(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60), h = Math.floor(m / 60), rm = m % 60;
  return h ? `${h} 時 ${rm} 分` : `${m} 分`;
}

function fmtTime(iso) {
  if (!iso) return "尚未上線";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function gameLoginUrl(code) {
  return `${location.origin}/math/?code=${encodeURIComponent(code)}`;
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  if (opts.body && typeof opts.body === "object") {
    headers["content-type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, { ...opts, headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/admin/login") {
    state.token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    render();
    throw new Error("登入已過期，請重新登入");
  }
  if (!res.ok || data.ok === false) throw new Error(data.error || `請求失敗 (${res.status})`);
  return data;
}

async function loadAll() {
  const qs = new URLSearchParams();
  if (state.classId) qs.set("classId", state.classId);
  if (state.group) qs.set("group", state.group);
  if (state.q) qs.set("q", state.q);
  const [cRes, oRes, aRes] = await Promise.all([
    api("/api/admin/classes"),
    api(`/api/admin/overview?${qs}`),
    api(`/api/admin/analytics${state.classId ? `?classId=${state.classId}` : ""}`),
  ]);
  state.classes = cRes.classes ?? [];
  state.students = oRes.students ?? [];
  state.analytics = aRes;
  render();
}

async function openStudent(id) {
  const data = await api(`/api/admin/students/${id}`);
  state.detail = { ...data, filter: "all" };
  render();
}

function downloadCsv(type) {
  const qs = new URLSearchParams({ type, token: state.token });
  if (state.classId) qs.set("classId", state.classId);
  window.open(`/api/admin/export?${qs}`, "_blank");
}

function parseBulkLines(raw) {
  // 支援：「組別,座號,姓名」「座號,姓名」「姓名」，逗號／Tab／空白皆可
  const out = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || /^#/.test(t)) continue;
    const cols = t.split(/[\t,，]+/).map((x) => x.trim()).filter(Boolean);
    if (cols.length >= 3) out.push({ group: cols[0], seat: cols[1], name: cols.slice(2).join(" ") });
    else if (cols.length === 2) out.push({ group: "", seat: cols[0], name: cols[1] });
    else if (cols.length === 1) {
      const sp = cols[0].split(/\s+/);
      if (sp.length >= 3) out.push({ group: sp[0], seat: sp[1], name: sp.slice(2).join(" ") });
      else if (sp.length === 2) out.push({ group: "", seat: sp[0], name: sp[1] });
      else out.push({ group: "", seat: "", name: sp[0] });
    }
  }
  return out;
}

function sortedStudents() {
  const arr = [...state.students];
  const d = state.sortDir;
  const cmp = {
    seat: (a, b) => `${a.classCode}-${a.groupName}-${a.seatNo}`.localeCompare(`${b.classCode}-${b.groupName}-${b.seatNo}`, "zh-Hant"),
    name: (a, b) => a.name.localeCompare(b.name, "zh-Hant"),
    lastSeen: (a, b) => (a.lastSeenAt || "").localeCompare(b.lastSeenAt || ""),
    sessions: (a, b) => a.sessionCount - b.sessionCount,
    week: (a, b) => a.weekPlaySec - b.weekPlaySec,
    total: (a, b) => a.totalPlaySec - b.totalPlaySec,
    progress: (a, b) => a.progressPct - b.progressPct,
    review: (a, b) => a.reviewCount - b.reviewCount,
  }[state.sortBy];
  if (cmp) arr.sort((a, b) => cmp(a, b) * d);
  return arr;
}

function renderLogin() {
  root.innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="loginForm">
        <h1>魔數學院｜教師後台</h1>
        <p>輸入教師密碼查看學生錯題本、遊玩時間與班級進度。</p>
        <input id="pw" type="password" placeholder="請輸入教師密碼" autocomplete="current-password" required>
        <div class="err" id="loginErr"></div>
        <button class="btn primary" type="submit">登入後台</button>
      </form>
    </div>`;
  const form = root.querySelector("#loginForm"), pw = root.querySelector("#pw"), errEl = root.querySelector("#loginErr");
  pw.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    try {
      const res = await api("/api/admin/login", { method: "POST", body: { password: pw.value } });
      state.token = res.token;
      sessionStorage.setItem(TOKEN_KEY, res.token);
      await loadAll();
    } catch (ex) { errEl.textContent = ex.message; }
  };
}

function renderOverview() {
  const list = sortedStudents();
  const totalStudents = list.length;
  const activeWeek = list.filter((s) => s.weekPlaySec > 0).length;
  const totalSec = list.reduce((a, s) => a + s.totalPlaySec, 0);
  const totalAns = list.reduce((a, s) => a + s.totalAnswered, 0);
  const totalOk = list.reduce((a, s) => a + s.totalCorrect, 0);
  const totalReview = list.reduce((a, s) => a + s.reviewCount, 0);
  const acc = totalAns ? Math.round((totalOk / totalAns) * 100) : 0;

  const th = (key, label) => `<th class="sort" data-sort="${key}">${label}${state.sortBy === key ? (state.sortDir > 0 ? " ▲" : " ▼") : ""}</th>`;

  return `
    <div class="kpis">
      <div class="kpi"><div class="k">學生人數</div><div class="v">${totalStudents}</div><div class="s">近 7 天活躍 ${activeWeek} 人</div></div>
      <div class="kpi"><div class="k">累積遊玩時長</div><div class="v">${fmtDur(totalSec)}</div><div class="s">總遊玩 ${list.reduce((a, s) => a + s.sessionCount, 0)} 次</div></div>
      <div class="kpi"><div class="k">累積答題數</div><div class="v">${totalAns}</div><div class="s">平均正確率 ${acc}%</div></div>
      <div class="kpi"><div class="k">目前未畢業錯題</div><div class="v">${totalReview}</div><div class="s">點擊任一學生看明細</div></div>
    </div>
    <div class="card">
      <div class="table-wrap">
        ${list.length ? `<table>
          <thead><tr>
            ${th("seat", "班級／組別／座號")}
            ${th("name", "姓名")}
            <th>登入碼</th>
            ${th("lastSeen", "最後上線")}
            ${th("sessions", "遊玩次數")}
            ${th("week", "本週時長")}
            ${th("total", "累積時長")}
            ${th("progress", "課程進度")}
            ${th("review", "未畢業錯題")}
            <th>操作</th>
          </tr></thead>
          <tbody>
            ${list.map((s) => `
              <tr>
                <td>${esc(s.className)}${s.groupName ? `・${esc(s.groupName)}組` : ""}${s.seatNo ? `・${esc(s.seatNo)}號` : ""}</td>
                <td><b>${esc(s.name)}</b></td>
                <td><button class="code" data-copy="${esc(s.loginCode)}" title="點一下複製專屬登入連結">${esc(s.loginCode)}</button></td>
                <td>${esc(fmtTime(s.lastSeenAt))}</td>
                <td>${s.sessionCount} 次</td>
                <td>${fmtDur(s.weekPlaySec)}</td>
                <td>${fmtDur(s.totalPlaySec)}</td>
                <td><div class="bar-wrap"><div class="bar"><i style="width:${s.progressPct}%"></i></div><span>${s.progressPct}%</span></div></td>
                <td>${s.reviewCount ? `<span class="badge red">${s.reviewCount} 題</span>` : `<span class="badge green">0 題</span>`}</td>
                <td><button class="btn sm primary" data-open="${s.id}">查看詳情</button></td>
              </tr>`).join("")}
          </tbody>
        </table>` : `<div class="empty">目前沒有學生資料，請先到「班級與學生管理」建立班級並匯入學生名單。</div>`}
      </div>
    </div>`;
}

function renderAnalytics() {
  const a = state.analytics;
  if (!a) return `<div class="card empty">載入中…</div>`;
  const byB = a.byBranch ?? [];
  const maxMiss = Math.max(1, ...byB.map((x) => x.total_mistakes));
  const topQ = a.topQuestions ?? [];
  const days = a.daily ?? [];

  return `
    <div class="grid2">
      <div class="card">
        <h2>各單元錯題排行（全班弱點）</h2>
        ${byB.length ? byB.map((b) => `
          <div class="rank-row">
            <b>${esc(UNIT_NAME[b.branch] || b.branch || "未分類")}</b>
            <div class="bar warn"><i style="width:${Math.round((b.total_mistakes / maxMiss) * 100)}%"></i></div>
            <span style="text-align:right;font-size:12px;"><b>${b.total_mistakes}</b> 次 / ${b.student_count} 人</span>
          </div>`).join("") : `<div class="empty">目前還沒有錯題紀錄。</div>`}
      </div>
      <div class="card">
        <h2>近 14 天每日活躍統計</h2>
        ${days.length ? `<div class="table-wrap"><table>
          <thead><tr><th>日期</th><th>活躍人數</th><th>總遊玩時長</th><th>答題數</th><th>正確率</th></tr></thead>
          <tbody>
            ${days.slice().reverse().map((d) => `<tr>
              <td>${esc(d.day)}</td>
              <td>${d.active_students} 人</td>
              <td>${fmtDur(d.active_sec)}</td>
              <td>${d.answered} 題</td>
              <td>${d.answered ? Math.round((d.correct / d.answered) * 100) : 0}%</td>
            </tr>`).join("")}
          </tbody>
        </table></div>` : `<div class="empty">最近 14 天尚無上線紀錄。</div>`}
      </div>
    </div>
    <div class="card">
      <h2>最常答錯題目 TOP 20</h2>
      ${topQ.length ? `<div class="table-wrap"><table>
        <thead><tr><th>單元</th><th>題目</th><th>正確答案</th><th>錯題次數</th><th>人數</th></tr></thead>
        <tbody>
          ${topQ.map((q) => `<tr>
            <td><span class="badge gray">${esc(UNIT_NAME[q.branch] || q.branch || "—")}</span></td>
            <td class="wrap">${esc(q.question_text)}</td>
            <td class="ans-ok">${esc(q.correct_answer)}</td>
            <td><span class="badge red">${q.miss_count} 次</span></td>
            <td>${q.student_count} 人</td>
          </tr>`).join("")}
        </tbody>
      </table></div>` : `<div class="empty">尚無錯題統計。</div>`}
    </div>`;
}

function renderManage() {
  return `
    <div class="grid2">
      <div class="card">
        <h2>班級管理</h2>
        <form class="form-row" id="addClassForm">
          <div class="field"><label>班級代碼</label><input id="clsCode" placeholder="例如 402" required style="width:120px"></div>
          <div class="field" style="flex:1"><label>班級名稱</label><input id="clsName" placeholder="例如 四年二班" required style="width:100%"></div>
          <button class="btn primary" type="submit">新增班級</button>
        </form>
        <div class="table-wrap">
          ${state.classes.length ? `<table>
            <thead><tr><th>代碼</th><th>班級名稱</th><th>學生數</th><th>操作</th></tr></thead>
            <tbody>
              ${state.classes.map((c) => `<tr>
                <td><span class="code">${esc(c.code)}</span></td>
                <td><b>${esc(c.name)}</b></td>
                <td>${c.student_count} 人</td>
                <td><button class="btn sm danger" data-del-class="${c.id}" data-cname="${esc(c.name)}">刪除</button></td>
              </tr>`).join("")}
            </tbody>
          </table>` : `<div class="empty">尚未建立班級。</div>`}
        </div>
      </div>

      <div class="card">
        <h2>批量新增學生（自動產生 班級-組別-座號-2碼）</h2>
        <form id="bulkForm">
          <div class="form-row">
            <div class="field" style="flex:1">
              <label>匯入到哪個班級</label>
              <select id="bulkClass" required>
                ${state.classes.map((c) => `<option value="${c.id}" ${String(c.id) === String(state.classId) ? "selected" : ""}>${esc(c.code)} ${esc(c.name)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="help">每行一位學生，可直接從 Excel 複製貼上。支援格式：<code>組別,座號,姓名</code>（例如 <code>1,07,王小明</code>）或 <code>座號,姓名</code>（例如 <code>07,王小明</code>）。</div>
          <textarea class="bulk-area" id="bulkText" placeholder="1,01,王小明&#10;1,02,陳小美&#10;2,03,林大華"></textarea>
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
            <button class="btn primary" type="submit" ${state.classes.length ? "" : "disabled"}>批量建立並產生代碼</button>
            <span class="err" id="bulkMsg"></span>
          </div>
        </form>
      </div>
    </div>`;
}

function renderDetailDrawer() {
  const d = state.detail;
  if (!d) return "";
  const st = d.student;
  const save = d.save ?? {};
  const reviewEntries = Object.entries(save.review ?? {});
  const mistakes = (d.mistakes ?? []).filter((m) => d.filter === "all" ? true : d.filter === "open" ? !m.resolved : !!m.resolved);
  const acc = st.totalAnswered ? Math.round((st.totalCorrect / st.totalAnswered) * 100) : 0;

  return `
    <div class="drawer-back" id="drawerBack">
      <div class="drawer">
        <div class="drawer-head">
          <div>
            <div class="drawer-title">${esc(st.name)} <span class="code">${esc(st.loginCode)}</span></div>
            <div style="font-size:12px;color:var(--dim);margin-top:2px;">
              ${esc(st.className)}${st.groupName ? `・${esc(st.groupName)}組` : ""}${st.seatNo ? `・${esc(st.seatNo)}號` : ""}
              ｜Lv.${st.lv}｜課程進度 ${st.progressPct}%｜遊玩 ${st.sessionCount} 次（累積 ${fmtDur(st.totalPlaySec)}／本週 ${fmtDur(st.weekPlaySec)}）｜正確率 ${acc}%
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn sm" data-copy="${esc(st.loginCode)}">複製連結</button>
            <button class="btn sm" id="btnRegen" data-id="${st.id}">重發代碼</button>
            <button class="btn sm danger" id="btnReset" data-id="${st.id}">重設進度</button>
            <button class="btn sm danger" id="btnDelSt" data-id="${st.id}">刪除</button>
            <button class="btn sm primary" id="btnCloseDrawer">關閉</button>
          </div>
        </div>

        <div class="card">
          <h3>目前遊戲內錯題本（未畢業 ${reviewEntries.length} 題）</h3>
          ${reviewEntries.length ? `<div class="table-wrap"><table>
            <thead><tr><th>單元</th><th>目前例題</th><th>剩餘連對</th></tr></thead>
            <tbody>
              ${reviewEntries.map(([, v]) => `<tr>
                <td><span class="badge gray">${esc(UNIT_NAME[v.branch] || v.branch || "—")}</span></td>
                <td class="wrap">${esc(v.sample)}</td>
                <td><span class="badge red">還需 ${v.left} 次</span></td>
              </tr>`).join("")}
            </tbody>
          </table></div>` : `<div class="empty">目前錯題本是空的！</div>`}
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <h3 style="margin:0;">完整歷史錯題紀錄（共 ${(d.mistakes ?? []).length} 筆）</h3>
            <div class="sub-tabs">
              <button class="btn sm ${d.filter === "all" ? "primary" : ""}" data-mfilter="all">全部</button>
              <button class="btn sm ${d.filter === "open" ? "primary" : ""}" data-mfilter="open">未畢業</button>
              <button class="btn sm ${d.filter === "resolved" ? "primary" : ""}" data-mfilter="resolved">已畢業</button>
            </div>
          </div>
          ${mistakes.length ? `<div class="table-wrap"><table>
            <thead><tr><th>時間</th><th>單元</th><th>題目</th><th>學生作答</th><th>正確答案</th><th>狀態</th></tr></thead>
            <tbody>
              ${mistakes.map((m) => `<tr>
                <td>${esc(fmtTime(m.created_at))}</td>
                <td><span class="badge gray">${esc(UNIT_NAME[m.branch] || m.branch || "—")}</span></td>
                <td class="wrap">${esc(m.question_text)}</td>
                <td class="ans-bad">${esc(m.student_answer || "—")}</td>
                <td class="ans-ok">${esc(m.correct_answer)}</td>
                <td>${m.resolved ? `<span class="badge green">已畢業</span>` : `<span class="badge red">未畢業</span>`}</td>
              </tr>`).join("")}
            </tbody>
          </table></div>` : `<div class="empty">這個分類下沒有錯題紀錄。</div>`}
        </div>

        <div class="card">
          <h3>十個單元進度與熟練度</h3>
          <div class="unit-grid">
            ${ALL_BRANCHES.map((b) => {
              const e = Math.min(3, Number(save.practice?.[`${b}-0`]) || 0);
              const h = Math.min(3, Number(save.practice?.[`${b}-1`]) || 0);
              const best = Number(save.branches?.[b]?.best) || 0;
              return `<div class="unit-item">
                <b>${esc(UNIT_NAME[b])}</b>
                <div class="u-meta"><span>簡單 <span class="stars">${"★".repeat(e)}${"☆".repeat(3 - e)}</span></span><span>困難 <span class="stars">${"★".repeat(h)}${"☆".repeat(3 - h)}</span></span></div>
                <div class="u-meta"><span>熟練度</span><span class="stars">${best ? "★".repeat(best) + "☆".repeat(5 - best) : "尚未練習"}</span></div>
              </div>`;
            }).join("")}
          </div>
        </div>

        <div class="card">
          <h3>近期遊玩場次與時長（最近 ${(d.sessions ?? []).length} 次）</h3>
          ${(d.sessions ?? []).length ? `<div class="table-wrap"><table>
            <thead><tr><th>開始時間</th><th>結束時間</th><th>活躍時長</th><th>作答／答對</th><th>正確率</th></tr></thead>
            <tbody>
              ${d.sessions.map((se) => `<tr>
                <td>${esc(fmtTime(se.started_at))}</td>
                <td>${esc(fmtTime(se.ended_at))}</td>
                <td><b>${fmtDur(se.active_sec)}</b></td>
                <td>${se.correct} / ${se.answered}</td>
                <td>${se.answered ? Math.round((se.correct / se.answered) * 100) : 0}%</td>
              </tr>`).join("")}
            </tbody>
          </table></div>` : `<div class="empty">尚無遊玩場次紀錄。</div>`}
        </div>
      </div>
    </div>`;
}

function renderPrintModal() {
  if (!state.printCards) return "";
  return `
    <div class="print-modal">
      <div class="print-bar">
        <b>魔數學院｜學生 QR 登入小卡（共 ${state.printCards.length} 張）</b>
        <div style="display:flex;gap:8px;">
          <button class="btn primary" id="doPrint">列印 / 另存 PDF</button>
          <button class="btn" id="closePrint">關閉</button>
        </div>
      </div>
      <div class="qr-grid">
        ${state.printCards.map((s) => `
          <div class="qr-card">
            <div>${qrSvg(gameLoginUrl(s.loginCode), 96)}</div>
            <div class="qr-info">
              <div class="qr-school">魔數學院 專屬登入卡</div>
              <div class="qr-name">${esc(s.name)}</div>
              <div class="qr-meta">${esc(s.className)}${s.groupName ? `・${esc(s.groupName)}組` : ""}${s.seatNo ? `・${esc(s.seatNo)}號` : ""}</div>
              <div class="qr-code">${esc(s.loginCode)}</div>
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}

function render() {
  if (!state.token) { renderLogin(); return; }
  const groups = [...new Set(state.students.map((s) => s.groupName).filter(Boolean))].sort();
  root.innerHTML = `
    <div class="topbar">
      <div class="brand">魔數學院 <span>教師管理後台</span></div>
      <div class="top-actions">
        <a class="btn ghost" href="/math/" target="_blank" style="text-decoration:none;">開啟遊戲</a>
        <button class="btn ghost" id="btnPrintCards">列印登入小卡</button>
        <button class="btn ghost" id="btnExpOverview">匯出總表 CSV</button>
        <button class="btn ghost" id="btnExpMistakes">匯出錯題 CSV</button>
        <button class="btn ghost" id="btnLogout">登出</button>
      </div>
    </div>
    <div class="main">
      <div class="tabs">
        <button class="tab ${state.tab === "overview" ? "on" : ""}" data-tab="overview">全班學習總覽</button>
        <button class="tab ${state.tab === "analytics" ? "on" : ""}" data-tab="analytics">全班弱點分析</button>
        <button class="tab ${state.tab === "manage" ? "on" : ""}" data-tab="manage">班級與學生管理</button>
      </div>
      ${state.tab !== "manage" ? `
        <div class="filters">
          <select id="fClass">
            <option value="">全部班級</option>
            ${state.classes.map((c) => `<option value="${c.id}" ${String(c.id) === String(state.classId) ? "selected" : ""}>${esc(c.code)} ${esc(c.name)} (${c.student_count})</option>`).join("")}
          </select>
          ${state.tab === "overview" ? `
            <select id="fGroup">
              <option value="">全部組別</option>
              ${groups.map((g) => `<option value="${esc(g)}" ${g === state.group ? "selected" : ""}>${esc(g)}組</option>`).join("")}
            </select>
            <input id="fSearch" type="search" value="${esc(state.q)}" placeholder="搜尋姓名、座號或登入碼…">` : ""}
          <button class="btn" id="btnRefresh">重新整理</button>
        </div>` : ""}
      ${state.tab === "overview" ? renderOverview() : state.tab === "analytics" ? renderAnalytics() : renderManage()}
    </div>
    ${renderDetailDrawer()}
    ${renderPrintModal()}`;

  // ── 綁定事件 ──
  root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; render(); }));
  root.querySelector("#btnLogout").onclick = () => { state.token = ""; sessionStorage.removeItem(TOKEN_KEY); render(); };
  root.querySelector("#btnExpOverview").onclick = () => downloadCsv("overview");
  root.querySelector("#btnExpMistakes").onclick = () => downloadCsv("mistakes");
  root.querySelector("#btnPrintCards").onclick = () => {
    if (!state.students.length) { alert("目前清單沒有學生可列印。"); return; }
    state.printCards = sortedStudents();
    render();
  };

  const fClass = root.querySelector("#fClass");
  if (fClass) fClass.onchange = () => { state.classId = fClass.value; state.group = ""; loadAll(); };
  const fGroup = root.querySelector("#fGroup");
  if (fGroup) fGroup.onchange = () => { state.group = fGroup.value; loadAll(); };
  const fSearch = root.querySelector("#fSearch");
  if (fSearch) fSearch.oninput = () => { state.q = fSearch.value; clearTimeout(window.__st); window.__st = setTimeout(loadAll, 250); };
  const btnRefresh = root.querySelector("#btnRefresh");
  if (btnRefresh) btnRefresh.onclick = () => loadAll();

  root.querySelectorAll("th[data-sort]").forEach((th) => (th.onclick = () => {
    const k = th.dataset.sort;
    state.sortDir = state.sortBy === k ? -state.sortDir : (k === "seat" || k === "name" ? 1 : -1);
    state.sortBy = k;
    render();
  }));
  root.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openStudent(b.dataset.open)));
  root.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => {
    const url = gameLoginUrl(b.dataset.copy);
    try { await navigator.clipboard.writeText(url); const old = b.textContent; b.textContent = "已複製連結！"; setTimeout(() => (b.textContent = old), 1200); }
    catch { prompt("複製專屬登入連結：", url); }
  }));

  // 班級管理事件
  const addClassForm = root.querySelector("#addClassForm");
  if (addClassForm) addClassForm.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/classes", { method: "POST", body: { code: root.querySelector("#clsCode").value, name: root.querySelector("#clsName").value } });
      await loadAll();
    } catch (ex) { alert(ex.message); }
  };
  root.querySelectorAll("[data-del-class]").forEach((b) => (b.onclick = async () => {
    if (!confirm(`確定刪除班級「${b.dataset.cname}」？該班所有學生與紀錄會一併刪除。`)) return;
    await api(`/api/admin/classes/${b.dataset.delClass}`, { method: "DELETE" });
    if (String(state.classId) === b.dataset.delClass) state.classId = "";
    await loadAll();
  }));

  const bulkForm = root.querySelector("#bulkForm");
  if (bulkForm) bulkForm.onsubmit = async (e) => {
    e.preventDefault();
    const rows = parseBulkLines(root.querySelector("#bulkText").value);
    const msg = root.querySelector("#bulkMsg");
    if (!rows.length) { msg.textContent = "請先貼上至少一位學生。"; return; }
    try {
      const res = await api("/api/admin/students/bulk", { method: "POST", body: { classId: Number(root.querySelector("#bulkClass").value), rows } });
      await loadAll();
      alert(`已成功建立 ${res.created.length} 位學生！可以點上方「列印登入小卡」發給學生。`);
    } catch (ex) { msg.textContent = ex.message; }
  };

  // 詳情抽屜事件
  const drawerBack = root.querySelector("#drawerBack");
  if (drawerBack) drawerBack.onclick = (e) => { if (e.target === drawerBack) { state.detail = null; render(); } };
  const closeDrawer = root.querySelector("#btnCloseDrawer");
  if (closeDrawer) closeDrawer.onclick = () => { state.detail = null; render(); };
  root.querySelectorAll("[data-mfilter]").forEach((b) => (b.onclick = () => { state.detail.filter = b.dataset.mfilter; render(); }));
  const btnRegen = root.querySelector("#btnRegen");
  if (btnRegen) btnRegen.onclick = async () => {
    if (!confirm("確定重新產生登入碼？舊代碼與舊裝置登入狀態會失效。")) return;
    await api(`/api/admin/students/${btnRegen.dataset.id}/regen-code`, { method: "POST" });
    await Promise.all([loadAll(), openStudent(btnRegen.dataset.id)]);
  };
  const btnReset = root.querySelector("#btnReset");
  if (btnReset) btnReset.onclick = async () => {
    if (!confirm("確定清空這位學生的存檔、錯題本與遊玩紀錄？（登入碼會保留）")) return;
    await api(`/api/admin/students/${btnReset.dataset.id}/reset`, { method: "POST" });
    await Promise.all([loadAll(), openStudent(btnReset.dataset.id)]);
  };
  const btnDelSt = root.querySelector("#btnDelSt");
  if (btnDelSt) btnDelSt.onclick = async () => {
    if (!confirm("確定永久刪除這位學生與所有學習紀錄？")) return;
    await api(`/api/admin/students/${btnDelSt.dataset.id}`, { method: "DELETE" });
    state.detail = null;
    await loadAll();
  };

  // 列印彈窗事件
  const closePrint = root.querySelector("#closePrint");
  if (closePrint) closePrint.onclick = () => { state.printCards = null; render(); };
  const doPrint = root.querySelector("#doPrint");
  if (doPrint) doPrint.onclick = () => window.print();
}

if (state.token) loadAll().catch(() => render());
else render();
