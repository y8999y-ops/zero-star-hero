# -*- coding: utf-8 -*-
"""整關共用一套色盤（使用者 2026-11-17 定）：
  1. 從所有層學一套 N 色（預設 24）共用色盤，重點色（金、青……）用 --reserve 固定保留
  2. 每層照遠近只用其中幾色：越遠越少；遠的層不准用亮的重點色
  3. 配色看「顏色距離＋彩度差＋色相差」：不准藍蘑菇被吸成金、灰石頭被吸成鮮藍、暖樹皮被吸成刺眼的金
  4. 重點色只給原本就是這個色的格子用（不讓紫色岩石被吸成青）
不做任何碎點清理、不刪過渡色（使用者試過兩種都說不要）。

用法：python scene_recolor.py --src fit2 --out rc --colors 24 --reserve "#c18d2f" "#f3b84e" "#2ddeea" \
        --layer back=6:far far=8:far mid=12 near=12 fg=12 ground=14 platform=12
  --layer 層名=色數[:far|:mist]   far＝不准用彩度高或很亮的重點色；mist＝只准低彩度（霧）
輸出：<out>/pal/、<out>/<層名>.png
"""
import argparse, os, glob, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PALETTE_TOOL, sh
from oklab import oklab

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--colors", type=int, default=24); ap.add_argument("--reserve", nargs="*", default=[])
ap.add_argument("--layer", nargs="+", required=True)
A = ap.parse_args()
budget = {}
for s in A.layer:
    n, v = s.split("="); k, _, mode = v.partition(":"); budget[n] = (int(k), mode or "all")
shutil.rmtree(A.out, ignore_errors=True); os.makedirs(f"{A.out}/_in")
imgs = {n: np.asarray(Image.open(f"{A.src}/{n}.png").convert("RGBA")).copy() for n in budget}
for n, a in imgs.items():
    Image.fromarray(a).save(f"{A.out}/_in/{n}.png")
cmd = [PALETTE_TOOL, "build", "--output-dir", f"{A.out}/pal", "--input", f"{A.out}/_in", "--colors", A.colors, "--balance", "--name", "level"]
if A.reserve:
    cmd += ["--reserve", *A.reserve]
sh(*cmd); shutil.rmtree(f"{A.out}/_in")
pal = [l.strip().lstrip("#") for l in open(glob.glob(f"{A.out}/pal/*.hex")[0]) if l.strip()]
P = np.array([[int(c[i:i + 2], 16) for i in (0, 2, 4)] for c in pal], float); PL = oklab(P); PC = np.hypot(PL[:, 1], PL[:, 2])
R = len(A.reserve)


def cost(X, Q):
    d = ((X[:, None, :] - Q[None]) ** 2).sum(-1)
    cx, cq = np.hypot(X[:, 1], X[:, 2])[:, None], np.hypot(Q[:, 1], Q[:, 2])[None]
    hx, hq = np.arctan2(X[:, 2], X[:, 1])[:, None], np.arctan2(Q[:, 2], Q[:, 1])[None]
    dh = np.abs((hx - hq + np.pi) % (2 * np.pi) - np.pi)
    return d + 3.0 * (cx - cq) ** 2 + 0.03 * ((cx > 0.04) & (cq > 0.04) & (dh > np.radians(45)))


report = {}
for n, (k, mode) in budget.items():
    a = imgs[n]; vis = a[..., 3] > 0; X = oklab(a[vis][:, :3].astype(float))
    allowed = np.ones(len(P), bool)
    if mode == "far": allowed = (PC < 0.10) & (PL[:, 0] < 0.70)
    elif mode == "mist": allowed = PC < 0.10
    idx = np.nonzero(allowed)[0]
    d = cost(X, PL[idx]); near = idx[d.argmin(1)]
    cnt = np.bincount(near, minlength=len(P)); order = np.argsort(-cnt)
    close = np.bincount(near[d.min(1) < 0.04 ** 2], minlength=len(P))
    keep = [i for i in range(R) if allowed[i] and close[i] >= 15]
    ch = np.array((keep + [i for i in order if cnt[i] > 0 and i not in keep])[:k])
    out = a.copy(); out[vis, :3] = P[ch[cost(X, PL[ch]).argmin(1)]].astype(np.uint8)
    Image.fromarray(out).save(f"{A.out}/{n}.png"); report[n] = len(ch)
allc = set()
for n in budget:
    o = np.asarray(Image.open(f"{A.out}/{n}.png")); allc |= {tuple(x) for x in o[o[..., 3] > 0][:, :3]}
print("per layer", report, "| total colours", len(allc))
