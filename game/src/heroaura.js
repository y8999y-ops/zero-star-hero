// 裝備頁：星星周圍的形態粒子（使用者 2026-11-06「裝備介面的星星周圍會有不同的粒子效果圍繞，根據吸收的種類越來越多」）
//   每吸收一種魔物，就多一圈那種形態的粒子繞著星星轉；同一種吸得越多（核越多），那一圈的粒子越多。
//   黏液星＝低圈：亮綠色黏液珠（暗邊＋白高光），偶爾冒一顆泡泡往上飄
//   鐵罐星＝中圈：灰色螺帽、螺絲，旁邊一閃一閃的黃色電火花
//   蝠翼星＝高圈：小蝙蝠剪影拍翅膀（兩格動畫），紅眼睛
//   其他（之後的新形態）＝那個形態顏色的光點
// 參考（只學做法）：pixelfx nature/leaf-storm（粒子在角色前後繞、後面那半暗一階）、critters/bat（翅膀幾格、紅眼發光）、
//       water/bubbles（泡泡的亮邊和高光）。
// drawAura(frame, t, { cx, cy }, forms, half)：forms＝[{ id, n }]（n＝吸收過幾顆），half＝"back" 畫星星後面那半、"front" 前面那半
const TAU = Math.PI * 2;
const U = (h) => { const n = parseInt(h.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; };
const GOO = ["#1e5a2a", "#3aa83a", "#7ee86a", "#d8ffb0", "#ffffff"].map(U);
const IRON = ["#2a2e3a", "#5a6274", "#9aa6ba", "#dfe6f0"].map(U);
const VOLT = ["#c89a20", "#ffe27a", "#fffbe0"].map(U);
const BAT = ["#1a1028", "#3e2a5e", "#6a4a98", "#ff4a5a"].map(U);
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 每一種形態的軌道：dy＝離星星中心的高度、rx/ry＝橢圓（ry 小＝斜躺的圈）、sp＝轉速（正負＝方向）
const BAND = { slime: { dy: 20, rx: 30, ry: 7, sp: 0.55 }, can: { dy: 2, rx: 34, ry: 8, sp: -0.4 }, bat: { dy: -20, rx: 28, ry: 9, sp: 0.75 } };
const EXTRA = [{ dy: 10, rx: 38, ry: 6, sp: 0.3 }, { dy: -10, rx: 36, ry: 10, sp: -0.6 }];

export function drawAura(frame, t, o, forms, half) {
  const W = frame.w, H = frame.h, C = frame.color, L = frame.light, front = half === "front";
  const put = (x, y, c, lit = false) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; C[y * W + x] = c; if (lit) L[y * W + x] = c; };
  // 柔光：半徑 r 的圓，往外變淡（加到光層，不蓋掉別人的光）
  const glow = (x, y, c, k, r = 3) => {
    x = Math.round(x); y = Math.round(y);
    const cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const f = 1 - Math.hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
      const i = Y * W + X, d = L[i], q = f * f * k;
      L[i] = (0xff000000 | (Math.min(255, ((d >>> 16) & 255) + cb * q) << 16) | (Math.min(255, ((d >>> 8) & 255) + cg * q) << 8) | Math.min(255, (d & 255) + cr * q)) >>> 0;
    }
  };
  const TRAIL = { slime: GOO[1], can: IRON[1], bat: BAT[2] };
  let extra = 0;
  for (const { id, n } of forms) {
    const B0 = BAND[id] ?? EXTRA[extra++ % EXTRA.length], k = o.k ?? 1;   // o.k：整組放大（裝備頁的星星畫成 2 倍大，圈要跟著大）
    const B = { dy: B0.dy * k, rx: B0.rx * k, ry: B0.ry * k, sp: B0.sp };
    const count = Math.min(id === "bat" ? 10 : 14, 3 + n * 2);   // 吸得越多越多（第 1 顆＝5 個，最多 14 個）
    // 第 2 輪：淡淡的點線軌道（看得出是「繞著轉」），後面那半更稀
    const tc = TRAIL[id] ?? U(o.colors?.[id] ?? "#ffd84a"), N = Math.round((B.rx + B.ry) * 3);
    for (let k = 0; k < N; k++) { const g = (k / N) * TAU, sg = Math.sin(g); if ((sg >= 0) !== front || k % (front ? 3 : 5) || (front && Math.abs(Math.cos(g)) < 0.5)) continue; put(o.cx + Math.cos(g) * B.rx, o.cy + B.dy + sg * B.ry, tc); }   // 第 3 輪：前半圈只畫兩側（不要在星星身上縫一排點）
    for (let i = 0; i < count; i++) {
      // 不平均分布：每顆有自己的角度偏移、半徑、上下晃
      const a = (i / count) * TAU + hash(i, id.length * 7) * 0.6 + t * B.sp, sa = Math.sin(a);
      if ((sa >= 0) !== front) continue;
      const r = 0.85 + hash(i, 3) * 0.3, x = o.cx + Math.cos(a) * B.rx * r, y = o.cy + B.dy + sa * B.ry * r + Math.sin(t * 2.2 + i * 1.7) * 1.5;
      const far = !front;   // 後面那半暗一階
      if (id === "slime") {
        // 黏液珠：3×3 圓、暗邊、左上白高光；落後半圈只畫成 2×2 暗綠
        if (far) { put(x, y, GOO[1]); put(x + 1, y, GOO[0]); put(x, y + 1, GOO[0]); continue; }
        // 第 2 輪：放大成 5×4 的水滴（上尖下圓），暗邊、左上白高光、發一點綠光
        const D = ["..a..", ".aba.", "abccb", "abbbd", ".ddd."], M = { a: GOO[1], b: GOO[2], c: GOO[3], d: GOO[0] };
        D.forEach((row, j) => [...row].forEach((ch, k) => { if (ch !== ".") put(x - 2 + k, y - 3 + j, M[ch]); }));
        put(x - 1, y - 1, GOO[4], true); put(x, y - 1, GOO[3], true);
        glow(x, y - 1, GOO[2], 0.35, 3);
        // 偶爾冒一顆小泡泡往上飄、破掉
        const p = (t * 0.7 + hash(i, 11)) % 1;
        if (hash(i, 12) < 0.4 && p < 0.8) { const by = y - 3 - p * 14, bx = x + Math.sin(p * 9 + i) * 2; put(bx, by, GOO[3], true); if (p < 0.5) put(bx + 1, by - 1, GOO[4]); }
      } else if (id === "can") {
        // 螺帽（2×2＋中間空）或螺絲（1×3），慢慢轉；旁邊一閃一閃的電火花
        const spin = Math.floor(t * 6 + i) % 4, hi = far ? IRON[1] : IRON[3], mid = far ? IRON[0] : IRON[2], lo = far ? IRON[0] : IRON[1];
        // 第 2 輪：螺帽 4×4（中間有洞、轉的時候高光換邊）、螺絲 2×5（頭比較寬）
        if (i % 3 === 0) { const v = spin % 2; for (let k = -2; k <= 2; k++) { put(x + (v ? k : 0), y + (v ? 0 : k), k < -1 ? hi : k > 1 ? lo : mid); put(x + (v ? k : 1), y + (v ? 1 : k), k > 0 ? lo : mid); } put(x + (v ? -2 : -1), y + (v ? -1 : -2), hi); put(x + (v ? -1 : -1), y + (v ? -1 : -2), hi); }
        else {
          for (let j = -2; j <= 1; j++) for (let k = -2; k <= 1; k++) { if ((j === -2 || j === 1) && (k === -2 || k === 1)) continue; put(x + k, y + j, j + k < -1 ? hi : j + k > 0 ? lo : mid); }
          put(x - 1 + (spin % 2), y - 1 + (spin > 1 ? 1 : 0), U("#14161e"));   // 洞
        }
        if (!far && Math.floor(t * 9 + i * 3) % 3 === 0) {
          // 電火花：一小段鋸齒（白芯黃邊）
          const dir = hash(i, Math.floor(t * 9)) < 0.5 ? -1 : 1;
          put(x + dir * 2, y - 1, VOLT[2], true); put(x + dir * 3, y - 2, VOLT[1], true); put(x + dir * 3, y, VOLT[1], true); put(x + dir * 4, y - 1, VOLT[0], true);
          glow(x + dir * 3, y - 1, VOLT[1], 0.7, 3);
        }
      } else if (id === "bat") {
        // 小蝙蝠：身體 1×2，翅膀上下兩格動畫，紅眼；朝飛的方向
        const flap = Math.floor(t * 10 + i * 2) % 2, body = far ? BAT[1] : BAT[2], wing = far ? BAT[0] : BAT[1], edge = far ? BAT[1] : BAT[2];
        // 第 2 輪：翅膀展開 9 格寬、兩格動畫（上舉＝V 字、下拍＝攤平往下垂），耳朵兩格，紅眼發光
        put(x, y, body); put(x + 1, y, body); put(x, y + 1, wing); put(x + 1, y + 1, wing); put(x, y - 1, edge); put(x + 1, y - 1, edge);
        const WU = [[-1, -1], [-2, -2], [-3, -3], [-4, -3], [-2, -1], [-3, -2]], WD = [[-1, 0], [-2, 0], [-3, 0], [-4, 1], [-2, 1], [-3, 1], [-4, 2]];
        for (const [dx, dy] of flap ? WU : WD) { put(x + dx, y + dy, dy < 0 || dx > -3 ? edge : wing); put(x + 1 - dx, y + dy, dy < 0 || dx > -3 ? edge : wing); }
        if (!far) { put(x, y, BAT[3], true); put(x + 1, y, BAT[3], true); glow(x, y, BAT[3], 0.45, 2); }
      } else {
        // 之後的新形態：那個形態顏色的光點（十字一閃）
        const c = U(o.colors?.[id] ?? "#ffd84a"), tw = Math.floor(t * 6 + i) % 4 === 0;
        put(x, y, c, !far);
        if (tw && !far) { put(x - 1, y, c, true); put(x + 1, y, c, true); put(x, y - 1, c, true); put(x, y + 1, c, true); }
      }
    }
  }
}
