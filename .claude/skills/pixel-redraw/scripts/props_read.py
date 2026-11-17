# -*- coding: utf-8 -*-
"""小物件表第一步：把原圖上一排物件逐個切開，最近鄰放大，用 pixel_look master --proportions blocks 照原圖自己的格子讀回。

用法：python props_read.py --src 原圖.png --name 表名 [--x 2] [--only 0 3] [--drawn] [--work 工作資料夾]
  --x      放大倍率（pixel_look 要每格 >= 8 px；報錯 "cells are only about N px" 就改 3）
  --only   只重讀某幾個（例如某個物件格子偵測錯，用不同 --x 重讀）
  --drawn  這張沒有外框（小草、苔藤）
背景是洋紅或透明都可以（透明的會先鋪洋紅）。
輸出：<name>-<i>.png（裁切）、L-<name>-<i>/（讀回結果與 json）
"""
import argparse, os, shutil, json, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PIXEL_LOOK, sh, opaque, magenta_mask

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--name", required=True)
ap.add_argument("--x", type=int, default=2); ap.add_argument("--only", type=int, nargs="*")
ap.add_argument("--drawn", action="store_true"); ap.add_argument("--work", default=".")
ap.add_argument("--gap", type=int, default=6, help="物件之間至少幾格空欄才算分開")
A = ap.parse_args()
src_path = os.path.abspath(A.src)
os.makedirs(A.work, exist_ok=True); os.chdir(A.work)

a = opaque(Image.open(src_path))
bg = magenta_mask(a) | (a[..., 3] == 0)
rgb = a.copy(); rgb[bg] = (255, 0, 255, 255)
src = Image.fromarray(rgb).convert("RGB")
fg = ~bg
cols = fg.sum(0) > 2
segs, x, W = [], 0, len(cols)
while x < W:
    if cols[x]:
        s = x
        while x < W and cols[x:x + A.gap].any():
            x += 1
        segs.append((s, x))
    x += 1
segs = [s for s in segs if s[1] - s[0] > 20]
print(A.name, len(segs), "items", segs)
for i, (x0, x1) in enumerate(segs):
    if A.only and i not in A.only:
        continue
    rows = np.nonzero(fg[:, x0:x1].sum(1) > 0)[0]; y0, y1 = rows.min(), rows.max() + 1; p = 16
    crop = src.crop((x0 - p, y0 - p, x1 + p, y1 + p)); crop.save(f"{A.name}-{i}.png")
    big = f"x-{A.name}-{i}.png"
    crop.resize((crop.width * A.x, crop.height * A.x), Image.NEAREST).save(big)
    out = f"L-{A.name}-{i}"; shutil.rmtree(out, ignore_errors=True)
    cmd = [PIXEL_LOOK, "master", "--image", big, "--name", f"{A.name}-{i}", "--proportions", "blocks", "--output-dir", out]
    if A.drawn:
        cmd += ["--outline", "drawn"]
    if sh(*cmd).returncode:
        continue
    j = json.load(open(f"{out}/{A.name}-{i}.json", encoding="utf-8"))
    print(i, "size", j["size"], "原圖每格約", round(j["read"]["cellPx"][0] / A.x, 2), "px")
