# 用法：python cap24.py <套規則前的圖> <套規則後的圖>
# 套完外框規則後色數超過 24：把新加的深色一個個併到最接近的原有（非黑）顏色，直到 24 色以內
import sys, os, glob, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from oklab import oklab
from PIL import Image
old_f, new_f = sys.argv[1], sys.argv[2]
def cols(f):
    a = np.asarray(Image.open(f).convert("RGBA")); s = {}
    for q in a[a[..., 3] > 0][:, :3]: s[tuple(q)] = s.get(tuple(q), 0) + 1
    return s
old, new = cols(old_f), cols(new_f)
added = [c for c in new if c not in old]; base = [c for c in new if c in old and oklab(np.array(c, float))[0] > 0.25]
BL = oklab(np.array(base, float)); dist = lambda c: np.linalg.norm(BL - oklab(np.array(c, float)), axis=1)
order = sorted(added, key=lambda c: dist(c).min()); mp = {}
while len(new) - len(mp) > 24 and order:
    c = order.pop(0); mp[c] = base[int(np.argmin(dist(c)))]
a = np.asarray(Image.open(new_f).convert("RGBA")).copy()
for c, t in mp.items(): a[(a[..., :3] == c).all(-1) & (a[..., 3] > 0), :3] = t
Image.fromarray(a).save(new_f); print(new_f, "merged", len(mp), "colours", len(cols(new_f)))
