// 刷寶資料：稀有度、欄位、底材、屬性（主屬性＋副屬性），以及「掉一件裝備」的隨機產生。
// 2026-11-04 改成星星主題：武器欄 → 星核（鑲在身體裡的寶石，提供攻擊力）；攻擊方式改由「形態」決定（forms.js）。
// 2026-11-05 裝備改版第 1 批（docs/裝備系統企劃.md）：6 階稀有度、1 條主屬性＋最多 4 條副屬性（原神聖遺物式）、
//   屬性換成 14 種（取消攻速、附加火焰、擊殺爆炸、金幣、吸物範圍；擊殺回復改吸血；技能／大招傷害分開；新增充能效率）。
// 這裡只有資料和純函式，不碰畫面。欄位 id 沿用舊的（weapon、head…）。

export const RARITY = [
  { id: "common", name: "普通", color: "#e8e6f2", weight: 80, subs: [0, 1], mult: 1, scrap: 1, coin: 3 },
  { id: "fine", name: "精良", color: "#5ad06a", weight: 15, subs: [1, 2], mult: 1.1, scrap: 2, coin: 8 },
  { id: "rare", name: "稀有", color: "#5aa6ff", weight: 5, subs: [2, 3], mult: 1.2, scrap: 4, coin: 20 },
  { id: "epic", name: "史詩", color: "#b878ff", weight: 0, subs: [3, 4], mult: 1.3, scrap: 8, coin: 45 },
  { id: "legend", name: "傳說", color: "#ff8a2a", weight: 0, subs: [4, 4], mult: 1.4, scrap: 15, coin: 100 },
  { id: "myth", name: "神話", color: "#fff0a0", weight: 0, subs: [4, 4], mult: 1.5, scrap: 30, coin: 200 },
];
export const R = Object.fromEntries(RARITY.map((r, i) => [r.id, i]));
/** 純垃圾（魚骨頭那些）的顯示顏色：不算稀有度 */
export const JUNK_COLOR = "#8f8a9e";
export const colorOf = (item) => (item.kind === "junk" ? JUNK_COLOR : RARITY[item.rarity].color);

export const SLOTS = [
  { id: "weapon", name: "星核", kind: "weapon" },
  { id: "head", name: "星冠", kind: "head" },
  { id: "body", name: "星殼", kind: "body" },
  { id: "hands", name: "星爪", kind: "hands" },
  { id: "feet", name: "星靴", kind: "feet" },
  { id: "acc1", name: "碎片", kind: "acc" },
  { id: "acc2", name: "碎片", kind: "acc" },
];
export const KIND_NAME = { weapon: "星核", head: "星冠", body: "星殼", hands: "星爪", feet: "星靴", acc: "碎片", junk: "垃圾" };

// ---- 屬性（14 種）
// name 顯示名稱、pct 是不是百分比、dec 小數位、t 副屬性每條的範圍（T1 最好 … T5 最差）、main 當主屬性時物品等級 1 的數值
export const STATS = {
  atk: { name: "攻擊", pct: false, t: [[6, 9], [5, 7], [4, 5], [2, 4], [1, 3]] },
  atkPct: { name: "攻擊", pct: true, t: [[8, 10], [7, 8], [5, 7], [4, 5], [2, 4]], main: 6 },
  hp: { name: "生命", pct: false, t: [[30, 40], [24, 33], [18, 26], [12, 19], [6, 12]] },
  hpPct: { name: "生命", pct: true, t: [[8, 10], [7, 8], [5, 7], [4, 5], [2, 4]], main: 6 },
  def: { name: "防禦", pct: false, t: [[10, 12], [8, 10], [6, 8], [4, 6], [2, 4]] },
  crit: { name: "暴擊率", pct: true, t: [[5, 6], [4, 5], [3, 4], [2, 3], [1, 2]], main: 4 },
  critDmg: { name: "暴擊傷害", pct: true, t: [[10, 12], [8, 10], [6, 8], [4, 6], [2, 4]], main: 8 },
  skill: { name: "技能傷害", pct: true, t: [[14, 18], [12, 15], [9, 12], [7, 9], [4, 6]], main: 10 },
  ult: { name: "大招傷害", pct: true, t: [[18, 22], [15, 18], [11, 15], [8, 11], [5, 8]], main: 12 },
  charge: { name: "充能效率", pct: true, t: [[12, 15], [10, 12], [8, 10], [5, 7], [3, 5]], main: 8 },
  cdr: { name: "技能冷卻", pct: true, neg: true, t: [[7, 8], [6, 7], [4, 6], [3, 4], [2, 3]] },
  leech: { name: "吸血", pct: true, dec: 1, t: [[2.5, 3], [2, 2.5], [1.5, 2], [1, 1.5], [0.5, 0.5]], main: 1.5 },
  move: { name: "移速", pct: true, t: [[6, 7], [5, 6], [4, 5], [3, 4], [2, 3]], main: 5 },
  mf: { name: "掉寶率", pct: true, t: [[15, 18], [12, 15], [9, 12], [6, 9], [4, 6]] },
};
/** 一條屬性的文字：「攻擊 +12%」「技能冷卻 -5%」 */
export function fmtStat(id, v) {
  const S = STATS[id], d = S.dec ?? 0, n = Number(v.toFixed(d));
  return `${S.name} ${S.neg ? "-" : "+"}${n}${S.pct ? "%" : ""}`;
}
// 舊名字保留給工坊的重鑄畫面用（副屬性的定義）
export const AFFIXES = Object.fromEntries(Object.entries(STATS).map(([id, S]) => [id, { ...S, fmt: (v) => fmtStat(id, v) }]));

// 每個部位的主屬性：固定（星核／星爪＝攻擊、星殼＝生命）或隨機（權重）
export const MAIN_POOL = {
  head: { atkPct: 3, hpPct: 3, crit: 2, critDmg: 2 },
  feet: { atkPct: 3, hpPct: 3, charge: 2, move: 2 },
  acc: { atkPct: 3, hpPct: 3, skill: 2, ult: 2, charge: 2, leech: 1 },
};

// 底材：lv 是最低物品等級；atk／hp 是固定主屬性在物品等級 1 的數值；sub 是一定會有的副屬性
export const BASES = {
  // 星核（攻擊固定）
  sword1: { kind: "weapon", name: "鏽色星核", short: "鏽核", icon: "core_rust", atk: 12, lv: 1 },
  sword2: { kind: "weapon", name: "晨光星核", short: "晨核", icon: "core_dawn", atk: 15, lv: 6 },
  great1: { kind: "weapon", name: "沉重星核", short: "重核", icon: "core_heavy", atk: 17, lv: 1 },
  great2: { kind: "weapon", name: "隕鐵星核", short: "隕核", icon: "core_meteor", atk: 22, lv: 8 },
  dagger1: { kind: "weapon", name: "尖銳星核", short: "尖核", icon: "core_sharp", atk: 10, sub: "crit", lv: 1 },
  dagger2: { kind: "weapon", name: "暗影星核", short: "影核", icon: "core_shadow", atk: 13, sub: "crit", lv: 7 },
  spear1: { kind: "weapon", name: "細長星核", short: "長核", icon: "core_long", atk: 12, lv: 1 },
  spear2: { kind: "weapon", name: "彗尾星核", short: "彗核", icon: "core_comet", atk: 16, lv: 7 },
  hammer1: { kind: "weapon", name: "鈍光星核", short: "鈍核", icon: "core_dull", atk: 16, lv: 1 },
  hammer2: { kind: "weapon", name: "巨岩星核", short: "岩核", icon: "core_rock", atk: 21, lv: 8 },
  // 星冠（主屬性隨機）
  head1: { kind: "head", name: "破水桶", short: "水桶", icon: "bucket", lv: 1 },
  head2: { kind: "head", name: "皮帽", short: "皮帽", icon: "cap", lv: 4 },
  head3: { kind: "head", name: "鐵頭盔", short: "頭盔", icon: "helm", lv: 10 },
  // 星殼（生命固定）
  body1: { kind: "body", name: "麻布衣", short: "布衣", icon: "shirt", hp: 30, lv: 1 },
  body2: { kind: "body", name: "皮甲", short: "皮甲", icon: "vest", hp: 38, lv: 4 },
  body3: { kind: "body", name: "鎖子甲", short: "鎖甲", icon: "mail", hp: 48, lv: 10 },
  // 星爪（攻擊固定）
  hands1: { kind: "hands", name: "工作手套", short: "手套", icon: "glove", atk: 3, lv: 1 },
  hands2: { kind: "hands", name: "皮護手", short: "護手", icon: "gauntlet", atk: 5, lv: 5 },
  // 星靴（主屬性隨機）
  feet1: { kind: "feet", name: "藍白拖", short: "拖鞋", icon: "slipper", lv: 1 },
  feet2: { kind: "feet", name: "皮靴", short: "皮靴", icon: "boot", lv: 4 },
  feet3: { kind: "feet", name: "鐵靴", short: "鐵靴", icon: "ironboot", lv: 10 },
  // 碎片（主屬性隨機）
  acc1: { kind: "acc", name: "易開罐拉環", short: "拉環", icon: "pulltab", lv: 1 },
  acc2: { kind: "acc", name: "銅戒指", short: "戒指", icon: "ring", lv: 3 },
  acc3: { kind: "acc", name: "舊護身符", short: "護身符", icon: "amulet", lv: 6 },
};

// 純垃圾：不能穿，只能拆解。撿到時系統會吐槽。
export const JUNK = [
  { id: "fishbone", name: "魚骨頭", icon: "fishbone", say: "系統：一根魚骨頭。你的收集魂在燃燒呢。" },
  { id: "bottle", name: "寶特瓶", icon: "bottle", say: "系統：寶特瓶。記得回收，勇者也要做環保。" },
  { id: "sock", name: "破襪子", icon: "sock", say: "系統：破襪子……只有一隻。另一隻呢？" },
  { id: "chopsticks", name: "斷掉的免洗筷", icon: "chopsticks", say: "系統：免洗筷，斷的。完美的垃圾。" },
  { id: "bento", name: "過期的便當", icon: "bento", say: "系統：過期三天的便當。不准吃。" },
];
/** 一般掉落裡純垃圾的比例 */
export const JUNK_CHANCE = 0.35;

// 傳說：固定底材＋獨特效果（效果本身寫在 player.js / main.js，用 unique id 判斷）。目前進度不會掉（第 6 批改版）。
export const UNIQUES = {
  slipper: { kind: "feet", name: "前任勇者的拖鞋", icon: "goldslipper", text: "閃避後的下一擊必定暴擊；閃避距離 +50%", lore: "前任勇者逃跑時掉的。跑得很快。" },
  overtime: { kind: "acc", name: "加班證明", icon: "paper", text: "戰鬥越久傷害越高：每 10 秒 +5%，上限 +100%，戰鬥結束歸零", lore: "上面蓋著「已讀不回」的章。" },
  noisy: { kind: "weapon", name: "很吵的星核", icon: "core_noisy", atk: 18, text: "每 10 秒吐槽你一次，並給予隨機增益 5 秒", lore: "「拜託你認真打好嗎。」" },
  hardhat: { kind: "head", name: "爆炸頭安全帽", icon: "hardhat", text: "擊殺時 25% 機率爆炸", lore: "工地主任的遺物。施工中，請勿靠近。" },
};

// 隨機名字：稀有以上叫「○○之＋短名」
const RARE_NAMES = ["社畜", "加班狂", "外送員", "失眠者", "禿頭勇者", "深淵", "午夜", "墜星", "打工仔", "零星", "前男友", "房東", "末班車", "便利商店"];

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const randIn = (a, b, dec = 0) => { const k = 10 ** dec; return Math.round((a + Math.random() * (b - a)) * k) / k; };
let uidN = 0;
const uid = () => Date.now().toString(36) + (uidN++).toString(36);
const weighted = (w) => { const ks = Object.keys(w); let x = Math.random() * ks.reduce((s, k) => s + w[k], 0); for (const k of ks) if ((x -= w[k]) < 0) return k; return ks[0]; };

/** 物品等級允許的副屬性層級數（從 T5 往上數）。角色滿級 100。 */
export const tiersFor = (ilvl) => (ilvl >= 80 ? 5 : ilvl >= 60 ? 4 : ilvl >= 40 ? 3 : ilvl >= 20 ? 2 : 1);
/** 主屬性隨物品等級成長（緩和版：每級 +2%，物品等級 100 約 3 倍） */
export const growth = (ilvl) => 1 + 0.02 * (ilvl - 1);
/** 強化：每 +1 主屬性 +5%（第 2 批改成 +25 制） */
export const plusMul = (p) => 1 + 0.05 * (p ?? 0);

/** 抽稀有度。mf 是掉寶率加成（%），會加重精良以上。minR 是保底。 */
export function rollRarity(mf = 0, minR = 0) {
  const w = RARITY.map((r, i) => (i < minR ? 0 : r.weight * (i >= R.fine ? 1 + mf / 100 : 1)));
  if (w.every((x) => !x)) return minR;
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i;
  return minR;
}

function rollSub(id, ilvl) {
  const S = STATS[id], n = tiersFor(ilvl);
  const w = [1, 0.55, 0.3, 0.16, 0.08].slice(0, n);   // T5 最常見，越高越難出
  let x = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
  while ((x -= w[k]) >= 0 && k < n - 1) k++;
  const tier = 5 - k, [a, b] = S.t[tier - 1];
  return { id, tier, v: randIn(a, b, S.dec ?? 0) };
}
/** 副屬性：不會跟主屬性或彼此重複 */
function rollSubs(count, ilvl, mainId, must) {
  const pool = Object.keys(STATS).filter((id) => id !== mainId && id !== must);
  const out = must ? [rollSub(must, ilvl)] : [];
  while (out.length < count && pool.length) out.push(rollSub(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], ilvl));
  return out;
}

/** 主屬性：{ id, v }（v 是物品等級和稀有度算好的數值，強化另外乘） */
function rollMain(b, kind, ilvl, rarity) {
  const g = growth(ilvl) * RARITY[rarity].mult;
  if (b.atk) return { id: "atk", v: Math.round(b.atk * g) };
  if (b.hp) return { id: "hp", v: Math.round(b.hp * g) };
  const id = weighted(MAIN_POOL[kind]), S = STATS[id], d = S.dec ?? 0;
  return { id, v: Number((S.main * g).toFixed(d)) };
}

/** 工坊的重鑄：把第 i 條副屬性換成另一種（不跟主屬性、其他條重複），層級照物品等級重抽。回傳新的副屬性。 */
export function rerollAffix(item, i) {
  const have = new Set([item.main?.id, ...item.affixes.map((a) => a.id)]);
  const pool = Object.keys(STATS).filter((id) => !have.has(id));
  const a = rollSub(pool.length ? pick(pool) : item.affixes[i].id, item.ilvl);
  item.affixes[i] = a;
  return a;
}

/** 產生一件物品。opts.kind / opts.base 指定部位或底材；opts.noJunk 不出純垃圾。 */
export function makeItem(ilvl, rarity, opts = {}) {
  ilvl = Math.max(1, Math.round(ilvl));
  if (rarity === R.legend && !opts.base) {
    const ids = Object.keys(UNIQUES).filter((u) => !opts.kind || UNIQUES[u].kind === opts.kind);
    if (ids.length) return makeUnique(opts.unique ?? pick(ids), ilvl);
  }
  // 純垃圾：一般掉落（沒指定部位、普通稀有度）有一定機率
  if (rarity === R.common && !opts.kind && !opts.base && !opts.noJunk && Math.random() < JUNK_CHANCE) {
    const j = pick(JUNK);
    return { uid: uid(), junk: j.id, kind: "junk", name: j.name, icon: j.icon, rarity, ilvl, main: null, affixes: [] };
  }
  let baseId = opts.base;
  if (!baseId) {
    const ids = Object.keys(BASES).filter((id) => BASES[id].lv <= ilvl && (!opts.kind || BASES[id].kind === opts.kind));
    baseId = pick(ids);
    // 同一部位裡，越新的底材越常出現
    const better = ids.filter((id) => BASES[id].kind === BASES[baseId].kind && BASES[id].lv > BASES[baseId].lv);
    if (better.length && Math.random() < 0.5) baseId = pick(better);
  }
  const b = BASES[baseId], [s0, s1] = RARITY[rarity].subs;
  const main = rollMain(b, b.kind, ilvl, rarity);
  const affixes = rollSubs(s0 + Math.floor(Math.random() * (s1 - s0 + 1)), ilvl, main.id, b.sub);
  const item = { uid: uid(), base: baseId, kind: b.kind, icon: b.icon, rarity, ilvl, main, affixes, plus: 0 };
  item.name = nameFor(item, rarity >= R.rare ? pick(RARE_NAMES) : null);
  return item;
}

export function makeUnique(id, ilvl) {
  const u = UNIQUES[id];
  const main = rollMain(u, u.kind, ilvl, R.legend);
  return { uid: uid(), unique: id, kind: u.kind, icon: u.icon, rarity: R.legend, ilvl, main, affixes: rollSubs(4, ilvl, main.id), plus: 0, name: u.name };
}

/** 物品名稱：普通＝底材名；精良＝「主屬性的形容詞＋的＋短名」；稀有以上＝「隨機名字之短名」。 */
const MAIN_ADJ = { atk: "鋒利", atkPct: "鋒利", hp: "結實", hpPct: "結實", crit: "精準", critDmg: "殘暴", skill: "魔力", ult: "星爆", charge: "共鳴", leech: "嗜血", move: "疾風" };
export function nameFor(item, rareName) {
  if (item.unique) return UNIQUES[item.unique].name;
  const b = BASES[item.base];
  if (item.rarity === R.fine) return (MAIN_ADJ[item.main.id] ?? MAIN_ADJ[item.affixes[0]?.id] ?? "精良") + "的" + b.short;
  if (item.rarity >= R.rare) return (rareName ?? "零星") + "之" + b.short;
  return b.name;
}

/** 主屬性目前的數值（含強化） */
export function mainValue(item) {
  if (!item.main) return 0;
  const S = STATS[item.main.id], v = item.main.v * plusMul(item.plus);
  return S.pct ? Number(v.toFixed(S.dec ?? 1)) : Math.round(v);
}

/** 一開始身上的裝備：鏽色星核＋麻布衣，沒有副屬性。 */
export function starterGear() {
  const core = makeItem(1, R.common, { base: "sword1" });
  core.affixes = [];
  const shell = makeItem(1, R.common, { base: "body1" });
  shell.affixes = [];
  return { weapon: core, body: shell };
}

/** 一件物品的說明（給背包詳細欄位用）：[種類, 屬性 id, 文字, 標籤] */
export function describe(item) {
  const lines = [];
  if (item.main) lines.push(["main", item.main.id, fmtStat(item.main.id, mainValue(item)), item.plus ? "+" + item.plus : ""]);
  for (const a of item.affixes) {
    const S = STATS[a.id], perfect = a.tier === 1 && a.v === S.t[0][1];
    lines.push([perfect ? "perfect" : "affix", a.id, fmtStat(a.id, a.v), "T" + a.tier]);
  }
  if (item.unique) lines.push(["unique", null, UNIQUES[item.unique].text]);
  return lines;
}

export const kindLabel = (item) => KIND_NAME[item.kind];
export const rarityOf = (item) => RARITY[item.rarity];
