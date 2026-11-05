// 存檔：等級、經驗、金幣、碎屑、背包、身上裝備、形態。存在瀏覽器的 localStorage（單機，不用伺服器）。
// ver 2（2026-11-04）：武器變成星核、加上形態。
// ver 3（2026-11-05）：裝備改版（主屬性＋副屬性、6 階稀有度）。使用者決定舊裝備直接清掉，身上換回起始裝備；等級、金幣、形態、任務都保留。清之前先備份。
import { starterGear, migrateCore } from "./items.js";
import { freshForms, migrateForms } from "./forms.js";
import { freshQuests } from "./quests.js";

const KEY = "zero-hero-save-v1";
const BACKUP = "zero-hero-save-v1-backup-ver2";
const VER = 3;
export const BAG_SIZE = 40;

export const freshGuild = () => ({ registered: false, done: 0, quest: null });
function fresh() {
  return { ver: VER, lv: 1, xp: 0, coins: 0, scrap: 0, inv: [], equip: starterGear(), auto: 0, clears: 0, forms: freshForms(), guild: freshGuild(), quests: freshQuests(), meal: null };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = JSON.parse(raw);
    if (s && s.equip && Array.isArray(s.inv)) {
      if ((s.ver ?? 1) < 3) {
        if (!localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP, raw);
        s.equip = starterGear();
        s.inv = [];
        s.ver = 3;
      }
      // 8a：星核不參與套裝了，舊的套裝星核轉成一般史詩星核
      migrateCore(s.equip.weapon);
      for (const it of s.inv) migrateCore(it);
      const q = { ...freshQuests(), ...(s.quests ?? {}) };
      q.stats = { ...freshQuests().stats, ...(q.stats ?? {}) };
      return { ...fresh(), ...s, forms: s.forms ? migrateForms(s.forms) : freshForms(), guild: s.guild ?? freshGuild(), quests: q };
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
