# -*- coding: utf-8 -*-
"""物件表（props_read --cell 讀回的）第二、三步，每個物件各自處理（2026-11-19 使用者確認的流程）。
每一步都有上限，最後回頭比對讀回：
  1. 每物件色盤 <= --colors-1（留一色給外框黑）
  2. 真雜點：只合併「一格、周圍 8 格全是同一色」而且灰階差 < 0.08 的格子；紋理不碰
  3. 內部的黑 → 材質最暗色（blackline）
  4. 剝掉外圍黑邊 → 本體；分開的小塊 < 12 格拿掉（--multi 的多塊物件保留大塊）
  5. 外框整圈步進修正（contour.fix3，只修明確的錯）：單格凸起、單格凹陷（刻意的縫例外）、凹凸凹凸、換軸太突然＋短直角、
     比前後都短的段、平邊凸凹；每次改動任何一種錯都不准變多，只補一格或挖一格（一格不夠時兩格），只在原外圍一格內，最多改本體 4%；
     斜率、曲線單調只報告（slope_curve）
  6. 包一層外框黑；L 形轉角補成本體；貼外框的暗格調亮；輪廓線以內不准有黑
  7. 形狀比對：本體跟讀回重疊 < 96% 就退回第 5 步（手修過的除外）
  8. 對稱（--sym）：右半邊照左半邊鏡射，要改的格子 > 6% 就不改
  9. 最後檢查（包完外框之後）：單格凸起一律往內收（尖端例外）、凹陷補上，重包，直到沒有（退回的物件也做）
 10. 色相偏移最多 5°，顏色偏移 > 0.04 就不做；壓回色數
 11. 只報告：灰階糊在一起的色對、枕頭式陰影（> 0.25 WARN）、帶狀
用法：python items_finish.py --name 表名 --colors 16 [--sym i ...] [--multi i ...] [--work 資料夾]
輸出：fin-<name>/、out/<name>.png、review-<name>.png（讀回 vs 最後）
"""
import sys, os, glob, shutil, argparse
import numpy as np
from PIL import Image
from scipy import ndimage
SK = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, SK)
from common import PALETTE_TOOL, sh
from oklab import oklab
import outline2, checks, contour

INK = np.array([0x11, 0x10, 0x2e], np.uint8); F4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
ap = argparse.ArgumentParser(); ap.add_argument("--name", required=True); ap.add_argument("--colors", type=int, default=16)
ap.add_argument("--sym", type=int, nargs="*", default=[]); ap.add_argument("--multi", type=int, nargs="*", default=[]); ap.add_argument("--work", default=".")
A = ap.parse_args(); n = A.name
os.chdir(A.work); out_dir = f"fin-{n}"; shutil.rmtree(out_dir, ignore_errors=True); os.makedirs(out_dir); warn = []; pairs = []
srcs = sorted([s for s in glob.glob(f"L-{n}-*/{n}-*.png") if os.path.basename(s)[:-4].rsplit("-", 1)[1].isdigit()], key=lambda s: int(s[:-4].rsplit("-", 1)[1]))


def ncol(a): return len({tuple(q) for q in a[a[..., 3] > 0][:, :3]})


def body_of(a): return (a[..., 3] > 0) & ~(a[..., :3] == INK).all(-1)


def cap(a, k):
    while ncol(a) > k:
        vis = a[..., 3] > 0; u, cnt = np.unique(a[vis][:, :3], axis=0, return_counts=True); L = oklab(u.astype(float)); best = None
        for i in range(len(u)):
            if (u[i] == INK).all(): continue
            for j in range(len(u)):
                if i == j or (u[j] == INK).all(): continue
                d = np.linalg.norm(L[i] - L[j]) * (1 + cnt[i] / cnt.sum())
                if best is None or d < best[0]: best = (d, i, j)
        _, i, j = best; a[vis & (a[..., :3] == u[i]).all(-1), :3] = u[j]
    return a


def strict_orphans(a):
    a = a.copy(); body = body_of(a); H, W = body.shape; L = oklab(a[..., :3].astype(float))[..., 0]; n = 0
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not body[y, x]: continue
            blk = a[y - 1:y + 2, x - 1:x + 2, :3].reshape(-1, 3); ok = body[y - 1:y + 2, x - 1:x + 2].ravel()
            if not ok.all(): continue
            nb = np.delete(blk, 4, 0)
            if (nb == nb[0]).all() and not (nb[0] == a[y, x, :3]).all() and abs(L[y - 1, x - 1] - L[y, x]) < 0.08:
                a[y, x, :3] = nb[0]; n += 1
    return a, n


def wrap(a, body):
    out = np.zeros_like(a); out[body] = a[body]; out[body, 3] = 255; H, W = body.shape
    for _ in range(4):
        ol = ndimage.binary_dilation(body, F4) & ~body; fixed = 0
        for y in range(H - 1):
            for x in range(W - 1):
                blk = ol[y:y + 2, x:x + 2]
                if blk.sum() == 3 and not body[y:y + 2, x:x + 2].any():
                    ey, ex = [(y + dy, x + dx) for dy in (0, 1) for dx in (0, 1) if not blk[dy, dx]][0]
                    cy, cx = 2 * y + 1 - ey, 2 * x + 1 - ex
                    nb = [(cy + dy, cx + dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)) if 0 <= cy + dy < H and 0 <= cx + dx < W and body[cy + dy, cx + dx]]
                    if nb: body[cy, cx] = True; out[cy, cx] = out[nb[0]]; fixed += 1
        if not fixed: break
    outline2._lift(out, body)
    ol = ndimage.binary_dilation(body, F4) & ~body; out[ol, :3] = INK; out[ol, 3] = 255
    # 輪廓線以內不能有黑（使用者 2026-11-19）：外框以內的外框黑一律換成旁邊的本體色
    vis = out[..., 3] > 0; ring = vis & ~ndimage.binary_erosion(vis, F4)
    for _ in range(3):
        inner_ink = vis & ~ring & (out[..., :3] == INK).all(-1)
        if not inner_ink.any(): break
        for y, x in zip(*np.nonzero(inner_ink)):
            nb = [tuple(out[y + dy, x + dx, :3]) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                  if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and out[y + dy, x + dx, 3] and not (out[y + dy, x + dx, :3] == INK).all()]
            if nb: out[y, x, :3] = max(set(nb), key=nb.count)
    return out


def colour_shift(a, b):
    m = body_of(a) & body_of(b)
    return float(np.linalg.norm(oklab(a[m][:, :3].astype(float)) - oklab(b[m][:, :3].astype(float)), axis=1).mean()) if m.any() else 0


for s in srcs:
    b = os.path.basename(s)[:-4]; idx = int(b.rsplit("-", 1)[1]); w = f"_w/{b}"; shutil.rmtree(w, ignore_errors=True); os.makedirs(w)
    read = np.asarray(Image.open(s).convert("RGBA")).copy()
    pad = lambda x: np.pad(x, ((3, 3), (3, 3), (0, 0)))
    read = pad(read); Image.fromarray(read).save(f"{w}/in.png")
    hand = f"hand-{n}/{b}.png"
    if os.path.exists(hand):
        h = np.asarray(Image.open(hand).convert("RGBA")); a = np.zeros_like(read); oy, ox = (a.shape[0] - h.shape[0]) // 2, (a.shape[1] - h.shape[1]) // 2
        if oy >= 0 and ox >= 0: a[oy:oy + h.shape[0], ox:ox + h.shape[1]] = h
        else: a = pad(h)
        rep = {"hand": 1}
        # 手修版＝使用者確認過的樣子：原樣保留，只壓色數，不跑自動修正（2026-11-19 魚骨：跑完流程骨頭之間的縫被當內線換掉、輪廓不清楚）
        res = cap(a.copy(), A.colors); bb = Image.fromarray(res).getbbox(); Image.fromarray(res).crop(bb).save(f"{out_dir}/{b}.png")
        pairs.append((read, res)); print(b, {"hand": 1, "colours": ncol(res)}); continue
    else:
        sh(PALETTE_TOOL, "build", "--output-dir", f"{w}/pal", "--input", f"{w}/in.png", "--colors", A.colors - 1, "--name", b)
        sh(PALETTE_TOOL, "apply", "--output-dir", f"{w}/app", "--palette", glob.glob(f"{w}/pal/*.hex")[0], "--input", f"{w}/in.png")
        a = np.asarray(Image.open(f"{w}/app/in.png").convert("RGBA")).copy(); rep = {}
    a, rep["orphans"] = strict_orphans(a)
    os.makedirs(f"{w}/r"); Image.fromarray(a).save(f"{w}/r/{b}.png"); sh(f"{SK}/blackline.py", f"{w}/r", f"{w}/bl", b)
    a = np.asarray(Image.open(f"{w}/bl/{b}.png").convert("RGBA")).copy()
    # 4. 剝外框 → 本體
    vis = a[..., 3] > 0; L = oklab(a[..., :3].astype(float))[..., 0]
    body = vis & ~(vis & ~ndimage.binary_erosion(vis, F4) & (L < 0.33))
    lab, k = ndimage.label(body, np.ones((3, 3)))
    if k > 1:
        sz = np.bincount(lab.ravel()); sz[0] = 0; big = sz.argmax()
        for c in range(1, k + 1):
            if c != big and (sz[c] < 12 or idx not in A.multi): body[lab == c] = False
    sc0 = contour.errors(body)
    # 5. 外框步進
    fixed_body, nchg = contour.fix3(body)
    # 新補的格子給旁邊本體的顏色
    col = a.copy()
    for y, x in zip(*np.nonzero(fixed_body & ~body)):
        for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            yy, xx = y + dy, x + dx
            if body[yy, xx]: col[y, x] = a[yy, xx]; break
    res = wrap(col, fixed_body.copy())
    # 9. 形狀比對（剝掉外框的讀回本體 vs 結果本體）
    rv = read[..., 3] > 0; rL = oklab(read[..., :3].astype(float))[..., 0]
    rbody = rv & ~(rv & ~ndimage.binary_erosion(rv, F4) & (rL < 0.33))
    fb = body_of(res); iou = (rbody & fb).sum() / max(1, (rbody | fb).sum())
    if iou < 0.96 and not rep.get("hand"):
        res = wrap(a.copy(), body.copy()); fb = body_of(res); iou = (rbody & fb).sum() / max(1, (rbody | fb).sum()); rep["shape_reverted"] = 1
    # 8. 對稱
    if idx in A.sym:
        s2, ks = checks.symmetry(res, "lr"); rep["symmetry"] = ks
        if ks > 0:
            fb = body_of(s2); c2 = s2.copy(); res = wrap(c2, fb.copy())
    # 9. 最後檢查（包完外框之後）：還有單格凸起／凹陷就修本體、重包外框，直到沒有（退回的物件也做）
    for _ in range(4):
        fb = body_of(res); sp, no = contour.spurs_notches(fb)
        if not sp and not no: break
        nb2, k2 = contour.spot_fix_in(fb); rep["spot"] = rep.get("spot", 0) + k2
        col = res.copy(); col[(res[..., :3] == INK).all(-1)] = 0
        for y, x in zip(*np.nonzero(nb2 & ~fb)):
            for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (1, 1), (-1, 1), (1, -1)):
                if fb[y + dy, x + dx]: col[y, x] = res[y + dy, x + dx]; break
        res = wrap(col, nb2.copy())
    # 7. 色相偏移（小）＋檢查
    hs, nh = checks.hue_shift(res, max_deg=5)
    if colour_shift(read, hs) <= 0.04: res = hs; rep["hue"] = nh
    res = cap(res, A.colors)
    after = contour.errors(body_of(res)); rep["slope_curve"] = contour._slope_curve(body_of(res))
    vis = res[..., 3] > 0; inner_black = int((vis & ndimage.binary_erosion(vis, F4) & (res[..., :3] == INK).all(-1)).sum())
    rep.update({"contour_before": sc0, "contour_after": after, "changed": nchg, "iou": round(float(iou), 3),
                "colour_shift": round(colour_shift(read, res), 3), "colours": ncol(res), "inner_black": inner_black,
                "value_pairs": checks.value_contrast(res)[1], "banding": checks.banding(res)[1], "pillow": checks.pillow(res)})
    if after[0] or after[1] or inner_black or rep["pillow"] > 0.25 or (rep["colour_shift"] > 0.06 and not rep.get("hand")): warn.append(b)
    pairs.append((read, res))
    bb = Image.fromarray(res).getbbox(); Image.fromarray(res).crop(bb).save(f"{out_dir}/{b}.png")
    print(b, rep)
shutil.rmtree("_w", ignore_errors=True)
sh(os.path.join(SK, "sheet.py"), "--dir", out_dir, "--name", n)
from PIL import ImageDraw
k = 6; C = 36 * k; O = Image.new("RGB", (6 * (2 * C + 20), ((len(pairs) + 5) // 6) * (C + 8)), (40, 36, 50))
for i, (r, f_) in enumerate(pairs):
    x, y = (i % 6) * (2 * C + 20), (i // 6) * (C + 8)
    for j, im in enumerate((r, f_)):
        im = Image.fromarray(im); im = im.crop(im.getbbox()); bg = Image.new("RGBA", (C, C), (196, 190, 206, 255))
        big = im.resize((im.width * k, im.height * k), Image.NEAREST); bg.alpha_composite(big, ((C - big.width) // 2, (C - big.height) // 2)); O.paste(bg.convert("RGB"), (x + j * (C + 4), y))
O.save(f"review-{n}.png")
print("WARN:", warn if warn else "none")
