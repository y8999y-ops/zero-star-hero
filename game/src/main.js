// 遊戲主程式：第一章的關卡（1-1～1-3）、碎星鎮。網址加 ?endless 是無限出怪的測試模式，?stage=1-2 直接進那一關。
import { openWorldMap } from "./worldmap.js";
import { drawAbsorbBeams } from "./coreart.js";
import { drawAlert } from "./alertfx.js";
import { playOpen } from "./ui-trans.js";
import { setNum, bump } from "./bump.js";
import { createFrame, composite, hex, PAL } from "../../pixelfx/src/core/index.js";
import * as fireball from "../../pixelfx/src/fx/fire/fireball.js";
import * as explosion from "../../pixelfx/src/fx/explosions/plasma-explosion.js";
import { A, GLOW } from "./assets.js";
import { input, tickInput, initTouch, consume } from "./input.js";
import { drawLevel, drawForeground, drawAtmosphere, sceneLights, lightStyle, LEVEL_W, FLOOR, H, TORCHES, TORCH_POS, WALL, geo, MAP_H } from "./level.js";
import { initMap, flatMap, groundAt, floorAt, solidAt, moveX, surfaceRuns, setSolid } from "./map.js";
import { drawPlug } from "./feature-art.js";
import { TOWN_W, NPCS, townLights, drawTown, drawTownNpcs, drawTownFg, nearby, setDayPhase, setWeather, drawTownWeather } from "./town.js";
import { talk, ask, dialog, typewriter } from "./dialog.js";
import * as frogFx from "../../pixelfx/src/fx/critters/frog.js";
import { computeLight, flash, updateLight } from "./light.js";
import { spawn, updateFx, drawFx, juice, hitStop, shake, shakeOffset, fxCount } from "./fx.js";
import { createDeathFx } from "./deathfx.js";
const deathFx = createDeathFx();   // 特效補強 1：死亡碎掉、祭壇重生
import { drawLowHp, beat } from "./lowhpfx.js";
const lowHp = { phase: 0.99, k: 1, pulse: 0 };   // 特效補強 3：低血量（< 30%）四角泛紅＋心跳
import { Player, MP_COST, COMBO_MP } from "./player.js";
import { Enemy } from "./enemies.js";
import { Director, STAGES } from "./stage.js";
import { STAGE_KEY, STAGE_ORDER, STAGE_ID, LAYOUTS } from "./stages.js";
import * as levelUpFx from "../../pixelfx/src/fx/ui/level-up.js";
import * as chestOpen from "../../pixelfx/src/fx/pickups/chest-open.js";
import * as treasureChest from "../fx/loot/treasure-chest.js";
import { CHEST_TIERS } from "./chest-tiers.js";
import * as collectBurst from "../../pixelfx/src/fx/pickups/collect-burst.js";
import { createFx } from "../../pixelfx/src/core/index.js";
import { load, save, BAG_SIZE } from "./save.js";
import { computeStats, compare, xpNeed, MAX_LV, setStatBonus } from "./stats.js";
import { makeItem, rollRarity, R, RARITY, JUNK, MYTHS, AWAKEN, awakenStage } from "./items.js";
import { Drops, feed } from "./loot.js";
import { createInventory } from "./inventory.js";
import { playFace, moodOf } from "./system-face.js";
import { startTitle } from "./title.js";
import { playIntro } from "./intro.js";
import { questEvent, refreshBoard, rewardText, sysActive, isReady } from "./quests.js";
import { initTownUI, openQuests, openForge, openInn, isWinOpen, MEALS, questLook, openTree } from "./townui.js";
import { installUiArt, iconURL, setAttackIcon, medal, MEDAL_SIZE } from "./ui-art.js";
import { FORMS, CARRY_MAX, coreChance, absorbCore, makeCore, CORE_COST } from "./forms.js";
import { bindForms, rank, freePts } from "./skilltree.js";
import { createFrame as makeFrame } from "../../pixelfx/src/core/index.js";
import { paintStar, POSES } from "./star.js";
import { npcSize } from "./npcs.js";
import { createFolk, FOLK_INFO } from "./folk.js";
import { createProps } from "./props.js";
import { createScenery } from "./scenery.js";
import { Boss, prepareBoss } from "./boss.js";
import { createComboArt } from "./combo-art.js";
import { unlock as unlockAudio, sfx, music, jingle, vol as audioVol, setVolume } from "./audio.js";
import { fxState, dustFx, updateCombatFx, drawCombatFx, drawDamageNumbers } from "./combatfx.js";
import { PLATFORMS } from "./level.js";
import { ELEM, setStatusContext, updateStatus, drawBolts, REACTION, applyStatus, setStatusAllow } from "./status.js";
import { createHazards } from "./hazards.js";
import * as starFallFx from "../../pixelfx/src/fx/arcane/star-fall.js";
import { drawWave, WAVE_T, WAVE_V } from "./starwave.js";
const waves = [];   // 技能樹「星光斬」
const minis = [];   // 技能樹「蝙蝠群」的小蝙蝠
import * as slamFx from "../../pixelfx/src/fx/impacts/ground-slam.js";
import { drawMiniBat } from "./minibat.js";
import { drawMark, drawStrike, drawShield, drawReson, drawKingBack, drawKingFront, STRIKE_T } from "./setfx.js";
import { drawTrail, drawDizzy, TRAIL_T } from "./corefx.js";
import { drawAltar } from "./altar-art.js";
import { drawObjGlow } from "./objglow.js";
import { createFeatures } from "./features.js";
import { createMapView } from "./mapview.js";
import * as sparkFx from "../../pixelfx/src/fx/impacts/hit-spark.js";
const strikes = [];   // 流星獵手 4 件的小流星（星核「隕鐵」的小隕石也用這個）
let comet = null;     // 星核「彗尾」：這次衝刺打過誰

const trail = [];     // 彗尾留下的星光點 { x, y, t }
let hudFadeT = 0, inCombat = false;   // 戰鬥中 HUD 變淡
import { ultPixels, ULT_S } from "./ult-icon.js";
import { ult, ULT_MAX, ULT_MP, ULT_MULT, startUlt, updateUlt, ultLights, dimScene, drawUlt, drawCutIn, postUlt, bindUltHooks } from "./ult.js";

installUiArt();
// 場景：城鎮（碎星鎮）或關卡。換場景＝存檔後重新載入頁面（下一個場景記在 sessionStorage）。
// ?endless 直接進無限模式、?stage 直接進 1-1（開發用）。第一次玩（還沒通關、還沒登記）先從 1-1 開始。
const DEBUG = new URLSearchParams(location.search).has("debug");   // 網址加 ?debug 才顯示 fps 那行
if (DEBUG) document.body.classList.add("debug");
const NEXT_KEY = "zero-hero-next", QS = new URLSearchParams(location.search);
const nextScene = sessionStorage.getItem(NEXT_KEY);
sessionStorage.removeItem(NEXT_KEY);
const profile = load();
const ENDLESS = nextScene ? nextScene === "endless" : QS.has("endless");
const TOWN = nextScene ? nextScene === "town" : !QS.has("endless") && !QS.has("stage") && (profile.clears > 0 || profile.guild.registered);
const STAGE = STAGES[STAGE_ID];
// ---- 8b：星之祭壇（存檔點）。碰到會點亮、回滿血和魔力；死掉從最後點亮的祭壇重來（還沒點過＝關卡起點）
const altars = TOWN || ENDLESS ? [] : (STAGE.altars ?? (LAYOUTS[STAGE_ID].w > 1200 ? [{ x: Math.round(LAYOUTS[STAGE_ID].w * 0.5) }] : [])).map((a) => ({ x: a.x, y: a.y ?? floorAt(a.x, LAYOUTS[STAGE_ID].solids ? 0 : FLOOR - 4), lit: false, near: false }));
let checkpoint = null;
const plug = { on: false, t: 0, landed: false };   // 1-4 屋頂破洞的垃圾塞子
let features = null;   // 8d：形態機關＋一次性資源（features.js），玩家和世界建好之後才建立
// 關卡進度：哪幾關打過（舊存檔：通關過＝1-1 打過）
profile.cleared ??= profile.clears > 0 ? { "1-1": true } : {};
const unlocked = () => STAGE_ORDER.filter((id, i) => i === 0 || profile.cleared[STAGE_ORDER[i - 1]]);
const nextStage = () => STAGE_ORDER[STAGE_ORDER.indexOf(STAGE_ID) + 1];

const STEP = 1 / 60;
const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
let W = 384, frame, img;
const ZOOM = 1.38;   // 鏡頭拉近（看到的世界是原本的 1/1.38）；使用者 2026-11-05：1.2 → 再放大 15%
// 使用者 2026-11-05：鏡頭往下 15%，再往上 10%（淨往下 5%）——看得到的範圍在畫布裡往下移（看得到腳下多一點），單位：畫布像素
const VIEW_DY = Math.round((TOWN ? 0.10 : 0.05) * H / ZOOM);   // 使用者 2026-11-05：城鎮比關卡再往下 5%
// 王戰時鏡頭稍微拉遠（使用者 2026-11-05 照建議）：王房比一個畫面寬，拉遠一點才看得到王從另一邊衝過來
const ZOOM_BOSS = 1.2;
let zoom = ZOOM, zoomShown = 0;
/** 看得到的範圍（畫布座標）：放大後四周被裁掉，只剩中間這一塊；鏡頭、特寫帶、跳字、小地圖都照這個算 */
function viewRect() {
  const vw = W / zoom, vh = H / zoom, my = (H - vh) / 2;
  return { x0: (W - vw) / 2, y0: my + Math.min(VIEW_DY, my), w: vw, h: vh };
}

// ---- 畫面大小：高度固定 216，寬度跟著螢幕比例走（手機長螢幕不會有黑邊）
function resize() {
  const aspect = innerWidth && innerHeight ? innerWidth / innerHeight : 16 / 9;   // 視窗還沒顯示時是 0
  W = Math.max(320, Math.min(480, Math.round((H * aspect) / 2) * 2));
  canvas.width = W;
  canvas.height = H;
  // 使用者 2026-11-05：鏡頭拉近——畫面照原本的 216 高畫，顯示時放大 zoom 倍，超出視窗的四周裁掉（#stage overflow: hidden）
  frame = createFrame(W, H);
  img = new ImageData(W, H);
  applyZoom();
}
/** 畫布顯示大小：放大 zoom 倍，看得到的範圍對齊視窗中間 */
function applyZoom() {
  zoomShown = zoom;
  const k = Math.min(innerWidth / W, innerHeight / H) * zoom, v = viewRect();
  canvas.style.width = Math.floor(W * k) + "px";
  canvas.style.height = Math.floor(H * k) + "px";
  // 置中（比視窗大時 grid 會靠左上，裁切就不對稱）：直接算左上角，offsetLeft／offsetTop 也跟著對
  canvas.style.position = "absolute";
  canvas.style.left = Math.round((innerWidth - Math.floor(W * k)) / 2) + "px";
  canvas.style.top = Math.round((innerHeight - Math.floor(H * k)) / 2 - (v.y0 - (H - v.h) / 2) * k) + "px";
  frame.view = v;
}
addEventListener("resize", resize);
resize();

// ---- 世界
if (TOWN) initMap(flatMap(TOWN_W, H, FLOOR, WALL));
const player = TOWN ? new Player(120, FLOOR) : ENDLESS ? new Player(200, FLOOR) : new Player(STAGE.start.x, STAGE.start.y);
const enemies = [];
const coins = [];
const shots = [];
const stats = { coins: 0, kills: 0, combo: 0, comboT: 0, best: 0, time: 0, deaths: 0 };
let camX = 0, camY = TOWN ? 0 : Math.max(0, MAP_H - H), started = false, director = null, cleared = false, introOn = false;   // introOn：開場動畫播放中（遊戲暫停）

// ---- 存檔與刷寶
const drops = new Drops();
const runLoot = [];   // 這一趟撿到的東西（通關畫面顯示）
let slowT = 0;        // 傳說掉落時的慢動作
// 數值：裝備＋等級，再加上旅館料理的效果（下一趟冒險有效）
function statsNow() {
  const s = computeStats(profile.equip, profile.lv), m = MEALS[profile.meal];
  s.maxMp = 100 + (profile.mpBonus ?? 0);   // 魔力（8 批）：基礎 100，星之殘火加上限
  if (m) m.apply(s);
  return s;
}
profile.coreBonus ??= {};
setStatBonus(profile.coreBonus);   // 使用者 2026-11-06：魔物核換來的基礎屬性
function refreshStats() {
  player.setStats(statsNow());
  save(profile);
  updateBagDot();
}
player.setStats(statsNow());
setAttackIcon("star");
bindForms(profile.forms);
player.setForm(profile.forms.cur);
player.hp = player.maxHp;
const inv = createInventory(profile, { onChange: refreshStats });
window.__game = { player, enemies, stats, profile, drops, inv, get director() { return director; }, get camX() { return camX; }, get camY() { return camY; }, get view() { return viewRect(); }, get zoom() { return zoom; }, lightStyle };   // 開發用：在主控台檢查狀態

// 每種敵人的經驗值、掉寶率
const KILL_XP = { slime: 5, bat: 5, trash: 12, gold: 20 };
const DROP_RATE = { slime: 0.1, bat: 0.1, trash: 0.35, gold: 1 };
const ilvlNow = (bonus = 0) => profile.lv + bonus + Math.floor(Math.random() * 2);

function gainXp(n) {
  if (profile.lv >= MAX_LV) return;
  profile.xp += n;
  let up = false;
  while (profile.lv < MAX_LV && profile.xp >= xpNeed(profile.lv)) {
    profile.xp -= xpNeed(profile.lv);
    profile.lv++;
    up = true;
  }
  if (!up) return;
  sfx("levelup");
  refreshStats();
  player.hp = player.maxHp;
  spawn(levelUpFx, { x: Math.round(player.x), y: Math.round(player.y), light: 0.45, seed: profile.lv });
  flash(player.x, player.y - 12, 90, 3, 0.8, "#ffd84a");
  sayQueue.unshift([`升級！Lv ${profile.lv}　生命全滿`, 2.2]);
}

/** 在 (x, y) 掉一件東西。minR 是保底稀有度。 */
function dropItem(x, y, minR = 0, opts = {}) {
  const s = player.stats;
  const r = opts.rarity ?? rollRarity(s.mf, minR);
  const item = makeItem(opts.ilvl ?? ilvlNow(), r, opts);
  drops.add(item, x, y, opts.dir);
  if (item.rarity === R.legend) {
    // 傳說：時間變慢、畫面一閃
    slowT = 0.9;
    flash(x, y, 110, 4, 1, "#ff8a2a");
    hitStop(0.12);
    shake(0.4, 3);
    flashEl.classList.remove("on");
    void flashEl.offsetWidth;
    flashEl.classList.add("on");
    sayQueue.unshift(["系統：……等等，那個橘色的光是怎樣？！", 2.6]);
  } else if (item.rarity === R.epic) {
    // 史詩（套裝）：紫光、震一下，第一次撿到時系統解釋
    flash(x, y, 90, 3, 0.6, "#b878ff"); shake(0.25, 2); hitStop(0.06);
    if (!profile.seenSet) { profile.seenSet = 1; sayQueue.unshift(["系統：紫色的光……套裝！同一套穿 2 件、4 件都有效果。", 3]); }
  } else if (item.rarity === R.rare) shake(0.15, 2);
}

/** 撿起來。背包滿了回傳 false。 */
function pickUp(d) {
  if (d.item.kind === "formcore") return false;   // 使用者 2026-11-06：魔物核不會碰到就吸——要按住吸收鍵（updateAbsorb）
  const it = d.item, better = compare(it, profile.equip, profile.lv)?.better;
  // 自動拆解：關／只拆純垃圾／純垃圾和普通
  const auto = profile.auto === 1 ? it.kind === "junk" : profile.auto === 2 ? it.kind === "junk" || it.rarity <= R.common : false;
  if (auto && !better) {
    const r = RARITY[it.rarity];
    profile.scrap += r.scrap;
    profile.coins += r.coin;
    feed(it, `自動拆解 +${r.scrap} 星塵`);
    save(profile);
    return true;
  }
  if (profile.inv.length >= BAG_SIZE) {
    if (!d.warned) { d.warned = true; toast("系統：背包滿了！打開右上角的【背包】整理一下。", 2.5, "bag"); }
    return false;
  }
  it.new = true;
  profile.inv.push(it);
  runLoot.push(it);
  feed(it, "", better);
  if (it.kind === "junk") questProgress("junk");
  if (it.kind === "junk" && Math.random() < 0.4) sayQueue.push([JUNK.find((j) => j.id === it.junk).say, 2.4]);
  sfx(it.rarity >= R.rare ? "rare" : "pickup");
  if (it.rarity >= R.rare) spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 10, palette: it.rarity === R.legend ? PAL.ember : ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], light: 0.4 });
  save(profile);
  updateBagDot();
  return true;
}

// ---- 形態：吸收魔物核、切換
const FORM_BURST = {
  star: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
  slime: ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff"],
  bat: ["#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff"],
  can: ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"],
};
function absorb(it) {
  const F = FORMS[it.form], res = absorbCore(profile.forms, it.form);
  setTimeout(() => questProgress("core"), 0);
  sfx("absorb");
  // 吸收完成：核衝進身體，炸開一圈形態顏色的光（比撿東西大很多）
  spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[it.form], light: 0.7 });
  spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[it.form], light: 0.4, seed: 7 }, { speed: 0.7 });
  flash(player.x, player.y - 12, 120, 4, 0.9, F.color);
  shake(0.18, 2.5);
  if (res.unlocked) {
    formBanner(it.form);
    profile.forms.fresh = it.form;   // 形態格一直發光，直到第一次切換過去
    toast(`系統：吸收了${F.name}的核！新形態「${F.name}」。${profile.forms.carry.includes(it.form) ? tipFor("點右邊的【形態】就能變身。", "按【1】～【3】就能變身。") : "已經帶滿 3 個了，不在戰鬥中時打開技能樹的【形態】頁就能換。"}`, 3.4, "forms");
    sayQueue.unshift([`系統：你把${F.from === "slime" ? "史萊姆" : "垃圾桶"}的核吃掉了？不對，是吸收。好吧，差不多。`, 2.8]);
  } else {
    // 重複的核：存起來，2 顆換 1 點（技能點或屬性，在技能樹視窗上方換）
    const have = profile.forms.owned[it.form].cores ?? 0;
    feed({ name: it.name, icon: it.icon, rarity: 3 }, `核 +1（${have} 顆${have >= CORE_COST ? "，可以換點數了" : ""}）`);
    if (!profile.seenCoreTip) { profile.seenCoreTip = 1; sayQueue.push(["系統：重複的核存起來了。兩顆換一點——技能點或屬性，在左上的【技能樹】換。", 3.4]); }
  }
  save(profile);
  buildFormHud();
  return true;
}
/** 形態被動「星之光輝」：星星時大招傷害 +4%／級 */
const ultPassive = () => (player.form === "star" ? 1 + 0.04 * rank("star", "p_star") : 1);
// 使用者 2026-11-06：變身有 1 秒冷卻（形態欄變暗、一條光從下往上填滿＝好了）
const FORM_CD = 1;
let formCdUntil = 0;
function switchForm(id) {
  if (!id || id === player.form || !profile.forms.owned[id] || ult.on) return;
  if (sceneClock < formCdUntil) { sfx("close"); return; }
  formCdUntil = sceneClock + FORM_CD;
  formHud.classList.remove("cd"); void formHud.offsetWidth; formHud.classList.add("cd");
  clearTimeout(switchForm.t); switchForm.t = setTimeout(() => formHud.classList.remove("cd"), FORM_CD * 1000);
  if (profile.forms.fresh === id) { delete profile.forms.fresh; setTimeout(buildFormHud, 0); }
  sfx("form");
  const prevForm = player.form;
  profile.forms.cur = id;
  player.setForm(id);
  player.turnT = 0.09;
  // 技能樹：切換時的效果
  if (id === "star" && rank("star", "s_origin") && sceneClock - (switchForm.originT ?? -9) > 3) { switchForm.originT = sceneClock; player.mp = Math.min(player.maxMp, player.mp + 10); }
  if (id === "star" && rank("star", "s_return")) player.skillCd *= 0.5;
  if (id === "slime" && rank("slime", "g_film")) player.filmT = 3;
  if (id === "can" && rank("can", "c_dent")) player.dentT = 3;
  heartBurst(prevForm);
  if (id === "bat" && rank("bat", "b_night")) player.nightT = 3;
  player.invuln = Math.max(player.invuln, 0.15);
  spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[id], light: 0.4 });
  flash(player.x, player.y - 12, 60, 2, 0.3, FORMS[id].color);
  save(profile);
  buildFormHud();
}
const $ = (id) => document.getElementById(id);
// 使用者 2026-11-06：按鈕跟著教學一個一個出現（1-1 的新玩家）：一開始只有攻擊，教到閃避、技能才出現那顆；大招第一次夠魔力時出現。
//   教過的記在 profile.taught；打過 1-1 的舊存檔全部照舊顯示。只有在 1-1 會藏。
profile.taught ??= profile.cleared["1-1"] ? { dash: 1, skill: 1, ult: 1 } : {};
const LOCKABLE = { dash: ["btnDash"], skill: ["btnSkill", "pcSkill"], ult: ["btnUlt", "ultHud"] };   // 手機的按鈕、電腦右下角的技能／大招圖示
for (const k in LOCKABLE) document.body.classList.toggle("lock-" + k, STAGE_ID === "1-1" && !TOWN && !ENDLESS && !profile.taught[k]);
function teach(k) {
  if (profile.taught[k]) return;
  profile.taught[k] = 1;
  save(profile);
  if (!document.body.classList.contains("lock-" + k)) return;
  document.body.classList.remove("lock-" + k);
  for (const id of LOCKABLE[k]) {
    const el = $(id);
    el.classList.remove("reveal"); void el.offsetWidth; el.classList.add("reveal");
    setTimeout(() => el.classList.remove("reveal"), 1400);
  }
  sfx("chime");
}
// 右上角的形態按鈕（電腦也能點）：每格畫一個小星星，目前的形態有亮框
const formHud = document.getElementById("forms");
// ---- 使用者 2026-11-06：吸收魔物核——站到核旁邊，額外亮出一顆「吸收」鍵（電腦按住 F），按住 1 秒吸收。
//   按著的時候核浮起來、光環往內收、幾道光拉到主角身上；戰鬥中也能吸，但被打到就中斷（核掉回地上，要重按）
const ABSORB_T = 1;
let absorbHp = null, absorbTick = 0;
function updateAbsorb(dt) {
  const cores = drops.list.filter((d) => d.item.kind === "formcore" && d.landed && d.t > 0.45 && !d.got);
  let near = null;
  for (const d of cores) if (Math.abs(d.x - player.x) < 26 && Math.abs(d.y - player.y) < 30 && (!near || Math.abs(d.x - player.x) < Math.abs(near.x - player.x))) near = d;
  const show = !!near && !TOWN && !dialog.open;
  if (document.body.classList.contains("absorbnear") !== show) {
    document.body.classList.toggle("absorbnear", show);
    if (show) { $("btnAbsorb").style.backgroundImage = `url(${iconURL(near.item.icon, 3)}), radial-gradient(circle, #3a2a10 0 55%, #1a1206 56% 100%)`; sfx("chime"); }
  }
  const hit = absorbHp !== null && player.hp < absorbHp;
  absorbHp = player.hp;
  for (const d of cores) if (d !== near && d.hold) d.hold = Math.max(0, d.hold - dt * 3);
  const tip = $("absorbTip");
  if (!show) { tip.classList.add("hidden"); return; }
  // 提示：核的上方一行字（電腦：按住 F；手機：按住右下的吸收鍵）
  const k = canvas.clientWidth / W;
  tip.classList.remove("hidden");
  tip.style.left = canvas.offsetLeft + (near.x - camX) * k + "px";
  tip.style.top = canvas.offsetTop + (near.y - 40 - camY) * k + "px";
  if (hit && near.hold > 0) { near.hold = 0; sfx("close"); toast("系統：被打斷了！核掉回地上了。", 1.4); return; }
  if (input.absorb && !ult.on && !introOn) {
    near.hold = Math.min(1, (near.hold ?? 0) + dt / ABSORB_T);
    if ((absorbTick += dt) > 0.22) { absorbTick = 0; sfx("ui"); }
    if (near.hold >= 1) { near.got = true; document.body.classList.remove("absorbnear"); tip.classList.add("hidden"); absorb(near.item); }
  } else near.hold = Math.max(0, (near.hold ?? 0) - dt * 3);
  tip.classList.toggle("holding", (near.hold ?? 0) > 0);
}
/** 獲得新形態：畫面中間跳出大字（形態圖示＋名字），約 2.2 秒 */
function formBanner(id) {
  const el = $("formBanner"), F = FORMS[id];
  const f = makeFrame(40, 34), c = document.createElement("canvas"), im = new ImageData(40, 34);
  c.width = 40; c.height = 34;
  paintStar(f, 20, 31, POSES.stand, false, { glow: 0, form: id });
  composite(f, im.data, null);
  c.getContext("2d").putImageData(im, 0, 0);
  el.innerHTML = `<div class="fb-sub">新形態</div><div class="fb-name" style="color:${F.color}">${F.name}</div>`;
  el.prepend(c);
  el.style.setProperty("--fc", F.color);
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  clearTimeout(formBanner.t);
  formBanner.t = setTimeout(() => el.classList.remove("show"), 2400);
  sfx("levelup");
}
function buildFormHud() {
  formHud.innerHTML = "";
  profile.forms.carry.forEach((id, i) => {
    const b = document.createElement("button");
    b.className = "fslot" + (id === player.form ? " on" : "") + (profile.forms.fresh === id ? " fresh" : "");
    b.title = `${FORMS[id].name}（${i + 1}）`;
    const f = makeFrame(40, 34), c = document.createElement("canvas");
    c.width = 40; c.height = 34;
    paintStar(f, 20, 31, POSES.stand, false, { glow: 0, form: id });
    const im = new ImageData(40, 34);
    composite(f, im.data, null);
    c.getContext("2d").putImageData(im, 0, 0);
    b.appendChild(c);
    // 有沒花掉的技能點：右下角一顆小點（原本的 Lv 拿掉了）
    if (freePts(id) > 0) { const dot = document.createElement("i"); dot.className = "ptdot"; dot.textContent = freePts(id); b.appendChild(dot); }
    const any = Object.keys(profile.forms.owned).reduce((s, f) => s + Math.max(0, freePts(f)), 0);
    $("treeDot").textContent = any; $("treeDot").classList.toggle("on", any > 0);
    if (typeof updateMenuDot === "function") updateMenuDot();
    b.addEventListener("pointerdown", (e) => { e.stopPropagation(); switchForm(id); });
    formHud.appendChild(b);
  });
  drawMedal();
}
// 左上徽章：把目前形態的主角畫進星芒圓盤
function drawMedal() {
  const fw = 40, fh = 34, f = makeFrame(fw, fh), im = new ImageData(fw, fh);
  paintStar(f, 20, 31, POSES.stand, false, { glow: 0, form: player?.form ?? profile.forms.cur });
  composite(f, im.data, null);
  const d = im.data, ox = ((MEDAL_SIZE - fw) >> 1), oy = ((MEDAL_SIZE - fh) >> 1);
  const c = medal(2, (x, y) => {
    const sx = x - ox, sy = y - oy;
    if (sx < 0 || sy < 0 || sx >= fw || sy >= fh) return null;
    const i = (sy * fw + sx) * 4;
    return d[i + 3] ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : null;
  });
  const cv = $("medalCv");
  cv.width = c.width; cv.height = c.height;
  cv.getContext("2d").drawImage(c, 0, 0);
}
buildFormHud();

// ---- 傳說效果：很吵的劍、加班證明
const NOISY = [
  ["系統（劍）：拜託你認真打好嗎。給你攻擊 +30%。", { atk: 0.3 }],
  ["系統（劍）：太慢了啦！攻速 +30%，快點！", { spd: 0.3 }],
  ["系統（劍）：跑起來！移速 +30%！", { move: 0.3 }],
  ["系統（劍）：……我不想講話。攻擊 +30%，自己看著辦。", { atk: 0.3 }],
];
let noisyT = 4, combatT = 0, idleT = 0;
function updateUniques(dt) {
  if (player.has("noisy") && (noisyT -= dt) <= 0) {
    noisyT = 10;
    const [line, buff] = NOISY[Math.floor(Math.random() * NOISY.length)];
    Object.assign(player.buff, { atk: 0, spd: 0, move: 0, ...buff, t: player.core("noisy") || 5 });   // 星核：等級越高增益越久
    sayQueue.unshift([line, 2.4]);
  }
  // 大檢查：大地圖上一直有怪活著 → 改成「附近有醒著的怪」才算戰鬥中（加班證明才會在離開戰鬥 3 秒後歸零）
  const fighting = enemies.some((e) => !e.dead && e.kind !== "gold" && Math.abs(e.x - player.x) < 220 && Math.abs(e.y - player.y) < 140);
  idleT = fighting ? 0 : idleT + dt;
  combatT = fighting ? combatT + dt : idleT > 3 ? 0 : combatT;
  player.dmgMul = player.has("overtime") ? 1 + Math.min(1, Math.floor(combatT / 10) * 0.05) : 1;
}

// ---- 寶箱（2026-11-05 改版）：分 4 個等級（chest-tiers.js），每個等級的造型都不一樣（fx/loot/treasure-chest.js）。
// 不是戰鬥狀態、站在寶箱旁邊時，攻擊鍵變成「開箱」鍵，按下去才打開。打開後噴出可以撿的金幣和寶石（落地後走過去才吸過來）＋裝備。
// 各關的寶箱：1-1 木箱、1-2 鐵箱、1-3 紅漆金箱；1-4 打倒王之後在王倒下的地方出現星箱。
const STAGE_CHEST = { "1-1": 0, "1-2": 1, "1-3": 2 };
const chestOpts = (tier) => { const T = CHEST_TIERS[tier]; return { tier, wood: T.wood, palette: T.palette, coins: 0, gems: 0, light: 0.3 + tier * 0.08 }; };
function makeChest(x, tier, y = FLOOR) { return { x: Math.round(x), y, tier, opened: false, t: 0, fx: createFx(treasureChest, { x: Math.round(x), y, ...chestOpts(tier) }) }; }
let chest = ENDLESS || TOWN || STAGE_ID === "1-4" ? null : makeChest(STAGE.exitX - 120, STAGE_CHEST[STAGE_ID] ?? 0, floorAt(STAGE.exitX - 120, (STAGE.exitY || FLOOR) - 8));
let prevUseAtk = false, useT = null, useKind = "";
/** 可以開箱嗎：站在旁邊、在地上、沒有在打仗 */
// 8b：怪物擺滿整張地圖，改成「附近 160 以內沒有活的怪」就能開（不用清光整關）
const canOpenChest = () => !!chest && !chest.opened && Math.abs(player.x - chest.x) < 24 && Math.abs(player.y - chest.y) < 20 && player.grounded && !director?.lock && !enemies.some((e) => !e.dead && e.kind !== "gold" && Math.abs(e.x - chest.x) < 160 && Math.abs(e.y - chest.y) < 80);
function openChest() {
  chest.opened = true;
  chest.t = 0;
  const T = CHEST_TIERS[chest.tier], c = chest;
  spawn(treasureChest, { x: c.x, y: c.y, ...chestOpts(c.tier) }, { layer: "back" });
  sfx("chest");
  setTimeout(() => { flash(c.x, c.y - 16, 80 + c.tier * 30, 3, 1 + c.tier * 0.4, T.palette[5]); shake(0.15 + c.tier * 0.08, 2 + c.tier); if (c.tier >= 2) sfx("rare"); }, 800);
  sayQueue.unshift([["系統：木箱。……聊勝於無。", "系統：鐵箱！裡面應該不是垃圾吧。", "系統：紅漆金箱！我聞到錢的味道了。", "系統：星箱……！這是傳說中的那個嗎？"][c.tier], 2.6]);
}
function updateChest(dt) {
  if (!chest || !chest.opened) return;
  const before = chest.t;
  chest.t += dt;
  // 蓋子彈開那一刻（0.8 秒）噴出金幣、寶石、裝備
  if (before < 0.8 && chest.t >= 0.8) {
    const T = CHEST_TIERS[chest.tier];
    spawnLoot(chest.x, chest.y - 14, T.coins, T.gems, chest.tier);
    let k = 0;
    for (const [rar, n] of T.items) for (let i = 0; i < n; i++, k++) dropItem(chest.x, chest.y - 12, R[rar], { rarity: R[rar], ilvl: ilvlNow(1 + chest.tier), dir: k % 2 ? 1 : -1 });
    // 星箱（王）額外：傳說 15%；神話 3%，連續 10 個星箱沒出就保底
    if (chest.tier >= 3) {
      profile.pity ??= { legend: 0, myth: 0 };
      if (Math.random() < 0.15) dropItem(chest.x, chest.y - 12, R.legend, { rarity: R.legend, ilvl: ilvlNow(2), dir: 1 });
      if (Math.random() < 0.03 || profile.pity.myth >= 9) { profile.pity.myth = 0; setTimeout(() => dropItem(chest.x, chest.y - 12, R.myth, { rarity: R.myth, ilvl: ilvlNow(2), dir: -1 }), 500); }
      else profile.pity.myth++;
    }
  }
}
// ---- 互動鍵（使用者 2026-11-05）：傳送門、星之祭壇、寶箱、星之殘火、化石核、保險箱、碑文，都要站在旁邊按互動鍵才觸發。
// 互動鍵＝攻擊鍵：旁邊有東西可以用時，攻擊鍵換成門／手／寶箱的圖示並發亮，頭上冒「！」；按下去用掉、不出拳。
function findUse() {
  if (!player.grounded || (player.hideT ?? 0) > 0 || ult.on) return null;
  const c = [];
  if (canOpenChest()) c.push({ kind: "chest", x: chest.x, top: chest.y - 34, go: openChest });
  if (stageDone && !leaving && portalX !== null && Math.abs(player.x - portalX) < 16 && Math.abs(player.y - portalY) < 20) c.push({ kind: "door", x: portalX, top: portalY - 48, go: leaveStage });
  // 使用者 2026-11-05：祭壇只能互動一次（點亮後就不能再回血）
  for (const a of altars) if (!a.lit && Math.abs(player.x - a.x) < 16 && Math.abs(player.y - a.y) < 24) c.push({ kind: "hand", x: a.x, top: a.y - 44, go: () => useAltar(a) });
  for (const u of features?.usable() ?? []) c.push({ kind: u.t === "safe" ? "chest" : "hand", x: u.x, top: u.top, go: () => features.use(u) });
  let best = null;
  for (const o of c) if (!best || Math.abs(o.x - player.x) < Math.abs(best.x - player.x)) best = o;
  return best;
}
/** 在 player.update 之前攔截攻擊鍵：剛按下那一下用掉旁邊的東西，旁邊有東西時不出拳 */
function useInput() {
  const atk = input.attack;
  useT = findUse();
  const kind = useT?.kind ?? "";
  if (kind !== useKind) {
    for (const k of ["chest", "door", "hand"]) document.body.classList.toggle(k + "near", k === kind);
    useKind = kind;
    // 第一次遇到可以互動的東西：教一次怎麼用（記在存檔，之後不再講）
    if (kind && !profile.tipUse) { profile.tipUse = 1; sayQueue.unshift([isTouch ? "系統：站在旁邊時右下角的鍵會換圖示、發亮——按一下就能用。門、祭壇、撿東西都一樣。" : "系統：站在旁邊時按【滑鼠左鍵】就能用。門、祭壇、撿東西都一樣——頭上有「！」的就是。", 3.6]); }
  }
  if (useT && atk && !prevUseAtk) { input.attack = false; useT.go(); useT = null; }
  else if (useT) input.attack = false;
  prevUseAtk = atk;
}

// ---- 可以撿的金幣和寶石（寶箱噴出來的）：先彈跳落地，主角走過去才吸過來
const GEM_TYPES = [
  { name: "紅寶石", val: 30, G: ["#2a0612", "#6e0f2a", "#b81c3c", "#f0405a", "#ff8a96", "#ffd2d6"] },
  { name: "翡翠", val: 20, G: ["#06200f", "#0f4a26", "#1a8040", "#34c060", "#8af0a0", "#d8ffe0"] },
  { name: "藍寶石", val: 25, G: ["#0a1030", "#142a70", "#2050c0", "#3a8cf0", "#8ccaff", "#dcf0ff"] },
  { name: "紫水晶", val: 50, G: ["#1a0a2a", "#3e1466", "#6a28a8", "#a050e0", "#d09cff", "#f0e0ff"] },
].map((g) => ({ ...g, C: g.G.map((c) => hex(c) >>> 0) }));
// 寶石的樣子（5×5，左上亮右下暗、一顆高光；外框用最暗那階＝pixelfx 的選擇性外框，色階沿用 pixelfx chest-open 的寶石）
// 第二版（照 pixelfx pickups 的 gemlet：上面是亮的檯面、中間腰線、下面收尖，一顆白色高光）
const GEM_ART = [".4554.", "5w5432", "443321", ".3221.", "..21.."];
const gems = [];
function spawnLoot(x, y, nCoins, nGems, tier) {
  const sp = 1 + tier * 0.25;
  for (let i = 0; i < nCoins; i++) coins.push({ x, y, vx: (Math.random() - 0.5) * 220 * sp, vy: -150 - Math.random() * 170 * sp, t: 0, lay: true });
  for (let i = 0; i < nGems; i++) {
    const type = tier >= 3 && i % 3 === 0 ? 3 : Math.floor(Math.random() * (tier >= 2 ? 4 : 3));
    gems.push({ x, y, vx: (Math.random() - 0.5) * 200 * sp, vy: -170 - Math.random() * 160 * sp, t: 0, lay: true, type });
  }
}
/** 落地彈跳；還躺在地上（lay）時，主角靠近才開始吸 */
function lootPhysics(c, dt, onGet) {
  c.t += dt;
  const m = 30;
  if (c.lay) {
    c.vy += 700 * dt;
    const py = c.y + 2;
    c.x = moveX(c.x, c.x + c.vx * dt, c.y + 2, 4, 3);
    c.y += c.vy * dt;
    const gy = c.vy >= 0 ? groundAt(c.x, py, c.y + 2) : null;   // 8b：落在地形上
    if (gy !== null) { c.y = gy - 2; c.vy *= -0.4; c.vx *= 0.55; if (Math.abs(c.vy) < 30) c.vy = 0; }
    if (c.t > 0.5 && Math.abs(player.x - c.x) < m && Math.abs(player.y - 10 - c.y) < m) { c.lay = false; c.t = 0.45; }
    return;
  }
  const dx = player.x - c.x, dy = player.y - 12 - c.y, d = Math.hypot(dx, dy) || 1, s2 = 120 + (c.t - 0.45) * 900;
  c.x += (dx / d) * s2 * dt;
  c.y += (dy / d) * s2 * dt;
  if (d < 10) { c.got = true; onGet(); }
}
function updateGems(dt) {
  for (const g of gems) lootPhysics(g, dt, () => {
    const T = GEM_TYPES[g.type];
    profile.coins += T.val; stats.coins += T.val;
    sfx("pickup");
    spawn(collectBurst, { x: Math.round(g.x), y: Math.round(g.y), palette: T.G, light: 0.3 });
  });
  for (let i = gems.length - 1; i >= 0; i--) if (gems[i].got) gems.splice(i, 1);
}
function drawGems() {
  const Cc = frame.color, L = frame.light, Wf = frame.w;
  for (const g of gems) {
    const T = GEM_TYPES[g.type], x = Math.round(g.x) - frame.ox - 3, y = Math.round(g.y) - frame.oy - 3;
    const at = (i, j) => (GEM_ART[j]?.[i] ?? ".") !== ".";
    for (let j = -1; j <= 5; j++) for (let i = -1; i <= 6; i++) {
      const px = x + i, py = y + j;
      if (px < 0 || py < 0 || px >= Wf || py >= frame.h) continue;
      if (at(i, j)) Cc[py * Wf + px] = GEM_ART[j][i] === "w" ? 0xffffffff : T.C[+GEM_ART[j][i]];
      else if (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1)) Cc[py * Wf + px] = T.C[0];
    }
    const tw = Math.sin(stats.time * 5 + g.x * 0.7);   // 偶爾閃一下（十字小光）
    if (tw > 0.92) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const px = x + 1 + dx, py = y + dy; if (px >= 0 && py >= 0 && px < Wf && py < frame.h) Cc[py * Wf + px] = 0xffffffff; }
    const lx = x + 2, ly = y + 2;
    if (lx >= 0 && ly >= 0 && lx < Wf && ly < frame.h) L[ly * Wf + lx] = T.C[4];
  }
}

// 場景互動物件：草叢、木箱、垃圾堆、水晶（props）；小生物、垂掛物、水窪（scenery）
// 8b：新的大地圖（有 solids）先不放草叢、木箱、水窪這些貼地板的東西（8c、8d 改成照地形擺）
const BARE = !TOWN && !!LAYOUTS[STAGE_ID].solids;
// 10 批：大地圖的草叢、木箱、水晶、水窪、小生物、元素物件改成照地面段擺（原本 8b 先拿掉）
const RUNS = BARE ? surfaceRuns(32).filter((R) => R.y > 40 && R.x1 - R.x0 >= 24) : null;
const scenery = createScenery({ floor: FLOOR, w: geo.w, platforms: TOWN ? [] : PLATFORMS, town: TOWN, runs: RUNS, noPuddles: STAGE_ID === "1-1" && !TOWN && !ENDLESS });
// 使用者 2026-11-06：第一關只保留黏液和火焰（還有兩個一起的「大火」反應），其他元素（帶電、毒、潮濕、油汙）在 1-1 不會沾上
if (STAGE_ID === "1-1" && !TOWN && !ENDLESS) setStatusAllow(["burn", "slime"]);
// 元素場景物件（第 3 批）：黏液池、油桶、廚餘堆、漏電管線；水窪＝潮濕、火盆＝燃燒
const hazards = createHazards({ stage: TOWN || ENDLESS ? "" : STAGE_ID, floor: FLOOR, torches: TOWN ? [] : TORCH_POS, puddles: TOWN ? [] : scenery.puddles, items: BARE ? (STAGE.hazards ?? []) : null });
window.__game.hazards = hazards;
window.__game.day = setDayPhase;
window.__game.weather = setWeather;   // 開發用：__game.weather("rain" / "cloudy" / "clear" / null)   // 開發用：__game.day(0.25)＝中午、0.5＝日落、0.75＝半夜、null＝照真實時間
// 10 批：水窪不要疊在元素物件、祭壇、機關上
{
  const busy = [...hazards.list.map((h) => [h.x, h.y]), ...altars.map((a) => [a.x, a.y]), ...(STAGE.features ?? []).map((f) => [f.x, f.y])];
  for (let i = scenery.puddles.length - 1; i >= 0; i--) { const p = scenery.puddles[i]; if (busy.some(([x, y]) => Math.abs(x - p.x) < 40 && Math.abs(y - p.y) < 8)) scenery.puddles.splice(i, 1); }
}
const props = createProps({
  floor: FLOOR, w: geo.w, platforms: TOWN ? [] : PLATFORMS, town: TOWN, runs: RUNS, floorFn: BARE ? floorAt : null,
  avoid: TOWN ? [...NPCS.map((n) => n.x), 924] : [...TORCHES, ...altars.map((a) => a.x), ...(STAGE.features ?? []).map((f) => f.x), ...hazards.list.flatMap((h) => [h.x - 14, h.x, h.x + 14]), STAGE.exitX - 120, STAGE.exitX + 26, STAGE.start.x, ...scenery.puddles.flatMap((p) => [p.x - p.w / 4, p.x, p.x + p.w / 4])],
});
// 8d：形態機關＋一次性資源
const FX_PAL = { crack: ["#140a18", "#5a2a20", "#8a3e24", "#b05a2a", "#d27c3c", "#e4b072", "#fff6c4", "#ffffff"], ember: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
  seal: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], vein: ["#0c2a40", "#1a7aa8", "#28aed0", "#4cd8ec", "#a0f2fa", "#e4ffff", "#ffffff", "#ffffff"],
  fossil: ["#1a1030", "#3a2468", "#5a3c94", "#7a5cb8", "#9a80d0", "#c8b8f0", "#ffffff", "#ffffff"], safe: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
  stele: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"] };
if (!TOWN && !ENDLESS) features = createFeatures({
  stageId: STAGE_ID, list: STAGE.features ?? [], profile, player,
  api: {
    say: (m, sec) => sayQueue.push([m, sec]),
    toast: (m, sec, icon) => toast(m, sec, null, icon),
    // 特效補強 9：拿到重要資源（星之殘火、魔物化石核）的大字橫幅
    banner(icon, title, eff, flavor) {
      const el = $("resBanner");
      el.querySelector(".rb-icon").style.backgroundImage = `url(${iconURL(icon, 3)})`;
      el.querySelector(".rb-title").textContent = title; el.querySelector(".rb-eff").textContent = eff; el.querySelector(".rb-flavor").textContent = flavor;
      el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); sfx("rare");
    },
    save: () => save(profile),
    refresh: () => refreshStats(),
    burst: (x, y, kind) => {
      // 特效補強 8：裂牆不再放金色收集光爆，改成牆腳一大團灰塵（碎塊在 features.js 自己畫）
      if (kind === "crack") { world.dust(x, y, 12); flash(x, y - 24, 90, 3, 0.5, FX_PAL.crack[5]); sfx("hitH"); shake(0.35, 4); hitStop(0.06); return; }
      spawn(collectBurst, { x: Math.round(x), y: Math.round(y), palette: FX_PAL[kind], light: 0.6 }); flash(x, y, 90, 3, 0.6, FX_PAL[kind][5]); sfx("levelup");
    },
    boing: (x, y) => { sfx("jump2"); world.dust(x, y, 6); },
    clink: (x, y) => { sfx("clank"); flash(x, y, 30, 1.5, 0.2, "#4cd8ec"); shake(0.08, 1); },
    loot: (x, y) => { world.dropCoins(x, y, 14); dropItem(x, y, R.rare, { rarity: R.rare, ilvl: ilvlNow(1), dir: -1 }); dropItem(x, y, R.epic, { rarity: R.epic, ilvl: ilvlNow(1), dir: 1 }); },
  },
});
window.__game.features = features;
// 8e：地圖畫面（M 鍵、左上選單的「地圖」）
const mapView = TOWN || ENDLESS ? null : createMapView({
  stageId: STAGE_ID, name: `${STAGE_ID} ${LAYOUTS[STAGE_ID].name}`, layout: { ...LAYOUTS[STAGE_ID], h: MAP_H },
  solidAt, platforms: geo.platforms, profile,
  getMarks: () => [
    { icon: "player", x: player.x, y: player.y, always: true },
    ...altars.map((a) => ({ icon: a.lit ? "altarOn" : "altarOff", x: a.x, y: a.y })),
    ...(STAGE.exitX ? [{ icon: "exit", x: STAGE.exitX + 26, y: STAGE.exitY || FLOOR }] : []),
    ...(STAGE.arena && !profile.cleared?.[STAGE_ID] ? [{ icon: "boss", x: (STAGE.arena.l + STAGE.arena.r) / 2, y: STAGE.arena.floor }] : []),   // 10 批：王房
    ...(features?.items ?? []).filter((f) => !((f.t === "crack" || f.t === "seal") && f.done)).map((f) => ({ icon: f.t, x: f.x, y: f.y, dim: f.done && !["shroom", "wind"].includes(f.t) })),
  ],
  onOpen: (box) => { sfx("open"); playOpen(box, "sys"); },
  onClose: () => sfx("close"),
});
window.__game.mapView = mapView;
Object.defineProperty(window.__game, "portal", { get: () => ({ x: portalX, y: portalY, stageDone, leaving }) });   // 開發用：傳送門
const openMap = () => { if (mapView && started && !dialog.open && !inv.open && !isWinOpen()) mapView.toggle(); };
addEventListener("keydown", (e) => { if (e.code === "KeyM") openMap(); if (e.code === "Escape" && mapView?.open) mapView.hide(); });
$("btnMap").style.backgroundImage = `url(${iconURL("map", 2)})`;
$("btnMap").addEventListener("click", (e) => { e.stopPropagation(); document.body.classList.remove("menuOpen"); openMap(); });
props.onBreak = (o) => {
  world.dropCoins(o.x, o.y - 10, o.type ? 2 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3));
  if (o.type === "crate" && Math.random() < 0.12) dropItem(o.x, o.y - 10, R.common, { ilvl: ilvlNow(0) });
};
const propMovers = () => {
  const list = [{ x: player.x, y: player.y, vx: player.vx, dash: player.state === "dash" }];
  for (const e of enemies) if (!e.dead && !e.k.fly) list.push({ x: e.x, y: e.y, vx: e.vx ?? 0 });
  return list;
};
const propView = () => ({ x0: camX, x1: camX + W });
window.__game.props = props;
window.__game.scenery = scenery;

if (!TOWN) for (const t of TORCH_POS) spawn(A.brazier, { x: t.x, y: t.y }, { layer: "back", keep: true }).update(Math.random() * 3);
// 出口的傳送門：通關（走到出口、或 1-4 打倒王）之後，踩上去才回碎星鎮（2026-11-05：不再跳結算頁）
let portalX = !ENDLESS && !TOWN && STAGE_ID !== "1-4" ? STAGE.exitX + 26 : null, portalY = STAGE.exitY || FLOOR, stageDone = false, leaving = false;
if (portalX !== null) spawn(A.portal, { x: portalX, y: portalY }, { layer: "back", keep: true });

// 關卡流程需要的操作
const stageApi = {
  spawnEnemy(kind, x, y) {
    // 8b：y 沒給＝放在 x 那裡的地面上；"air"＝飛的，地面上方 60～90
    const gy = floorAt(x, typeof y === "number" ? y - 4 : 0);
    const yy = y === "air" ? gy - 60 - Math.random() * 30 : typeof y === "number" ? y : gy;
    const e = kind === "boss" ? new Boss(x, STAGE.arena?.floor ?? FLOOR, bossApi) : new Enemy(kind, x, yy);
    e.x0 = x;   // 擺放的位置（1-1 的 quiet 用來分「前面幾段的怪」）
    enemies.push(e);
    if (started) world.dust(e.x, e.k.fly ? e.y + 8 : e.y, 4);
    return e;
  },
  say: (msg, sec, focus) => sayQueue.push([msg, sec, focus]),
  // 使用者 2026-11-06：1-1 一段一段來——附近還有醒著的怪就先不講下一段
  coreLeft: () => drops.list.some((d) => d.item.kind === "formcore" && !d.got),
  coreNear: (p) => drops.list.some((d) => d.item.kind === "formcore" && !d.got && d.landed && Math.abs(d.x - p.x) < 70),   // 地上還有沒吸的核（1-1：吸完才講祭壇）
  busy: (x, y, before) => enemies.some((e) => !e.dead && e.awake && e.kind !== "gold" && (e.x0 ?? e.x) < before && Math.abs(e.x - x) < 220 && Math.abs(e.y - y) < 120),
  // 系統還在講（上一句至少要給 sysMin 秒看完）；cut＝看完了就直接換下一句，不用等它自己消失
  talking: () => sayQueue.length > 0 || (sysT > 0.3 && sysAge < sysMin),
  cut: () => { if (sysT > 0.2) toastT = sysT = 0.2; },
  teach: (k) => teach(k),
  hint: (msg, sec) => showHint(msg, sec),
  // 金幣史萊姆只會逃跑，不算在「清光這一波」裡
  // 10 批：lock＝只算封住的王房裡的（大地圖上其他地方的怪不算）
  alive: (lk) => enemies.reduce((n, e) => n + (e.dead || e.kind === "gold" || (lk && !e.isBoss && (e.x < lk.l || e.x > lk.r || (STAGE.arena && e.y < STAGE.arena.floor - 220))) ? 0 : 1), 0),
  dropCache(x, y, n) {
    for (let i = 0; i < n; i++) coins.push({ x: x + (i - (n - 1) / 2) * 6, y: y - (i % 2) * 4, vx: 0, vy: 0, t: 0, still: true });
  },
  clear: showClear,
};

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const world = {
  /** 最近的敵人；dir 給 1 或 -1 時只找那一邊的。 */
  nearestEnemy(x, y, range, dir = 0) {
    let best = null, bd = range;
    for (const e of enemies) {
      if (e.dead || (dir && Math.sign(e.x - x) !== dir)) continue;
      const d = Math.abs(e.x - x) + Math.abs(e.y - y) * 0.5;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
  hitArea(box, dmg, dir, opts) {
    let n = 0;
    props.hit(box, dir);
    features?.hit(box);
    scenery.hit(box, dir);
    hazards.hit(box);
    for (const e of enemies) if (!e.dead && overlaps(box, e.box())) {
      const r = typeof dmg === "function" ? dmg() : dmg, poisoned = e.st?.poison > 0;
      e.hit(r, dir, opts, world, box); n++;
      onCritHit(e, r);
      // 技能樹「嗜血爪」（蝠翼星）：打中毒的敵人回復傷害的 3%
      if (poisoned && player.form === "bat" && rank("bat", "b_blood")) player.hp = Math.min(player.maxHp, player.hp + (r.dmg ?? r) * 0.03);
    }
    if (n) { addCombo(n); chargeUlt(n * 0.8); }
    return n;
  },
  /** 跟 hitArea 一樣，但同一隻只打一次（hit 是記錄打過的 Set） */
  hitOnce(box, hit, dmg, dir, opts) {
    let n = 0;
    props.hit(box, dir);
    features?.hit(box);
    scenery.hit(box, dir);
    for (const e of enemies) if (!e.dead && !hit.has(e) && overlaps(box, e.box())) { hit.add(e); const r = dmg(); e.hit(r, dir, opts, world, box); onCritHit(e, r); n++; }
    if (n) { addCombo(n); chargeUlt(n * 0.8); hitStop(0.05); shake(0.15, 2); }
    return n;
  },
  // 形態技能的投射物：星星＝金色星屑彈，黏液星＝綠色黏液彈（爆開範圍大、推得遠）
  spawnFireball(x, y, dir, form = "star", vy = 0) {
    sfx("shot", form);
    const pal = SHOT_PAL[form] ?? SHOT_PAL.star;
    shots.push({ x, y, dir, vy, form, life: 1.1, mult: 1, gen: 0, fx: spawn(fireball, { x, y, flip: dir < 0, palette: pal.fx, light: GLOW.skill, seed: (Math.random() * 99) | 0 }) });
  },
  /** 範圍裡活著的敵人 */
  enemiesIn(box) { return enemies.filter((e) => !e.dead && overlaps(box, e.box())); },
  /** 技能樹「急停震地」「震波」（鐵罐星）：地上一圈震波（pixelfx impacts/ground-slam），範圍內的地面敵人受傷、彈起 */
  groundSlam(x, y, r, mult) {
    const fy = floorAt(x, y - 8);   // 8b：貼著腳下的地面
    spawn(slamFx, { x: Math.round(x), y: Math.round(fy), palette: ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"], light: 0.4, seed: (Math.random() * 99) | 0 }, { speed: 1.8 });
    shake(0.25, 3); sfx("land", true);
    world.hitArea({ x0: x - r, x1: x + r, y0: fy - 30, y1: fy + 2 }, () => player.roll(mult * player.skillMul()), player.face, { launch: true, push: 3 });
  },
  /** 技能樹「蝙蝠群」（蝠翼星）：滑翔時每 0.5 秒放一隻小蝙蝠，最多 3 隻 */
  onGlide(dt) {
    if (!rank("bat", "b_swarm")) return;
    if ((world.swarmT = (world.swarmT ?? 0) - dt) > 0 || minis.length >= 3) return;
    world.swarmT = 0.5;
    minis.push({ x: player.x, y: player.y - 16, vx: 0, vy: -40, t: 0, life: 4, cd: 0, seed: Math.random() * 9 });
  },
  /** 技能樹「星光斬」：連段最後一下往前射一道月牙，穿過敵人、每隻打一次 */
  // ---- 星核的核心效果（8a）
  coreMeteor() {   // 隕鐵：前方最近的敵人頭上砸一顆小隕石
    const e = world.nearestEnemy(player.x, player.y, 320, player.face) ?? world.nearestEnemy(player.x, player.y, 320);
    if (e) strikes.push({ x: e.x, y: (e.box().y0 + e.box().y1) / 2, t: 0, e, mult: 1.2 });
  },
  coreStun(fromX, y) {   // 鈍光：攻擊你的那隻暈 1 秒
    let best = null, bd = 48;
    for (const e of enemies) { if (e.dead) continue; const d = Math.abs(e.x - fromX) + Math.abs(e.y - y) * 0.3; if (d < bd) { bd = d; best = e; } }
    if (best) { best.stun = Math.max(best.stun, 1); best.dizzyT = 1; }
  },
  cometStart() { comet = { hit: new Set() }; },
  // 特效補強 10：魔力不足——魔力條閃、按的那顆鍵左右抖、頭上冒「魔力不足」（0.6 秒內不重複冒）
  noMana(kind = "skill") {
    const b = $("mpBar"); b.classList.remove("lack"); void b.offsetWidth; b.classList.add("lack"); sfx("close");
    for (const el of kind === "ult" ? [btnUlt, ultHud] : [$("btnSkill"), pcSkill]) { el.classList.remove("shakeNo"); void el.offsetWidth; el.classList.add("shakeNo"); }
    const now = performance.now(); if (now - (world.noManaT ?? 0) < 600) return; world.noManaT = now;
    const k = canvas.clientWidth / W, pop = document.createElement("div");
    pop.className = "react-pop nomana"; pop.textContent = "魔力不足";
    pop.style.left = canvas.offsetLeft + (player.x - camX) * k + "px"; pop.style.top = canvas.offsetTop + (player.y - camY - 30) * k + "px";
    $("stage").appendChild(pop); setTimeout(() => pop.remove(), 900);
  },
  spawnWave(x, y, dir) { waves.push({ x, y, dir, t: 0, hit: new Set(), seed: Math.random() }); sfx("swing", "star"); },
  /** 技能樹的小彈（彈跳、分裂）：比較小、比較短、不會再分 */
  spawnShotlet(x, y, dir, form, { vy = 0, mult = 0.6, life = 0.35, gen = 1 } = {}) {
    const pal = SHOT_PAL[form] ?? SHOT_PAL.star;
    shots.push({ x, y, dir, vy, form, life, mult, gen, small: true, fx: spawn(fireball, { x, y, flip: dir < 0, palette: pal.fx, light: GLOW.skill * 0.6, seed: (Math.random() * 99) | 0 }) });
  },
  dropCoins(x, y, n) {
    for (let i = 0; i < n; i++) coins.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 140, t: 0 });
  },
  land(x, y, hard) { sfx("land", hard); dustFx("land", x, y, hard); props.landing(x, y, hard); scenery.landing(x, y, hard); },
  jumpDust(x, y, first) { dustFx(first ? "jump" : "double", x, y); },
  stepDust(x, y) { dustFx("step", x, y); },
  skidDust(x, y, dir) { dustFx("skid", x, y, false, dir); },
  dust(x, y, n) {
    spawn(A.dust, { x: Math.round(x), y: Math.round(y), flip: Math.random() < 0.5 }, { speed: 1.8 });
  },
  onKill(e) {
    stats.kills++;
    mythKill();
    questProgress("kill", { kind: e.kind, elite: e.elite });
    if (stats.kills === 30) toast("系統：……你真的是零星嗎？");
    if (stats.kills === 100) toast("系統：好啦，我承認你有一點點厲害。");
    if (e.kind === "gold") toast("系統：金幣史萊姆！今晚加菜！");
    const s = player.stats;
    gainXp((KILL_XP[e.kind] ?? 5) * (e.elite ? 4 : 1));
    chargeUlt(2);
    // 使用者 2026-11-06：1-1（paced）一次只教一件事，不掉魔物核——形態從 1-2 開始
    const [coreId, coreP] = coreChance(e.kind, profile.forms);
    if (e.core) { const b = e.box(); drops.add(makeCore(e.core), e.x, (b.y0 + b.y1) / 2, 1); }   // 關卡指定必掉（1-1 教吸收那隻）
    else if (coreId && !STAGE.paced && Math.random() < (e.elite ? Math.min(1, coreP * 4) : coreP)) { const b = e.box(); drops.add(makeCore(coreId), e.x, (b.y0 + b.y1) / 2); }
    const b = e.box(), cy = (b.y0 + b.y1) / 2;
    if (e.elite || Math.random() < (DROP_RATE[e.kind] ?? 0.1) * (1 + s.mf / 200)) dropItem(e.x, cy, e.kind === "gold" || e.elite ? R.fine : 0, e.elite && eliteLegend() ? { rarity: R.legend, ilvl: ilvlNow(1) } : e.elite && Math.random() < 0.03 ? { rarity: R.epic, ilvl: ilvlNow(1) } : { ilvl: ilvlNow(e.kind === "trash" || e.elite ? 1 : 0) });
    // 擊殺爆炸（只剩傳說「爆炸頭安全帽」有；詞綴已取消）：會連鎖，最多連 6 次
    if (player.has("hardhat") && boomDepth < 6 && Math.random() * 100 < 25) {
      const big = player.has("hardhat") ? 1.5 : 1, rx = 34 * big;
      boomDepth++;
      spawn(explosion, { x: Math.round(e.x), y: Math.round(cy), palette: PAL.ember, accent: PAL.lava, light: GLOW.skill * 0.7, seed: (Math.random() * 99) | 0 }, { speed: 1.6 });
      flash(e.x, cy, 70, 3, 0.3, "#ff8a30");
      world.hitArea({ x0: e.x - rx, x1: e.x + rx, y0: cy - rx, y1: cy + rx }, () => player.roll(1.2), e.x < player.x ? -1 : 1, { launch: true, push: 2 });
      shake(0.2, 2);
      boomDepth--;
    }
  },
  onPlayerHurt() {
    // 技能樹「彈性」（黏液星）：被打時 20% 把旁邊的敵人彈開
    if (player.form === "slime" && rank("slime", "g_spring") && Math.random() < 0.2) {
      for (const e of enemies) if (!e.dead && Math.abs(e.x - player.x) < 44 && Math.abs(e.y - player.y) < 40) { e.vx = (e.x >= player.x ? 1 : -1) * 260; e.vy = -160; e.stun = Math.max(e.stun, 0.5); }
      flash(player.x, player.y - 12, 60, 2, 0.25, "#b4f890");
    }
    stats.combo = 0;
    if (player.hp <= 0) {
      stats.deaths++;
      // 8b：從最後點亮的祭壇重來（還沒點過＝關卡起點）；打死的怪不會回來
      let to = checkpoint ?? (TOWN || ENDLESS ? null : { x: STAGE.start.x, y: floorAt(STAGE.start.x, 0) });
      // 大檢查：王已經倒下（融化中）時死掉 → 在王房裡原地復活（王房還封著，送出去會被夾回來）
      if (director?.lock && STAGE.arena && enemies.some((e) => e.isBoss && e.dying)) to = { x: player.x, y: STAGE.arena.floor };
      // 10 批：王戰中死掉（王房封住的時候）→ 王和房裡的小怪收掉、解除封鎖，回祭壇；再跳進王房，王滿血重新登場
      const bossFight = director?.lock && STAGE.arena && enemies.some((e) => e.isBoss && !e.dying);
      if (bossFight) {
        const { l, r } = director.lock;
        for (let i = enemies.length - 1; i >= 0; i--) { const e = enemies[i]; if (e.isBoss || (e.x >= l && e.x <= r && e.y > STAGE.arena.floor - 220)) enemies.splice(i, 1); }
        director.resetLock();
        bossBar.classList.remove("on");
        music(null);
      }
      // 特效補強 1：先碎掉（停頓、震動、碎片噴出）→ 0.55 秒後黑幕 → 0.9 秒送回祭壇，碎片飛回來聚成一點、光柱打下來，主角在光裡出現
      const fade = $("fade"), col = FORMS[player.form]?.color ?? "#ffd84a";
      deathFx.shatter(player.x, player.y, col);
      hitStop(0.12); shake(0.35, 3); sfx("crit");
      player.hideT = 9; player.invuln = 10; player.state = "move";
      setTimeout(() => fade.classList.add("on"), 550);
      setTimeout(() => {
        if (to) { player.x = to.x; player.y = to.y; player.vx = player.vy = 0; player.state = "move"; { const v = viewRect(); camRefY = null; lookX = player.face * 36; camX = Math.max(-v.x0, Math.min(LEVEL_W - v.x0 - v.w, to.x - W / 2)); if (MAP_H > H) camY = Math.max(-v.y0, Math.min(MAP_H - v.y0 - v.h, to.y - H * 0.62)); } }
        player.hp = player.maxHp; player.mp = player.maxMp;
        fade.classList.remove("on");
        deathFx.regather(player.x, player.y, col);
        player.hideT = 0.52; player.invuln = 2;   // 光柱打下來的那一刻出現
        const altar = to === checkpoint ? checkpoint : null;
        setTimeout(() => { sfx("levelup"); if (altar) { altar.pulse = 1; flash(altar.x, altar.y - 16, 90, 3, 0.5, "#ffe066"); } }, 480);   // 特效補強 12：從祭壇重生時，祭壇跟著亮一下
      }, 900);
      toast(checkpoint ? "系統：你死了。……從祭壇重來吧，打倒的怪不會回來。" : "系統：你死了。……算了，當我沒看到，再給你一次機會。");
    }
  },
};
// 元素反應（第 3 批）：第一次觸發某種反應時，系統順便解釋一下
const REACT_TIP = {
  wildfire: "系統：大火！黏液和油遇到火會燒得更兇，還會傳給旁邊的。",
  chain: "系統：感電連鎖！潮濕的傢伙會導電，旁邊濕的一起被電。",
  steam: "系統：蒸氣。水把火澆熄了，冒出來的熱霧還是會燙。",
  toxic: "系統：毒氣爆炸！中毒的再點火，砰。",
  stuck: "系統：麻痺黏住。黏液導電，牠會黏在原地動不了。",
};
setStatusContext({
  enemies,
  atk: () => player.stats.atk,
  burnMul: () => 1 + 0.6 * rank("star", "s_fire"),     // 技能樹：星火
  poisonMul: () => 1 + 0.6 * rank("bat", "b_fang"),     // 技能樹：毒牙
  poisonDur: () => 1 + 0.4 * rank("bat", "b_toxic"),    // 技能樹：劇毒
  shockBonus: () => player.form === "can" && rank("can", "c_volt") > 0,   // 技能樹：帶電衝撞
  chainExtra: () => rank("can", "c_conduct") > 0,        // 技能樹：導電體
  wildR: () => 1 + 0.3 * rank("slime", "g_fuel"),      // 技能樹：易燃體質
  onReaction(kind, e) {
    profile.react ??= {};
    if (!profile.react[kind]) { profile.react[kind] = 1; sayQueue.push([REACT_TIP[kind], 3]); }
    reactPop(kind, e);
  },
});
/** 反應名稱從敵人頭上彈出來（像原神的反應字）：DOM 字，跟著畫面縮放算位置 */
function reactPop(kind, e) {
  const R = REACTION[kind], k = canvas.clientWidth / W, b = e.box();
  const el = document.createElement("div");
  el.className = "react-pop";
  el.textContent = R.name;
  el.style.color = R.col;
  el.style.left = canvas.offsetLeft + (e.x - camX) * k + "px";
  el.style.top = canvas.offsetTop + (b.y0 - 6 - camY) * k + "px";   // 大地圖：扣掉鏡頭的高度（原本沒扣，鏡頭不在最上面時字跑到畫面外）
  $("stage").appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

let boomDepth = 0;

// ---- 王（1-4）：給 boss.js 用的操作、畫面下方的血條、大招橫幅
if (STAGE_ID === "1-4") prepareBoss();   // 先把王的動畫烘好，開打時才不會卡
const bossBar = $("bossBar"), bossFill = $("bossFill"), bossLag = $("bossLag");
const bossApi = {
  player,
  get lock() { return director?.lock ?? { l: WALL, r: LEVEL_W - WALL }; },
  platforms: { top: STAGE.arena?.top ?? PLATFORMS[2] },
  hurt: (dmg, fromX) => player.hurt(dmg, fromX, world),
  say: (msg, sec) => sayQueue.unshift([msg, sec]),
  line: (msg, sec) => toast(msg, sec),
  spawnSlime: (x) => stageApi.spawnEnemy("slime", x, STAGE.arena?.floor),
  dropCoins: (x, y, n) => world.dropCoins(x, y, n),
  dropLoot(x) {
    // 王倒下的地方出現一個星箱（最高級），戰鬥結束後走過去開
    chest = makeChest(Math.max(WALL + 30, Math.min(geo.w - WALL - 30, x)), 3, STAGE.arena?.floor ?? FLOOR);
    flash(chest.x, chest.y - 12, 90, 3, 0.8, "#d08cff");
    sayQueue.unshift(["系統：……王掉了一個星箱。走過去，按【攻擊】打開它。", 3]);
  },
  absorb() {
    gainXp(160);
    sayQueue.unshift(["系統：吸收了大胃王吞下去的星星碎片！……你又亮了一點點。", 3]);
  },
  bar(k, phase) {
    bossBar.classList.add("on");
    bossFill.style.width = k * 100 + "%";
    bossLag.style.width = k * 100 + "%";
    bossBar.dataset.phase = phase;
    if (k <= 0) setTimeout(() => bossBar.classList.remove("on"), 1200);
  },
  ult(name) {
    const el = $("bossUlt");
    el.textContent = name;
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    $("bossDim").classList.remove("on"); void $("bossDim").offsetWidth; $("bossDim").classList.add("on");
  },
};

// ================= 城鎮：碎星鎮 =================
// 公會等級：完成的任務數
const RANKS = [["F", 0], ["E", 3], ["D", 8], ["C", 15], ["B", 25], ["A", 40], ["S", 60]];
function rankOf(done) { let r = "F"; for (const [n, need] of RANKS) if (done >= need) r = n; return r; }
const nextRank = (done) => RANKS.find(([, need]) => need > done);

/** 換場景：存檔、淡出、重新載入 */
const AUTO_KEY = "zero-hero-auto";
function goScene(next, stageId) {
  if (!TOWN && next === "town" && profile.meal) profile.meal = null;   // 料理的效果只到這趟冒險結束
  save(profile, true);
  sessionStorage.setItem(NEXT_KEY, next);
  if (stageId) sessionStorage.setItem(STAGE_KEY, stageId);
  sessionStorage.setItem(AUTO_KEY, "1");   // 下一個場景直接開始，不再顯示「點擊開始」
  $("fade").classList.add("on");
  setTimeout(() => location.replace(location.pathname), 380);   // 拿掉網址上的開發用參數
}

let prevAtk = false, near = null, busy = false, stuckT = 0;
const folk = TOWN ? createFolk(FLOOR) : null;   // 路人
window.__game.folk = folk;
if (TOWN) {
  spawn(frogFx, { x: 548, y: FLOOR, seed: 3, light: 0.2 }, { keep: true, layer: "back" });
}
// ---- 任務：進度、獎勵、左上的追蹤框
function grant(r) {
  if (r.coins) profile.coins += r.coins;
  if (r.scrap) profile.scrap += r.scrap;
  if (r.xp) gainXp(r.xp);
  save(profile);
}
/** inDialog：正在跟 NPC 對話時，主線完成不排進右上的系統訊息（會排在別句後面、晚很久才出來），改成回傳台詞讓對話當場講 */
function questProgress(ev, d, inDialog = false) {
  const r = questEvent(profile, ev, d), lines = [];
  for (const q of r.guild) sayQueue.push([`系統：公會任務「${q.title}」完成！回公會找波波交付。`, 2.6]);
  for (const q of r.sys) {
    grant(q.reward); sfx("chime");
    const line = `主線「${q.title}」完成。${q.say}（${rewardText(q.reward)}）`;
    if (inDialog) lines.push(line);
    else sayQueue.unshift(["系統：" + line, 3.6]);   // 使用者 2026-11-06：主線完成插到最前面，馬上講
  }
  renderTracker();
  save(profile);
  return lines;
}
const trackEl = $("qtrack");
function renderTracker() {
  const Q = profile.quests, I = (n) => `<img class="ico" src="${iconURL(n, 2)}" alt="">`;
  // 使用者 2026-11-06：第一行固定是主線（系統任務，金色「主線」），下面是追蹤中的那一個支線（公會任務）
  const sysNow = sysActive(profile);
  const keep = (Q.tracked ?? Q.active.slice(0, 1).map((q) => q.id)).filter((k) => Q.active.some((q) => q.id === k)).slice(0, 1);
  Q.tracked ??= [];
  Q.tracked.splice(0, Q.tracked.length, ...keep);   // 原地改（任務視窗拿著同一個陣列）
  // 使用者 2026-11-06：主線（系統）、支線（公會）用圖示分，不寫字——主線＝系統的星、支線＝公會的盾
  const lines = sysNow.map((s) => `<div class="sys" title="主線">${I("xp")}${s.title}</div>`);
  for (const k of Q.tracked) {
    const q = Q.active.find((x) => x.id === k), L = questLook(q), ok = q.have >= q.need;
    lines.push(`<div class="${ok ? "ok" : ""}" title="支線">${I("guild")}${L.label}　<b>${ok ? "✓" : q.have + "/" + q.need}</b><i class="qbar"><em style="width:${Math.min(100, (q.have / q.need) * 100)}%"></em></i></div>`);
  }
  const m = MEALS[profile.meal];
  if (m) lines.push(`<div class="meal">${I(m.icon)}${m.buff[1]}</div>`);
  if (!Q.tracked.length && Q.active.length) lines.push(`<div class="hint">${I("paper")}點這裡選要追蹤的支線</div>`);
  const html = lines.join("");
  if (html !== trackEl.innerHTML) {
    trackEl.innerHTML = html;
    trackEl.classList.remove("dim");
    clearTimeout(renderTracker.t);
    renderTracker.t = setTimeout(() => trackEl.classList.add("dim"), 3000);
  }
  trackEl.classList.toggle("empty", !lines.length);
}
initTownUI({
  profile, sfx, grant, unlocked,
  RANK: () => [rankOf(profile.guild.done), nextRank(profile.guild.done)],
  afterChange: () => { refreshStats(); renderTracker(); },
  openBag: () => inv.show(),
  onQuest: () => questProgress("tick"),
  flash: (col) => flash(player.x, FLOOR - 20, 80, 3, 0.5, col),
  shake: (t, a) => shake(t, a),
  inTown: TOWN,
  onTree: () => { save(profile); buildFormHud(); },
  curForm: () => player.form,
  inCombat: () => !TOWN && inCombat,
  onCarry: () => { save(profile); buildFormHud(); },
  // 形態的全身像（canvas），k＝放大倍數（CSS 放大，像素不糊）
  portrait: (id, k = 1) => {
    const f = makeFrame(40, 34), c = document.createElement("canvas"), im = new ImageData(40, 34);
    c.width = 40; c.height = 34; c.className = "fm-cv"; c.style.width = 40 * k + "px"; c.style.height = 34 * k + "px";
    paintStar(f, 20, 31, POSES.stand, false, { glow: 0, form: id });
    composite(f, im.data, null);
    c.getContext("2d").putImageData(im, 0, 0);
    return c;
  },
});
trackEl.addEventListener("click", (e) => { e.stopPropagation(); if (started && !dialog.open && !busy) openQuests(false, profile.quests.tracked?.length ? "guild" : "sys"); });
renderTracker();
$("btnQuest").style.backgroundImage = `url(${iconURL("paper", 2)})`;
$("btnQuest").addEventListener("click", (e) => { e.stopPropagation(); if (started && !dialog.open && !busy) { sfx("ui"); openQuests(false); } });
// 技能樹（第 4 批）：左上角，有沒花掉的點數時亮一顆點
$("btnTree").style.backgroundImage = `url(${iconURL("star", 2)})`;
const openTreeNow = () => { if (started && !dialog.open && !busy && !isWinOpen() && !inv.open) { sfx("ui"); openTree(player.form); } };
$("btnTree").addEventListener("click", (e) => { e.stopPropagation(); openTreeNow(); });
// 使用者 2026-11-06：「形態」頁併進技能樹視窗（第一個分頁，只能換帶哪幾個，不能在這裡變身）；G 鍵直接開到那一頁
addEventListener("keydown", (e) => { if (e.code === "KeyG" && !e.repeat && started && !dialog.open && !busy && !isWinOpen() && !inv.open) { sfx("ui"); openTree(player.form, "carry"); } });
addEventListener("keydown", (e) => { if (e.code === "KeyT") openTreeNow(); });
// ---- 使用者 2026-11-06：城鎮各功能的引導，一次只引導一件事：波波（登記）→ 任務板 → 岩叔的工坊 → 菇媽的旅館 → 路標（世界地圖）
//   profile.tguide：0 找波波、1 任務板、2 工坊、3 旅館、4 路標、5 講完了。要去的地方頭上跳一個「!」；第一次打開那個視窗時主要按鈕閃一下
//   舊存檔（已經登記、交過任務）直接當作講完了
const GUIDE_TARGET = [186, 186, 404, 752, 924], GUIDE_HEAD = [40, 40, 62, 58, 44];   // 引導中的那個人不講閒聊泡泡（會蓋住「!」）
const GUIDE_LINE = [null, null, "系統：下一站，岩叔的工坊。", "系統：再來是菇媽的旅館。", "系統：準備好了就去最右邊的路標。"];
profile.tguide ??= profile.guild.registered && profile.guild.done > 0 ? 5 : profile.guild.registered ? 1 : 0;
const guideStep = () => profile.tguide;
const guideAt = (k) => TOWN && profile.tguide === k;
function guideNext(line) {
  profile.tguide++;
  save(profile, true);
  for (let i = sayQueue.length - 1; i >= 0; i--) if (sayQueue[i][2] === "guide") sayQueue.splice(i, 1);   // 還沒講到的上一步提示就不講了
  if (line) sayQueue.push([line, 3.4, "guide"]);
}
/** 剛打開的視窗裡第一顆主要按鈕閃一下（告訴玩家先按哪裡） */
function guideFlash() {
  setTimeout(() => {
    const b = document.querySelector(".win:not(.hidden) .win-box .ibtn:not(:disabled):not(.mini):not(.win-x), .win:not(.hidden) .win-box .pbtn:not(:disabled)");
    if (!b) return;
    b.classList.add("guide-pulse");
    setTimeout(() => b.classList.remove("guide-pulse"), 4200);
  }, 450);
}
/** 城鎮畫面：引導目標頭上跳一個「!」 */
function drawGuideMark(frame) {
  const k = profile.tguide;
  if (!TOWN || dialog.open || busy) return;
  // 使用者 2026-11-06：有支線任務可以交的時候，波波頭上一個紅色大驚嘆號（比引導的「!」大一倍）
  if (profile.quests.active.some(isReady) && k !== 0) {
    const bob = Math.round(Math.abs(Math.sin(sceneClock * 4)) * -4);
    drawAlert(frame, GUIDE_TARGET[0], FLOOR - GUIDE_HEAD[0] + 12 + bob, 0.35, true, 2.55);   // 使用者 2026-11-06：再縮小 15%（3 → 2.55）
    if (k === 1 || k === 0) return;
  }
  if (k >= 5) return;
  const x = GUIDE_TARGET[k], bob = Math.round(Math.abs(Math.sin(sceneClock * 3.2)) * -3);
  drawAlert(frame, x, FLOOR - GUIDE_HEAD[k] + bob, 0.35);
}
function townArrive() {
  refreshBoard(profile.quests, unlocked());
  questProgress("tick");
  if (profile.guild.rankUp) {
    toast(`系統：公會等級升到 ${profile.guild.rankUp} 級！`, 3);
    delete profile.guild.rankUp;
    save(profile);
  } else toast("碎星鎮", 2);
  if (!profile.guild.registered) sayQueue.push(["系統：這裡是碎星鎮。先去左邊的公會找波波。", 3.2]);
  else if (GUIDE_LINE[guideStep()]) sayQueue.push([GUIDE_LINE[guideStep()], 3.2]);
}
function townTick(dt) {
  updateLight(dt);
  // 使用者 2026-11-05 回報：打完王回城鎮方向鍵不能動——看門狗：busy／對話中是真，但畫面上其實沒有對話框、視窗、背包開著，超過 1.5 秒就解除
  const shown = !$("dlg").classList.contains("hidden") || isWinOpen() || inv.open || !!$("worldWin");
  if ((busy || dialog.open) && !shown) { stuckT += dt; if (stuckT > 1.5) { console.warn("城鎮操作卡住，自動解除", { busy, dialog: dialog.open }); busy = false; dialog.open = false; stuckT = 0; } } else stuckT = 0;
  if (!dialog.open && !busy) {
    // 城鎮不能戰鬥：攻擊鍵＝對話，技能、大招不能用
    const atk = input.attack;
    input.attack = false;
    consume("skill"); consume("ult");
    player.update(dt, world);
    player.x = Math.max(20, Math.min(TOWN_W - 20, player.x));
    props.update(dt, propMovers(), propView());
  scenery.update(dt, player, propView());
    folk.update(dt, player.x);
    near = nearby(player.x) ?? folk.nearby(player.x);
    if (document.body.classList.contains("near") !== !!near) document.body.classList.toggle("near", !!near);   // 互動鍵：旁邊有人才亮
    if (atk && !prevAtk && near && player.grounded) interact(near);
    prevAtk = atk;
  } else { player.vx = 0; prevAtk = true; }
  drops.update(dt, player, 16, pickUp);
  if (!TOWN) updateAbsorb(dt);
  updateFx(dt);
  const v = viewRect();
  camX = deadFollow(camX + W / 2, player.x + lookAhead(dt, 30), 14, 5, dt) - W / 2;   // 使用者 2026-11-05：鏡頭太晃 → 死區＋轉身慢慢滑
  camX = Math.max(-v.x0, Math.min(TOWN_W - v.x0 - v.w, camX));   // 照看得到的範圍停（放大後畫布邊緣是裁掉的）
  updateSay(dt);
  updateBubble(dt);
}
// 路人泡泡：畫面裡的居民偶爾自言自語（不能是正在旁邊可以對話的那個，頭上已經有「！」）
const AMBIENT = {
  clerk: ["（推眼鏡）今天的委託也很多呢。", "請排隊……啊，只有你一個。", "公會的茶，是我泡的。……喝嗎？"],
  golem: ["……（鏘）", "……星塵。越多越好。", "……爐子，今天很旺。"],
  mushroom: ["今天的湯是蘑菇湯～不是親戚喔。", "累了就來休息吧～", "頭上的孩子們又長高了呢～"],
};
const bubbleEl = $("bubble"), bubbleText = $("bubbleText");
let bubbleWho = null, bubbleT = 0, bubbleWait = 3;
function updateBubble(dt) {
  if (dialog.open || busy) { bubbleEl.classList.remove("on"); bubbleWho = null; return; }
  if (bubbleWho) {
    if ((bubbleT -= dt) <= 0 || bubbleWho === near || bubbleWho === near?.folk) { bubbleEl.classList.remove("on"); bubbleWho = null; bubbleWait = 5 + Math.random() * 4; }
  } else if ((bubbleWait -= dt) <= 0) {
    const seen = [...NPCS, ...folk.list.filter((o) => !o.follow)].filter((n) => n !== near && n !== near?.folk && !(profile.tguide < 5 && n.x === GUIDE_TARGET[profile.tguide]) && !(n.x === GUIDE_TARGET[0] && profile.quests.active.some(isReady)) && n.x > camX + viewRect().x0 + 20 && n.x < camX + viewRect().x0 + viewRect().w - 20);
    if (seen.length) {
      bubbleWho = seen[Math.floor(Math.random() * seen.length)];
      const L = AMBIENT[bubbleWho.id] ?? FOLK_INFO[bubbleWho.id].ambient;
      bubbleText.textContent = L[Math.floor(Math.random() * L.length)];
      bubbleEl.classList.add("on");
      bubbleT = 3.2;
    } else bubbleWait = 2;
  }
  if (bubbleWho) {
    // 世界座標 → 螢幕座標（畫布有放大）
    const r = canvas.getBoundingClientRect(), k = r.width / W, sr = $("stage").getBoundingClientRect();
    const head = FLOOR - npcSize(bubbleWho.id)[1] - 4;
    bubbleEl.style.left = r.left - sr.left + (bubbleWho.x - camX) * k + "px";
    bubbleEl.style.top = r.top - sr.top + head * k + "px";
  }
}
// 可以對話時，頭上出現一個跳動的「！」
function drawPrompt() {
  if (!near || dialog.open) return;
  drawBang(near.x, near.place === "sign" ? 140 : FLOOR - (near.h ?? npcSize(near.id)[1]) - 12);
}
/** 頭上跳動的「！」：(x, top) 世界座標。城鎮的對話、關卡裡可以互動的東西都用這個 */
function drawBang(wx, top) {
  const bob = Math.floor(sceneClock * 4) % 2, x0 = Math.round(wx) - frame.ox - 1, y0 = Math.round(top) - bob - frame.oy;
  const C1 = hex("#ffd84a") >>> 0, C0 = hex("#2a1626") >>> 0;
  for (let y = -1; y <= 9; y++) for (let x = -1; x <= 3; x++) {
    const on = x >= 0 && x <= 2 && ((y >= 0 && y <= 5) || (y >= 7 && y <= 8)) && (x === 1 || y <= 5);
    const px = x0 + x, py = y0 + y;
    if (px < 0 || py < 0 || px >= frame.w || py >= frame.h) continue;
    if (on) frame.color[py * frame.w + px] = C1;
  }
  for (let y = 0; y <= 8; y++) if (y !== 6) { const px = x0 + 1, py = y0 + y; if (px >= 0 && py >= 0 && px < frame.w && py < frame.h) frame.color[py * frame.w + px] = C1; }
  void C0;
  // 下方的「按○和○○說話」提示框拿掉了（使用者 2026-11-05）：頭上的「！」和發亮的對話鍵就夠了
}
async function interact(n) {
  busy = true;
  try {
    if (n.folk) { n.folk.talking = true; await talk(n.name, folk.lines(n.folk)); n.folk.talking = false; }
    else if (n.place === "guild") await guild(n.name);
    else if (n.place === "workshop") await workshop(n.name);
    else if (n.place === "inn") await inn(n.name);
    else await travel();
  } finally { busy = false; }
}
// 右邊的路標：選要去的地方（公會任務在外面做，回來再交付）
window.__game.travel = () => travel();   // 開發用：直接打開選關地圖
async function travel() {
  if (guideAt(4)) guideNext(null);
  const NOTE = { "1-1": "主角掉下來的地方，系統教你怎麼打", "1-2": "垃圾桶怪很多", "1-3": "蝙蝠群、菁英", "1-4": "王：大胃王史萊姆" };
  if (!profile.quests.active.length && profile.guild.registered) await talk("系統", ["……你沒接公會任務喔。打怪是可以，但沒有人會付錢給你。"]);
  // 使用者 2026-11-06：選地圖要有地圖介面與圖片，不能是文字 → 墜星之谷的像素地圖（worldmap.js）
  const v = await openWorldMap({ profile, unlocked: unlocked(), layouts: LAYOUTS, notes: NOTE, sfx });
  if (v?.startsWith?.("stage:")) goScene("stage", v.slice(6));
  else if (v === "endless") goScene("endless");
}
async function guild(name) {
  const G = profile.guild;
  if (!G.registered) {
    await talk(name, ["歡迎來到冒險者公會碎星鎮分部。我是櫃檯的波波。", "要登記冒險者嗎？請在這裡填寫……種族？"]);
    await talk("系統", ["填「發光的五角形」應該就好。"]);
    await talk(name, ["……好的，星靈。", "這是你的冒險者證，等級 F。完成任務就會升級喔。", "（推眼鏡）別擔心，大家一開始都是 F。……大部分的人啦。"]);
    G.registered = true;
    if (guideStep() === 0) profile.tguide = 1;
    save(profile, true);
  }
  // 使用者 2026-11-06：主線完成（例如登記冒險者）當場由系統講，不要等關掉視窗才跳出來
  const done = questProgress("tick", null, true);
  if (done.length) await talk("系統", done);
  const before = rankOf(G.done);
  const firstBoard = guideAt(1);
  if (firstBoard) await talk(name, ["任務都貼在任務板上，想接幾張都可以。", "不過一次只能追蹤一個——點任務右邊的星星，它就會顯示在你的頭像下面。", "做完再回來找我交付喔。"]);
  else await talk(name, [G.done === 0 && !profile.quests.active.length ? "任務都貼在任務板上，挑喜歡的接吧。做完再回來找我交付喔。" : "（推眼鏡）任務板在這裡。"]);
  const qp = openQuests(true);
  if (firstBoard) guideFlash();
  await qp;
  if (firstBoard) guideNext("系統：下一站，岩叔的工坊。撿到用不到的裝備，可以拿去那裡拆掉、把身上的打強一點。");
  if (rankOf(G.done) !== before) {
    await talk(name, [`恭喜！冒險者等級升到 ${rankOf(G.done)} 級了。`, "（推眼鏡）……我就知道你可以。大概。"]);
    questProgress("tick");
  }
}
async function workshop(name) {
  const first = guideAt(2);
  if (first) await talk(name, ["……新來的？我是岩叔。", "用不到的裝備拿來，拆了變碎屑。碎屑拿來強化你身上穿的。", "……要重鑄、合成，也在這裡。"]);
  else await talk(name, ["……要打什麼？"]);
  const fp = openForge();
  if (first) guideFlash();
  await fp;
  refreshStats();
  if (first) guideNext("系統：再來是旅館。菇媽那裡可以睡一晚、吃點東西。");
}
const INN_CHAT = [
  "以前這裡只是隕石坑旁邊的小村子。星星掉下來以後，冒險者就變多了。",
  "野外的史萊姆會咬人？哎呀，我家隔壁的史萊姆很乖的。是那些碎片害的啦。",
  "岩叔看起來很兇，其實他會偷偷幫小孩修玩具喔。",
  "波波每天都推眼鏡推一千次。我數過。",
  "你是星靈？那你晚上會發光嗎？省電耶。",
];
async function inn(name) {
  const firstInn = guideAt(3);
  if (firstInn) {
    await talk(name, ["哎呀，新面孔～我是菇媽。", "累了就來睡一晚，血會回滿，公會的任務板也會換一批新的喔。", "出門前吃一道料理，會有加成～"]);
    guideNext("系統：最後，鎮子最右邊的路標。準備好了就去那裡選要去哪。");
  }
  // 使用者 2026-11-06：跟公會一樣，講完話直接跳旅館介面，不用再選選項（聊天的話改成有時候當招呼講）
  else await talk(name, [Math.random() < 0.4 ? INN_CHAT[Math.floor(Math.random() * INN_CHAT.length)] : "哎呀，歡迎光臨～要休息還是吃點東西？"]);
  if (firstInn) guideFlash();   // 第一次打開：「睡一晚」閃一下
  await openInn({
    rest: async () => {
      player.hp = player.maxHp;
      refreshBoard(profile.quests, unlocked(), true);
      save(profile, true);
      $("fade").classList.add("on");
      await new Promise((r) => setTimeout(r, 600));
      $("fade").classList.remove("on");
      await talk(name, ["睡得好嗎？生命全滿，也幫你存好檔了。", "對了，公會的任務板好像換新了喔～"]);
    },
  });
  refreshStats();
}
const SHOT_PAL = {
  star: { fx: PAL.gold, boom: PAL.gold, accent: PAL.holy, light: "#ffd27a", r: 46, push: 3 },
  slime: { fx: PAL.poison, boom: PAL.poison, accent: PAL.leaf, light: "#7ee86a", r: 62, push: 5 },
};
// ---- 傳說保底：菁英 0.5%，每隻沒掉傳說的菁英 +0.5%
function eliteLegend() {
  profile.pity ??= { legend: 0, myth: 0 };
  if (Math.random() < 0.005 * (1 + profile.pity.legend)) { profile.pity.legend = 0; return true; }
  profile.pity.legend++;
  return false;
}
// ---- 神話：身上的神話、覺醒（穿著擊殺累積，到 300／1000 升階，解鎖一段故事）
const mythOn = (id) => Object.values(profile.equip).find((it) => it?.myth === id);
function mythKill() {
  for (const it of Object.values(profile.equip)) {
    if (!it?.myth) continue;
    const before = awakenStage(it);
    it.awaken.kills++;
    const after = awakenStage(it);
    if (after > before) {
      const M = MYTHS[it.myth];
      toast(`${M.name} 覺醒到第 ${after} 階！`, 2.6);
      sayQueue.push([`系統：${M.lore[after - 1]}`, 4]);
      flash(player.x, player.y - 14, 120, 4, 0.6, "#fff0a0"); shake(0.3, 3); sfx("levelup");
      // 第 7 批：覺醒特效——跟升級一樣的金色光柱，字換成 AWAKEN
      spawn(levelUpFx, { x: Math.round(player.x), y: Math.round(player.y), light: 0.55, seed: after * 7, text: "AWAKEN!", palette: ["#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff"] });
      refreshStats();
    }
  }
}
/** 墜落之心：切換形態時，原地爆出前一個形態的元素 */
function heartBurst(from) {
  const it = mythOn("fallheart");
  if (!it) return;
  const st = awakenStage(it), r = st >= 2 ? 60 : 40, mult = st >= 3 ? 1.6 : 0.8, el = ELEM[from];
  const pal = { burn: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], slime: PAL.poison, shock: ["#0c2a60", "#1e64b0", "#3ab8f0", "#9af0ff", "#f0ffff", "#ffffff"], poison: ["#1a0a2a", "#3e1466", "#6a28a8", "#8ae040", "#e8ff70", "#ffffff"] }[el];
  spawn(explosion, { x: Math.round(player.x), y: Math.round(player.y - 10), palette: pal, accent: pal, light: 0.6, seed: (Math.random() * 99) | 0 }, { speed: 1.6 });
  flash(player.x, player.y - 10, r * 2, 3, 0.3, pal[4]);
  world.hitArea({ x0: player.x - r, x1: player.x + r, y0: player.y - r, y1: player.y + 10 }, () => player.roll(mult), player.face, { push: 3, elem: el });
}
// ---- 史詩套裝「流星獵手」4 件：暴擊標記，5 秒內再暴擊同一隻 → 掉一顆小流星（攻擊力 80%）
/** 通關後在傳送門按互動：回碎星鎮 */
function leaveStage() {
  leaving = true;
  sfx("form");
  flash(portalX, portalY - 16, 90, 3, 0.5, "#a8f0ff");
  if (clearReport) sessionStorage.setItem("zero-hero-clear", JSON.stringify(clearReport));   // 下一個場景的載入畫面播通關成績
  goScene("town");
}
function updateAltars() {
  for (const a of altars) if (a.pulse > 0) a.pulse = Math.max(0, a.pulse - STEP / 0.8);
}
/** 在星之祭壇按互動：生命、魔力回滿，設成重生點 */
function useAltar(a) {
  player.hp = player.maxHp; player.mp = player.maxMp;
  checkpoint = a;
  if (!a.lit) {
    a.lit = true;
    spawn(collectBurst, { x: a.x, y: a.y - 18, palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], light: 0.6 });
    flash(a.x, a.y - 16, 110, 3, 0.8, "#ffe066"); sfx("levelup");
    toast("星之祭壇：啟動", 1.8);   // 使用者 2026-11-06：存檔點只顯示啟動，不寫效果
  } else { flash(a.x, a.y - 16, 60, 2, 0.3, "#ffe066"); sfx("chime"); toast("星之祭壇：啟動", 1.4); }
}
/** 星核效果每幀：沉重（被打飛的撞到別人）、彗尾（衝刺留星光）、鈍光（暈眩計時） */
function updateCoreFx(dt) {
  for (const e of enemies) {
    if (e.dizzyT > 0) e.dizzyT -= dt;
    if (!(e.flungT > 0) || e.dead) continue;
    e.flungT -= dt;
    if (Math.abs(e.vx) < 40) continue;
    for (const o of enemies) if (!o.dead && !e.flungHit.has(o) && overlaps(e.box(), o.box())) { e.flungHit.add(o); o.hit({ dmg: e.flungDmg, crit: false }, Math.sign(e.vx), { push: 3 }, world); }
  }
  const x = player.core("comet");
  if (comet && player.state === "dash" && x) trail.push({ x: player.x, y: player.y - 10, t: 0, seed: trail.length * 7 + (sceneClock * 60 | 0) });
  else if (player.state !== "dash") comet = null;
  for (const p of trail) {
    p.t += dt;
    if (!comet || p.t > 0.45) continue;
    for (const e of enemies) if (!e.dead && !comet.hit.has(e) && overlaps({ x0: p.x - 6, x1: p.x + 6, y0: p.y - 14, y1: p.y + 10 }, e.box())) { comet.hit.add(e); e.hit(player.roll(x / 100), player.face, { push: 1 }, world); }
  }
  for (let i = trail.length - 1; i >= 0; i--) if (trail[i].t > TRAIL_T) trail.splice(i, 1);
}
function onCritHit(e, r) {
  // 星核「尖銳」：暴擊時多打一次星光傷害
  if (r?.crit && player.core("sharp") && !e.dead) e.hit({ dmg: r.dmg * player.core("sharp") / 100, crit: false }, player.face, { push: 0 }, world);
  if (!r?.crit || !player.set4("meteor") || !e.box) return;
  if (e.meteorMark > 0) { e.meteorMark = 0; strikes.push({ x: e.x, y: (e.box().y0 + e.box().y1) / 2, t: 0, e }); }
  else e.meteorMark = 5;
}
// ---- 技能樹：技能彈爆開之後的追加效果
function skillTreeBoom(s) {
  const x = s.x, y = s.y;
  if (s.form === "star" && rank("star", "s_rain")) {
    // 星雨：1 秒後天上落下一陣小星屑（pixelfx arcane/star-fall），範圍內每顆打一次
    const fy = floorAt(x, y - 8);   // 8b：落在爆炸位置底下的地面
    setTimeout(() => {
      spawn(starFallFx, { x: Math.round(x), y: fy, palette: PAL.gold, light: 0.4, seed: (Math.random() * 99) | 0 }, { speed: 1.2 });
      for (let k = 0; k < 4; k++) setTimeout(() => world.hitArea({ x0: x - 50, x1: x + 50, y0: fy - 60, y1: fy }, () => player.roll(0.6 * player.skillMul()), s.dir, { push: 1 }), 150 + k * 180);
    }, 1000);
  }
  if (s.form === "slime") {
    if (rank("slime", "g_bounce")) world.spawnShotlet(x, y, s.dir, "slime", { mult: 0.6, life: 0.3 });
    if (rank("slime", "g_ground")) hazards.addTemp({ type: "goo", x: Math.round(x), y: floorAt(x, y - 8), w: 40, ttl: 3 });
    if (rank("slime", "g_split")) for (const vy of [-140, 0, 140]) world.spawnShotlet(x, y, vy ? s.dir : -s.dir, "slime", { vy, mult: 0.5, life: 0.28 });
  }
}
// ---- 大招：使用者 2026-11-05 改成「不需要能量，只消耗魔力」（ULT_MP）。原本打怪累積能量的呼叫留著，但不做事
function chargeUlt() {}
let ultCd = 0;   // 放完 1 秒內不能再放
const ultReady = () => player.mp >= ULT_MP && !ult.on && ultCd <= 0;
let ultTipped = false;
const ultHooks = {
  // 衝擊波掃到的怪：每隻只打一次
  wave(x0, x1, tx) {
    let n = 0;
    for (const e of enemies) {
      if (e.dead || ult.hitSet.has(e) || e.x < x0 || e.x > x1 || Math.abs(e.y - (ult.fy ?? e.y)) > 130) continue;   // 8b：只打同一層附近的
      ult.hitSet.add(e);
      e.hit(player.roll(ULT_MULT * (1 + player.stats.ult / 100) * ultPassive()), e.x < tx ? -1 : 1, { launch: true, push: 4 }, world);
      n++;
    }
    if (n) addCombo(n);
  },
  dust: (x, y) => { world.dust(x, y, 6); sfx("ultHit"); },
  // 形態大招（ult-forms.js）用的
  enemies: () => enemies.filter((e) => !e.dead),
  hit(e, mult, dir, opts) { if (e.dead) return; e.hit(player.roll(mult * (1 + player.stats.ult / 100) * ultPassive()), dir, opts, world); addCombo(1); },
  view: () => { const v = viewRect(); return { l: camX + v.x0, r: camX + v.x0 + v.w, top: camY + v.y0 }; },   // 大招只打看得到的範圍
  puddle: (x, y) => hazards.addTemp({ type: "goo", x: Math.round(x), y, w: 44, ttl: 6 }),
  heal: (k) => { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * k); },
};
bindUltHooks(ultHooks);
window.__game.ultFull = () => (player.mp = player.maxMp);
window.__game.addCombo = (n) => addCombo(n);   // 開發用：測連擊補魔力
window.__game.giveCore = (id) => absorb(makeCore(id));
function addCombo(n) {
  // 使用者 2026-11-05：連擊每滿 10 下給 COMBO_MP 魔力（自然回復只剩 10%，魔力主要靠打出來）
  const gain = Math.floor((stats.combo + n) / 10) - Math.floor(stats.combo / 10);
  if (gain > 0 && player.mp < player.maxMp) {
    player.mp = Math.min(player.maxMp, player.mp + gain * COMBO_MP);
    const k = canvas.clientWidth / W, pop = document.createElement("div");
    pop.className = "react-pop manaup"; pop.textContent = `+${gain * COMBO_MP} 魔力`;
    pop.style.left = canvas.offsetLeft + (player.x - camX) * k + "px"; pop.style.top = canvas.offsetTop + (player.y - camY - 30) * k + "px";
    $("stage").appendChild(pop); setTimeout(() => pop.remove(), 900);
    const b = $("mpBar"); b.classList.remove("gain"); void b.offsetWidth; b.classList.add("gain");
  }
  stats.combo += n;
  stats.comboT = 2.2;
  stats.best = Math.max(stats.best, stats.combo);
  if (stats.combo >= 50 && stats.combo - n < 50) toast("系統：50 連擊！……我開始有點興奮了。");
  if (stats.combo >= 100 && stats.combo - n < 100) toast("系統：100 連擊！這不科學！");
}

// ---- 敵人生成：越打越多
let spawnT = 0, maxEnemies = 28;
window.__game.setMax = (n) => { maxEnemies = n; stats.time = 999; };
function spawnEnemies(dt) {
  stats.time += dt;
  const target = Math.min(maxEnemies, 8 + Math.floor(stats.time / 5));
  const alive = enemies.filter((e) => !e.dead).length;
  if ((spawnT -= dt) > 0 || alive >= target) return;
  spawnT = 0.35;
  let x = 0;
  for (let tries = 0; tries < 10; tries++) {
    x = camX + Math.random() * (W + 240) - 120;
    if (Math.abs(x - player.x) > 110) break;
  }
  x = Math.max(WALL + 20, Math.min(LEVEL_W - WALL - 20, x));
  const r = Math.random();
  const e = r < 0.04 ? new Enemy("gold", x, FLOOR) : r < 0.36 ? new Enemy("bat", x, 50 + Math.random() * 60) : new Enemy("slime", x, FLOOR);
  e.awake = true;   // 無限模式：一出來就追
  enemies.push(e);
  world.dust(e.x, e.k.fly ? e.y + 8 : e.y, 4);
}

// 同類敵人互相推開，不要疊成一坨
function separate(dt) {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (a.k.fly !== b.k.fly || a.isBoss || b.isBoss) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.k.w + b.k.w - 4;
      if (Math.abs(dx) < min && Math.abs(dy) < (a.k.fly ? 16 : 6)) {
        const push = (min - Math.abs(dx)) * 0.5 * Math.min(1, 10 * dt) * (dx >= 0 ? 1 : -1) || 0.5;
        a.x -= push;
        b.x += push;
      }
    }
  }
}

// ---- 每一步更新
function tick(dt) {
  tickInput(dt);
  if (juice.shakeT > 0) juice.shakeT -= dt;
  if (juice.freeze > 0) { juice.freeze -= dt; return; }   // 命中停頓：整個世界停住
  // 使用者 2026-11-06「主線完成的提示要等我跳出頁面才跳出來」：視窗開著時遊戲暫停，但系統的話照樣播
  if (!started || inv.open || introOn || isWinOpen() || mapView?.open || !$("setPanel").classList.contains("hidden")) { if (started && !introOn) updateSay(STEP); return; }
  updateCombatFx(dt);
  if (TOWN) { townTick(dt); return; }

  updateLight(dt);
  updateStatus(dt, enemies);   // 元素狀態：持續傷害、倒數、蒸氣霧
  hazards.update(dt, enemies);
  deathFx.update(dt);
  lowHp.k = player.hp > 0 && !(player.hideT > 0) ? player.hp / player.maxHp : 1;
  if (lowHp.k < 0.3) { lowHp.phase += dt * (1.2 + 1.2 * (1 - lowHp.k / 0.3)); if (lowHp.phase >= 1) { lowHp.phase -= 1; sfx("heart"); } lowHp.pulse = beat(lowHp.phase); } else { lowHp.phase = 0.99; lowHp.pulse = 0; }
  // 戰鬥中（附近 240px 有活的敵人），次要的 HUD 變淡；離開戰鬥 2 秒後恢復
  if (enemies.some((e) => !e.dead && Math.abs(e.x - player.x) < 240)) hudFadeT = 2; else hudFadeT -= dt;
  if ((hudFadeT > 0) !== inCombat) { inCombat = hudFadeT > 0; document.body.classList.toggle("combat", inCombat); }
  if (cleared) { updateFx(dt); return; }
  // 大招進行中：世界停住，只有主角、特效和攝影機在動
  if (ult.on) {
    updateUlt(dt, player, ultHooks);
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    updateFx(dt);
    followCam(dt);
    updateSay(dt);
    return;
  }
  if (input.form) { consume("form"); const c = profile.forms.carry; switchForm(c[(c.indexOf(player.form) + 1) % c.length]); }
  for (let i = 0; i < CARRY_MAX; i++) if (input["form" + (i + 1)]) { consume("form" + (i + 1)); switchForm(profile.forms.carry[i]); }
  ultCd -= dt;
  if (!ultTipped && ultReady() && stats.kills >= 3 && (STAGE_ID !== "1-1" || director?.ultOK)) { ultTipped = true; teach("ult"); sayQueue.push(["系統：" + tipFor("魔力夠了就能放大招！按【大招】，讓牠們見識一下零星的厲害。", "魔力夠了就能放大招！按【Q】，讓牠們見識一下零星的厲害。"), 2.6, "ult"]); }   // 排隊，不要蓋掉系統正在講的話
  if (input.ult && !ultReady() && !ult.on) { consume("ult"); if (player.mp < ULT_MP) world.noMana?.("ult"); }
  if (input.ult && ultReady() && player.state !== "hurt") {
    consume("ult");
    player.mp -= ULT_MP; ultCd = 1;
    startUlt(player, director?.lock);
    if (player.set4("reson")) player.resonT = 10;   // 星辰共鳴 4 件
    // 星王之冠：星王化（8 秒，覺醒 2 階 12 秒；3 階退回一半的大招魔力）
    const crown = mythOn("starking");
    if (crown) { const st = awakenStage(crown); player.kingT = st >= 2 ? 12 : 8; if (st >= 3) player.mp = Math.min(player.maxMp, player.mp + ULT_MP / 2); toast("星王化！", 1.6); }
    sfx("ultCharge");
    return;
  }
  useInput();
  player.update(dt, world);
  props.update(dt, propMovers(), propView());
  scenery.update(dt, player, propView());
  updateUniques(dt);
  updateChest(dt);
  updateGems(dt);
  drops.update(dt, player, 16, pickUp);
  if (!TOWN) updateAbsorb(dt);
  if (ENDLESS) spawnEnemies(dt);
  else {
    stats.time += dt;
    { const v = viewRect(); director.update(dt, player, camX + v.x0, v.w); }
    // 戰鬥區封鎖：主角出不去
    if (director.lock) player.x = Math.max(director.lock.l + 10, Math.min(director.lock.r - 10, player.x));
  }
  for (const e of enemies) {
    if (e.dead) continue;
    e.update(dt, player, world);
    if (e.k.dmg && e.stun <= 0 && overlaps(e.box(), { x0: player.x - 8, x1: player.x + 8, y0: player.y - 22, y1: player.y }) && player.hurt(e.k.dmg, e.x, world)) {
      // 撞到人之後自己也彈開，不會黏在主角身上
      e.vx = (e.x >= player.x ? 1 : -1) * 120;
      e.stun = 0.4;
    }
  }
  separate(dt);
  updateCoreFx(dt);
  updateAltars();
  // 特效補強 11：王房封住時，屋頂的破洞被一團垃圾砸進來塞住；王戰中死掉解除封鎖就打開，打倒王之後維持塞住
  const hole = STAGE.arena?.hole;
  if (hole) {
    if (director?.lock && !plug.on) { plug.on = true; plug.t = 0; plug.landed = false; setSolid(hole, true); }
    else if (plug.on && !director?.lock && !stageDone && !director?.done) { plug.on = false; setSolid(hole, false); }
    if (plug.on) { plug.t += dt; if (!plug.landed && plug.t >= 0.3) { plug.landed = true; world.dust(hole.x + hole.w / 2, hole.y, 10); shake(0.3, 3); sfx("clank"); } }
  }
  features?.update(dt);
  for (const e of enemies) {
    if (e.dead) continue;
    // 戰鬥區封鎖時，敵人也出不去
    const lock = director?.lock;
    // 10 批：有王房（真的牆圍起來）的關卡，只夾住王房裡的怪；地圖上其他地方的怪不動
    const inLock = lock && (!STAGE.arena || (e.x > lock.l && e.x < lock.r && e.y > STAGE.arena.floor - 220));   // 大檢查：只算真的在王房裡的（牆外靠牆的蝙蝠不要被拉進來）
    if (inLock && (e.x < lock.l + 12 || e.x > lock.r - 12)) {
      e.x = Math.max(lock.l + 12, Math.min(lock.r - 12, e.x));
      if (e.kind === "gold") e.hopDir = -e.hopDir;
    }
    // 金幣史萊姆 10 秒沒抓到就逃走
    if (e.kind === "gold" && (e.awakeT ?? 0) > 10) {   // 8b：從被發現開始算
      e.dead = true;
      spawn(A.poofGold, { x: Math.round(e.x), y: Math.round(e.y) });
      sayQueue.unshift(["系統：金幣史萊姆逃走了……我的晚餐……", 2.5]);
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);

  // 火球
  for (const s of shots) {
    s.x += s.dir * 290 * dt;
    if (s.vy) s.y = Math.min(floorAt(s.x, s.y) - 6, s.y + s.vy * dt);
    s.life -= dt;
    s.fx.options.x = Math.round(s.x);
    s.fx.options.y = Math.round(s.y);
    let hit = s.life <= 0 || features?.shotAt(s.x, s.y, s.form) || solidAt(s.x, s.y);   // 8b：技能彈撞到地形就爆；8d：先問封印門
    if (!hit) for (const e of enemies) if (!e.dead && e !== s.skip && overlaps(e.box(), { x0: s.x - 8, x1: s.x + 8, y0: s.y - 8, y1: s.y + 8 })) {
      // 技能樹「貫穿」（星星）：穿過第一隻，打到第二隻才爆
      if (s.form === "star" && !s.small && rank("star", "s_pierce") && !s.skip) { s.skip = e; e.hit(player.roll(1.2 * player.skillMul()), s.dir, { push: 2 }, world); continue; }
      hit = true; break;
    }
    if (hit) {
      s.done = true;
      s.fx.stop();
      const P = SHOT_PAL[s.form] ?? SHOT_PAL.star;
      // 技能樹：爆炸範圍（星屑增量／大顆黏液，每級 +15%），小彈範圍小一半
      const big = 1 + 0.15 * (s.form === "slime" ? rank("slime", "g_big") : rank("star", "s_big")), R = P.r * big * (s.small ? 0.55 : 1);
      sfx("boom");
      spawn(explosion, { x: Math.round(s.x), y: Math.round(s.y), palette: P.boom, accent: P.accent, light: GLOW.skill * (s.small ? 0.5 : 1), seed: (Math.random() * 99) | 0 }, { speed: s.small ? 1.8 : 1.3 });
      flash(s.x, s.y, s.small ? 50 : 100, 4, 0.4, P.light);
      world.hitArea({ x0: s.x - R, x1: s.x + R, y0: s.y - 40, y1: s.y + 40 }, () => player.roll(2.4 * s.mult * player.skillMul()), s.dir, { launch: true, push: P.push, elem: ELEM[s.form] ?? "burn" });
      hitStop(s.small ? 0.03 : 0.06);
      shake(s.small ? 0.12 : 0.3, s.small ? 1 : 3);
      if (!s.small) skillTreeBoom(s);
      // 星王化＋黏液星：黏液彈連火一起點（黏液＋燃燒＝大火）
      if (s.form === "slime" && player.kingT > 0) for (const e of world.enemiesIn({ x0: s.x - R, x1: s.x + R, y0: s.y - 40, y1: s.y + 40 })) applyStatus(e, "burn");
    }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  for (const w of waves) {
    w.t += dt; w.x += w.dir * WAVE_V * dt;
    world.hitOnce({ x0: w.x - 8, x1: w.x + 8, y0: w.y - 14, y1: w.y + 14 }, w.hit, () => player.roll(1.0), w.dir, { push: 2 });
  }
  for (let i = waves.length - 1; i >= 0; i--) if (waves[i].t >= WAVE_T) waves.splice(i, 1);
  // 小蝙蝠：飛向最近的敵人咬一口（沾毒），0.6 秒一口，4 秒後飛走
  for (const m of minis) {
    m.t += dt; m.life -= dt; m.cd -= dt;
    const tgt = world.nearestEnemy(m.x, m.y, 160);
    const tx = tgt ? tgt.x : player.x + Math.sin(m.t * 3 + m.seed) * 20, ty = tgt ? (tgt.box().y0 + tgt.box().y1) / 2 : player.y - 30;
    m.vx += Math.sign(tx - m.x) * 600 * dt; m.vy += Math.sign(ty - m.y) * 600 * dt;
    m.vx *= 1 - 3 * dt; m.vy *= 1 - 3 * dt;
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (tgt && m.cd <= 0 && Math.abs(tgt.x - m.x) < 10 && Math.abs(ty - m.y) < 12) { m.cd = 0.6; tgt.hit(player.roll(0.4), m.vx >= 0 ? 1 : -1, { push: 1, elem: "poison" }, world); }
  }
  for (let i = minis.length - 1; i >= 0; i--) if (minis[i].life <= 0) minis.splice(i, 1);
  for (const e of enemies) if (e.meteorMark > 0) e.meteorMark -= dt;
  for (const s of strikes) {
    s.t += dt;
    if (s.t >= STRIKE_T && !s.done) {
      s.done = true;
      spawn(sparkFx, { x: Math.round(s.x), y: Math.round(s.y), palette: ["#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], light: 0.6 });
      flash(s.x, s.y, 50, 2.5, 0.2, "#ffe066"); shake(0.12, 2);
      if (!s.e.dead) s.e.hit(player.roll(s.mult ?? 0.8), player.face, { push: 2 }, world);
    }
  }
  for (let i = strikes.length - 1; i >= 0; i--) if (strikes[i].done) strikes.splice(i, 1);

  // 金幣：先噴出去，再被吸過來
  for (const c of coins) {
    if (c.lay) { lootPhysics(c, dt, () => { stats.coins++; profile.coins++; if (coinSndT <= 0) { sfx("coin"); coinSndT = 0.05; } }); continue; }
    c.t += dt;
    if (c.still) {
      // 高處的金幣：主角靠近才吸過去
      const m = 34;
      if (Math.abs(player.x - c.x) < m && Math.abs(player.y - 12 - c.y) < m) { c.still = false; c.t = 0.45; }
      continue;
    }
    if (c.t < 0.45) {
      c.vy += 700 * dt;
      const py = c.y + 2;
      c.x = moveX(c.x, c.x + c.vx * dt, c.y + 2, 4, 3);
      c.y += c.vy * dt;
      const gy = c.vy >= 0 ? groundAt(c.x, py, c.y + 2) : null;
      if (gy !== null) { c.y = gy - 2; c.vy *= -0.45; c.vx *= 0.6; }
    } else {
      const dx = player.x - c.x, dy = player.y - 12 - c.y, d = Math.hypot(dx, dy) || 1, sp = 120 + (c.t - 0.45) * 900;
      c.x += (dx / d) * sp * dt;
      c.y += (dy / d) * sp * dt;
      if (d < 10) { c.got = true; stats.coins++; profile.coins++; if (coinSndT <= 0) { sfx("coin"); coinSndT = 0.05; } }
    }
  }
  for (let i = coins.length - 1; i >= 0; i--) if (coins[i].got) coins.splice(i, 1);

  updateFx(dt);
  if ((stats.comboT -= dt) <= 0 && stats.combo) stats.combo = 0;

  followCam(dt);
  { const v = viewRect(); mapView?.update(dt, camX + v.x0, camY + v.y0, v.w, v.h); }   // 小地圖：看得到的範圍才算走過
  updateSay(dt);
}
// 攝影機：跟著主角，稍微往面對的方向看
let lookX = 0, camRefY = null, camLand = null;
// 使用者 2026-11-06「進關卡畫面先停在奇怪的地方，鏡頭才移到主角」：主角從上面掉進場，鏡頭直接對準他會落地的地方，落地前不上下跟
function snapCam() {
  if (TOWN || ENDLESS) return;
  const v = viewRect(), gy = floorAt(player.x, Math.max(0, player.y));
  camLand = player.grounded ? null : gy; camRefY = gy; lookX = player.face * 36;
  camX = Math.max(-v.x0, Math.min(LEVEL_W - v.x0 - v.w, player.x - W / 2));
  if (director?.lock) camX = Math.max(director.lock.l - v.x0, Math.min(director.lock.r - v.x0 - v.w, camX));
  if (MAP_H > H) camY = Math.max(-v.y0, Math.min(MAP_H - v.y0 - v.h, gy - H * 0.62));
}
/** 往面對的方向多看 dist 格：轉身時慢慢滑過去（約 0.6 秒） */
function lookAhead(dt, dist) { lookX += (player.face * dist - lookX) * Math.min(1, 2.2 * dt); return lookX; }
/** 死區跟隨：目標離鏡頭中心超過 dz 才跟，跟到剛好在死區邊上 */
function deadFollow(c, target, dz, rate, dt) {
  const d = target - c;
  if (Math.abs(d) <= dz) return c;
  return c + (d - Math.sign(d) * dz) * Math.min(1, rate * dt);
}
function followCam(dt) {
  // 王戰時慢慢拉遠、打完慢慢拉回來
  const zt = director?.lock && STAGE.arena ? ZOOM_BOSS : ZOOM;
  if (zoom !== zt) { zoom += Math.sign(zt - zoom) * Math.min(Math.abs(zt - zoom), 0.5 * dt); if (Math.abs(zoom - zoomShown) > 0.004 || zoom === zt) applyZoom(); }
  const v = viewRect();
  // 使用者 2026-11-05「鏡頭太晃」：
  //   往面對的方向多看 36（不再 50），轉身時慢慢滑過去，不是一下甩 70 格；
  //   主角在畫面中間 ±14 格內走動鏡頭不動（死區），走出去才跟
  camX = deadFollow(camX + W / 2, player.x + lookAhead(dt, 36), 14, 5, dt) - W / 2;
  // 照「看得到的範圍」停：走到地圖兩端主角還在畫面裡、王房光牆也看得到
  camX = Math.max(-v.x0, Math.min(LEVEL_W - v.x0 - v.w, camX));
  if (director?.lock) camX = Math.max(director.lock.l - v.x0, Math.min(director.lock.r - v.x0 - v.w, camX));
  // 上下：落地才跟（跳躍時鏡頭不上下晃）。掉到比上次站的地方低、或被風吹得很高時才跟著空中的主角；
  // 往下掉越快跟得越快（平順加速，不再一頓一頓）
  if (MAP_H > H) {
    if (camLand !== null && player.grounded) camLand = null;
    if (camLand !== null) camRefY = camLand;   // 進場還在掉：對準落地的地方
    else if (player.grounded || camRefY === null) camRefY = player.y;
    else if (player.y > camRefY) camRefY = player.y;
    else if (player.y < camRefY - 72) camRefY = player.y + 72;
    const wy = camRefY - H * 0.62, rate = 3 + Math.min(4, Math.max(0, player.vy) / 100);
    camY += (wy - camY) * Math.min(1, rate * dt);
    camY = Math.max(-v.y0, Math.min(MAP_H - v.y0 - v.h, camY));   // 爬到最上面看得到地圖頂端的尖刺、天花板上的蝙蝠
  }
}

// ---- 繪製
let sceneClock = 0;
function render() {
  const [sx, sy] = shakeOffset();
  frame.ox = Math.round(camX) + sx;
  frame.oy = Math.round(camY) + sy;
  frame.light.fill(0);
  // 場景光影：火把、水晶、主角、飛行中的火球、稀有以上的掉寶光柱都是光源
  sceneClock += 1 / 60;
  const lights = TOWN ? townLights(sceneClock) : sceneLights(camX, W, sceneClock);
  lights.push(lightStyle.v2 ? { x: player.x, y: player.y - 10, r: 64, lv: 1.6, col: "#ffcf6a" } : { x: player.x, y: player.y - 10, r: 46, lv: 1.3, col: "#ffcf6a" });   // 星星主角自己會發光（光影 v2：照亮一圈大一點）
  for (const e of enemies) e.lights?.(lights);
  for (const e of enemies) if (e.elite && !e.dead) lights.push({ x: e.x, y: e.y - 10, r: 36, lv: 1.2, col: "#ff4a3a" });
  for (const s of shots) lights.push({ x: s.x, y: s.y, r: 64, lv: 3, col: (SHOT_PAL[s.form] ?? SHOT_PAL.star).light });
  for (const d of drops.list) if (d.landed && d.item.rarity >= R.rare) lights.push({ x: d.x, y: d.y - 10, r: d.item.rarity === R.legend ? 48 : 30, lv: 2, col: RARITY[d.item.rarity].color });
  ultLights(lights);
  props.lights(lights);
  scenery.lights(lights);
  features?.lights(lights);
  for (const a of altars) lights.push(a.lit ? { x: a.x, y: a.y - 18, r: 70, lv: 2.4, col: "#ffd060" } : { x: a.x, y: a.y - 14, r: 26, lv: 0.8, col: "#7488aa" });
  const lv = computeLight(frame, lights);
  if (TOWN) drawTown(frame, lv, sceneClock);
  else { drawLevel(frame, lv); drawAtmosphere(frame, sceneClock); }
  for (const a of altars) if (Math.abs(a.x - camX - W / 2) < W) { drawAltar(frame, a.x, a.y, a.lit, sceneClock, a.pulse ?? 0); drawObjGlow(frame, a.lit ? "altarOn" : "altarOff", a.x, a.y, sceneClock + a.x * 0.01); }
  if (plug.on) { const h = STAGE.arena.hole; drawPlug(frame, h.x, h.y, h.w, h.h, plug.t); }
  features?.draw(frame, sceneClock);
  props.draw(frame, lv);
  scenery.draw(frame, lv, sceneClock);
  hazards.draw(frame);
  if (TOWN) { drawTownNpcs(frame, sceneClock); folk.draw(frame); drawGuideMark(frame); drawPrompt(); }
  else if (useT) drawBang(useT.x, useT.top);
  if (chest && !chest.opened && Math.abs(chest.x - camX - W / 2) < W) { chest.fx.draw(frame); drawObjGlow(frame, "chest", chest.x, chest.y, sceneClock); }
  // 大招時：先畫怪再暗場，法陣這些背景特效畫在暗場之後才會亮
  if (!ult.on) drawFx(frame, "back");
  drops.draw(frame);
  for (const d of drops.list) if (d.item.kind === "formcore" && d.hold > 0 && d.cx !== undefined) drawAbsorbBeams(frame, d.cx, d.cy, player.x, player.y - 12, sceneClock, d.item.form, d.hold);
  for (const e of enemies) e.draw(frame);
  drawBolts(frame);
  for (const w of waves) drawWave(frame, w);
  for (const m of minis) drawMiniBat(frame, m);
  for (const e of enemies) if (e.meteorMark > 0 && !e.dead) drawMark(frame, e.x, e.box().y0 - 7, sceneClock);
  for (const s of strikes) drawStrike(frame, s);
  drawTrail(frame, trail);
  for (const e of enemies) if (e.dizzyT > 0 && !e.dead) drawDizzy(frame, e.x, e.box().y0 - 4, sceneClock);
  if (player.shield > 0) drawShield(frame, player.x, player.y - 12, player.shield / (player.maxHp * 0.2), sceneClock);
  if (player.resonT > 0) drawReson(frame, player.x, player.y - 12, sceneClock);
  drawCoins();
  drawGems();
  if (ult.on) { dimScene(frame); drawFx(frame, "back"); }
  if (player.kingT > 0) drawKingBack(frame, player.x, player.y - 12, sceneClock);   // 星王化：光芒在主角後面
  player.draw(frame);
  deathFx.draw(frame);
  if (player.kingT > 0) drawKingFront(frame, player.x, player.y - 12, sceneClock);   // 王冠
  drawFx(frame, "front");
  fxState.form = player.form;
  drawCombatFx(frame);
  drawUlt(frame);
  if (!TOWN) drawLowHp(frame, lowHp.k, lowHp.pulse, zoom, viewRect().y0 - (H - H / zoom) / 2);
  if (TOWN) { drawTownWeather(frame, sceneClock); drawTownFg(frame); }
  if (director?.lock) drawBarrier(director.lock);
  if (!TOWN) drawForeground(frame);
  drawDamageNumbers(frame);   // 跳字畫在最上面，不會被前景擋住
  drawCutIn(frame);
  composite(frame, img.data, null, 0.8);   // 最後再整體壓一點發光
  postUlt(img.data);
  ctx.putImageData(img, 0, 0);
}
// 戰鬥區的邊界（重畫版）：兩道能量牆。參考 PixelFX 的 force-field、shield-block：
// 規則的菱形格紋（45° 的 1-1 階梯）慢慢往上流，內側一條實心亮邊，光點沿著亮邊往下跑。
const BAR = ["#2a1258", "#5a24a8", "#9a5af0", "#e8c8ff"].map((c) => hex(c) >>> 0), BAR_LIGHT = hex("#5a24a8") >>> 0;
let barClock = 0;
function drawBarrier(lock) {
  barClock += 1 / 60;
  const C = frame.color, L = frame.light, Wf = frame.w, scroll = Math.floor(barClock * 16);
  const put = (x, y, c, light) => {
    if (x < 0 || y < 0 || x >= Wf || y >= frame.h) return;
    C[y * Wf + x] = c;
    if (light) L[y * Wf + x] = BAR_LIGHT;
  };
  for (const [wx, side] of [[lock.l, 1], [lock.r - 1, -1]]) {
    const x0 = wx - frame.ox;
    if (x0 < -8 || x0 >= Wf + 8) continue;
    const bottom = (STAGE.arena?.floor ?? FLOOR) - frame.oy;   // 大檢查：高地圖上用王房的地面
    for (let y = 0; y < bottom; y++) {
      const wy = y + frame.oy + scroll;
      for (let i = 0; i < 6; i++) {
        // 菱形格紋：兩組 45° 斜線交錯
        const on = (wy + i) % 6 === 0 || (wy - i + 60) % 6 === 0;
        if (on) put(x0 + side * i, y, BAR[i < 2 ? 2 : 1]);
      }
      put(x0 + side * 6, y, BAR[3], (y & 1) === 0);     // 內側亮邊
      put(x0 + side * 7, y, BAR[0]);                    // 亮邊外的一條暗邊，讓它從背景浮出來
    }
    for (let n = 0; n < 3; n++) {                       // 光點沿著亮邊往下跑
      const y = Math.floor((barClock * 70 + n * 61) % bottom);
      put(x0 + side * 5, y, BAR[3], true);
      put(x0 + side * 5, y - 1, BAR[2]);
    }
  }
}
// 金幣（重畫版）：參考 Animated Coins、Star Coin、PixelFX coin-spin。旋轉四格：正面 → 橢圓 → 側邊 → 橢圓。
// 左上亮、右下暗，外框是深棕色；正中間一道刻痕。
const COIN_PAL = { k: "#3a1e08", h: "#fff2a8", g: "#ffc83a", G: "#c07c18", H: "#6e3c10" };
const COIN_FRAMES = [
  [".kkkk.", "khhgGk", "khgGGk", "kggGGk", "kggGHk", "kgGGHk", ".kkkk."],
  [".kk.", "khgk", "khGk", "kgGk", "kgGk", "kGHk", ".kk."],
  [".k.", "kGk", "kGk", "kGk", "kGk", "kHk", ".k."],
  [".kk.", "kgGk", "kgGk", "kgGk", "kGHk", "kGHk", ".kk."],
].map((rows) => rows.map((r) => [...r].map((ch) => (ch === "." ? 0 : hex(COIN_PAL[ch]) >>> 0))));
const COIN_LIGHT = hex("#8a5a10") >>> 0;
function drawCoins() {
  const Cc = frame.color, L = frame.light, Wf = frame.w;
  for (const c of coins) {
    const spr = COIN_FRAMES[Math.floor(c.t * 10 + c.x * 0.1) & 3], w = spr[0].length;
    const x = Math.round(c.x) - frame.ox - (w >> 1), y = Math.round(c.y + (c.still ? Math.sin(stats.time * 4 + c.x) * 1.5 : 0)) - frame.oy - 3;
    spr.forEach((row, j) => row.forEach((col, i) => {
      const px = x + i, py = y + j;
      if (col && px >= 0 && py >= 0 && px < Wf && py < frame.h) Cc[py * Wf + px] = col;
    }));
    const lx = x + (w >> 1), ly = y + 3;
    if (lx >= 0 && ly >= 0 && lx < Wf && ly < frame.h) L[ly * Wf + lx] = COIN_LIGHT;
  }
}

// ---- HUD
const flashEl = $("flash"), bagDot = $("bagDot"), lvEl = $("lvText"), xpFill = $("xpFill");
function updateBagDot() {
  const up = profile.inv.some((it) => compare(it, profile.equip, profile.lv)?.better), nw = profile.inv.some((it) => it.new);
  bagDot.className = "dot" + (up ? " on" : nw ? " on new" : "");
  bagDot.textContent = up ? "▲" : nw ? "!" : "";
  updateMenuDot();
}
// 左上「選單」：背包、任務、技能樹收在裡面（2026-11-05 介面減量）；裡面有東西要看時選單本身也亮一顆點
function updateMenuDot() {
  const on = $("bagDot").classList.contains("on") || $("treeDot").classList.contains("on");
  $("menuDot").className = "dot" + (on ? " on" : "");
  $("menuDot").textContent = on ? "!" : "";
}
$("btnMenu").style.backgroundImage = `url(${iconURL("arrowR", 2)})`;
$("btnMenu").addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); $("hudMenu").style.left = $("btnMenu").offsetLeft + $("btnMenu").offsetWidth + 10 + "px"; $("hudMenu").style.top = $("btnMenu").offsetTop + "px"; document.body.classList.toggle("menuOpen"); });
for (const id of ["btnBag", "btnQuest", "btnTree"]) $(id).addEventListener("click", () => document.body.classList.remove("menuOpen"));
addEventListener("pointerdown", (e) => { if (!e.target.closest?.("#hud")) document.body.classList.remove("menuOpen"); });
const comboEl = $("combo"), comboArt = createComboArt(comboEl), hpFill = $("hpFill"), hpText = $("hpText"), coinsEl = $("coins"), killsEl = $("kills"), fpsEl = $("fps"), cdEl = $("skillCd"), toastEl = $("toast");
const mpFill = $("mpFill"), mpText = $("mpText");
const ubFill = $("ubFill"), ubBar = $("ubBar"), ultG = $("ultCv").getContext("2d"), ultG2 = $("ultHudCv").getContext("2d"), ultHud = $("ultHud"), pcSkill = $("pcSkill"), pcSkillT = $("pcSkillT"), ultImg = new ImageData(ULT_S, ULT_S), btnUlt = $("btnUlt");
let toastT = 0;
const sysEl = $("sys"), sysText = $("sysTyped"), sysGhost = $("sysGhost"), sysFaceCv = $("sysFace");
let stopSysFace = null;
let sysT = 0, sysTyping = null, sysAge = 0, sysMin = 0;   // sysAge／sysMin：這句講多久了、至少要看多久（1-1 一段一段來用）
// focus：系統講到某個按鈕時，那顆按鈕跟著閃（教學）
const FOCUS = { atk: "btnAtk", dash: "btnDash", skill: "btnSkill", ult: "btnUlt", bag: "btnBag", forms: "forms" };
let focusEl = null;
function toast(msg, sec = 3, focus = null, icon = null) {
  if (msg.startsWith("系統：")) {
    const text = msg.slice(3), shown = text.replace(/[【】]/g, "");
    sysTyping?.skip();
    sysEl.classList.remove("glitch");
    void sysEl.offsetWidth;
    sysEl.classList.add("on", "glitch", "typing");
    sysEl.classList.toggle("imp", text.startsWith("主線「"));   // 主線完成：浮在視窗、對話上面，不被調暗
    sysGhost.innerHTML = keyChips(text);   // 隱形的整句先撐開大小，打字時框不會一直變寬
    sysTyping = typewriter(sysText, shown, 1320, "sine");
    stopSysFace?.(); stopSysFace = playFace(sysFaceCv, moodOf(text));
    const mine = sysTyping;
    // 打完之後把【】裡的字換成按鍵的樣子
    sysTyping.done.then(() => { if (sysTyping === mine) { sysText.innerHTML = keyChips(text); sysEl.classList.remove("typing"); } });
    sysT = toastT = sec + text.length * 0.035;   // 打字的時間另外加上去，看得完
    sysAge = 0; sysMin = 1.4 + text.length * 0.035;
    focusEl?.classList.remove("teach");
    focusEl = focus ? $(FOCUS[focus]) : null;
    if (focusEl) { focusEl.classList.add("teach"); setTimeout(() => focusEl?.classList.remove("teach"), sysT * 1000); }
    return;
  }
  toastEl.textContent = msg;
  if (icon) { const i = document.createElement("i"); i.className = "ticon"; i.style.backgroundImage = `url(${iconURL(icon, 2)})`; toastEl.prepend(i); }   // 10 批（E6）：撿到資源的提示帶圖示
  toastEl.classList.add("on");
  toastT = sec;
}
// 系統台詞排隊一句一句講，不會互相蓋掉
const sayQueue = [];
function updateSay() {
  // 1-1（paced）：上一句看完（sysMin）就換下一句，不用等它整個消失
  // 主線完成不等前一句講完，馬上插進來（使用者 2026-11-06）
  const urgent = sayQueue[0]?.[0]?.startsWith("系統：主線「") && !sysEl.classList.contains("imp");
  if ((urgent || toastT <= 0.2 || (STAGE.paced && sysT > 0 && sysAge >= sysMin)) && sayQueue.length) { const [m, s, f] = sayQueue.shift(); toast(m, s, f); }
}
const escHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
/** 【攻擊】→ 按鍵小方塊 */
function keyChips(text) { return escHtml(text).replace(/【(.+?)】/g, '<b class="key">$1</b>'); }
/** 依裝置挑教學台詞 */
const tipFor = (touchText, keyText) => (document.body.classList.contains("touch") ? touchText : keyText);
const hintEl = $("hint");
let hintTimer = 0;
function showHint(msg, sec) {
  hintEl.textContent = msg;
  hintEl.classList.add("on");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl.classList.remove("on"), sec * 1000);
}
// 通關：記錄進度、系統講一句（含這趟的成績），之後踩傳送門才離開；不再跳結算頁
function showClear() {
  if (stageDone) return;
  stageDone = true;
  const t = Math.round(stats.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, "0");
  profile.clears++;
  profile.cleared[STAGE_ID] = true;
  questProgress("clear", { stage: STAGE_ID, deaths: stats.deaths });
  save(profile, true);
  jingle("clear");
  // 1-4 沒有出口傳送門：打倒王之後，在主角前面打開一個
  if (portalX === null && !ENDLESS) {
    portalX = Math.round(Math.max(60, Math.min(geo.w - 60, player.x + player.face * 70)));
    portalY = floorAt(portalX, player.y - 8);
    // 大檢查：有王房的關卡，傳送門一定開在王房的地上（原本靠牆時會開到牆後面去）
    if (STAGE.arena) {
      const { l, r } = STAGE.arena, clampA = (v) => Math.round(Math.max(l + 40, Math.min(r - 40, v)));
      // 使用者 2026-11-06「打完王後寶箱與傳送門不能疊在一起」：候選位置（前面、背後、再遠一點、王房兩端）挑第一個離主角 40 以上、離星箱 72 以上的
      const away = (v) => Math.abs(v - player.x) >= 40 && (!chest || Math.abs(v - chest.x) >= 72);
      const cand = [70, -70, 120, -120, 170, -170].map((d) => clampA(player.x + player.face * d)).concat([clampA(l), clampA(r)]);
      portalX = cand.find(away) ?? cand.reduce((b, v) => (Math.abs(v - (chest?.x ?? 0)) > Math.abs(b - (chest?.x ?? 0)) ? v : b));
      portalY = STAGE.arena.floor;
    }
    spawn(A.portal, { x: portalX, y: portalY }, { layer: "back", keep: true });
    flash(portalX, portalY - 16, 110, 3, 0.6, "#a8f0ff");
  }
  sayQueue.length = 0;
  // 使用者 2026-11-06「通關播報在進入傳送門才播報，過程中順便載入」：這裡只說傳送門開了；
  //   成績跟系統的評語存起來，踩進傳送門時帶到下一個場景，在載入畫面上播（城鎮在後面同時載入）
  toast("系統：傳送門開了。走過去按互動，回碎星鎮。", 2.6);
  clearReport = {
    stage: `${STAGE_ID} ${LAYOUTS[STAGE_ID]?.name ?? ""}`, time: `${mm}:${ss}`, kills: stats.kills, best: stats.best, deaths: stats.deaths,
    say: STAGE_ID === "1-4" ? "第一章　墜星之谷　完。前面就是碎星鎮了。" : stats.deaths === 0 ? "一次都沒死？……我收回「零星」那句話。一半。" : "過是過了。死了幾次這件事我會幫你保密。",
    chapter: STAGE_ID === "1-4",
  };
}
let clearReport = null;
$("againBtn").addEventListener("click", () => goScene(ENDLESS ? "endless" : "stage", STAGE_ID));
$("nextBtn").addEventListener("click", () => nextStage() && goScene("stage", nextStage()));
$("homeBtn").addEventListener("click", () => goScene("town"));
// 使用者 2026-11-05：右上角的回城鍵拿掉（H 鍵也拿掉），改放在設定裡「放棄這趟，回城鎮」；戰鬥中（附近有怪）按不了
$("btnGoHome").addEventListener("click", async (e) => {
  e.stopPropagation();
  if (TOWN || dialog.open || !started) return;
  if (inCombat) { sfx("close"); toast("系統：附近還有怪。先脫離戰鬥再說。", 2); return; }
  $("setPanel").classList.add("hidden");
  if (await ask("系統", "要放棄這趟回碎星鎮嗎？撿到的東西都會留著，但這關要重來。", [["回城鎮", true], ["繼續打", false]])) goScene("town");
});
// 聲音設定
{
  const panel = $("setPanel"), m = $("volMusic"), s = $("volSfx"), mute = $("btnMute");
  const sync = () => { m.value = Math.round(audioVol.music * 100); s.value = Math.round(audioVol.sfx * 100); $("volMusicV").textContent = m.value; $("volSfxV").textContent = s.value; mute.textContent = "全部靜音：" + (audioVol.mute ? "開" : "關"); };
  $("btnSet").addEventListener("click", () => { unlockAudio(); panel.classList.toggle("hidden"); if (!panel.classList.contains("hidden")) playOpen(panel, "sys"); sync(); sfx("ui"); });
  $("setClose").addEventListener("click", () => { panel.classList.add("hidden"); sfx("close"); });
  m.addEventListener("input", () => { setVolume("music", m.value / 100); sync(); });
  s.addEventListener("input", () => { setVolume("sfx", s.value / 100); sync(); sfx("coin"); });
  mute.addEventListener("click", () => { setVolume("mute", !audioVol.mute); sync(); sfx("ui"); });
  for (const el of [panel, $("btnSet")]) el.addEventListener("pointerdown", (e) => e.stopPropagation());
  // 使用者 2026-11-06：設定開著＝遊戲暫停（tick 裡擋掉）；點設定框外面任何地方就關掉（這一下不會變成攻擊或移動）
  addEventListener("pointerdown", (e) => {
    if (panel.classList.contains("hidden") || panel.contains(e.target) || $("btnSet").contains(e.target) || $("soundBtn").contains(e.target)) return;
    if (e.target.closest?.(".win-box, #dlg, #worldWin")) return;   // 設定裡開出來的確認框
    e.stopPropagation(); e.preventDefault();
    panel.classList.add("hidden"); sfx("close");
    // 接著來的 click 也吃掉（不然點到底下的按鈕會順便按下去）
    const eat = (c) => { c.stopPropagation(); c.preventDefault(); };
    addEventListener("click", eat, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", eat, true), 400);
  }, true);
}
$("bagBtn2").addEventListener("click", () => inv.show());
$("btnBag").addEventListener("click", () => inv.show("invBag"));
// 點左上主角頭像＝打開背包的「裝備」頁（手機回報點不到：原本頭像沒有作用，觸控層又蓋在上面）
$("medal").addEventListener("click", (e) => { if (!document.body.classList.contains("playing")) return; e.stopPropagation(); inv.show("invHero"); });
addEventListener("keydown", (e) => {
  if (!started || !["KeyI", "KeyB", "Tab"].includes(e.code)) return;
  e.preventDefault();
  if (inv.open) inv.close();
  else inv.show();
});
addEventListener("pagehide", () => save(profile, true));
const hpLag = $("hpLag"), medalEl = $("medal"), xpBar = $("xpBar"), xpText = $("xpText"), killBox = $("killBox");
let lastHp = -1, lastXp = -1, xpShowT = 0, lastKills = 0, killShowT = 0;
let coinSndT = 0;
function hud(dt) {
  coinSndT -= dt;
  const hpK = player.hp / player.maxHp;
  hpFill.style.width = hpK * 100 + "%";
  hpLag.style.width = hpK * 100 + "%";
  if (lastHp >= 0 && player.hp < lastHp - 0.5) { medalEl.classList.remove("hit"); void medalEl.offsetWidth; medalEl.classList.add("hit"); }
  lastHp = player.hp;
  medalEl.classList.toggle("low", hpK < 0.3 && player.hp > 0);
  // 經驗：有變化才浮出來 2.5 秒
  const xpKey = profile.lv * 1e6 + profile.xp;
  if (lastXp >= 0 && xpKey !== lastXp) xpShowT = 2.5;
  lastXp = xpKey;
  xpBar.classList.toggle("show", (xpShowT -= dt) > 0 || inv.open);
  xpText.textContent = profile.lv >= MAX_LV ? "MAX" : `${profile.xp}/${xpNeed(profile.lv)}`;
  // 擊倒數：打倒東西才出現幾秒
  if (stats.kills !== lastKills) { lastKills = stats.kills; killShowT = 3; }
  killBox.classList.toggle("on", (killShowT -= dt) > 0);
  hpText.textContent = Math.ceil(player.hp);
  setNum(coinsEl, profile.coins);
  lvEl.textContent = "Lv " + profile.lv;
  xpFill.style.width = (profile.lv >= MAX_LV ? 100 : (profile.xp / xpNeed(profile.lv)) * 100) + "%";
  killsEl.textContent = stats.kills;
  comboArt.update(stats.combo, stats.comboT / 2.2, dt);
  cdEl.style.height = Math.max(0, player.skillCd / player.skillMax) * 100 + "%";
  // 魔力條；魔力不夠放技能時，技能鍵變暗
  mpFill.style.width = (player.mp / player.maxMp) * 100 + "%";
  setNum(mpText, Math.floor(player.mp));
  $("mpMark").style.left = (ULT_MP / player.maxMp) * 100 + "%";   // 魔力條上的刻度：到這裡就能放大招
  const noMp = player.mp < MP_COST;
  $("btnSkill").classList.toggle("nomp", noMp); pcSkill.classList.toggle("nomp", noMp);
  const noUlt = player.mp < ULT_MP; btnUlt.classList.toggle("nomp", noUlt); ultHud.classList.toggle("nomp", noUlt);   // 大招鍵角落的耗量變紅
  // 電腦版右下角的技能圖示：冷卻用一圈變暗的扇形倒數，中間顯示剩幾秒；好了閃一下
  const cdk = Math.max(0, player.skillCd / player.skillMax);
  pcSkill.style.setProperty("--cd", cdk.toFixed(3));
  pcSkillT.textContent = player.skillCd > 0.05 ? (player.skillCd >= 1 ? Math.ceil(player.skillCd) : player.skillCd.toFixed(1)) : "";
  if (pcSkill.classList.contains("cool") && cdk <= 0) { pcSkill.classList.remove("cool"); pcSkill.classList.remove("pop"); void pcSkill.offsetWidth; pcSkill.classList.add("pop"); }
  else if (cdk > 0) pcSkill.classList.add("cool");
  const uk = Math.min(1, player.mp / ULT_MP), ready = ultReady();   // 大招圖示：魔力灌滿星星（夠放大招＝發光閃耀）
  ubFill.style.width = uk * 100 + "%";
  ultImg.data.set(ultPixels(ult.on ? 0 : uk, performance.now() / 1000)); ultG.putImageData(ultImg, 0, 0); ultG2.putImageData(ultImg, 0, 0); ultHud.classList.toggle("ready", ready);   // 大招圖示：能量灌滿星星、集滿發光閃耀
  ubBar.classList.toggle("ready", ready);
  btnUlt.classList.toggle("ready", ready);
  sysAge += dt;
  if ((toastT -= dt) <= 0) toastEl.classList.remove("on");
  if ((sysT -= dt) <= 0 && sysEl.classList.contains("on")) { sysEl.classList.remove("on"); stopSysFace?.(); stopSysFace = null; }
}

// ---- 主迴圈
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0, costMs = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  const t0 = performance.now();
  while (acc >= STEP) {
    tick(slowT > 0 ? STEP * 0.35 : STEP);
    if (!inv.open) slowT -= STEP;
    acc -= STEP;
  }
  render();
  costMs += performance.now() - t0;
  hud(dt);
  fpsN++;
  if ((fpsT += dt) >= 0.5) {
    if (DEBUG) fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps · 每幀 ${(costMs / fpsN).toFixed(1)}ms · 敵人 ${enemies.length} · 特效 ${fxCount()}`;
    costMs = 0;
    fpsN = 0;
    fpsT = 0;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// 開發用效能測試：直接跑 n 幀（不受瀏覽器節流影響），回傳每幀平均毫秒數
window.__game.bench = (n = 300) => {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { tick(STEP); render(); hud(STEP); }   // hud 也跑：系統訊息的計時在這裡
  return +((performance.now() - t0) / n).toFixed(2);
};

// ---- 開始畫面
$("startName").textContent = ENDLESS ? "無限討伐" : TOWN ? "碎星鎮" : `第一章　${STAGE.name}`;
$("startLabel").textContent = TOWN || profile.clears > 0 ? "繼續冒險" : "開始冒險";
// 主畫面的場景動畫（換場景直接開始時不播）
let stopTitle = null;
if (!sessionStorage.getItem(AUTO_KEY)) startTitle($("titleCv"), { form: profile.forms.cur }).then((stop) => { if (started) stop(); else stopTitle = stop; });
$("helpBtn").addEventListener("click", () => { sfx("ui"); $("helpPanel").classList.remove("hidden"); });
$("helpClose").addEventListener("click", () => { sfx("ui"); $("helpPanel").classList.add("hidden"); });
$("soundBtn").addEventListener("click", (e) => { e.stopPropagation(); $("btnSet").click(); });
$("clearName").textContent = ENDLESS ? "無限討伐" : STAGE.name;
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) document.body.classList.add("touch");
addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true });
initTouch();
function start() {
  if (started) return;
  started = true;
  unlockAudio();
  music(TOWN ? "town" : STAGE_ID === "1-4" ? null : "stage");   // 1-4 王出場大吼時才開始王戰音樂
  $("goHomeRow").classList.toggle("hidden", TOWN);
  $("start").classList.add("hidden");
  stopTitle?.();
  document.body.classList.add("playing");
  document.body.classList.toggle("town", TOWN);
  updateBagDot();
  const touch = document.body.classList.contains("touch");
  goFullscreen();
  if (TOWN) townArrive();
  else if (ENDLESS) toast("系統：無限模式。打到你手痠為止。");
  else director = new Director(STAGE, stageApi, touch);
  snapCam();
}
// 手機：進全螢幕、轉橫向。要在點擊的當下呼叫（瀏覽器規定），所以開場動畫開始播的時候就先開（使用者 2026-11-06）
function goFullscreen() {
  if (!document.body.classList.contains("touch")) return;
  // 放在外框頁（iframe）裡時，請外框頁自己開全螢幕：瀏覽器在「要求全螢幕的那一頁」換頁時會退出全螢幕，
  // 由外框頁開的話，換場景只重新載入 iframe，全螢幕就留著（點擊的使用者啟用會傳到外框頁）
  if (window.top !== window) window.parent.postMessage({ type: "zero-hero-fullscreen" }, location.origin);
  else if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.("landscape")).catch(() => {});
}
// 使用者 2026-11-06「手機進網頁時自動變橫向」：瀏覽器規定要點一下才能進全螢幕、鎖橫向——手機第一次點畫面（任何地方）就做
addEventListener("pointerup", function firstTap() { if (document.body.classList.contains("touch")) { removeEventListener("pointerup", firstTap, true); goFullscreen(); } }, true);   // pointerup：手指放開才算點擊（全螢幕要）
// 開始冒險：新遊戲第一次進 1-1 時先播開場動畫（只播一次，可跳過），播完直接開始
async function startOrIntro() {
  if (started || introOn) return;
  if (TOWN || ENDLESS || STAGE_ID !== "1-1" || profile.seenIntro) return start();
  introOn = true;
  goFullscreen();
  unlockAudio();
  stopTitle?.(); stopTitle = null;
  $("helpPanel").classList.add("hidden");
  $("start").classList.add("intro");
  await playIntro($("start"), $("titleCv"));
  introOn = false;
  profile.seenIntro = true;
  save(profile, true);
  // 開場已經講過「轉生成功、種族星靈」，1-1 一開始改講別的
  STAGE.intro = [];   // 使用者 2026-11-06：直接接第一句教學（走路），不要多一句擋在前面
  const fade = $("fade");
  fade.style.transition = "none"; fade.classList.add("on");
  start();
  void fade.offsetWidth;
  fade.style.transition = ""; fade.classList.remove("on");
}
$("startBtn").addEventListener("click", startOrIntro);
// 設定裡的「重看開場動畫」：在原地播（遊戲暫停），播完回到原本的畫面
async function replayIntro() {
  if (introOn) return;
  introOn = true;
  goFullscreen();
  $("setPanel").classList.add("hidden");
  const wasStarted = started;
  stopTitle?.(); stopTitle = null;
  $("helpPanel").classList.add("hidden");
  $("start").classList.remove("hidden");
  $("start").classList.add("intro");
  await playIntro($("start"), $("titleCv"));
  $("start").classList.remove("intro");
  if (wasStarted) $("start").classList.add("hidden");
  else stopTitle = await startTitle($("titleCv"), { form: profile.forms.cur });
  introOn = false;
}
$("btnIntro").addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); replayIntro(); });
// 「回主畫面」：存檔後重新載入、顯示主畫面（關卡中回去的話，下次從碎星鎮繼續；還沒到過鎮上的新玩家從原本的關卡）
$("btnTitle").addEventListener("click", (e) => {
  e.stopPropagation();
  sfx("ui");
  save(profile, true);
  const toTown = TOWN || profile.clears > 0 || profile.guild.registered;
  sessionStorage.setItem(NEXT_KEY, toTown ? "town" : ENDLESS ? "endless" : "stage");
  if (!toTown && !ENDLESS) sessionStorage.setItem(STAGE_KEY, STAGE_ID);
  sessionStorage.removeItem(AUTO_KEY);
  $("fade").classList.add("on");
  setTimeout(() => location.replace(location.pathname), 380);
});
// 換場景過來的：黑幕淡入、直接開始；聲音等第一次操作再解鎖（瀏覽器規定）
if (sessionStorage.getItem(AUTO_KEY)) {
  sessionStorage.removeItem(AUTO_KEY);
  const fade = $("fade");
  fade.style.transition = "none"; fade.classList.add("on");
  start();
  document.documentElement.classList.remove("auto");
  void fade.offsetWidth;   // 先讓全黑生效，再開動畫淡掉
  fade.style.transition = ""; fade.classList.remove("on");
}
for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, unlockAudio, { capture: true, passive: true });
addEventListener("keydown", (e) => { if (!started && (e.code === "Enter" || e.code === "Space")) startOrIntro(); });
window.__loadDone?.();   // 第 7 批：載入畫面淡掉
// 開發用：主控台直接掉寶、加經驗
Object.assign(window.__game, { dropItem, gainXp, R, toast, gems, coins, minis, refreshStats, world, strikes, trail, altars, get chest() { return chest; } });
