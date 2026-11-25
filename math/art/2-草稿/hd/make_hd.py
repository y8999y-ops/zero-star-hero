"""AI 原圖直接用（使用者 2026-11-25：改成 2D 橫版、點選就好，背景、建築、小物件用 AI 原圖，不重畫成像素）。
只做三件事：裁掉透明的邊、平滑縮小（先乘 alpha 再縮，邊緣不會有黑邊／白邊）、存 PNG。
  建築、小物件 → assets/hub/<名稱>.png（高最多 MAXH）
  戰鬥背景三層 → assets/battle-hd/<區域>/back|mid|ground.png
    back 縮成 1152×648（遊戲的 384×216 的 3 倍）；mid、ground 照「像素版讀回的格子」換算成同一個 3 倍比例，
    這樣版面數字（ground 上緣 132、mid 壓進 6 格）跟像素版一樣，src/battle/areaart.js 不用改版面。
用法：python make_hd.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
REF = HERE.parent.parent / "1-參考原圖"
ASSETS = HERE.parent.parent.parent / "assets"
K = 3   # 戰鬥背景放大倍數（384×216 → 1152×648）


def smooth_resize(im, size):
    a = np.array(im.convert("RGBA")).astype(np.float32) / 255
    a[..., :3] *= a[..., 3:4]
    big = Image.fromarray((a * 255).round().astype(np.uint8))
    chans = [Image.fromarray(np.array(big)[..., i]).resize(size, Image.LANCZOS) for i in range(4)]
    b = np.stack([np.array(c) for c in chans], -1).astype(np.float32) / 255
    al = b[..., 3:4]
    b[..., :3] = np.where(al > 0.004, b[..., :3] / np.maximum(al, 1e-4), 0)
    b[..., 3] = np.where(b[..., 3] < 0.02, 0, b[..., 3])
    return Image.fromarray((b.clip(0, 1) * 255).round().astype(np.uint8))


def trim(im):
    a = np.array(im.convert("RGBA"))
    ys, xs = np.nonzero(a[..., 3] > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def hub():
    out = ASSETS / "hub"; out.mkdir(parents=True, exist_ok=True)
    # 名稱 → (原圖, 高最多幾像素)
    items = {
        "library": ("map/library.png", 520), "clock": ("map/clocktower.png", 520), "well": ("map/well-plaza.png", 300),
        "fire": ("map/academy-fire.png", 400), "water": ("map/academy-water.png", 330), "ice": ("map/academy-ice.png", 330),
        "forest": ("map/academy-forest.png", 340), "thunder": ("map/academy-thunder.png", 400),
        "dorm": ("map/dorm.png", 330), "shop": ("map/shop.png", 300), "greenhouse": ("map/greenhouse.png", 320), "dock": ("map/dock.png", 340),
    }
    for name, (src, maxh) in items.items():
        im = trim(Image.open(REF / src))
        k = min(1, maxh / im.height)
        smooth_resize(im, (round(im.width * k), round(im.height * k))).save(out / f"{name}.png", optimize=True)
        print("hub", name, im.size, "→", round(im.width * k), round(im.height * k))


# 像素版讀回時用的格子（同一張原圖的「一格」有幾個原圖像素），HD 版照這個換算成 3 倍
CELLS = {
    "garden": {"mid": 5.3, "ground": 5.54},
    "library": {"mid": 3.86, "ground": 4.05},
    "clock": {"mid": 5.3, "ground": 4.42},
    "greenhouse": {"mid": 5.2, "ground": 4.8},
    "vault": {"mid": 3.98, "ground": 4.44},
}


def battle():
    for area, cells in CELLS.items():
        out = ASSETS / "battle-hd" / area; out.mkdir(parents=True, exist_ok=True)
        back = Image.open(REF / "battle" / area / "back.png").convert("RGBA")
        smooth_resize(back, (384 * K, 216 * K)).convert("RGB").save(out / "back.jpg", quality=88)
        for layer in ("mid", "ground"):
            im = Image.open(REF / "battle" / area / f"{layer}.png").convert("RGBA")
            f = K / cells[layer]
            r = trim(smooth_resize(im, (round(im.width * f), round(im.height * f))))
            r.save(out / f"{layer}.png", optimize=True)
            print("battle", area, layer, r.size)


if __name__ == "__main__":
    import sys
    if "battle" not in sys.argv[1:]: hub()
    battle()
