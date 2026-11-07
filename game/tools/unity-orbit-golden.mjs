// Unity 轉移：背包左欄主角圖（heroorbit.js＋heroaura.js＋inventory.js 的 drawHero）的比對，網頁版這一邊。
// 幾組 t／spin／裝備顏色／吸收的形態／星星形態，照 drawHero 畫出 113×104，composite（背景 null、光 0.6）存成 RGBA，
// 寫到 unity/Golden/orbit-web/（含 manifest.json）；Unity 執行 PixelFX.Tests.Golden.RunOrbit 寫 unity/Golden/orbit-unity/。
// 執行：node --no-use-std-math-pow game/tools/unity-orbit-golden.mjs
// 比對：node game/tools/unity-orbit-golden.mjs --compare
import { installDom } from "./unity/node-dom.mjs";
installDom();
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const G = join(ROOT, "unity", "Golden"), WEB = join(G, "orbit-web"), UNI = join(G, "orbit-unity");
const OW = 113, OH = 104;

if (process.argv.includes("--compare")) {
  const manifest = JSON.parse(readFileSync(join(WEB, "manifest.json"), "utf8"));
  let bad = 0;
  for (const c of manifest) {
    const f = `${c.name}.bin`, u = join(UNI, f);
    if (!existsSync(u)) { console.log(`✗ ${f}  Unity 沒有輸出這個檔`); bad++; continue; }
    const a = readFileSync(join(WEB, f)), b = readFileSync(u);
    if (a.length !== b.length) { console.log(`✗ ${f}  長度不同：網頁 ${a.length}、Unity ${b.length}`); bad++; continue; }
    let d = 0, first = -1;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) { d++; if (first < 0) first = i / 4; }
    if (d) { bad++; console.log(`✗ ${f}  ${d} 個像素不同（第一個在 x=${first % OW}, y=${Math.floor(first / OW)}）`); }
    else console.log(`✓ ${f}  0 個像素不同`);
  }
  console.log(bad ? `有 ${bad} 組不一樣` : `✓ ${manifest.length} 組全部一樣`);
  process.exit(bad ? 1 : 0);
}

const { createFrame, composite } = await import("../../pixelfx/src/core/index.js");
const { paintStar, POSES } = await import("../src/star.js");
const { drawOrbit, blit2x } = await import("../src/heroorbit.js");
const { drawAura } = await import("../src/heroaura.js");
const { FORMS } = await import("../src/forms.js");
const { RARITY } = await import("../src/items.js");

const RC = RARITY.map((r) => r.color);
const CASES = [
  { name: "empty-star", t: 0, spin: 0, slots: [null, null, null, null, null, null, null], aura: [], form: "star" },
  { name: "mix-star", t: 1.25, spin: 0.3, slots: [RC[0], null, RC[1], RC[2], null, RC[3], RC[4]], aura: [{ id: "slime", n: 1 }], form: "star" },
  { name: "all-slime", t: 3.7, spin: 1.1, slots: [RC[5], RC[4], RC[3], RC[2], RC[1], RC[0], RC[5]], aura: [{ id: "slime", n: 2 }, { id: "bat", n: 4 }, { id: "can", n: 7 }], form: "slime" },
  { name: "three-bat", t: 12.345, spin: 2.7, slots: [RC[2], RC[2], null, null, RC[4], null, RC[1]], aura: [{ id: "slime", n: 6 }, { id: "bat", n: 1 }, { id: "spike", n: 3 }], form: "bat" },
  { name: "spike-can", t: 47.9, spin: 5.9, slots: [null, RC[3], null, RC[5], null, RC[0], null], aura: [{ id: "spike", n: 2 }, { id: "can", n: 1 }], form: "can" },
  { name: "late-bat", t: 123.456, spin: 8.64, slots: [RC[4], RC[4], RC[4], RC[4], RC[4], RC[4], RC[4]], aura: [{ id: "bat", n: 9 }], form: "bat" },
  { name: "half-slime", t: 0.6, spin: 0.042, slots: [RC[1], null, RC[1], null, RC[1], null, RC[1]], aura: [{ id: "slime", n: 3 }, { id: "bat", n: 2 }, { id: "spike", n: 1 }], form: "slime" },
];
// 再補一組每 0.05 秒一格的短動畫（看動態的地方都對）
for (let i = 0; i < 12; i++) CASES.push({ name: `anim-${i}`, t: 5 + i * 0.05, spin: 0.35 + i * 0.0035, slots: [RC[0], RC[2], null, RC[4], RC[5], null, RC[3]], aura: [{ id: "slime", n: 4 }, { id: "bat", n: 3 }, { id: "can", n: 2 }], form: ["star", "slime", "bat"][i % 3] });

const ORB = { cx: 56, cy: 50, rx: 47, ry: 41, feet: 70, slots: [] };
const of = createFrame(OW, OH), sf = createFrame(48, 64), out = new Uint8ClampedArray(OW * OH * 4);
mkdirSync(WEB, { recursive: true });
for (const c of CASES) {
  const { t, spin } = c;
  ORB.slots = c.slots.map((col, i) => ({ a: -Math.PI / 2 + (i / 7) * Math.PI * 2 + spin, col, id: i }));
  of.color.fill(0); of.light.fill(0); sf.color.fill(0); sf.light.fill(0);
  drawOrbit(of, t, ORB, "back");
  const ao = { cx: ORB.cx, cy: ORB.cy + 4, k: 1.3, colors: Object.fromEntries(Object.entries(FORMS).map(([k, v]) => [k, v.color])) };
  drawAura(of, t, ao, c.aura, "back");
  paintStar(sf, 24, 50, POSES.stand, false, { glow: 0, form: c.form });
  blit2x(of, sf, ORB.cx, ORB.feet + 28 + Math.round(Math.sin(t * 2.5)));
  drawAura(of, t, ao, c.aura, "front");
  drawOrbit(of, t, ORB, "front");
  composite(of, out, null, 0.6);
  writeFileSync(join(WEB, `${c.name}.bin`), Buffer.from(out.buffer, out.byteOffset, out.byteLength));
}
writeFileSync(join(WEB, "manifest.json"), JSON.stringify(CASES, null, 1));
console.log(`網頁版：${CASES.length} 組 → unity/Golden/orbit-web/（std pow：${process.execArgv.includes("--no-use-std-math-pow") ? "關" : "開"}）`);
