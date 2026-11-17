# -*- coding: utf-8 -*-
# 「完美一格線」修正（agent-sprite-forge codeart2d 的 _pixel_perfect）：外輪廓和圖中間的暗線都修。
#   線＝圖裡最暗的那幾個顏色（亮度 < dark）。L 形直角多出來的那格拿掉：
#     碰到透明（外輪廓）→ 變透明，外框斜著接；在裡面 → 換成周圍不是線的顏色裡最多的。
#   之後外圍每一格都要是輪廓色（不能有缺口）。重複到沒有可以拿掉的為止。
# 用法：python pp_fix.py <輸入> <輸出> <輪廓色> [dark=0.30]
import sys
import numpy as np
from PIL import Image
import os
sys.path.insert(0, os.path.join(os.environ.get("ASF_SKILLS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")), "codeart2d", "scripts"))
import codeart_core as cc

def lum(rgb):
    c = np.asarray(rgb, float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = 0.4122 * c[..., 0] + 0.5363 * c[..., 1] + 0.0514 * c[..., 2]; m = 0.2119 * c[..., 0] + 0.6807 * c[..., 1] + 0.1074 * c[..., 2]
    s = 0.0883 * c[..., 0] + 0.2817 * c[..., 1] + 0.6300 * c[..., 2]
    return 0.2105 * np.cbrt(l) + 0.7936 * np.cbrt(m) - 0.0041 * np.cbrt(s)

def run(src, dst, ink_hex, dark=0.30):
    img = np.asarray(Image.open(src).convert("RGBA")).copy(); H, W = img.shape[:2]
    ink = np.array([int(ink_hex[i:i + 2], 16) for i in (1, 3, 5)], np.uint8)
    removed = {"outer": 0, "inner": 0}
    for _ in range(6):
        vis = img[..., 3] > 0
        line = vis & (lum(img[..., :3]) < dark)
        drop = line & ~cc._pixel_perfect(line)
        if not drop.any(): break
        p = np.pad(vis, 1)
        for y, x in zip(*np.nonzero(drop)):
            if not (p[y, x + 1] and p[y + 2, x + 1] and p[y + 1, x] and p[y + 1, x + 2]):
                img[y, x] = 0; removed["outer"] += 1
            else:
                cs = [tuple(img[y + dy, x + dx, :3]) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and img[y + dy, x + dx, 3] and not line[y + dy, x + dx]]
                if cs: img[y, x, :3] = max(set(cs), key=cs.count); removed["inner"] += 1
        vis = img[..., 3] > 0; p = np.pad(vis, 1)
        touch = vis & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
        img[touch, :3] = ink
    Image.fromarray(img).save(dst)
    print(dst, "removed", removed)

if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 0.30)
