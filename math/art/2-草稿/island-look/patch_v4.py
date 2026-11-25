# 從 build_island2.py（v3）產生 build_island3.py（v4）。只跑一次；之後直接改 build_island3.py。
s = open('build_island2.py', encoding='utf8').read()
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

rep('"""學院島 v3：同心圓', '''"""學院島 v4（2026-11-25 使用者：「地圖還是太空」「島邊和天空接的地方太生硬，用一圈雲」「物件不要沒理由地隨機撒，每個物件出現都要有理由」）
  改成更緊的同心圓；島邊一圈雲；所有小物件都照規則放（見「小物件」那一段的說明）。
以下是 v3 的說明：
學院島 v3：同心圓''')
rep('''MW, MH = 1300, 1180
C = (640, 580)                        # 同心圓的中心
ISL = (C[0], C[1], 628, 548)          # 島：橢圓（中心、半徑）
R1 = (300, 322)                       # 第一圈環狀路（半寬、半高）
R2 = (560, 470)                       # 第二圈''', '''MW, MH = 1340, 1240
C = (670, 610)                        # 同心圓的中心
R1 = (272, 296)                       # 第一圈環狀路（半寬、半高）
R2 = (512, 488)                       # 第二圈
ISL = (C[0], C[1], R2[0] + 64, R2[1] + 56)   # 島：橢圓（中心、半徑），剛好包住第二圈''')
rep('''BUILD += [("forest", "academy-forest", 236, 392, 0.46), ("thunder", "academy-thunder", 1046, 392, 0.5),
          ("water", "academy-water", 186, 668, 0.5), ("ice", "academy-ice", 1094, 668, 0.5),
          ("fire", "academy-fire", C[0], C[1] + R2[1], 0.5)]
for name, f, ang in [("dorm", "dorm", 131), ("shop", "shop", 109), ("greenhouse", "greenhouse", 70), ("clock", "clocktower", 47)]:''', '''# 五座學院：北邊兩座、東西兩座在第一圈外面（用短路接回第一圈），赤焰塔在正南（門朝第二圈）
ACAD = {"forest": (C[0] - 372, C[1] - 192), "thunder": (C[0] + 378, C[1] - 192), "water": (C[0] - 392, C[1] + 88), "ice": (C[0] + 394, C[1] + 88)}
BUILD += [("forest", "academy-forest", *ACAD["forest"], 0.46), ("thunder", "academy-thunder", *ACAD["thunder"], 0.5),
          ("water", "academy-water", *ACAD["water"], 0.5), ("ice", "academy-ice", *ACAD["ice"], 0.5),
          ("fire", "academy-fire", C[0], C[1] + R2[1], 0.5)]
for name, f, ang in [("dorm", "dorm", 130), ("shop", "shop", 112), ("greenhouse", "greenhouse", 68), ("clock", "clocktower", 50)]:''')
rep('''road |= spur((236, 406), (ring_x(*R1, 406, -1), 406)) | spur((1046, 406), (ring_x(*R1, 406, 1), 406))
road |= spur((186, 682), (ring_x(*R1, 682, -1), 682)) | spur((1094, 682), (ring_x(*R1, 682, 1), 682))''', '''for k, side in [("forest", -1), ("thunder", 1), ("water", -1), ("ice", 1)]:
    fx, fy = ACAD[k]; road |= spur((fx, fy + 14), (ring_x(*R1, fy + 14, side), fy + 14))''')
rep('EW_Y = C[1] + 190', 'EW_Y = C[1] + 150')
rep('''road |= spur((C[0], WELL_C[1] + 40), (C[0], C[1] + R1[1]))''', '''road |= spur((C[0], WELL_C[1] + 40), (C[0], C[1] + R1[1]))
road |= spur((C[0], C[1] - R1[1]), (C[0], C[1] - R2[1]))           # 北邊：第一圈往北接第二圈（北花園）''')

a = s.index('# 雲（島外）'); b = s.index('WELL_AT = (WELL_C[0] - 81')
s = s[:a] + '''# 雲：島的邊緣圍一圈雲（北半圈的雲在島後面、南半圈的雲蓋在斷崖前面），天空也飄幾朵
#    雲的圖：星芽花園戰鬥背景（已通過）裡的白雲，剪下一朵一朵，放大 2 倍（地圖的像素比戰鬥細一倍）
def big_clouds():
    bk = np.array(Image.open(D.parent.parent / "assets" / "battle" / "garden" / "back.png").convert("RGBA")).astype(int)
    mx, mn = bk[..., :3].max(-1), bk[..., :3].min(-1)
    m = (mx > 200) & (mx - mn < 90) & (bk[..., 1] >= bk[..., 0] - 12) & (bk[..., 3] > 0)
    lab, n = ndimage.label(ndimage.binary_closing(m, iterations=1)); res = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        mm = (lab[sl] == k) & m[sl]
        if mm.sum() < 60 or sl[1].start == 0 or sl[1].stop >= bk.shape[1]: continue
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

''' + s[b:]

a = s.index('PROPS = [("board"'); b = s.index('# ── 每座學院周圍的特色')
s = s[:a] + '''# ── 小物件：每一個都有理由（使用者 2026-11-25） ──
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
    for dx in (-1, 1): PROPS.append((pot, b["door"][0] + dx * (b["w"] // 2 - 12), b["door"][1] + 2))
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
PROPS += [("tree", d["x"] - 26, d["y"] + 60), ("tree_s", d["x"] - 30, d["y"] + 110), ("bench", d["x"] - 40, d["door"][1] + 4)]
k_ = BBx["clock"]                                                    # 鐘塔旁的松樹
for j in range(3): PROPS.append(("pine", k_["x"] + k_["w"] + 26, k_["y"] + 40 + j * 46))
s_ = BBx["shop"]
PROPS += [("crate", s_["x"] - 18, s_["door"][1] + 2), ("crate", s_["x"] - 18, s_["door"][1] - 20), ("barrel", s_["x"] - 40, s_["door"][1] + 2)]
PROPS += [("crate", DOCK_AT[0] - 30, EW_Y + 40), ("barrel", DOCK_AT[0] - 52, EW_Y + 44), ("crate", DOCK_AT[0] - 30, EW_Y - 22)]
''' + s[b:]

rep('''    "forest": [("tree", "L", 30, 20), ("pine", "L", 60, 70), ("tree_s", "R", 40, 10), ("bush", "L", 16, -2), ("bush", "R", 20, -4), ("pine", "R", 70, 60), ("tree", "L", 90, 0), ("tree_s", "R", 96, 30)],''',
    '''    "forest": [("bush", "L", 16, -2), ("bush", "R", 20, -4)],''')
rep('''    "water": [("bush", "L", 16, -2), ("urn", "R", 100, 10)],          # 噴泉改成會動的特效（遊戲裡畫）''', '''    "water": [],          # 旁邊有練習池＋噴泉特效（遊戲裡畫）''')
rep('''    "fire": [("urn", "L", 22, 6), ("urn", "R", 22, 6)],''', '''    "fire": [],           # 兩座火盆特效（遊戲裡畫）''')
rep('''wb = BB["water"]; POND_AT = (wb["x"] - 40, wb["y"] - 84)''', '''wb = BB["water"]; POND_AT = (wb["x"] + 6, wb["y"] - 92)''')

rep('''for i in range(5200):
    s = rnd.choice(flowers if rnd.random() < 0.3 else tufts)
    x, y = rnd.randrange(0, MW - s.width), rnd.randrange(0, MH - s.height)''', '''# 小草到處都有；小花只長在花圃和建築門口的花帶（有理由的地方）
beds = [(C[0] + dx * 70, C[1] - (R1[1] + R2[1]) / 2 + 10, 30, 16) for dx in (-1, 1)] + [(b["door"][0], b["door"][1] + 26, 46, 12) for b in buildings]
for i in range(9000):
    if i % 3 == 0:
        bx, by, brx, bry = beds[(i // 3) % len(beds)]
        s = rnd.choice(flowers); x, y = int(bx + rnd.uniform(-brx, brx)), int(by + rnd.uniform(-bry, bry))
        if ((x - bx) / brx) ** 2 + ((y - by) / bry) ** 2 > 1 or x < 0 or y < 0 or x + s.width >= MW or y + s.height >= MH: continue
    else:
        s = rnd.choice(tufts); x, y = rnd.randrange(0, MW - s.width), rnd.randrange(0, MH - s.height)''')
rep('''out.alpha_composite(pond, POND_AT)
out.convert("RGB").save(OUT / "ground.png")''', '''out.alpha_composite(pond, POND_AT)
out.convert("RGB").save(OUT / "ground.png")
# 南邊蓋在斷崖前面的雲：另外一張圖（遊戲裡畫在最上層，看起來島浮在雲上）
fc = Image.new("RGBA", (MW, MH))
for c, x, y in FRONT_CLOUDS: fc.alpha_composite(c, (max(0, x), max(0, min(MH - c.height, y))))
fc.save(OUT / "clouds-front.png")''')
open('build_island3.py', 'w', encoding='utf8').write(s)
print("ok")
