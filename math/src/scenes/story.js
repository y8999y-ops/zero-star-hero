// 所有劇情的動畫演出（2026-11-25 使用者：所有的劇情都做動畫演出；開場的船要修好）。用 src/cutscene.js 播。
//   opening        開場：數律之地的夜空 → 天亮的雲海和學院島 → 浮空船飛進來（原圖）→ 船上兩位新生選外觀 → 飛向學院
//   ceremony       入學典禮：院長走到共鳴之井前致詞（講不完的圓周率）→ 新生走上井邊 → 井水發光 → 共鳴儀式
//   afterResonance 典禮後：圖書館地下轟一聲、墨水噴滿學院、顏色被吸走 → 頁頁從圖書館飛出來 → 第一隻墨水滴冒出來 → 教學戰鬥
//   afterTutorial  第一場戰鬥後：墨水散開、地上的顏色回來一點 → 頁頁開心 → 院長跑過來 → 學院全景
//   ending         結局：真身縮成一滴墨水 → 兩本書合成一本 → 學院恢復色彩 → 新規定（錯題本的由來）→ 完
// 世界觀：docs/世界觀.md 第 7 節。台詞沿用原本的對話版。

import { el } from "../ui.js";
import { sfx } from "../audio.js";
import { writeSave } from "../save.js";
import { ATTRS } from "../data.js";
import { playCutscene } from "../cutscene.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { deanFrame } from "../../fx/dean.js";
import { pagepageFrame } from "../../fx/pagepage.js";
import { inkDropFrame } from "../../fx/ink-drop.js";
import { STUDENTS } from "../world/island-life.js";
import { inkKingTrueFrame } from "../../fx/ink-king-forms.js";

const D_ = (text) => ({ who: "dean", name: "圓周院長", text });
const P_ = (text) => ({ who: "page", name: "頁頁", text });
const N_ = (text) => ({ who: null, name: "", text });
const SILHOUETTE = "brightness(0) invert(0.86) sepia(0.25) hue-rotate(200deg)";   // 還沒選的新生：淡紫的剪影

// 廣場（共鳴之井前）：花園的天空原圖、遠一點的圖書館、井、地板
export async function plaza(D, { gray = 0 } = {}) {
  const f = gray ? `grayscale(${gray}) brightness(${1 - gray * 0.25})` : "saturate(.75)";
  await D.bg("battle-hd/garden/back.jpg", { fade: 0.8, filter: f });
  D.ground("hub/floor.jpg", GY - 8, 26);
  D.img("hub/library.png", { x: 300, y: GY - 6, h: 112, z: 1, tint: true });
  D.img("hub/p/tree.png", { x: 40, y: GY, h: 64, z: 2, tint: true });
  D.img("hub/p/lamp.png", { x: 108, y: GY + 2, h: 46, z: 2, tint: true });
  if (gray) D.filter(f, 0.01);
  return D.img("hub/well.png", { x: 192, y: GY + 8, h: 84, z: 3, tint: true });
}
export const GY = 150;   // 廣場的地面線（對話框在下面，人要站在它上面）

// ───────── 開場 ─────────
export async function openingStory(game, { replay = false, back = "title" } = {}) {
  const s = game.save;
  let chosen = replay ? s.look ?? "girl" : null, root = null;
  const pick = (container) => new Promise((res) => {
    const box = el("div.opicks", {},
      el("button.btn.gold", { onclick: () => { box.remove(); res("girl"); } }, "女生"),
      el("button.btn.gold", { onclick: () => { box.remove(); res("boy"); } }, "男生"));
    container.append(box);
  });
  // 浮空船＋兩位新生（原圖）：整張在後面、船艙前緣再疊一層蓋住新生的腳＝新生站在船艙裡
  // docked＝已經停好（跳過開場時直接從這裡開始選人，2026-11-26 使用者：跳過後畫面沒跟著換到選人）
  const Y = 184, H = 176, deck = Y - H * 0.2;
  // 先載好船的圖：跳過後船和人一起出現（不然人先出來、船晚半秒才冒出來）
  const shipReady = new Promise((res) => { const im = new Image(); im.src = new URL("../../assets/story/ship.png", import.meta.url).href; im.decode().then(res, res); });
  const boat = (D, docked) => {
    const dx = docked ? 322 : 0;
    const ship = D.img("story/ship.png", { x: -130 + dx, y: Y, h: H, z: 2 });
    const front = D.img("story/ship.png", { x: -130 + dx, y: Y, h: H, z: 5, clip: "inset(79% 0 0 0)" });
    const kids = { girl: D.sprite((t) => heroWalkFrame("girl", "down", "idle", t, "#8a7cff"), { x: docked ? 164 : -158, y: deck, z: 3, px: 1.1 }),
      boy: D.sprite((t) => heroWalkFrame("boy", "down", "idle", t, "#8a7cff"), { x: docked ? 220 : -102, y: deck, z: 3, px: 1.1 }) };
    const all = [ship, front, kids.girl, kids.boy];
    for (const a of all) { a.bob(2, 1.6); a.bobP = 0; }
    for (const k of ["girl", "boy"]) kids[k].node.style.filter = chosen ? (chosen === k ? "none" : SILHOUETTE) : SILHOUETTE;
    return { ship, front, kids, all };
  };
  // 第一段：夜空 → 黎明 → 浮空船開進來（可以跳過）
  const r = await playCutscene(async (D) => {
    root = document.querySelector(".csscr");
    await D.bg("story/night.jpg", { fade: 1.2 });
    D.fx("sparkle", 192, 90, 40);
    D.caption("數律之地——萬物都照著數字運轉。");
    await D.wait(3.2);
    D.fx("sparkle", 192, 90, 40);
    D.caption("在這裡，數學就是真正的魔法。");
    await D.wait(2.6);
    await D.bg("story/dawn.jpg", { fade: 1.8 });
    D.caption("雲海之上，浮著一座齒輪般的島——魔數學院。");
    await D.cam({ zoom: 1.18, x: 250, y: 104 }, 3.2);
    D.cam({ zoom: 1, x: 192, y: 108 }, 1.6);
    const { ship, front, kids } = boat(D, false);
    sfx("whoosh");
    D.caption("今年的新生，乘著浮空船來了。");
    await Promise.all([ship.to({ x: 192 }, 3.4, "out"), front.to({ x: 192 }, 3.4, "out"), kids.girl.to({ x: 164 }, 3.4, "out"), kids.boy.to({ x: 220 }, 3.4, "out")]);
  });
  // 重看時跳過＝整段結束
  const skippedAll = !r.done && chosen;
  // 第二段：船停好了 → 選人 → 飛向學院島（跳過第一段也會從這裡接上，畫面換成黎明＋停好的船）
  if (!skippedAll) await playCutscene(async (D) => {
    root = document.querySelector(".csscr");
    await shipReady;
    await D.bg("story/dawn.jpg", { fade: 0.01 });
    const { ship, front, kids, all } = boat(D, true);
    for (const a of all) a.alpha = 0;
    await Promise.all([ship.node, front.node].map((n) => n.decode?.().catch(() => {})));   // 船的圖畫好了，船和人一起出現
    for (const a of all) a.alpha = 1;
    if (!chosen) {
      D.caption("你是哪一位新生？");
      chosen = await pick(root);
      s.look = chosen; writeSave(s); sfx("good");
    }
    // 選到的那位亮起來、轉頭看鏡頭（跳一下），另一位淡掉
    const me = kids[chosen], other = kids[chosen === "girl" ? "boy" : "girl"];
    me.node.style.transition = "filter .8s"; me.node.style.filter = "none";
    other.node.style.transition = "opacity .8s"; other.alpha = 0.45;
    D.fx("burst", me.x, deck - 30, 18, "#fff3b0");
    await me.to({ y: deck - 6 }, 0.25, "out"); await me.to({ y: deck }, 0.25, "in");
    D.caption("「歡迎來到魔數學院！」");
    await D.wait(1.6);
    // 飛向學院島：往右上、越來越小
    sfx("whoosh");
    await Promise.all(all.map((a) => a.to({ x: a.x + 150, y: a.y - 60, scale: 0.35 }, 3.2, "in")));
    await D.fadeOut("#fffaeb", 1);
  });
  // 第二段選人前就按跳過：照樣要選
  if (!chosen) { const c = document.querySelector(".csscr") ?? root; const cap = c?.querySelector(".cscap"); if (cap) { cap.hidden = false; cap.textContent = "你是哪一位新生？"; } chosen = await pick(c); s.look = chosen; writeSave(s); }
  void r;
  if (replay) { game.go("settings", { from: back }); return; }
  s.world = null; writeSave(s);
  game.go("map");
}

// ───────── 入學典禮 ─────────
export async function ceremonyStory(game) {
  const s = game.save;
  await playCutscene(async (D) => {
    await plaza(D);
    const st = STUDENTS.slice(0, 3).map((x, i) => D.sprite((t) => heroWalkFrame(x.look, "down", "idle", t + i * 0.3, x.attr, x.hair), { x: [70, 120, 270][i], y: GY + 6, z: 4, px: 1.2 }));
    const me = D.sprite((t) => heroWalkFrame(s.look ?? "girl", "down", "idle", t, "#8a7cff"), { x: 150, y: GY + 14, z: 6, px: 1.3 });
    const dean = D.sprite((t) => deanFrame("idle", t), { x: 420, y: GY + 10, z: 5, px: 1.3 });
    D.caption("春天的共鳴廣場，新生們齊聚一堂。");
    await dean.to({ x: 236 }, 2.2, "out");
    D.caption("");
    const hop = async (a) => { await a.to({ y: a.y - 5 }, 0.18, "out"); await a.to({ y: a.y + 5 }, 0.18, "in"); };
    hop(dean);
    await D.say([D_("歡迎來到魔數學院！我是圓周院長。開學致詞——圓周率是三點一四一五九二六五三五八九七九三二三八四六二六四三……")]);
    // 院長講不完：太陽都換了位置（快轉），同學打瞌睡
    D.caption("院長講了很久很久……");
    D.filter("saturate(.75) sepia(.35) hue-rotate(-12deg)", 2);
    await Promise.all(st.map((a, i) => a.to({ rot: i % 2 ? 8 : -8 }, 1.2)));
    await D.wait(1.2);
    D.filter("saturate(.75)", 1);
    await Promise.all(st.map((a) => a.to({ rot: 0 }, 0.3)));
    D.caption("");
    await D.say([N_("旁邊傳來一聲輕咳。"), D_("……咳！總之，請新生站上「共鳴之井」。井水不考你會不會算，只看你喜歡怎麼想——選最直覺的答案就好！")]);
    // 新生走上井邊，井水發光
    await me.to({ x: 192, y: GY + 12 }, 1.4);
    sfx("restore");
    D.fx("rise", 192, GY - 20, 50, "#bfe8ff");
    D.fx("sparkle", 192, GY - 40, 30);
    await D.cam({ zoom: 1.35, x: 192, y: GY - 20 }, 1.6);
    D.flash("#ffffff", 0.8);
    await D.wait(0.4);
  });
  game.go("resonance");
}

// ───────── 共鳴儀式之後：無解之書爆開、頁頁登場 ─────────
export async function afterResonanceStory(game) {
  const s = game.save, col = ATTRS[s.attr]?.color ?? "#8a7cff";
  await playCutscene(async (D) => {
    await plaza(D);
    const me = D.sprite((t) => heroWalkFrame(s.look ?? "girl", "down", "idle", t, col), { x: 192, y: GY + 12, z: 6, px: 1.3 });
    const dean = D.sprite((t) => deanFrame("idle", t), { x: 250, y: GY + 10, z: 5, px: 1.3 });
    D.fx("rise", 192, GY, 40, col);
    D.caption(`井水剛映出${ATTRS[s.attr]?.school ?? ""}的光芒，那一刻——`);
    await D.wait(2.2);
    // 轟：圖書館地下傳來巨響
    sfx("boss"); D.shake(7, 1.2); D.flash("#ffffff", 0.5);
    D.caption("轟隆——！地下禁書庫傳來巨響。");
    await D.wait(0.6);
    sfx("shatter");
    for (let i = 0; i < 5; i++) { D.fx("ink", 300 + (i - 2) * 24, GY - 80, 45); D.shake(4, 0.3); await D.wait(0.3); }
    D.caption("裝滿「被放棄題目」的《無解之書》撐不住了，滾滾墨水吞沒了學院的色彩……");
    D.filter("grayscale(.85) brightness(.78)", 2.4);         // 顏色被墨水吸走
    await dean.to({ x: 300, rot: -10 }, 0.6, "out");          // 院長嚇一跳往後退
    await D.wait(1.8);
    // 頁頁從圖書館飛出來
    const page = D.sprite((t) => pagepageFrame("worried", t), { x: 300, y: GY - 60, z: 7, px: 1.6, scale: 0.4 });
    sfx("whoosh");
    await page.to({ x: 150, y: GY - 30, scale: 1, rot: 20 }, 1.2, "out");
    await page.to({ rot: 0 }, 0.3);
    page.bob(2, 3);
    D.caption("");
    await D.say([P_("嗚哇——還好趕上了！我是從《萬題之書》逃出來的一頁，叫我頁頁！"), P_("墨水怪身上都掛著沒算完的題目。老師魔力太強只會炸碎它——只有親手算完，墨水才會真正散開！")]);
    // 井邊的墨水聚成一團，冒出眼睛
    const ink = D.sprite((t) => inkDropFrame("idle", t), { x: 262, y: GY + 14, z: 6, px: 1.5, scale: 0.1 });
    sfx("tick"); D.fx("ink", 262, GY + 6, 14);
    await ink.to({ scale: 1 }, 0.8, "back");
    await D.say([P_("第一隻墨水怪冒出來了！別怕，我陪你用剛亮起的數晶算完它！")]);
    await D.cam({ zoom: 1.4, x: 240, y: GY }, 0.8);
    void me;
  });
  writeSave(s);
  game.go("battle", { grade: "g1", mode: "tutorial" });
}

// ───────── 第一場戰鬥之後 ─────────
export async function afterTutorialStory(game, r) {
  const s = game.save, a = ATTRS[s.attr], col = a?.color ?? "#8a7cff";
  await playCutscene(async (D) => {
    await plaza(D, { gray: 0.85 });
    const me = D.sprite((t) => heroWalkFrame(s.look ?? "girl", "down", "idle", t, col), { x: 170, y: GY + 12, z: 6, px: 1.3 });
    const page = D.sprite((t) => pagepageFrame("happy", t), { x: 140, y: GY - 30, z: 7, px: 1.6 }).bob(3, 4);
    // 墨水散開：井邊那一塊的顏色先回來一點
    sfx("restore"); D.fx("burst", 262, GY, 30, col); D.fx("rise", 262, GY + 10, 30);
    D.filter("grayscale(.55) brightness(.88)", 1.6);
    await D.say([P_("太棒了！墨水散開，地上的顏色回來一點了！"),
      P_(r?.wrong ? `剛剛那 ${r.wrong} 題我先記進錯題本囉。算不完可以先放著，但一定要回來算完！` : "五題全對！小魔數師，你根本是天生的吧！")]);
    // 院長跑過來（喘氣：一跳一跳）
    const dean = D.sprite((t) => deanFrame("idle", t), { x: 430, y: GY + 10, z: 5, px: 1.3 });
    for (let i = 0; i < 4; i++) { dean.to({ x: dean.x - 45 }, 0.35, "linear"); await dean.to({ y: GY + 4 }, 0.17, "out"); await dean.to({ y: GY + 10 }, 0.17, "in"); }
    await D.say([D_(`呼、呼……剛才那道${a?.school ?? ""}的光是你放的嗎？學院真的有救了！`),
      D_("墨水四散到學院各處了——先往最右邊的星芽花園出發吧！")]);
    await Promise.all([me.to({ x: 420 }, 1.6, "in"), page.to({ x: 400 }, 1.6, "in")]);
    void dean;
  });
  s.seenIntro = true;
  s.flags = { ...(s.flags ?? {}), metDean: true };
  writeSave(s);
  game.go("map", { from: "well" });
}

// ───────── 結局（最終戰第一次打完） ─────────
// 禁書庫：真身縮成一滴墨水 → 千頁圖書館大廳前：兩本書（《萬題之書》金色、《無解之書》墨色）飛到一起合成一本、光爆開
// → 學院從灰變回彩色 → 院長宣布新規定 → 頁頁道謝 → 「完」
export async function endingStory(game) {
  const s = game.save, col = ATTRS[s.attr]?.color ?? "#8a7cff";
  s.flags = { ...(s.flags ?? {}), ending: true }; writeSave(s);
  await playCutscene(async (D) => {
    // ① 禁書庫：真身一圈一圈縮小，變成一滴墨水
    await D.bg("battle-hd/vault/back.jpg", { fade: 1, filter: "grayscale(.6) brightness(.8)" });
    const me = D.sprite((t) => heroWalkFrame(s.look ?? "girl", "down", "idle", t, col), { x: 110, y: 170, z: 4, px: 1.3 });
    const king = D.sprite((t) => inkKingTrueFrame("hurt", t), { x: 270, y: 176, z: 3, px: 1.1 });
    D.caption("最後一道算式成立，墨水大王一圈一圈縮小……");
    sfx("restore");
    for (let i = 0; i < 3; i++) { D.fx("ink", 270, 120, 25); await king.to({ scale: 1 - (i + 1) * 0.28 }, 0.8, "inout"); }
    king.remove();
    const drop = D.sprite((t) => inkDropFrame("idle", t), { x: 270, y: 176, z: 3, px: 1, scale: 0.6 });
    await D.wait(0.6);
    D.caption("");
    await D.say([N_("那滴小小的墨水輕聲說：「原來……真的有人會回來，把我算完。」"), P_("只要還有一題沒算完，我們都會回來的！")]);
    await drop.to({ alpha: 0, y: 150 }, 1);
    me.remove();
    // ② 圖書館大廳前：兩本書合成一本
    await D.bg("battle-hd/garden/back.jpg", { fade: 1.2, filter: "grayscale(.85) brightness(.78)" });
    D.ground("hub/floor.jpg", GY - 8, 26);
    D.img("hub/library.png", { x: 192, y: GY - 6, h: 140, z: 1, tint: true });
    D.filter("grayscale(.85) brightness(.78)", 0.01);
    const bookA = D.sprite((t) => pagepageFrame("happy", t, 3), { x: 60, y: 110, z: 5, px: 2 }).bob(2, 3);
    const bookB = D.sprite((t) => pagepageFrame("idle", t, 3), { x: 324, y: 110, z: 5, px: 2 }).bob(2, 3);
    bookB.node.style.filter = "grayscale(1) brightness(.55) sepia(.3) hue-rotate(220deg)";   // 剛變乾淨的《無解之書》還是暗暗的
    D.caption("《無解之書》洗淨了最後一滴墨色，緩緩飛向千頁圖書館——");
    await Promise.all([bookA.to({ x: 176, rot: 10 }, 2.4, "inout"), bookB.to({ x: 208, rot: -10 }, 2.4, "inout")]);
    bookB.node.style.transition = "filter 1s"; bookB.node.style.filter = "none";
    D.caption("與《萬題之書》合而為一。");
    sfx("level"); D.flash("#fff6d0", 1.2); D.fx("burst", 192, 100, 40, "#ffe9a0"); D.fx("sparkle", 192, 100, 50);
    bookB.remove(); await bookA.to({ x: 192, rot: 0, scale: 1.4 }, 0.6, "back");
    // ③ 學院恢復色彩
    D.filter("none", 3); D.fx("rise", 192, GY, 70);
    await D.wait(2.2);
    D.caption("");
    const dean = D.sprite((t) => deanFrame("talk", t), { x: 300, y: GY + 10, z: 6, px: 1.3 });
    const me2 = D.sprite((t) => heroWalkFrame(s.look ?? "girl", "down", "idle", t, col), { x: 90, y: GY + 12, z: 6, px: 1.3 });
    await D.say([D_("從今天起，學院訂下一條新校規——"), D_("「算不完的題目可以先放著，但一定要有人回來算完。」"), N_("——這便是「錯題本」的由來。")]);
    const page = D.sprite((t) => pagepageFrame("happy", t, 3), { x: 130, y: GY - 40, z: 7, px: 1.6 }).bob(3, 4);
    await D.say([P_("花開對了瓣數，鐘塔走對了時間，學院的色彩全回來了！"), P_("謝謝你，小魔數師！以後也要常回學院一起練魔法喔。")]);
    // ④ 完
    await D.cam({ zoom: 1.15, x: 192, y: 100 }, 2);
    D.caption("完　　《魔數學院》");
    await D.wait(3);
    void dean; void me2; void page;
  });
  game.go("map", { from: "library" });
}
