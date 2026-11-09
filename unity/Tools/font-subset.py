# Unity 版的中文字型只留遊戲用得到的字（安裝檔小 10 MB 左右）。
#   完整字型：unity/FontSource/NotoSansTC-full.ttf（不打包進遊戲）
#   產生出來：unity/Assets/Resources/Fonts/NotoSansTC.ttf（遊戲用的，只有用到的字）
# 用到的字從這些地方找：Unity 的 C# 程式（台詞、介面文字都寫在裡面）、Resources 裡的 json、
#   烘焙資料（關卡、城鎮、地圖）裡的文字，再加上所有英數字和常用標點。
# 打包時（BuildTools）會自動先跑這個；新增台詞後也可以自己跑：python unity/Tools/font-subset.py
# 需要 fontTools（pip install fonttools）。
import gzip, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
from fontTools import subset
from fontTools.ttLib import TTFont

UNITY = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))   # 放在 unity/Tools：從 Unity 專案（含捷徑路徑）都找得到
SRC = os.path.join(UNITY, 'FontSource', 'NotoSansTC-full.ttf')
OUT = os.path.join(UNITY, 'Assets', 'Resources', 'Fonts', 'NotoSansTC.ttf')
# 圖片、動畫資料（不是文字）：不掃
SKIP_BYTES = {'anims.bytes', 'hero.bytes', 'icons.bytes', 'intro-hero.bytes'}

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set('，。！？、：；「」『』（）［］｛｝【】《》〈〉—–…～·・％＋－×÷＝＜＞／＼｜＃＆＊＠　'
             '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ'
             '←↑→↓↖↗↘↙★☆♪♥♦♣♠●○◆◇■□▲△▼▽✓✗✦✧°′″‧•¥$€£')

def add_text(s):
    for ch in s:
        if ord(ch) >= 0x80: chars.add(ch)

n_files = 0
for base, dirs, files in os.walk(os.path.join(UNITY, 'Assets')):
    for f in files:
        p = os.path.join(base, f)
        if f.endswith(('.cs', '.json', '.txt', '.uss', '.uxml')):
            with open(p, encoding='utf-8', errors='ignore') as fh: add_text(fh.read()); n_files += 1
        elif f.endswith('.bytes') and f not in SKIP_BYTES:
            raw = open(p, 'rb').read()
            if raw[:2] == b'\x1f\x8b': raw = gzip.decompress(raw)
            # 只收連續兩個字以上的中日韓文字（二進位資料裡偶然湊出來的單一個字不算）
            for m in re.finditer(r'[　-鿿＀-￯]{2,}', raw.decode('utf-8', errors='ignore')): add_text(m.group())
            n_files += 1

font = TTFont(SRC, recalcTimestamp=False)   # 不寫入時間：字沒變就產生一模一樣的檔
cmap = font.getBestCmap()
have = [c for c in chars if ord(c) in cmap]
missing = sorted(c for c in chars if ord(c) not in cmap and ord(c) >= 0x80 and not c.isspace() and ord(c) not in (0xfe0f, 0x200b, 0x200d))

opts = subset.Options()
opts.layout_features = ['*']
opts.name_IDs = ['*']
opts.notdef_outline = True
opts.glyph_names = False
opts.hinting = True
sub = subset.Subsetter(opts)
sub.populate(unicodes=[ord(c) for c in have])
sub.subset(font)
tmp = OUT + '.tmp'
font.save(tmp)
same = os.path.exists(OUT) and open(OUT, 'rb').read() == open(tmp, 'rb').read()
if same: os.remove(tmp)
else: os.replace(tmp, OUT)
print(f'字型：掃了 {n_files} 個檔，用到 {len(have)} 個字 → {OUT}（{os.path.getsize(OUT) / 1024:.0f} KB）' + ('（沒變）' if same else ''))
if missing: print('字型裡沒有的字（會顯示不出來）：' + ''.join(missing[:80]))
