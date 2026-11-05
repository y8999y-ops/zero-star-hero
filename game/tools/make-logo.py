# 主畫面標題字（2026-11-05 改名）：「轉生成星星碎片的我，／靠吸收魔物變成最強」（日式輕小說長標題，使用者選定）。
# 微軟正黑體粗體轉像素（門檻 110）：
#   第一行 18px：米白字，「星星碎片」金色；1px 深色外框＋1px 紫色外圈。
#   第二行 30px：金色分階漸層（硬邊、不抖色）、往下 2 格立體厚度、上緣白色反光，「最強」換成紅橘色漸層；同樣雙層外框。
#   最下面一行自己畫的 3×5 像素英文。
# 輸出 game/art/ui/logo.png（遊戲解析度 1 倍）和 docs/主畫面-標題字預覽.png。執行：python game/tools/make-logo.py
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "art", "ui", "logo.png")
FONT = "C:/Windows/Fonts/msjhbd.ttc"

def mask(text, size):
    font = ImageFont.truetype(FONT, size)
    w = int(font.getlength(text)) + 8
    im = Image.new("L", (w, size + 12), 0)
    ImageDraw.Draw(im).text((4, 0), text, font=font, fill=255)
    M = [[1 if im.getpixel((x, y)) > 110 else 0 for x in range(im.width)] for y in range(im.height)]
    for y in range(1, im.height - 1):
        for x in range(1, im.width - 1):
            n = M[y - 1][x] + M[y + 1][x] + M[y][x - 1] + M[y][x + 1]
            if M[y][x] and n == 0: M[y][x] = 0
    ys = [y for y in range(im.height) if any(M[y])]
    M = M[min(ys):max(ys) + 1]
    # 每個字的 x 範圍（給分色用）
    edges = [4 + font.getlength(text[:i]) for i in range(len(text) + 1)]
    return M, edges

F35 = {
    "A": [".#.", "#.#", "###", "#.#", "#.#"], "B": ["##.", "#.#", "##.", "#.#", "##."], "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "E": ["###", "#..", "##.", "#..", "###"], "H": ["#.#", "#.#", "###", "#.#", "#.#"], "N": ["#..#", "##.#", "#.##", "#..#", "#..#"],
    "O": [".#.", "#.#", "#.#", "#.#", ".#."], "R": ["##.", "#.#", "##.", "#.#", "#.#"], "S": [".##", "#..", ".#.", "..#", "##."],
    "T": ["###", ".#.", ".#.", ".#.", ".#."], "Z": ["###", "..#", ".#.", "#..", "###"], " ": ["..", "..", "..", "..", ".."],
}
SUB = "REBORN AS A STAR SHARD"

m1, e1 = mask("轉生成星星碎片的我，", 18)
m2, e2 = mask("靠吸收魔物變成最強", 30)
w1, w2 = len(m1[0]), len(m2[0])
subw = sum(len(F35[c][0]) + 1 for c in SUB) - 1
CW = max(w1, w2, subw) + 8
DEPTH = 2
y1 = 3
y2 = y1 + len(m1) + 4
y3 = y2 + len(m2) + DEPTH + 4
CH = y3 + 5 + 4
canvas = [[None] * CW for _ in range(CH)]
x1, x2 = (CW - w1) // 2, (CW - w2) // 2

def char_at(edges, x):
    for i in range(len(edges) - 1):
        if edges[i] <= x < edges[i + 1]: return i
    return -1

# 第一行
for y, row in enumerate(m1):
    for x, v in enumerate(row):
        if not v: continue
        i = char_at(e1, x)
        gold = 3 <= i <= 6   # 星星碎片
        top = y == 0 or not m1[y - 1][x]
        canvas[y1 + y][x1 + x] = ("#fff2b0" if top else "#ffd24a") if gold else ("#ffffff" if top else "#e8e0f4")
# 第二行：厚度
EXT = ["#6a2a14", "#401a0c"]
for d in range(DEPTH, 0, -1):
    for y, row in enumerate(m2):
        for x, v in enumerate(row):
            if v: canvas[y2 + y + d][x2 + x] = EXT[d - 1]
GOLD = ["#fff6c8", "#ffe27a", "#ffc83a", "#f4a424", "#d8761a"]
RED = ["#fff0d0", "#ffb070", "#ff7a3a", "#e8402a", "#b8201e"]
gh = len(m2)
for y, row in enumerate(m2):
    for x, v in enumerate(row):
        if not v: continue
        i = char_at(e2, x)
        G = RED if i >= 7 else GOLD   # 最強
        c = G[min(4, int(y / gh * 5))]
        if (y < 2 or not m2[y - 1][x]) and (y < 3 or not m2[y - 2][x]) and y / gh < 0.35: c = "#ffffff"
        canvas[y2 + y][x2 + x] = c
# 英文副標
sx = (CW - subw) // 2
for ch in SUB:
    for j, r in enumerate(F35[ch]):
        for i, v in enumerate(r):
            if v == "#": canvas[y3 + j][sx + i] = "#a8f0ff"
    sx += len(F35[ch][0]) + 1

def ring(color):
    add = []
    for y in range(CH):
        for x in range(CW):
            if canvas[y][x] is None and any(0 <= y + b < CH and 0 <= x + a < CW and canvas[y + b][x + a] not in (None, color) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                add.append((x, y))
    for x, y in add: canvas[y][x] = color
# 第二版（照 pixelfx skill，參考 ui/level-up 的字）：內圈改成選擇性外框——旁邊是金字就用深棕、紅字用深紅、白字用深紫，
# 不是一律黑色；外圈維持紫色描邊，跟夜空分開
def ring_sel():
    add = []
    for y in range(CH):
        for x in range(CW):
            if canvas[y][x] is not None: continue
            best = None
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= y + b < CH and 0 <= x + a < CW and canvas[y + b][x + a]:
                    c = canvas[y + b][x + a]
                    r, g, bb = (int(c[i:i + 2], 16) for i in (1, 3, 5))
                    d = "#%02x%02x%02x" % (int(r * 0.22), int(g * 0.16), int(bb * 0.2) + 8)
                    if best is None or sum(int(d[i:i + 2], 16) for i in (1, 3, 5)) < sum(int(best[i:i + 2], 16) for i in (1, 3, 5)): best = d
            if best: add.append((x, y, best))
    for x, y, c in add: canvas[y][x] = c
ring_sel()
ring("#4a2a7a")
xs = [x for y in range(CH) for x in range(CW) if canvas[y][x]]; ys = [y for y in range(CH) for x in range(CW) if canvas[y][x]]
X0, X1, Y0, Y1 = min(xs), max(xs), min(ys), max(ys)
out = Image.new("RGBA", (X1 - X0 + 1, Y1 - Y0 + 1), (0, 0, 0, 0))
for y in range(Y0, Y1 + 1):
    for x in range(X0, X1 + 1):
        c = canvas[y][x]
        if c: out.putpixel((x - X0, y - Y0), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
out.save(OUT)
big = out.resize((out.width * 4, out.height * 4), Image.NEAREST)
bg = Image.new("RGBA", big.size, (30, 22, 60, 255)); bg.alpha_composite(big)
bg.save(os.path.join(HERE, "..", "..", "docs", "主畫面-標題字預覽.png"))
print("logo", out.size)
