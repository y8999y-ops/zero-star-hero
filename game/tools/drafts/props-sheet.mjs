// 關卡裡可以打的場景物件（草叢、木箱、垃圾堆、水晶）總覽：一段 1050 寬的地面切成三排，放大 3 倍。執行：node game/tools/drafts/props-sheet.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite } from "../../../pixelfx/src/core/index.js";
globalThis.location = { search: "" };
const fake = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === "length" ? 0 : fake()), apply: () => fake(), set: () => true });
for (const k of ["addEventListener", "document", "window", "requestAnimationFrame", "localStorage", "matchMedia", "navigator", "AudioContext", "Image", "screen"]) globalThis[k] ??= fake();
const { createProps } = await import("../../src/props.js");
const W = 1050, ROW = 350, H = 60, S = 3, FLOOR = 50;
const props = createProps({ floor: FLOOR, w: W, runs: [{ x0: 0, x1: W, y: FLOOR }] });
const f = createFrame(W, H);
for (let i = 0; i < W; i++) for (let y = FLOOR; y < H; y++) f.color[y * W + i] = y === FLOOR ? 0xff3a8a5a : 0xff2a2a3c;
props.draw(f, null);
const one = new Uint8ClampedArray(W * H * 4); composite(f, one, 0xff1c1626, 1);
const OW = ROW * S, OH = H * S * 3, img = new Uint8Array(OW * OH * 4);
for (let r = 0; r < 3; r++) for (let y = 0; y < H; y++) for (let x = 0; x < ROW; x++) for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
  const i = (y * W + r * ROW + x) * 4, o = ((r * H * S + y * S + b) * OW + x * S + a) * 4; img.set([one[i], one[i + 1], one[i + 2], 255], o);
}
writeFileSync(process.argv[2], encodePNG(OW, OH, img));
