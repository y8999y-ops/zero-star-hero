# -*- coding: utf-8 -*-
"""場景層調成遊戲要的高度。
  split：上半（垂掛）貼頂、下半（地上）貼底，中間最長那段透明空列增減；太高時裁掉垂掛部分的最上面（本來就從畫面外掛下來）
  crop ：整張不透明的背景，上下各裁一半
  bbox ：裁到有像素的範圍（地面、平台、只在底部的層）

用法：python scene_fit.py --src read/far.png --out fit/far.png --mode split [--height 216]
"""
import argparse, os
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--mode", choices=["split", "crop", "bbox"], required=True); ap.add_argument("--height", type=int, default=216)
A = ap.parse_args(); H = A.height; os.makedirs(os.path.dirname(A.out) or ".", exist_ok=True)
im = Image.open(A.src).convert("RGBA")
if A.mode == "bbox":
    im.crop(im.getbbox()).save(A.out)
elif A.mode == "crop":
    c = max(0, (im.height - H) // 2); im.crop((0, c, im.width, c + H)).save(A.out)
else:
    a = np.asarray(im); rows = (a[..., 3] > 0).sum(1)
    best, s = (0, 0), None
    for i in range(len(rows) + 1):
        e = i < len(rows) and rows[i] == 0
        if e and s is None: s = i
        if not e and s is not None:
            if i - s > best[1] - best[0]: best = (s, i)
            s = None
    top, bot = a[:best[0]], a[best[1]:]
    bb = bot[-H:]; room = H - len(bb)
    tt = top[len(top) - room:] if room < len(top) else top
    out = np.zeros((H, a.shape[1], 4), np.uint8)
    if len(tt): out[:len(tt)] = tt
    out[H - len(bb):] = bb
    Image.fromarray(out).save(A.out)
print(A.out, Image.open(A.out).size)
