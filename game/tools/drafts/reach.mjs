// 大地圖可達性檢查（大檢查用）：照 player.js 的物理（RUN 128、GRAV 1000、JUMP_V -335、JUMP2_V -295、MAX_FALL 430），
// 從起點開始，在每個站得住的地方模擬各種跳法（單跳、不同時機的二段跳、晚一點才推方向、走出邊緣、往下穿平台、
// 黏液菇彈跳、氣流裡滑翔），用 8px 的格子做碰撞，看祭壇、機關、資源、藏寶處、出口、王房是不是都到得了。
// 裂牆、封印門：先當實心跑一次（要對的形態才開），再全部打開跑一次。
// 執行：node game/tools/drafts/reach.mjs [關卡…]
globalThis.location = { search: "" };
const { LAYOUTS } = await import("../../src/stages.js");
const { STAGES } = await import("../../src/stage.js");
const T = 8, RUN = 128, GRAV = 1000, MAX_FALL = 430, J1 = -335, J2 = -295, HALF = 5, TALL = 20, DT = 1 / 60;

function check(id, open) {
  const L = LAYOUTS[id], S = STAGES[id], W = Math.ceil(L.w / T), H = Math.ceil(L.h / T);
  const solid = new Uint8Array(W * H), plats = [...L.platforms];
  const fill = (r) => { for (let y = Math.floor(r.y / T); y < Math.ceil((r.y + r.h) / T); y++) for (let x = Math.floor(r.x / T); x < Math.ceil((r.x + r.w) / T); x++) if (x >= 0 && y >= 0 && x < W && y < H) solid[y * W + x] = 1; };
  for (const r of L.solids) fill(r);
  const feats = S.features ?? [];
  const shrooms = feats.filter((f) => f.t === "shroom").map((f) => ({ x: f.x - 11, y: f.y - 15, w: 22, shroom: true }));
  plats.push(...shrooms);
  for (const f of feats) if (!open && (f.t === "crack" || f.t === "seal")) { const w = f.t === "crack" ? 32 : 24; fill({ x: f.x - w / 2, y: f.y - (f.h ?? 48), w, h: f.h ?? 48 }); }
  const winds = process.env.NOWIND ? [] : feats.filter((f) => f.t === "wind");
  const sol = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (ty < 0) return tx < 0 || tx >= W || solid[tx] === 1; return tx < 0 || tx >= W || ty >= H || solid[ty * W + tx]; };
  const bodyHit = (x, y) => { for (const dy of [1, 8, 14, TALL]) for (const dx of [-HALF, HALF]) if (sol(x + dx, y - dy)) return true; return false; };
  const groundAt = (x, y) => { for (const dx of [-HALF + 1, 0, HALF - 1]) if (sol(x + dx, y + 0.5)) return { solid: true }; for (const p of plats) if (x >= p.x - 2 && x <= p.x + p.w + 2 && Math.abs(y - p.y) < 0.5) return p; return null; };
  // 一次跳躍／掉落的模擬：回傳落地點（腳的 x、y）或 null
  function sim(x, y, { vy0, dir, dirDelay = 0, dbl = null, glide = false, drop = null }) {
    let vy = vy0, t = 0, used = false, prevY = y;
    for (let n = 0; n < 420; n++) {
      t += DT;
      if (dbl !== null && !used && t >= dbl) { vy = J2; used = true; }
      const inWind = glide && winds.some((f) => Math.abs(x - f.x) < f.w / 2 && y < f.y && y > f.y - f.h);
      if (inWind) vy = Math.max(-170, vy - 1500 * DT); else vy = Math.min(MAX_FALL, vy + GRAV * DT);
      const vx = t >= dirDelay ? dir * RUN : 0;
      const nx = x + vx * DT;
      if (!bodyHit(nx, y)) x = nx;
      prevY = y;
      const ny = y + vy * DT;
      if (vy < 0) { if (sol(x - HALF, ny - TALL) || sol(x + HALF, ny - TALL)) vy = 0; else y = ny; continue; }
      // 往下：碰到實心頂面或平台頂面（從上面來的）就落地
      const fy = Math.floor(ny / T) * T;
      if ((sol(x - HALF + 1, ny) || sol(x + HALF - 1, ny)) && !(sol(x - HALF + 1, prevY) || sol(x + HALF - 1, prevY))) return { x, y: fy };
      for (const p of plats) if (p !== drop && x >= p.x - 2 && x <= p.x + p.w + 2 && prevY <= p.y && ny >= p.y) return { x, y: p.y, p };
      y = ny;
      if (y > L.h + 40) return null;
    }
    return null;
  }
  const seen = new Map(), q = [];
  const k = (x, y) => Math.round(x / 4) + "," + Math.round(y);
  const push = (x, y) => { const kk = k(x, y); if (seen.has(kk)) return; seen.set(kk, [x, y]); q.push([x, y]); };
  // 起點：從 start 往下掉到地面
  const s0 = sim(S.start.x, Math.max(-30, S.start.y - 30), { vy0: 0, dir: 0 });
  if (!s0) return { id, err: "起點下面沒有地面" };
  push(s0.x, s0.y);
  while (q.length) {
    const [x, y] = q.pop();
    const g = groundAt(x, y);
    // 走路：往左右走，走到牆停下、走出邊緣就掉（也可以掉下去時用郊狼時間跳）
    for (const dir of [-1, 1]) {
      let xx = x;
      for (let i = 0; i < 400; i++) {
        const nx = xx + dir * 4;
        if (bodyHit(nx, y)) break;
        xx = nx;
        if (!groundAt(xx, y)) {   // 走出邊緣
          for (const opt of [{ vy0: 0, dir }, { vy0: 0, dir: 0 }, { vy0: 0, dir, dbl: 0.15 }, { vy0: 0, dir, dbl: 0.4 }, { vy0: J1, dir, dbl: 0.3 }, { vy0: J1, dir }]) { const r = sim(xx, y, opt); if (r) push(r.x, r.y); }
          break;
        }
        if (i % 4 === 0) push(xx, y);
      }
    }
    // 往下穿平台
    if (g && !g.solid) { const r = sim(x, y + 1, { vy0: 0, dir: 0, drop: g }); if (r) push(r.x, r.y); }
    // 跳
    const vys = [J1]; if (g && g.shroom) vys.push(-560);
    for (const vy0 of vys) for (const dir of [-1, 0, 1]) for (const glide of winds.length ? [false, true] : [false]) for (const dirDelay of glide ? [0, 0.25, 0.5, 1, 1.5, 2, 2.5, 3] : [0, 0.25, 0.5]) for (const dbl of [null, 0.15, 0.3, 0.34, 0.45, 0.6]) {
      if (dir === 0 && dirDelay) continue;
      const r = sim(x, y, { vy0, dir, dirDelay, dbl, glide });
      if (r) push(r.x, r.y);
    }
  }
  const pts = [...seen.values()];
  if (process.env.DBG && id === process.env.DBG && open) { const [a, b, c, d] = process.env.BOX.split(",").map(Number); console.log(pts.filter(([x, y]) => x >= a && x <= b && y >= c && y <= d).map(([x, y]) => Math.round(x) + ":" + Math.round(y)).join(" ")); }
  const reach = (px, py) => pts.some(([x, y]) => Math.abs(x - px) <= 20 && Math.abs(y - py) <= 24);
  const targets = [
    ...(S.altars ?? []).map((a, i) => ["祭壇" + (i + 1), a.x, a.y ?? 600]),
    ...feats.filter((f) => f.t !== "wind").map((f) => [f.t, f.x, f.y]),
    ...(S.caches ?? []).map((c, i) => ["藏寶" + (i + 1), c.x, c.y + 16]),
    ...(S.exitX ? [["出口", S.exitX + 26, S.exitY]] : []),
    ...(S.arena ? [["王房", (S.arena.l + S.arena.r) / 2, S.arena.floor]] : []),
  ];
  const bad = targets.filter(([, x, y]) => !reach(x, y)).map(([n, x, y]) => `${n}(${x},${y})`);
  return { id, bad, n: pts.length };
}
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["1-1", "1-2", "1-3", "1-4"];
for (const id of ids) for (const open of [false, true]) { const r = check(id, open); console.log(id, open ? "機關全開" : "機關關著", r.err ?? (r.bad.length ? "到不了：" + r.bad.join("、") : "全部到得了"), r.n ? `（站過 ${r.n} 個點）` : ""); }
