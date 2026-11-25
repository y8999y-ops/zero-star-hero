"""星芽花園的區域地圖：從學院島往西走進來。用讀回的地磚表拼（草地、小花、泥土路），
小物件（樹、樹叢、花台、噴泉）和墨水污染（水窪、墨水封印門）都是讀回的物件。
三群墨水怪站的地方＝第 1～3 關；西邊被墨水封印門擋住的空地＝王（墨水大王・幼體）。
輸出 assets/map/garden/：ground.png、物件 png、layout.json
用法：python build_garden.py
"""
import json, os, random
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
DRAFT = HERE.parent
ART = os.environ.get("ART", "read")          # raw：不重繪的原圖版，輸出到 assets/map/garden-raw/
SPLIT = "split" if ART == "read" else "split-raw"
G = Image.open(DRAFT / "island-look" / ART / "ground.png").convert("RGBA")
OUT = DRAFT.parent.parent / "assets" / "map" / ("garden" if ART == "read" else "garden-raw"); OUT.mkdir(parents=True, exist_ok=True)
rnd = random.Random(11)
MW, MH = 1024, 640
GRASS = (152, 224, 52, 255)
if ART == "raw":
    import numpy as np
    v, c = np.unique(np.array(G.convert("RGB"))[:50].reshape(-1, 3), axis=0, return_counts=True); GRASS = tuple(int(x) for x in v[c.argmax()]) + (255,)

def mirror(piece, length, axis):
    out = Image.new("RGBA", (length, piece.height) if axis == "h" else (piece.width, length))
    p, flip = 0, False
    step = piece.width if axis == "h" else piece.height
    while p < length:
        im = piece.transpose(Image.FLIP_LEFT_RIGHT if axis == "h" else Image.FLIP_TOP_BOTTOM) if flip else piece
        out.paste(im, (p, 0) if axis == "h" else (0, p)); p += step; flip = not flip
    return out

def stamps(box, max_size):
    c = G.crop(box); w, h = c.size; px = c.load(); seen = set(); out = []
    for y in range(h):
        for x in range(w):
            isg = lambda p: sum(abs(a - b) for a, b in zip(p[:3], GRASS[:3])) < 30
            if (x, y) in seen or isg(px[x, y]): continue
            st, comp = [(x, y)], []; seen.add((x, y))
            while st:
                a, b = st.pop(); comp.append((a, b))
                for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (a + da, b + db)
                    if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and not isg(px[q]): seen.add(q); st.append(q)
            if 3 <= len(comp) <= max_size:
                xs = [q[0] for q in comp]; ys = [q[1] for q in comp]
                s = Image.new("RGBA", (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))
                for a, b in comp: s.putpixel((a - min(xs), b - min(ys)), px[a, b])
                out.append(s)
    return out
tufts = stamps((0, 0, 150, 30), 40)
flowers = stamps((0, 30, 150, 50), 30)

# 泥土路：原圖的路只有 12 格寬，角色走不太下。把路拆成「上邊、中間、下邊」三段，中間那段重複幾次，路就變寬，邊緣還是原圖的樣子
def widen_h(width):
    top, mid, bot = G.crop((55, 57, 84, 66)), G.crop((55, 64, 84, 69)), G.crop((55, 67, 84, 77))
    out = Image.new("RGBA", (29, width)); out.paste(top, (0, 0)); y = top.height
    while y < width - bot.height: out.paste(mid, (0, y)); y += mid.height
    out.paste(bot, (0, width - bot.height)); return out
def widen_v(width):
    return widen_h(width).transpose(Image.TRANSPOSE)
dirt_h = widen_h(26)
dirt_v = G.crop((26, 54, 52, 82)) if False else widen_v(26)

img = Image.new("RGBA", (MW, MH), GRASS)
blocked = []
def free(x, y, w, h): return all(x + w < a or x > c or y + h < b or y > d for a, b, c, d in blocked)

# 路：入口在東邊（接學院島），往西分成上下兩條繞過中間的噴泉，再合起來往西到墨水封印門
ROADS = [("h", 640, 1024, 330), ("h", 300, 652, 170), ("h", 300, 652, 500), ("v", 160, 510, 640), ("v", 160, 510, 300), ("h", 120, 312, 330)]
for k, a, b, c in ROADS:
    piece = mirror(dirt_h, b - a, "h") if k == "h" else mirror(dirt_v, b - a, "v")
    at = (a, c - piece.height // 2) if k == "h" else (c - piece.width // 2, a)
    img.alpha_composite(piece, at); blocked.append((at[0] - 3, at[1] - 3, at[0] + piece.width + 3, at[1] + piece.height + 3))
# 路口：每條路的中間（不含邊緣）再畫一次，蓋掉別條路的邊緣線，路口才會接起來
for k, a, b, c in ROADS:
    core = mirror(widen_h(26).crop((0, 7, 29, 19)), b - a, "h")
    if k == "h": img.alpha_composite(core, (a, c - 13 + 7))
    else: img.alpha_composite(core.transpose(Image.TRANSPOSE), (c - 13 + 7, a))
# 王的空地：一塊泥土地（用橫的路疊幾排）
img.alpha_composite(mirror(widen_h(130), 150, "h"), (40, 272))
blocked.append((36, 266, 194, 404))

P = DRAFT / "props-look" / SPLIT
I = DRAFT / "ink-look" / SPLIT
NAMES = {"tree": 0, "pine": 1, "tree_s": 2, "bush": 3, "lamp": 4, "sign": 5, "fountain": 6, "bench": 7, "urn": 8, "planter": 9}
props = []
def prop(name, fx, fy):
    im = Image.open(P / f"props-{NAMES[name]}.png")
    x, y = fx - im.width // 2, fy - im.height
    props.append({"art": name, "x": x, "y": y, "w": im.width, "h": im.height}); blocked.append((x, y, x + im.width, y + im.height))
prop("fountain", 470, 365)
for x, y in [(400, 250), (540, 250), (400, 440), (540, 440)]: prop("urn", x, y)
for x, y in [(720, 250), (860, 420), (900, 250), (560, 600), (380, 600), (200, 150), (180, 520)]: prop("bush", x, y)
for x, y in [(760, 560), (820, 140), (240, 600), (120, 470)]: prop("planter", x, y)
prop("sign", 960, 310); prop("bench", 760, 410)
# 四周一圈樹（花園的邊界）
for x in range(20, MW, 70):
    prop(rnd.choice(["tree", "pine", "tree_s"]), x + rnd.randrange(-8, 8), 52 + rnd.randrange(0, 10))
    if not (300 < x < 380): prop(rnd.choice(["tree", "pine", "tree_s"]), x + rnd.randrange(-8, 8), MH - 4)
for y in range(110, MH - 60, 62):
    if abs(y - 330) > 60: prop(rnd.choice(["tree", "pine"]), 22, y + 40)
    if abs(y - 330) > 40: prop(rnd.choice(["tree", "pine"]), MW - 20, y + 40)

# 墨水污染：水窪（恢復色彩後消失）＋封印門（打完三群墨水怪才打開）
inks = []
def ink(i, fx, fy):
    im = Image.open(I / f"ink-{i}.png"); x, y = fx - im.width // 2, fy - im.height // 2
    inks.append({"art": f"ink{i}", "x": x, "y": y, "w": im.width, "h": im.height}); im.save(OUT / f"ink{i}.png")
for i, x, y in [(0, 820, 360), (2, 560, 150), (3, 700, 470), (6, 380, 520), (7, 250, 400), (1, 120, 300), (8, 160, 360), (10, 600, 330), (5, 880, 300), (9, 330, 230), (4, 470, 190)]: ink(i, x, y)
gate = Image.open(I / "ink-13.png"); gate.save(OUT / "gate.png")
GATE = {"x": 220 - gate.width // 2, "y": 330 + 14 - gate.height, "w": gate.width, "h": gate.height}
blocked.append((GATE["x"], GATE["y"], GATE["x"] + GATE["w"], GATE["y"] + GATE["h"]))

for i in range(2600):
    s = rnd.choice(flowers if rnd.random() < 0.55 else tufts)
    x, y = rnd.randrange(4, MW - 4 - s.width), rnd.randrange(4, MH - 4 - s.height)
    if free(x, y, s.width, s.height): img.alpha_composite(s, (x, y)); blocked.append((x - 1, y - 1, x + s.width + 1, y + s.height + 1))

img.convert("RGB").save(HERE / ("ground-raw.png" if ART == "read" else "ground-orig.png"))
if ART == "raw": img.convert("RGB").save(OUT / "ground.png")      # 原圖版不壓色數，直接用
for name, i in NAMES.items(): Image.open(P / f"props-{i}.png").save(OUT / f"{name}.png")
json.dump({
    "size": [MW, MH], "roads": ROADS, "props": props, "inks": inks, "gate": GATE,
    "groups": [{"stage": 0, "x": 790, "y": 300}, {"stage": 1, "x": 470, "y": 140}, {"stage": 2, "x": 470, "y": 540}],
    "boss": {"x": 100, "y": 345}, "entry": {"x": 990, "y": 330},
}, open(OUT / "layout.json", "w"), indent=1)
print("ok", len(props), "props", len(inks), "inks")
