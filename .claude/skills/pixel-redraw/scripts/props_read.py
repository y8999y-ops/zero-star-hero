# -*- coding: utf-8 -*-
"""小物件表第一步：把原圖上一排（或幾排）物件逐個切開，最近鄰放大，用 pixel_look master --proportions blocks 照原圖自己的格子讀回。

用法：python props_read.py --src 原圖.png --name 表名 [--x 2] [--only 0 3] [--drawn] [--work 工作資料夾]
  --x      放大倍率（pixel_look 要每格 >= 8 px；報錯 "cells are only about N px" 就改 3）
  --only   只重讀某幾個（例如某個物件格子偵測錯，用不同 --x 重讀）
  --drawn  這張沒有外框（小草、苔藤）
  --cell   整張圖共用的格子大小（先用 scene_grid.py 量整張圖）。**一張圖裡的物件是同一個格子畫的，要用同一個格子讀**：
           給了 --cell 就改用 pixel_reduce 以這個固定格子讀每個物件（細長、尖角的物件不會被 pixel_look 誤判成更細的格子而變大、變糊），
           大小也會一致。沒給才讓 pixel_look 每個物件自己判斷。
背景是洋紅或透明都可以（透明的會先鋪洋紅）。
輸出：<name>-<i>.png（裁切）、L-<name>-<i>/（讀回結果與 json）
"""
import argparse, os, shutil, json, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PIXEL_LOOK, PIXEL_REDUCE, sh, opaque, magenta_mask, ring

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--name", required=True)
ap.add_argument("--x", type=int, default=2); ap.add_argument("--only", type=int, nargs="*")
ap.add_argument("--drawn", action="store_true"); ap.add_argument("--work", default=".")
ap.add_argument("--gap", type=int, default=6, help="物件之間至少幾格空欄才算分開")
ap.add_argument("--cell", type=float, help="整張圖共用的格子（例如 9.4）")
ap.add_argument("--key", default="#ff00ff", help="底色（洋紅 #ff00ff、綠 #00ff00、藍 #0000ff）。只挖跟底色很接近的格子，紫、粉紅不會被當成底色")
A = ap.parse_args()
src_path = os.path.abspath(A.src)
os.makedirs(A.work, exist_ok=True); os.chdir(A.work)

a = opaque(Image.open(src_path))
KEY = np.array([int(A.key.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)])
near_key = lambda arr, d: np.abs(arr[..., :3].astype(int) - KEY).sum(-1) < d
bg = (near_key(a, 120) if A.cell else magenta_mask(a)) | (a[..., 3] == 0)
rgb = a.copy(); rgb[bg] = (*KEY, 255)
src = Image.fromarray(rgb).convert("RGB")
fg = ~bg
def runs(mask, gap):
    out, x, n = [], 0, len(mask)
    while x < n:
        if mask[x]:
            s = x
            while x < n and mask[x:x + gap].any():
                x += 1
            out.append((s, x))
        x += 1
    return out
# 先切成橫的幾列（中間要有夠寬的空列），再在每一列裡切出一個個物件；一排的圖就只有一列
bands = [b for b in runs(fg.sum(1) > 2, A.gap * 4) if b[1] - b[0] > 20]
segs = []
for (r0, r1) in bands:
    for (c0, c1) in runs(fg[r0:r1].sum(0) > 2, A.gap):
        if c1 - c0 > 20:
            segs.append((c0, c1, r0, r1))
print(A.name, len(segs), "items", segs)
for i, (x0, x1, r0, r1) in enumerate(segs):
    if A.only and i not in A.only:
        continue
    rows = np.nonzero(fg[r0:r1, x0:x1].sum(1) > 0)[0] + r0; y0, y1 = rows.min(), rows.max() + 1; p = 16
    crop = src.crop((x0 - p, y0 - p, x1 + p, y1 + p)); crop.save(f"{A.name}-{i}.png")
    out = f"L-{A.name}-{i}"; shutil.rmtree(out, ignore_errors=True)
    if A.cell:
        P = max(2, round(A.cell)); c = np.asarray(crop.convert("RGBA")).copy(); c[near_key(c, 120)] = 0
        im = Image.fromarray(c)
        if abs(A.cell - P) > 0.01:
            im = im.resize((round(im.width * P / A.cell), round(im.height * P / A.cell)), Image.NEAREST)
        tmp = f"_s-{A.name}-{i}.png"; im.save(tmp); tmpd = f"_r-{A.name}-{i}"; shutil.rmtree(tmpd, ignore_errors=True)
        sh(PIXEL_REDUCE, "--input", tmp, "--output-dir", tmpd, "--force", "--period", P, "--method", "mode", "--colors", 48)
        o = np.asarray(Image.open(f"{tmpd}/{tmp}").convert("RGBA")).copy()
        # 只清掉外圍一圈裡混到底色的格子（跟底色差距 < 150），不碰物件本身的紫、粉紅
        o[(o[..., 3] > 0) & ring(o[..., 3] > 0) & near_key(o, 150)] = 0
        o = o[:, :, :]; bb = Image.fromarray(o).getbbox(); o = np.asarray(Image.fromarray(o).crop(bb)).copy()
        os.makedirs(out); Image.fromarray(o).save(f"{out}/{A.name}-{i}.png"); os.remove(tmp); shutil.rmtree(tmpd)
        # 外框線色＝外圍一圈裡最常見的暗色（給 props_finish 的完美一格線用）
        rg = o[ring(o[..., 3] > 0)][:, :3]; lum = rg.astype(float) @ [0.3, 0.59, 0.11]; dark = rg[lum < 70] if (lum < 70).any() else rg
        u, cnt = np.unique(dark, axis=0, return_counts=True); line = [int(v) for v in u[cnt.argmax()]]
        json.dump({"size": [o.shape[1], o.shape[0]], "read": {"method": "pixel_reduce", "cellPx": [A.cell, A.cell], "outline": {"line": line}}},
                  open(f"{out}/{A.name}-{i}.json", "w", encoding="utf-8"))
        print(i, "size", [o.shape[1], o.shape[0]], "shared cell", A.cell)
        continue
    big = f"x-{A.name}-{i}.png"
    crop.resize((crop.width * A.x, crop.height * A.x), Image.NEAREST).save(big)
    cmd = [PIXEL_LOOK, "master", "--image", big, "--name", f"{A.name}-{i}", "--proportions", "blocks", "--output-dir", out]
    if A.drawn:
        cmd += ["--outline", "drawn"]
    if sh(*cmd).returncode:
        continue
    j = json.load(open(f"{out}/{A.name}-{i}.json", encoding="utf-8"))
    print(i, "size", j["size"], "原圖每格約", round(j["read"]["cellPx"][0] / A.x, 2), "px")
