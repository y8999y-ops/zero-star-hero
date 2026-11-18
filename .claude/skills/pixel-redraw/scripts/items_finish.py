# -*- coding: utf-8 -*-
"""物件表（用 props_read --cell 讀回的）第二、三步，每個物件各自處理：
  1. 每個物件自己學一套色盤，上限 --colors（含外框黑；色數依類別，見 SKILL.md 的色數表）
  2. 太小的碎塊（< --min-part 格）拿掉；比它大的分開小塊（光芒、火花）保留
  3. 外輪廓重建（outline2.py）：剝掉外圍黑邊 → 本體剪影照步進補色或往內挖 → 外面包一層外框黑（外框永遠一層）
     （舊的「完美一格線」會把所有暗色當成線，深色物件整個被削成蜘蛛腳，2026-11-17 改掉）
  4. 內部的黑換成材質最暗一階（外框規則，blackline.py）
  5. 再壓一次到 --colors 以內（外框規則可能加了新的深色）
  6. 自動比對：讀回 vs 最後，少掉的格子比例、顏色平均偏移，超過門檻的印 WARN
輸出：fin-<name>/、out/<name>.png、stages-<name>.png（每一步並排，給自己先檢查）

用法：python items_finish.py --name cores --colors 16 [--min-part 3] [--work 資料夾]
"""
import argparse, os, glob, shutil, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PALETTE_TOOL, HERE, sh, ring
from oklab import oklab
import outline, outline2
from scipy import ndimage

BLACK = (0x11, 0x10, 0x2e)
ap = argparse.ArgumentParser()
ap.add_argument("--name", required=True); ap.add_argument("--colors", type=int, default=16)
ap.add_argument("--min-part", type=int, default=3); ap.add_argument("--work", default=".")
A = ap.parse_args(); os.chdir(A.work); n = A.name
srcs = sorted([s for s in glob.glob(f"L-{n}-*/{n}-*.png") if os.path.basename(s)[:-4].rsplit("-", 1)[1].isdigit()],
              key=lambda s: int(os.path.basename(s)[:-4].rsplit("-", 1)[1]))
for d in (f"fin-{n}", f"_w-{n}"):
    shutil.rmtree(d, ignore_errors=True)
os.makedirs(f"fin-{n}"); os.makedirs(f"_w-{n}")


def ncol(a):
    return len({tuple(q) for q in a[a[..., 3] > 0][:, :3]})


def cap(a, k, protect=()):
    """把最接近的兩色合併（少的併到多的），直到 <= k 色；protect 的顏色不被併掉"""
    while ncol(a) > k:
        vis = a[..., 3] > 0; u, cnt = np.unique(a[vis][:, :3], axis=0, return_counts=True)
        L = oklab(u.astype(float)); best = None
        for i in range(len(u)):
            for j in range(len(u)):
                if i == j or tuple(u[i]) in protect or tuple(u[j]) in protect: continue
                d = np.linalg.norm(L[i] - L[j]) * (1 + cnt[i] / cnt.sum())
                if best is None or d < best[0]: best = (d, i, j)
        _, i, j = best
        m = vis & (a[..., :3] == u[i]).all(-1); a[m, :3] = u[j]
    return a


stages = []
warn = []
for s in srcs:
    b = os.path.basename(s)[:-4]; w = f"_w-{n}/{b}"; os.makedirs(w)
    read = np.asarray(Image.open(s).convert("RGBA")).copy()
    # 1. 每個物件自己的色盤（留一色給外框黑）
    shutil.copy(s, f"{w}/in.png")
    sh(PALETTE_TOOL, "build", "--output-dir", f"{w}/pal", "--input", f"{w}/in.png", "--colors", A.colors - 1, "--name", b)
    pal = glob.glob(f"{w}/pal/*.hex")[0]
    sh(PALETTE_TOOL, "apply", "--output-dir", f"{w}/app", "--palette", pal, "--input", f"{w}/in.png")
    a = np.asarray(Image.open(f"{w}/app/in.png").convert("RGBA")).copy(); s1 = a.copy()
    # 2. 太小的碎塊
    lab, k = ndimage.label(a[..., 3] > 0, np.ones((3, 3)))
    if k:
        sz = np.bincount(lab.ravel())
        for c in range(1, k + 1):
            if sz[c] < A.min_part: a[lab == c] = 0
    s2 = a.copy()
    # 4. 內部的黑 → 材質最暗一階（外框規則）
    os.makedirs(f"{w}/r"); Image.fromarray(a).save(f"{w}/r/{b}.png")
    sh(os.path.join(HERE, "blackline.py"), f"{w}/r", f"{w}/bl", b)
    a = np.asarray(Image.open(f"{w}/bl/{b}.png").convert("RGBA")).copy()
    # 3. 外輪廓重建（outline2.py，使用者 2026-11-19 教的）：剝掉外圍黑邊 → 本體剪影照步進補色或往內挖 → 外面包一層外框黑；
    #    貼著外框很暗的本體格調亮一階。外框永遠只有一層，不會有直角雙層、黑點
    pad = np.zeros((a.shape[0] + 4, a.shape[1] + 4, 4), np.uint8); pad[2:-2, 2:-2] = a
    a = outline2.rebuild(pad); s2 = a.copy()
    # 5. 壓回上限（外框黑不併），壓完再檢查一次
    a = cap(a, A.colors, protect={BLACK}); oc = outline2.check(a)
    if oc.get("stack"):        # 壓色把調亮的格子又併回暗色：再調一次（不再壓色，色數只會一樣或更少）
        body = (a[..., 3] > 0) & ~(a[..., :3] == BLACK).all(-1); outline2._lift(a, body); oc = outline2.check(a)
    if any(oc.values()):
        a = cap(outline2.rebuild(a), A.colors, protect={BLACK}); oc = outline2.check(a)
    bb = Image.fromarray(a).getbbox(); a = np.asarray(Image.fromarray(a).crop(bb)).copy()
    Image.fromarray(a).save(f"fin-{n}/{b}.png")
    # 6. 自動比對
    # 讀回和結果大小可能差幾格（外框重建），比對時各自置中疊在同一張畫布上
    Hc, Wc = max(read.shape[0], a.shape[0]) + 2, max(read.shape[1], a.shape[1]) + 2
    def place(x):
        c = np.zeros((Hc, Wc, 4), np.uint8); oy, ox = (Hc - x.shape[0]) // 2, (Wc - x.shape[1]) // 2; c[oy:oy + x.shape[0], ox:ox + x.shape[1]] = x; return c
    read_c = place(read); best = None
    for dy in (-2, -1, 0, 1, 2):          # 找最對得齊的位移（外框重建可能讓大小差 1～2 格）
        for dx in (-2, -1, 0, 1, 2):
            cand = np.roll(np.roll(place(a), dy, 0), dx, 1)
            sc = ((read_c[..., 3] > 0) ^ (cand[..., 3] > 0)).sum()
            if best is None or sc < best[0]: best = (sc, cand)
    a_c = best[1]
    rv, fv = read_c[..., 3] > 0, a_c[..., 3] > 0
    lost = (rv & ~fv).sum() / max(1, rv.sum())
    both = rv & fv & ~ring(fv)
    shift = float(np.linalg.norm(oklab(read_c[both][:, :3].astype(float)) - oklab(a_c[both][:, :3].astype(float)), axis=1).mean()) if both.any() else 0
    flag = lost > 0.06 or shift > 0.06 or any(oc.values())
    if flag: warn.append(b)
    print(f"{b}: {a.shape[1]}x{a.shape[0]} colours {ncol(a)} | lost {lost:.1%} | colour shift {shift:.3f} | outline {oc}{'  WARN' if flag else ''}")
    stages.append((b, [read, s1, s2, a]))
shutil.rmtree(f"_w-{n}", ignore_errors=True)
sh(os.path.join(HERE, "sheet.py"), "--dir", f"fin-{n}", "--name", n)
# 每一步並排
k = 6; C = 34 * k; f = ImageFont.truetype("C:/Windows/Fonts/msjh.ttc", 16)
names = ["讀回", "每物件色盤", "外輪廓重建", "壓色（最後）"]
O = Image.new("RGB", (4 * (C + 8), len(stages) * (C + 26)), (70, 62, 84)); d = ImageDraw.Draw(O)
for r, (b, ims) in enumerate(stages):
    for j, im in enumerate(ims):
        im = Image.fromarray(im); im = im.crop(im.getbbox()) if im.getbbox() else im
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        x, y = j * (C + 8), r * (C + 26)
        bg = Image.new("RGBA", (C, C), (70, 62, 84, 255)); bg.alpha_composite(im, ((C - im.width) // 2, (C - im.height) // 2))
        O.paste(bg.convert("RGB"), (x, y)); d.text((x + 4, y + C + 4), f"{b} {names[j]}", fill="white", font=f)
O.save(f"stages-{n}.png")
print("WARN:", warn if warn else "none")
