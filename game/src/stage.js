// 關卡流程：照 x 位置觸發提示、對話、封鎖戰鬥區、一波一波出怪，最後走到出口過關。
// 關卡內容全部是資料（STAGE_1_1），之後的關卡照同樣格式寫就好。

// side: 1 從畫面右邊出現、-1 從左邊、0 從上面掉下來（蝙蝠）
export const STAGE_1_1 = {
  name: "1-1 墜落之底",
  start: { x: 90, y: -40 },
  exitX: 2318,
  intro: ["系統：……你從天上掉下來了。恭喜，你還活著。", "系統：轉生成功。種族：星星。……不，我也是第一次看到。"],
  // 高處的金幣（探索獎勵）
  caches: [{ x: 556, y: 96, n: 6 }, { x: 1212, y: 84, n: 9 }, { x: 2092, y: 100, n: 7 }],
  events: [
    { x: 120, hint: { touch: "左手在左半邊左右拖動＝移動", key: "A / D 或方向鍵＝移動" } },
    { x: 280, hint: { touch: "左手往上快滑＝跳，在空中點一下左半邊＝二段跳", key: "W 或空白鍵＝跳，在空中再按一次＝二段跳" } },
    {
      x: 470,
      say: "系統：史萊姆，深淵最弱的魔物。剛好適合零星的你。",
      hint: { touch: "按住右下角「攻擊」會自動打出三連段", key: "按住 J 會自動打出三連段" },
      waves: [[["slime", 1], ["slime", 1], ["slime", -1]]],
    },
    {
      x: 900,
      say: "系統：蝙蝠會俯衝，看準時機閃開。",
      hint: { touch: "「閃避」有無敵時間；沒推方向時會往遠離敵人的方向閃", key: "K＝閃避，有無敵時間" },
      waves: [[["slime", 1], ["bat", 0], ["bat", 0]], [["slime", -1], ["slime", 1], ["bat", 0], ["slime", 1]]],
    },
    {
      x: 1290,
      say: "系統：……等等，那個垃圾桶是不是在動？",
      hint: { touch: "「技能」打中會爆炸，可以炸一整群", key: "U＝技能（星屑彈），打中會爆炸" },
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
    { x: 260, hint: { touch: "右上角的背包：穿裝備、比較、拆垃圾", key: "I＝背包：穿裝備、比較、拆垃圾" } },
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
export const STAGES = { "1-1": STAGE_1_1, "1-2": STAGE_1_2, "1-3": STAGE_1_3, "1-4": STAGE_1_4 };

const SAY_TIME = 3.2, HINT_TIME = 5;

export class Director {
  /** api: { spawnEnemy(kind, x, y), say(msg, sec), hint(msg, sec), alive(), dropCache(x, y, n), clear() } */
  constructor(stage, api, isTouch) {
    Object.assign(this, { stage, api, isTouch, next: 0, lock: null, waves: null, wave: 0, waveDelay: 0, done: false, time: 0 });
    for (const m of stage.intro) api.say(m, SAY_TIME);
    for (const c of stage.caches) api.dropCache(c.x, c.y, c.n);
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
      if (ev.waves) {
        this.lock = ev.lock ? { l: ev.lock[0], r: ev.lock[1] } : { l: Math.round(camX), r: Math.round(camX) + W };
        this.waves = ev.waves;
        this.wave = 0;
        this.waveDelay = 0.4;
      }
    }
    if (!this.lock && this.next >= this.stage.events.length && player.x >= this.stage.exitX) {
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
