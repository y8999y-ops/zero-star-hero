# -*- coding: utf-8 -*-
"""外框整圈連起來看的步進檢查與修正（2026-11-19 使用者確認）。

把本體（剝掉外框後有顏色的部分）的外圍沿著走一圈（Moore 邊界追蹤，8 連通），
每一步是 8 個方向之一。斜的一步＝階梯換一層；連續的直步＝同一層。
  段（run）：兩個斜步之間的直步數 + 1 ＝ 這一層幾格；軸＝水平或垂直。
  段值 s ＝ 水平 n 格 → n-1，垂直 n 格 → -(n-1)（1 格＝斜的 1:1，s=0）
規則（使用者 2026-11-19）：
  - 階梯要逐漸變：相鄰兩段的 s 差不能超過 1（水平 3 → 2 → 1 → 垂直 2，不准水平 3 直接接垂直 2）
  - 不准凹凸凹凸：轉向（斜步方向改變）之間只隔 0～1 格又轉回來
  - 直角轉彎（直步直接轉 90 度、中間沒有斜步）和尖角是刻意的，當成段落分界，不檢查跨過去
修法：只准「在內層補一格」（緊貼本體的透明格）或「往內挖一格」（本體最外圍那格），
每次試所有候選、挑讓分數降最多的一格；總共最多改本體的 BUDGET 比例，只能改原本外圍一格以內。
"""
import numpy as np
from scipy import ndimage

N8 = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]   # 順時針，從上開始
BUDGET = 0.04


def trace(mask):
    """最大一塊的外圍，依序的格子座標（Moore 鄰居追蹤）"""
    lab, n = ndimage.label(mask, np.ones((3, 3)))
    if not n: return []
    sz = np.bincount(lab.ravel()); sz[0] = 0; m = lab == sz.argmax()
    ys, xs = np.nonzero(m); start = (ys.min(), xs[ys == ys.min()].min())
    H, W = m.shape
    inside = lambda p: 0 <= p[0] < H and 0 <= p[1] < W and m[p]
    path = [start]; cur = start; back = 6           # 從左邊進來
    for _ in range(4 * m.sum() + 8):
        found = False
        for k in range(8):
            d = (back + 1 + k) % 8
            nxt = (cur[0] + N8[d][0], cur[1] + N8[d][1])
            if inside(nxt):
                back = (d + 4) % 8; cur = nxt; found = True; break
        if not found: break
        if cur == start and len(path) > 2: break
        path.append(cur)
    return path


def moves(path):
    out = []
    for a, b in zip(path, path[1:] + path[:1]):
        out.append((b[0] - a[0], b[1] - a[1]))
    return out


def runs_of(mv):
    """把一圈的步拆成段：(軸, 幾格, 斜步方向) 的序列，以及段落分界（直角轉彎、轉向）"""
    segs = []          # 每段：dict(axis, n, diag)
    cur_axis, cnt = None, 0
    for d in mv:
        if d[0] == 0 or d[1] == 0:                 # 直步
            ax = "h" if d[0] == 0 else "v"
            if cur_axis is not None and ax != cur_axis and cnt > 0:
                segs.append({"axis": cur_axis, "n": cnt + 1, "diag": None, "corner": True}); cnt = 0
            cur_axis = ax; cnt += 1
        else:                                      # 斜步：結束一段
            segs.append({"axis": cur_axis, "n": cnt + 1, "diag": d, "corner": False}); cnt = 0; cur_axis = None
    if cnt: segs.append({"axis": cur_axis, "n": cnt + 1, "diag": None, "corner": True})
    return segs


def score(mask):
    """回傳 (分數, 突然轉換, 凹凸, 階梯忽長忽短)"""
    path = trace(mask)
    if len(path) < 8: return 0, 0, 0, 0, 0
    segs = runs_of(moves(path)); L = len(segs)
    sval = [0 if (s["n"] == 1 or s["axis"] is None) else (s["n"] - 1 if s["axis"] == "h" else -(s["n"] - 1)) for s in segs]
    abrupt = zig = dip = 0
    # 短的直角轉彎（例如直 2 格直接轉橫 2 格）也算突然轉換：兩邊都 >= 4 格的直角才是刻意的（箱子角）
    for i in range(L):
        a, b = segs[i], segs[(i + 1) % L]
        if a["corner"] and (a["n"] < 4 or b["n"] < 4): abrupt += 1
    # 段落：直角轉彎、斜步方向改變（轉向）都切開
    breaks = set()
    for i in range(L):
        a, b = segs[i], segs[(i + 1) % L]
        if a["corner"] or b["corner"]: breaks.add(i)
        elif a["diag"] is not None and b["diag"] is not None and a["diag"] != b["diag"]:
            breaks.add(i)
            c = segs[(i + 2) % L]
            if c["diag"] is not None and c["diag"] == a["diag"] and b["n"] <= 2: zig += 1
    # 每個段落內：找水平↔垂直的換軸點
    order = list(range(L))
    starts = sorted(breaks)
    if not starts: starts = [L - 1]
    for si, b0 in enumerate(starts):
        b1 = starts[(si + 1) % len(starts)]
        idx = []; k = (b0 + 1) % L
        while True:
            idx.append(k)
            if k == b1: break
            k = (k + 1) % L
            if len(idx) > L: break
        vals = [sval[k] for k in idx]
        nz = [(p, v) for p, v in enumerate(vals) if v != 0]
        for (p1, v1), (p2, v2) in zip(nz, nz[1:]):
            if v1 * v2 < 0:                       # 換軸
                if p2 == p1 + 1: abrupt += abs(v1) + abs(v2) - 1          # 沒有 1:1 就直接換
                else: abrupt += max(0, abs(v1) - 1) + max(0, abs(v2) - 1)  # 換軸前後要先收到 2 格以內
        # 同一軸的一串：大小要先變大再變小（單峰），中間凹下去一次算一次
        run = []
        for v in vals + [0]:
            if v != 0 and (not run or (v > 0) == (run[-1] > 0)): run.append(abs(v)); continue
            for q in range(1, len(run) - 1):
                if run[q] < run[q - 1] and run[q] < run[q + 1]: dip += 1
            run = [abs(v)] if v != 0 else []
    bump = flat_bumps(mask)
    return abrupt * 2 + zig * 3 + dip + bump * 3, abrupt, zig, dip, bump


def flat_bumps(mask):
    """平的邊上突然凸出或凹進 1～2 格：剪影四個方向的輪廓裡 (v, >=3) (v±1, 1～2) (v, >=3)"""
    H, W = mask.shape; n = 0
    profs = [[int(np.argmax(mask[:, x])) if mask[:, x].any() else None for x in range(W)],
             [int(H - 1 - np.argmax(mask[::-1, x])) if mask[:, x].any() else None for x in range(W)],
             [int(np.argmax(mask[y])) if mask[y].any() else None for y in range(H)],
             [int(W - 1 - np.argmax(mask[y, ::-1])) if mask[y].any() else None for y in range(H)]]
    for p in profs:
        rs = []; i = 0
        while i < len(p):
            j = i
            while j + 1 < len(p) and p[j + 1] == p[i]: j += 1
            rs.append((p[i], j - i + 1)); i = j + 1
        for q in range(1, len(rs) - 1):
            (va, la), (vb, lb), (vc, lc) = rs[q - 1], rs[q], rs[q + 1]
            if None in (va, vb, vc): continue
            if va == vc and abs(vb - va) == 1 and lb <= 2 and la >= 3 and lc >= 3: n += 1
    return n


def fix(mask, orig=None, budget=BUDGET):
    """貪婪：每次在原外圍一格以內，試補一格或挖一格，選分數降最多的；到分數 0 或用完預算為止"""
    m = mask.copy(); orig = mask if orig is None else orig
    limit = max(2, int(budget * orig.sum()))
    near = ndimage.binary_dilation(orig, np.ones((3, 3))) & ~ndimage.binary_erosion(orig, np.ones((3, 3)))
    changed = np.zeros_like(m); best_s = score(m)[0]
    while best_s > 0 and changed.sum() < limit:
        ring_in = m & ~ndimage.binary_erosion(m, np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool))
        ring_out = ndimage.binary_dilation(m, np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)) & ~m
        cand = [(y, x, False) for y, x in zip(*np.nonzero(ring_in & near & ~changed))] + \
               [(y, x, True) for y, x in zip(*np.nonzero(ring_out & near & ~changed))]
        best = None
        for y, x, fill in cand:
            m[y, x] = fill
            s = score(m)[0]
            m[y, x] = not fill
            if s < best_s and (best is None or s < best[0]): best = (s, y, x, fill)
        if best is None: break
        best_s, y, x, fill = best; m[y, x] = fill; changed[y, x] = True
    return m, int(changed.sum())


# ---- 2026-11-19 第三輪：通用的單格凸起／凹陷規則 ----
F4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)


def _nb4(m):
    p = np.pad(m, 1)
    return p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]


def _is_tip(m, y, x):
    """尖端例外：從這格往內走 2 格，寬度都只有 1～2 格（一路收窄到一格的尖角）"""
    H, W = m.shape
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        yy, xx = y + dy, x + dx
        if not (0 <= yy < H and 0 <= xx < W and m[yy, xx]): continue
        ok = True
        for step in (1, 2):
            cy, cx = y + dy * step, x + dx * step
            if not (0 <= cy < H and 0 <= cx < W and m[cy, cx]): ok = False; break
            if dy:   # 往上下走：量左右寬度
                w = 1; k = 1
                while cx - k >= 0 and m[cy, cx - k]: w += 1; k += 1
                k = 1
                while cx + k < W and m[cy, cx + k]: w += 1; k += 1
            else:
                w = 1; k = 1
                while cy - k >= 0 and m[cy - k, cx]: w += 1; k += 1
                k = 1
                while cy + k < H and m[cy + k, cx]: w += 1; k += 1
            if w > 2 + step: ok = False; break      # 越往內可以越寬一點
        if ok: return True
    return False


def spurs_notches(m):
    """凸起＝本體邊上只有一邊接著本體的格（尖端例外）；凹陷＝三邊以上被本體包住的空格（不含物件內的洞）"""
    nb = _nb4(m)
    holes = ndimage.binary_fill_holes(m) & ~m
    sp = [(y, x) for y, x in zip(*np.nonzero(m & (nb <= 1))) if not _is_tip(m, y, x)]
    no = [(y, x) for y, x in zip(*np.nonzero(~m & (nb >= 3) & ~holes))]
    return sp, no


def _slope_curve(m):
    """斜率（斜直線段長要一樣）與曲線單調（一路變長或變短、轉折那階最長）：沿用 outline2 的段長規則當分數"""
    import outline2
    prof = outline2._profiles(m)
    return sum(outline2._steps(p) for p in prof.values()), sum(outline2._mono_fix(p)[1] for p in prof.values())


def score2(m):
    """回傳 (總分, (突然換軸, 凹凸凹凸, 階梯凹陷, 平邊凸凹, 斜率不規律, 曲線不單調, 單格凸起, 單格凹陷))"""
    s = score(m); sp, no = spurs_notches(m); st, cv = _slope_curve(m)
    return s[0] + 4 * (len(sp) + len(no)) + st + cv, s[1:] + (st, cv, len(sp), len(no))


def long_corners(m):
    """兩邊都 >= 4 格的直角（刻意的方角）數量"""
    path = trace(m)
    if len(path) < 8: return 0
    segs = runs_of(moves(path)); L = len(segs)
    return sum(1 for i in range(L) if segs[i]["corner"] and segs[i]["n"] >= 4 and segs[(i + 1) % L]["n"] >= 4)


def fix2(mask, budget=BUDGET, pairs=True):
    """貪婪：單格補／挖；沒有單格能改善時，試兩格（挖一格＋旁邊補一格，或相鄰兩格一起補／挖）。只在原外圍一格以內"""
    m = mask.copy(); orig = mask
    limit = max(3, int(budget * orig.sum()))
    near = ndimage.binary_dilation(orig, np.ones((3, 3))) & ~ndimage.binary_erosion(orig, np.ones((3, 3)))
    # 方角只有原本就有的才算刻意；修的時候不准新造方角（2026-11-19：金幣底部被修成方的）
    base = long_corners(orig)
    sc = lambda mm: score2(mm)[0] + 6 * max(0, long_corners(mm) - base)
    changed = np.zeros_like(m); best_s = sc(m)
    while best_s > 0 and changed.sum() < limit:
        rin = m & ~ndimage.binary_erosion(m, F4); rout = ndimage.binary_dilation(m, F4) & ~m
        cells = [(y, x) for y, x in zip(*np.nonzero((rin | rout) & near & ~changed))]
        best = None
        for y, x in cells:
            m[y, x] = ~m[y, x]; s = sc(m); m[y, x] = ~m[y, x]
            if s < best_s and (best is None or s < best[0]): best = (s, [(y, x)])
        if best is None and pairs:
            cs = set(cells)
            for y, x in cells:
                for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
                    q = (y + dy, x + dx)
                    if q not in cs: continue
                    m[y, x] = ~m[y, x]; m[q] = ~m[q]; s = sc(m); m[y, x] = ~m[y, x]; m[q] = ~m[q]
                    if s < best_s and (best is None or s < best[0]): best = (s, [(y, x), q])
        if best is None: break
        best_s, pts = best
        for p in pts: m[p] = ~m[p]; changed[p] = True
    return m, int(changed.sum())


def _eval_chunk(args):
    """fix2_par 的工人：在 m 上逐一試翻 cands 裡的格子（單格或兩格），回傳 (最低分, 序號, 格子)"""
    m, cands, base, best_s, i0 = args
    sc = lambda mm: score2(mm)[0] + 6 * max(0, long_corners(mm) - base)
    best = None
    for k, pts in enumerate(cands):
        for p in pts: m[p] = ~m[p]
        s = sc(m)
        for p in pts: m[p] = ~m[p]
        if s < best_s and (best is None or s < best[0]): best = (s, i0 + k, pts)
    return best


def fix2_par(mask, budget=BUDGET, pairs=True, workers=None):
    """跟 fix2 一模一樣的結果（每一步挑同一格），只是把「試每個候選格」分給好幾個 CPU 一起算。
    大建築（大樹、鐘樓）用 fix2 要好幾個小時（每一步都要對 2000 個候選格各重算一次整圈分數）。
    注意（Windows）：呼叫的腳本主程式要放在 if __name__ == "__main__": 底下，不然每個工人會把整支腳本再跑一次。"""
    import os
    from concurrent.futures import ProcessPoolExecutor
    workers = workers or max(1, (os.cpu_count() or 2) - 1)
    m = mask.copy(); orig = mask
    limit = max(3, int(budget * orig.sum()))
    near = ndimage.binary_dilation(orig, np.ones((3, 3))) & ~ndimage.binary_erosion(orig, np.ones((3, 3)))
    base = long_corners(orig)
    sc = lambda mm: score2(mm)[0] + 6 * max(0, long_corners(mm) - base)
    changed = np.zeros_like(m); best_s = sc(m)

    def run(pool, cands):
        if not cands: return None
        n = max(1, -(-len(cands) // (workers * 4)))
        jobs = [(m, cands[i:i + n], base, best_s, i) for i in range(0, len(cands), n)]
        res = [r for r in pool.map(_eval_chunk, jobs) if r is not None]
        return min(res, key=lambda r: (r[0], r[1])) if res else None

    with ProcessPoolExecutor(workers) as pool:
        while best_s > 0 and changed.sum() < limit:
            rin = m & ~ndimage.binary_erosion(m, F4); rout = ndimage.binary_dilation(m, F4) & ~m
            cells = [(y, x) for y, x in zip(*np.nonzero((rin | rout) & near & ~changed))]
            best = run(pool, [[c] for c in cells])
            if best is None and pairs:
                cs = set(cells); prs = []
                for y, x in cells:
                    for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
                        q = (y + dy, x + dx)
                        if q in cs: prs.append([(y, x), q])
                best = run(pool, prs)
            if best is None: break
            best_s, _, pts = best
            for p in pts: m[p] = ~m[p]; changed[p] = True
    return m, int(changed.sum())


def spot_fix(m):
    """退回原樣的物件也要做：只修單格凸起（挖掉或補平，看哪個步進分數低）和凹陷（補上），每處只動 1 格"""
    m = m.copy(); n = 0
    for _ in range(4):
        sp, no = spurs_notches(m)
        if not sp and not no: break
        for y, x in no: m[y, x] = True; n += 1
        for y, x in sp:
            if not m[y, x]: continue
            opts = []
            m[y, x] = False; opts.append((score2(m)[0], None)); m[y, x] = True
            H, W = m.shape
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and not m[yy, xx]:
                    m[yy, xx] = True; opts.append((score2(m)[0], (yy, xx))); m[yy, xx] = False
            s, p = min(opts, key=lambda t: t[0])
            if p is None: m[y, x] = False
            else: m[p] = True
            n += 1
    return m, n
