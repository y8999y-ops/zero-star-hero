// 先印出程式產生的星形剪影，人工檢查階梯
const W = +process.argv[3] || 21, H = +process.argv[4] || 19, kind = process.argv[2];
const cx = (W - 1) / 2, cy = (H - 1) / 2 + 0.5;
const rows = [];
for (let y = 0; y < H; y++) {
  let s = "";
  for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy, a = Math.atan2(dx, -dy), d = Math.hypot(dx, dy);
    let r;
    if (kind === "fat") r = 9.6 * (0.8 + 0.2 * Math.cos(5 * a));
    else r = 9.6 * (0.62 + 0.38 * Math.abs(Math.cos(2 * a)) ** 1.6);
    s += d <= r ? "#" : ".";
  }
  rows.push(s);
}
console.log(rows.join("\n"));
