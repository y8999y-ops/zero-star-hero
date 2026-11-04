// 碎星鎮的路人：在鎮上來回走、偶爾停下來轉身，頭上冒自言自語的泡泡，走近按攻擊可以聊天。
// 造型在 npcs.js（kid／turtle／pebble／shroom），台詞是吐槽風。
import { paintNpc, npcSize } from "./npcs.js";

export const FOLK_INFO = {
  kid: {
    name: "史萊姆小孩・啵啵", speed: 26, hop: true,
    ambient: ["我哥在公會上班！很厲害吧！", "你會發光耶！可以當我的夜燈嗎？", "啵！"],
    talk: [["你是星星？真的假的！", "我哥說，從天上掉下來的東西都是垃圾。", "……啊，不是說你啦。大概。"],
      ["長大以後我也要戴眼鏡。", "我哥說戴眼鏡看起來比較聰明。", "……我哥其實看得很清楚。"]],
  },
  turtle: {
    name: "郵差・慢慢", speed: 9,
    ambient: ["信……在……路……上……", "今天……也……準時……", "……（打呵欠）"],
    talk: [["你的……信……", "……喔，不對。你才剛來，還沒有人寫信給你。"],
      ["我……送信……已經……三百年了……", "最快的……一次……是……上個月……", "……寄到了……去年的信。"]],
  },
  pebble: {
    name: "學徒・碎碎", speed: 16,
    ambient: ["師父說石頭要有耐心。", "我在練習發火。……還不行。", "嘿咻、嘿咻。"],
    talk: [["我是岩叔的學徒！今天也在搬石頭。", "師父說，再搬一千年就可以摸鐵鎚了。", "……一千年是多久？"],
      ["師父很少講話。", "但是他打鐵的時候，會偷偷哼歌。", "……這是秘密喔。"]],
  },
  shroom: {
    name: "菇菇寶寶", speed: 34,
    ambient: ["抓不到～", "媽媽說不能跑太遠～", "嘻嘻～"],
    talk: [["你是新來的嗎～", "我們在玩鬼抓人～你當鬼～", "……你跑好慢喔～"],
      ["媽媽的湯很好喝喔～", "裡面沒有我們喔～", "……應該沒有吧～"]],
  },
};

/** 建立路人：每個在自己的範圍裡走來走去；菇菇寶寶兩顆，後面那顆跟著前面那顆 */
export function createFolk(floor) {
  const list = [
    { id: "kid", x: 230, min: 120, max: 340 },
    { id: "turtle", x: 480, min: 330, max: 720 },
    { id: "pebble", x: 450, min: 360, max: 560 },
    { id: "shroom", x: 820, min: 640, max: 900 },
  ].map((o, i) => ({ ...o, info: FOLK_INFO[o.id], dir: i % 2 ? -1 : 1, state: "walk", t: 2 + i, anim: 0, talking: false, talkN: 0 }));
  const lead = list.find((o) => o.id === "shroom");
  const follower = { id: "shroom2", info: FOLK_INFO.shroom, x: lead.x - 14, dir: lead.dir, state: "walk", anim: 0, follow: lead, talking: false };
  list.push(follower);

  function update(dt, playerX) {
    for (const o of list) {
      if (o.talking) { o.dir = playerX >= o.x ? 1 : -1; o.anim = 0; continue; }
      if (o.follow) {
        // 跟著前面那顆，隔 14px，慢一格
        const L = o.follow, tx = L.x - L.dir * 14;
        const d = tx - o.x;
        if (Math.abs(d) > 1) { o.x += Math.sign(d) * Math.min(Math.abs(d), L.info.speed * 1.15 * dt); o.dir = Math.sign(d); o.anim += dt * 8; }
        else { o.dir = L.dir; if (L.state === "idle") o.anim = 0; }
        continue;
      }
      o.t -= dt;
      if (o.state === "walk") {
        o.x += o.dir * o.info.speed * dt;
        o.anim += dt * (o.info.hop ? 7 : 6);
        if (o.x < o.min || o.x > o.max) { o.x = Math.max(o.min, Math.min(o.max, o.x)); o.dir = -o.dir; }
        if (o.t <= 0) { o.state = "idle"; o.t = 1.2 + Math.random() * 2.5; o.anim = 0; }
      } else if (o.t <= 0) {
        o.state = "walk"; o.t = 3 + Math.random() * 5;
        if (Math.random() < 0.5) o.dir = -o.dir;
      }
    }
  }
  function draw(frame) {
    for (const o of list) paintNpc(frame, o.id, o.state === "walk" || o.anim > 0 ? Math.floor(o.anim) % 4 : 0, o.x, floor - 1, o.dir < 0);
  }
  /** 主角旁邊的路人（可以聊天的）；菇菇寶寶跟著的那顆不算 */
  function nearby(x) {
    let best = null, bd = 16;
    for (const o of list) if (!o.follow && Math.abs(o.x - x) < bd) { bd = Math.abs(o.x - x); best = o; }
    return best && { id: best.id, name: best.info.name, x: best.x, folk: best, h: npcSize(best.id)[1] };
  }
  /** 聊天：輪流講不同的話 */
  function lines(o) { const L = o.info.talk[o.talkN++ % o.info.talk.length]; return L; }
  return { list, update, draw, nearby, lines };
}
