# -*- coding: utf-8 -*-
"""外輪廓檢查與修正（只看最外圍一圈，物件裡面不碰）。使用者 2026-11-17：
「外輪廓要檢查不能有直角雙層像素或破碎不符合步進要調整」。

檢查項目（check）：
  gaps     外圍一圈裡不是外框色的格子（缺口）
  corners  外框的 L 形直角：一格外框同時接著左右之一和上下之一的外框、另外兩邊是空的 → 這格多餘（雙層）
  double   外框變兩格厚：外圍裡面那一格也是外框色
  spurs    外框單獨突出的一根毛：三邊空、旁邊沒有任何物件顏色
  bumps    平的邊上單獨凸出或凹進去一格（兩邊都至少 2 格平，中間 1 格高低不同）
  steps    斜邊的階梯長短不規律（一階比前後兩階都長或都短 2 格以上）
修正（fix）：反覆做「外圍補成外框色 → 修平階梯與單格凸凹 → 拿掉直角與毛 → 雙層的裡面那格換回物件顏色」，直到檢查全為 0（最多 6 輪）。
星星的尖角是故意的單格尖端，不算凸起（只有兩邊都是平的才算）。

用法：python outline.py <輸入.png> <輸出.png> [--ink #11102e]   （也可 import check / fix）
"""
import sys
import numpy as np
from PIL import Image
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from flatten import fix_profile, runs

INK = np.array([0x11, 0x10, 0x2e], np.uint8)


from scipy import ndimage


def _solid(a):
    """有實心部分（3×3 侵蝕後還在）的區塊才有外框；一格寬的光芒、閃光沒有外框，保留原色，不檢查也不修"""
    vis = a[..., 3] > 0
    core = ndimage.binary_erosion(vis, np.ones((3, 3)))
    lab, n = ndimage.label(vis, np.ones((3, 3)))
    keep = np.zeros(n + 1, bool); keep[np.unique(lab[core])] = True; keep[0] = False
    return keep[lab]


def _thin(a):
    """細的部分（尖角、光芒、尾巴這類 1～2 格寬的突出）：開運算（先侵蝕再膨脹）以後就不見的格子。
    這些是故意畫的形狀，修輪廓時不准削、不准補，也不算問題"""
    vis = a[..., 3] > 0
    opened = ndimage.binary_dilation(ndimage.binary_erosion(vis, np.ones((3, 3))), np.ones((3, 3)))
    return vis & ~opened


def _ring(vis):
    p = np.pad(vis, 1)
    return vis & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])


def _profiles(vis):
    H, W = vis.shape
    return {
        "top": [int(np.argmax(vis[:, x])) if vis[:, x].any() else None for x in range(W)],
        "bot": [int(H - 1 - np.argmax(vis[::-1, x])) if vis[:, x].any() else None for x in range(W)],
        "lef": [int(np.argmax(vis[y])) if vis[y].any() else None for y in range(H)],
        "rig": [int(W - 1 - np.argmax(vis[y, ::-1])) if vis[y].any() else None for y in range(H)],
    }


def _segments(prof):
    segs, seg = [], []
    for k, v in enumerate(prof):
        if v is None or (seg and abs(v - prof[seg[-1]]) > 1):
            if len(seg) >= 3: segs.append(seg)
            seg = [] if v is None else [k]
        else:
            seg.append(k)
    if len(seg) >= 3: segs.append(seg)
    return segs


def _bumps(prof):
    """平的邊上單格凸凹：(v, >=2) (v±1, 1) (v, >=2)"""
    out = []
    for seg in _segments(prof):
        rs = runs([prof[k] for k in seg])
        for q in range(1, len(rs) - 1):
            a, b, c = rs[q - 1], rs[q], rs[q + 1]
            if a[2] == c[2] and abs(b[2] - a[2]) == 1 and b[1] == 1 and a[1] >= 2 and c[1] >= 2:
                out.append(seg[b[0]])
    return out


def _steps(prof):
    n = 0
    for seg in _segments(prof):
        rs = runs([prof[k] for k in seg])
        for q in range(1, len(rs) - 1):
            a, b, c = rs[q - 1], rs[q], rs[q + 1]
            d1, d2 = b[2] - a[2], c[2] - b[2]
            if abs(d1) != 1 or d1 != d2 or max(a[1], b[1], c[1]) > 8: continue
            if (b[1] - a[1] >= 2 and b[1] - c[1] >= 2) or (a[1] - b[1] >= 2 and c[1] - b[1] >= 2): n += 1
    return n


def _is_ink(a):
    return (a[..., :3] == INK).all(-1) & (a[..., 3] > 0)


def _corner_spur_masks(a):
    vis = a[..., 3] > 0; ink = _is_ink(a); rg = _ring(vis) & _solid(a) & ~_thin(a)
    H, W = vis.shape
    pv = np.pad(vis, 1); pk = np.pad(ink & rg, 1)
    up, dn, lf, rt = (slice(0, H), slice(1, W + 1)), (slice(2, H + 2), slice(1, W + 1)), (slice(1, H + 1), slice(0, W)), (slice(1, H + 1), slice(2, W + 2))
    iu, idn, il, ir = pk[up], pk[dn], pk[lf], pk[rt]
    vu, vd, vl, vr = pv[up], pv[dn], pv[lf], pv[rt]
    cand = ink & rg
    # L 形直角：一個水平鄰居是外框、一個垂直鄰居是外框，另外兩邊空
    corner = cand & (
        (ir & idn & ~vl & ~vu) | (il & idn & ~vr & ~vu) | (ir & iu & ~vl & ~vd) | (il & iu & ~vr & ~vd))
    # 毛：三邊以上空，而且 8 鄰沒有任何物件顏色（純外框突出）
    nb_empty = (~vu).astype(int) + (~vd) + (~vl) + (~vr)
    colour = vis & ~ink
    pc = np.pad(colour, 1)
    near_colour = np.zeros_like(vis)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            if dy == 1 and dx == 1: continue
            near_colour |= pc[dy:dy + H, dx:dx + W]
    spur = cand & (nb_empty >= 3) & ~near_colour
    return corner, spur


def check(a):
    vis = a[..., 3] > 0; ink = _is_ink(a); rg = _ring(vis) & _solid(a) & ~_thin(a)
    corner, spur = _corner_spur_masks(a)
    inner = vis & ~_ring(vis) & ~_thin(a)
    pr = np.pad(rg, 1); H, W = vis.shape
    touches_ring = pr[0:H, 1:W + 1] | pr[2:H + 2, 1:W + 1] | pr[1:H + 1, 0:W] | pr[1:H + 1, 2:W + 2]
    double = inner & ink & touches_ring
    prof = _profiles(vis & _solid(a) & ~_thin(a))
    return {"gaps": int((rg & ~ink).sum()), "corners": int(corner.sum()), "double": int(double.sum()),
            "spurs": int(spur.sum()), "bumps": sum(len(_bumps(p)) for p in prof.values()),
            "steps": sum(_steps(p) for p in prof.values())}


def _apply_profile(a, side, old, new):
    for i, (o, v) in enumerate(zip(old, new)):
        if o is None or v is None or o == v: continue
        if side == "top":
            if v > o: a[o:v, i] = 0
            else: a[v:o, i] = (*INK, 255)
        elif side == "bot":
            if v < o: a[v + 1:o + 1, i] = 0
            else: a[o + 1:v + 1, i] = (*INK, 255)
        elif side == "lef":
            if v > o: a[i, o:v] = 0
            else: a[i, v:o] = (*INK, 255)
        else:
            if v < o: a[i, v + 1:o + 1] = 0
            else: a[i, o + 1:v + 1] = (*INK, 255)


def _reink(a):
    """外圍一圈補成外框色；被包到裡面、貼著外圍的外框色換回旁邊的物件顏色（雙層變單層）"""
    vis = a[..., 3] > 0; rg = _ring(vis) & _solid(a); ink = _is_ink(a); H, W = vis.shape
    for y, x in zip(*np.nonzero(vis & ~rg & ink)):
        if not rg[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any(): continue
        cs = [tuple(a[y + dy, x + dx, :3]) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
              if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and vis[y + dy, x + dx] and not rg[y + dy, x + dx] and not ink[y + dy, x + dx]]
        if cs: a[y, x, :3] = max(set(cs), key=cs.count)
    a[rg, :3] = INK; a[rg, 3] = 255


def fix(a, rounds=6):
    a = a.copy()
    for _ in range(rounds):
        _reink(a)
        solid = _solid(a); thin = ((a[..., 3] > 0) & ~solid) | _thin(a); keep_thin = a.copy()
        prof = _profiles(solid & ~_thin(a))
        for side, p in prof.items():
            new, _n = fix_profile(p)
            for k in _bumps(new):
                # 單格凸凹拉回兩邊的高度
                seg_vals = [v for v in new]
                left = next((new[j] for j in range(k - 1, -1, -1) if new[j] is not None), None)
                if left is not None: new[k] = left
            _apply_profile(a, side, p, new)
        a[thin] = keep_thin[thin]   # 修輪廓不能動到細的光芒、閃光
        _reink(a)
        corner, spur = _corner_spur_masks(a)
        a[corner | spur] = 0
        _reink(a)
        c = check(a)
        if not any(c.values()): break
    return a


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    a = np.asarray(Image.open(src).convert("RGBA")).copy()
    print("before", check(a))
    b = fix(a)
    print("after ", check(b))
    Image.fromarray(b).save(dst)
