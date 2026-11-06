// Unity 轉移：把網頁版「載入時算好的東西」原封不動匯出成資料，給 Unity 直接用（保證每個像素跟網頁版一樣）。
//   場景（1-1 的遊玩層、各圖層、光源）、主角每個姿勢的像素、烘焙好的動畫（史萊姆、火把、煙、刀光）、連段數值。
// 執行：node game/tools/unity-export.mjs   → 寫到 unity/Assets/Resources/Baked/（.bytes 是 gzip 壓過的二進位）
// 改了網頁版的美術或數值之後重跑一次，Unity 就會用新的。
import { installDom } from "./unity/node-dom.mjs";
installDom();
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "unity", "Assets", "Resources", "Baked");
mkdirSync(OUT, { recursive: true });

const L = await import("../src/level.js");
const { POSES, starPixels } = await import("../src/star.js");
const { A, slashAnim } = await import("../src/assets.js");
const ATK_STAR = await import("../fx/attacks/star.js");

// ---- 小工具：二進位寫入（小端）
class W {
  constructor() { this.parts = []; }
  i32(v) { const b = Buffer.alloc(4); b.writeInt32LE(v | 0); this.parts.push(b); return this; }
  f64(v) { const b = Buffer.alloc(8); b.writeDoubleLE(v); this.parts.push(b); return this; }
  str(s) { const b = Buffer.from(s, "utf8"); this.i32(b.length); this.parts.push(b); return this; }
  u32(a) { this.i32(a.length); this.parts.push(Buffer.from(new Uint32Array(a).buffer)); return this; }
  u8(a) { this.i32(a.length); this.parts.push(Buffer.from(new Uint8Array(a).buffer)); return this; }
  img(m) { if (!m) return this.i32(0).i32(0).u32([]); return this.i32(m.w).i32(m.h).u32(Uint32Array.from(m.px, (c) => c >>> 0)); }
  save(name) { const b = gzipSync(Buffer.concat(this.parts), { level: 9 }); writeFileSync(join(OUT, name), b); console.log(`  ${name}  ${(b.length / 1024).toFixed(0)} KB`); }
}

// ---- 1. 場景
{
  const b = L.BAKED_LEVEL(), w = new W();
  w.str("ZLV1").str(L.STAGE_ID).i32(L.LEVEL_W).i32(L.MAP_H).i32(L.FLOOR).i32(b.TALL ? 1 : 0).i32(b.UH).i32(b.PIN);
  w.u32(b.PF).u8(b.PFE);
  for (const k of ["back", "far", "mid", "near", "fg"]) w.img(b.layers[k]);
  w.img(b.UP_FAR).img(b.UP_MID);
  w.i32(b.CRYSTAL_LIGHTS.length); for (const c of b.CRYSTAL_LIGHTS) w.f64(c.x).f64(c.y).f64(c.r).f64(c.lv);
  w.i32(b.PROP_LIGHTS.length); for (const c of b.PROP_LIGHTS) w.f64(c.x).f64(c.y).f64(c.r).f64(c.lv).str(c.col);
  w.i32(L.TORCH_POS.length); for (const t of L.TORCH_POS) w.f64(t.x).f64(t.y);
  w.i32(b.BIG_CRYSTALS.length); for (const c of b.BIG_CRYSTALS) w.str(c.col).f64(c.x).f64(c.y).f64(c.x0).f64(c.y0).img(c.img);
  // 地形碰撞（map.js 的矩形）
  w.i32(L.geo.solids.length); for (const r of L.geo.solids) w.f64(r.x).f64(r.y).f64(r.w).f64(r.h);
  w.i32(L.geo.platforms.length); for (const p of L.geo.platforms) w.f64(p.x).f64(p.y).f64(p.w);
  w.save(`level-${L.STAGE_ID}.bytes`);
}

// ---- 2. 主角的姿勢（五個形態 × 每個姿勢）
{
  const names = [];
  for (const [k, v] of Object.entries(POSES)) {
    if (Array.isArray(v)) v.forEach((q, i) => names.push([`${k}#${i}`, q]));
    else names.push([k, v]);
  }
  const w = new W();
  const forms = ["star", "slime", "bat", "can", "spike"];
  w.str("ZHR1").i32(names.length * forms.length);
  for (const f of forms) for (const [n, q] of names) {
    const s = starPixels(f !== "star" ? { ...q, form: f } : q);
    const px = new Uint32Array(s.W * s.H);
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) px[y * s.W + x] = s.px[y][x] >>> 0;
    w.str(`${f}:${n}`).i32(s.W).i32(s.H).i32(s.ax).i32(s.ay).f64(s.core[0]).f64(s.core[1]).f64(s.hand[0]).f64(s.hand[1]).u32(px);
  }
  w.save("hero.bytes");
}

// ---- 3. 烘焙好的動畫
{
  const anims = {
    slime: A.slime, slimeWhite: A.slimeWhite, poofSlime: A.poofSlime, brazier: A.brazier, dust: A.dust, spark: A.spark, sparkRed: A.sparkRed,
    "atk:star:0": slashAnim(ATK_STAR.jabA, "star"), "atk:star:1": slashAnim(ATK_STAR.jabB, "star"), "atk:star:2": slashAnim(ATK_STAR.spinRam, "star"),
  };
  const w = new W();
  w.str("ZAN1").i32(Object.keys(anims).length);
  for (const [n, a] of Object.entries(anims)) {
    w.str(n).i32(a.fps).i32(a.loop ? 1 : 0).f64(a.duration).i32(a.frames.length);
    for (const f of a.frames) {
      w.i32(f.w).i32(f.h).i32(f.lx).i32(f.ly);
      if (!f.w) { w.i32(0); continue; }
      w.i32(f.light ? 1 : 0).u32(f.color);
      if (f.light) w.u32(f.light);
    }
  }
  w.save("anims.bytes");
}

// ---- 4. 連段數值（player.js 的 COMBO_DEF，星星）：前搖、命中時間、停頓、推力
{
  const steps = [
    { mod: ATK_STAR.jabA, anim: "atk:star:0", wind: 0.6, cancel: 0.13, end: 0.26, dmg: [1.15], reach: 46, back: 8 },
    { mod: ATK_STAR.jabB, anim: "atk:star:1", wind: 0.6, cancel: 0.13, end: 0.26, dmg: [1.25], reach: 46, back: 8 },
    { mod: ATK_STAR.spinRam, anim: "atk:star:2", wind: 0.6, cancel: 0.3, end: 0.46, dmg: [0.9, 1.6], reach: 52, back: 30, launch: true },
  ].map((s) => ({
    anim: s.anim, wind: s.wind, cancel: s.cancel, end: s.end, dmg: s.dmg, reach: s.reach, back: s.back, launch: !!s.launch, big: !!s.big,
    start: Math.min(0, ...s.mod.act.poses.map(([t]) => (t < 0 ? t * s.wind : 0))),
    hits: s.mod.act.hits.map((h) => ({ t: h.t, stop: h.stop ?? -1, push: h.push ?? -1, amp: h.amp ?? -1 })),
  }));
  writeFileSync(join(OUT, "combo-star.json"), JSON.stringify({ steps }, null, 1));
  console.log("  combo-star.json");
}
// ---- 5. 比對測試的那串按鍵（輸出的遊戲用 -shot 自動玩時讀這份）
writeFileSync(join(OUT, "trace-script.json"), readFileSync(join(ROOT, "game", "tools", "unity-trace-script.json")));
console.log("  trace-script.json");
console.log("匯出完成：" + OUT);
