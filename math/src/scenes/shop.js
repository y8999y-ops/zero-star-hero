// 學院商店（企劃書 3.7、8.8）：用晶幣買帽子顏色、斗篷顏色、宿舍家具。買了的外觀可以隨時換。
// 外觀會畫在主角身上（fx/hero.js 的 OUTFIT），家具擺在宿舍房間（scenes/dorm.js）。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { writeSave } from "../save.js";
import { OUTFIT } from "../../fx/hero.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { ATTRS } from "../data.js";

export const SHOP = {
  hat: [
    { id: "h_night", name: "星夜藍帽", color: "#2a3a8a", price: 30 },
    { id: "h_sakura", name: "櫻花粉帽", color: "#f08ab0", price: 30 },
    { id: "h_gold", name: "金色帽", color: "#e8b830", price: 60 },
    { id: "h_silver", name: "白銀帽", color: "#c8d0e0", price: 60 },
    { id: "h_obsidian", name: "黑曜帽", color: "#3a2e48", price: 80 },
  ],
  robe: [
    { id: "r_wine", name: "酒紅斗篷", color: "#7a2440", price: 40 },
    { id: "r_forest", name: "深林斗篷", color: "#2a5a3a", price: 40 },
    { id: "r_snow", name: "雪白斗篷", color: "#c8cce0", price: 70 },
    { id: "r_ink", name: "墨黑斗篷", color: "#221c30", price: 90 },
  ],
  furniture: [
    { id: "f_books", name: "一疊魔法書", art: "books", price: 20 },
    { id: "f_urn", name: "花盆", art: "urn", price: 20 },
    { id: "f_crystal", name: "數晶台", art: "crystal", price: 50 },
    { id: "f_scope", name: "望遠鏡", art: "scope", price: 60 },
    { id: "f_lamp", name: "星星燈", art: "lamp", price: 40 },
    { id: "f_planter", name: "花台", art: "planter", price: 30 },
  ],
};
const ALL = [...SHOP.hat, ...SHOP.robe, ...SHOP.furniture];

/** 依存檔套用外觀（開遊戲、買了、換了的時候） */
export function applyOutfit(s) {
  const o = s.outfit ?? {};
  OUTFIT.hat = SHOP.hat.find((x) => x.id === o.hat)?.color ?? null;
  OUTFIT.robe = SHOP.robe.find((x) => x.id === o.robe)?.color ?? null;
}

function preview(s) {
  const c = el("canvas.shoppv", { width: 32, height: 50 });
  const f = heroWalkFrame(s.look ?? "girl", "down", "idle", 0, ATTRS[s.attr]?.color ?? "#8a7cff");
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
  return c;
}

export function shopScene(game, { tab = "hat" } = {}) {
  const s = game.save;
  s.owned ??= []; s.outfit ??= {};
  applyOutfit(s);
  const tabs = el("div.shoptabs", {}, ...[["hat", "帽子"], ["robe", "斗篷"], ["furniture", "家具"]].map(([k, t]) => el(`button.btn.small${k === tab ? ".gold" : ""}`, { onclick: () => shopScene(game, { tab: k }) }, t)));
  const item = (it) => {
    const own = s.owned.includes(it.id);
    const worn = tab !== "furniture" && s.outfit[tab] === it.id;
    const swatch = it.color ? el("span.swatch", { style: { background: it.color } }) : el("span.swatch.furn", {}, "🪑");
    const btn = own
      ? tab === "furniture" ? el("button.btn.small", { disabled: true }, "已經有了")
        : el(`button.btn.small${worn ? "" : ".gold"}`, { onclick: () => { s.outfit[tab] = worn ? null : it.id; writeSave(s); sfx("click"); shopScene(game, { tab }); } }, worn ? "脫下" : "穿上")
      : el("button.btn.small.gold", { disabled: s.coins < it.price, onclick: () => { s.coins -= it.price; s.owned.push(it.id); if (tab !== "furniture") s.outfit[tab] = it.id; writeSave(s); sfx("level"); shopScene(game, { tab }); } }, `${it.price} 晶幣`);
    return el("div.shopitem", {}, swatch, el("span.iname", {}, it.name), btn);
  };
  show(el("div.screen.shop", {},
    el("div.shophead", {}, el("span.stitle", {}, "學院商店"), el("span.scoins", {}, `${s.coins} 晶幣`)),
    el("div.shopbody", {},
      el("div.shopleft", {}, preview(s)),
      el("div.shopright", {}, tabs, el("div.shoplist", {}, ...SHOP[tab].map(item)))),
    el("button.btn.gold", { onclick: () => game.go("map") }, "離開商店")));
}

export { ALL as SHOP_ALL };
