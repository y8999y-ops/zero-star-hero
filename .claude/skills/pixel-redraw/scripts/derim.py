# -*- coding: utf-8 -*-
"""拿掉細亮邊線（例如岩石、葉子邊上的青色亮邊；讀回後常斷成虛線）：
指定色相範圍、而且細（侵蝕後就不見）的部分 → 換成旁邊不是這個色的顏色裡最多的；旁邊沒有就變透明。
整塊的同色（水晶）留著。

用法：python derim.py --src fit/fg.png --out fit2/fg.png [--hue 165 210] [--k 3]
  --k  侵蝕大小：一般 3；讀回後放大 2 倍的層用 5（線是 2 格粗）
"""
import argparse, os, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--hue", type=float, nargs=2, default=[165, 210]); ap.add_argument("--k", type=int, default=3)
A = ap.parse_args(); os.makedirs(os.path.dirname(A.out) or ".", exist_ok=True)
a = np.asarray(Image.open(A.src).convert("RGBA")).copy(); vis = a[..., 3] > 0
hsv = np.apply_along_axis(lambda p: colorsys.rgb_to_hsv(*(p / 255)), -1, a[..., :3].astype(float))
cy = vis & (hsv[..., 0] * 360 > A.hue[0]) & (hsv[..., 0] * 360 < A.hue[1]) & (hsv[..., 1] > 0.35) & (hsv[..., 2] > 0.45)
k = A.k
blob = ndimage.binary_dilation(ndimage.binary_erosion(cy, np.ones((k, k))), np.ones((k + 2, k + 2))) & cy
thin = cy & ~blob; H, W = thin.shape; r = 2 if k >= 5 else 1
out = a.copy()
for y, x in zip(*np.nonzero(thin)):
    y0, y1, x0, x1 = max(0, y - r), min(H, y + r + 1), max(0, x - r), min(W, x + r + 1)
    m = vis[y0:y1, x0:x1] & ~cy[y0:y1, x0:x1]
    if m.sum() >= 2:
        c = a[y0:y1, x0:x1][m][:, :3]; u, cnt = np.unique(c, axis=0, return_counts=True); out[y, x, :3] = u[cnt.argmax()]
    else:
        out[y, x] = 0
Image.fromarray(out).save(A.out)
print(A.out, "thin rim pixels", int(thin.sum()), "kept solid", int(blob.sum()))
