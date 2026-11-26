// 輕量純 JS QR Code SVG 產生器（Byte mode，容錯率 M，支援 Version 1～6，最多 106 bytes，足夠放登入網址）。
// 零外部依賴，離線或校園網路受限時也能穩定列印學生登入 QR 卡片。

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGen(deg) {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}

function rsRem(data, ecLen) {
  const gen = rsGen(ecLen);
  const out = new Uint8Array(data.length + ecLen);
  out.set(data);
  for (let i = 0; i < data.length; i++) {
    const c = out[i];
    if (!c) continue;
    for (let j = 0; j < gen.length; j++) out[i + j] ^= mul(gen[j], c);
  }
  return out.slice(data.length);
}

// Version 1..6（容錯率 M）：[總碼字, 每塊資料碼字, 塊數, 每塊EC碼字, 對齊圖樣座標]
const VER = [
  null,
  { cap: 14, dc: 16, blocks: 1, ec: 10, align: [] },
  { cap: 26, dc: 28, blocks: 1, ec: 16, align: [6, 18] },
  { cap: 42, dc: 44, blocks: 1, ec: 26, align: [6, 22] },
  { cap: 62, dc: 32, blocks: 2, ec: 18, align: [6, 26] },
  { cap: 84, dc: 43, blocks: 2, ec: 24, align: [6, 30] },
  { cap: 106, dc: 27, blocks: 4, ec: 16, align: [6, 34] },
];

// Format info (EC=M -> 00, mask 0..7) 含 BCH + XOR 0x5412
const FMT_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

function encodeMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  while (v < VER.length && bytes.length > VER[v].cap) v++;
  if (v >= VER.length) throw new Error("URL 太長，超過 QR Version 6 上限");
  const info = VER[v];
  const totalDc = info.dc * info.blocks;

  // Byte mode: 0100 + 8-bit length + bytes + terminator + pad
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  for (let i = 0; i < 4 && bits.length < totalDc * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0; for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    codewords.push(b);
  }
  const pads = [0xec, 0x11];
  for (let i = 0; codewords.length < totalDc; i++) codewords.push(pads[i & 1]);

  // 分塊計算 EC 並交錯排列
  const dBlocks = [], eBlocks = [];
  for (let b = 0; b < info.blocks; b++) {
    const slice = codewords.slice(b * info.dc, (b + 1) * info.dc);
    dBlocks.push(slice);
    eBlocks.push(rsRem(slice, info.ec));
  }
  const stream = [];
  for (let i = 0; i < info.dc; i++) for (let b = 0; b < info.blocks; b++) stream.push(dBlocks[b][i]);
  for (let i = 0; i < info.ec; i++) for (let b = 0; b < info.blocks; b++) stream.push(eBlocks[b][i]);

  const size = v * 4 + 17;
  const mat = Array.from({ length: size }, () => new Int8Array(size));     // 0=空, 1=黑, -1=白
  const fn = Array.from({ length: size }, () => new Uint8Array(size));     // 1=功能格（不套 mask）
  const set = (r, c, dark) => { mat[r][c] = dark ? 1 : -1; fn[r][c] = 1; };

  // Finder patterns + separators
  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const r = r0 + dr, c = c0 + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const dark = inBox && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      set(r, c, dark);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // Alignment patterns
  for (const r of info.align) for (const c of info.align) {
    if (fn[r][c]) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }

  // Timing patterns & dark module
  for (let i = 8; i < size - 8; i++) {
    if (!fn[6][i]) set(6, i, i % 2 === 0);
    if (!fn[i][6]) set(i, 6, i % 2 === 0);
  }
  set(size - 8, 8, true);

  // Reserve format info cells
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) fn[8][i] = 1; if (!fn[i][8]) fn[i][8] = 1; }
  for (let i = 0; i < 8; i++) { fn[8][size - 1 - i] = 1; fn[size - 1 - i][8] = 1; }

  // Place data bits (zigzag right-to-left)
  const sBits = [];
  for (const cw of stream) for (let i = 7; i >= 0; i--) sBits.push((cw >> i) & 1);
  let idx = 0, up = true;
  for (let c = size - 1; c >= 1; c -= 2) {
    if (c === 6) c = 5;
    for (let step = 0; step < size; step++) {
      const r = up ? size - 1 - step : step;
      for (const dc of [0, -1]) {
        if (!fn[r][c + dc]) mat[r][c + dc] = (sBits[idx++] ?? 0) ? 1 : -1;
      }
    }
    up = !up;
  }

  // Mask 0: (r + c) % 2 === 0
  const maskId = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!fn[r][c] && (r + c) % 2 === 0) mat[r][c] = -mat[r][c];
  }

  // Write format info
  const fmt = FMT_M[maskId];
  const fBit = (i) => ((fmt >> i) & 1) ? 1 : -1;
  const pos1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const pos2 = [[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];
  for (let i = 0; i < 15; i++) {
    const val = fBit(14 - i);
    mat[pos1[i][0]][pos1[i][1]] = val;
    mat[pos2[i][0]][pos2[i][1]] = val;
  }
  return mat;
}

export function qrSvg(text, px = 128) {
  const mat = encodeMatrix(text);
  const n = mat.length, q = 2, vb = n + q * 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (mat[r][c] === 1) d += `M${c + q},${r + q}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${vb} ${vb}" shape-rendering="crispEdges"><rect width="${vb}" height="${vb}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
