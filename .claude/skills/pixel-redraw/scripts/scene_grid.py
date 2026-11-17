# -*- coding: utf-8 -*-
"""量場景原圖的像素格大小（AI 假像素圖的格子常是小數，而且寬高不同）。
兩種量法一起印：局部視窗的邊界一致性、整張邊界剖面的 FFT。兩者接近的值就是格子；
差兩倍時（例如 4 和 8）放大看原圖決定。pixel_reduce 自己的偵測在這種圖上常常不準，不要直接信。

用法：python scene_grid.py 原圖1.png [原圖2.png ...]
"""
import sys
import numpy as np
from PIL import Image


def local(a, vis):
    res = []
    for axis in (1, 0):
        d = (np.abs(np.diff(a[..., :3], axis=axis)).sum(-1) > 40) & (vis[:, 1:] if axis == 1 else vis[1:])
        ys, xs = np.nonzero(d); pos = (xs if axis == 1 else ys).astype(float); other = ys if axis == 1 else xs
        w = (pos // 240) * 1000 + other // 40; u, inv = np.unique(w, return_inverse=True); cnt = np.bincount(inv); m = cnt > 20
        sc = []
        for p in np.arange(2.8, 14, 0.02):
            ph = np.exp(2j * np.pi * pos / p); s = np.bincount(inv, ph.real); c = np.bincount(inv, ph.imag)
            sc.append((np.mean(np.hypot(s, c)[m] / cnt[m]), p))
        sc.sort(reverse=True); res.append([round(p, 2) for _, p in sc[:3]])
    return res


def fft(a):
    out = []
    for axis in (1, 0):
        d = np.abs(np.diff(a[..., :3], axis=axis)).sum(-1)
        prof = d.sum(0) if axis == 1 else d.sum(1)
        prof = prof - np.convolve(prof, np.ones(15) / 15, "same")
        F = np.abs(np.fft.rfft(prof)); f = np.fft.rfftfreq(len(prof)); m = (f > 1 / 14) & (f < 1 / 2.8)
        out.append([round(1 / f[m][j], 2) for j in np.argsort(F[m])[::-1][:3]])
    return out


for path in sys.argv[1:]:
    a = np.asarray(Image.open(path).convert("RGBA")).astype(float)
    vis = a[..., 3] >= 128
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    vis &= ~((r > 150) & (b > 150) & (g < 110))
    l, f = local(a, vis), fft(a)
    print(path, "| local x", l[0], "y", l[1], "| fft x", f[0], "y", f[1])
