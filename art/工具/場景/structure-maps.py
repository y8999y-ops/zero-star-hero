"""建築的結構圖（scene-fx skill §4b）：雨水怎麼在建築上流、在哪裡滴。
每棟一張，跟原圖（art/3-已通過/town/<名稱>.png）一樣大，用固定的幾個顏色標出：
  屋頂面 ROOF      淋得到雨，水往下流（隨機蜿蜒）
  擋雨區 SHELTER   不會濕、水不經過（屋簷下、門洞、菌褶）
  繞開   AVOID     水碰到要繞過去（小屋頂窗、水晶、小香菇、窗框）
  導水線 GUIDE     水沿著它走（山牆的斜邊、拱門石框、木柱）
  滴水線 DRIP      水流到這裡就滴下去（屋簷邊、傘緣）
  滴水點 POINT     單獨會滴水的點（青苔尖、招牌下角）
  接水面 LAND      上面滴下來的水打在這裡（陽台欄杆、招牌頂）
用法：python art/工具/場景/structure-maps.py   → art/2-草稿/結構圖/<名稱>-structure.png 與 -preview.png（疊在原圖上）
結構是照每棟建築的樣子（位置＋顏色）一棟一棟寫的；換了建築的圖要回來改這裡。
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(ROOT, "art", "3-已通過", "town")
OUT = os.path.join(ROOT, "art", "2-草稿", "結構圖")

ROOF, SHELTER, AVOID, GUIDE, DRIP, POINT, LAND = 1, 2, 3, 4, 5, 6, 7
COL = {ROOF: (70, 140, 255), SHELTER: (110, 110, 120), AVOID: (255, 150, 40), GUIDE: (255, 230, 40),
       DRIP: (255, 40, 40), POINT: (255, 0, 255), LAND: (40, 230, 120)}
NAME = {ROOF: "屋頂面", SHELTER: "擋雨區", AVOID: "繞開", GUIDE: "導水線", DRIP: "滴水線", POINT: "滴水點", LAND: "接水面"}


def load(name):
    im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
    return im, im.load()


def inside_tri(x, y, a, b, c):
    def s(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    d1, d2, d3 = s((x, y), a, b), s((x, y), b, c), s((x, y), c, a)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


def bottom_edge(M, W, H, cls, y_from, y_to, xs, to=DRIP):
    """每一欄：cls 那一類最下面的那一格（下面不是 cls）改成滴水線"""
    for x in xs:
        for y in range(min(y_to, H - 1), y_from - 1, -1):
            if M[y][x] == cls and (y + 1 >= H or M[y + 1][x] != cls):
                M[y][x] = to
                break


# ---------------------------------------------------------------- 公會
def guild():
    im, P = load("guild"); W, H = im.size
    M = [[0] * W for _ in range(H)]
    apex, gl, gr = (130, 50), (82, 92), (178, 92)          # 前面凸出來的三角山牆：頂點、左下角、右下角
    for y in range(H):
        for x in range(W):
            r, g, b, a = P[x, y]
            if a < 128:
                continue
            gold = r > 170 and g > 110 and b < 110
            if y >= 90:
                M[y][x] = SHELTER                                  # 屋簷下：木樑、柱子、牆、門、窗
            elif 140 <= x <= 186 and y <= 54 and (gold or (r > b and r + g + b > 150) or (y < 36)):
                M[y][x] = AVOID                                    # 屋頂上的水晶（金色、亮面、暗面；不是石板瓦的藍紫色）
            elif (48 <= x <= 74 or 188 <= x <= 214) and 58 <= y <= 81:
                M[y][x] = AVOID                                    # 小屋頂窗的正面（窗、窗框）
            elif inside_tri(x, y, apex, gl, gr):
                M[y][x] = SHELTER                                  # 山牆正面（盾牌那一面是直立的，水不從上面流）
            else:
                M[y][x] = ROOF                                     # 屋頂（含煙囪、小屋頂窗的小屋頂）
    # 山牆的兩條斜邊（木頭封簷板）＝導水線，水沿著它流到左右下角
    for t in range(0, 101):
        for (ax, ay), (bx, by) in ((apex, gl), (apex, gr)):
            x = round(ax + (bx - ax) * t / 100); y = round(ay + (by - ay) * t / 100)
            for dx in (-1, 0, 1):
                if 0 <= x + dx < W and M[y][x + dx] in (ROOF, SHELTER):
                    M[y][x + dx] = GUIDE
    # 小屋頂窗的兩條斜邊也是導水線（水從小屋頂往兩邊流到大屋頂上）
    for ax, ay, lx, rx in ((61, 47, 45, 77), (201, 47, 185, 217)):
        for t in range(0, 101):
            for bx in (lx, rx):
                x = round(ax + (bx - ax) * t / 100); y = round(ay + (64 - ay) * t / 100)
                if M[y][x] == ROOF:
                    M[y][x] = GUIDE
    # 屋簷邊：屋頂最下面那一列（山牆以外）＝滴水線
    bottom_edge(M, W, H, ROOF, 80, 90, [x for x in range(W) if not (gl[0] <= x <= gr[0])])
    # 山牆的左右下角＝滴水點（斜邊流下來的水從這裡滴）
    for x, y in (gl, gr):
        for yy in range(y, y - 6, -1):
            if M[yy][x] in (GUIDE, ROOF, DRIP):
                M[yy][x] = POINT
                break
    return im, M


# ---------------------------------------------------------------- 旅館（香菇屋）
def inn():
    im, P = load("inn"); W, H = im.size
    M = [[0] * W for _ in range(H)]

    def gill(r, g, b):
        return b > g + 25 and b > r - 10 and r < 200          # 紫色菌褶
    def wall(r, g, b):
        return r > 200 and g > 170 and b > 130 and r - b < 70  # 奶油色的牆
    for y in range(H):
        for x in range(W):
            if P[x, y][3] >= 128:
                M[y][x] = SHELTER                              # 先全部當成傘下（菌褶、牆、陽台、窗、門、招牌）
    # 傘蓋：從頂上往下長（不穿過紫色菌褶、奶油色的牆，也不超過第 80 列），長到的就是傘蓋（紅、白點、外框都算）
    seen = set(); stack = [(70, 22), (40, 40), (110, 40)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or y > 80:
            continue
        seen.add((x, y))
        r, g, b, a = P[x, y]
        if a < 128 or gill(r, g, b):   # 菌褶一整圈把傘蓋跟下面隔開（白點顏色跟牆很像，所以不用顏色擋牆）
            continue
        M[y][x] = ROOF
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for y in range(H):
        for x in range(W):
            if not M[y][x]:
                continue
            r, g, b, a = P[x, y]
            stem = r > 190 and g > 160 and b > 120                     # 小香菇的柄（奶油色）
            if (86 <= x <= 107 and (y <= 11 or (y <= 21 and stem))) or (102 <= x <= 113 and (11 <= y <= 17 or (y <= 24 and stem))):
                M[y][x] = AVOID                                # 傘蓋上的兩顆小香菇（傘＋柄，不含旁邊的大傘蓋）
    # 傘緣：每一欄傘蓋最下面那一格＝滴水線（紅色跟紫色菌褶的交界、兩側的外緣）
    bottom_edge(M, W, H, ROOF, 0, 80, range(W))
    # 接水面：陽台欄杆頂、招牌（酒杯）頂
    for y in range(H):
        for x in range(W):
            if M[y][x] != SHELTER:
                continue
            r, g, b, a = P[x, y]
            wood = r > 150 and 80 < g < 150 and b < 90
            if (36 <= x <= 109 and 86 <= y <= 90 and wood) or (124 <= x <= 142 and 97 <= y <= 101):
                if y - 1 >= 0 and M[y - 1][x] != LAND:
                    M[y][x] = LAND
    # 接水面每一欄只留最上面一格
    for x in range(W):
        seen = False
        for y in range(H):
            if M[y][x] == LAND:
                if seen:
                    M[y][x] = SHELTER
                seen = True
    return im, M


# ---------------------------------------------------------------- 工坊（石頭圓頂）
def workshop():
    im, P = load("workshop"); W, H = im.size
    M = [[0] * W for _ in range(H)]

    def moss(r, g, b):
        return g > b + 35 and g >= r - 2 and r < 200          # 青苔（黃綠到暗綠）
    for y in range(H):
        for x in range(W):
            r, g, b, a = P[x, y]
            if a < 128:
                continue
            ex, ey = (x - 89) / 45.0, (y - 76) / 22.0                # 拱門內緣（橢圓）：中心 (89, 76)，半寬 45、半高 22
            ox_, oy_ = (x - 89) / 57.0, (y - 76) / 40.0              # 拱門外緣：半寬 57、半高 40
            din, dout = (ex * ex + ey * ey) ** 0.5, (ox_ * ox_ + oy_ * oy_) ** 0.5
            if (y <= 76 and din < 1) or (44 <= x <= 134 and y > 76):
                M[y][x] = SHELTER                                  # 凹進去的鍛造間（鐵砧、工具、爐火、晶礦箱）
            elif 77 <= x <= 101 and 36 <= y <= 64:
                M[y][x] = AVOID                                    # 拱頂的招牌
            elif 10 <= x <= 37 and 62 <= y <= 97:
                M[y][x] = AVOID                                    # 左邊的窗（含石框）
            elif (37 <= x <= 51 or 127 <= x <= 141) and 73 <= y <= 117:
                M[y][x] = GUIDE                                    # 拱門兩邊的木柱：拱上流下來的水順著往下
            elif y <= 76 and 0.9 <= dout < 1.0:
                M[y][x] = GUIDE                                    # 拱門石框的外緣：水沿著拱往兩邊繞
            else:
                M[y][x] = ROOF                                     # 石頭表面、青苔、煙囪
    tips = []
    # 青苔垂下來的尖端＝滴水點：青苔的格子、下面不是青苔、往上連著青苔至少 3 格
    for y in range(1, H - 1):
        for x in range(W):
            r, g, b, a = P[x, y]
            if a < 128 or not moss(r, g, b) or M[y][x] != ROOF:
                continue
            rb, gb, bb, ab = P[x, y + 1]
            if ab >= 128 and moss(rb, gb, bb):
                continue
            n = 0
            while y - n - 1 >= 0 and moss(*P[x, y - n - 1][:3]) and P[x, y - n - 1][3] >= 128:
                n += 1
            left = x > 0 and moss(*P[x - 1, y + 1][:3]); right = x < W - 1 and moss(*P[x + 1, y + 1][:3])
            if n >= 4 and not left and not right:
                tips.append((x, y))
    # 太近的尖端只留一個（同一束青苔）
    kept = []
    for x, y in sorted(tips, key=lambda t: -t[1]):
        if all(abs(x - kx) > 4 or abs(y - ky) > 6 for kx, ky in kept):
            kept.append((x, y))
    for x, y in kept:
        M[y][x] = POINT
    # 招牌下面的尖角＝滴水點（拱頂的水從這裡滴進門口）
    done = False
    for y in range(68, 50, -1):                                      # 招牌（金色、咖啡色）最下面那一格：招牌下半在門洞前面，所以不看結構類別，看顏色
        for x in (89, 88, 90):
            r, g, b, a = P[x, y]
            if a >= 128 and r > 120 and g > 70 and b < 90:
                M[y][x] = POINT; done = True; break
        if done:
            break
    return im, M


def save(name, im, M):
    W, H = im.size
    st = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sp = st.load()
    for y in range(H):
        for x in range(W):
            if M[y][x]:
                sp[x, y] = COL[M[y][x]] + (255,)
    os.makedirs(OUT, exist_ok=True)
    st.save(os.path.join(OUT, name + "-structure.png"))
    # 預覽：左原圖、中結構圖疊在變暗的原圖上、右只有結構圖；放大 4 倍
    k = 4
    base = Image.new("RGBA", (W, H), (70, 80, 100, 255)); base.alpha_composite(im)
    dim = Image.blend(base, Image.new("RGBA", (W, H), (20, 20, 30, 255)), 0.55)
    ov = dim.copy(); ov.alpha_composite(Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), st, 0.75))
    solid = Image.new("RGBA", (W, H), (30, 30, 40, 255)); solid.alpha_composite(st)
    pv = Image.new("RGBA", (W * 3 + 8, H), (0, 0, 0, 255))
    pv.paste(base, (0, 0)); pv.paste(ov, (W + 4, 0)); pv.paste(solid, (W * 2 + 8, 0))
    pv = pv.resize((pv.width * k, pv.height * k), Image.NEAREST)
    pv.save(os.path.join(OUT, name + "-preview.png"))
    cnt = {}
    for row in M:
        for v in row:
            if v:
                cnt[NAME[v]] = cnt.get(NAME[v], 0) + 1
    print(name, W, H, cnt)


if __name__ == "__main__":
    for name, fn in (("guild", guild), ("inn", inn), ("workshop", workshop)):
        im, M = fn()
        save(name, im, M)
