"""學院島大地圖：用讀回的地磚表（read/ground.png、read/edge.png）拼出整張地面。
不重畫：每一塊都是從讀回圖剪下來的（石板路、斷崖、水池、草叢小花），用「左右／上下鏡射交替」接起來，接縫是對稱的不會斷。
輸出：
  out/ground.png   整張地面（1152×768，一格 16）
  out/well.png、out/dock.png  物件（另外放，遊戲裡跟角色一起照 y 排前後）
  out/layout.json  物件位置、碰撞用的資料
用法：python build_island.py
"""
import json, random
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
R = HERE / "read"
OUT = HERE / "out"; OUT.mkdir(exist_ok=True)
G = Image.open(R / "ground.png").convert("RGBA")
E = Image.open(R / "edge.png").convert("RGBA")
rnd = random.Random(7)

GRASS = (152, 222, 71, 255)          # 斷崖、水池那張的草地色（兩張統一用這個）
SKY = (120, 200, 248, 255)

def mirror_tile_h(piece, length):
    """左右鏡射交替接成 length 長"""
    out = Image.new("RGBA", (length, piece.height))
    x, flip = 0, False
    while x < length:
        out.paste(piece.transpose(Image.FLIP_LEFT_RIGHT) if flip else piece, (x, 0)); x += piece.width; flip = not flip
    return out

def mirror_tile_v(piece, length):
    out = Image.new("RGBA", (piece.width, length))
    y, flip = 0, False
    while y < length:
        out.paste(piece.transpose(Image.FLIP_TOP_BOTTOM) if flip else piece, (0, y)); y += piece.height; flip = not flip
    return out

def recolor_grass(im, src=(152, 224, 52)):
    """地磚表那張的草地色換成統一的草地色"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][:3] == src: px[x, y] = GRASS
    return im

# ── 草叢、小花：從草地區剪下一小塊一小塊（不是草地底色的連在一起的格子） ──
def stamps(src, box, base, max_size=40):
    c = src.crop(box); w, h = c.size; px = c.load(); seen = set(); out = []
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or px[x, y][:3] == base[:3] or px[x, y][3] == 0: continue
            st, comp = [(x, y)], []; seen.add((x, y))
            while st:
                a, b = st.pop(); comp.append((a, b))
                for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    p = (a + da, b + db)
                    if 0 <= p[0] < w and 0 <= p[1] < h and p not in seen and px[p][:3] != base[:3]:
                        seen.add(p); st.append(p)
            if 3 <= len(comp) <= max_size:
                xs = [p[0] for p in comp]; ys = [p[1] for p in comp]
                s = Image.new("RGBA", (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))
                for a, b in comp: s.putpixel((a - min(xs), b - min(ys)), px[a, b])
                out.append(s)
    return out

tufts = stamps(G, (0, 0, 150, 30), (152, 224, 52))
flowers = stamps(G, (0, 30, 150, 50), (152, 224, 52), 30)
tufts = [recolor_grass(t) for t in tufts]; flowers = [recolor_grass(f) for f in flowers]

# ── 石板路：橫的一段、直的一段（含兩邊的深綠滾邊） ──
road_h = recolor_grass(G.crop((53, 111, 84, 134)))      # 高 23
road_v = recolor_grass(G.crop((28, 109, 52, 139)))      # 寬 24

# ── 斷崖：島的南邊（草地邊緣＋土石壁＋垂下的根），下面的天空、雲挖掉 ──
cliff = E.crop((0, 28, 100, 54)).copy()
cp = cliff.load()
for y in range(cliff.height):
    for x in range(cliff.width):
        r, g, b, a = cp[x, y]
        if (b > r + 50 and b > 150) or (y > 6 and r > 200 and g > 200 and b > 160): cp[x, y] = (0, 0, 0, 0)
# 雲：斷崖下面那一排白色的雲塊
def cloud_stamps():
    """斷崖下面的白雲：把雲色（白、米白）連在一起的一塊剪下來"""
    c = E.crop((0, 40, 224, 112)); w, h = c.size; px = c.load(); seen = set(); out = []
    isc = lambda p: p[0] > 200 and p[1] > 200 and p[2] > 180
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not isc(px[x, y]): continue
            st, comp = [(x, y)], []; seen.add((x, y))
            while st:
                a, b = st.pop(); comp.append((a, b))
                for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (a + da, b + db)
                    if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and isc(px[q]): seen.add(q); st.append(q)
            xs = [q[0] for q in comp]; ys = [q[1] for q in comp]
            if len(comp) >= 25 and max(ys) < h - 1 and min(xs) > 0 and max(xs) < w - 1:
                s = Image.new("RGBA", (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))
                for a, b in comp: s.putpixel((a - min(xs), b - min(ys)), px[a, b])
                out.append(s)
    return out
clouds = cloud_stamps()

# ── 水池 ──
pond = E.crop((0, 113, 110, 222))

# ── 組地面 ──
MW, MH = 1024, 850
img = Image.new("RGBA", (MW, MH), SKY)
ISL = (40, 40, 860, 770)                                # 島（右邊接碼頭，北邊是千頁圖書館）
x0, y0, x1, y1 = ISL
for i in range(70):                                     # 天空裡的雲（島外面）
    c = rnd.choice(clouds); x, y = rnd.randrange(-20, MW), rnd.randrange(-10, MH)
    img.alpha_composite(c, (x, y)) if 0 <= x <= MW - c.width and 0 <= y <= MH - c.height else None
grass = Image.new("RGBA", (x1 - x0, y1 - y0), GRASS)
img.alpha_composite(grass, (x0, y0))
for x in range(x0, x1):
    img.putpixel((x, y0), (28, 129, 53, 255)); img.putpixel((x, y0 + 1), (57, 162, 56, 255))
for y in range(y0, y1):
    for x in (x0, x1 - 1): img.putpixel((x, y), (28, 129, 53, 255))
    img.putpixel((x0 + 1, y), (57, 162, 56, 255)); img.putpixel((x1 - 2, y), (57, 162, 56, 255))
img.alpha_composite(mirror_tile_h(cliff, x1 - x0), (x0, y1 - 6))

blocked = []
def free(x, y, w, h):
    return all(x + w < a or x > c or y + h < b or y > d for a, b, c, d in blocked)

WELL_AT = (372, 400)                                     # 井的左上角
LIB = Image.open(HERE.parent / "library-look" / "read" / "library.png").convert("RGBA")
LIB_AT = (453 - LIB.width // 2, 48)                      # 千頁圖書館（大門在下緣正中間）
cx, cy = WELL_AT[0] + 81, WELL_AT[1] + 103               # 井外圈中心
roads = []
roads.append(("h", cx + 60, cy - 11, x1 - 5 - (cx + 60)))           # 東：往碼頭
roads.append(("h", x0 + 4, cy - 11, (cx - 60) - (x0 + 4)))           # 西：往星芽花園（接到島的西邊）
lib_bottom = LIB_AT[1] + LIB.height - 4
roads.append(("v", cx - 12, lib_bottom, (cy - 30) - lib_bottom))      # 北：往圖書館
for k, x, y, n in roads:
    piece = mirror_tile_h(road_h, n) if k == "h" else mirror_tile_v(road_v, n)
    img.alpha_composite(piece, (x, y)); blocked.append((x - 4, y - 4, x + piece.width + 4, y + piece.height + 4))
POND_AT = (110, 590)
img.alpha_composite(pond, POND_AT); blocked.append((POND_AT[0], POND_AT[1], POND_AT[0] + pond.width, POND_AT[1] + pond.height))
blocked.append((WELL_AT[0], WELL_AT[1], WELL_AT[0] + 157, WELL_AT[1] + 142))
blocked.append((LIB_AT[0], LIB_AT[1], LIB_AT[0] + LIB.width, LIB_AT[1] + LIB.height))
DOCK_AT = (x1 - 48, cy - 90)
blocked.append((DOCK_AT[0] - 10, DOCK_AT[1], MW, DOCK_AT[1] + 139))

# ── 小物件（腳底中心的位置）：樹、樹叢、長椅、路燈、路牌、花台、木箱… ──
P = HERE.parent / "props-look" / "split"
NAMES = {"tree": 0, "pine": 1, "tree_s": 2, "bush": 3, "lamp": 4, "sign": 5, "bench": 7, "urn": 8, "planter": 9, "scope": 11, "crystal": 12, "board": 13, "barrel": 14, "crate": 15}
PROPS = [
    ("tree", 105, 170), ("pine", 175, 120), ("tree_s", 240, 215), ("tree", 790, 190), ("pine", 730, 120), ("tree_s", 650, 205),
    ("bush", 270, 320), ("bush", 640, 320), ("bush", 150, 420), ("bush", 760, 380),
    ("planter", 378, 268), ("planter", 528, 268),
    ("lamp", 340, 488), ("lamp", 566, 488), ("lamp", 690, 488), ("lamp", 215, 488),
    ("sign", 95, 486),
    ("bench", 380, 600), ("bench", 528, 600), ("urn", 453, 640),
    ("board", 780, 470), ("barrel", 790, 590), ("crate", 815, 600), ("crate", 805, 625),
    ("scope", 815, 300), ("crystal", 255, 640),
    ("tree", 330, 745), ("pine", 600, 740), ("tree_s", 700, 700), ("pine", 70, 740), ("bush", 520, 720), ("tree_s", 400, 740),
]
props = []
for name, fx, fy in PROPS:
    im = Image.open(P / f"props-{NAMES[name]}.png")
    x, y = fx - im.width // 2, fy - im.height
    props.append({"art": name, "x": x, "y": y, "w": im.width, "h": im.height})
    blocked.append((x, y, x + im.width, y + im.height))
for name, i in NAMES.items():
    Image.open(P / f"props-{i}.png").save(OUT / f"{name}.png")

for i in range(2000):
    s = rnd.choice(flowers if rnd.random() < 0.25 else tufts)
    x, y = rnd.randrange(x0 + 6, x1 - 6 - s.width), rnd.randrange(y0 + 6, y1 - 14 - s.height)
    if free(x, y, s.width, s.height): img.alpha_composite(s, (x, y)); blocked.append((x - 1, y - 1, x + s.width + 1, y + s.height + 1))
LIB.save(OUT / "library.png")
img.convert("RGB").save(OUT / "ground.png")
Image.open(R / "well.png").save(OUT / "well.png")
Image.open(R / "dock.png").save(OUT / "dock.png")
json.dump({
    "size": [MW, MH], "tile": 16, "island": ISL,
    "objects": {"well": {"at": WELL_AT, "size": [157, 142]}, "dock": {"at": DOCK_AT, "size": [170, 139]}, "library": {"at": LIB_AT, "size": list(LIB.size)}},
    "props": props,
    "pond": {"at": POND_AT, "size": list(pond.size)},
    "roads": roads,
}, open(OUT / "layout.json", "w"), indent=1)
print("tufts", len(tufts), "flowers", len(flowers), "clouds", len(clouds), "colors", len(set(img.getdata())))
