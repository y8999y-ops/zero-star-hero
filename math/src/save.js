// 存檔（localStorage）。所有讀寫都包 try/catch：無痕模式或被封鎖時遊戲照樣能玩，只是不會記住。

import { ATTR_IDS, BRANCHES } from "./data.js";
import { DEFAULT_SETTINGS, withDefaults } from "./settings.js";

const KEY = "mosu-academy-save-v1";

export function freshSave() {
  return {
    ver: 1,
    look: null,          // "girl" | "boy"
    attr: null,          // 屬性 id
    mood: 0,             // 心情題緊張程度 0～3（取兩題較高的）
    seenIntro: false,
    lv: 1, exp: 0, coins: 0,
    rank: 0,             // RANKS 的索引
    crystals: Object.fromEntries(ATTR_IDS.map((a) => [a, 0])),
    branches: Object.fromEntries(Object.keys(BRANCHES).map((b) => [b, { recent: [], best: 0 }])),
    seenTypes: {},       // 第一次答對某題型的紀錄
    review: {},          // 錯題本：題型 key → { left: 還要連續答對幾次, sample }
    stars: {},           // "g1-1" → 0～3
    diary: {},           // "2026-11-25" → { n, ok }
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw), f = freshSave(); return { ...f, ...d, branches: { ...f.branches, ...(d.branches ?? {}) }, settings: withDefaults(d.settings) }; }   // 新加的魔法種類補上
  } catch {}
  return freshSave();
}

let saveListener = null;
export function setSaveListener(fn) { saveListener = fn; }

export function writeSave(s, { silent = false } = {}) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  if (!silent) saveListener?.(s);
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch {}
  return freshSave();
}
