# build_island4.py → build_island5.py：使用者 2026-11-25「地圖太方正太整齊」
#   ・台地的崖改成彎的（一條起伏的曲線，不是整條橫線）
#   ・路改成彎的（用曲線把幾個點接起來），廣場邊緣不是正橢圓
#   ・崖上的樹籬一段一段、中間夾樹和花；松樹一叢一叢；建築不左右對稱
s = open('build_island4.py', encoding='utf8').read()
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

rep('"""學院島 v5（docs/地圖設計.md）', '"""學院島 v5b（2026-11-25 使用者「太方正太整齊」→ 崖、路、廣場都改成彎的，樹籬一段一段，建築不對稱）\n以下是 v5 的說明：\n學院島 v5（docs/地圖設計.md）')
# 曲線工具
rep('''def ell(cx, cy, rx, ry):''', '''def spline(pts, n=14):
    """Catmull-Rom 曲線：把幾個點接成平滑的彎路"""
    P = [pts[0]] + list(pts) + [pts[-1]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(tuple(pts[-1])); return out
def ell(cx, cy, rx, ry):''')
# 彎的崖
rep('''UP_Y, LOW_Y = 400, 850                                                      # 上層台地前緣、中層台地前緣（崖的上緣）''', '''UP_Y, LOW_Y = 400, 850                                                      # 崖的平均高度
def UP(x): return UP_Y + 26 * math.sin((x - 180) / 210) + 12 * math.sin(x / 83 + 1)      # 上層台地前緣（起伏的曲線）
def LOW(x): return LOW_Y + 30 * math.sin((x + 120) / 250) + 12 * math.sin(x / 67 + 2)    # 中層台地前緣''')
rep('''upper = island & (yy < UP_Y + 6)                                            # 上層台地：崖以北整片
lower = island & (yy > LOW_Y + 26)''', '''UPa = np.array([UP(x) for x in range(MW)]); LOWa = np.array([LOW(x) for x in range(MW)])
upper = island & (yy < UPa[None, :] + 6)                                    # 上層台地：崖以北整片
lower = island & (yy > LOWa[None, :] + 26)''')
# 不規則的廣場、彎的路
rep('''PLAZA = (CX, 600, 200, 120)                                                 # 中央廣場（共鳴之井）
HARBOR = (CX, 1010, 150, 70)                                                # 港口廣場''', '''PLAZA = (CX, 600, 200, 120)                                                 # 中央廣場（共鳴之井）
HARBOR = (CX - 10, 1015, 150, 70)                                           # 港口廣場''')
a = s.index("roads = []\nroads.append(([(CX, 330), (CX, 1010)]"); b = s.index("road = np.zeros((MH, MW), bool)")
s = s[:a] + '''# 路：每一條都是幾個點連成的曲線。中軸線過崖的地方要剛好在階梯（x＝CX）
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
''' + s[b:]
rep('''plaza = ell(*PLAZA) | ell(*HARBOR)''', '''def blob(cx, cy, rx, ry, seed):
    a_ = np.arctan2(yy - cy, xx - cx); r_ = 1 + 0.07 * np.sin(a_ * 3 + seed) + 0.05 * np.sin(a_ * 5 + seed * 2)
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < r_ ** 2
plaza = blob(*PLAZA, 1.2) | blob(*HARBOR, 2.7)                               # 廣場：邊緣有一點起伏，不是正橢圓''')
# 崖照曲線畫
rep('''def cliff_row(y, x0, x1, gaps):
    for x in range(int(x0), int(x1)):
        if any(a <= x < b for a, b in gaps): continue
        out.alpha_composite(cliff.crop((x % 100, 0, x % 100 + 1, cliff.height)), (x, y - 6))
    sh = Image.new("RGBA", (int(x1 - x0), 8), (20, 40, 20, 50)); out.alpha_composite(sh, (int(x0), y + cliff.height - 6))''', '''def cliff_row(fy, x0, x1, gaps):
    for x in range(int(x0), int(x1)):
        if any(a <= x < b for a, b in gaps): continue
        y = int(round(fy(x)))
        out.alpha_composite(cliff.crop((x % 100, 0, x % 100 + 1, cliff.height)), (x, y - 6))
        out.alpha_composite(Image.new("RGBA", (1, 8), (20, 40, 20, 50)), (x, y + cliff.height - 6))''')
rep('''xu = np.where(island[UP_Y + 4])[0]; cliff_row(UP_Y, xu.min() + 6, xu.max() - 6, STAIR_UP)
xs = np.where(island[LOW_Y + 4])[0]; cliff_row(LOW_Y, xs.min() + 6, xs.max() - 6, STAIR_LOW)''', '''xu = np.where(island[UP_Y + 4])[0]; cliff_row(UP, xu.min() + 6, xu.max() - 6, STAIR_UP)
xs = np.where(island[LOW_Y + 4])[0]; cliff_row(LOW, xs.min() + 6, xs.max() - 6, STAIR_LOW)''')
rep('''for y0 in (UP_Y, LOW_Y):
    for k in range(0, 22, 4): dr.line([(CX - 15, y0 + k), (CX + 15, y0 + k)], fill=tuple(int(v) for v in EDGE_D) + (255,))''', '''for fy in (UP, LOW):
    y0 = int(fy(CX))
    for k in range(0, 22, 4): dr.line([(CX - 15, y0 + k), (CX + 15, y0 + k)], fill=tuple(int(v) for v in EDGE_D) + (255,))''')
rep('''for (x0, x1), y0 in [(STAIR_UP[1], UP_Y), (STAIR_LOW[1], LOW_Y)]:
    for x in range(x0 + 4, x1 - 4):
        for y in range(y0 - 4, y0 + 22):''', '''for (x0, x1), fy in [(STAIR_UP[1], UP), (STAIR_LOW[1], LOW)]:
    for x in range(x0 + 4, x1 - 4):
        y0 = int(fy(x))
        for y in range(y0 - 4, y0 + 22):''')
# 能走：崖照曲線擋
rep('''for y0, gaps in [(UP_Y, [STAIR_UP[0]]), (LOW_Y, [STAIR_LOW[0]])]:
    band = (yy > y0 - 6) & (yy < y0 + 20)''', '''for arr_, gaps in [(UPa, [STAIR_UP[0]]), (LOWa, [STAIR_LOW[0]])]:
    band = (yy > arr_[None, :] - 6) & (yy < arr_[None, :] + 20)''')
# 水道過崖的地方要對到瀑布：水道的點在崖那一段用曲線上的 x
rep('''CANAL = [(950, 400), (962, 500), (948, 640), (962, 760), (932, 850), (900, 960)]   # 在廣場東邊外面（不能穿過廣場）''', '''CANAL = spline([(950, 380), (950, UP(950) + 10), (966, 520), (948, 650), (962, 770), (932, LOW(932) + 10), (905, 960)])   # 在廣場東邊外面''')
# 建築：不左右對稱
for a_, b_ in [('("forest", "academy-forest", 250, 560, 0.46)', '("forest", "academy-forest", 240, 578, 0.46)'),
               ('("fire", "academy-fire", 480, 760, 0.5)', '("fire", "academy-fire", 472, 746, 0.5)'),
               ('("water", "academy-water", 290, 800, 0.5)', '("water", "academy-water", 300, 786, 0.5)'),
               ('("thunder", "academy-thunder", 1170, 560, 0.5)', '("thunder", "academy-thunder", 1182, 548, 0.5)'),
               ('("ice", "academy-ice", 1110, 800, 0.5)', '("ice", "academy-ice", 1096, 776, 0.5)'),
               ('("dorm", "dorm", 420, 1060, 0.5)', '("dorm", "dorm", 420, 1068, 0.5)'),
               ('("greenhouse", "greenhouse", 1010, 1090, 0.5)', '("greenhouse", "greenhouse", 1012, 1094, 0.5)')]:
    rep(a_, b_)
# 路燈：中軸線改沿曲線
rep('''for side in (-1, 1):
    for x, y in along([(CX, 420), (CX, 840)], 90, side=side, gap=26): PROPS.append(("lamp", x, y))
    for x, y in along([(CX, 880), (CX, 960)], 60, side=side, gap=26): PROPS.append(("lamp", x, y))
for pts, w in roads[1:8]:
    for x, y in along(pts, 110, 40, 1, 20): PROPS.append(("lamp", x, y))''', '''for side in (-1, 1):
    for pts, w in roads[:2]:
        for x, y in along(pts, 80, 30, side, 26): PROPS.append(("lamp", x, y))
for pts, w in [roads[2], roads[6]]:
    for x, y in along(pts, 120, 50, 1, 20): PROPS.append(("lamp", x, y))''')
# 樹籬：沿著崖的曲線一段一段，段和段中間放一棵樹或一叢花
rep('''for x in list(range(int(xu.min()) + 30, CX - 40, 34)) + list(range(CX + 44, 920, 34)) + list(range(990, int(xu.max()) - 20, 34)): PROPS.append(("bush", x, UP_Y - 6))''', '''def hedge(fy, x0, x1, skip):
    x, j = x0, 0
    while x < x1:
        n = 3 + (j * 7) % 3                                                  # 一段 3～5 叢
        for _ in range(n):
            if x < x1 and not any(a - 18 < x < b + 18 for a, b in skip): PROPS.append(("bush", x, fy(x) - 6))
            x += 32
        if x < x1 and not any(a - 24 < x < b + 24 for a, b in skip): PROPS.append((["tree_s", "urn", "tree"][j % 3], x + 6, fy(x) - 10))
        x += 44; j += 1
hedge(UP, int(xu.min()) + 30, int(xu.max()) - 20, STAIR_UP)''')
rep('''for x in range(380, 1100, 70): PROPS.append(("pine", x, 150 + (x % 3) * 6))''', '''for gx, gy in [(400, 170), (560, 120), (880, 120), (1060, 180), (1160, 260)]:          # 圖書館後面幾叢松樹（一叢一叢，不是一排）
    for dx, dy in [(0, 0), (36, 12), (-30, 18), (12, 40)]: PROPS.append(("pine", gx + dx, gy + dy))''')
rep('''for x in list(range(220, CX - 40, 34)) + list(range(CX + 44, 900, 34)) + list(range(970, 1230, 34)): PROPS.append(("bush", x, LOW_Y - 6))''', '''hedge(LOW, 210, 1240, STAIR_LOW)''')
open('build_island5.py', 'w', encoding='utf8').write(s)
print('ok')
