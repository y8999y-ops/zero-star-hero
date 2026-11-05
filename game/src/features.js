// 形態機關＋一次性資源（8d，docs/關卡與星核改版企劃.md 3.3、第 4 章）。資料寫在 stage.js 每一關的 features：
//   { t: "crack", x, y, h }    裂開的垃圾牆：鐵罐星衝撞撞破（擋路的實心，破了記在存檔，之後都是破的）
//   { t: "wind", x, y, w, h }  深淵氣流：蝠翼星按住跳滑翔時，在裡面會被往上吹
//   { t: "shroom", x, y }      黏液菇：可以站；黏液星踩上去彈很高
//   { t: "seal", x, y, h }     星光封印：擋路的石門，星星的星屑彈打中會亮起來、打開（記在存檔）
//   { t: "ember", x, y }       星之殘火：最大魔力 +10
//   { t: "vein", x, y }        星塵礦脈：打三下碎掉，一大包星塵
//   { t: "fossil", x, y, form } 魔物化石核：那個形態 +1 技能點（還沒有那個形態就給目前的形態）
//   { t: "safe", x, y }        被丟下來的寶箱：碰到打開，掉稀有以上的裝備和金幣
//   { t: "stele", x, y, i }    星王的碑文：讀一段星王的故事
// 拿過、打開過的都記在 profile.found[關卡][編號]，重進關卡也不會再出現（規則：一次性）。
// (x, y)＝底部中心（貼地）。畫在 feature-art.js。
import { setSolid, geo } from "./map.js";
import { input } from "./input.js";
import { FORMS } from "./forms.js";
import { drawCrack, drawWind, drawShroom, drawSeal, drawEmber, drawVein, drawFossil, drawSafe, drawStele } from "./feature-art.js";

// 碑文的故事（接神話「星王之冠」）：每關一段一段讀
export const STELE_LORE = [
  "碑文：「很久很久以前，天上有九顆最亮的星星。祂們之中最亮的那一顆，被稱為星王。」",
  "碑文：「星王為了照亮深淵，自己墜落了下來。祂碎成了很多很多片，散落在這片土地上。」",
  "碑文：「每一片碎片都記得自己曾經是星王的一部分。……總有一天，它們會再聚在一起。」",
  "碑文：「如果你讀得懂這些字，那你也是那些碎片之一。歡迎回來。」",
];
const HINT = {
  crack: "系統：這面牆裂開了……需要很硬、很重的東西撞過去。鐵罐星的衝撞應該可以。",
  wind: "系統：底下有風往上吹。用蝠翼星滑翔（在空中按住跳）的話，應該會被吹上去。",
  shroom: "系統：黏糊糊的菇。黏液星踩上去說不定會彈很高——同類嘛。",
  seal: "系統：門上刻著一顆星。……星星的光，星屑彈打打看？",
};

export function createFeatures({ stageId, list = [], profile, player, api }) {
  profile.found ??= {};
  const found = (profile.found[stageId] ??= {});
  const hinted = new Set();
  const items = list.map((f, i) => ({ ...f, id: f.t + i, hp: 3, t0: Math.random() * 9, open: 0, lit: 0, squash: 0, cd: 0, done: !!found[f.t + i] }));
  // 擋路的實心：裂牆、封印門
  const box = (f) => (f.t === "crack" ? { x: f.x - 16, y: f.y - (f.h ?? 48), w: 32, h: f.h ?? 48 } : f.t === "seal" ? { x: f.x - 12, y: f.y - (f.h ?? 48), w: 24, h: f.h ?? 48 } : null);
  for (const f of items) {
    const b = box(f);
    if (b && !f.done) setSolid(b, true);
    if (f.t === "seal" && f.done) f.open = 1;
    if (f.t === "shroom") { f.plat = { x: f.x - 11, y: f.y - 15, w: 22 }; geo.platforms.push(f.plat); }
  }
  const near = (f, rx, ry) => Math.abs(player.x - f.x) < rx && player.y > f.y - ry && player.y < f.y + 6;
  const hint = (f) => { if (hinted.has(f.t) || !HINT[f.t]) return; hinted.add(f.t); api.say(HINT[f.t], 3.4); };
  const take = (f) => { f.done = true; found[f.id] = 1; api.save(); };

  function update(dt) {
    for (const f of items) {
      f.cd -= dt;
      if (f.t === "crack" && !f.done) {
        if (near(f, 30, (f.h ?? 48) + 10)) {
          if (player.form === "can" && player.state === "charge") {
            setSolid(box(f), false); take(f);
            api.burst(f.x, f.y - (f.h ?? 48) / 2, "crack");
          } else if (Math.abs(player.x - f.x) < 26) hint(f);
        }
      } else if (f.t === "wind") {
        const inside = Math.abs(player.x - f.x) < f.w / 2 && player.y < f.y && player.y > f.y - f.h;
        if (inside && !player.grounded) {
          if (player.form === "bat" && input.jumpHeld) player.vy = Math.max(-170, player.vy - 1500 * dt);   // 滑翔的時候被吹上去
          else hint(f);
        }
      } else if (f.t === "shroom") {
        f.squash = Math.max(0, f.squash - dt * 4);
        const on = player.grounded && Math.abs(player.y - f.plat.y) < 1 && player.x >= f.plat.x - 2 && player.x <= f.plat.x + f.plat.w + 2;
        if (on && player.form === "slime" && f.cd <= 0) { player.vy = -560; player.boostT = 0.6; player.grounded = false; player.y -= 1; f.squash = 1; f.cd = 0.3; api.boing(f.x, f.plat.y); }
        else if (on) hint(f);
      } else if (f.t === "seal") {
        if (f.lit > 0 && f.open < 1) { f.lit = Math.min(1, f.lit + dt * 2); if (f.lit >= 1) f.open = Math.min(1, f.open + dt * 1.2); if (f.open >= 1) { setSolid(box(f), false); take(f); } }
        else if (!f.done && f.lit === 0 && Math.abs(player.x - f.x) < 30 && Math.abs(player.y - f.y) < 40) hint(f);
      } else if (f.done) continue;
      else if (f.t === "ember" && near(f, 10, 22)) {
        take(f); profile.mpBonus = (profile.mpBonus ?? 0) + 10; api.refresh();
        api.burst(f.x, f.y - 10, "ember"); api.toast(`星之殘火：最大魔力 +10（${100 + profile.mpBonus}）。你墜落時散掉的一小塊自己，撿回來了。`, 3);
      } else if (f.t === "fossil" && near(f, 14, 16)) {
        const form = profile.forms.owned[f.form] ? f.form : profile.forms.cur;
        profile.forms.owned[form].pts = (profile.forms.owned[form].pts ?? 0) + 1;
        take(f); api.burst(f.x, f.y - 8, "fossil"); api.toast(`魔物化石核：${FORMS[form].name} 技能點 +1。很久以前的魔物核，變成化石了還吸收得到。`, 3.2);
      } else if (f.t === "safe" && near(f, 16, 22) && player.grounded) {
        take(f); api.loot(f.x, f.y - 12); api.burst(f.x, f.y - 10, "safe"); api.toast("被丟下來的寶箱：上面的世界丟了一個保險箱下來……沒鎖。", 2.8);
      } else if (f.t === "stele" && near(f, 14, 34)) {
        take(f); profile.lore = (profile.lore ?? 0) + 1;
        api.say(STELE_LORE[(f.i ?? 0) % STELE_LORE.length], 5); api.burst(f.x, f.y - 20, "stele");
      }
    }
  }
  /** 攻擊範圍打到礦脈：每下間隔 0.25 秒，3 下碎掉 */
  function hit(b) {
    for (const f of items) {
      if (f.t !== "vein" || f.done || f.cd > 0) continue;
      if (b.x1 < f.x - 14 || b.x0 > f.x + 14 || b.y1 < f.y - 18 || b.y0 > f.y) continue;
      f.cd = 0.25; f.hp--; api.clink(f.x, f.y - 8);
      if (f.hp <= 0) { take(f); const n = 60 + Math.floor(Math.random() * 61); profile.scrap += n; api.burst(f.x, f.y - 8, "vein"); api.toast(`星塵礦脈：星塵 +${n}`, 2.4); }
    }
  }
  /** 技能彈飛到封印門：星星的星屑彈會點亮；回傳 true＝彈打到門了（要爆開） */
  function shotAt(x, y, form) {
    for (const f of items) {
      if (f.t !== "seal" || f.open >= 1) continue;
      const b = box(f);
      if (x < b.x - 2 || x > b.x + b.w + 2 || y < b.y || y > b.y + b.h) continue;
      if (form === "star" && f.lit === 0) { f.lit = 0.01; api.burst(f.x, f.y - (f.h ?? 48) / 2, "seal"); }
      else if (form !== "star") hint(f);
      return true;
    }
    return false;
  }
  function draw(frame, t) {
    for (const f of items) {
      const tt = t + f.t0;
      if (f.t === "crack" && !f.done) drawCrack(frame, f.x, f.y, f.hp >= 3 ? 1 : 0.4, tt, f.h ?? 48);
      else if (f.t === "wind") drawWind(frame, f.x, f.y, f.w, f.h, tt);
      else if (f.t === "shroom") drawShroom(frame, f.x, f.y, f.squash, tt);
      else if (f.t === "seal" && f.open < 1) drawSeal(frame, f.x, f.y, f.lit, Math.max(0, f.open), tt, f.h ?? 48);
      else if (f.t === "ember" && !f.done) drawEmber(frame, f.x, f.y, tt);
      else if (f.t === "vein" && !f.done) drawVein(frame, f.x, f.y, 3 - f.hp, tt);
      else if (f.t === "fossil" && !f.done) drawFossil(frame, f.x, f.y, tt, FORMS[f.form]?.color);
      else if (f.t === "safe") drawSafe(frame, f.x, f.y, f.done, tt);
      else if (f.t === "stele") drawStele(frame, f.x, f.y, f.done, tt);
    }
  }
  function lights(list) {
    for (const f of items) {
      if (f.t === "ember" && !f.done) list.push({ x: f.x, y: f.y - 10, r: 40, lv: 1.8, col: "#ffd060" });
      else if (f.t === "seal" && f.lit > 0 && f.open < 1) list.push({ x: f.x, y: f.y - 24, r: 60 * f.lit, lv: 2, col: "#ffe066" });
      else if (f.t === "fossil" && !f.done) list.push({ x: f.x, y: f.y - 8, r: 24, lv: 1, col: FORMS[f.form]?.color ?? "#b878ff" });
      else if (f.t === "vein" && !f.done) list.push({ x: f.x, y: f.y - 10, r: 28, lv: 1.2, col: "#4cd8ec" });
      else if (f.t === "stele" && f.done) list.push({ x: f.x, y: f.y - 18, r: 30, lv: 1, col: "#ffe066" });
    }
  }
  return { items, update, hit, shotAt, draw, lights };
}
