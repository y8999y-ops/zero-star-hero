# 城鎮白天目標圖：用現有素材照「Ori 的層次」重新合成（遠處淡、層間有霧、前景暗、角色最清楚）
import sys, math
import numpy as np
from PIL import Image

ART, SPR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
H, FLOOR = 216, 184

def load(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float32)

def cell(sheet, i, cw):
    return sheet[:, i * cw:(i + 1) * cw]

def base_row(img):
    ys = np.where(img[..., 3].max(axis=1) > 0)[0]
    return int(ys[-1]) if len(ys) else img.shape[0] - 1

def paste(dst, img, x0, y0):
    h, w = img.shape[:2]
    xa, ya = max(0, x0), max(0, y0)
    xb, yb = min(dst.shape[1], x0 + w), min(dst.shape[0], y0 + h)
    if xa >= xb or ya >= yb: return
    src = img[ya - y0:yb - y0, xa - x0:xb - x0]
    a = src[..., 3:4] / 255
    d = dst[ya:yb, xa:xb]
    d[..., :3] = d[..., :3] * (1 - a) + src[..., :3] * a
    d[..., 3:4] = np.maximum(d[..., 3:4], src[..., 3:4])

A = {n: load(f"{ART}/town/{n}.png") for n in ["far", "mid", "ground", "fg", "guild", "workshop", "inn"]}
DECO, FLOW, GRASS = load(f"{ART}/props/town-deco.png"), load(f"{ART}/props/flowers.png"), load(f"{ART}/props/grass.png")
S = {n: load(f"{SPR}/{n}.png") for n in ["star", "npc-clerk", "npc-golem", "npc-mushroom", "npc-kid", "npc-turtle", "npc-pebble", "npc-shroom"]}
ORIGIN = {"star": (25, 34), "npc-clerk": (40, 56), "npc-golem": (48, 64), "npc-mushroom": (40, 64), "npc-kid": (40, 56), "npc-turtle": (36, 46), "npc-pebble": (48, 64), "npc-shroom": (40, 64)}

def build_main(L):
    TW = L["w"]
    M = np.zeros((H, TW, 4), np.float32)
    gt = A["ground"]
    for x in range(0, TW, gt.shape[1]):
        paste(M, gt, x, FLOOR - 9)
    last = gt[-1:, :, :]
    for y in range(FLOOR - 9 + gt.shape[0], H):
        for x in range(0, TW, gt.shape[1]):
            paste(M, last, x, y)
    for name, x0 in L["shops"]:
        paste(M, A[name], x0, FLOOR + 1 - base_row(A[name]))
    lamp = cell(DECO, 4, 48)
    for x in L["lamps"]:
        paste(M, lamp, x - 24, FLOOR + 1 - base_row(lamp))
    for k, cx in L["deco"]:
        d = cell(DECO, k, 48); paste(M, d, cx - 24, FLOOR + 1 - base_row(d))
    for k, cx in L["blooms"]:
        d = cell(FLOW, k, 32); paste(M, d, cx - 16, FLOOR + 1 - base_row(d))
    for k, cx in L["tufts"]:
        d = cell(GRASS, k, 24); paste(M, d, cx - 12, FLOOR + 1 - base_row(d))
    return M

OLD = dict(w=1000, shops=[("guild", 58), ("workshop", 344), ("inn", 620)], lamps=[42, 330, 560, 836],
           deco=[(0, 592), (1, 612), (6, 796), (7, 882), (2, 962), (2, 1002), (3, 924)],
           blooms=[(0, 20), (3, 334), (2, 548), (7, 788), (4, 862), (5, 912)],
           tufts=[(1, 10), (4, 48), (0, 322), (6, 352), (2, 540), (5, 600), (7, 640), (3, 776), (1, 846), (6, 906), (0, 940)],
           npcs=[("npc-clerk", 186, False), ("npc-kid", 215, False), ("npc-golem", 404, False), ("npc-pebble", 440, False), ("npc-turtle", 470, False), ("npc-mushroom", 752, True)])
NEW = dict(w=1240, shops=[("guild", 70), ("workshop", 450), ("inn", 800)], lamps=[388, 716],
           deco=[(0, 668), (6, 1000), (7, 1070), (3, 1150), (2, 1200)],
           blooms=[(0, 30), (3, 362), (7, 760), (4, 1040)],
           tufts=[(1, 16), (0, 340), (6, 412), (2, 690), (5, 742), (3, 980), (1, 1100)],
           npcs=[("npc-clerk", 198, False), ("npc-kid", 300, True), ("npc-golem", 510, False), ("npc-pebble", 566, True), ("npc-turtle", 612, False), ("npc-mushroom", 932, True)])

DAY_SKY = [(74, 138, 216), (104, 164, 228), (146, 194, 238), (190, 220, 242), (232, 226, 206)]
def ramp(st, f):
    k = max(0, min(len(st) - 1.001, f * (len(st) - 1))); i = int(k); t = k - i
    return np.array([st[i][j] + (st[i + 1][j] - st[i][j]) * t for j in range(3)], np.float32)

def lift(rgb, m=(1.32, 1.30, 1.10), a=(12, 11, 2)):
    return np.minimum(255, rgb * np.array(m, np.float32) + np.array(a, np.float32))
def desat(rgb, k):
    g = (rgb[..., 0:1] * 0.3 + rgb[..., 1:2] * 0.59 + rgb[..., 2:3] * 0.11)
    return rgb + (g - rgb) * k
def mix(rgb, col, k):
    return rgb + (np.array(col, np.float32) - rgb) * k

def sample(layer, ox, oy, vw, vh, wrap):
    """取出畫面看到的那一塊（wrap＝左右循環）"""
    h, w = layer.shape[:2]
    xs = (np.arange(vw) + ox)
    out = np.zeros((vh, vw, 4), np.float32)
    ys = np.arange(vh) + oy
    okY = (ys >= 0) & (ys < h)
    if wrap: xi = xs % w; okX = np.ones(vw, bool)
    else: okX = (xs >= 0) & (xs < w); xi = np.clip(xs, 0, w - 1)
    sub = layer[np.clip(ys, 0, h - 1)][:, xi]
    sub = sub * okY[:, None, None] * okX[None, :, None]
    return sub

def over(dst, src_rgb, alpha):
    return dst * (1 - alpha) + src_rgb * alpha

def clouds(vw, vh, ox, oy):
    """像素雲：一團一團的圓疊起來，底是平的，兩階顏色"""
    rng = np.random.RandomState(7)
    W = 900
    a = np.zeros((H, W), np.float32); hi = np.zeros((H, W), np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    for c in range(9):
        cx, cy, n = rng.randint(0, W), rng.randint(18, 78), rng.randint(4, 8)
        for i in range(n):
            x = cx + (i - n / 2) * rng.randint(9, 15); r = rng.randint(6, 14) * (1 - abs(i - n / 2) / n)
            y = cy - r * 0.5
            m = ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) & (yy <= cy)
            a[m] = 1
            m2 = ((xx - x + 1.5) ** 2 + (yy - y + 2) ** 2 <= (r * 0.72) ** 2) & (yy <= cy - 2)
            hi[m2] = 1
    lay = np.zeros((H, W, 4), np.float32)
    lay[..., :3] = np.where(hi[..., None] > 0, np.array([255, 253, 246], np.float32), np.array([226, 234, 246], np.float32))
    lay[..., 3] = a * 255
    return sample(lay, ox, oy, vw, vh, True)

def sprite_draw(img, name, x, y, flip, ox, oy, new):
    sp = S[name].copy()
    ax, ay = ORIGIN[name]
    if flip: sp = sp[:, ::-1]; ax = sp.shape[1] - 1 - ax
    a = sp[..., 3] > 140
    sp[..., 3] = np.where(a, 255, sp[..., 3] * (0 if new else 1))
    rgb = sp[..., :3]
    if new:
        # 邊緣光：左上方向沒有東西的邊，往暖白提亮（太陽在左上）
        up = np.zeros_like(a); up[1:] = a[:-1]
        lf = np.zeros_like(a); lf[:, 1:] = a[:, :-1]
        edge = a & (~up | ~lf)
        dark = rgb.sum(axis=2) < 150   # 原本的深色外框不提亮
        rim = edge & ~dark
        rgb[rim] = mix(rgb[rim], (255, 248, 220), 0.45)
        # 深色外框：身體外面一圈（原本就有深框的地方不重複）
        pad = np.pad(a, 1)
        nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
        ring = nb & ~a
        padd = np.pad(dark & a, 1)
        nbd = padd[:-2, 1:-1] | padd[2:, 1:-1] | padd[1:-1, :-2] | padd[1:-1, 2:]
        ring &= ~nbd
        sp[ring] = (44, 30, 62, 255)
        sp[..., :3][a] = rgb[a]
    x0, y0 = x - ax - ox, y - ay - oy
    if new:   # 腳下的影子
        sw = int(a.any(axis=0).sum() * 0.42)
        for dx in range(-sw, sw + 1):
            for dy in range(0, 3):
                if (dx / max(1, sw)) ** 2 + ((dy - 1) / 1.6) ** 2 <= 1:
                    X, Y = x - ox + dx, y - oy + 1 + dy
                    if 0 <= X < img.shape[1] and 0 <= Y < img.shape[0]: img[Y, X] = img[Y, X] * 0.7 + np.array([14, 20, 34], np.float32) * 0.3
    tmp = np.zeros((img.shape[0], img.shape[1], 4), np.float32); tmp[..., :3] = img
    paste(tmp, sp, x0, y0)
    img[:] = tmp[..., :3]

def render(L, cx, cy, vw, vh, new, hero_x, name):
    M = build_main(L)
    img = np.zeros((vh, vw, 3), np.float32)
    wy = np.arange(vh) + cy
    # ---- 天空
    for y in range(vh):
        f = max(0, wy[y]) / (H * 0.62)
        img[y] = ramp(DAY_SKY, f)
    if new:
        zen, hor = np.array([92, 156, 226], np.float32), np.array([244, 240, 226], np.float32)
        for y in range(vh):
            f = min(1, max(0, wy[y]) / 150) ** 1.4
            img[y] = zen + (hor - zen) * f
        yy, xx = np.mgrid[0:vh, 0:vw]
        d = np.hypot(xx - vw * 0.16, (yy + cy) + 10) / 190    # 左上的太陽光暈（分階）
        g = np.clip(1 - d, 0, 1) ** 1.5
        img += g[..., None] * np.array([70, 58, 20], np.float32) * 0.5
        c = clouds(vw, vh, int(cx * 0.05), cy)
        img = over(img, c[..., :3], c[..., 3:4] / 255 * 0.9)
    # ---- 遠景
    far = sample(A["far"], int(cx * 0.12), cy, vw, vh, True)
    fr = lift(far[..., :3])
    if new:
        warm = ((far[..., 0] > far[..., 2] * 1.25) & (far[..., 0] > 150))[..., None]   # 墜落的大星星、金色水晶：留一點暖色，不要洗白
        fr = np.where(warm, mix(desat(fr, 0.15), (250, 236, 200), 0.42), mix(desat(fr, 0.35), (206, 222, 244), 0.66))
    img = over(img, fr, far[..., 3:4] / 255)
    if new:   # 遠景和中景之間的霧（分三階）
        for y in range(vh):
            k = np.clip((wy[y] - 96) / 70, 0, 1); k = math.floor(k * 4) / 4 * 0.5
            img[y] = mix(img[y], (236, 240, 244), k)
    # ---- 中景
    mid = sample(A["mid"], int(cx * 0.35), cy, vw, vh, True)
    mr = lift(mid[..., :3])
    if new: mr = mix(desat(mr, 0.25), (188, 208, 236), 0.42)
    img = over(img, mr, mid[..., 3:4] / 255)
    if new:   # 中景和街道之間的霧
        for y in range(vh):
            k = np.clip((wy[y] - 132) / 50, 0, 1); k = math.floor(k * 3) / 3 * 0.42
            img[y] = mix(img[y], (228, 236, 244), k)
        # 光束：從左上斜下來，硬邊
        yy, xx = np.mgrid[0:vh, 0:vw]
        u = (xx - (yy + cy) * 0.75)
        for (a, b, k) in [(60, 104, 0.07), (210, 262, 0.06)]:
            m = (u >= a) & (u < b)
            img[m] = np.minimum(255, img[m] + np.array([255, 244, 206], np.float32) * k)
    # ---- 街道與店
    mn = sample(M, cx, cy, vw, vh, False)
    r = mn[..., :3]
    if not new:
        r = lift(r)
    else:
        emit = ((r[..., 1] >= 170) & (r[..., 2] >= 200) & (r[..., 0] < 140)) | ((r[..., 0] >= 230) & (r[..., 1] >= 150) & (r[..., 2] < 130))
        base = lift(r, (1.2, 1.19, 1.08), (8, 8, 4))
        base = desat(base, 0.22)
        yy = (np.arange(vh) + cy)[:, None, None]
        sun = 1.06 - 0.16 * np.clip((yy - 20) / 164, 0, 1)        # 上面受光、越靠近地面越在陰影裡
        base = base * sun
        cool = np.clip((yy - 120) / 64, 0, 1) * 0.16                 # 陰影偏藍
        base = mix(base, (70, 86, 130), cool)
        grass = (yy >= FLOOR - 10) & (yy <= FLOOR + 4)
        gsel = grass & (base[..., 1:2] > base[..., 0:1] * 1.02) & (base[..., 1:2] > base[..., 2:3] * 1.25)
        gcol = mix(desat(base, 0.3), (86, 150, 74), 0.35) * 0.9       # 螢光綠 → 自然的草綠
        base = np.where(gsel, gcol, base)
        dirt = yy > FLOOR + 4
        base = np.where(dirt, base * 0.72 + np.array([10, 12, 26], np.float32) * 0.28, base)
        keep = emit[..., None] & (yy < FLOOR - 10)
        r = np.where(keep, np.minimum(255, lift(r, (1.1, 1.1, 1.0), (10, 10, 0))), base)
    img = over(img, r, mn[..., 3:4] / 255)
    # ---- 居民、主角
    for (n, x, flip) in L["npcs"]:
        sprite_draw(img, n, x, FLOOR - 1 + (1 if n != "star" else 0), flip, cx, cy, new)
    sprite_draw(img, "star", hero_x, FLOOR, False, cx, cy, new)
    # ---- 前景
    fgl = np.zeros((H, A["fg"].shape[1], 4), np.float32)
    lift_fg = 7 if not new else 2
    paste(fgl, A["fg"], 0, H - A["fg"].shape[0] - lift_fg)
    fg = sample(fgl, int(cx * 1.3), cy, vw, vh, True)
    fr = fg[..., :3]
    if new: fr = mix(fr * 0.55, (26, 40, 58), 0.72)
    img = over(img, fr, fg[..., 3:4] / 255)
    if new:   # 四角壓暗（分階）
        yy, xx = np.mgrid[0:vh, 0:vw]
        d = np.hypot((xx - vw / 2) / (vw / 2), (yy - vh / 2) / (vh / 2))
        v = 1 - 0.24 * np.clip((d - 0.85) / 0.55, 0, 1) ** 1.6
        img = img * v[..., None]
    K = 1152 // vw if vw <= 384 else 3
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((1152, int(1152 * vh / vw)), Image.NEAREST)
    im.save(f"{OUT}/{name}.png")
    return im

b = render(OLD, 150, 46, 278, 156, False, 300, "before-1")
a = render(NEW, 150, 0, 384, 216, True, 326, "after-1")
b2 = render(OLD, 560, 46, 278, 156, False, 700, "before-2")
a2 = render(NEW, 620, 0, 384, 216, True, 772, "after-2")
for i, (x, y) in enumerate([(b, a), (b2, a2)]):
    g = Image.new("RGB", (1152, x.height + y.height + 8), (20, 20, 20))
    g.paste(x, (0, 0)); g.paste(y, (0, x.height + 8))
    g.save(f"{OUT}/compare-{i + 1}.png")
print("ok")
