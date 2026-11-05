// 讀 PNG（8 位元 RGB／RGBA、不交錯）成 { w, h, rgba }，給 node 草稿工具用
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
export function readPNG(path) {
  const b = readFileSync(path); let p = 8, w, h, ct, idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString("ascii", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    if (type === "IDAT") idat.push(d);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), out = new Uint8Array(w * h * 4), row = w * bpp, prev = new Uint8Array(row);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)], cur = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1)), line = new Uint8Array(row);
    for (let i = 0; i < row; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      line[i] = (cur[i] + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255;
    }
    prev.set(line);
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = line[x * bpp]; out[(y * w + x) * 4 + 1] = line[x * bpp + 1]; out[(y * w + x) * 4 + 2] = line[x * bpp + 2]; out[(y * w + x) * 4 + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
  }
  return { w, h, rgba: out };
}
