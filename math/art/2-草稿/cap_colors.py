"""色數上限：把最接近（而且用得少）的兩個顏色合成一個，直到不超過上限。只用原本就有的顏色，不產生新顏色。
用法：python cap_colors.py 上限 檔案…（直接覆寫；外框黑不會被併掉）"""
import sys
import numpy as np
from PIL import Image
cap = int(sys.argv[1])
def lab(c):
    c = np.array(c, float) / 255; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    X, Y, Z = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.array([116 * f(Y) - 16, 500 * (f(X / 0.9505) - f(Y)), 200 * (f(Y) - f(Z / 1.089))])
for path in sys.argv[2:]:
    a = np.array(Image.open(path).convert("RGBA")); op = a[..., 3] > 0
    cols, cnt = np.unique(a[op][:, :3], axis=0, return_counts=True)
    cols = [tuple(c) for c in cols]; cnt = dict(zip(cols, cnt)); before = len(cols)
    while len(cols) > cap:
        best = None
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                d = np.linalg.norm(lab(cols[i]) - lab(cols[j])) * (1 + min(cnt[cols[i]], cnt[cols[j]]) / 400)
                if best is None or d < best[0]: best = (d, i, j)
        _, i, j = best
        keep, drop = (cols[i], cols[j]) if cnt[cols[i]] >= cnt[cols[j]] else (cols[j], cols[i])
        if sum(int(v) for v in drop) < 40: keep, drop = drop, keep          # 外框（接近黑）留著
        m = op & np.all(a[..., :3] == drop, axis=-1); a[m, :3] = keep
        cnt[keep] += cnt.pop(drop); cols.remove(drop)
    Image.fromarray(a).save(path); print(path, before, "->", len(cols))
