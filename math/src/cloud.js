// 學生代碼登入、雲端存檔同步、活躍遊玩時長與錯題紀錄上報。
// 若目前是純靜態離線環境（沒有 /api/health），會自動安靜退回原本的 localStorage 模式。

import { el } from "./ui.js";
import { sfx } from "./audio.js";
import { freshSave, writeSave } from "./save.js";
import { applySettings } from "./settings.js";
import { applyOutfit } from "./scenes/shop.js";

const AUTH_KEY = "mosu-academy-cloud-v1";
// 2026-11-26 使用者：老師跟學生在同一個頁面登入；老師用密碼登入後可以開後台，也可以試玩（試玩不記錄）
const TEACHER_KEY = "mosu-admin-token-v1";   // 跟 /admin/ 共用同一把鑰匙，登入一次兩邊都能用
const IDLE_MS = 60_000;        // 60 秒沒有操作就暫停計時，避免開著網頁忘記關灌水

let available = false;
let auth = loadAuth();         // { token, student } | null
let session = null;            // { clientSid, startedAt, activeSec, answered, correct }
let pendingMistakes = [];
let pendingResolved = new Set();
let latestSave = null;
let lastActivity = Date.now();
let lastSentSec = 0;
let dirty = false;
let syncTimer = null;
let listeners = new Set();
let initialized = false;

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveAuth(next) {
  auth = next;
  try {
    if (next) localStorage.setItem(AUTH_KEY, JSON.stringify(next));
    else localStorage.removeItem(AUTH_KEY);
  } catch {}
  listeners.forEach((fn) => { try { fn(auth?.student ?? null); } catch {} });
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function startSession() {
  session = {
    clientSid: makeId("s"),
    startedAt: new Date().toISOString(),
    activeSec: 0,
    answered: 0,
    correct: 0,
  };
  lastSentSec = 0;
  lastActivity = Date.now();
}

function hydrateSave(raw) {
  const f = freshSave();
  if (!raw || typeof raw !== "object") return f;
  return {
    ...f,
    ...raw,
    branches: { ...f.branches, ...(raw.branches ?? {}) },
    settings: { ...f.settings, ...(raw.settings ?? {}) },
  };
}

function applyLoadedSave(game, cloudSave) {
  game.save = hydrateSave(cloudSave);
  latestSave = game.save;
  writeSave(game.save, { silent: true });
  applySettings(game.save.settings);
  applyOutfit(game.save);
}

export const isCloudAvailable = () => available;

function teacherToken() {
  let t = "";
  try { t = localStorage.getItem(TEACHER_KEY) || sessionStorage.getItem(TEACHER_KEY) || ""; } catch {}
  const exp = Number(t.split(".")[1]);
  return t && Number.isFinite(exp) && exp > Date.now() ? t : "";
}
export const isTeacher = () => !!teacherToken();
function setTeacher(t) {
  try {
    if (t) localStorage.setItem(TEACHER_KEY, t); else localStorage.removeItem(TEACHER_KEY);
    sessionStorage.removeItem(TEACHER_KEY);
  } catch {}
  listeners.forEach((fn) => { try { fn(auth?.student ?? null); } catch {} });
}
/** 標題頁右上角那顆按鈕的字 */
export const accountLabel = () => isTeacher() ? "老師 ▾" : auth?.student ? `${formatStudentLabel(auth.student)} ▾` : "登入";

/** 老師用密碼登入（學生先登出，避免老師試玩寫進學生的存檔） */
export async function loginTeacher(password, game) {
  if (!password) return { ok: false, error: "請輸入密碼" };
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) return { ok: false, error: data.error || "密碼錯誤" };
    if (auth) await logoutCloud(game, { stay: true });
    setTeacher(data.token);
    return { ok: true };
  } catch {
    return { ok: false, error: "連線失敗，請確認網路狀態" };
  }
}
export function logoutTeacher() { setTeacher(""); }
export const getStudent = () => auth?.student ?? null;
export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function formatStudentLabel(st) {
  if (!st) return "";
  return [st.className || st.classCode, st.groupName ? `${st.groupName}組` : "", st.seatNo ? `${st.seatNo}號` : "", st.name].filter(Boolean).join(" ");
}

/** 啟動雲端模組：偵測後端、處理網址 ?code= 掃碼自動登入、啟動活躍計時器 */
export async function initCloud(game) {
  if (initialized) return;
  initialized = true;

  const bump = () => { lastActivity = Date.now(); };
  for (const ev of ["pointerdown", "keydown", "touchstart", "click"]) addEventListener(ev, bump, { passive: true });
  setInterval(() => {
    if (!auth || !session) return;
    if (document.visibilityState === "visible" && Date.now() - lastActivity < IDLE_MS) {
      session.activeSec++;
    }
  }, 1000);
  setInterval(() => {
    if (!auth) return;
    if (dirty || (session && session.activeSec > lastSentSec)) flushCloud(false);
  }, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && auth) flushCloud(true);
  });
  addEventListener("pagehide", () => { if (auth) flushCloud(true); });

  // 偵測後端是否啟用（純靜態環境不報錯）
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      available = !!data?.ok;
    }
  } catch {
    available = false;
  }
  if (!available) return;

  // 1. 檢查 QR Code 網址 ?code=
  const url = new URL(location.href);
  const urlCode = url.searchParams.get("code");
  if (urlCode) {
    url.searchParams.delete("code");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    const r = await loginWithCode(urlCode, game);
    if (r.ok) return;
  }

  // 2. 既有登入憑證：拉最新雲端存檔
  if (auth?.token) {
    try {
      const res = await fetch("/api/student/me", { headers: { authorization: `Bearer ${auth.token}` }, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        saveAuth({ token: auth.token, student: data.student });
        if (data.save) applyLoadedSave(game, data.save);
        else latestSave = game.save;
        startSession();
        flushCloud(false);
      } else if (res.status === 401) {
        saveAuth(null);
      }
    } catch {}
  } else {
    // 讓標題頁能即時顯示「代碼登入」按鈕
    listeners.forEach((fn) => { try { fn(null); } catch {} });
  }
}

/** 學生輸入代碼登入 */
export async function loginWithCode(code, game) {
  const clean = String(code ?? "").trim();
  if (!clean) return { ok: false, error: "請輸入代碼" };
  try {
    if (auth) await flushCloud(false);
    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: clean }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false, error: data.error || "登入失敗，請再試一次" };
    available = true;
    if (isTeacher()) setTeacher("");   // 學生登入就把老師登出
    saveAuth({ token: data.token, student: data.student });
    applyLoadedSave(game, data.save);
    pendingMistakes = [];
    pendingResolved.clear();
    startSession();
    dirty = true;
    flushCloud(false);
    return { ok: true, student: data.student };
  } catch {
    return { ok: false, error: "連線失敗，請確認網路狀態" };
  }
}

/** 登出／切換學生（共用平板用） */
export async function logoutCloud(game, { stay = false } = {}) {
  if (auth) await flushCloud(false);
  saveAuth(null);
  session = null;
  pendingMistakes = [];
  pendingResolved.clear();
  game.save = freshSave();
  writeSave(game.save, { silent: true });
  applySettings(game.save.settings);
  applyOutfit(game.save);
  if (!stay) game.go("title");
}

/** writeSave 自動觸發的防抖同步 */
export function queueSaveSync(s) {
  latestSave = s;
  if (!auth) return;
  dirty = true;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => flushCloud(false), 2500);
}

/** 戰鬥答題紀錄：記題數、答對數、完整歷史錯題、以及錯題畢業 */
export function trackAnswer({ q, ok, pick, mode, graduated }) {
  if (!auth) return;
  if (!session) startSession();
  session.answered++;
  if (ok) {
    session.correct++;
    if (graduated && q?.typeKey) pendingResolved.add(q.typeKey);
  } else if (q) {
    pendingMistakes.push({
      clientMid: makeId("m"),
      branch: q.branch ?? "",
      grade: q.grade ?? "",
      typeKey: q.typeKey ?? "",
      questionText: q.text ?? "",
      studentAnswer: pick != null && pick !== "" ? String(pick) : "逾時未答",
      correctAnswer: `${q.answer ?? ""}${q.unit ? " " + q.unit : ""}`,
      mode: mode ?? "",
      createdAt: new Date().toISOString(),
    });
  }
  dirty = true;
}

/** 立即送出同步資料到後端 */
export async function flushCloud(useBeacon = false) {
  if (!auth || !available) return;
  const payload = {
    token: auth.token,
    save: latestSave,
    session: session ? { ...session } : null,
    mistakes: pendingMistakes.slice(),
    resolvedKeys: [...pendingResolved],
  };
  if (useBeacon && navigator.sendBeacon) {
    try {
      const ok = navigator.sendBeacon("/api/student/sync", new Blob([JSON.stringify(payload)], { type: "text/plain" }));
      if (ok) {
        if (session) lastSentSec = session.activeSec;
        pendingMistakes = [];
        pendingResolved.clear();
        dirty = false;
      }
    } catch {}
    return;
  }
  try {
    const res = await fetch("/api/student/sync", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      if (session) lastSentSec = session.activeSec;
      pendingMistakes = pendingMistakes.slice(payload.mistakes.length);
      payload.resolvedKeys.forEach((k) => pendingResolved.delete(k));
      dirty = false;
    }
  } catch {}
}

/** 登入彈窗：學生（代碼）／老師（密碼）兩個分頁；已登入就顯示帳號與登出 */
export function openLoginModal(game, onDone) {
  document.querySelector("#app .cloudback")?.remove();
  const st = getStudent();
  const close = (changed = false) => { overlay.remove(); onDone?.(changed); };
  const box = el("div.panel.cloudmodal");
  const overlay = el("div.cloudback", { onclick: (e) => { if (e.target === overlay) close(); } }, box);
  document.querySelector("#app").append(overlay);

  // 老師已登入
  if (isTeacher()) {
    box.append(
      el("div.ptitle", {}, "老師"),
      el("div.cloudcur", {}, el("b", {}, "已登入"), el("span", {}, "試玩不會記錄成學生的資料")),
      el("div.cloudbtns", {},
        el("button.btn.gold", { onclick: () => { sfx("click"); location.href = "/admin/"; } }, "開啟後台"),
        el("button.btn", { onclick: () => { sfx("click"); close(); } }, "試玩遊戲"),
        el("button.btn.red", { onclick: () => { sfx("click"); logoutTeacher(); close(true); } }, "登出")));
    return;
  }

  let who = "student";
  const tabs = el("div.cloudtabs");
  const body = el("div.cloudbody");
  const msg = el("div.cloudmsg");
  const draw = () => {
    tabs.replaceChildren(
      el(`button.cloudtab${who === "student" ? ".on" : ""}`, { onclick: () => { who = "student"; draw(); } }, "學生"),
      el(`button.cloudtab${who === "teacher" ? ".on" : ""}`, { onclick: () => { who = "teacher"; draw(); } }, "老師"));
    msg.textContent = "";
    const teacher = who === "teacher";
    const input = el("input.cloudinput", teacher
      ? { type: "password", placeholder: "老師密碼", autocomplete: "current-password" }
      : { type: "text", placeholder: "4 位數代碼", inputmode: "numeric", maxlength: 16, autocomplete: "off", autocapitalize: "characters", spellcheck: false });
    if (teacher) input.classList.add("pw");
    const submitBtn = el("button.btn.gold", { onclick: () => submit() }, "登入");
    async function submit() {
      const v = input.value.trim();
      if (!v) { msg.textContent = teacher ? "請輸入老師密碼" : "請輸入老師發的代碼！"; input.focus(); return; }
      submitBtn.disabled = true;
      msg.textContent = "登入中…";
      const r = teacher ? await loginTeacher(v, game) : await loginWithCode(v, game);
      submitBtn.disabled = false;
      if (!r.ok) { msg.textContent = r.error; sfx("hurt"); return; }
      sfx("good");
      if (teacher) { draw2(); return; }
      close(true);
    }
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    body.replaceChildren(...[
      st && !teacher ? el("div.cloudcur", {}, el("b", {}, formatStudentLabel(st)), el("span.cloudcode", {}, st.loginCode)) : null,
      input, msg,
      el("div.cloudbtns", {},
        submitBtn,
        st && !teacher ? el("button.btn.red", { onclick: async () => { sfx("click"); overlay.remove(); await logoutCloud(game); onDone?.(true); } }, "登出") : null,
        el("button.btn", { onclick: () => { sfx("click"); close(); } }, "取消"))].filter(Boolean));
    setTimeout(() => input.focus(), 50);
  };
  // 老師登入成功：直接問要開後台還是試玩
  const draw2 = () => { overlay.remove(); onDone?.(true); openLoginModal(game, onDone); };
  box.append(el("div.ptitle", {}, "登入"), tabs, body);
  draw();
}
