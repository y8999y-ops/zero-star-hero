# -*- coding: utf-8 -*-
"""逐處手修（使用者指出的地方）：在一張圖的指定範圍裡，符合顏色條件的格子換成周圍 8 格裡「不符合條件」的顏色中最多的那個，
由外往內重複到換完。範圍外不動。

用法：python spotfix.py --file fin-x/x-3.png --hue 25 58 [--sat 0.35] [--val 0.45] [--box x0 y0 x1 y1]
  例：石頭上的黃點  --hue 25 58
      蘑菇傘下的綠點 --hue 65 170 --sat 0.25 --box 0 0 36 22
注意：換成「周圍最多的色」不一定對——先放大並排原圖看那裡原本該是什麼色。
如果色盤裡根本沒有那個材質的顏色（例如菌褶的米褐被吸成綠），要照讀回的原樣（L- 資料夾）把正確的色加回來，
不是換成周圍色（那次換成周圍色變成一團暗紅，被說「顏色不對」）。
"""
import argparse, colorsys
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--file", required=True); ap.add_argument("--hue", type=float, nargs=2, required=True)
ap.add_argument("--sat", type=float, default=0.35); ap.add_argument("--val", type=float, default=0.45)
ap.add_argument("--box", type=int, nargs=4)
A = ap.parse_args()
a = np.asarray(Image.open(A.file).convert("RGBA")).copy(); H, W = a.shape[:2]
area = np.zeros((H, W), bool)
if A.box:
    x0, y0, x1, y1 = A.box; area[y0:y1, x0:x1] = True
else:
    area[:] = True
total = 0
for _ in range(6):
    h = np.apply_along_axis(lambda p: colorsys.rgb_to_hsv(*(p / 255)), -1, a[..., :3].astype(float))
    vis = a[..., 3] > 0
    bad = vis & area & (h[..., 0] * 360 > A.hue[0]) & (h[..., 0] * 360 < A.hue[1]) & (h[..., 1] > A.sat) & (h[..., 2] > A.val)
    if not bad.any(): break
    new = a.copy(); n = 0
    for y, x in zip(*np.nonzero(bad)):
        ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
        m = vis[ys, xs] & ~bad[ys, xs]
        if not m.any(): continue
        c = a[ys, xs][m][:, :3]; u, cnt = np.unique(c, axis=0, return_counts=True); new[y, x, :3] = u[cnt.argmax()]; n += 1
    a = new; total += n
    if not n: break
Image.fromarray(a).save(A.file); print(A.file, "fixed", total)
