// 關卡流程：照 x 位置觸發提示、對話；怪物一開始就擺在地圖上（8b）；王的房間封住、一波一波出；最後走到出口過關。
// 關卡內容全部是資料（STAGE_1_1），之後的關卡照同樣格式寫就好。

// side: 1 從畫面右邊出現、-1 從左邊、0 從上面掉下來（蝙蝠）
export const STAGE_1_1 = {
  name: "1-1 墜落之底",
  start: { x: 100, y: -40 },
  exitX: 2318, exitY: 264,
  // 8c：大地圖的祭壇、怪物（約 50 隻，擺在各層）
  altars: [{ x: 720, y: 488 }, { x: 1500, y: 432 }, { x: 2100, y: 264 }],
  spawns: [
    // 最底層、台階
    { k: "slime", x: 380, y: 600 }, { k: "slime", x: 440, y: 600 }, { k: "bat", x: 330, y: "air" },
    { k: "slime", x: 540, y: 536 }, { k: "slime", x: 600, y: 536 }, { k: "slime", x: 690, y: 488 }, { k: "bat", x: 640, y: "air" },
    // 上方大洞穴
    { k: "bat", x: 1100, y: 300 }, { k: "bat", x: 900, y: 250 }, { k: "bat", x: 1120, y: 230 }, { k: "slime", x: 1240, y: 160 },
    { k: "slime", x: 880, y: 344 }, { k: "slime", x: 1080, y: 344 }, { k: "trash", x: 1400, y: 296 }, { k: "bat", x: 200, y: 380 },
    // 中層走廊（低矮）
    { k: "slime", x: 880, y: 432 }, { k: "slime", x: 960, y: 432 }, { k: "slime", x: 1030, y: 432 }, { k: "bat", x: 1000, y: 395 },
    { k: "trash", x: 1150, y: 432 }, { k: "slime", x: 1200, y: 432 },
    // 下層洞穴（有寶）
    { k: "slime", x: 900, y: 600 }, { k: "slimeE", x: 1010, y: 600 }, { k: "slime", x: 1100, y: 600 }, { k: "gold", x: 1180, y: 600 }, { k: "trash", x: 1320, y: 600 },
    // 中層走廊後半
    { k: "trash", x: 1350, y: 432 }, { k: "slime", x: 1420, y: 432 }, { k: "slime", x: 1470, y: 432 }, { k: "bat", x: 1450, y: 390 },
    { k: "trash", x: 1600, y: 432 }, { k: "slime", x: 1650, y: 432 }, { k: "slime", x: 1760, y: 432 }, { k: "slime", x: 1850, y: 432 },
    // 豎井、藏起來的平台
    { k: "bat", x: 1780, y: 360 }, { k: "bat", x: 1800, y: 300 }, { k: "bat", x: 1760, y: 220 },
    { k: "slime", x: 1560, y: 248 }, { k: "slime", x: 1610, y: 248 },
    // 最上層底下的房間
    { k: "slime", x: 1980, y: 432 }, { k: "slime", x: 2050, y: 432 }, { k: "trashE", x: 2120, y: 432 }, { k: "slime", x: 2220, y: 432 },
    { k: "slime", x: 2300, y: 432 }, { k: "bat", x: 2150, y: 380 }, { k: "bat", x: 2260, y: 370 },
    // 最上層
    { k: "slime", x: 1960, y: 264 }, { k: "slime", x: 2020, y: 264 }, { k: "trash", x: 2150, y: 264 }, { k: "slime", x: 2230, y: 264 },
    { k: "bat", x: 2100, y: 190 }, { k: "bat", x: 2300, y: 170 },
  ],
  intro: ["系統：……你從天上掉下來了。恭喜，你還活著。", "系統：轉生成功。種族：星星。……不，我也是第一次看到。"],
  // 高處的金幣（探索獎勵）
  caches: [{ x: 396, y: 472, n: 6 }, { x: 1080, y: 560, n: 9 }, { x: 1584, y: 232, n: 10 }, { x: 2240, y: 152, n: 8 }],
  events: [
    // 教學寫成系統的台詞（tip），【】裡是按鍵／按鈕，focus＝講到時哪個按鈕會閃
    { x: 120, tip: { touch: "先活動一下。左手在【螢幕左半邊】左右拖——這樣就能走了。", key: "先活動一下。【A】【D】或方向鍵——走路。星星也是要走路的。" } },
    { x: 280, tip: { touch: "前面有高台。左手【往上快滑】跳，在空中再點一下左半邊——二段跳。別問我星星為什麼會二段跳。", key: "前面有高台。【空白鍵】或【↑】跳，在空中再按一次——二段跳。別問我星星為什麼會二段跳。" } },
    {
      x: 470,
      say: "系統：史萊姆，深淵最弱的魔物。剛好適合零星的你。",
      tip: { touch: "按住右下角的【攻擊】，會自己打出三連段。很方便吧？我設計的。", key: "按住【滑鼠左鍵】，會自己打出三連段。很方便吧？我設計的。", focus: "atk" },
      waves: [[["slime", 1], ["slime", 1], ["slime", -1]]],
    },
    {
      x: 900,
      say: "系統：蝙蝠會俯衝，看準時機閃開。",
      tip: { touch: "【閃避】的那一瞬間不會受傷。沒推方向的話，會往遠離敵人的那邊閃。", key: "按【滑鼠右鍵】衝刺閃避，閃的那一瞬間不會受傷。", focus: "dash" },
      waves: [[["slime", 1], ["bat", 0], ["bat", 0]], [["slime", -1], ["slime", 1], ["bat", 0], ["slime", 1]]],
    },
    {
      x: 1290,
      say: "系統：……等等，那個垃圾桶是不是在動？",
      tip: { touch: "用【技能】。星屑彈打中會爆炸，一整群一起送走。", key: "按【E】放技能——星屑彈，打中會爆炸，一整群一起送走。", focus: "skill" },
      waves: [[["trash", 1]], [["trash", -1], ["slime", 1], ["bat", 0], ["slime", -1]]],
    },
    {
      x: 1730,
      say: "系統：最後一波了。撐住，我還不想換宿主。",
      waves: [[["slime", 1], ["slime", 1], ["slime", -1], ["slime", -1], ["bat", 0], ["bat", 0]], [["trash", 1], ["trash", -1], ["bat", 0], ["bat", 0], ["gold", 1]]],
    },
    { x: 2180, say: "系統：前面有傳送門。……通往更深的地方。我就知道。" },
  ],
};

// 1-2 垃圾山：垃圾桶怪變多，第一次碰到菁英（紅色、很硬、掉的東西比較好）
export const STAGE_1_2 = {
  name: "1-2 垃圾山",
  start: { x: 80, y: 184 },
  exitX: 2700,
  intro: ["系統：這裡是垃圾山。上面的世界把不要的東西，全部丟到這裡。", "系統：……包括你。開玩笑的。大概。"],
  caches: [{ x: 560, y: 84, n: 7 }, { x: 1432, y: 86, n: 9 }, { x: 2336, y: 84, n: 10 }],
  events: [
    { x: 260, tip: { touch: "撿到的東西都在右上角的【背包】。穿裝備、比較、拆垃圾……垃圾的部分你應該很熟。", key: "撿到的東西按【I】打開背包看。穿裝備、比較、拆垃圾……垃圾的部分你應該很熟。", focus: "bag" } },
    { x: 620, say: "系統：歡迎委員會來了。", waves: [[["slime", 1], ["slime", -1], ["trash", 1]], [["slime", 1], ["slime", 1], ["slime", -1], ["bat", 0]]] },
    { x: 1150, say: "系統：垃圾桶……越來越多了。打倒它們，有機會吸收鐵罐星的核。", waves: [[["trash", 1], ["trash", -1]], [["trash", 1], ["slime", -1], ["slime", -1], ["bat", 0]]] },
    { x: 1680, say: "系統：那隻史萊姆的顏色不太對。是菁英，很硬。打贏的話掉的東西比較好。", waves: [[["slimeE", 1], ["slime", -1], ["slime", -1]], [["slime", 1], ["trash", -1], ["bat", 0], ["bat", 0]]] },
    { x: 2260, say: "系統：最後一段。我看到很多垃圾桶在發抖。", waves: [[["trash", 1], ["trash", -1], ["slime", 1], ["bat", 0]], [["trashE", 1], ["slime", -1], ["bat", 0], ["gold", -1]]] },
    { x: 2560, say: "系統：再往下……是蝙蝠的地盤了。" },
  ],
};

// 1-3 蝙蝠洞窟：很暗、蝙蝠一大群，菁英蝙蝠＋菁英垃圾桶；最後預告王
export const STAGE_1_3 = {
  name: "1-3 蝙蝠洞窟",
  start: { x: 80, y: 184 },
  exitX: 2500,
  intro: ["系統：好暗。……你會發光這件事，第一次派上用場了。", "系統：聽到翅膀的聲音了嗎？我聽到了。很多。"],
  caches: [{ x: 628, y: 76, n: 8 }, { x: 1344, y: 70, n: 10 }, { x: 2260, y: 88, n: 9 }],
  events: [
    { x: 420, say: "系統：來了。", waves: [[["bat", 0], ["bat", 0], ["bat", 0]], [["bat", 0], ["bat", 0], ["slime", 1], ["slime", -1]]] },
    { x: 900, say: "系統：蝙蝠會俯衝。閃避有無敵時間，看準了再按。", waves: [[["bat", 0], ["bat", 0], ["trash", 1]], [["bat", 0], ["bat", 0], ["bat", 0], ["slime", -1]]] },
    { x: 1420, say: "系統：那隻……體型不太對。菁英蝙蝠，衝得特別快。", waves: [[["batE", 0], ["bat", 0], ["bat", 0]], [["bat", 0], ["slime", 1], ["slime", -1], ["bat", 0]]] },
    { x: 1960, say: "系統：垃圾桶怪也跑進洞裡了？這裡到底是誰在管。", waves: [[["trashE", 1], ["bat", 0], ["bat", 0]], [["batE", 0], ["trash", -1], ["bat", 0], ["gold", 1]]] },
    { x: 2300, say: "系統：前面……我聞到很臭的味道。像是吃了一百年垃圾的那種。" },
  ],
};
// 1-4 大胃王的巢穴：一進來就封住整個場地，王從上面掉下來。打倒王（融化演出結束）＝通關。
export const STAGE_1_4 = {
  name: "1-4 大胃王的巢穴",
  start: { x: 60, y: 184 },
  exitX: 0,
  intro: ["系統：……這裡就是巢穴。好臭。", "系統：我聞到了。牠就在附近。……不，是在上面。"],
  caches: [],
  events: [{ x: 70, lock: [16, 544], waves: [[["boss", 0]]] }],
};
// 8b 測試地圖：怪擺在各層、兩座祭壇、出口在最上層
export const STAGE_TEST = {
  name: "測試：大地圖", start: { x: 60, y: 600 }, exitX: 1140, exitY: 300, intro: ["系統：這是測試用的大地圖。往上爬。"], caches: [], events: [],
  altars: [{ x: 300 }, { x: 640, y: 420 }],
  spawns: [
    { k: "slime", x: 600, y: 600 }, { k: "slime", x: 700, y: 600 }, { k: "trash", x: 900, y: 600 }, { k: "bat", x: 800, y: 540 },
    { k: "slime", x: 200, y: 420 }, { k: "slime", x: 800, y: 420 }, { k: "slimeE", x: 900, y: 420 }, { k: "bat", x: 500, y: 380 },
    { k: "trash", x: 400, y: 220 }, { k: "slime", x: 600, y: 220 }, { k: "bat", x: 1100, y: 250 },
  ],
};
// 無限模式：用原本的 1-1（一個畫面高），只有起點和出口會用到
export const STAGE_ENDLESS = { ...STAGE_1_1, start: { x: 200, y: 184 }, exitX: 2318, exitY: 0, altars: [], spawns: [], caches: [] };
export const STAGES = { endless: STAGE_ENDLESS, "1-1": STAGE_1_1, "1-2": STAGE_1_2, "1-3": STAGE_1_3, "1-4": STAGE_1_4, test: STAGE_TEST };

const SAY_TIME = 3.2, HINT_TIME = 5;

export class Director {
  /** api: { spawnEnemy(kind, x, y), say(msg, sec), hint(msg, sec), alive(), dropCache(x, y, n), clear() } */
  constructor(stage, api, isTouch) {
    Object.assign(this, { stage, api, isTouch, next: 0, lock: null, waves: null, wave: 0, waveDelay: 0, done: false, time: 0 });
    for (const m of stage.intro) api.say(m, SAY_TIME);
    for (const c of stage.caches) api.dropCache(c.x, c.y, c.n);
    // 8b（使用者 2026-11-05：不要隱形牆和遭遇戰，參考 Ori）：怪物一開始就擺在地圖上。
    // 有 spawns 的關卡照 spawns 擺；還沒重新設計的舊關卡，把原本每個事件的波次攤開，擺在事件位置前面一段路上。
    // 重生規則 2：打死就不見，重進關卡才會再出現（重進＝重新載入頁面，自然又是一整批）。
    if (stage.spawns) for (const sp of stage.spawns) api.spawnEnemy(sp.k, sp.x, sp.y);
    else for (const ev of stage.events) {
      if (!ev.waves || ev.lock) continue;
      const all = ev.waves.flat();
      all.forEach(([kind], i) => {
        const x = ev.x + 150 + i * 34 + (i % 2) * 9;
        this.api.spawnEnemy(kind, x, kind.startsWith("bat") ? "air" : undefined);
      });
    }
  }

  update(dt, player, camX, W) {
    if (this.done) return;
    this.time += dt;
    // 戰鬥中：等這一波清完，再出下一波
    if (this.lock) {
      if (this.api.alive() === 0 && (this.waveDelay -= dt) <= 0) {
        if (this.wave < this.waves.length) this.spawnWave(this.waves[this.wave++]);
        else {
          this.lock = null;
          if (!this.stage.events.some((e) => e.lock)) this.api.say("系統：清除！……哼，還算可以。", 2);
        }
      } else if (this.api.alive() > 0) this.waveDelay = 0.6;
      return;
    }
    // 走到下一個事件的位置就觸發
    const ev = this.stage.events[this.next];
    if (ev && player.x >= ev.x) {
      this.next++;
      if (ev.say) this.api.say(ev.say, SAY_TIME);
      if (ev.hint) this.api.hint(this.isTouch ? ev.hint.touch : ev.hint.key, HINT_TIME);
      if (ev.tip) this.api.say("系統：" + (this.isTouch ? ev.tip.touch : ev.tip.key), HINT_TIME, ev.tip.focus);
      if (ev.waves && ev.lock) {   // 只剩王的房間會封住（真的牆圍起來的場地）
        this.lock = ev.lock ? { l: ev.lock[0], r: ev.lock[1] } : { l: Math.round(camX), r: Math.round(camX) + W };
        this.waves = ev.waves;
        this.wave = 0;
        this.waveDelay = 0.4;
      }
    }
    if (!this.lock && this.next >= this.stage.events.length && player.x >= this.stage.exitX && (!this.stage.exitY || Math.abs(player.y - this.stage.exitY) < 40)) {
      this.done = true;
      this.api.clear();
    }
  }

  spawnWave(list) {
    const { l, r } = this.lock;
    list.forEach(([kind, side], i) => {
      const x = side > 0 ? r - 24 - i * 14 : side < 0 ? l + 24 + i * 14 : l + 60 + Math.random() * (r - l - 120);
      this.api.spawnEnemy(kind, x, kind.startsWith("bat") ? 40 + Math.random() * 30 : undefined);
    });
  }
}
