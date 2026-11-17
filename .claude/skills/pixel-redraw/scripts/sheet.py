# -*- coding: utf-8 -*-
"""把 <dir>/<name>-<i>.png 排成一排物件表：格子大小＝最大的物件，置中，底部（或頂部）對齊。輸出 out/<name>.png

用法：python sheet.py --dir fin-表名 --name 表名 [--align bottom|top]
（逐處手修 fin-<name>/ 裡的物件之後，用這個重排就好，不必整個重跑）
"""
import argparse, glob, os
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--dir", required=True); ap.add_argument("--name", required=True); ap.add_argument("--align", default="bottom")
A = ap.parse_args()
fs = sorted(glob.glob(f"{A.dir}/{A.name}-*.png"), key=lambda f: int(f[:-4].rsplit("-", 1)[1]))
ims = [Image.open(f).convert("RGBA") for f in fs]
ims = [i.crop(i.getbbox()) for i in ims]
cw = max(i.width for i in ims); ch = max(i.height for i in ims)
S = Image.new("RGBA", (cw * len(ims), ch))
for k, im in enumerate(ims):
    S.alpha_composite(im, (k * cw + (cw - im.width) // 2, ch - im.height if A.align == "bottom" else 0))
os.makedirs("out", exist_ok=True); S.save(f"out/{A.name}.png")
print(A.name, "cell", (cw, ch), "x", len(ims), "->", S.size)
