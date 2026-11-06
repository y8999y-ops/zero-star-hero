// Unity 轉移工具用：在 Node 裡假裝有瀏覽器的 Image／canvas，讓 game/src/art.js 的 loadArt 能讀 PNG（不用開瀏覽器）。
// 只支援 8 位元、不交錯的 PNG（Aseprite 存出來的就是這種）。讀出來的像素跟瀏覽器的 getImageData 一樣（RGBA）。
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0, bd = 0, pal = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error("PNG 交錯格式不支援"); }
    else if (type === "PLTE") pal = d;
    else if (type === "tRNS") trns = d;
    else if (type === "IDAT") idat.push(d);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bd !== 8) throw new Error("PNG 只支援 8 位元：" + bd);
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], raw = inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[o + i - bpp] : 0, b = y ? px[o - stride + i] : 0, c = i >= bpp && y ? px[o - stride + i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + i] = v & 255;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (ct === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; al = px[i * 4 + 3]; }
    else if (ct === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (ct === 3) { const k = px[i]; r = pal[k * 3]; g = pal[k * 3 + 1]; b = pal[k * 3 + 2]; al = trns && k < trns.length ? trns[k] : 255; }
    else if (ct === 0) { r = g = b = px[i]; }
    else { r = g = b = px[i * 2]; al = px[i * 2 + 1]; }
    out.set([r, g, b, al], i * 4);
  }
  return { w, h, data: out };
}

class FakeImage {
  set src(u) {
    this._src = u;
    queueMicrotask(() => {
      try {
        const img = decodePNG(readFileSync(fileURLToPath(u)));
        this.naturalWidth = img.w; this.naturalHeight = img.h; this._img = img;
        this.onload?.();
      } catch (e) { this.onerror?.(e); }
    });
  }
  get src() { return this._src; }
}
function fakeCanvas() {
  let img = null;
  return {
    width: 0, height: 0,
    getContext: () => ({
      drawImage: (i) => { img = i._img; },
      getImageData: () => ({ data: img.data }),
    }),
  };
}
/** 裝上假的 DOM（只夠 art.js 用）。其他模組在載入時碰到 addEventListener 也不會壞。 */
export function installDom() {
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  globalThis.Image = FakeImage;
  globalThis.document = {
    createElement: (t) => (t === "canvas" ? fakeCanvas() : { style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} }),
    getElementById: () => null,
    querySelectorAll: () => [],
    body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
  };
}
