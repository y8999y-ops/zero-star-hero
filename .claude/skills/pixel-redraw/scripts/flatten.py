# -*- coding: utf-8 -*-
# 外輪廓抖動自動修平：斜邊上「一階比前後都長（或都短）2 格以上」的地方，把這三階的總長平均分配
# （例如 2,4,2 → 3,2,3 或 3,3,2），剪影跟著改：多出來的格子變透明、缺的格子補上輪廓色，
# 最後外圍那一圈重新整理成一格輪廓（原本的輪廓格變到裡面時，換成裡面相鄰的顏色）。
# 用法：python flatten.py <輸入> <輸出> <輪廓色>
import sys
import numpy as np
from PIL import Image

def runs(vals):
    out = []; i = 0
    while i < len(vals):
        j = i
        while j + 1 < len(vals) and vals[j + 1] == vals[i]: j += 1
        out.append([i, j - i + 1, vals[i]]); i = j + 1
    return out

def fix_profile(prof):
    """prof：list（None＝沒東西）。回傳新的 prof 和修了幾處"""
    prof = list(prof); n_fix = 0
    i = 0; segs = []; seg = []
    for k, v in enumerate(prof):
        if v is None or (seg and abs(v - prof[seg[-1]]) > 1):
            if len(seg) >= 4: segs.append(seg)
            seg = [] if v is None else [k]
        else: seg.append(k)
    if len(seg) >= 4: segs.append(seg)
    for seg in segs:
        changed = True
        while changed:
            changed = False
            vals = [prof[k] for k in seg]; rs = runs(vals)
            for q in range(1, len(rs) - 1):
                a, b, c = rs[q - 1], rs[q], rs[q + 1]
                d1, d2 = b[2] - a[2], c[2] - b[2]
                if abs(d1) != 1 or d1 != d2 or max(a[1], b[1], c[1]) > 8: continue
                if not ((b[1] - a[1] >= 2 and b[1] - c[1] >= 2) or (a[1] - b[1] >= 2 and c[1] - b[1] >= 2)): continue
                L = a[1] + b[1] + c[1]; base, rem = divmod(L, 3)
                lens = [base + (1 if rem >= 1 else 0), base + (1 if rem == 2 else 0), base]   # 長的放外側
                if a[1] < c[1]: lens = lens[::-1]
                start = a[0]; pos = start
                for (ln, val) in zip(lens, (a[2], b[2], c[2])):
                    for t in range(ln): prof[seg[pos + t]] = val
                    pos += ln
                n_fix += 1; changed = True
                break
    return prof, n_fix

def run(src, dst, ink_hex):
    img = np.asarray(Image.open(src).convert("RGBA")).copy(); H, W = img.shape[:2]
    ink = np.array([int(ink_hex[i:i + 2], 16) for i in (1, 3, 5)] + [255], np.uint8)
    total = 0
    for side in ("top", "bot", "lef", "rig"):
        vis = img[..., 3] > 0
        if side == "top": prof = [int(np.argmax(vis[:, x])) if vis[:, x].any() else None for x in range(W)]
        elif side == "bot": prof = [int(H - 1 - np.argmax(vis[::-1, x])) if vis[:, x].any() else None for x in range(W)]
        elif side == "lef": prof = [int(np.argmax(vis[y])) if vis[y].any() else None for y in range(H)]
        else: prof = [int(W - 1 - np.argmax(vis[y, ::-1])) if vis[y].any() else None for y in range(H)]
        new, n = fix_profile(prof); total += n
        for i, (o, v) in enumerate(zip(prof, new)):
            if o is None or o == v: continue
            if side == "top":   # 往下＝削掉；往上＝補
                if v > o: img[o:v, i] = 0
                else: img[v:o, i] = ink
            elif side == "bot":
                if v < o: img[v + 1:o + 1, i] = 0
                else: img[o + 1:v + 1, i] = ink
            elif side == "lef":
                if v > o: img[i, o:v] = 0
                else: img[i, v:o] = ink
            else:
                if v < o: img[i, v + 1:o + 1] = 0
                else: img[i, o + 1:v + 1] = ink
    # 外圍重新整理成一格輪廓
    vis = img[..., 3] > 0; p = np.pad(vis, 1)
    edge = vis & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    isink = (img[..., :3] == ink[:3]).all(-1)
    inner_ink = vis & ~edge & isink
    # 裡面多出來的輪廓格（原本在外圍、現在被包進去）：換成裡面相鄰、不是輪廓色的顏色
    for y, x in zip(*np.nonzero(inner_ink)):
        near_edge = edge[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any()
        if not near_edge: continue
        cs = [tuple(img[y + dy, x + dx, :3]) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
              if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and vis[y + dy, x + dx] and not edge[y + dy, x + dx] and not isink[y + dy, x + dx]]
        if cs: img[y, x, :3] = max(set(cs), key=cs.count)
    img[edge] = ink
    Image.fromarray(img).save(dst)
    print(dst, "flattened", total)

if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2], sys.argv[3])
