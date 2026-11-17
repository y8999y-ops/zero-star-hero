# -*- coding: utf-8 -*-
"""物件表（用 props_read --cell 讀回的）第二、三步，每個物件各自處理：
  1. 每個物件自己學一套色盤，上限 --colors（含外框黑；色數依類別，見 SKILL.md 的色數表）
  2. 太小的碎塊（< --min-part 格）拿掉；比它大的分開小塊（光芒、火花）保留
  3. 外框只修最外圍一圈（outline.py）：外圍一律外框黑、補缺口，修掉直角雙層、毛、單格凸凹、不規律的階梯；裡面完全不碰
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
import outline
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
                if i == j or tuple(u[i]) in protect: continue
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
    # 3. 外輪廓：外圍一圈外框黑，並修掉直角雙層、毛、單格凸凹、不規律的階梯（outline.py，只動外圍；一格寬的光芒保留原色）
    a = outline.fix(a); s2 = a.copy()
    Image.fromarray(a).save(f"{w}/ring.png")
    # 4. 內部的黑 → 材質最暗一階
    os.makedirs(f"{w}/r"); Image.fromarray(a).save(f"{w}/r/{b}.png")
    sh(os.path.join(HERE, "blackline.py"), f"{w}/r", f"{w}/bl", b)
    a = np.asarray(Image.open(f"{w}/bl/{b}.png").convert("RGBA")).copy()
    # 5. 壓回上限（外框黑不併）
    a = cap(a, A.colors, protect={BLACK})
    oc = outline.check(a)
    if any(oc.values()):
        a = outline.fix(a); a = cap(a, A.colors, protect={BLACK}); oc = outline.check(a)
    Image.fromarray(a).save(f"fin-{n}/{b}.png")
    # 6. 自動比對
    rv, fv = read[..., 3] > 0, a[..., 3] > 0
    lost = (rv & ~fv).sum() / max(1, rv.sum())
    both = rv & fv & ~ring(fv)
    shift = float(np.linalg.norm(oklab(read[both][:, :3].astype(float)) - oklab(a[both][:, :3].astype(float)), axis=1).mean()) if both.any() else 0
    flag = lost > 0.06 or shift > 0.06 or any(oc.values())
    if flag: warn.append(b)
    print(f"{b}: {a.shape[1]}x{a.shape[0]} colours {ncol(a)} | lost {lost:.1%} | colour shift {shift:.3f} | outline {oc}{'  WARN' if flag else ''}")
    stages.append((b, [read, s1, s2, a]))
shutil.rmtree(f"_w-{n}", ignore_errors=True)
sh(os.path.join(HERE, "sheet.py"), "--dir", f"fin-{n}", "--name", n)
# 每一步並排
k = 6; C = 34 * k; f = ImageFont.truetype("C:/Windows/Fonts/msjh.ttc", 16)
names = ["讀回", "每物件色盤", "外輪廓修正", "內線換深色＋壓色"]
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
