// 刷寶資料：稀有度、欄位、武器種類、底材、詞綴、傳說，以及「掉一件裝備」的隨機產生。
// 數值設計見 docs/企劃書.md 第 5 章。這裡只有資料和純函式，不碰畫面。

export const RARITY = [
  { id: "junk", name: "垃圾", color: "#8f8a9e", weight: 45, affix: [0, 0], mult: 0.7, scrap: 1, coin: 2 },
  { id: "common", name: "普通", color: "#e8e6f2", weight: 35, affix: [0, 1], mult: 1, scrap: 1, coin: 5 },
  { id: "magic", name: "魔法", color: "#5aa6ff", weight: 15, affix: [1, 2], mult: 1.05, scrap: 2, coin: 12 },
  { id: "rare", name: "稀有", color: "#ffd84a", weight: 4.5, affix: [3, 4], mult: 1.12, scrap: 5, coin: 30 },
  { id: "legend", name: "傳說", color: "#ff8a2a", weight: 0.45, affix: [2, 3], mult: 1.25, scrap: 15, coin: 100 },
];
export const R = Object.fromEntries(RARITY.map((r, i) => [r.id, i]));

export const SLOTS = [
  { id: "weapon", name: "武器", kind: "weapon" },
  { id: "head", name: "頭盔", kind: "head" },
  { id: "body", name: "衣服", kind: "body" },
  { id: "hands", name: "手套", kind: "hands" },
  { id: "feet", name: "鞋子", kind: "feet" },
  { id: "acc1", name: "飾品", kind: "acc" },
  { id: "acc2", name: "飾品", kind: "acc" },
];
export const KIND_NAME = { weapon: "武器", head: "頭盔", body: "衣服", hands: "手套", feet: "鞋子", acc: "飾品", junk: "垃圾" };

// 武器種類：換武器＝換連段（招式在 player.js 的 COMBOS）
export const WTYPES = {
  sword: { name: "單手劍", weapon: "sword" },
  greatsword: { name: "大劍", weapon: "greatsword" },
  dagger: { name: "雙匕首", weapon: "dagger", off: "dagger", crit: 8 },
  spear: { name: "長槍", weapon: "spear" },
  hammer: { name: "大錘", weapon: "hammer" },
};

// 底材：lv 是最低物品等級，數值是 1 級時的基礎值（會隨物品等級成長）
export const BASES = {
  sword1: { kind: "weapon", wtype: "sword", name: "生鏽的鐵劍", short: "鐵劍", icon: "sword", atk: 12, lv: 1 },
  sword2: { kind: "weapon", wtype: "sword", name: "見習騎士劍", short: "騎士劍", icon: "sword", atk: 15, lv: 6 },
  great1: { kind: "weapon", wtype: "greatsword", name: "門板大劍", short: "門板劍", icon: "greatsword", atk: 19, lv: 1 },
  great2: { kind: "weapon", wtype: "greatsword", name: "屠龍大劍（仿）", short: "屠龍劍", icon: "greatsword", atk: 27, lv: 8 },
  dagger1: { kind: "weapon", wtype: "dagger", name: "削水果刀", short: "水果刀", icon: "dagger", atk: 8, lv: 1 },
  dagger2: { kind: "weapon", wtype: "dagger", name: "刺客短刃", short: "短刃", icon: "dagger", atk: 11, lv: 7 },
  spear1: { kind: "weapon", wtype: "spear", name: "晾衣竿", short: "晾衣竿", icon: "spear", atk: 12, lv: 1 },
  spear2: { kind: "weapon", wtype: "spear", name: "騎兵長槍", short: "長槍", icon: "spear", atk: 17, lv: 7 },
  hammer1: { kind: "weapon", wtype: "hammer", name: "搥肉槌", short: "肉槌", icon: "hammer", atk: 18, lv: 1 },
  hammer2: { kind: "weapon", wtype: "hammer", name: "打樁大錘", short: "大錘", icon: "hammer", atk: 26, lv: 8 },
  head1: { kind: "head", name: "破水桶", short: "水桶", icon: "bucket", def: 2, lv: 1 },
  head2: { kind: "head", name: "皮帽", short: "皮帽", icon: "cap", def: 4, lv: 4 },
  head3: { kind: "head", name: "鐵頭盔", short: "頭盔", icon: "helm", def: 7, lv: 10 },
  body1: { kind: "body", name: "麻布衣", short: "布衣", icon: "shirt", def: 3, hp: 10, lv: 1 },
  body2: { kind: "body", name: "皮甲", short: "皮甲", icon: "vest", def: 6, hp: 15, lv: 4 },
  body3: { kind: "body", name: "鎖子甲", short: "鎖甲", icon: "mail", def: 10, hp: 25, lv: 10 },
  hands1: { kind: "hands", name: "工作手套", short: "手套", icon: "glove", def: 2, lv: 1 },
  hands2: { kind: "hands", name: "皮護手", short: "護手", icon: "gauntlet", def: 4, lv: 5 },
  feet1: { kind: "feet", name: "藍白拖", short: "拖鞋", icon: "slipper", def: 1, lv: 1 },
  feet2: { kind: "feet", name: "皮靴", short: "皮靴", icon: "boot", def: 3, lv: 4 },
  feet3: { kind: "feet", name: "鐵靴", short: "鐵靴", icon: "ironboot", def: 6, lv: 10 },
  acc1: { kind: "acc", name: "易開罐拉環", short: "拉環", icon: "pulltab", lv: 1 },
  acc2: { kind: "acc", name: "銅戒指", short: "戒指", icon: "ring", lv: 3 },
  acc3: { kind: "acc", name: "舊護身符", short: "護身符", icon: "amulet", lv: 6 },
};

// 純垃圾：不能穿，只能拆解。撿到時系統會吐槽。
export const JUNK = [
  { id: "fishbone", name: "魚骨頭", icon: "fishbone", say: "系統：一根魚骨頭。你的拾荒魂在燃燒呢。" },
  { id: "bottle", name: "寶特瓶", icon: "bottle", say: "系統：寶特瓶。記得回收，勇者也要做環保。" },
  { id: "sock", name: "破襪子", icon: "sock", say: "系統：破襪子……只有一隻。另一隻呢？" },
  { id: "chopsticks", name: "斷掉的免洗筷", icon: "chopsticks", say: "系統：免洗筷，斷的。完美的垃圾。" },
  { id: "bento", name: "過期的便當", icon: "bento", say: "系統：過期三天的便當。不准吃。" },
];

// 詞綴：t 是 T1（最好）到 T5 的數值範圍。slots 是會出現的欄位種類。
export const AFFIXES = {
  atk: { pre: "鋒利", fmt: (v) => `攻擊 +${v}%`, slots: ["weapon", "hands", "acc"], t: [[22, 28], [16, 21], [11, 15], [7, 10], [3, 6]] },
  hp: { pre: "結實", fmt: (v) => `生命 +${v}`, slots: ["head", "body", "feet", "acc"], t: [[70, 90], [50, 69], [34, 49], [20, 33], [8, 19]] },
  def: { pre: "堅固", fmt: (v) => `防禦 +${v}`, slots: ["head", "body", "hands", "feet"], t: [[24, 30], [17, 23], [11, 16], [6, 10], [2, 5]] },
  spd: { pre: "輕快", fmt: (v) => `攻速 +${v}%`, slots: ["weapon", "hands", "acc"], t: [[16, 20], [12, 15], [8, 11], [5, 7], [2, 4]] },
  move: { pre: "疾風", fmt: (v) => `移速 +${v}%`, slots: ["feet", "acc"], t: [[14, 18], [10, 13], [7, 9], [4, 6], [2, 3]] },
  crit: { pre: "精準", fmt: (v) => `暴擊率 +${v}%`, slots: ["weapon", "hands", "head", "acc"], t: [[10, 12], [7, 9], [5, 6], [3, 4], [1, 2]] },
  critDmg: { pre: "殘暴", fmt: (v) => `暴擊傷害 +${v}%`, slots: ["weapon", "acc"], t: [[45, 60], [32, 44], [22, 31], [13, 21], [6, 12]] },
  fire: { pre: "燃燒", fmt: (v) => `附加火焰傷害 +${v}`, slots: ["weapon", "hands", "acc"], t: [[14, 18], [10, 13], [7, 9], [4, 6], [1, 3]] },
  skill: { pre: "魔力", fmt: (v) => `火球傷害 +${v}%`, slots: ["weapon", "head", "acc"], t: [[45, 60], [32, 44], [22, 31], [13, 21], [6, 12]] },
  cdr: { pre: "冥想", fmt: (v) => `火球冷卻 -${v}%`, slots: ["head", "acc"], t: [[20, 25], [15, 19], [11, 14], [7, 10], [3, 6]] },
  life: { pre: "吸血", fmt: (v) => `擊殺回復 ${v} 生命`, slots: ["weapon", "hands", "acc"], t: [[7, 8], [5, 6], [4, 4], [2, 3], [1, 1]] },
  boom: { pre: "易燃", fmt: (v) => `擊殺時 ${v}% 機率爆炸`, slots: ["weapon", "body", "acc"], t: [[18, 22], [13, 17], [9, 12], [5, 8], [2, 4]] },
  gold: { pre: "貪財", fmt: (v) => `金幣 +${v}%`, slots: ["head", "feet", "acc"], t: [[50, 60], [36, 49], [24, 35], [13, 23], [5, 12]] },
  mf: { pre: "幸運", fmt: (v) => `掉寶率 +${v}%`, slots: ["head", "hands", "acc"], t: [[40, 50], [30, 39], [20, 29], [11, 19], [5, 10]] },
  magnet: { pre: "磁力", fmt: (v) => `吸物範圍 +${v}%`, slots: ["body", "feet", "acc"], t: [[80, 100], [60, 79], [40, 59], [22, 39], [10, 21]] },
};

// 傳說：固定底材＋獨特效果（效果本身寫在 player.js / main.js，用 unique id 判斷）
export const UNIQUES = {
  slipper: { kind: "feet", name: "前任勇者的拖鞋", icon: "goldslipper", def: 4, text: "閃避後的下一擊必定暴擊；閃避距離 +50%", lore: "前任勇者逃跑時掉的。跑得很快。" },
  overtime: { kind: "acc", name: "加班證明", icon: "paper", text: "戰鬥越久傷害越高：每 10 秒 +5%，上限 +100%，戰鬥結束歸零", lore: "上面蓋著「已讀不回」的章。" },
  noisy: { kind: "weapon", wtype: "sword", name: "很吵的劍", icon: "noisysword", atk: 18, text: "每 10 秒吐槽你一次，並給予隨機增益 5 秒", lore: "「拜託你認真打好嗎。」" },
  hardhat: { kind: "head", name: "爆炸頭安全帽", icon: "hardhat", def: 6, text: "擊殺時爆炸機率 +25%，爆炸範圍 +50%", lore: "工地主任的遺物。施工中，請勿靠近。" },
};

// 隨機名字：稀有裝備叫「○○之＋短名」
const RARE_NAMES = ["社畜", "加班狂", "外送員", "失眠者", "禿頭勇者", "深淵", "午夜", "被拋棄者", "打工仔", "零星", "前男友", "房東", "末班車", "便利商店"];

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
let uidN = 0;
const uid = () => Date.now().toString(36) + (uidN++).toString(36);

/** 物品等級允許的詞綴層級數（從 T5 往上數）。 */
export const tiersFor = (ilvl) => (ilvl >= 28 ? 5 : ilvl >= 18 ? 4 : ilvl >= 10 ? 3 : ilvl >= 5 ? 2 : 1);
const growth = (ilvl) => 1 + 0.08 * (ilvl - 1);

/** 抽稀有度。mf 是掉寶率加成（%），越高越容易出好東西。minR 是保底。 */
export function rollRarity(mf = 0, minR = 0, legendBoost = 1) {
  const w = RARITY.map((r, i) => (i < minR ? 0 : r.weight * (i >= R.magic ? 1 + mf / 100 : 1) * (i === R.legend ? legendBoost : 1)));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i;
  return 0;
}

function rollAffix(id, ilvl) {
  const A = AFFIXES[id], n = tiersFor(ilvl);
  // 越高的層級越難出：T5 權重 1，往上依序遞減
  const w = [1, 0.55, 0.3, 0.16, 0.08].slice(0, n);
  let x = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
  while ((x -= w[k]) >= 0 && k < n - 1) k++;
  const tier = 5 - k, [a, b] = A.t[tier - 1];
  return { id, tier, v: randInt(a, b) };
}

function rollAffixes(kind, count, ilvl) {
  const pool = Object.keys(AFFIXES).filter((id) => AFFIXES[id].slots.includes(kind));
  const out = [];
  while (out.length < count && pool.length) out.push(rollAffix(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], ilvl));
  return out;
}

/** 產生一件物品。opts.kind / opts.base 可以指定部位或底材。 */
export function makeItem(ilvl, rarity, opts = {}) {
  ilvl = Math.max(1, Math.round(ilvl));
  const r = RARITY[rarity];
  if (rarity === R.legend && !opts.base) {
    const ids = Object.keys(UNIQUES).filter((u) => !opts.kind || UNIQUES[u].kind === opts.kind);
    if (ids.length) return makeUnique(opts.unique ?? pick(ids), ilvl);
  }
  // 垃圾稀有度：六成是純垃圾，四成是破爛裝備
  if (rarity === R.junk && !opts.kind && !opts.base && Math.random() < 0.6) {
    const j = pick(JUNK);
    return { uid: uid(), junk: j.id, kind: "junk", name: j.name, icon: j.icon, rarity, ilvl, affixes: [], stats: {} };
  }
  let baseId = opts.base;
  if (!baseId) {
    // 智慧掉落：有 opts.prefer（目前用的武器種類）時，武器偏向那一種
    let ids = Object.keys(BASES).filter((id) => BASES[id].lv <= ilvl && (!opts.kind || BASES[id].kind === opts.kind));
    if (opts.prefer && Math.random() < 0.5) {
      const same = ids.filter((id) => BASES[id].wtype === opts.prefer);
      if (same.length) ids = same;
    }
    // 同一部位裡，越新的底材越常出現
    baseId = pick(ids);
    const better = ids.filter((id) => BASES[id].kind === BASES[baseId].kind && BASES[id].lv > BASES[baseId].lv);
    if (better.length && Math.random() < 0.5) baseId = pick(better);
  }
  const b = BASES[baseId];
  const [a0, a1] = r.affix;
  let n = randInt(a0, a1);
  if (b.kind === "acc" && rarity === R.common) n = 1;   // 飾品沒有基礎數值，至少給一條
  const affixes = rollAffixes(b.kind, n, ilvl);
  const item = { uid: uid(), base: baseId, kind: b.kind, wtype: b.wtype, icon: b.icon, rarity, ilvl, affixes, stats: baseStats(b, ilvl, r.mult) };
  item.name = rarity === R.junk ? "破爛的" + b.short
    : rarity === R.magic && affixes.length ? AFFIXES[affixes[0].id].pre + "的" + b.short
    : rarity === R.rare ? pick(RARE_NAMES) + "之" + b.short
    : b.name;
  return item;
}

export function makeUnique(id, ilvl) {
  const u = UNIQUES[id], r = RARITY[R.legend];
  const affixes = rollAffixes(u.kind, randInt(r.affix[0], r.affix[1]), ilvl);
  return { uid: uid(), unique: id, kind: u.kind, wtype: u.wtype, icon: u.icon, rarity: R.legend, ilvl, affixes, stats: baseStats(u, ilvl, r.mult), name: u.name };
}

function baseStats(b, ilvl, mult) {
  const s = {}, g = growth(ilvl) * mult;
  if (b.atk) s.atk = Math.round(b.atk * g);
  if (b.def) s.def = Math.round(b.def * g);
  if (b.hp) s.hp = Math.round(b.hp * g);
  return s;
}

/** 一開始身上的裝備。 */
export function starterGear() {
  const sword = makeItem(1, R.common, { base: "sword1" });
  sword.affixes = [];
  const shirt = makeItem(1, R.common, { base: "body1" });
  shirt.affixes = [];
  return { weapon: sword, body: shirt };
}

/** 一件物品的說明文字（給背包詳細欄位用）。 */
export function describe(item) {
  const lines = [];
  if (item.stats.atk) lines.push(["base", `武器攻擊 ${item.stats.atk}`]);
  if (item.stats.def) lines.push(["base", `防禦 ${item.stats.def}`]);
  if (item.stats.hp) lines.push(["base", `生命 +${item.stats.hp}`]);
  for (const a of item.affixes) {
    const A = AFFIXES[a.id], perfect = a.tier === 1 && a.v === A.t[0][1];
    lines.push([perfect ? "perfect" : "affix", A.fmt(a.v), "T" + a.tier]);
  }
  if (item.unique) lines.push(["unique", UNIQUES[item.unique].text]);
  return lines;
}

export const kindLabel = (item) => (item.kind === "weapon" ? WTYPES[item.wtype].name : KIND_NAME[item.kind]);
export const rarityOf = (item) => RARITY[item.rarity];
