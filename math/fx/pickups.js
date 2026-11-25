// 學院島上撿得到、打得開的小東西（程式畫，等 props-academy.png 參考圖到了再換）：
//   pageFrame(t)：掉在地上的《萬題之書》書頁，微微發光、上下浮
//   chestFrame(open)：數字鎖寶箱（木頭＋金邊＋轉盤鎖）
import { Grid } from "./_grid.js";

export function pageFrame(t = 0) {
  const g = new Grid(16, 18, 8, 16), b = Math.round(Math.sin(t * Math.PI * 2) * 1);
  g.poly([[-5, -12 + b], [4, -13 + b], [5, -4 + b], [-4, -3 + b]], (x, y) => (x < -1 ? "#fffbe8" : "#f4e8c8"));
  for (let i = 0; i < 3; i++) g.line(-3, -10 + i * 2 + b, 2, -10.5 + i * 2 + b, "#c9b48a");
  g.set(3, -12 + b, "#ffd35c");
  g.outline();
  const f = g.pixels();
  return f;
}

export function chestFrame(open = false) {
  const g = new Grid(26, 22, 13, 20);
  g.rect(-10, -9, 20, 9, "#8a5a3a"); g.rect(-10, -9, 20, 2, "#a8744a"); g.rect(-10, -2, 20, 2, "#6a4228");
  if (open) { g.rect(-10, -16, 20, 5, "#6a4228"); g.rect(-8, -11, 16, 2, "#ffd35c"); }
  else { g.poly([[-10, -9], [10, -9], [9, -14], [-9, -14]], (x, y) => (y < -12 ? "#a8744a" : "#8a5a3a")); }
  g.rect(-10, -9, 2, 9, "#ffd35c"); g.rect(8, -9, 2, 9, "#ffd35c"); g.rect(-10, -10, 20, 1, "#ffd35c");
  if (!open) { g.ellipse(0, -7, 2.6, 2.6, (nx, ny) => (nx + ny < 0 ? "#ffe27a" : "#b9822e")); g.set(0, -7, "#3a2a1a"); }
  g.outline();
  return g.pixels();
}
