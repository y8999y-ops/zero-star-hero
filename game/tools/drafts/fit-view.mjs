// 找出跟照片一樣的觀看角度：讓立方體 8 個角（＝星形八面體的 8 個尖角）投影後對上照片的尖角位置
const tips = [[195, 15], [45, 75], [345, 75], [62, 243], [325, 243], [195, 340], [195, 168]]; // 上、左、右、左下、右下、下、中心（朝鏡頭）
const cx = 195, cyy = 180;
const T = tips.map(([x, y]) => [x - cx, -(y - cyy)]);
const V = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
const rot = (v, a, b, c) => {
  let [x, y, z] = v;
  [x, z] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  [y, z] = [y * Math.cos(b) - z * Math.sin(b), y * Math.sin(b) + z * Math.cos(b)];
  [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
  return [x, y, z];
};
let best = { cost: 1e18 };
function cost(a, b, c, s) {
  const P = V.map((v) => rot(v, a, b, c));
  // 照片 7 個點，各找最近的投影角（不重複）
  const used = new Set(); let sum = 0; const map = [];
  for (let t = 0; t < T.length; t++) {
    let bi = -1, bd = 1e18;
    P.forEach((p, i) => { if (used.has(i)) return; const d = (p[0] * s - T[t][0]) ** 2 + (p[1] * s - T[t][1]) ** 2; if (d < bd) { bd = d; bi = i; } });
    used.add(bi); sum += bd; map.push(bi);
  }
  // 中心那個要最靠近鏡頭
  if (P[map[6]][2] < 1) sum += 1e5;
  return { sum, map, P };
}
for (let it = 0; it < 400000; it++) {
  const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 2, c = Math.random() * Math.PI * 2, s = 70 + Math.random() * 80;
  const r = cost(a, b, c, s);
  if (r.sum < best.cost) best = { cost: r.sum, a, b, c, s, map: r.map };
}
// 細修
for (let it = 0; it < 200000; it++) {
  const j = (k) => best[k] + (Math.random() - 0.5) * 0.05 * (k === "s" ? 40 : 1);
  const a = j("a"), b = j("b"), c = j("c"), s = j("s");
  const r = cost(a, b, c, s);
  if (r.sum < best.cost) best = { cost: r.sum, a, b, c, s, map: r.map };
}
console.log(JSON.stringify(best), "rms", Math.sqrt(best.cost / 7).toFixed(1));
const P = V.map((v) => rot(v, best.a, best.b, best.c));
P.forEach((p, i) => console.log(i, V[i].join(","), p.map((x) => (x * best.s).toFixed(0)).join(" ")));
