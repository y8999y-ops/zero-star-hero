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
          this.api.say("系統：清除！……哼，還算可以。", 2);
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
        this.lock = { l: Math.round(camX), r: Math.round(camX) + W };
        this.waves = ev.waves;
        this.wave = 0;
        this.waveDelay = 0.4;
      }
    }
    if (player.x >= this.stage.exitX) {
      this.done = true;
      this.api.clear();
    }
  }

  spawnWave(list) {
    const { l, r } = this.lock;
    list.forEach(([kind, side], i) => {
      const x = side > 0 ? r - 24 - i * 14 : side < 0 ? l + 24 + i * 14 : l + 60 + Math.random() * (r - l - 120);
      this.api.spawnEnemy(kind, x, kind === "bat" ? 40 + Math.random() * 30 : undefined);
    });
  }
}
