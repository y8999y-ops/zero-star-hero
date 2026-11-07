// Unity 轉移：把網頁版「載入時算好的東西」原封不動匯出成資料，給 Unity 直接用（保證每個像素跟網頁版一樣）。
//   場景（每一關的遊玩層、各圖層、光源）、主角每個姿勢的像素、烘焙好的動畫（史萊姆、火把、煙、刀光）、連段數值。
// 執行：node --no-use-std-math-pow game/tools/unity-export.mjs（1-2、1-3 的場景再各跑一次：STAGE=1-2 …）→ 寫到 unity/Assets/Resources/Baked/（.bytes 是 gzip 壓過的二進位）
// 改了網頁版的美術或數值之後重跑一次，Unity 就會用新的。
import { installDom } from "./unity/node-dom.mjs";
installDom();
// STAGE=1-2 這樣跑：只匯出那一關的場景（其他資料每關都一樣）
const ONLY_STAGE = process.env.STAGE;
globalThis.sessionStorage = { getItem: (k) => (k === "zero-hero-stage" ? ONLY_STAGE ?? null : null), setItem() {}, removeItem() {} };
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
if (ONLY_STAGE) process.exit(0);

// ---- 2. 主角的姿勢（五個形態 × 每個姿勢）
{
  const names = [];
  for (const [k, v] of Object.entries(POSES)) {
    if (Array.isArray(v)) v.forEach((q, i) => names.push([`${k}#${i}`, q]));
    else names.push([k, v]);
  }
  names.push(["portrait", { eyes: "squint", look: 1, core: 2 }]);   // 大招特寫帶的臉（ult.js 的 PORTRAIT）
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

// ---- 3. 烘焙好的動畫（五個形態的連段招式＝slashAnim(招式, 形態)）
const { BAKED_COMBOS } = await import("../src/player.js");
const { FORMS } = await import("../src/forms.js");
const comboKeys = {};   // 形態 → [{ anim 名稱, 招式 }]
{
  const anims = {
    // 遊戲裡烘焙好的動畫（assets.js 的 A）全部匯出
    ...Object.fromEntries(Object.entries(A).filter(([k, v]) => v?.frames).map(([k, v]) => [k, v])),
    slash0: A.slash[0], slash1: A.slash[1], slash2: A.slash[2],
  };
  // 1-4 的王（boss.js 的 prepareBoss）：每個姿勢一組，名稱 boss:姿勢；fps 0、duration＝每張的秒數（0＝照 k 選張）
  const { prepareBoss } = await import("../src/boss.js");
  for (const [pose, b] of Object.entries(prepareBoss())) anims["boss:" + pose] = { fps: 0, loop: false, duration: b.dt ?? 0, frames: b.frames };
  // 碎星鎮的居民、路人（npcs.js）：npc:id（待機）、npc:id:walk（走路）
  const { npcAnim, NPC_IDS } = await import("../src/npcs.js");
  for (const id of NPC_IDS) { anims["npc:" + id] = npcAnim(id); anims["npc:" + id + ":walk"] = npcAnim(id, true); }
  for (const [form, F] of Object.entries(FORMS)) {
    comboKeys[form] = BAKED_COMBOS.COMBO_DEF[F.combo].map((s, i) => { const n = `atk:${form}:${i}`; anims[n] = slashAnim(s.mod, form); return n; });
  }
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

// ---- 4. 連段數值（player.js 的 COMBO_DEF，五個形態）：前搖、命中時間、停頓、推力；技能的時間與速度
{
  const forms = {};
  for (const [form, F] of Object.entries(FORMS)) {
    forms[form] = BAKED_COMBOS.COMBO_DEF[F.combo].map((s, i) => ({
      anim: comboKeys[form][i], wind: s.wind, cancel: s.cancel, end: s.end, dmg: s.dmg, reach: s.reach, back: s.back, launch: !!s.launch, big: !!s.big,
      start: Math.min(0, ...s.mod.act.poses.map(([t]) => (t < 0 ? t * s.wind : 0))),
      hits: s.mod.act.hits.map((h) => ({ t: h.t, stop: h.stop ?? -1, push: h.push ?? -1, amp: h.amp ?? -1 })),
    }));
  }
  const { COMBO_DEF, ...k } = BAKED_COMBOS;
  const list = Object.entries(forms).map(([form, steps]) => ({ form, skill: FORMS[form].skill, steps }));
  writeFileSync(join(OUT, "combos.json"), JSON.stringify({ forms: list, ...k }, null, 1));
  console.log("  combos.json");
}
// ---- 4b. 技能樹的節點（形態、id、最高級）
{
  const { TREES } = await import("../src/skilltree.js");
  const nodes = Object.entries(TREES).flatMap(([form, list]) => list.map((n) => ({ form, id: n.id, max: n.max, path: n.path, name: n.name })));
  writeFileSync(join(OUT, "tree.json"), JSON.stringify({ nodes }, null, 1));
  console.log("  tree.json");
}
// ---- 4c. 物品圖示（icons.js：每個 ICON_SIZE×ICON_SIZE，hex 顏色或空）
{
  const { ICONS, ICON_SIZE } = await import("../src/icons.js");
  const { hex } = await import("../../pixelfx/src/core/index.js");
  const w = new W();
  w.str("ZIC1").i32(ICON_SIZE).i32(Object.keys(ICONS).length);
  for (const [name, cells] of Object.entries(ICONS)) w.str(name).u32(Uint32Array.from(cells, (c) => (c ? hex(c) >>> 0 : 0)));
  w.save("icons.bytes");
}
// ---- 4d. 關卡流程（stages.js：事件、怪物擺放、祭壇、金幣堆、機關）＋寶箱等級
{
  const { STAGES } = await import("../src/stage.js");
  const { CHEST_TIERS } = await import("../src/chest-tiers.js");
  writeFileSync(join(OUT, "stages.json"), JSON.stringify({ stages: STAGES, chestTiers: CHEST_TIERS }, null, 1));
  console.log("  stages.json");
}
// ---- 4f. 碎星鎮（town.js）：載入時畫好的圖層（遠景、中景、街道、前景）、會發光的像素、光源
{
  const T = await import("../src/town.js"), b = T.BAKED_TOWN(), w = new W();
  w.str("ZTN1").i32(T.TOWN_W).i32(b.FAR_W).i32(b.MID_W).i32(b.FG_W);
  w.u32(b.FAR).u32(b.MID).u32(b.MAIN).u32(b.FG).u8(b.EMIT);
  w.i32(b.LIGHTS.length); for (const [x, y, r, lv, col] of b.LIGHTS) w.f64(x).f64(y).f64(r).f64(lv).str(col);
  w.save("town.bytes");
}
// ---- 4e. 選關世界地圖（worldmap-art.js）：不會動的底圖（bakeBase）、地點、路（一串點）
{
  const WA = await import("../src/worldmap-art.js");
  const w = new W();
  w.str("ZWM1").i32(WA.WM_W).i32(WA.WM_H).i32(WA.LMY).u32(WA.bakeBase());
  const ids = Object.keys(WA.NODES);
  w.i32(ids.length); for (const id of ids) w.str(id).f64(WA.NODES[id].x).f64(WA.NODES[id].y);
  w.i32(WA.segs.length); for (const s of WA.segs) { w.str(s.a).str(s.b).i32(s.pts.length); for (const [x, y] of s.pts) w.f64(x).f64(y); }
  w.save("worldmap.bytes");
}
// ---- 5. 比對測試的那串按鍵（輸出的遊戲用 -shot 自動玩時讀這份）
writeFileSync(join(OUT, "trace-script.json"), readFileSync(join(ROOT, "game", "tools", "unity-trace-script.json")));
console.log("  trace-script.json");
console.log("匯出完成：" + OUT);
