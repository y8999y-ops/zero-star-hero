"""學院島 v3：同心圓（世界觀 3.0，使用者 2026-11-25：「不要這麼規整，要同心圓式，最重要的建築在中央往外擴散」）。
  中心：千頁圖書館＋門前的共鳴之井廣場
  第一圈環狀路：五座學系學院繞一圈（北邊兩座門朝環狀路；東西兩座用短路接回環狀路；赤焰塔在南邊接外圈）
  第二圈環狀路：宿舍、商店、溫室、鐘塔
  最外：島是一個大橢圓，南邊是斷崖；東邊碼頭、西邊往星芽花園
路是用「遮罩」畫的：環狀路、放射路、短路先畫成一張遮罩，再用讀回的石板路材質填進去、邊緣描深綠。
ART=raw：改用不重繪的原圖版（*-look/raw、split-raw），輸出到 assets/map/island-raw/。
用法：python build_island2.py　或　ART=raw python build_island2.py
"""
import json, math, os, random
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image

ART = os.environ.get("ART", "read")
HERE = Path(__file__).parent; D = HERE.parent
SPLIT = "split" if ART == "read" else "split-raw"
OUT = D.parent.parent / "assets" / "map" / ("island" if ART == "read" else "island-raw"); OUT.mkdir(parents=True, exist_ok=True)
G = Image.open(HERE / ART / "ground.png").convert("RGBA")
E = Image.open(HERE / ART / "edge.png").convert("RGBA")
rnd = random.Random(5)
MW, MH = 1300, 1180
C = (640, 580)                        # 同心圓的中心
ISL = (C[0], C[1], 628, 548)          # 島：橢圓（中心、半徑）
R1 = (300, 322)                       # 第一圈環狀路（半寬、半高）
R2 = (560, 470)                       # 第二圈
ROAD_W = 24

def nearest(rgb, pal):  # 原圖版的顏色不是固定值，用最接近的
    return min(pal, key=lambda c: sum((a - b) ** 2 for a, b in zip(c, rgb)))
gpx = np.array(G.convert("RGB")).reshape(-1, 3)
vals, cnt = np.unique(gpx[: 214 * 50], axis=0, return_counts=True)
GRASS = tuple(int(v) for v in vals[cnt.argmax()]) + (255,)

# ── 小草、小花 ──
def stamps(box, max_size):
    c = G.crop(box); w, h = c.size; px = c.load(); seen = set(); out = []
    isg = lambda p: sum(abs(a - b) for a, b in zip(p[:3], GRASS[:3])) < 30
    for y in range(h):
        for x in range(w):
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
tufts = stamps((0, 0, 150, 30), 40); flowers = stamps((0, 30, 150, 50), 30)

# ── 石板路材質：橫的路中間那一段，上下左右鏡射鋪滿 ──
tex = G.crop((55, 114, 84, 129)).convert("RGBA")
T = Image.new("RGBA", (tex.width * 2, tex.height * 2))
T.paste(tex, (0, 0)); T.paste(tex.transpose(Image.FLIP_LEFT_RIGHT), (tex.width, 0))
T.paste(tex.transpose(Image.FLIP_TOP_BOTTOM), (0, tex.height)); T.paste(tex.transpose(Image.ROTATE_180), (tex.width, tex.height))
TA = np.array(T)
EDGE_D, EDGE_L = np.array(G.getpixel((60, 112))[:3]), np.array(G.getpixel((60, 132))[:3])   # 路邊的深綠、淺綠

yy, xx = np.mgrid[0:MH, 0:MW].astype(float)
def ring(rx, ry):
    r = np.sqrt(((xx - C[0]) / rx) ** 2 + ((yy - C[1]) / ry) ** 2)
    return np.abs(r - 1) * min(rx, ry) < ROAD_W / 2
def seg(ax, ay, bx, by, w=ROAD_W):
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
    t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / L2, 0, 1)
    return (xx - ax - t * dx) ** 2 + (yy - ay - t * dy) ** 2 < (w / 2) ** 2
def on_ring(rx, ry, ang):
    return C[0] + rx * math.cos(math.radians(ang)), C[1] + ry * math.sin(math.radians(ang))
def ring_x(rx, ry, y, side):   # 環狀路在高度 y 的左（-1）右（+1）邊 x
    k = (y - C[1]) / ry
    return C[0] + side * rx * math.sqrt(max(0, 1 - k * k))

# ── 建築（腳底中心＝門口，門在圖寬的幾成） ──
B = D / "buildings-look" / ART
def bimg(f): return Image.open((D / "library-look" / ART / "library.png") if f == "library" else (B / f"{f}.png")).convert("RGBA")
WELL_C = (C[0], C[1] + 30)                                     # 井外圈中心
LIB_FOOT = (C[0], WELL_C[1] - 112)
BUILD = [("library", "library", *LIB_FOOT, 0.5)]
BUILD += [("forest", "academy-forest", 236, 392, 0.46), ("thunder", "academy-thunder", 1046, 392, 0.5),
          ("water", "academy-water", 186, 668, 0.5), ("ice", "academy-ice", 1094, 668, 0.5),
          ("fire", "academy-fire", C[0], C[1] + R2[1], 0.5)]
for name, f, ang in [("dorm", "dorm", 131), ("shop", "shop", 109), ("greenhouse", "greenhouse", 70), ("clock", "clocktower", 47)]:
    x, y = on_ring(*R2, ang); BUILD.append((name, f, round(x), round(y), 0.16 if name == "shop" else 0.5))

road = ring(*R1) | ring(*R2)
buildings, blocked = [], []
for name, f, fx, fy, door in BUILD:
    im = bimg(f); x, y = fx - im.width // 2, fy - im.height
    dx = x + round(im.width * door)
    buildings.append({"art": name, "x": x, "y": y, "w": im.width, "h": im.height, "door": [dx, fy]})
    im.save(OUT / f"{name}.png"); blocked.append((x, y, x + im.width, fy))
# 門口接到路上的短路
spur = lambda a, b: seg(a[0], a[1], b[0], b[1])
road |= spur((236, 406), (ring_x(*R1, 406, -1), 406)) | spur((1046, 406), (ring_x(*R1, 406, 1), 406))
road |= spur((186, 682), (ring_x(*R1, 682, -1), 682)) | spur((1094, 682), (ring_x(*R1, 682, 1), 682))
# 放射路：中心廣場往南接到第一圈；東、西從第一圈往外接到碼頭、花園門
EW_Y = C[1] + 190
road |= spur((C[0], WELL_C[1] + 40), (C[0], C[1] + R1[1]))
road |= spur((ring_x(*R1, EW_Y, 1), EW_Y), (ISL[0] + ISL[2] - 10, EW_Y)) | spur((ring_x(*R1, EW_Y, -1), EW_Y), (ISL[0] - ISL[2] + 4, EW_Y))
# 圖書館門口到井：一小段
road |= spur((C[0], LIB_FOOT[1] - 4), (C[0], WELL_C[1] - 36))

# ── 地面 ──
island = ((xx - ISL[0]) / ISL[2]) ** 2 + ((yy - ISL[1]) / ISL[3]) ** 2 < 1
img = np.zeros((MH, MW, 4), np.uint8); img[...] = (120, 200, 248, 255)
img[island] = GRASS
road &= island
# 中央廣場：圖書館前、井的周圍鋪一圈廣場石板（地磚表最下面那條廣場地磚，左右鏡射鋪滿）
band = G.crop((0, 163, 214, 217)).convert("RGBA")
PB = Image.new("RGBA", (band.width * 2, band.height)); PB.paste(band, (0, 0)); PB.paste(band.transpose(Image.FLIP_LEFT_RIGHT), (band.width, 0))
PA = np.array(PB)
plaza = (((xx - C[0]) / 190) ** 2 + ((yy - (WELL_C[1] - 10)) / 128) ** 2 < 1) & island
# 使用者 2026-11-25：金色花紋的廣場地板「太雜亂」→ 改成跟路一樣的石板（素一點），只在井的正前方留一顆金星
img[plaza] = TA[yy[plaza].astype(int) % TA.shape[0], xx[plaza].astype(int) % TA.shape[1]]
road &= ~ndimage_erode_none(plaza) if False else ~plaza
# 路：材質＋邊緣兩層綠
ty, tx = (yy.astype(int) % TA.shape[0]), (xx.astype(int) % TA.shape[1])
img[road] = TA[ty[road], tx[road]]
inner = ndimage.binary_erosion(road, iterations=2)
img[road & ~ndimage.binary_erosion(road, iterations=1)] = (*EDGE_D, 255)
img[ndimage.binary_erosion(road, iterations=1) & ~inner] = (*EDGE_L, 255)
# 島的邊：深綠一圈
rim = island & ~ndimage.binary_erosion(island, iterations=2)
img[rim] = (*EDGE_D, 255)
pr = plaza & ~ndimage.binary_erosion(plaza, iterations=2)          # 廣場的邊
img[pr] = (*EDGE_D, 255)
out = Image.fromarray(img)
# 南邊斷崖：沿著橢圓的下緣一欄一欄貼
cliff = E.crop((0, 28, 100, 54)).copy(); cp = cliff.load()
for y in range(cliff.height):
    for x in range(cliff.width):
        r, g, b, a = cp[x, y]
        if (b > r + 50 and b > 150) or (y > 6 and r > 200 and g > 200 and b > 160): cp[x, y] = (0, 0, 0, 0)
for x in range(ISL[0] - ISL[2] + 30, ISL[0] + ISL[2] - 30):
    k = (x - ISL[0]) / ISL[2]
    if abs(k) >= 1: continue
    yb = ISL[1] + ISL[3] * math.sqrt(1 - k * k)
    if yb < ISL[1] + ISL[3] * 0.55: continue
    col = cliff.crop((x % 100, 0, x % 100 + 1, cliff.height))
    out.alpha_composite(col, (x, int(yb) - 6))

# 雲（島外）：斷崖下面那排白雲剪下來，撒在天空
def clouds():
    c = E.crop((0, 40, 224, 112)); a = np.array(c); white = (a[..., 0] > 200) & (a[..., 1] > 200) & (a[..., 2] > 180)
    lab, n = ndimage.label(white); res = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == k
        if m.sum() < 25 or sl[0].start == 0 or sl[1].start == 0 or sl[0].stop >= a.shape[0] or sl[1].stop >= a.shape[1]: continue
        piece = a[sl].copy(); piece[~m] = 0; res.append(Image.fromarray(piece))
    return res
cl = clouds()
for i in range(90):
    c = rnd.choice(cl); x, y = rnd.randrange(0, MW - c.width), rnd.randrange(0, MH - c.height)
    if not island[min(MH - 1, y + c.height // 2), x + c.width // 2]: out.alpha_composite(c, (x, y))

WELL_AT = (WELL_C[0] - 81, WELL_C[1] - 103)
blocked.append((WELL_AT[0], WELL_AT[1], WELL_AT[0] + 157, WELL_AT[1] + 142))
DOCK_AT = (ISL[0] + ISL[2] - 52, EW_Y - 90)
blocked.append((DOCK_AT[0] - 10, DOCK_AT[1], MW, DOCK_AT[1] + 139))

P = D / "props-look" / SPLIT
NAMES = {"tree": 0, "pine": 1, "tree_s": 2, "bush": 3, "lamp": 4, "sign": 5, "fountain": 6, "bench": 7, "urn": 8, "planter": 9, "books": 10, "scope": 11, "crystal": 12, "board": 13, "barrel": 14, "crate": 15}
PROPS = [("board", 520, 660), ("bench", 560, 720), ("bench", 720, 720), ("urn", 760, 650), ("crystal", 770, 600), ("planter", 560, 480), ("planter", 720, 480),
         ("books", 580, 470), ("sign", 120, EW_Y - 14), ("fountain", 640, 880), ("scope", 900, 220), ("crate", 1150, EW_Y + 50), ("barrel", 1130, EW_Y + 56)]
# 環狀路兩邊一圈路燈
for ang in range(0, 360, 30):
    for (rx, ry), k in [(R1, 1.12), (R2, 0.93)]:
        x, y = on_ring(rx * k, ry * k, ang + 15); PROPS.append(("lamp", round(x), round(y)))
# 圈和圈之間、島邊緣種樹和樹叢
for i in range(260):
    a = rnd.uniform(0, 360)
    band_ = rnd.random()
    if band_ < 0.45: k = rnd.uniform(1.08, 1.16); rx, ry = R2[0] * k, R2[1] * k                     # 外圈外面（島的邊緣）
    elif band_ < 0.85: k = rnd.uniform(0.62, 0.9); rx, ry = R1[0] + (R2[0] - R1[0]) * k, R1[1] + (R2[1] - R1[1]) * k   # 兩圈中間
    else: k = rnd.uniform(0.82, 0.92); rx, ry = R1[0] * k, R1[1] * k                                # 第一圈裡面
    x, y = on_ring(rx, ry, a)
    PROPS.append((rnd.choice(["tree", "pine", "tree_s", "tree_s", "bush", "bush", "urn", "planter"]), round(x), round(y)))
# ── 每座學院周圍的特色（使用者：「火學院周圍要有跟火相關的東西」） ──
#   地面換色：火＝秋天的紅橙草地、冰＝雪地、雷＝紫色的草、森＝深綠、水＝旁邊一個水池
#   小物件：冰學院擺冰晶台、森學院種滿樹、水學院噴泉、雷學院望遠鏡和水晶台
#   會動的（遊戲裡畫）：火星往上飄、雪花、閃電火花、落葉、水泡泡 → layout 的 zones
BB = {b["art"]: b for b in buildings}
def zone_of(name, rx=150, ry=95):
    b = BB[name]; return {"kind": name, "x": b["x"] + b["w"] / 2, "y": b["y"] + b["h"] * 0.7, "rx": rx, "ry": ry}
zones = [zone_of("fire", 120, 110), zone_of("ice", 160, 100), zone_of("thunder", 140, 110), zone_of("forest", 180, 110), zone_of("water", 170, 100)]
# 位置：("L"/"R" 建築左右兩邊, 往外幾格, 腳底比建築底部高幾格)
THEME_PROPS = {
    "ice": [("crystal", "L", 22, 6), ("crystal", "R", 22, 6), ("crystal", "L", 50, 50), ("crystal", "R", 46, 56)],
    "forest": [("tree", "L", 30, 20), ("pine", "L", 60, 70), ("tree_s", "R", 40, 10), ("bush", "L", 16, -2), ("bush", "R", 20, -4), ("pine", "R", 70, 60), ("tree", "L", 90, 0), ("tree_s", "R", 96, 30)],
    "water": [("bush", "L", 16, -2), ("urn", "R", 100, 10)],          # 噴泉改成會動的特效（遊戲裡畫）
    "thunder": [("crystal", "L", 24, 8), ("crystal", "R", 24, 8), ("scope", "L", 60, 50)],
    "fire": [("urn", "L", 22, 6), ("urn", "R", 22, 6)],
}
for z in zones:
    b = BB[z["kind"]]
    for name, side, out_, up in THEME_PROPS[z["kind"]]:
        x = b["x"] - out_ if side == "L" else b["x"] + b["w"] + out_
        PROPS.insert(0, (name, round(x), round(b["y"] + b["h"] - up)))
# 蒼流館旁邊一個水池（斷崖地磚表裡的水池）
pond = E.crop((0, 113, 110, 222)).convert("RGBA")
wb = BB["water"]; POND_AT = (wb["x"] - 40, wb["y"] - 84)
blocked.append((POND_AT[0], POND_AT[1], POND_AT[0] + pond.width, POND_AT[1] + pond.height))

props = []
def overlaps(b): return any(not (b[2] < a[0] or b[0] > a[2] or b[3] < a[1] or b[1] > a[3]) for a in blocked)
for name, fx, fy in PROPS:
    im = Image.open(P / f"props-{NAMES[name]}.png")
    x, y = fx - im.width // 2, fy - im.height; box = (x, y, x + im.width, y + im.height)
    if not island[min(MH - 1, max(0, fy)), min(MW - 1, max(0, fx))]: continue
    if name != "lamp" and (overlaps(box) or road[max(0, fy - 4):fy + 2, max(0, x):x + im.width].any()): continue
    if name == "lamp" and (overlaps(box) or road[max(0, fy - 3):fy + 1, max(0, fx - 3):fx + 3].any()): continue
    props.append({"art": name, "x": x, "y": y, "w": im.width, "h": im.height}); blocked.append(box)
for name, i in NAMES.items(): Image.open(P / f"props-{i}.png").save(OUT / f"{name}.png")

# 小草小花（避開路、建築、物件）
for i in range(5200):
    s = rnd.choice(flowers if rnd.random() < 0.3 else tufts)
    x, y = rnd.randrange(0, MW - s.width), rnd.randrange(0, MH - s.height)
    if not island[y, x] or not island[y + s.height - 1, x + s.width - 1] or road[y:y + s.height, x:x + s.width].any() or plaza[y:y + s.height, x:x + s.width].any(): continue
    if overlaps((x, y, x + s.width, y + s.height)): continue
    out.alpha_composite(s, (x, y))

# 地面換色（在學院周圍，邊緣用亂數點點漸漸淡掉，不是一條硬線）
A = np.array(out).astype(float)
THEME = {"fire": [(122, 46, 34), (196, 92, 44), (236, 150, 62), (250, 204, 110)],
         "ice": [(150, 176, 214), (198, 222, 240), (232, 244, 252), (252, 254, 255)],
         "thunder": [(70, 56, 120), (112, 92, 176), (150, 128, 214), (196, 178, 240)],
         "forest": [(28, 82, 40), (44, 120, 52), (78, 160, 60), (128, 196, 84)],
         "water": [(40, 120, 110), (70, 168, 140), (110, 206, 160), (170, 232, 190)]}
noise = np.random.RandomState(3).rand(MH, MW)
greenish = (A[..., 1] > A[..., 0] + 12) & (A[..., 1] > A[..., 2] + 12) & ~road & ~plaza
lum = (0.3 * A[..., 0] + 0.59 * A[..., 1] + 0.11 * A[..., 2]) / 255
for z in zones:
    d = np.sqrt(((xx - z["x"]) / z["rx"]) ** 2 + ((yy - z["y"]) / z["ry"]) ** 2)
    m = greenish & (d < 1 - noise * 0.35)
    ramp = np.array(THEME[z["kind"]], float)
    idx = np.clip(((lum - 0.25) / 0.55 * 4).astype(int), 0, 3)
    A[m, :3] = ramp[idx[m]]
out = Image.fromarray(A.astype(np.uint8))
out.alpha_composite(pond, POND_AT)
out.convert("RGB").save(OUT / "ground.png")
Image.open(HERE / ART / "well.png").save(OUT / "well.png")
Image.open(HERE / ART / "dock.png").save(OUT / "dock.png")
json.dump({
    "size": [MW, MH], "center": C, "island": ISL, "r1": R1, "r2": R2, "ewY": EW_Y,
    "objects": {"well": {"at": WELL_AT, "size": [157, 142]}, "dock": {"at": DOCK_AT, "size": [170, 139]}},
    "buildings": buildings, "props": props, "zones": zones, "pond": {"at": POND_AT, "size": list(pond.size)},
}, open(OUT / "layout.json", "w"), indent=1)
print(ART, "ok", len(buildings), "buildings", len(props), "props")
