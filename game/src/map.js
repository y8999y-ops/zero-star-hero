// 地形碰撞（8b，docs/關卡與星核改版企劃.md 第 3 章）：關卡改成 Ori 式的大地圖，有牆、天花板、豎井，不再只有一條固定高度的地板。
// 地形 = 實心方塊（solids，矩形，像素座標）＋單向平台（platforms，從下面可以跳上來、往下滑穿過去）。
// 內部切成 8×8 的格子加速查詢，所以矩形的 x、y、寬、高請用 8 的倍數（不是的話會對齊到格子）。沒有寫 solids 的舊關卡／城鎮：自動變成「一整條地板＋左右兩面牆」，行為跟以前一樣。
export const TILE = 8;
export const geo = { w: 0, h: 0, platforms: [], solids: [] };
let gw = 0, gh = 0, grid = new Uint8Array(0);

/** 換地圖：{ w, h, solids, platforms }（px） */
export function initMap(m) {
  geo.w = m.w; geo.h = m.h; geo.platforms = m.platforms ?? []; geo.solids = m.solids ?? [];
  gw = Math.ceil(m.w / TILE); gh = Math.ceil(m.h / TILE);
  grid = new Uint8Array(gw * gh);
  for (const r of geo.solids) {
    const x0 = Math.max(0, Math.floor(r.x / TILE)), x1 = Math.min(gw, Math.ceil((r.x + r.w) / TILE));
    const y0 = Math.max(0, Math.floor(r.y / TILE)), y1 = Math.min(gh, Math.ceil((r.y + r.h) / TILE));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) grid[y * gw + x] = 1;
  }
}
/** 舊關卡的地形：一整條地板＋左右牆 */
export function flatMap(w, h, floor, wall, platforms = []) {
  return { w, h, platforms, solids: [{ x: 0, y: floor, w, h: h - floor }, { x: 0, y: 0, w: wall, h }, { x: w - wall, y: 0, w: wall, h }] };
}

/** 這一點是不是實心（地圖左右外面＝實心、底下外面＝實心、上面外面＝空） */
export function solidAt(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || tx >= gw || ty >= gh) return true;
  if (ty < 0) return false;
  return grid[ty * gw + tx] === 1;
}
const tileTop = (y) => Math.floor(y / TILE) * TILE;

/** 往下掉的時候（prevY → y）有沒有踩到地：實心方塊的頂面，或（沒有往下穿的話）平台。回傳落腳的 y，沒有回傳 null */
export function groundAt(x, prevY, y, dropping = false) {
  let best = null;
  if (!dropping) for (const p of geo.platforms) if (x >= p.x - 2 && x <= p.x + p.w + 2 && prevY <= p.y + 0.5 && y >= p.y && (best === null || p.y < best)) best = p.y;
  // 實心方塊：從 prevY 往下一格一格看，第一個「上面是空的、自己是實心」的頂面
  for (let ty = Math.floor(prevY / TILE); ty <= Math.floor(y / TILE); ty++) {
    const top = ty * TILE;
    if (top < prevY - 0.5 || top > y) continue;
    if (solidAt(x, top + 0.5) && !solidAt(x, top - 0.5)) { if (best === null || top < best) best = top; break; }
  }
  return best;
}
/** 站在平台上（不是實心地面）：往下滑可以穿過去 */
export const onPlatform = (x, y) => geo.platforms.some((p) => Math.abs(y - p.y) < 0.5 && x >= p.x - 2 && x <= p.x + p.w + 2) && !solidAt(x, y + 0.5);
/** 從 y 往下找第一個地面（生東西、特效貼地用）；找不到回傳地圖底 */
export function floorAt(x, y) {
  let best = geo.h;
  for (const p of geo.platforms) if (x >= p.x && x <= p.x + p.w && p.y >= y - 0.5 && p.y < best) best = p.y;
  for (let ty = Math.max(0, Math.floor(y / TILE)); ty < gh; ty++) {
    const top = ty * TILE;
    if (top >= best) break;
    if (solidAt(x, top + 0.5) && !solidAt(x, top - 0.5) && top >= y - TILE) return top;
  }
  return best;
}
/** 往上的時候頭撞到天花板：回傳天花板底下的 y（腳的位置），沒有回傳 null。h＝身高 */
export function ceilingAt(x, prevY, y, h) {
  const head = y - h;
  if (head < 0) return null;
  if (solidAt(x - 4, head) || solidAt(x + 4, head)) return (Math.floor(head / TILE) + 1) * TILE + h;
  return null;
}
/** 左右移動：身體（腳 y、身高 h、半寬 r）從 x 移到 nx，撞牆就停在牆邊。回傳新的 x */
export function moveX(x, nx, y, h, r) {
  if (nx === x) return x;
  const dir = Math.sign(nx - x), edge = nx + dir * r;
  for (const yy of [y - 2, y - h / 2, y - h + 2]) {
    if (solidAt(edge, yy)) {
      const tx = Math.floor(edge / TILE);
      return dir > 0 ? tx * TILE - r - 0.01 : (tx + 1) * TILE + r + 0.01;
    }
  }
  return nx;
}
export { tileTop };
/** 8d：機關（裂牆、封印門）在地形上開關一塊實心（只改碰撞，不改畫好的地形圖；機關自己畫自己） */
export function setSolid(r, on) {
  const x0 = Math.max(0, Math.floor(r.x / TILE)), x1 = Math.min(gw, Math.ceil((r.x + r.w) / TILE));
  const y0 = Math.max(0, Math.floor(r.y / TILE)), y1 = Math.min(gh, Math.ceil((r.y + r.h) / TILE));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) grid[y * gw + x] = on ? 1 : 0;
}
/** 10 批：地圖上所有「可以站的地面」：實心格子、上面至少 minAir 格是空的；相鄰同高的接成一段 { x0, x1, y }。
 *  草叢、木箱、水窪、小生物、元素物件照這些段擺（大地圖的地面不是同一個高度） */
export function surfaceRuns(minAir = 32) {
  const runs = [], need = Math.ceil(minAir / TILE);
  for (let ty = 1; ty < gh; ty++) {
    let cur = null;
    for (let tx = 0; tx < gw; tx++) {
      let ok = grid[ty * gw + tx] === 1;
      for (let k = 1; ok && k <= need; k++) if (ty - k >= 0 && grid[(ty - k) * gw + tx] === 1) ok = false;
      if (ok) { if (cur) cur.x1 = (tx + 1) * TILE; else cur = { x0: tx * TILE, x1: (tx + 1) * TILE, y: ty * TILE }; }
      else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
  }
  return runs;
}
