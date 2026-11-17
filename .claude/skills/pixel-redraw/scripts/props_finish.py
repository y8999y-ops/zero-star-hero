# -*- coding: utf-8 -*-
"""小物件表第二、三步：整張表學一套色盤（上限，不一定用滿）→ 有外框的跑完美一格線＋外輪廓修平
→ 拿掉碎片 → QA → 再對齊一次色盤（輪廓修正會帶回各物件自己的線色）→ 排成物件表。

用法：python props_finish.py --name 表名 --colors 20 [--no-outline] [--align bottom|top] [--reserve #hex ...] [--work 資料夾]
  --reserve  一定要留的重點色（只出現在少數物件上、會被色盤擠掉的，例如路燈的亮黃星星）
輸出：pal-<name>/、fin-<name>/（每個物件）、out/<name>.png（物件表）
"""
import argparse, os, shutil, glob, json, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PALETTE_TOOL, PIXEL_QA, HERE, sh, drop_stray, line_of, colours

ap = argparse.ArgumentParser()
ap.add_argument("--name", required=True); ap.add_argument("--colors", type=int, default=24)
ap.add_argument("--no-outline", action="store_true"); ap.add_argument("--align", default="bottom")
ap.add_argument("--reserve", nargs="*", default=[]); ap.add_argument("--work", default=".")
A = ap.parse_args(); os.chdir(A.work); n = A.name

srcs = [s for s in sorted(glob.glob(f"L-{n}-*/{n}-*.png")) if os.path.basename(s)[:-4].rsplit("-", 1)[1].isdigit()]
for d in (f"pal-{n}", f"pin-{n}", f"fix-{n}", f"fin-{n}", f"app-{n}"):
    shutil.rmtree(d, ignore_errors=True)
os.makedirs(f"pin-{n}")
for s in srcs:
    shutil.copy(s, f"pin-{n}/")
cmd = [PALETTE_TOOL, "build", "--output-dir", f"pal-{n}", "--input", f"pin-{n}", "--colors", str(A.colors), "--balance", "--name", n]
if A.reserve:
    cmd += ["--reserve", *A.reserve]
sh(*cmd); pal = glob.glob(f"pal-{n}/*.hex")[0]
sh(PALETTE_TOOL, "apply", "--output-dir", f"app-{n}", "--palette", pal, "--input", f"pin-{n}")
os.makedirs(f"fix-{n}"); qa = {}
for s in srcs:
    b = os.path.basename(s)[:-4]; src = f"app-{n}/{b}.png"; dst = f"fix-{n}/{b}.png"
    if not A.no_outline:
        c = line_of(os.path.join(os.path.dirname(s), b + ".json"))
        sh(os.path.join(HERE, "pp_fix.py"), src, dst + ".a.png", c)
        sh(os.path.join(HERE, "flatten.py"), dst + ".a.png", dst + ".b.png", c)
        sh(os.path.join(HERE, "pp_fix.py"), dst + ".b.png", dst, c)
        os.remove(dst + ".a.png"); os.remove(dst + ".b.png")
    else:
        shutil.copy(src, dst)
    a = drop_stray(np.asarray(Image.open(dst).convert("RGBA")).copy()); Image.fromarray(a).save(dst)
    if not A.no_outline:
        rp = f"fix-{n}/qa-{b}.json"
        sh(PIXEL_QA, "--input", dst, "--outline", c, "--report", rp)
        f = json.load(open(rp, encoding="utf-8"))["frames"][0]; qa[b] = (f["l_corners"], f["outline_gaps"]); os.remove(rp)
sh(PALETTE_TOOL, "apply", "--output-dir", f"fin-{n}", "--palette", pal, "--input", f"fix-{n}")
for d in (f"app-{n}", f"pin-{n}", f"fix-{n}"):
    shutil.rmtree(d, ignore_errors=True)
sh(os.path.join(HERE, "sheet.py"), "--dir", f"fin-{n}", "--name", n, "--align", A.align)
print(n, "colours", len(colours([f"out/{n}.png"])), "QA (L corners, outline gaps):", qa)
