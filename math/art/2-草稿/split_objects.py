"""把讀回的整張物件表（透明底）切成一個一個物件：
不透明的格子分塊，距離 gap 格以內的塊算同一個物件（光點、水花跟著主體），太小的丟掉。
用法：python split_objects.py 讀回圖 輸出資料夾 名稱 [gap]"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
src, out, name = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
gap = int(sys.argv[4]) if len(sys.argv) > 4 else 3
im = Image.open(src).convert("RGBA"); a = np.array(im)
solid = a[..., 3] > 0
grown = ndimage.binary_dilation(solid, iterations=gap)
lab, n = ndimage.label(grown)
out.mkdir(parents=True, exist_ok=True)
boxes = []
for k, sl in enumerate(ndimage.find_objects(lab), 1):
    m = (lab[sl] == k) & solid[sl]
    if m.sum() < 30: continue
    ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    piece = a[sl].copy(); piece[~m] = 0
    boxes.append((sl[0].start + y0, sl[1].start + x0, piece[y0:y1, x0:x1]))
# 由上到下、由左到右排（同一排：上緣差不到 12 格）
boxes.sort(key=lambda b: (b[0] // 12, b[1]))
rows = []
for b in sorted(boxes, key=lambda b: b[0]):
    if rows and abs(rows[-1][0][0] - b[0]) < 14: rows[-1].append(b)
    else: rows.append([b])
order = [b for r in rows for b in sorted(r, key=lambda b: b[1])]
for i, (y, x, p) in enumerate(order):
    Image.fromarray(p).save(out / f"{name}-{i}.png"); print(i, p.shape[1], p.shape[0], "at", x, y)
