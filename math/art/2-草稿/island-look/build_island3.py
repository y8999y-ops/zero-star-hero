"""學院島 v4（2026-11-25 使用者：「地圖還是太空」「島邊和天空接的地方太生硬，用一圈雲」「物件不要沒理由地隨機撒，每個物件出現都要有理由」）
  改成更緊的同心圓；島邊一圈雲；所有小物件都照規則放（見「小物件」那一段的說明）。
以下是 v3 的說明：
學院島 v3：同心圓（世界觀 3.0，使用者 2026-11-25：「不要這麼規整，要同心圓式，最重要的建築在中央往外擴散」）。
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
MW, MH = 1340, 1240
C = (670, 610)                        # 同心圓的中心
R1 = (272, 296)                       # 第一圈環狀路（半寬、半高）
R2 = (512, 488)                       # 第二圈
ISL = (C[0], C[1], R2[0] + 64, R2[1] + 56)   # 島：橢圓（中心、半徑），剛好包住第二圈
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
# 五座學院：北邊兩座、東西兩座在第一圈外面（用短路接回第一圈），赤焰塔在正南（門朝第二圈）
ACAD = {"forest": (C[0] - 372, C[1] - 192), "thunder": (C[0] + 378, C[1] - 192), "water": (C[0] - 392, C[1] + 88), "ice": (C[0] + 394, C[1] + 88)}
BUILD += [("forest", "academy-forest", *ACAD["forest"], 0.46), ("thunder", "academy-thunder", *ACAD["thunder"], 0.5),
          ("water", "academy-water", *ACAD["water"], 0.5), ("ice", "academy-ice", *ACAD["ice"], 0.5),
          ("fire", "academy-fire", C[0], C[1] + R2[1], 0.5)]
for name, f, ang in [("dorm", "dorm", 130), ("shop", "shop", 112), ("greenhouse", "greenhouse", 68), ("clock", "clocktower", 50)]:
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
for k, side in [("forest", -1), ("thunder", 1), ("water", -1), ("ice", 1)]:
    fx, fy = ACAD[k]; road |= spur((fx, fy + 14), (ring_x(*R1, fy + 14, side), fy + 14))
# 放射路：中心廣場往南接到第一圈；東、西從第一圈往外接到碼頭、花園門
EW_Y = C[1] + 150
road |= spur((C[0], WELL_C[1] + 40), (C[0], C[1] + R1[1]))
road |= spur((C[0], C[1] - R1[1]), (C[0], C[1] - R2[1]))           # 北邊：第一圈往北接第二圈（北花園）
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

# 雲：島的邊緣圍一圈雲（北半圈的雲在島後面、南半圈的雲蓋在斷崖前面），天空也飄幾朵
#    雲的圖：星芽花園戰鬥背景（已通過）裡的白雲，剪下一朵一朵，放大 2 倍（地圖的像素比戰鬥細一倍）
def big_clouds():
    # 跟遊戲裡拆戰鬥背景的方法一樣（areaart.js splitBack）：每一列最多的顏色＝天空色；不是天空色的一塊一塊，
    # 九成以上是雲色（白、淡藍）的那塊才算雲
    bk = np.array(Image.open(D.parent.parent / "assets" / "battle" / "garden" / "back.png").convert("RGBA")).astype(int)
    h, w = bk.shape[:2]; key = (bk[..., 0] << 16) | (bk[..., 1] << 8) | bk[..., 2]
    band = np.array([np.bincount(np.unique(key[y], return_inverse=True)[1]).argmax() for y in range(h)])
    band = np.array([np.unique(key[y])[band[y]] for y in range(h)])
    notsky = key != band[:, None]; notsky[140:] = False
    mx, mn = bk[..., :3].max(-1), bk[..., :3].min(-1)
    cloudish = (mx > 200) & (mx - mn < 90) & (bk[..., 1] >= bk[..., 0] - 12)
    lab, n = ndimage.label(notsky); res = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        mm = lab[sl] == k
        if mm.sum() < 50 or (cloudish[sl] & mm).sum() / mm.sum() < 0.9 or sl[1].start == 0 or sl[1].stop >= w: continue
        piece = bk[sl].copy().astype(np.uint8); piece[~mm] = 0
        im = Image.fromarray(piece); res.append(im.resize((im.width * 2, im.height * 2), Image.NEAREST))
    return res
cl = big_clouds()
behind, front = [], []
per = 2 * math.pi * math.sqrt((ISL[2] ** 2 + ISL[3] ** 2) / 2)
n_cl = int(per / 46)
for i in range(n_cl):
    a = 2 * math.pi * i / n_cl + rnd.uniform(-0.03, 0.03)
    c = cl[i % len(cl)] if i % 3 else max(cl, key=lambda q: q.width)
    k = rnd.uniform(1.0, 1.07)
    x = ISL[0] + math.cos(a) * ISL[2] * k - c.width / 2; y = ISL[1] + math.sin(a) * ISL[3] * k - c.height * 0.55
    (front if math.sin(a) > 0.15 else behind).append((c, int(x), int(y)))
sky = Image.new("RGBA", (MW, MH), (120, 200, 248, 255))
for i in range(26):                                                  # 天空裡零星飄的雲
    c = rnd.choice(cl); x, y = rnd.randrange(0, MW - 20), rnd.randrange(0, MH - 10)
    if not island[min(MH - 1, y + c.height // 2), min(MW - 1, x + c.width // 2)]: sky.alpha_composite(c, (x, y))
for c, x, y in behind: sky.alpha_composite(c, (max(0, x), max(0, y)))
# 島（含斷崖）這一層：不是天空色的地方
arr = np.array(out); cm = (arr[..., :3] != np.array([120, 200, 248])).any(-1) | island
isl_layer = out.copy(); isl_layer.putalpha(Image.fromarray((cm * 255).astype(np.uint8)))
sky.alpha_composite(isl_layer)
FRONT_CLOUDS = front
out = sky

WELL_AT = (WELL_C[0] - 81, WELL_C[1] - 103)
blocked.append((WELL_AT[0], WELL_AT[1], WELL_AT[0] + 157, WELL_AT[1] + 142))
DOCK_AT = (ISL[0] + ISL[2] - 52, EW_Y - 90)
blocked.append((DOCK_AT[0] - 10, DOCK_AT[1], MW, DOCK_AT[1] + 139))

P = D / "props-look" / SPLIT
NAMES = {"tree": 0, "pine": 1, "tree_s": 2, "bush": 3, "lamp": 4, "sign": 5, "fountain": 6, "bench": 7, "urn": 8, "planter": 9, "books": 10, "scope": 11, "crystal": 12, "board": 13, "barrel": 14, "crate": 15}
# ── 小物件：每一個都有理由（使用者 2026-11-25） ──
#   廣場：四張長椅圍著井；圖書館樓梯兩邊花台；布告欄在廣場西南；兩座「共鳴水晶」夾著井
#   路燈：兩圈環狀路，每隔一樣的角度一盞（遇到建築、路就跳過）
#   每棟建築門口：左右各一個花台／花盆（學院用花台、生活設施用花盆）
#   路口：東西放射路出第二圈的地方立路牌
#   北花園：北邊放射路兩旁，兩個花圃（樹叢圍一圈、中間花盆）
#   樹：翠森苑後面一片樹林、溫室旁一排果樹、宿舍後院兩棵樹、鐘塔旁一排松樹
#   木箱、木桶：商店旁（剛到的貨）、碼頭旁（卸貨）
BBx = {b["art"]: b for b in buildings}
PROPS = []
for dx in (-1, 1):
    PROPS += [("bench", WELL_C[0] + dx * 120, WELL_C[1] - 18), ("bench", WELL_C[0] + dx * 96, WELL_C[1] + 62)]
    PROPS += [("planter", LIB_FOOT[0] + dx * 50, LIB_FOOT[1] + 10), ("crystal", WELL_C[0] + dx * 150, WELL_C[1] + 30)]
PROPS += [("board", WELL_C[0] - 165, WELL_C[1] + 82), ("books", LIB_FOOT[0] + 78, LIB_FOOT[1] + 12)]
for (rx, ry), k, step, off in [(R1, 1.1, 24, 12), (R2, 0.94, 18, 9)]:
    for ang in range(0, 360, step):
        x, y = on_ring(rx * k, ry * k, ang + off); PROPS.append(("lamp", round(x), round(y)))
for b in buildings:
    if b["art"] == "library": continue
    pot = "planter" if b["art"] in ACAD or b["art"] == "fire" else "urn"
    for dx in (-1, 1): PROPS.append((pot, b["door"][0] + dx * min(34, b["w"] // 2 - 12), b["door"][1] - 4, "free"))
for side in (-1, 1): PROPS.append(("sign", round(ring_x(*R2, EW_Y, side) + side * 22), EW_Y - 16))
for dx in (-1, 1):                                                   # 北花園
    gx, gy = C[0] + dx * 70, C[1] - (R1[1] + R2[1]) / 2 + 10
    for a in range(0, 360, 45): PROPS.append(("bush", round(gx + math.cos(math.radians(a)) * 34), round(gy + math.sin(math.radians(a)) * 20)))
    PROPS.append(("urn", round(gx), round(gy + 6)))
f = BBx["forest"]                                                    # 翠森苑後面的樹林
for j, (dx, dy) in enumerate([(-60, -30), (-20, -50), (20, -44), (60, -34), (-80, 4), (90, -6), (-40, -76), (40, -72)]):
    PROPS.append((["tree", "pine", "tree_s"][j % 3], f["x"] + f["w"] // 2 + dx, f["y"] + 40 + dy))
g = BBx["greenhouse"]                                               # 溫室旁一排果樹
for j in range(4): PROPS.append(("tree_s", g["x"] + g["w"] + 22, g["y"] + 50 + j * 34))
d = BBx["dorm"]                                                      # 宿舍後院
PROPS += [("tree", d["x"] - 26, d["y"] + 60), ("bench", d["x"] - 40, d["door"][1] + 4)]   # 後院一棵樹＋長椅（另一棵會擋住門口的路，拿掉）
# 林蔭大道：往南（赤焰塔）的放射路兩旁一排小樹；北邊放射路兩旁一排樹叢（像樹籬）
for j in range(5):
    y = WELL_C[1] + 90 + j * 34
    if y < C[1] + R1[1] - 20: PROPS += [("tree_s", C[0] - 30, y), ("tree_s", C[0] + 30, y)]
for j in range(4):
    y = C[1] - R1[1] - 20 - j * 40
    PROPS += [("bush", C[0] - 22, y), ("bush", C[0] + 22, y)]
# 東西放射路（往碼頭、往花園）兩旁每隔一段一棵樹
for side in (-1, 1):
    x0 = ring_x(*R1, EW_Y, side); x1 = ring_x(*R2, EW_Y, side)
    for j in range(1, 4):
        x = x0 + (x1 - x0) * j / 4
        PROPS += [("tree_s", round(x), EW_Y - 18), ("tree_s", round(x), EW_Y + 38)]
k_ = BBx["clock"]                                                    # 鐘塔旁的松樹
for j in range(3): PROPS.append(("pine", k_["x"] + k_["w"] + 26, k_["y"] + 40 + j * 46))
s_ = BBx["shop"]
PROPS += [("crate", s_["x"] - 18, s_["door"][1] + 2), ("crate", s_["x"] - 18, s_["door"][1] - 20), ("barrel", s_["x"] - 40, s_["door"][1] + 2)]
PROPS += [("crate", DOCK_AT[0] - 30, EW_Y + 40), ("barrel", DOCK_AT[0] - 52, EW_Y + 44), ("crate", DOCK_AT[0] - 30, EW_Y - 22)]
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
    "forest": [("bush", "L", 16, -2), ("bush", "R", 20, -4)],
    "water": [],          # 旁邊有練習池＋噴泉特效（遊戲裡畫）
    "thunder": [("crystal", "L", 24, 8), ("crystal", "R", 24, 8), ("scope", "L", 60, 50)],
    "fire": [],           # 兩座火盆特效（遊戲裡畫）
}
for z in zones:
    b = BB[z["kind"]]
    for name, side, out_, up in THEME_PROPS[z["kind"]]:
        x = b["x"] - out_ if side == "L" else b["x"] + b["w"] + out_
        PROPS.insert(0, (name, round(x), round(b["y"] + b["h"] - up)))
# 蒼流館旁邊一個水池（斷崖地磚表裡的水池）
pond = E.crop((0, 113, 110, 222)).convert("RGBA")
wb = BB["water"]; POND_AT = (wb["x"] + 6, wb["y"] - 92)
blocked.append((POND_AT[0], POND_AT[1], POND_AT[0] + pond.width, POND_AT[1] + pond.height))

props = []
def overlaps(b): return any(not (b[2] < a[0] or b[0] > a[2] or b[3] < a[1] or b[1] > a[3]) for a in blocked)
# 放的規則：腳底不能踩在路上、不能在建築本體裡（建築後面可以，會被建築擋住一部分）、不能疊在別的東西的腳底上
feet = []
def in_body(fx, fy):
    return any(b["x"] + 4 < fx < b["x"] + b["w"] - 4 and b["y"] + b["h"] * 0.35 < fy < b["y"] + b["h"] + 2 for b in buildings)
SOLID = [blocked_box for blocked_box in blocked if blocked_box[2] - blocked_box[0] < 200 and blocked_box not in [(b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]) for b in buildings]]
for entry in PROPS:
    name, fx, fy = entry[:3]; free = len(entry) > 3
    fx, fy = int(fx), int(fy)
    im = Image.open(P / f"props-{NAMES[name]}.png")
    x, y = fx - im.width // 2, fy - im.height
    if not (0 <= fx < MW and 0 <= fy < MH) or not island[fy, fx]: continue
    halfw = 3 if name == "lamp" else max(4, im.width // 3)
    if road[max(0, fy - 3):fy + 2, max(0, fx - halfw):fx + halfw].any() or plaza[fy, fx] and name not in ("bench", "crystal", "board", "planter", "books"): continue
    if not free and in_body(fx, fy): continue
    if any(a[0] < fx < a[2] and a[1] < fy < a[3] for a in SOLID): continue          # 井、碼頭、水池
    if any(abs(fx - p[0]) < (p[2] + im.width) / 3 and abs(fy - p[1]) < 10 for p in feet): continue
    props.append({"art": name, "x": x, "y": y, "w": im.width, "h": im.height}); feet.append((fx, fy, im.width))
for name, i in NAMES.items(): Image.open(P / f"props-{i}.png").save(OUT / f"{name}.png")

# 小草小花（避開路、建築、物件）
# 小草到處都有；小花只長在花圃和建築門口的花帶（有理由的地方）
beds = [(C[0] + dx * 70, C[1] - (R1[1] + R2[1]) / 2 + 10, 30, 16) for dx in (-1, 1)] + [(b["door"][0], b["door"][1] + 26, 46, 12) for b in buildings]
for i in range(9000):
    if i % 3 == 0:
        bx, by, brx, bry = beds[(i // 3) % len(beds)]
        s = rnd.choice(flowers); x, y = int(bx + rnd.uniform(-brx, brx)), int(by + rnd.uniform(-bry, bry))
        if ((x - bx) / brx) ** 2 + ((y - by) / bry) ** 2 > 1 or x < 0 or y < 0 or x + s.width >= MW or y + s.height >= MH: continue
    else:
        s = rnd.choice(tufts); x, y = rnd.randrange(0, MW - s.width), rnd.randrange(0, MH - s.height)
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
A = A  # 學院周圍換色完
tmp = Image.fromarray(A.astype(np.uint8)); tmp.alpha_composite(pond, POND_AT); A = np.array(tmp).astype(float)   # 水池（它自己的草也一起調柔和）
# 草地顏色調柔和（使用者 2026-11-25 覺得地圖很醜：原本的萊姆綠太亮太飽和）：彩度降到 6 成、亮度降一點，學院周圍換過色的不動
gm = (A[..., 1] > A[..., 0] + 12) & (A[..., 1] > A[..., 2] + 12)
for z in zones:
    gm &= np.sqrt(((xx - z["x"]) / z["rx"]) ** 2 + ((yy - z["y"]) / z["ry"]) ** 2) >= 1
lm = (0.3 * A[..., 0] + 0.59 * A[..., 1] + 0.11 * A[..., 2])[..., None]
A[gm, :3] = ((lm + (A[..., :3] - lm) * 0.6) * np.array([0.94, 0.95, 0.9]))[gm]
out = Image.fromarray(A.astype(np.uint8))
out.convert("RGB").save(OUT / "ground.png")
# 南邊蓋在斷崖前面的雲：另外一張圖（遊戲裡畫在最上層，看起來島浮在雲上）
fc = Image.new("RGBA", (MW, MH))
for c, x, y in FRONT_CLOUDS: fc.alpha_composite(c, (max(0, x), max(0, min(MH - c.height, y))))
fc.save(OUT / "clouds-front.png")
Image.open(HERE / ART / "well.png").save(OUT / "well.png")
Image.open(HERE / ART / "dock.png").save(OUT / "dock.png")
json.dump({
    "size": [MW, MH], "center": C, "island": ISL, "r1": R1, "r2": R2, "ewY": EW_Y,
    "objects": {"well": {"at": WELL_AT, "size": [157, 142]}, "dock": {"at": DOCK_AT, "size": [170, 139]}},
    "buildings": buildings, "props": props, "zones": zones, "pond": {"at": POND_AT, "size": list(pond.size)},
}, open(OUT / "layout.json", "w"), indent=1)
print(ART, "ok", len(buildings), "buildings", len(props), "props")
