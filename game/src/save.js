// 存檔：等級、經驗、金幣、碎屑、背包、身上裝備、形態。存在瀏覽器的 localStorage（單機，不用伺服器）。
// ver 2（2026-11-04）：武器變成星核、加上形態。舊存檔第一次讀取時自動轉換，轉換前先把原本的存檔另存一份備份。
import { starterGear, nameFor, BASES, UNIQUES } from "./items.js";
import { freshForms } from "./forms.js";

const KEY = "zero-hero-save-v1";
const BACKUP = "zero-hero-save-v1-backup-ver1";
const VER = 2;
export const BAG_SIZE = 40;

function fresh() {
  return { ver: VER, lv: 1, xp: 0, coins: 0, scrap: 0, inv: [], equip: starterGear(), auto: 0, clears: 0, forms: freshForms() };
}

// 舊武器 → 星核：底材 id 不變，只改名字（稀有裝備保留原本的隨機名字）、拿掉武器種類
function migrateItem(it) {
  if (!it || it.kind !== "weapon") return;
  if (it.unique && UNIQUES[it.unique]) it.name = UNIQUES[it.unique].name;
  else if (BASES[it.base]) it.name = nameFor(it, it.name.includes("之") ? it.name.split("之")[0] : null);
  if (BASES[it.base]?.crit && !it.stats.crit) it.stats.crit = BASES[it.base].crit;
  delete it.wtype;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = JSON.parse(raw);
    if (s && s.equip && Array.isArray(s.inv)) {
      if ((s.ver ?? 1) < 2) {
        if (!localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP, raw);
        Object.values(s.equip).forEach(migrateItem);
        s.inv.forEach(migrateItem);
        s.ver = 2;
      }
      return { ...fresh(), ...s, forms: s.forms ?? freshForms() };
    }
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
