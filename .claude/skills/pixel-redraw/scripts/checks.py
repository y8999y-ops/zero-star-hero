# -*- coding: utf-8 -*-
"""像素畫的量化檢查與自動修正（使用者 2026-11-19 定的檢查流程，參考網上的像素畫規則）。
每個函式都收一張 RGBA（numpy），回傳（修好的圖, 數量）或報告用的數字。外框黑 INK 不會被改顏色。

  detached(a, multi)      外框外分開的小塊（< DETACH 格）拿掉；多塊物件（multi）保留 >= DETACH 的分塊
  orphans(a)              真雜點：單格、跟周圍 8 格顏色都不同、灰階又跟周圍差很少 → 併成周圍最多的色
                          （灰階差很多的單格＝刻意的鉚釘、眼睛、高光，保留）
  value_contrast(a)       相鄰的兩種不同材質，灰階亮度差太少（糊在一起）→ 兩色各往亮／暗推開
  hue_shift(a)            同一材質的色階：暗部偏冷（往藍紫）、亮部偏暖（往黃），不夠就推一點
  banding(a)              兩色的交界在連續 4 列（或 4 欄）以上剛好對齊成一條直線：只計數，不自動改
                          （每隔一列錯開會變成虛線鋸齒，更難看；直的交界很多是刻意的，例如鐵盔護鼻）
  pillow(a)               枕頭式陰影分數（外圈暗、中間亮一圈一圈，跟光源無關）：只能報告，要重畫
  symmetry(a, mode)       設計上左右對稱的物件：右半邊形狀照左半邊鏡射（左邊是受光面），顏色保留右邊自己的；
                          要改的格子超過本體 6% 就不改（本來就不對稱，硬鏡射會變形，例如護身符），回傳負數
"""
import os, sys
import numpy as np
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oklab import oklab, unoklab

INK = np.array([0x11, 0x10, 0x2e], np.uint8)
DETACH = 12          # 分開的小塊小於這個格數就拿掉（使用者 2026-11-19 同意）
ORPHAN_DL = 0.08     # 單格跟周圍的灰階差小於這個＝雜點
VALUE_DL = 0.05      # 相鄰不同材質灰階差小於這個＝糊在一起
F4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)


def _ink(a):
    return (a[..., 3] > 0) & (a[..., :3] == INK).all(-1)


def _body(a):
    return (a[..., 3] > 0) & ~_ink(a)


def _key(a):
    return np.where(a[..., 3] > 0, (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2], -1)


def _lab(rgb):
    return oklab(np.asarray(rgb, float))


def _hue(L):
    return np.degrees(np.arctan2(L[..., 2], L[..., 1])) % 360


def _chroma(L):
    return np.hypot(L[..., 1], L[..., 2])


def detached(a, multi=False):
    """外框外分開的小塊：本體分成幾塊時，小於 DETACH 的拿掉；不是多塊物件時只留最大的一塊"""
    a = a.copy(); body = _body(a)
    lab, n = ndimage.label(body, np.ones((3, 3)))
    if n <= 1: return a, 0
    sz = np.bincount(lab.ravel()); sz[0] = 0; big = sz.argmax(); removed = 0
    for c in range(1, n + 1):
        if c == big: continue
        if sz[c] < DETACH or not multi:
            a[lab == c] = 0; removed += 1
    return a, removed


def orphans(a):
    a = a.copy(); body = _body(a); k = _key(a); H, W = body.shape
    L = _lab(a[..., :3])[..., 0]; n = 0
    for y, x in zip(*np.nonzero(body)):
        ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
        nb = k[ys, xs].ravel(); m = body[ys, xs].ravel()
        others = [v for v, ok in zip(nb, m) if ok and v != k[y, x]]
        same = sum(1 for v, ok in zip(nb, m) if ok and v == k[y, x]) - 1
        if same > 0 or len(others) < 3: continue
        nl = L[ys, xs].ravel()[[ok and v != k[y, x] for v, ok in zip(nb, m)]]
        if np.abs(nl - L[y, x]).min() >= ORPHAN_DL: continue      # 刻意的亮點、鉚釘
        u, cnt = np.unique(others, return_counts=True); c = int(u[cnt.argmax()])
        a[y, x, :3] = ((c >> 16) & 255, (c >> 8) & 255, c & 255); n += 1
    return a, n


def _colour_pairs(a):
    """相鄰兩色（4 方向）共用的邊長"""
    body = _body(a); k = _key(a); pairs = {}
    for dy, dx in ((0, 1), (1, 0)):
        A = k[:k.shape[0] - dy, :k.shape[1] - dx]; B = k[dy:, dx:]
        m = body[:body.shape[0] - dy, :body.shape[1] - dx] & body[dy:, dx:] & (A != B)
        for p, q in zip(A[m], B[m]):
            key = (min(p, q), max(p, q)); pairs[key] = pairs.get(key, 0) + 1
    return pairs


def value_contrast(a):
    """不同材質（色相差 > 30° 或一個有彩一個灰）相鄰、邊長 >= 4、灰階差 < VALUE_DL → 兩色推開"""
    a = a.copy(); n = 0
    for (p, q), ln in _colour_pairs(a).items():
        if ln < 4: continue
        cp = np.array([(p >> 16) & 255, (p >> 8) & 255, p & 255], float); cq = np.array([(q >> 16) & 255, (q >> 8) & 255, q & 255], float)
        Lp, Lq = _lab(cp), _lab(cq)
        dh = abs((_hue(Lp) - _hue(Lq) + 180) % 360 - 180); cpc, cqc = _chroma(Lp), _chroma(Lq)
        different = (cpc > 0.03 and cqc > 0.03 and dh > 30) or ((cpc > 0.03) != (cqc > 0.03))
        if not different or abs(Lp[0] - Lq[0]) >= VALUE_DL: continue
        up, dn = (Lp, Lq) if Lp[0] >= Lq[0] else (Lq, Lp)
        need = (VALUE_DL - abs(Lp[0] - Lq[0])) / 2 + 0.005
        up2, dn2 = up.copy(), dn.copy(); up2[0] += need; dn2[0] -= need
        cu, cd = (cp, cq) if Lp[0] >= Lq[0] else (cq, cp)
        for src, dst in ((cu, unoklab(up2[None])[0]), (cd, unoklab(dn2[None])[0])):
            m = (a[..., :3] == src.astype(np.uint8)).all(-1) & _body(a)
            a[m, :3] = np.clip(dst, 0, 255).astype(np.uint8)
        n += 1
    return a, n


def hue_shift(a, max_deg=10):
    """同材質色階（色相相近、有彩度）依亮度排序：最暗的往藍紫（265°）推、最亮的往黃（95°）推，最多 max_deg 度，中間的按比例"""
    a = a.copy(); body = _body(a)
    cols = np.unique(a[body][:, :3], axis=0)
    if len(cols) < 3: return a, 0
    L = _lab(cols.astype(float)); h = _hue(L); C = _chroma(L)
    used = np.zeros(len(cols), bool); n = 0
    for i in np.argsort(-C):
        if used[i] or C[i] < 0.04: continue
        grp = [j for j in range(len(cols)) if not used[j] and C[j] >= 0.04 and abs((h[j] - h[i] + 180) % 360 - 180) < 30]
        for j in grp: used[j] = True
        if len(grp) < 3: continue
        grp.sort(key=lambda j: L[j, 0]); lo, hi = L[grp[0], 0], L[grp[-1], 0]
        if hi - lo < 0.12: continue
        cur = (h[grp[-1]] - h[grp[0]] + 540) % 360 - 180
        for j in grp:
            t = (L[j, 0] - lo) / (hi - lo)                       # 0＝最暗、1＝最亮
            target = 265 if t < 0.5 else 95
            w = abs(t - 0.5) * 2
            d = (target - h[j] + 540) % 360 - 180
            step = np.clip(d, -max_deg, max_deg) * w * 0.5
            if abs(step) < 1: continue
            nh = np.radians(h[j] + step); nl = L[j].copy(); nl[1], nl[2] = C[j] * np.cos(nh), C[j] * np.sin(nh)
            new = np.clip(unoklab(nl[None])[0], 0, 255).astype(np.uint8)
            m = (a[..., :3] == cols[j]).all(-1) & body; a[m, :3] = new
        n += 1
    return a, n


def banding(a, min_run=4):
    """兩色交界在連續 min_run 列以上對齊成直線（垂直）或連續 min_run 欄以上對齊（水平）→ 每隔一列把交界錯開一格"""
    a = a.copy(); n = 0
    for axis in (1, 0):
        b = a if axis == 1 else a.transpose(1, 0, 2).copy()
        body = _body(b); k = _key(b); H, W = body.shape
        for x in range(1, W):
            y = 0
            while y < H:
                if body[y, x] and body[y, x - 1] and k[y, x] != k[y, x - 1]:
                    p, q = k[y, x - 1], k[y, x]; y0 = y
                    while y < H and body[y, x] and body[y, x - 1] and k[y, x - 1] == p and k[y, x] == q: y += 1
                    if y - y0 >= min_run:
                        n += 1        # 只計數：自動每隔一列錯開會變成虛線鋸齒（2026-11-19 試過，水桶邊、鐵靴變難看），所以不改
                else:
                    y += 1
        if axis == 0: a = b.transpose(1, 0, 2).copy()
        else: a = b
    return a, n


def pillow(a):
    """枕頭式陰影分數：亮度跟「離外圍的距離」的相關（一圈一圈）減去跟「左上光源方向」的相關。> 0.25 表示明顯枕頭式"""
    body = _body(a)
    if body.sum() < 30: return 0.0
    L = _lab(a[..., :3])[..., 0][body]
    dist = ndimage.distance_transform_cdt(body)[body].astype(float)
    ys, xs = np.nonzero(body); light = -(xs - xs.mean()) - (ys - ys.mean())
    def corr(u, v):
        u = u - u.mean(); v = v - v.mean(); d = np.sqrt((u * u).sum() * (v * v).sum()); return float((u * v).sum() / d) if d else 0.0
    return round(corr(L, dist) - abs(corr(L, light)), 3)


def symmetry(a, mode="lr"):
    """左右對稱：以本體的中心欄為軸，右半邊的形狀照左半邊鏡射；右邊新補的格子用右邊最近的本體色"""
    if mode != "lr": return a, 0
    a = a.copy(); body = _body(a); H, W = body.shape
    xs = np.nonzero(body.any(0))[0]; c2 = xs.min() + xs.max()          # 軸 = c2/2
    nb = body.copy(); changed = 0
    for y in range(H):
        for x in range(W):
            xm = c2 - x
            if 2 * x <= c2 or xm < 0: continue
            want = body[y, xm]
            if want != body[y, x]: nb[y, x] = want; changed += 1
    if not changed: return a, 0
    if changed > 0.06 * body.sum():      # 本來就不太對稱（AI 畫的細節本來就左右不同）：不硬鏡射，回報負數讓流程記下來
        return a, -changed
    out = a.copy(); out[~nb & body] = 0
    for y, x in zip(*np.nonzero(nb & ~body)):
        cand = [(abs(xx - x) + abs(yy - y), yy, xx) for yy in range(max(0, y - 2), min(H, y + 3)) for xx in range(W) if body[yy, xx] and 2 * xx > c2]
        if not cand: cand = [(abs(xx - x) + abs(yy - y), yy, xx) for yy in range(max(0, y - 2), min(H, y + 3)) for xx in range(W) if body[yy, xx]]
        if cand:
            _, yy, xx = min(cand); out[y, x] = a[yy, xx]
    out[_ink(out)] = 0          # 舊外框拿掉，包一層新的（之後 outline2 會再整理）
    ol = ndimage.binary_dilation(nb, F4) & ~nb; out[ol, :3] = INK; out[ol, 3] = 255
    return out, changed
