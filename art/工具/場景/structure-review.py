"""結構圖給使用者看的總覽：每棟一張（左原圖、右疊上結構圖；滴水點畫圈），加一張顏色說明。
用法：python art/工具/場景/structure-review.py   → art/2-草稿/結構圖/看-1.png…、看-說明.png"""
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
D = os.path.join(ROOT, 'art', '2-草稿', '結構圖'); S = os.path.join(ROOT, 'art', '3-已通過', 'town')
COL = {'屋頂面（淋雨、水往下流）': (70, 140, 255), '擋雨區（不濕、水不經過）': (110, 110, 120), '繞開（水繞過去）': (255, 150, 40), '導水線（水沿著走）': (255, 230, 40),
       '滴水線（流到這裡滴下）': (255, 40, 40), '滴水點（畫圈）': (255, 0, 255), '接水面（上面滴下來打在這）': (40, 230, 120)}
font = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 26)
for i, (n, title) in enumerate((('guild', '公會'), ('inn', '旅館（香菇屋）'), ('workshop', '工坊（石頭圓頂）'))):
    im = Image.open(f'{S}/{n}.png').convert('RGBA'); st = Image.open(f'{D}/{n}-structure.png').convert('RGBA')
    W, H = im.size; k = 4
    base = Image.new('RGBA', (W, H), (70, 80, 100, 255)); base.alpha_composite(im)
    dim = Image.blend(base, Image.new('RGBA', (W, H), (20, 20, 30, 255)), 0.5)
    ov = dim.copy(); lay = st.copy(); lay.putalpha(st.getchannel('A').point(lambda a: 175 if a else 0)); ov.alpha_composite(lay)
    a = base.resize((W * k, H * k), Image.NEAREST); b = ov.resize((W * k, H * k), Image.NEAREST)
    d = ImageDraw.Draw(b); px = st.load()
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] and c[:3] == (255, 0, 255): d.ellipse([x * k - 6, y * k - 6, x * k + k + 6, y * k + k + 6], outline=(255, 0, 255), width=3)
            if c[3] and c[:3] in ((255, 40, 40), (40, 230, 120)): d.rectangle([x * k, y * k, x * k + k - 1, y * k + k - 1], fill=c[:3])
    row = Image.new('RGB', (W * k * 2 + 20, H * k + 40), (16, 16, 24)); row.paste(a, (0, 40)); row.paste(b, (W * k + 20, 40))
    ImageDraw.Draw(row).text((6, 4), title, font=font, fill=(255, 255, 255)); row.save(f'{D}/看-{i + 1}.png')
leg = Image.new('RGB', (1100, 4 * 40 + 10), (16, 16, 24)); dl = ImageDraw.Draw(leg)
for i, (t, c) in enumerate(COL.items()):
    x = 10 + (i % 2) * 540; y = 8 + (i // 2) * 40; dl.rectangle([x, y + 4, x + 26, y + 30], fill=c); dl.text((x + 36, y), t, font=font, fill=(235, 235, 235))
leg.save(f'{D}/看-說明.png')
