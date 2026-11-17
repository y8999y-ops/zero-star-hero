# -*- coding: utf-8 -*-
"""場景層第一步：照原圖自己的格子讀回（pixel_reduce --method mode，每層 24 色以內）。
格子不是整數、或寬高不同時，先最近鄰縮到整數格再讀；讀回後可整數放大（讓近景、前景保持原圖設計的前後大小）。
洋紅底色與半透明會先變成全透明。

用法：python scene_read.py --src 原圖.png --name 層名 --cell 格寬 格高 [--period 4] [--up 1] [--colors 24] [--work 資料夾]
  --cell    scene_grid.py 量到的原圖格子（例如 6.47 6.47、4.02 5.32）
  --period  讀的整數格（預設＝格寬四捨五入）
  --up      讀回後放大幾倍（近景、前景若讀回後比中景還小，用 2）
輸出：read/<name>.png
"""
import argparse, os, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PIXEL_REDUCE, sh, opaque, magenta_mask

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--name", required=True)
ap.add_argument("--cell", type=float, nargs=2, required=True); ap.add_argument("--period", type=int)
ap.add_argument("--up", type=int, default=1); ap.add_argument("--colors", type=int, default=24); ap.add_argument("--work", default=".")
A = ap.parse_args(); src = os.path.abspath(A.src); os.makedirs(A.work, exist_ok=True); os.chdir(A.work)
tx, ty = A.cell; p = A.period or max(2, round(tx))
a = opaque(Image.open(src)); a[magenta_mask(a)] = 0
im = Image.fromarray(a)
if abs(tx - p) > 0.01 or abs(ty - p) > 0.01:
    im = im.resize((round(im.width * p / tx), round(im.height * p / ty)), Image.NEAREST)
os.makedirs("read", exist_ok=True); tmp = f"read/_s-{A.name}.png"; im.save(tmp)
d = f"read/_r-{A.name}"; shutil.rmtree(d, ignore_errors=True)
sh(PIXEL_REDUCE, "--input", tmp, "--output-dir", d, "--force", "--period", p, "--method", "mode", "--colors", A.colors)
o = Image.open(f"{d}/_s-{A.name}.png").convert("RGBA")
if A.up > 1:
    o = o.resize((o.width * A.up, o.height * A.up), Image.NEAREST)
# 邊上混到洋紅的格子（很飽和的紫紅、又碰到透明）清掉兩輪
q = np.asarray(o).copy()
for _ in range(2):
    v = q[..., 3] > 0; r, g, b = [q[..., i].astype(int) for i in range(3)]
    mag = v & (r > 85) & (b > 100) & (g * 3 < np.minimum(r, b))
    pp = np.pad(v, 1); edge = ~(pp[:-2, 1:-1] & pp[2:, 1:-1] & pp[1:-1, :-2] & pp[1:-1, 2:])
    q[mag & edge] = 0
Image.fromarray(q).save(f"read/{A.name}.png"); os.remove(tmp); shutil.rmtree(d, ignore_errors=True)
print(A.name, "period", p, "->", o.size)
