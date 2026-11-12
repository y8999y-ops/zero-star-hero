# -*- coding: utf-8 -*-
# 2026-11-12 介面統一：所有視窗共用同一套外框（深色底＋細金邊），卡片共用同一套內框。
# 產生後直接蓋掉 unity/Assets/Resources/UI 裡各主題的框（win-guild / win-sys / win-forge / win-inn / panel、card-*），程式不用改。
# 注意：這幾張原本是網頁版 ui-art.js 匯出的；重跑 unity-ui-export.mjs 會把它們蓋回舊樣子，蓋回去之後要再跑一次這支。
#   執行：python game/tools/ui-frames.py
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "unity", "Assets", "Resources", "UI")
def hx(s, a=255): s = s.lstrip("#"); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)

def frame(size, fill, edge_out, gold_hi, gold, gold_lo, inner_hi, corner):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0)); p = im.load(); n = size - 1
    for y in range(size):
        for x in range(size):
            d = min(x, y, n - x, n - y)
            cut = (x in (0, n)) and (y in (0, n))            # 最外角缺一格（圓角感）
            if cut: continue
            if d == 0: c = edge_out                          # 外圈深色
            elif d == 1: c = gold_hi if (x == 1 or y == 1) and not (x == n - 1 or y == n - 1) else gold_lo   # 金邊：左上亮、右下暗
            elif d == 2: c = hx("#2a1a10") if gold else edge_out
            else: c = fill
            p[x, y] = c
    for y in range(3, size - 3):                             # 內側上緣一條淡亮線
        pass
    for x in range(3, size - 3): p[x, 3] = inner_hi
    if corner:                                               # 四角的小金菱形
        for (cx, cy) in [(4, 4), (n - 4, 4), (4, n - 4), (n - 4, n - 4)]:
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    m = abs(dx) + abs(dy)
                    if m <= 2: p[cx + dx, cy + dy] = gold_hi if m == 0 else gold if m == 1 else gold_lo
    return im

GOLD_HI, GOLD, GOLD_LO = hx("#ffe9a8"), hx("#e8b84a"), hx("#a8742a")
win = frame(48, hx("#151127", 242), hx("#07040e"), GOLD_HI, GOLD, GOLD_LO, hx("#2b2548", 242), True)
# 修正：金邊那一圈用中間色，亮暗只留在轉角附近太花；整圈改成：上、左＝亮金，下、右＝暗金
for name in ["win-guild", "win-sys", "win-forge", "win-inn", "panel"]:
    win.save(os.path.join(OUT, name + ".png"))

card = Image.new("RGBA", (32, 32), (0, 0, 0, 0)); p = card.load(); n = 31
for y in range(32):
    for x in range(32):
        d = min(x, y, n - x, n - y)
        if (x in (0, n)) and (y in (0, n)): continue
        if d == 0: c = hx("#07040e")
        elif d == 1: c = hx("#6f6399") if y == 1 else hx("#4a4070") if x == 1 else hx("#342c54")
        else: c = hx("#211b38") if y < 16 else hx("#1c1731")
        p[x, y] = c
for name in ["card-guild", "card-sys", "card-forge", "card-inn"]:
    card.save(os.path.join(OUT, name + ".png"))
print("frames written to", os.path.normpath(OUT))
