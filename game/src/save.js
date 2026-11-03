// 存檔：等級、經驗、金幣、碎屑、背包、身上裝備。存在瀏覽器的 localStorage（單機，不用伺服器）。
import { starterGear } from "./items.js";

const KEY = "zero-hero-save-v1";
export const BAG_SIZE = 40;

function fresh() {
  return { lv: 1, xp: 0, coins: 0, scrap: 0, inv: [], equip: starterGear(), auto: 0, clears: 0 };
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.equip && Array.isArray(s.inv)) return { ...fresh(), ...s };
  } catch {}
  return fresh();
}

let timer = 0;
/** 存檔（合併 0.3 秒內的多次呼叫）。now = true 立刻寫入（離開頁面前用）。 */
export function save(profile, now = false) {
  clearTimeout(timer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch {} };
  if (now) write();
  else timer = setTimeout(write, 300);
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch {}
}
