# -*- coding: utf-8 -*-
# 規則（使用者 2026-11-17）：外輪廓線只能用黑色、內輪廓禁止用黑色。
#  黑色＝整批共用的近黑深藍紫 BLACK。「黑色系」＝OKLab 亮度 ≤ 0.25 的顏色。
#  1. 外圍一圈（碰到透明的格子）裡的黑色系 → 統一成 BLACK
#  2. 不在外圍的黑色系 → 換成所在材質的最暗一階：看周圍 8 格非黑的顏色裡最多的那個（材質色），
#     在這張表的顏色裡找「色相接近、比它暗、但不是黑色系」的最暗一個；找不到就把材質色在 OKLab 裡壓暗 0.08 當新的一階。
# 用法：python blackline.py <來源資料夾> <輸出資料夾> <表名>
#   來源裡是 <表名>-<i>.png（每個物件）或 <表名>.png（整張表）都可以。之後色數超過 24 用 cap24.py。
import sys, os, glob, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oklab import oklab, unoklab
from PIL import Image
BLACK = np.array([0x11, 0x10, 0x2e], np.uint8); DARK = 0.25
src, dst, name = sys.argv[1:4]; os.makedirs(dst, exist_ok=True)
files = sorted(f for f in glob.glob(f"{src}/{name}-*.png") if f[:-4].rsplit("-", 1)[1].isdigit()) or [f"{src}/{name}.png"]
pal = {}
for f in files:
    a = np.asarray(Image.open(f).convert("RGBA"))
    for q in a[a[..., 3] > 0][:, :3]: pal[tuple(q)] = 1
# 外框線色：大多出現在外圍、而且夠暗（L ≤ 0.30）的顏色也算黑色系（例如岩石表的 #211f41）
ringc, allc0 = {}, {}
for f in files:
    a = np.asarray(Image.open(f).convert("RGBA")); vis = a[..., 3] > 0; pp = np.pad(vis, 1)
    rg = vis & ~(pp[:-2, 1:-1] & pp[2:, 1:-1] & pp[1:-1, :-2] & pp[1:-1, 2:])
    for q in a[rg][:, :3]: ringc[tuple(q)] = ringc.get(tuple(q), 0) + 1
    for q in a[vis][:, :3]: allc0[tuple(q)] = allc0.get(tuple(q), 0) + 1
LINE = {c for c in allc0 if ringc.get(c, 0) >= 0.3 * allc0[c] and oklab(np.array(c, float))[0] <= 0.30}
for c in list(pal):
    if c in LINE: del pal[c]
P = np.array(list(pal), float); PL = oklab(P); PC = np.hypot(PL[:, 1], PL[:, 2]); PH = np.arctan2(PL[:, 2], PL[:, 1])
def material_dark(c):
    L = oklab(np.array(c, float)); C = np.hypot(L[1], L[2]); H = np.arctan2(L[2], L[1])
    dh = np.abs((PH - H + np.pi) % (2 * np.pi) - np.pi)
    same = ((PC < 0.03) & (C < 0.03)) | ((PC >= 0.03) & (C >= 0.03) & (dh < np.radians(35)))
    ok = same & (PL[:, 0] < L[0] - 0.02) & (PL[:, 0] > DARK)
    if ok.any(): return P[np.nonzero(ok)[0][np.argmin(PL[ok, 0])]].astype(np.uint8), False
    L2 = L.copy(); L2[0] = max(DARK + 0.03, L[0] - 0.08); return unoklab(L2[None])[0].astype(np.uint8), True
stats = {"outer": 0, "inner": 0, "new_colours": set()}
for f in files:
    a = np.asarray(Image.open(f).convert("RGBA")).copy(); vis = a[..., 3] > 0; H, W = vis.shape
    p = np.pad(vis, 1); ring = vis & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    isline = np.zeros(vis.shape, bool)
    for c in LINE: isline |= (a[..., :3] == c).all(-1)
    dark = vis & ((oklab(a[..., :3].astype(float))[..., 0] <= DARK) | isline)
    out = a.copy()
    o = ring & dark; out[o, :3] = BLACK; stats["outer"] += int(o.sum())
    for y, x in zip(*np.nonzero(dark & ~ring)):
        ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
        m = vis[ys, xs] & ~dark[ys, xs]
        if not m.any():   # 整塊黑的內部（例如洞口）：用更外圈 5×5 找材質
            ys, xs = slice(max(0, y - 2), y + 3), slice(max(0, x - 2), x + 3); m = vis[ys, xs] & ~dark[ys, xs]
            if not m.any(): continue
        cols = [tuple(q) for q in a[ys, xs][m][:, :3]]; c = max(set(cols), key=cols.count)
        col, new = material_dark(c); out[y, x, :3] = col; stats["inner"] += 1
        if new: stats["new_colours"].add(tuple(col))
    Image.fromarray(out).save(f"{dst}/{os.path.basename(f)}")
allc = set()
for f in ([f for f in glob.glob(f"{dst}/{name}-*.png") if f[:-4].rsplit("-", 1)[1].isdigit()] or [f"{dst}/{name}.png"]):
    a = np.asarray(Image.open(f).convert("RGBA")); allc |= {tuple(q) for q in a[a[..., 3] > 0][:, :3]}
print(name, "outer ring → black", stats["outer"], "| inner black → material dark", stats["inner"], "| new shades", len(stats["new_colours"]), "| colours", len(allc))
