"""不重繪的版本（使用者 2026-11-25 想看看遊戲裡的效果）：
把 AI 原圖直接平滑縮小到跟讀回圖一樣大（不照格子讀、不壓色數），存到各個 *-look/raw/。
透明邊用預乘 alpha 縮，邊緣才不會有黑邊。之後拼地圖的腳本加 ART=raw 就會改用這些圖。
用法：python make_raw.py"""
from pathlib import Path
from PIL import Image
HERE = Path(__file__).parent
SRC = HERE.parent / "1-參考原圖" / "map"
JOBS = [("island-look", n, n2) for n, n2 in [("ground", "tiles-ground"), ("edge", "tiles-edge"), ("well", "well-plaza"), ("dock", "dock")]]
JOBS += [("library-look", "library", "library"), ("props-look", "props", "props"), ("ink-look", "ink", "ink")]
JOBS += [("buildings-look", n, n) for n in ["academy-fire", "academy-water", "academy-ice", "academy-forest", "academy-thunder", "dorm", "shop", "clocktower", "greenhouse"]]
for folder, name, src in JOBS:
    read = Image.open(HERE / folder / "read" / f"{name}.png")
    im = Image.open(SRC / f"{src}.png").convert("RGBA")
    out = im.convert("RGBa").resize(read.size, Image.LANCZOS).convert("RGBA")
    a = out.getchannel("A").point(lambda v: 0 if v < 24 else 255 if v > 230 else v)   # 幾乎透明的雜邊拿掉
    out.putalpha(a)
    (HERE / folder / "raw").mkdir(exist_ok=True)
    out.save(HERE / folder / "raw" / f"{name}.png"); print(folder, name, read.size)
