"""學院島 v5b（2026-11-25 使用者「太方正太整齊」→ 崖、路、廣場都改成彎的，樹籬一段一段，建築不對稱）
以下是 v5 的說明：
學院島 v5（docs/地圖設計.md）：三層台地、中軸線、水道。使用者 2026-11-25「要活用現有素材」——
不等新圖，用讀回的地磚、建築、小物件拼：
  台地的崖＝斷崖地磚那條（草地邊＋岩壁），階梯＝石板路穿過崖的缺口，水道＝水池的水面材質，樹籬＝一排樹叢。
地圖資料：能走的地方由這支腳本算好存成格子（layout.json 的 walk，一格 8 像素），遊戲裡不再手寫碰撞規則；
建築、小物件的碰撞照物件清單（maps.js 的 FOOTPRINT）。每個物件放在哪都寫在下面，有理由。
ART=raw：不重繪的原圖版（只是比較用）。
用法：python build_island4.py
"""
import json, math, os, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ART = os.environ.get("ART", "read")
HERE = Path(__file__).parent; D = HERE.parent
SPLIT = "split" if ART == "read" else "split-raw"
OUT = D.parent.parent / "assets" / "map" / ("island" if ART == "read" else "island-raw"); OUT.mkdir(parents=True, exist_ok=True)
G = Image.open(HERE / ART / "ground.png").convert("RGBA")
E = Image.open(HERE / ART / "edge.png").convert("RGBA")
rnd = random.Random(9)
MW, MH = 1440, 1300
SKY = (120, 200, 248)

vals, cnt = np.unique(np.array(G.convert("RGB"))[:50].reshape(-1, 3), axis=0, return_counts=True)
GRASS = tuple(int(v) for v in vals[cnt.argmax()]) + (255,)
yy, xx = np.mgrid[0:MH, 0:MW].astype(float)

def poly_mask(pts):
    m = Image.new("L", (MW, MH), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255); return np.array(m) > 0
def line_mask(pts, w):
    m = Image.new("L", (MW, MH), 0); d = ImageDraw.Draw(m); d.line([tuple(p) for p in pts], fill=255, width=w, joint="curve")
    for p in pts: d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=255)
    return np.array(m) > 0
def spline(pts, n=14):
    """Catmull-Rom 曲線：把幾個點接成平滑的彎路"""
    P = [pts[0]] + list(pts) + [pts[-1]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(tuple(pts[-1])); return out
def ell(cx, cy, rx, ry): return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1
def mirror_tex(im):
    T = Image.new("RGBA", (im.width * 2, im.height * 2))
    T.paste(im, (0, 0)); T.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (im.width, 0))
    T.paste(im.transpose(Image.FLIP_TOP_BOTTOM), (0, im.height)); T.paste(im.transpose(Image.ROTATE_180), (im.width, im.height))
    return np.array(T)
def fill(img, m, TA): img[m] = TA[yy[m].astype(int) % TA.shape[0], xx[m].astype(int) % TA.shape[1]]

# ── 材質（全部從讀回的地磚表剪） ──
ROAD = mirror_tex(G.crop((55, 114, 84, 129)).convert("RGBA"))              # 石板路
WATER = mirror_tex(E.crop((50, 128, 86, 148)).convert("RGBA"))             # 水面
EDGE_D, EDGE_L = np.array(G.getpixel((60, 112))[:3]), np.array(G.getpixel((60, 132))[:3])
cliff = E.crop((0, 28, 100, 54)).copy(); cp = cliff.load()                 # 崖：上面一排草、下面岩壁
for y in range(cliff.height):
    for x in range(cliff.width):
        r, g, b, a = cp[x, y]
        if (b > r + 50 and b > 150) or (y > 6 and r > 200 and g > 200 and b > 160): cp[x, y] = (0, 0, 0, 0)

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

# ── 1. 大塊地形：島、三層台地（越北越高） ──
CX = 720
ISLAND = [(250, 120), (520, 50), (920, 50), (1190, 120), (1340, 330), (1360, 620), (1300, 900), (1150, 1110), (900, 1220), (560, 1230), (300, 1130), (140, 900), (80, 600), (110, 320)]
UPPER = [(330, 90), (1110, 90), (1150, 400), (290, 400)]                    # 上層台地：圖書館、鐘塔、瞭望台
UP_Y, LOW_Y = 400, 850                                                      # 崖的平均高度
def UP(x): return UP_Y + 26 * math.sin((x - 180) / 210) + 12 * math.sin(x / 83 + 1)      # 上層台地前緣（起伏的曲線）
def LOW(x): return LOW_Y + 30 * math.sin((x + 120) / 250) + 12 * math.sin(x / 67 + 2)    # 中層台地前緣
# 島的邊用模糊再切一刀變圓（不要直直的多邊形邊）
island = ndimage.gaussian_filter(poly_mask(ISLAND).astype(float), 60) > 0.5
# 邊緣再加一點高低起伏（像真的島，不是幾何圖形）
ang = np.arctan2(yy - 640, xx - CX)
wob = (np.sin(ang * 7 + 1.3) * 0.5 + np.sin(ang * 13 + 0.4) * 0.3) * 14
island = ndimage.gaussian_filter(poly_mask(ISLAND).astype(float), 60) > 0.5 - wob / 200
UPa = np.array([UP(x) for x in range(MW)]); LOWa = np.array([LOW(x) for x in range(MW)])
upper = island & (yy < UPa[None, :] + 6)                                    # 上層台地：崖以北整片
lower = island & (yy > LOWa[None, :] + 26)
mid = island & ~upper & ~lower

# ── 2. 路：中軸線（石板）、去各處的路 ──
PLAZA = (CX, 600, 200, 120)                                                 # 中央廣場（共鳴之井）
HARBOR = (CX - 10, 1015, 150, 70)                                           # 港口廣場
# 路：每一條都是幾個點連成的曲線。中軸線過崖的地方要剛好在階梯（x＝CX）
roads = []
roads.append((spline([(CX, 330), (CX, UP(CX) + 30), (CX - 6, 470), (CX, 520)]), 30))                       # 圖書館 → 大階梯 → 廣場
roads.append((spline([(CX, 700), (CX + 16, 760), (CX + 6, 820), (CX, LOW(CX) + 30), (CX - 14, 940), (CX - 10, 980)]), 30))   # 廣場 → 大階梯 → 港口
roads.append((spline([(CX - 190, 620), (580, 660), (470, 660), (380, 690), (260, 712), (150, 706), (82, 700)]), 24))   # 西：一路彎到星芽花園
roads.append((spline([(470, 660), (468, 712), (472, 745)]), 20))             # 赤焰塔門口
roads.append((spline([(380, 690), (330, 736), (300, 785)]), 20))             # 蒼流館門口
roads.append((spline([(580, 660), (470, 610), (360, 600), (250, 588)]), 20))   # 翠森苑門口
roads.append((spline([(CX + 190, 620), (900, 600), (1000, 600), (1080, 640), (1110, 700), (1095, 776)]), 24))   # 東：彎到白霜堂
roads.append((spline([(1000, 600), (1090, 580), (1180, 562)]), 20))          # 紫雷閣門口
roads.append((spline([(CX - 140, 1030), (600, 1070), (500, 1080), (420, 1068)]), 22))   # 港口西：商店、宿舍
roads.append((spline([(CX + 130, 1030), (860, 1060), (960, 1080), (1010, 1094)]), 22))   # 港口東：溫室
roads.append((spline([(960, 1080), (1080, 1060), (1180, 1010), (1250, 1000)]), 22))     # 碼頭
roads.append((spline([(CX - 100, 336), (620, 352), (540, 340), (480, 322)]), 20))       # 上層西：瞭望台
roads.append((spline([(CX + 100, 336), (840, 356), (930, 350), (980, 342)]), 20))       # 上層東：鐘塔
road = np.zeros((MH, MW), bool)
for pts, w in roads: road |= line_mask(pts, w)
def blob(cx, cy, rx, ry, seed):
    a_ = np.arctan2(yy - cy, xx - cx); r_ = 1 + 0.07 * np.sin(a_ * 3 + seed) + 0.05 * np.sin(a_ * 5 + seed * 2)
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < r_ ** 2
plaza = blob(*PLAZA, 1.2) | blob(*HARBOR, 2.7)                               # 廣場：邊緣有一點起伏，不是正橢圓

# ── 3. 水道：上層台地的瀑布 → 中層東邊 → 港口的水池 ──
CANAL = spline([(950, 380), (950, UP(950) + 10), (966, 520), (948, 650), (962, 770), (932, LOW(932) + 10), (905, 960)])   # 在廣場東邊外面
canal = line_mask(CANAL, 22) & island
POND_C = (880, 990, 60, 34)
canal |= ell(*POND_C)

# ── 4. 上色 ──
img = np.zeros((MH, MW, 4), np.uint8); img[...] = (*SKY, 255)
img[island] = GRASS
# 上層台地草地亮一點點、下層暗一點點（看得出高低）
A0 = img.astype(float)
A0[upper, :3] = np.clip(A0[upper, :3] * 1.04 + 4, 0, 255); A0[lower, :3] *= 0.97
img = A0.astype(np.uint8)
fill(img, plaza & island, ROAD); fill(img, road & island & ~plaza, ROAD)
r1 = ndimage.binary_erosion(road | plaza, iterations=1); r2 = ndimage.binary_erosion(road | plaza, iterations=2)
img[(road | plaza) & island & ~r1] = (*EDGE_D, 255); img[r1 & ~r2 & island] = (*EDGE_L, 255)
fill(img, canal, WATER)
c1 = ndimage.binary_dilation(canal, iterations=2) & ~canal & island
img[c1] = (200, 192, 168, 255)                                              # 水道的石頭邊
img[ndimage.binary_dilation(canal, iterations=1) & ~canal & island] = (150, 140, 120, 255)
bridge = canal & ndimage.binary_dilation(road | plaza, iterations=1)        # 路過水道＝小石橋（路面蓋在水上，兩邊加欄杆）
fill(img, bridge, ROAD)
br = ndimage.binary_dilation(bridge, iterations=2) & ~bridge & canal
img[br] = (120, 100, 90, 255)
rim = island & ~ndimage.binary_erosion(island, iterations=2); img[rim] = (*EDGE_D, 255)
out = Image.fromarray(img)

# 崖：上層台地前緣、中層台地前緣，中軸線的地方留缺口＝大階梯；崖下面一條陰影
def cliff_row(fy, x0, x1, gaps):
    for x in range(int(x0), int(x1)):
        if any(a <= x < b for a, b in gaps): continue
        y = int(round(fy(x)))
        out.alpha_composite(cliff.crop((x % 100, 0, x % 100 + 1, cliff.height)), (x, y - 6))
        out.alpha_composite(Image.new("RGBA", (1, 8), (20, 40, 20, 50)), (x, y + cliff.height - 6))
STAIR_UP = [(CX - 20, CX + 20), (934, 966)]                                 # 上層崖：中軸線大階梯、水道瀑布
STAIR_LOW = [(CX - 20, CX + 20), (916, 948)]
xu = np.where(island[UP_Y + 4])[0]; cliff_row(UP, xu.min() + 6, xu.max() - 6, STAIR_UP)
xs = np.where(island[LOW_Y + 4])[0]; cliff_row(LOW, xs.min() + 6, xs.max() - 6, STAIR_LOW)
# 大階梯：一階一階的橫線（石板路上畫深一點的線）
dr = ImageDraw.Draw(out)
for fy in (UP, LOW):
    y0 = int(fy(CX))
    for k in range(0, 22, 4): dr.line([(CX - 15, y0 + k), (CX + 15, y0 + k)], fill=tuple(int(v) for v in EDGE_D) + (255,))
# 瀑布：水道經過崖的地方，白色水花一條一條往下
for (x0, x1), fy in [(STAIR_UP[1], UP), (STAIR_LOW[1], LOW)]:
    for x in range(x0 + 4, x1 - 4):
        y0 = int(fy(x))
        for y in range(y0 - 4, y0 + 22):
            if (x * 7 + y * 3) % 9 < 2: out.putpixel((x, y), (235, 248, 255, 255))
# 南邊島緣：斷崖一欄一欄貼著島的下緣
for x in range(int(xs.min()), int(xs.max())):
    col = np.where(island[:, x])[0]
    if not len(col): continue
    yb = col.max()
    if yb < 700: continue
    out.alpha_composite(cliff.crop((x % 100, 0, x % 100 + 1, cliff.height)), (x, int(yb) - 6))

# ── 5. 建築（腳底中心＝門口） ──
B = D / "buildings-look" / ART
def bimg(f): return Image.open((D / "library-look" / ART / "library.png") if f == "library" else (B / f"{f}.png")).convert("RGBA")
BUILD = [
    ("library", "library", CX, 330, 0.5),                    # 上層正中：最高、最大
    ("clock", "clocktower", 980, 340, 0.5),                  # 上層東：畢業鐘塔
    ("forest", "academy-forest", 240, 578, 0.46),            # 中層西北：樹林邊
    ("fire", "academy-fire", 472, 746, 0.5),                 # 中層西：火盆庭院
    ("water", "academy-water", 300, 786, 0.5),               # 中層西南：水池
    ("thunder", "academy-thunder", 1182, 548, 0.5),          # 中層東北
    ("ice", "academy-ice", 1096, 776, 0.5),                  # 中層東南：雪庭
    ("dorm", "dorm", 420, 1068, 0.5),                        # 下層港口：宿舍
    ("shop", "shop", 590, 1080, 0.16),                       # 下層港口：商店
    ("greenhouse", "greenhouse", 1012, 1094, 0.5),           # 下層港口：溫室（水道流進溫室旁的水池）
]
buildings = []
for name, f, fx, fy, door in BUILD:
    im = bimg(f); x, y = fx - im.width // 2, fy - im.height
    buildings.append({"art": name, "x": x, "y": y, "w": im.width, "h": im.height, "door": [x + round(im.width * door), fy]})
    im.save(OUT / f"{name}.png")
BB = {b["art"]: b for b in buildings}
WELL_C = (PLAZA[0], PLAZA[1] + 20); WELL_AT = (WELL_C[0] - 81, WELL_C[1] - 103)
DOCK_AT = (1250, 1000 - 90)

# ── 6. 小物件：每一個都有理由 ──
P = D / "props-look" / SPLIT
NAMES = {"tree": 0, "pine": 1, "tree_s": 2, "bush": 3, "lamp": 4, "sign": 5, "fountain": 6, "bench": 7, "urn": 8, "planter": 9, "books": 10, "scope": 11, "crystal": 12, "board": 13, "barrel": 14, "crate": 15}
PROPS = []
def along(pts, step, off=0, side=1, gap=20):
    """沿著路每隔 step 放一個點（路的一側，離路中心 gap）"""
    res, acc = [], -off
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0); nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        while acc + step <= L: acc += step; t = acc / L; res.append((x0 + (x1 - x0) * t + nx * gap * side, y0 + (y1 - y0) * t + ny * gap * side))
        acc -= L
    return res
# 路燈：中軸線兩側每 90 一盞；去學院的路一側每 110 一盞
for side in (-1, 1):
    for pts, w in roads[:2]:
        for x, y in along(pts, 80, 30, side, 26): PROPS.append(("lamp", x, y))
for pts, w in [roads[2], roads[6]]:
    for x, y in along(pts, 120, 50, 1, 20): PROPS.append(("lamp", x, y))
# 廣場：四張長椅圍著井、布告欄、兩座共鳴水晶、花盆
for dx in (-1, 1):
    PROPS += [("bench", WELL_C[0] + dx * 120, WELL_C[1] - 30), ("bench", WELL_C[0] + dx * 100, WELL_C[1] + 60), ("crystal", WELL_C[0] + dx * 160, WELL_C[1] + 20)]
PROPS += [("board", WELL_C[0] - 175, WELL_C[1] + 70), ("urn", WELL_C[0] + 175, WELL_C[1] + 70)]
# 圖書館：樓梯兩邊花台、門口一疊書；上層台地沿著崖一排樹籬（樹叢），中間留階梯
L_ = BB["library"]; PROPS += [("planter", CX - 60, 340), ("planter", CX + 60, 340), ("books", CX + 92, 336)]
def hedge(fy, x0, x1, skip):
    x, j = x0, 0
    while x < x1:
        n = 3 + (j * 7) % 3                                                  # 一段 3～5 叢
        for _ in range(n):
            if x < x1 and not any(a - 18 < x < b + 18 for a, b in skip): PROPS.append(("bush", x, fy(x) - 6))
            x += 32
        if x < x1 and not any(a - 24 < x < b + 24 for a, b in skip): PROPS.append((["tree_s", "urn", "tree"][j % 3], x + 6, fy(x) - 10))
        x += 44; j += 1
hedge(UP, int(xu.min()) + 30, int(xu.max()) - 20, STAIR_UP)
# 瞭望台：望遠鏡＋兩張長椅（看雲海）；圖書館後面一排松樹（背景）
PROPS += [("scope", 470, 318), ("bench", 430, 360), ("bench", 520, 360)]
for gx, gy in [(400, 170), (560, 120), (880, 120), (1060, 180), (1160, 260)]:          # 圖書館後面幾叢松樹（一叢一叢，不是一排）
    for dx, dy in [(0, 0), (36, 12), (-30, 18), (12, 40)]: PROPS.append(("pine", gx + dx, gy + dy))
# 每棟建築門口：左右各一個花台／花盆
for b in buildings:
    if b["art"] == "library": continue
    pot = "planter" if b["art"] in ("forest", "fire", "water", "thunder", "ice") else "urn"
    for dx in (-1, 1): PROPS.append((pot, b["door"][0] + dx * min(34, b["w"] // 2 - 12), b["door"][1] - 4, "free"))
# 翠森苑後面一片樹林
f = BB["forest"]
for j, (dx, dy) in enumerate([(-90, -10), (-50, -40), (0, -60), (50, -44), (100, -20), (-110, 40), (130, 30), (-20, -90)]):
    PROPS.append((["tree", "pine", "tree_s"][j % 3], f["x"] + f["w"] // 2 + dx, f["y"] + 30 + dy))
# 中層：去星芽花園的路口立路牌，路兩旁一排小樹（往花園的林蔭道）
PROPS.append(("sign", 190, 680))
for x in range(110, 300, 50): PROPS += [("tree_s", x, 678), ("tree_s", x, 738)]
# 下層台地的崖上一排樹籬（中間留階梯）
hedge(LOW, 210, 1240, STAIR_LOW)
# 港口：卸貨的木箱木桶、商店門口的貨、路牌
PROPS += [("crate", 1200, 1050), ("crate", 1220, 1030), ("barrel", 1180, 1060), ("crate", 500, 1100), ("barrel", 480, 1104), ("sign", CX + 40, 1080)]
# 港口廣場南邊：看雲海的觀景台（長椅＋望遠鏡），不是死路
PROPS += [("bench", CX - 40, 1110), ("bench", CX + 40, 1110), ("scope", CX, 1130)]
for dx in (-1, 1): PROPS.append(("bench", HARBOR[0] + dx * 90, HARBOR[1] + 10))
# 溫室旁：一排果樹
g = BB["greenhouse"]
for j in range(3): PROPS.append(("tree_s", g["x"] + g["w"] + 26, g["y"] + 70 + j * 40))
# 宿舍：後院兩棵樹＋長椅
d = BB["dorm"]; PROPS += [("tree", d["x"] - 30, d["y"] + 70), ("bench", d["x"] - 40, d["door"][1] + 4)]
# 鐘塔：旁邊一排松樹
k = BB["clock"]
for j in range(3): PROPS.append(("pine", k["x"] + k["w"] + 30, k["y"] + 60 + j * 50))

# 學院周圍的特色（地面換色在後面）
zones = []
for name, rx, ry in [("fire", 110, 100), ("ice", 150, 95), ("thunder", 130, 110), ("forest", 170, 110), ("water", 160, 95)]:
    b = BB[name]; zones.append({"kind": name, "x": b["x"] + b["w"] / 2, "y": b["y"] + b["h"] * 0.7, "rx": rx, "ry": ry})
THEME = {"ice": [("crystal", "L", 22, 6), ("crystal", "R", 22, 6), ("crystal", "L", 50, 50), ("crystal", "R", 46, 56)],
         "thunder": [("crystal", "L", 24, 8), ("crystal", "R", 24, 8)], "forest": [("bush", "L", 16, -2), ("bush", "R", 20, -4)]}
for z in zones:
    b = BB[z["kind"]]
    for name, side, o, up in THEME.get(z["kind"], []): PROPS.insert(0, (name, b["x"] - o if side == "L" else b["x"] + b["w"] + o, b["y"] + b["h"] - up))

# ── 7. 能走的格子（8 像素一格）：島、台地的崖（只有階梯能過）、水道（只有橋能過） ──
walk = island.copy()
walk &= ~(ndimage.binary_erosion(~island, iterations=1) | (rim))
for arr_, gaps in [(UPa, [STAIR_UP[0]]), (LOWa, [STAIR_LOW[0]])]:
    band = (yy > arr_[None, :] - 6) & (yy < arr_[None, :] + 20)
    ok = np.zeros_like(band)
    for a, b in gaps: ok |= (xx >= a + 3) & (xx < b - 3)
    walk &= ~(band & ~ok)
walk &= ~(canal & ~bridge)
walk &= ~ell(WELL_C[0], WELL_C[1] - 6, 66 * 0.72, 36 * 0.8)
ws = xx > 60; walk |= (road & island & ~(canal & ~bridge) & ws)        # 路一定能走（除了水道沒橋的地方）
# 碼頭棧橋接到島
walk |= (xx >= DOCK_AT[0] + 30) & (xx <= DOCK_AT[0] + 99) & (yy >= DOCK_AT[1] + 76) & (yy <= DOCK_AT[1] + 102)
walk |= (xx >= 1180) & (xx <= DOCK_AT[0] + 40) & (yy >= DOCK_AT[1] + 80) & (yy <= DOCK_AT[1] + 100)   # 港口的路接到棧橋

# ── 8. 小物件擺放檢查：腳底不能在路上、建築本體、水裡、崖上 ──
feet, props = [], []
def in_body(fx, fy): return any(b["x"] + 4 < fx < b["x"] + b["w"] - 4 and b["y"] + b["h"] * 0.35 < fy < b["y"] + b["h"] + 2 for b in buildings)
for entry in PROPS:
    name, fx, fy = entry[:3]; free = len(entry) > 3; fx, fy = int(fx), int(fy)
    im = Image.open(P / f"props-{NAMES[name]}.png"); x, y = fx - im.width // 2, fy - im.height
    if not (0 <= fx < MW and 0 <= fy < MH) or not island[fy, fx]: continue
    hw = 3 if name == "lamp" else max(4, im.width // 3)
    if (road | canal)[max(0, fy - 3):fy + 2, max(0, fx - hw):fx + hw].any(): continue
    if plaza[fy, fx] and name not in ("bench", "crystal", "board", "planter", "books", "urn"): continue
    if not free and in_body(fx, fy): continue
    if any(abs(fx - p[0]) < (p[2] + im.width) / 3 and abs(fy - p[1]) < 10 for p in feet): continue
    props.append({"art": name, "x": x, "y": y, "w": im.width, "h": im.height}); feet.append((fx, fy, im.width))
for name, i in NAMES.items(): Image.open(P / f"props-{i}.png").save(OUT / f"{name}.png")

# 小草（到處）、小花（只在花帶：建築門口、廣場邊、瞭望台）
beds = [(b["door"][0], b["door"][1] + 26, 46, 12) for b in buildings] + [(WELL_C[0], WELL_C[1] + 150, 120, 14), (470, 380, 60, 10)]
for i in range(12000):
    if i % 3 == 0:
        bx, by, brx, bry = beds[(i // 3) % len(beds)]
        s = rnd.choice(flowers); x, y = int(bx + rnd.uniform(-brx, brx)), int(by + rnd.uniform(-bry, bry))
    else:
        s = rnd.choice(tufts); x, y = rnd.randrange(0, MW - 30), rnd.randrange(0, MH - 30)
    if x < 0 or y < 0 or x + s.width >= MW or y + s.height >= MH: continue
    reg = (road | plaza | canal)[y:y + s.height, x:x + s.width]
    if not island[y, x] or not island[y + s.height - 1, x + s.width - 1] or reg.any(): continue
    out.alpha_composite(s, (x, y))

# 地面換色（學院周圍）＋草地調柔和
A = np.array(out).astype(float)
TH = {"fire": [(122, 46, 34), (196, 92, 44), (236, 150, 62), (250, 204, 110)], "ice": [(150, 176, 214), (198, 222, 240), (232, 244, 252), (252, 254, 255)],
      "thunder": [(70, 56, 120), (112, 92, 176), (150, 128, 214), (196, 178, 240)], "forest": [(28, 82, 40), (44, 120, 52), (78, 160, 60), (128, 196, 84)],
      "water": [(40, 120, 110), (70, 168, 140), (110, 206, 160), (170, 232, 190)]}
noise = ndimage.gaussian_filter(np.random.RandomState(3).rand(MH, MW), 7); noise = (noise - noise.min()) / (noise.max() - noise.min())   # 低頻雜訊：邊緣是一團一團的，不是噴漆
green = (A[..., 1] > A[..., 0] + 12) & (A[..., 1] > A[..., 2] + 12) & ~road & ~plaza
lum = (0.3 * A[..., 0] + 0.59 * A[..., 1] + 0.11 * A[..., 2]) / 255
zmask = np.zeros((MH, MW), bool)
for z in zones:
    dz = np.sqrt(((xx - z["x"]) / z["rx"]) ** 2 + ((yy - z["y"]) / z["ry"]) ** 2)
    m = green & (dz < 1.05 - noise * 0.45); zmask |= m
    ramp = np.array(TH[z["kind"]], float); idx = np.clip(((lum - 0.25) / 0.55 * 4).astype(int), 0, 3); A[m, :3] = ramp[idx[m]]
gm = (A[..., 1] > A[..., 0] + 12) & (A[..., 1] > A[..., 2] + 12) & ~zmask
lm = (0.3 * A[..., 0] + 0.59 * A[..., 1] + 0.11 * A[..., 2])[..., None]
A[gm, :3] = ((lm + (A[..., :3] - lm) * 0.6) * np.array([0.94, 0.95, 0.9]))[gm]
out = Image.fromarray(A.astype(np.uint8))

# 雲：島邊一圈（北邊在島後面、南邊蓋在島前面）＋天空幾朵
def big_clouds():
    bk = np.array(Image.open(D.parent.parent / "assets" / "battle" / "garden" / "back.png").convert("RGBA")).astype(int)
    h, w = bk.shape[:2]; key = (bk[..., 0] << 16) | (bk[..., 1] << 8) | bk[..., 2]
    band = np.array([np.unique(key[y])[np.bincount(np.unique(key[y], return_inverse=True)[1]).argmax()] for y in range(h)])
    notsky = key != band[:, None]; notsky[140:] = False
    mx, mn = bk[..., :3].max(-1), bk[..., :3].min(-1); cloudish = (mx > 200) & (mx - mn < 90) & (bk[..., 1] >= bk[..., 0] - 12)
    lab, n = ndimage.label(notsky); res = []
    for k_, sl in enumerate(ndimage.find_objects(lab), 1):
        mm = lab[sl] == k_
        if mm.sum() < 50 or (cloudish[sl] & mm).sum() / mm.sum() < 0.9 or sl[1].start == 0 or sl[1].stop >= w: continue
        piece = bk[sl].copy().astype(np.uint8); piece[~mm] = 0
        im = Image.fromarray(piece); res.append(im.resize((im.width * 2, im.height * 2), Image.NEAREST))
    return res
cl = big_clouds()
sky = Image.new("RGBA", (MW, MH), (*SKY, 255))
for i in range(22):
    c = rnd.choice(cl); x, y = rnd.randrange(0, MW - 20), rnd.randrange(0, MH - 10)
    if not island[min(MH - 1, y + c.height // 2), min(MW - 1, x + c.width // 2)]: sky.alpha_composite(c, (x, y))
front = []
edge_pts = np.argwhere(island & ~ndimage.binary_erosion(island, iterations=1))
order = np.argsort(np.arctan2(edge_pts[:, 0] - 640, edge_pts[:, 1] - CX)); edge_pts = edge_pts[order]
for i in range(0, len(edge_pts), max(1, len(edge_pts) // 80)):
    yv, xv = edge_pts[i]; c = cl[i % len(cl)]
    x, y = int(xv - c.width / 2 + rnd.uniform(-8, 8)), int(yv - c.height * 0.5 + rnd.uniform(-4, 8))
    if yv > 640: front.append((c, x, y))
    else: sky.alpha_composite(c, (max(0, x), max(0, y)))
arr = np.array(out); cm = (arr[..., :3] != np.array(SKY)).any(-1)
layer = out.copy(); layer.putalpha(Image.fromarray((cm * 255).astype(np.uint8))); sky.alpha_composite(layer)
sky.convert("RGB").save(OUT / "ground.png")
fc = Image.new("RGBA", (MW, MH))
for c, x, y in front: fc.alpha_composite(c, (max(0, min(MW - c.width, x)), max(0, min(MH - c.height, y))))
fc.save(OUT / "clouds-front.png")
Image.open(HERE / ART / "well.png").save(OUT / "well.png")
Image.open(HERE / ART / "dock.png").save(OUT / "dock.png")

# 書頁、寶箱藏的地方（有理由：都是「走過去才看得到」的角落）
f, k_, d, g = BB["forest"], BB["clock"], BB["dorm"], BB["greenhouse"]
PAGE_SPOTS = [(f["x"] + 10, f["y"] + f["h"] + 34), (k_["x"] + k_["w"] + 60, k_["y"] + 120), (470, 300), (CX - 160, 170), (POND_C[0] - 80, POND_C[1] - 30),
              (d["x"] - 60, d["y"] + 40), (CX + 120, 1140), (1000, 700), (200, 760), (1260, 780)]
CHEST_SPOTS = [(f["x"] + f["w"] + 30, f["y"] + 20), (k_["x"] - 40, k_["y"] + 150), (300, 1000)]
def nearest_walk(x, y):
    for r_ in range(0, 80, 4):
        for dx in range(-r_, r_ + 1, 4):
            for dy in (-r_, r_) if abs(dx) != r_ else range(-r_, r_ + 1, 4):
                X, Y = int(x + dx), int(y + dy)
                if 0 <= X < MW and 0 <= Y < MH and walk[Y, X] and walk[Y, max(0, X - 8)] and walk[Y, min(MW - 1, X + 8)] and not (road | plaza)[Y, X]: return [X, Y]
    return [int(x), int(y)]
PAGE_SPOTS = [nearest_walk(*p) for p in PAGE_SPOTS]; CHEST_SPOTS = [nearest_walk(*p) for p in CHEST_SPOTS]
# 能走的格子存成字串（一列一個字串，1＝能走）
CELL = 4
wg = walk[::CELL, ::CELL]
json.dump({
    "version": 5, "size": [MW, MH], "cell": CELL, "walk": ["".join("1" if v else "0" for v in row) for row in wg],
    "objects": {"well": {"at": WELL_AT, "size": [157, 142]}, "dock": {"at": DOCK_AT, "size": [170, 139]}},
    "buildings": buildings, "props": props, "zones": zones,
    "pageSpots": PAGE_SPOTS, "chestSpots": CHEST_SPOTS,
    "start": [DOCK_AT[0] + 70, DOCK_AT[1] + 90], "toGarden": [86, 700], "arriveGarden": [130, 700],
}, open(OUT / "layout.json", "w"))
print(ART, "ok", len(buildings), "buildings", len(props), "props")
