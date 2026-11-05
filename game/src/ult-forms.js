// 各形態的大招（使用者 2026-11-05：每個形態要不同的大招）。星星維持 ult.js 的「零星墜落」，這裡是另外三招：
//   黏液星「黏黏大海嘯」（黏液）：背後湧起一道黏液浪，主角站上浪頭往前衝，把怪一路推著走、全部沾黏液，最後拍下來留下黏液灘。
//   鐵罐星「廢鐵豪雨」（電）：蓋子一掀把垃圾噴上天，整個畫面下垃圾雨（落點先有影子），最後一個帶電大油桶砸下來，閃電連鎖。
//   蝠翼星「月下夜襲」（毒）：天色轉深、大月亮升起，在附近的怪之間瞬間來回突擊、每隻抓三下，最後全部毒爆、吸血回復。
// 照 pixelfx skill：草稿 game/tools/drafts/ultforms.mjs（逐格總覽），畫 → 看 → 修至少三輪。
// 這個檔案不 import 任何東西（node 草稿要能跑）：地板、特效、音效等都由 ult.js 用 kit 傳進來。
//   kit = { POSES, floorAt, solidAt, spawn, fx: { poison }, flash, hitStop, shake, sfx, drawJunk, bounds }
// 每招：{ name, dur, cut: [開始, 結束], start(U, player, kit, H), update(U, dt, player, kit, H), draw(P, U, kit), lights(U, list), dim(U) }
//   H（ult.js 的 hooks）＝ { enemies(), hit(e, mult, dir, opts), view(), puddle(x, y), heal(n), dust(x, y) }

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const outCubic = (p) => 1 - (1 - p) ** 3;
const rgb = (s) => { const v = parseInt(s.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const ramp = (a) => a.map(rgb);
const rnd = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y, a) => a * 16 > BAYER[((Math.round(y) & 3) << 2) | (Math.round(x) & 3)];

// =====================================================================================
// 黏液星「黏黏大海嘯」
// =====================================================================================
const GOO = ramp(["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff"]);
const GOO_LIGHT = rgb("#8ee86a");
const SL = { rise: 0.5, cut0: 0.45, cut1: 0.9, go: 0.95, crash: 2.05, end: 2.7, H: 96, speed: 300, body: 150 };
const slime = {
  name: "黏黏大海嘯", dur: SL.end, cut: [SL.cut0, SL.cut1],
  start(U, player, kit) {
    U.side = player.face; U.x0 = player.x; U.y0 = player.y;
    U.fy = kit.floorAt(player.x, player.y - 8);
    U.front = kit.solidAt(player.x - U.side * 26, U.fy - 10) ? player.x : player.x - U.side * 26; /* 背後是牆的話從腳下出發 */ U.h = 0; U.hit = new Set(); U.hit2 = new Set(); U.drops = []; U.crashed = false; U.stopped = false;
    U.bubbles = Array.from({ length: 22 }, (_, i) => ({ dx: (rnd(i, 1) - 0.5) * 44, d: rnd(i, 2) * 0.45, sp: 40 + rnd(i, 3) * 50, r: 1 + Math.floor(rnd(i, 4) * 2.5) }));
  },
  update(U, dt, player, kit, H) {
    const t = U.t, side = U.side, P = kit.POSES;
    if (t < SL.rise) { player.ultPose(P.charge, dt); return; }
    if (t < SL.go) {   // 浪在背後湧起來
      U.h = SL.H * outCubic(clamp01((t - SL.rise) / (SL.go - SL.rise)));
      player.ultPose(P.rise, dt);
      return;
    }
    if (t < SL.crash) {   // 往前衝
      if (!U.stopped) {
        const nx = U.front + side * SL.speed * dt, [l, r] = kit.bounds();
        if (nx < l || nx > r || kit.solidAt(nx + side * 6, U.fy - 60)) U.stopped = true;   // 撞到高牆（60 以上）才停，矮台階爬過去
        else {
          U.front = nx;
          const f = kit.floorAt(U.front, U.fy - 40);
          if (Math.abs(f - U.fy) < 48) U.fy += (f - U.fy) * Math.min(1, dt * 10);   // 沿著地面高低走
        }
      }
      // 主角站在浪頭上
      player.x = U.front - side * 22; player.y = U.fy - U.h * 0.92 + Math.sin(t * 18) * 1.5;
      player.face = side; player.ultPose(P.throw, dt);
      for (const e of H.enemies()) {
        if (Math.abs(e.y - U.fy) > 110) continue;
        const d = side * (U.front - e.x);   // 浪頭已經過去多遠（> 0＝在浪裡）
        if (d >= -6 && d < SL.body) {
          if (!U.hit.has(e)) { U.hit.add(e); H.hit(e, 7, side, { launch: true, push: 5, elem: "slime" }); kit.sfx("squish"); }
          if (!e.isBoss) { e.x += side * SL.speed * dt * 0.85; e.vx = side * 60; }   // 被浪推著走
        }
      }
      if (Math.floor(t * 30) % 3 === 0) U.drops.push({ x: U.front + side * 4, y: U.fy - U.h * 0.7, vx: side * (60 + Math.random() * 90), vy: -120 - Math.random() * 100, life: 0.5 });
      return;
    }
    // 拍下來
    if (!U.crashed) {
      U.crashed = true;
      kit.shake(0.5, 4); kit.hitStop(0.08); kit.sfx("splash");
      kit.flash(U.front, U.fy - 30, 160, 3, 0.6, "#8ee86a");
      for (let i = 0; i < 36; i++) { const a = -Math.PI / 2 + (rnd(i, 9) - 0.5) * 2.6 + side * 0.4; U.drops.push({ x: U.front, y: U.fy - U.h * 0.6, vx: Math.cos(a) * (90 + rnd(i, 10) * 160), vy: Math.sin(a) * (150 + rnd(i, 11) * 140), life: 0.5 + rnd(i, 12) * 0.4 }); }
      for (const e of H.enemies()) if (Math.abs(e.x - U.front) < 80 && Math.abs(e.y - U.fy) < 90 && !U.hit2.has(e)) { U.hit2.add(e); H.hit(e, 3.5, side, { launch: true, push: 4, elem: "slime" }); }
      const span = U.front - U.x0;
      for (let k = 0; k < 4; k++) { const x = U.x0 + span * (0.2 + k * 0.27); H.puddle(x, kit.floorAt(x, U.fy - 40)); }
      H.dust(U.front, U.fy);
    }
    const k = clamp01((t - SL.crash) / 0.35);
    U.h = SL.H * (1 - k) ** 2;
    const fx = U.front - side * 10; let fy = kit.floorAt(fx, U.fy - 50);
    if (Math.abs(fy - U.fy) > 56 || kit.solidAt(fx, fy - 6)) fy = U.fy;   // 找不到合理的地面就站在浪的高度（不要卡進牆或地底）
    player.x = fx; player.y = U.fy - U.h * 0.92 + (fy - U.fy) * k;
    player.ultPose(t < SL.crash + 0.3 ? P.throw : P.finish, dt);
  },
  tick(U, dt) { for (const d of U.drops) { d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; } U.drops = U.drops.filter((d) => d.life > 0 && d.y < U.fy + 2); },
  dim(U) { const t = U.t; return t < 0.25 ? t / 0.25 : t < SL.go ? 1 : 1 - clamp01((t - SL.go) / 0.5) * 0.6; },
  lights(U, list) { if (U.h > 4) list.push({ x: U.front - U.side * 20, y: U.fy - U.h * 0.8, r: 80, lv: 1.6, col: "#8ee86a" }); },
  draw(P, U) {
    const t = U.t, side = U.side;
    // 起：腳下冒泡、地上一圈黏液
    if (t < SL.go + 0.2) for (const b of U.bubbles) {
      const p = (t - b.d) / 0.5; if (p < 0 || p >= 1) continue;
      const x = U.x0 + b.dx, y = U.fy - 2 - b.sp * p;
      for (let dy = -b.r; dy <= b.r; dy++) for (let dx = -b.r; dx <= b.r; dx++) { const d = Math.hypot(dx, dy); if (d > b.r + 0.3) continue; P.blend(x + dx, y + dy, d > b.r - 0.6 ? GOO[4] : dx + dy < 0 ? GOO[5] : GOO[3], 1 - p * 0.5); }
    }
    if (t < SL.go) { const w = Math.round(30 * clamp01(t / 0.4)); for (let dx = -w; dx <= w; dx++) { P.blend(U.x0 + dx, U.fy - 1, GOO[3], 0.9); if (Math.abs(dx) < w - 3) P.blend(U.x0 + dx, U.fy - 2, GOO[4], 0.7); } }
    // 第 2 輪：原本像一座斜坡（斜上去、前面垂直切掉）→ 浪身是圓滑的駝峰（最高點在浪頭後面一點），
    //   浪頭往前捲成一道粗弧（外緣白泡沫、內側亮綠），捲浪底下的浪面暗一階；浪面有斜的亮紋，越後面越透明
    if (U.h > 1) {
      const L = t < SL.go ? 60 : SL.body, Hh = U.h, peak = 16;
      for (let d = -2; d < L; d++) {
        const x = U.front - side * d;
        const prof = d < peak ? 0.62 + 0.38 * Math.sin((Math.max(0, d) / peak) * Math.PI / 2) : Math.cos(((d - peak) / (L - peak)) * Math.PI / 2) ** 0.9;
        const hgt = Math.round(Hh * prof + Math.sin(d * 0.3 - t * 8) * 1.5 * (d > peak ? 1 : 0));
        const tail = d > L * 0.65 ? 1 - (d - L * 0.65) / (L * 0.35) : 1;
        for (let yy = 0; yy < hgt; yy++) {
          const y = U.fy - 1 - yy, fromTop = hgt - yy;
          if (tail < 1 && !dith(x, y, tail)) continue;
          // 第 3 輪：斜紋太規則像下雨、捲浪底下的陰影是方塊 → 改成兩條沿著浪頂的斷續亮帶（水面的波紋），前緣暗一階
          const band = (fromTop === 11 || fromTop === 21) && rnd(Math.floor((d + t * 30) / 5), fromTop) < 0.6;
          let c = fromTop <= 1 ? GOO[6] : fromTop <= 3 ? GOO[5] : fromTop <= 6 ? GOO[4] : band ? GOO[4] : yy < 5 ? GOO[1] : d < 3 ? GOO[1] : GOO[2];
          if (Math.floor((yy + t * 60 + d * 7) % 23) === 0 && d % 9 === 3) c = GOO[5];   // 泡泡
          P.blend(x, y, c, fromTop <= 6 ? 1 : 0.9);
          if (fromTop <= 4) P.glow(x, y, GOO_LIGHT, 0.25);
        }
      }
      // 捲浪：從最高點出發往前、往下捲的實心粗弧（第 3 輪：原本點太稀又浮在前面，像一圈虛線）
      const R = Hh * 0.32, cx = U.front - side * peak, cy = U.fy - Hh + R, steps = Math.ceil(R * 5);
      for (let k = 0; k <= steps; k++) {
        const ang = -Math.PI / 2 + (k / steps) * Math.PI * 0.85, th = Math.max(2, Math.round(7 * (1 - k / (steps * 1.2))));
        for (let w = 0; w < th; w++) {
          const r = R - w, x = cx + side * Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
          P.blend(x, y, w === 0 ? GOO[6] : w === 1 ? GOO[5] : GOO[4], 1); if (w < 2) P.glow(x, y, GOO_LIGHT, 0.35);
        }
      }
      // 浪頭噴出去的泡沫
      for (let k = 0; k < 6; k++) { const a = rnd(k, Math.floor(t * 15)), x = cx + side * (R + 1 + a * 6), y = cy - R * 0.2 + (rnd(k + 9, Math.floor(t * 15)) - 0.5) * 10; P.blend(x, y, GOO[6], 0.9); }
    }
    // 拍下來：往上噴的水柱＋地面一圈白色衝擊線
    if (U.crashed) {
      const age = t - SL.crash;
      if (age < 0.45) {
        const hgt = Math.round(70 * Math.sin(Math.min(1, age / 0.45) * Math.PI) ), w = 8 + Math.round(age * 30);
        for (let yy = 0; yy < hgt; yy++) for (let dx = -w; dx <= w; dx++) {
          const e = 1 - Math.abs(dx) / (w + 1), top = hgt * (0.5 + 0.5 * e);
          if (yy > top || !dith(U.front + dx, U.fy - yy, e * (1 - age / 0.45) + 0.2)) continue;
          P.blend(U.front + dx, U.fy - 1 - yy, yy > top - 3 ? GOO[6] : e > 0.6 ? GOO[5] : GOO[4], 0.95); P.glow(U.front + dx, U.fy - 1 - yy, GOO_LIGHT, 0.3);
        }
        const ring = Math.round(age * 260);
        for (const sgn of [-1, 1]) for (let k = 0; k < 10; k++) P.blend(U.front + sgn * (ring - k), U.fy - 1, k < 3 ? GOO[6] : GOO[4], 1 - k / 10);
      }
    }
    // 水花
    for (const d of U.drops) { const big = d.life > 0.35; P.blend(d.x, d.y, big ? GOO[6] : GOO[5], 1); P.blend(d.x + 1, d.y, GOO[4], 0.9); if (big) { P.blend(d.x, d.y + 1, GOO[4], 0.9); P.blend(d.x + 1, d.y + 1, GOO[3], 0.9); } P.glow(d.x, d.y, GOO_LIGHT, 0.3); }   // 第 2 輪：水珠 2×2
  },
};

// =====================================================================================
// 鐵罐星「廢鐵豪雨」
// =====================================================================================
const WARN = ramp(["#c47a12", "#ffc23d"]), WARN_LIGHT = rgb("#ffc23d"), SHADOW = rgb("#0a0610"), ZAP = ramp(["#1e64b0", "#3ab8f0", "#9af0ff", "#f0ffff"]), ZAP_LIGHT = rgb("#9af0ff");
const DRUM = ramp(["#2a1418", "#5a2a20", "#8a3e24", "#b05a2a", "#d27c3c"]), STRIPE = ramp(["#2a2010", "#f0b424"]);
const CN = { throw: 0.3, cut0: 0.5, cut1: 0.95, rain0: 0.95, rain1: 2.15, drum0: 2.2, drumHit: 2.5, end: 2.9, N: 26 };
const can = {
  name: "廢鐵豪雨", dur: CN.end, cut: [CN.cut0, CN.cut1],
  start(U, player, kit, H) {
    U.side = player.face; U.x0 = player.x; U.y0 = player.y; U.fy = kit.floorAt(player.x, player.y - 8);
    U.ups = []; U.items = []; U.counts = new Map(); U.drum = null; U.bolts = []; U.next = 0;
    const v = H.view(), foes = H.enemies().filter((e) => e.x > v.l && e.x < v.r && Math.abs(e.y - U.y0) < 140);
    U.plan = Array.from({ length: CN.N }, (_, i) => {
      const aim = foes.length && i % 2 === 0 ? foes[(i >> 1) % foes.length].x + (rnd(i, 3) - 0.5) * 16 : v.l + 12 + rnd(i, 4) * (v.r - v.l - 24);
      return { t: CN.rain0 + (i / CN.N) * (CN.rain1 - CN.rain0 - 0.3), x: aim, type: ["can", "tire", "plank"][i % 3] };
    });
  },
  update(U, dt, player, kit, H) {
    const t = U.t, side = U.side, P = kit.POSES, v = H.view();
    player.ultPose(t < CN.throw ? P.charge : t < CN.drumHit + 0.15 ? P.throw : P.finish, dt);
    // 起：噴垃圾上天
    if (t >= CN.throw && U.ups.length === 0) {
      kit.sfx("clank"); kit.shake(0.2, 2);
      for (let i = 0; i < 10; i++) U.ups.push({ x: player.x, y: player.y - 22, vx: (rnd(i, 1) - 0.5) * 180, vy: -360 - rnd(i, 2) * 220, type: ["can", "tire", "plank"][i % 3], rot: 0 });   // 第 2 輪：6 → 10 個
      U.pop = t;
    }
    for (const u of U.ups) { u.vy += 200 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.rot += dt * 10; }
    // 承～轉：垃圾雨
    while (U.next < U.plan.length && t >= U.plan[U.next].t) {
      const p = U.plan[U.next++], fy = kit.floorAt(p.x, U.y0 - 120);
      U.items.push({ x: p.x, y: v.top - 20 - 70, vy: 380, fy, type: p.type, rot: rnd(U.next, 5) * 6, land: -1, warn: 0 });
    }
    for (const it of U.items) {
      it.warn += dt;
      if (it.land < 0) {
        it.vy += 900 * dt; it.y += it.vy * dt; it.rot += dt * 12;
        if (it.y >= it.fy - 4) {
          it.y = it.fy - 4; it.land = 0; it.vy = -90; H.dust(it.x, it.fy); if (Math.random() < 0.5) kit.sfx("clank");
          for (const e of H.enemies()) {
            if (Math.abs(e.x - it.x) > 20 || Math.abs(e.y - it.fy) > 44) continue;
            const n = U.counts.get(e) ?? 0; if (n >= 4) continue;
            U.counts.set(e, n + 1); H.hit(e, 1.1, e.x < it.x ? -1 : 1, { launch: true, push: 3 });
          }
        }
      } else { it.land += dt; it.vy += 600 * dt; it.y = Math.min(it.fy - 4, it.y + it.vy * dt); }
    }
    U.items = U.items.filter((it) => it.land < 0.45);
    // 合：帶電大油桶
    if (t >= CN.drum0 && !U.drum) { const x = Math.max(v.l + 30, Math.min(v.r - 30, player.x + side * 70)); U.drum = { x, y: v.top - 40, fy: kit.floorAt(x, U.y0 - 120), landed: false }; }
    if (U.drum && !U.drum.landed) {
      const k = clamp01((t - CN.drum0) / (CN.drumHit - CN.drum0)), d = U.drum;
      d.y = (H.view().top - 40) + (d.fy - (H.view().top - 40)) * k * k;
      if (k >= 1) {
        d.landed = true; d.y = d.fy;
        kit.hitStop(0.14); kit.shake(0.7, 6); kit.flash(d.x, d.fy - 20, 220, 4, 0.9, "#9af0ff"); kit.sfx("crit"); U.post = 1;
        for (const e of H.enemies()) {
          if (Math.abs(e.x - d.x) > 150 || Math.abs(e.y - d.fy) > 110) continue;
          H.hit(e, 3, e.x < d.x ? -1 : 1, { launch: true, push: 4, elem: "shock" });
          U.bolts.push({ x0: d.x, y0: d.fy - 18, x1: e.x, y1: e.y - 10, seed: U.bolts.length + 1 });
        }
        for (let i = 0; i < 4; i++) U.bolts.push({ x0: d.x, y0: d.fy - 18, x1: d.x + (i - 1.5) * 50, y1: d.fy - 2, seed: 20 + i });   // 打到地上的
        H.dust(d.x, d.fy);
      }
    }
  },
  dim(U) { const t = U.t; return t < 0.25 ? t / 0.25 : t < CN.drumHit ? 1 : 1 - clamp01((t - CN.drumHit) / 0.4); },
  lights(U, list) { if (U.drum) list.push({ x: U.drum.x, y: U.drum.y - 10, r: U.drum.landed ? 140 : 50, lv: U.drum.landed ? 3 : 1.5, col: "#9af0ff" }); },
  draw(P, U, kit) {
    const t = U.t, put = (x, y, c) => P.blend(x, y, [c & 255, (c >>> 8) & 255, (c >>> 16) & 255], 1);
    for (const u of U.ups) kit.drawJunk(put, u.type, u.x, u.y, u.rot);
    // 開場：頭頂一圈放射狀火花（第 2 輪：開場太弱）
    if (U.pop !== undefined && t - U.pop < 0.25) { const a = 1 - (t - U.pop) / 0.25, r0 = 4 + (t - U.pop) * 80; for (let q = 0; q < 10; q++) { const ang = (q / 10) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang); for (let d = 0; d < 6; d++) { const x = U.x0 + ca * (r0 + d), y = U.y0 - 22 + sa * (r0 + d) * 0.8; P.blend(x, y, d < 2 ? WARN[1] : WARN[0], a); P.glow(x, y, WARN_LIGHT, a * 0.4); } } }
    // 落點預告：影子＋琥珀色的準星（第 2 輪：原本暗色影子在暗地面上看不到）——從寬到窄、越接近落地閃越快
    for (const it of U.items) if (it.land < 0) {
      const k = clamp01(it.warn / 0.4), w = Math.round(12 - 7 * k), blink = Math.floor(it.warn * (8 + 16 * k)) % 2 === 0;
      for (let dx = -w + 2; dx <= w - 2; dx++) P.blend(it.x + dx, it.fy - 1, SHADOW, 0.7);
      if (blink) for (const sgn of [-1, 1]) for (let j = 0; j < 3; j++) { P.blend(it.x + sgn * (w - j), it.fy - 1, WARN[1], 1); P.glow(it.x + sgn * (w - j), it.fy - 1, WARN_LIGHT, 0.5); P.blend(it.x + sgn * w, it.fy - 1 - j, WARN[1], 1); }
    }
    for (const it of U.items) kit.drawJunk(put, it.type, it.x, it.y, it.rot);
    // 油桶：鏽紅的圓桶、中間一圈黃黑警示條、周圍劈啪的電
    if (U.drum) {
      const d = U.drum, x0 = Math.round(d.x), y0 = Math.round(d.y);
      // 第 2 輪：油桶放大到 26×32，警示條上一個閃電符號，掉下來拖速度線，身邊 6 道電弧
      if (!d.landed) for (let q = -3; q <= 3; q++) for (let k = 0; k < 26; k++) P.blend(x0 + q * 4, y0 - 34 - k, ZAP[1], (1 - k / 26) * 0.5);
      // 第 3 輪：電弧從桶緣出發、畫在油桶後面（原本從中心畫、把油桶蓋住）
      for (let i = 0; i < 6; i++) { const ang = t * 18 + i * 1.05, ca = Math.cos(ang), sa = Math.sin(ang), r = 22 + (i % 3) * 5; zap(P, x0 + ca * 12, y0 - 16 + sa * 14, x0 + ca * r, y0 - 16 + sa * r, i + Math.floor(t * 24), 0.85); }
      for (let yy = -32; yy <= 0; yy++) for (let xx = -13; xx <= 13; xx++) {
        const edge = Math.abs(xx) === 13 || yy === -32 || yy === 0, ring = yy === -26 || yy === -6, lid = yy === -31;
        const band = yy >= -20 && yy <= -12, bolt = band && Math.abs(xx - Math.round((yy + 16) * -0.9 + ((yy + 16) > 0 ? 3 : -3) * 0)) <= 1 && Math.abs(xx) < 6;
        const c = edge ? DRUM[0] : lid ? DRUM[4] : ring ? DRUM[4] : bolt ? ZAP[3] : band ? STRIPE[((xx + yy + 60) >> 1) % 2] : xx < -6 ? DRUM[3] : xx < -2 ? DRUM[4] : xx > 7 ? DRUM[1] : DRUM[2];
        P.blend(x0 + xx, y0 + yy, c, 1);
      }
      // 落地：地面掃出一圈青色電波
      if (d.landed) {
        const age = t - CN.drumHit;
        if (age < 0.5) { const ring = age * 320, a = 1 - age / 0.5; for (const sgn of [-1, 1]) for (let k = 0; k < 14; k++) { const x = x0 + sgn * (ring - k), e = 1 - k / 14; for (let h = 0; h < 3; h++) P.blend(x, d.fy - 1 - h, h === 0 || k < 3 ? ZAP[3] : ZAP[2], e * a * (1 - h * 0.25)); P.glow(x, d.fy - 2, ZAP_LIGHT, 0.7 * e * a); } }
        if (age < 0.12) for (let q = -26; q <= 26; q++) { const e = 1 - Math.abs(q) / 27; P.blend(x0 + q, y0 - 16, ZAP[3], e); P.blend(x0, y0 - 16 + q * 0.8, ZAP[3], e); P.glow(x0 + q, y0 - 16, ZAP_LIGHT, e); }   // 第 3 輪：落地瞬間的白色十字光
      }
    }
    for (const b of U.bolts) { const age = t - CN.drumHit; if (age < 0.5 && Math.floor(age * 30) % 4 !== 3) zap(P, b.x0, b.y0, b.x1, b.y1, b.seed + Math.floor(age * 20), Math.min(1, 1.4 - age / 0.5)); }   // 第 3 輪：連到怪的閃電持續久一點、少閃
  },
};
/** 一道閃電：起點到終點，中間隨機折幾下；中心白、外面青 */
function zap(P, x0, y0, x1, y1, seed, a) {
  const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9)), pts = [[x0, y0]];
  for (let i = 1; i < n; i++) { const u = i / n; pts.push([x0 + (x1 - x0) * u + (rnd(seed, i) - 0.5) * 10, y0 + (y1 - y0) * u + (rnd(seed, i + 50) - 0.5) * 10]); }
  pts.push([x1, y1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], m = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) | 0;
    for (let s = 0; s <= m; s++) { const x = ax + (bx - ax) * (s / (m || 1)), y = ay + (by - ay) * (s / (m || 1)); P.blend(x, y, ZAP[3], a); P.blend(x + 1, y, ZAP[2], a * 0.9); P.blend(x - 1, y, ZAP[1], a * 0.6); P.glow(x, y, ZAP_LIGHT, a * 0.6); }
    // 第 2 輪：中間的折點長出短分岔
    if (i > 0 && rnd(seed, i + 90) < 0.45) { const bx2 = ax + (rnd(seed, i + 91) - 0.5) * 16, by2 = ay + 6 + rnd(seed, i + 92) * 8, mm = Math.max(Math.abs(bx2 - ax), Math.abs(by2 - ay)) | 0; for (let s = 0; s <= mm; s++) P.blend(ax + (bx2 - ax) * (s / (mm || 1)), ay + (by2 - ay) * (s / (mm || 1)), ZAP[1], a * 0.8); }
  }
}

// =====================================================================================
// 蝠翼星「月下夜襲」
// =====================================================================================
const NIGHT = rgb("#0a0820"), MOON = ramp(["#5a4a8a", "#8a7ab8", "#b8a8e0", "#e8e0ff", "#ffffff"]), MOON_LIGHT = rgb("#c8b8ff");
const CLAW = ramp(["#3a1660", "#7a3ab8", "#c48cff", "#f0d8ff", "#ffffff"]), CLAW_LIGHT = rgb("#b48ae8");
const BT = { moon: 0.5, cut0: 0.45, cut1: 0.9, s0: 0.9, s1: 2.3, back: 2.35, end: 2.9, N: 8 };
const bat = {
  name: "月下夜襲", dur: BT.end, cut: [BT.cut0, BT.cut1], tint: [26, 18, 64],   // 暗場往深藍紫壓（夜晚）
  start(U, player, kit, H) {
    U.side = player.face; U.x0 = player.x; U.y0 = player.y;
    const foes = H.enemies().filter((e) => Math.abs(e.x - player.x) < 210 && Math.abs(e.y - player.y) < 120).sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x)).slice(0, BT.N);
    U.targets = foes; U.k = -1; U.trails = []; U.claws = []; U.struck = new Set(); U.hits = 0; U.burst = false; U.visits = new Map();
    U.prev = { x: player.x, y: player.y - 10 };
  },
  update(U, dt, player, kit, H) {
    const t = U.t, P = kit.POSES;
    if (t < BT.s0) { player.ultPose(t < BT.moon ? P.charge : P.rise, dt); return; }
    if (t < BT.s1) {
      const k = Math.floor((t - BT.s0) / ((BT.s1 - BT.s0) / BT.N)), local = (t - BT.s0) - k * ((BT.s1 - BT.s0) / BT.N);
      if (k !== U.k && k < BT.N) {   // 下一次突擊：瞬移到目標旁邊
        U.k = k;
        const alive = U.targets.filter((e) => !e.dead), e = alive.length ? alive[k % alive.length] : null;
        const x = e ? e.x + (k % 2 ? -12 : 12) : U.x0 + U.side * (30 + k * 18), y = e ? e.y : U.y0;
        U.trails.push({ x0: U.prev.x, y0: U.prev.y, x1: x, y1: y - 10, t });
        U.prev = { x, y: y - 10 };
        player.x = x; player.y = y; player.face = e ? (e.x > x ? 1 : -1) : U.side;
        U.cur = e; U.n = 0; kit.sfx("dash");
      }
      player.ultPose(P.throw, dt);
      // 抓三下（0、0.05、0.1 秒），最後一下帶毒
      if (U.cur && !U.cur.dead && U.n < 3 && local >= U.n * 0.05) {
        const e = U.cur; U.n++;
        // 平衡（王戰實測：只有王一隻時 8 次突擊全打在王身上，約 21 倍攻擊力、一招秒殺）：同一隻最多吃 2 次完整突擊（加上毒爆約 9 倍，跟其他大招打平），之後只剩擦傷
        const visits = (U.visits ??= new Map()), v = (visits.get(e) ?? 0) + (U.n === 1 ? 1 : 0);
        if (U.n === 1) visits.set(e, v);
        H.hit(e, v <= 2 ? 0.8 : 0.12, player.face, { push: 1, elem: U.n === 3 ? "poison" : null });
        U.struck.add(e); U.hits++;
        U.claws.push({ x: e.x, y: e.y - 12, t, flip: (U.k + U.n) % 2, n: U.n });
      }
      return;
    }
    if (!U.back) { U.back = true; U.trails.push({ x0: U.prev.x, y0: U.prev.y, x1: U.x0, y1: U.y0 - 10, t }); player.x = U.x0; player.y = U.y0; player.face = U.side; }
    player.ultPose(P.finish, dt);
    if (t >= BT.back && !U.burst) {
      U.burst = true; kit.shake(0.4, 3); kit.hitStop(0.08); kit.sfx("crit");
      for (const e of U.struck) if (!e.dead) { H.hit(e, 2, e.x < U.x0 ? -1 : 1, { launch: true, push: 3, elem: "poison" }); if (kit.fx.poison) kit.spawn(kit.fx.poison, { x: Math.round(e.x), y: Math.round(e.y), light: 0.4 }, { speed: 1.6 }); }
      const heal = Math.min(0.3, U.hits * 0.012);
      if (heal > 0) { H.heal(heal); kit.flash(U.x0, U.y0 - 12, 70, 2, 0.4, "#c48cff"); }
    }
  },
  dim(U) { const t = U.t; return t < 0.35 ? (t / 0.35) * 1.15 : t < BT.back ? 1.15 : 1.15 - clamp01((t - BT.back) / 0.5) * 1.15; },
  lights(U, list, H) { const m = moonPos(U, H); if (m) list.push({ x: m.x, y: m.y, r: 90, lv: 1.4, col: "#c8b8ff" }); },
  draw(P, U, kit, H) {
    const t = U.t, m = moonPos(U, H);
    // 月亮：大圓、左上亮右下暗、幾個坑、外面一圈抖動的光暈；前面飛過幾隻蝙蝠剪影
    if (m) {
      const R = 20;
      for (let y = -R - 6; y <= R + 6; y++) for (let x = -R - 6; x <= R + 6; x++) {
        const d = Math.hypot(x, y);
        if (d <= R) {
          const lit = (-x - y) / (R * 1.4), crater = [[-6, -4, 4], [7, 5, 5], [-2, 10, 3], [9, -9, 2]].some(([cx, cy, cr]) => Math.hypot(x - cx, y - cy) < cr);
          if (m.a < 1 && !dith(m.x + x, m.y + y, m.a)) continue;   // 第 2 輪：淡出用網點（原本半透明混出褐色）
          P.blend(m.x + x, m.y + y, crater ? MOON[1] : d > R - 1 ? MOON[2] : lit > 0.3 ? MOON[4] : lit > -0.2 ? MOON[3] : MOON[2], 1);
          P.glow(m.x + x, m.y + y, MOON_LIGHT, 0.25 * m.a);
        } else if (d < R + 6 && dith(m.x + x, m.y + y, (1 - (d - R) / 6) * 0.5 * m.a)) P.blend(m.x + x, m.y + y, MOON[1], 0.6);
      }
      for (let i = 0; i < 4; i++) {   // 蝙蝠剪影（小 V）飛過月亮
        const bx = m.x - 50 + ((t * 40 + i * 31) % 100), by = m.y - 12 + i * 7 + Math.sin(t * 10 + i) * 2, flap = Math.floor(t * 12 + i) % 2;
        for (const [dx, dy] of [[0, 0], [-1, -1 + flap], [-2, -1 + flap * 2], [1, -1 + flap], [2, -1 + flap * 2]]) P.blend(bx + dx, by + dy, rgb("#140a24"), m.a);
      }
    }
    // 夜色：第 3 輪改在暗場（ult.js dimScene）往 tint 的顏色壓——第 2 輪疊在最上層，連月亮、主角都被蓋上網點
    // 殘影線：前一個位置到新位置，一條紫色虛線，很快消失
    for (const s of U.trails) {
      const age = t - s.t; if (age > 0.22) continue;
      const a = 1 - age / 0.22, n = Math.max(1, Math.round(Math.hypot(s.x1 - s.x0, s.y1 - s.y0)));
      for (let i = 0; i <= n; i += 1) { const u = i / n, x = s.x0 + (s.x1 - s.x0) * u, y = s.y0 + (s.y1 - s.y0) * u; if (i % 5 === 4) continue; P.blend(x, y, u > 0.8 ? CLAW[4] : CLAW[3], a * (0.4 + 0.6 * u)); P.blend(x, y + 1, CLAW[2], a * (0.4 + 0.6 * u)); P.blend(x, y - 1, CLAW[1], a * 0.5); P.glow(x, y, CLAW_LIGHT, a * 0.4); }
      // 第 2 輪：沿路三個蝙蝠翅膀形的殘影（越舊越暗）
      for (let g = 1; g <= 3; g++) { const u = g / 4, gx = s.x0 + (s.x1 - s.x0) * u, gy = s.y0 + (s.y1 - s.y0) * u, ga = a * u; for (const [dx, dy] of [[0, 0], [-1, -1], [-2, -2], [-3, -2], [-4, -1], [1, -1], [2, -2], [3, -2], [4, -1], [-2, -1], [2, -1], [0, 1]]) P.blend(gx + dx, gy + dy, CLAW[1 + (g === 3 ? 1 : 0)], ga); }
    }
    // 爪痕：三道平行的斜線，中間白、兩邊紫，閃一下就淡掉
    for (const c of U.claws) {
      const age = t - c.t; if (age > 0.28) continue;
      const a = 1 - age / 0.28, grow = clamp01(age / 0.05), dir = c.flip ? 1 : -1;
      // 第 2 輪：爪痕加長到 22、三道兩端收尖（中間兩格寬）
      for (let j = -1; j <= 1; j++) for (let s = -11; s <= -11 + 22 * grow; s++) {
        const x = c.x + s * dir + j * 4, y = c.y + s * 0.85 - j * 2;
        const e = 1 - Math.abs(s) / 12, wide = e > 0.45;
        P.blend(x, y, e > 0.55 ? CLAW[4] : e > 0.25 ? CLAW[3] : CLAW[2], a); if (wide) P.blend(x + dir, y, CLAW[2], a); P.blend(x - dir, y + 1, CLAW[1], a * 0.6); P.glow(x, y, CLAW_LIGHT, a * 0.6 * e);
      }
    }
  },
};
function moonPos(U, H) {
  const t = U.t; if (t > BT.end) return null;
  const v = H.view(), k = outCubic(clamp01(t / BT.moon)), a = t > BT.back ? 1 - clamp01((t - BT.back) / 0.5) : 1;
  return { x: v.l + (v.r - v.l) * 0.72, y: v.top - 24 + 64 * k, a: Math.min(1, k * 1.5) * a };
}

export const FORM_ULTS = { slime, can, bat };
