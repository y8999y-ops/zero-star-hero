# -*- coding: utf-8 -*-
"""外輪廓重建（使用者 2026-11-19 教的做法）：
「外輪廓線應該只有黑色一層在外面，不是一堆黑點；要符合像素步進規則，在內層補上色或往內挖一層去達成步進。」

做法：不在原本的黑邊上修補，而是
  1. 剝掉外圍看起來是黑的那一層（亮度 < DARK）→ 剩下物件本體（有顏色的部分）。只剝一層：剝兩層會把尖角、光芒削短
  2. 修本體的剪影，讓它符合步進：
     - 單格凸起（兩邊都是平的、中間突出 1 格）→ 往內挖掉
     - 單格凹陷 → 在內層補上旁邊的顏色
     - 斜邊階梯長短不規律（例如 1,3,1）→ 重新平均（補色或挖掉）
     星星尖角那種一路收窄到 1 格的尖端不算凸起，不動。
  3. 本體外面包「一層」外框黑（上下左右緊貼本體的透明格）。這樣外框永遠只有一層，斜邊自然是乾淨的一格階梯，不會有直角雙層。
  4. 緊貼外框、亮度也很低的本體格子（看起來像第二層黑）→ 換成同色系淺一階的顏色。
  5. 分開的小碎塊：小於 MIN 格拿掉；其餘照樣包外框。
check() 用「看起來是黑的就算」判斷：外框只有一層、沒有 L 形直角、本體剪影沒有單格凸凹與不規律階梯、外框裡面沒有很暗的格子貼著。

用法：python outline2.py <輸入.png> <輸出.png>
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from flatten import fix_profile, runs
from oklab import oklab

INK = np.array([0x11, 0x10, 0x2e], np.uint8)
DARK = 0.33        # 亮度低於這個的邊算「黑邊」，會被剝掉
STACK = 0.36       # 貼著外框、亮度低於這個的本體格算「第二層黑」，要調亮
MIN = 3            # 分開的碎塊小於這個格數就拿掉
F4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)


def _ring(m):
    p = np.pad(m, 1)
    return m & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])


def _lum(a):
    return oklab(a[..., :3].astype(float))[..., 0]


def _profiles(m):
    H, W = m.shape
    return {
        "top": [int(np.argmax(m[:, x])) if m[:, x].any() else None for x in range(W)],
        "bot": [int(H - 1 - np.argmax(m[::-1, x])) if m[:, x].any() else None for x in range(W)],
        "lef": [int(np.argmax(m[y])) if m[y].any() else None for y in range(H)],
        "rig": [int(W - 1 - np.argmax(m[y, ::-1])) if m[y].any() else None for y in range(H)],
    }


def _segments(prof):
    segs, seg = [], []
    for k, v in enumerate(prof):
        if v is None or (seg and abs(v - prof[seg[-1]]) > 1):
            if len(seg) >= 3: segs.append(seg)
            seg = [] if v is None else [k]
        else:
            seg.append(k)
    if len(seg) >= 3: segs.append(seg)
    return segs


def _bump_fix(prof):
    """單格凸凹：(v,>=2)(v±1,1)(v,>=2) → 拉平成 v；回傳新 prof 和數量"""
    new = list(prof); n = 0
    for seg in _segments(prof):
        rs = runs([prof[k] for k in seg])
        for q in range(1, len(rs) - 1):
            a, b, c = rs[q - 1], rs[q], rs[q + 1]
            if a[2] == c[2] and abs(b[2] - a[2]) == 1 and b[1] == 1 and a[1] >= 2 and c[1] >= 2:
                new[seg[b[0]]] = a[2]; n += 1
    return new, n


def _mono_fix(prof):
    """曲線段長要單調（網上規則：5,2,1,2,1 會有一塊凸起，要 5,2,2,1,1）；斜直線段長要一樣（1:1、1:2、2:1）。
    一段剪影依高低方向切成幾部分，**轉折處（最凸出的那一階）同時算在兩邊**：圓的最左、最上那一階要最長，
    往兩邊越來越短。每部分的段長不是單調的，就照「離轉折越遠越短」重排（總長不變）。段落頭尾的半截不算"""
    new = list(prof); n = 0
    for seg in _segments(prof):
        for _ in range(3):
            rs = runs([new[k] for k in seg])
            if len(rs) < 4: break
            dirs = [rs[q + 1][2] - rs[q][2] for q in range(len(rs) - 1)]
            parts, q0 = [], 0                         # 依方向切；轉折的那一階 index 同時是前一部分的尾、下一部分的頭
            for q in range(1, len(dirs)):
                if dirs[q] != dirs[q - 1]:
                    parts.append((q0, q, "end")); q0 = q
            parts.append((q0, len(rs) - 1, "none"))
            changed = False
            for k, (a_, b_, _t) in enumerate(parts):
                lo = a_ if a_ > 0 else 1                  # 段落最前面的半截不算
                hi = b_ if b_ < len(rs) - 1 else b_ - 1   # 段落最後面的半截不算
                idx = list(range(lo, hi + 1))
                if len(idx) < 3: continue
                L = [rs[q][1] for q in idx]
                if max(L) > 8: continue
                start_turn = a_ > 0; end_turn = b_ < len(rs) - 1
                if start_turn and not end_turn: want = sorted(L, reverse=True)
                elif end_turn and not start_turn: want = sorted(L)
                elif start_turn and end_turn: continue       # 兩頭都是轉折（S 形中段）：不動
                else: want = sorted(L, reverse=L[0] >= L[-1])
                if want == L: continue
                pos = rs[idx[0]][0]
                for ln, q in zip(want, idx):
                    for t in range(ln): new[seg[pos + t]] = rs[q][2]
                    pos += ln
                n += 1; changed = True
                break
            if not changed: break
    return new, n


def _steps(prof):
    n = 0
    for seg in _segments(prof):
        rs = runs([prof[k] for k in seg])
        for q in range(1, len(rs) - 1):
            a, b, c = rs[q - 1], rs[q], rs[q + 1]
            d1, d2 = b[2] - a[2], c[2] - b[2]
            if abs(d1) != 1 or d1 != d2 or max(a[1], b[1], c[1]) > 8: continue
            if (b[1] - a[1] >= 2 and b[1] - c[1] >= 2) or (a[1] - b[1] >= 2 and c[1] - b[1] >= 2): n += 1
    return n


def _apply(body, col, side, old, new):
    """依新的剪影改本體：往外＝補（用最近的本體顏色）、往內＝挖"""
    H, W = body.shape
    for i, (o, v) in enumerate(zip(old, new)):
        if o is None or v is None or o == v: continue
        if side in ("top", "bot"):
            if side == "top":
                if v > o: body[o:v, i] = False
                else:
                    body[v:o, i] = True; col[v:o, i] = col[o, i]
            else:
                if v < o: body[v + 1:o + 1, i] = False
                else:
                    body[o + 1:v + 1, i] = True; col[o + 1:v + 1, i] = col[o, i]
        else:
            if side == "lef":
                if v > o: body[i, o:v] = False
                else:
                    body[i, v:o] = True; col[i, v:o] = col[i, o]
            else:
                if v < o: body[i, v + 1:o + 1] = False
                else:
                    body[i, o + 1:v + 1] = True; col[i, o + 1:v + 1] = col[i, o]


def _smooth(body, col, rounds=4):
    for _ in range(rounds):
        changed = 0
        for side, p in _profiles(body).items():
            new, _ = fix_profile(p)
            new, nb = _bump_fix(new)
            new, nm = _mono_fix(new)
            if new != p:
                _apply(body, col, side, p, new); changed += 1
        if not changed: break


def _lift(a, body):
    """貼著外框、很暗的本體格 → 同色系淺一階"""
    L = _lum(a); lab = oklab(a[..., :3].astype(float))
    edge = _ring(body)
    cols = {tuple(q) for q in a[body][:, :3]}
    P = np.array(list(cols), float); PL = oklab(P)
    PH = np.arctan2(PL[:, 2], PL[:, 1]); PC = np.hypot(PL[:, 1], PL[:, 2])
    n = 0
    for y, x in zip(*np.nonzero(edge & (L < STACK))):
        c = lab[y, x]
        ok = (PL[:, 0] >= STACK) & (PL[:, 0] > c[0])
        if ok.any():
            # 比它亮的顏色裡，色相彩度最接近的那個（灰色系的色相不穩，不用色相角度判斷）
            cost = np.hypot(PL[:, 1] - c[1], PL[:, 2] - c[2]) * 3 + (PL[:, 0] - c[0])
            cost[~ok] = 9
            a[y, x, :3] = P[int(np.argmin(cost))].astype(np.uint8); n += 1
    return n


def rebuild(a, passes=3):
    """重複做到檢查全 0（補轉角可能讓階梯又不平，所以多做幾輪）"""
    for _ in range(passes):
        a = _rebuild_once(a)
        if not any(check(a).values()): break
    return a


def _rebuild_once(a):
    a = a.copy(); vis = a[..., 3] > 0
    body = vis.copy(); L = _lum(a)
    for _ in range(1):                                   # 1. 剝黑邊（只剝最外一層；裡面那層很暗的由第 4 步調亮，尖角才不會變短）
        r = _ring(body); peel = r & (L < DARK)
        if not peel.any(): break
        body &= ~peel
    lab, n = ndimage.label(body, np.ones((3, 3)))         # 5. 碎塊
    if n:
        sz = np.bincount(lab.ravel())
        for c in range(1, n + 1):
            if sz[c] < MIN: body[lab == c] = False
    col = a[..., :3].copy()
    _smooth(body, col)                                   # 2. 步進
    out = np.zeros_like(a)
    out[body, :3] = col[body]; out[body, 3] = 255
    _lift(out, body)                                     # 4. 第二層黑調亮
    for _ in range(4):                                   # 3. 一層外框；外框出現 L 形（2×2 裡 3 格外框、沒有本體）時，
        ol = ndimage.binary_dilation(body, F4) & ~body   #    把轉角那格補成本體（用旁邊的本體色），外框就變成斜的一格階梯
        H, W = body.shape; fixed = 0
        for y in range(H - 1):
            for x in range(W - 1):
                blk = ol[y:y + 2, x:x + 2]
                if blk.sum() == 3 and not body[y:y + 2, x:x + 2].any():
                    ey, ex = [(y + dy, x + dx) for dy in (0, 1) for dx in (0, 1) if not blk[dy, dx]][0]
                    cy, cx = 2 * y + 1 - ey, 2 * x + 1 - ex
                    nb = [(cy + dy, cx + dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                          if 0 <= cy + dy < H and 0 <= cx + dx < W and body[cy + dy, cx + dx]]
                    if nb:
                        body[cy, cx] = True; out[cy, cx, :3] = out[nb[0][0], nb[0][1], :3]; out[cy, cx, 3] = 255; fixed += 1
        if not fixed: break
    ol = ndimage.binary_dilation(body, F4) & ~body
    out[ol, :3] = INK; out[ol, 3] = 255
    return out


def check(a):
    vis = a[..., 3] > 0; ink = vis & (a[..., :3] == INK).all(-1)
    body = vis & ~ink
    expected = ndimage.binary_dilation(body, F4) & ~body
    L = _lum(a)
    prof = _profiles(body)
    # 外框上的 L 形：2×2 裡 3 格外框
    lshape = 0
    for y in range(a.shape[0] - 1):
        for x in range(a.shape[1] - 1):
            if ink[y:y + 2, x:x + 2].sum() == 3 and not body[y:y + 2, x:x + 2].any(): lshape += 1
    return {
        "extra_ink": int((ink & ~expected).sum()),        # 外框多出來的（兩層、黑點）
        "missing_ink": int((expected & ~ink).sum()),      # 外框缺的
        "lshape": lshape,
        "bumps": sum(_bump_fix(p)[1] for p in prof.values()),
        "steps": sum(_steps(p) for p in prof.values()),
        "curves": sum(_mono_fix(p)[1] for p in prof.values()),
        "stack": int((_ring(body) & (L < STACK) & body).sum()),
    }


if __name__ == "__main__":
    a = np.asarray(Image.open(sys.argv[1]).convert("RGBA"))
    pad = np.zeros((a.shape[0] + 4, a.shape[1] + 4, 4), np.uint8); pad[2:-2, 2:-2] = a
    b = rebuild(pad); bb = Image.fromarray(b).getbbox()
    print("before", check(pad)); print("after ", check(b))
    Image.fromarray(b).crop(bb).save(sys.argv[2])
