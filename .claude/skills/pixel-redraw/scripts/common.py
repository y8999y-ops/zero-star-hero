# -*- coding: utf-8 -*-
"""共用：agent-sprite-forge 的路徑、顏色鍵、外圍判斷、拿掉碎片。"""
import os, json, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

ASF = os.environ.get("ASF_ROOT", r"C:/Users/USER/Desktop/agent-sprite-forge")
PIXEL_LOOK = os.path.join(ASF, "skills/generate2dsprite/scripts/pixel_look.py")
PIXEL_REDUCE = os.path.join(ASF, "skills/generate2dsprite/scripts/pixel_reduce.py")
PALETTE_TOOL = os.path.join(ASF, "skills/generate2dsprite/scripts/palette_tool.py")
PIXEL_QA = os.path.join(ASF, "skills/codeart2d/scripts/pixel_qa.py")
HERE = os.path.dirname(os.path.abspath(__file__))
ENV = dict(os.environ, PYTHONUTF8="1")


def sh(*args):
    r = subprocess.run(["python", *map(str, args)], capture_output=True, text=True, encoding="utf-8", env=ENV)
    if r.returncode:
        print("FAILED:", " ".join(map(str, args))[:200], "\n", (r.stdout + r.stderr)[-600:])
    return r


def key(a):
    """每格一個整數色鍵，透明是 -1"""
    return np.where(a[..., 3] > 0, (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2], -1)


def ring(vis):
    """碰到透明（或圖邊）的看得到的格子＝外圍一圈"""
    p = np.pad(vis, 1)
    return vis & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])


def opaque(img, thr=128):
    """原圖轉成只有全透明／全不透明（AI 原圖常是 alpha 252 這種半透明）"""
    a = np.asarray(img.convert("RGBA")).copy()
    a[..., 3] = np.where(a[..., 3] >= thr, 255, 0)
    return a


def magenta_mask(a):
    """洋紅底色（含邊上混到的洋紅）"""
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 90)


def drop_stray(a):
    """拿掉跟主體分開的小碎片：10 格以下，或碰到裁切邊、又比主體小很多（隔壁物件切進來的）"""
    H, W = a.shape[:2]
    lab, n = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    if not n:
        return a
    sizes = np.bincount(lab.ravel()); big = sizes[1:].max()
    for k in range(1, n + 1):
        xs = np.nonzero(lab == k)[1]
        if sizes[k] < 10 or ((xs.min() <= 1 or xs.max() >= W - 2) and sizes[k] < 0.15 * big):
            a[lab == k] = 0
    return a


def line_of(json_path):
    """pixel_look 讀回時判斷的外框線色"""
    return "#%02x%02x%02x" % tuple(json.load(open(json_path, encoding="utf-8"))["read"]["outline"]["line"])


def colours(paths):
    s = set()
    for p in paths:
        a = np.asarray(Image.open(p).convert("RGBA"))
        s |= {tuple(q) for q in a[a[..., 3] > 0][:, :3]}
    return s
