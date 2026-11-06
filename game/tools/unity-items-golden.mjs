// Unity 轉移：裝備產生與數值計算的比對（網頁版這一邊）。固定種子產生 3000 件裝備、算 500 組穿搭的數值，
// 寫到 unity/Golden/web/items.txt；Unity 執行 ZeroStar.Tests.ItemsTest.Run 寫 unity/Golden/unity/items.txt；
// 比對：node game/tools/unity-items-golden.mjs --compare
import { installDom } from "./unity/node-dom.mjs";
installDom();
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const G = join(ROOT, "unity", "Golden");

if (process.argv.includes("--compare")) {
  const A = readFileSync(join(G, "web", "items.txt"), "utf8").trim().split("\n"), B = readFileSync(join(G, "unity", "items.txt"), "utf8").trim().split("\n");
  let bad = 0;
  if (A.length !== B.length) { console.log(`✗ 行數不同：網頁 ${A.length}、Unity ${B.length}`); bad++; }
  for (let i = 0; i < Math.min(A.length, B.length) && bad < 5; i++) {
    const a = A[i].split("|"), b = B[i].split("|");
    const same = a.length === b.length && a.every((x, k) => x === b[k] || (x !== "" && b[k] !== "" && !isNaN(+x) && !isNaN(+b[k]) && +x === +b[k]));
    if (!same) { bad++; console.log(`✗ 第 ${i + 1} 行不一樣：\n  網頁  ${A[i]}\n  Unity ${B[i]}`); }
  }
  console.log(bad ? `有差異` : `✓ ${A.length} 行（裝備與數值）完全一樣`);
  process.exit(bad ? 1 : 0);
}

let rs = 777;
Math.random = () => { rs = (rs + 0x6d2b79f5) | 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const I = await import("../src/items.js");
const { computeStats } = await import("../src/stats.js");

const lines = [];
const fmt = (it) => [it.base ?? "", it.kind, it.icon, it.name, it.rarity, it.ilvl, it.main ? `${it.main.id}` : "", it.main ? it.main.v : "", it.affixes.map((a) => `${a.id}:${a.tier}`).join(","), ...it.affixes.map((a) => a.v), "/", it.unique ?? "", it.myth ?? "", it.set ?? "", it.junk ?? "", I.mainValue(it), I.coreOf(it)?.id ?? "", I.coreOf(it)?.tier ?? "", I.coreOf(it)?.x ?? ""].join("|");
const KINDS = [null, "weapon", "head", "body", "hands", "feet", "acc"];
const items = [];
for (let n = 0; n < 3000; n++) {
  const ilvl = 1 + Math.floor(Math.random() * 100) + Math.random();
  const mode = n % 6;
  let r = mode < 3 ? I.rollRarity(Math.floor(Math.random() * 60), n % 4 === 0 ? 1 : 0) : n % 6;
  const kind = KINDS[n % KINDS.length];
  const it = I.makeItem(ilvl, r, kind ? { kind } : {});
  it.plus = n % 7 === 0 ? Math.floor(Math.random() * 51) : 0;
  items.push(it);
  lines.push(fmt(it));
}
// 穿搭：每格從產生的裝備裡挑一件同部位的（或空著）
const bySlot = { weapon: [], head: [], body: [], hands: [], feet: [], acc: [] };
for (const it of items) if (bySlot[it.kind]) bySlot[it.kind].push(it);
const SLOT_KIND = [["weapon", "weapon"], ["head", "head"], ["body", "body"], ["hands", "hands"], ["feet", "feet"], ["acc1", "acc"], ["acc2", "acc"]];
for (let n = 0; n < 500; n++) {
  const equip = {};
  for (const [slot, kind] of SLOT_KIND) { const k = Math.floor(Math.random() * (bySlot[kind].length + 1)); equip[slot] = k < bySlot[kind].length ? bySlot[kind][k] : null; }
  const lv = 1 + Math.floor(Math.random() * 100);
  const s = computeStats(equip, lv);
  lines.push(["S", lv, s.atk, s.maxHp, s.def, s.crit, s.critDmg, s.skill, s.ult, s.charge, s.cdr, s.leech, s.move, s.mf, [...s.uniques].join(","), Object.entries(s.sets).map(([k, v]) => k + ":" + v).join(","), s.core?.id ?? "", s.core?.tier ?? "", s.core?.x ?? ""].join("|"));
}
mkdirSync(join(G, "web"), { recursive: true });
writeFileSync(join(G, "web", "items.txt"), lines.join("\n") + "\n");
console.log(`網頁版：${lines.length} 行 → unity/Golden/web/items.txt`);
