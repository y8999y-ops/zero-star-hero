// 網頁版 pixelfx/src/fx/ui/level-up.js 一行一行翻成 C#（模擬特效），加上 ui/_lib.js 用到的部分（UiLib）。
// 金光聚到腳下，往上炸成一根光柱包住主角；光環沿柱子往上爬，LEVEL UP! 一個字一個字掉下來、一道亮光掃過、星光閃爍。
// 選項：Palette（8 階）、Seed、Light，文字用 o.Str["text"]（預設 "LEVEL UP!"），角色用 o.Actor（預設替身角色 2）。
using System;
using System.Collections.Generic;
using System.Linq;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class UiLib
    {
        public class Letter { public char ch; public Glyph g; public int x, w, h; }
        public class Spelled { public List<Letter> letters = new List<Letter>(); public int w, h; }
        /// 字串排成一行（字型像素）：每個字的 glyph（空白是 null）、左邊、寬。
        public static Spelled Spell(string str, string font = "big")
        {
            var F = Font.FONTS[font]; var o = new Spelled(); int x = 0;
            foreach (char ch in str)
            {
                var g = F.Find(ch); int w = g != null ? g.W : F.Space;
                o.letters.Add(new Letter { ch = ch, g = g, x = x, w = w, h = F.H });
                x += w + F.Gap;
            }
            o.w = Math.Max(0, x - F.Gap); o.h = F.H;
            return o;
        }

        public class WordItem { public Glyph g; public double x, y, sx, sy, a = 1, flash, slant; }
        public class WordStyle { public uint[] fill; public uint edge, under, outline, shadow, glint = Col.WHITE; public double? shine, shineY; public int ow = 1; }

        static short[] ids = new short[4096]; static byte[] edges = new byte[4096];
        static bool Has(bool[] r, int i) => r != null && i >= 0 && i < r.Length && r[i];

        /// 把字當成一個字畫：每個字由下往上漸層、亮的上緣、暗的下緣、1px 暗框、投影，可選斜斜掃過的亮光和白閃。
        public static void DrawWord(Painter p, List<WordItem> items, WordStyle st)
        {
            if (items.Count == 0) return;
            double fx0 = double.PositiveInfinity, fy0 = double.PositiveInfinity, fx1 = double.NegativeInfinity, fy1 = double.NegativeInfinity;
            foreach (var it in items)
            {
                double hh = it.g.Rows.Length * it.sy, ww = it.g.W * it.sx, sl = Math.Abs(it.slant) * it.g.Rows.Length;
                fx0 = Math.Min(fx0, it.x - sl); fx1 = Math.Max(fx1, it.x + ww + sl);
                fy0 = Math.Min(fy0, it.y); fy1 = Math.Max(fy1, it.y + hh);
            }
            int ow = st.ow;
            int x0 = (int)Math.Floor(fx0) - 1 - ow, y0 = (int)Math.Floor(fy0) - 1 - ow, x1 = (int)Math.Ceiling(fx1) + 2 + ow, y1 = (int)Math.Ceiling(fy1) + 3 + ow;
            int W = x1 - x0, H = y1 - y0;
            if (W * H > ids.Length) { ids = new short[W * H * 2]; edges = new byte[W * H * 2]; }
            Array.Clear(ids, 0, W * H);
            for (int k = 0; k < items.Count; k++)
            {
                var it = items[k]; var g = it.g; int gh = g.Rows.Length; double h = gh * it.sy, bot = it.y + h, sl = it.slant;
                for (int py = (int)Math.Floor(it.y); py < Math.Ceiling(bot); py++)
                {
                    int gy = (int)Math.Floor((py + 0.5 - it.y) / it.sy);
                    if (gy < 0 || gy >= gh) continue;
                    double shift = Round(((bot - py - 0.5) / it.sy) * sl);
                    double ry = py + 0.5 - it.y - gy * it.sy; var row = g.Rows[gy];
                    for (int px = (int)Math.Floor(it.x + shift) - 1; px <= Math.Ceiling(it.x + shift + g.W * it.sx); px++)
                    {
                        double fx = px + 0.5 - it.x - shift; int gx = (int)Math.Floor(fx / it.sx);
                        if (gx < 0 || gx >= g.W || !row[gx]) continue;
                        int i = (py - y0) * W + (px - x0);
                        if (i < 0 || i >= W * H) continue;
                        ids[i] = (short)(k + 1);
                        // 斜面跟著字型像素：上緣亮、下緣暗、左邊亮；只有平的邊才有
                        double rx = fx - gx * it.sx; bool[] up = gy > 0 ? g.Rows[gy - 1] : null, dn = gy < gh - 1 ? g.Rows[gy + 1] : null;
                        Func<bool[], bool> open = r => r == null || (!Has(r, gx) && !Has(r, gx - 1) && !Has(r, gx + 1));
                        edges[i] = (byte)((ry < 1 && open(up) ? 1 : 0) | (ry >= it.sy - 1 && open(dn) ? 2 : 0) | (rx < 1 && !(gx > 0 && row[gx - 1]) ? 4 : 0));
                    }
                }
            }
            int At(int x, int y) => x < x0 || y < y0 || x >= x1 || y >= y1 ? 0 : ids[(y - y0) * W + (x - x0)];
            var F = st.fill; int nF = F.Length; var shine = st.shine; uint glint = st.glint; double sy0 = st.shineY ?? y0;
            for (int y = y0; y < y1; y++)
                for (int x = x0; x < x1; x++)
                {
                    int id = At(x, y);
                    if (id != 0)
                    {
                        var it = items[id - 1]; double v = (y + 0.5 - it.y) / (it.g.Rows.Length * it.sy);
                        int i = (int)Math.Min(nF - 1, Math.Max(0, Math.Floor((1 - v) * nF)));
                        uint c = F[i];
                        int e = edges[(y - y0) * W + (x - x0)];
                        if ((e & 1) != 0) c = st.edge;
                        else if ((e & 2) != 0) c = st.under;
                        else if ((e & 4) != 0 && i < nF - 1) c = F[i + 1];
                        if (shine.HasValue)
                        {
                            double d = Math.Abs(x + 0.5 - (y + 0.5 - sy0) * 0.6 - shine.Value);
                            if (d < 1.1) c = Col.WHITE;
                            else if (d < 2.4) c = glint;
                        }
                        // 白閃：先全白，再從下往上擦掉（不用網點）
                        if (it.flash > 0.6 || (it.flash > 0.25 && v < 0.5)) c = Col.WHITE;
                        p.Dot(x, y, c, it.a);
                        continue;
                    }
                    // 外框貼著每個字；投影往右下掉
                    int n = 0;
                    for (int dy = -ow; dy <= ow && n == 0; dy++) for (int dx = -ow; dx <= ow && n == 0; dx++) if (ow < 2 || Math.Abs(dx) + Math.Abs(dy) < 4) n = At(x + dx, y + dy);
                    if (n != 0) { p.Dot(x, y, st.outline, items[n - 1].a); continue; }
                    int s = At(x - ow, y - 1 - ow); if (s == 0) s = At(x + 1 - ow, y - 1 - ow); if (s == 0) s = At(x - ow, y - ow);
                    if (s != 0 && st.shadow != 0) p.Dot(x, y, st.shadow, items[s - 1].a * 0.9);
                }
        }

        /// 用光閃角色：照自己像素的亮度換成亮色階 [暗, 中, 亮]；k 往下掉時一階一階收（不用網點），0.8 以上最亮的變白。
        public static void TintActor(Painter p, Actor A, double k, uint[] ramp)
        {
            if (A == null || k <= 0.12) return;
            double cut = k > 0.6 ? 0 : k > 0.3 ? 0.22 : 0.5;
            for (int j = 0; j < A.MH; j++)
                for (int i = 0; i < A.MW; i++)
                {
                    int q = j * A.MW + i;
                    if (A.Mask[q] == 0) continue;
                    double l = A.Pixels != null ? Col.Luma(A.Pixels[q]) : 0.6;
                    if (l < cut) continue;
                    p.Px(A.X + i, A.Y + j, l > 0.5 ? (k > 0.8 ? Col.WHITE : ramp[2]) : l > 0.22 ? ramp[1] : ramp[0]);
                }
        }

        /// 照亮角色：身上一層暖色加法光（越上面越強），暗框內側一圈受光的邊（rim），混進原本的顏色。
        public static void LightActor(Painter p, Actor A, uint c, double k, double rim = 0, double t = 0)
        {
            if (A == null || (k <= 0.01 && rim <= 0.01)) return;
            for (int j = 0; j < A.MH; j++)
                for (int i = 0; i < A.MW; i++)
                {
                    if (A.Mask[j * A.MW + i] == 0) continue;
                    if (k > 0.01) p.LightAt(A.X + i, A.Y + j, c, k * (1.1 - (0.5 * j) / A.MH));
                    if (rim <= 0.01 || !A.At(i - 1, j) || !A.At(i + 1, j) || !A.At(i, j - 1)) continue;
                    if (A.At(i - 2, j) && A.At(i + 2, j) && A.At(i, j - 2)) continue;
                    double f = rim * (0.75 + 0.35 * Noise(j * 0.6 - t * 8, i * 3));
                    if (f > 0.25)
                    {
                        uint baseC = A.Pixels != null ? (A.Pixels[j * A.MW + i] != 0 ? A.Pixels[j * A.MW + i] : c) : c;
                        p.Px(A.X + i, A.Y + j, Col.Mix(baseC, c, Math.Min(0.85, f)));
                    }
                }
        }

        /// 角色外面一圈閃爍的 1px 光線（光環的邊）。照 painter.outline。
        public static void HaloActor(Painter p, Actor A, uint c, double k, double t = 0)
        {
            if (A == null || k <= 0.02) return;
            for (int my = -1; my <= A.MH; my++)
                for (int mx = -1; mx <= A.MW; mx++)
                    if (!A.At(mx, my) && (A.At(mx - 1, my) || A.At(mx + 1, my) || A.At(mx, my - 1) || A.At(mx, my + 1)))
                        p.Dot(A.X + mx, A.Y + my, c, k * (0.75 + 0.45 * Noise(my * 0.45 - t * 7, mx * 3)));
        }
    }

    public static class LevelUp
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Level up", W = 176, H = 138, OX = 88, OY = 114, Duration = 3.2, Loop = false, Fps = 30, ActorK = 2,
            Options = new FxOptions { Palette = new[] { "#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff" }, Seed = 5 }.Set("text", "LEVEL UP!"),
            Create = Create,
        };

        // 釋放、光柱離地、光柱消失、光柱高、字頂、第一個字、間隔、亮光、字跳走
        const double REL = 0.28, RET = 1.02, GONE = 1.34, TOP = 100, TY = -68, DROP = 0.5, STAG = 0.05, LANDED = 1.06, SHINE = 1.24, EXIT = 2.3, DUR = 3.2;
        class Strand { public double x, sp, per, duty, ph, end; public int lvl; }
        // 沿光柱往上流的光絲（一段一段）：橫向位置、速度、週期、長度
        static readonly Strand[] STRANDS = Enumerable.Range(0, 9).Select(i => new Strand
        {
            x = ((double)i / 8 - 0.5) * 1.5 + (Rand(i, 1) - 0.5) * 0.16, sp = 170 + Rand(i, 2) * 170, per = 10 + Rand(i, 3) * 16, duty = 0.3 + Rand(i, 4) * 0.35,
            ph = Rand(i, 5), lvl = Rand(i, 6) < 0.35 ? 1 : 2, end = 0.5 + Rand(i, 7) * 0.42,
        }).ToArray();

        // 光柱在 t 時的半寬
        static double WidthAt(double t) => t < REL ? 0 : 12 * (1 + 0.4 * Exp(-(t - REL) * 10)) * (1 - 0.82 * Smooth(RET - 0.12, RET + 0.16, t));

        // 光柱：從腳下射上去（白熱一格），然後是光不是顏料：兩道流動的牆、白心、往上流的光絲；最後腳離地往上射走
        static void Column(Painter p, uint[] C, double t)
        {
            uint WHITE = Col.WHITE;
            double a = t - REL;
            if (a < 0 || t > GONE) return;
            double top = -TOP * Ease.OutExpo(Clamp(a / 0.12)), bot = -TOP * Ease.InCubic(Seg(t, RET, GONE)), W = WidthAt(t), k = 1 - Smooth(RET, GONE, t);
            p.GlowLine(0, top, 0, Math.Min(bot, -34), W * 1.6 + 6, C[5], 0.2 * k + 0.06);
            p.GlowLine(0, top, 0, Math.Min(bot, -40), 5, WHITE, 0.18 * k);
            if (a < 0.04)
            {
                for (double y = Math.Floor(top); y < bot; y++)
                {
                    double wr = W * 0.55 * (1 - 0.3 * (-y / TOP));
                    for (double x = Math.Floor(-wr); x <= Math.Ceiling(wr); x++) p.Dot(x, y, Math.Abs(x + 0.5) < wr - 1.5 ? WHITE : C[6], Clamp((y + TOP) / 20) * 1.5);
                }
                return;
            }
            for (double y = Math.Ceiling(top); y < Math.Ceiling(bot); y++)
            {
                double h = -y / TOP, fade = Clamp((y + TOP) / 16) * (t < RET ? 1 : Clamp((bot - y) / 10)); bool head = y - top < 3 && a < 0.16;
                double wr = W * (1 - 0.3 * h) + 0.9 * Noise2(y * 0.2, t * 12, 3);
                foreach (double s in new[] { -1.0, 1.0 })
                {
                    bool run = Fract(y * 0.06 + t * 3.4 + (s > 0 ? 0.5 : 0)) < 0.78; double xw = s * wr;
                    p.Dot(xw, y, head ? WHITE : run ? C[6] : C[5], fade * 1.4);
                    p.Dot(xw + s, y, C[4], fade * (run ? 0.5 : 0.25));
                    if (run) p.Dot(xw - s, y, C[5], fade * 1.2);
                }
                p.Dot(0, y, WHITE, fade * 1.6);
                p.Dot(-1, y, Noise2(y * 0.3, t * 14, 5) > -0.2 ? WHITE : C[6], fade * 1.3);
                if (Noise2(y * 0.25, t * 9, 8) > 0.25) p.Dot(1, y, C[6], fade * 1.2);
                foreach (var S in STRANDS)
                {
                    if (h > S.end) continue;
                    double ph = Fract((y + t * S.sp) / S.per + S.ph);
                    if (ph > S.duty) continue;
                    double u = ph / S.duty;
                    p.Px(S.x * wr, y, head || u < 0.2 ? WHITE : u < 0.65 ? C[7 - S.lvl] : C[6 - S.lvl]);
                }
            }
        }

        // 光柱底下那片光
        static void Plate(Painter p, uint[] C, double t, double k)
        {
            if (k <= 0.02) return;
            double rx = 9 + 9 * k + Sin(t * 9); const double ry = 2.2;
            p.Shade(-rx, -ry, rx, ry, (double x, double y, ref Painter.Out o) =>
            {
                double dx = x / rx, dy = y / ry, d = Math.Sqrt(dx * dx + dy * dy);
                if (d > 1) return;
                double u = d / Math.Max(0.05, k);
                o.c = u < 0.3 ? Col.WHITE : u < 0.55 ? C[6] : u < 0.8 ? C[5] : C[4];
                o.a = d < 0.6 * k ? 1 : k * (1 - d) * 2.2;
            });
            p.Glow(0, -1, rx * 2.2, C[4], 0.35 * k);
        }

        // 字上下的一圈光芒：從字外面一點的橢圓出發（不穿過字），最後一個字落地時射出、閃爍、再收回
        static void Rays(Painter p, uint[] C, double t, double k, double cx, double cy)
        {
            if (k <= 0.02) return;
            for (int i = 0; i < 20; i++)
            {
                double an = ((double)i / 20) * TAU + 0.08, ca = Cos(an), sa = Sin(an); bool lng = i % 2 == 0;
                if (Math.Abs(sa) < 0.4) continue;
                double r0 = 1 / Math.Sqrt(Pow(ca / 52, 2) + Pow(sa / 12, 2)) + 2 * k, len = (lng ? 15 + 7 * Rand(i, 9) : 7 + 4 * Rand(i, 8)) * k;
                if (len < 1) continue;
                double sh = 0.75 + 0.25 * Sin(t * 7 + i * 2.1), x0 = cx + ca * r0, y0 = cy + sa * r0;
                p.Line(x0, y0, x0 + ca * len, y0 + sa * len, u => u < 0.3 ? C[7] : u < 0.6 ? C[6] : C[5], u => sh * (u < 0.55 ? 1.3 : (1.3 * (1 - u)) / 0.45));
            }
        }

        class Let { public Glyph g; public double w, cx, born, pop, off, v, sq, flash; public bool on, landed, rest, burst; }
        class Sat { public double x, y, t0, dur, L; }
        class Rush { public double x, y, vx, vy, life, len; public uint c; public bool back; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); var R = new Rng((uint)o.SeedOr0); var A = o.Actor; uint SHADOW = Col.Scale(C[0], 0.5);
            var ps = new Particles(R, sparks: new[] { C[7], C[6], C[5], C[3] }, ground: x => 0); var lights = new Lights();
            double t = 0;
            // 結束前每顆粒子都會消失
            void Spawn(int k, double x, double y, double vx, double vy, double life, uint col = 0xffffffff, double size = 1, double delay = 0, int flag = 0) =>
                ps.Spawn(k, x, y, vx, vy, Math.Min(life, DUR - 0.05 - t), col, size, delay, flag);
            var word = UiLib.Spell(o.Str["text"]); const double BASE = TY + 14; double X0 = -word.w;
            var lets = new List<Let>(); int li = 0;
            foreach (var L in word.letters) if (L.g != null) { lets.Add(new Let { g = L.g, w = L.w, cx = X0 + (L.x + L.w / 2.0) * 2, born = DROP + li * STAG, pop = EXIT + li * 0.04, off = -18, v = 60 }); li++; }
            double right = X0 + word.w * 2;
            // 字周圍一顆接一顆冒出來的星光
            var sats = new List<Sat>();
            for (int i = 0; i < 8; i++)
            {
                double s = i % 2 != 0 ? 1 : -1, x = s * R.Range(20, 60), y = TY + 7 + (Math.Abs(x) < 50 ? R.Sign() * R.Range(11, 18) : R.Range(-14, 14));
                var q = new Sat { x = x, y = y }; q.t0 = SHINE - 0.1 + i * 0.13 + R.Range(0, 0.05); q.dur = R.Range(0.32, 0.5); q.L = R.Range(3, 6);
                sats.Add(q);
            }
            var halos = new List<double>();
            bool released = false; double nextHalo = REL + 0.03, gather = 0;
            var rush = new List<Rush>();
            // 聚光的線：金色尾巴、白色頭，直直衝進來
            void DrawRush(Painter p, bool back)
            {
                foreach (var m in rush)
                {
                    if (m.back != back) continue;
                    double sp = Hypot(m.vx, m.vy), ux = m.vx / sp, uy = m.vy / sp, L = m.len;
                    p.Line(m.x - ux * L, m.y - uy * L, m.x - ux * L * 0.4, m.y - uy * L * 0.4, m.c);
                    p.Line(m.x - ux * L * 0.35, m.y - uy * L * 0.35, m.x, m.y, WHITE);
                    p.Glow(m.x, m.y, 4, C[5], 0.25);
                }
            }
            Func<double, bool> far = g => Sin(g) < 0, near = g => Sin(g) >= 0;
            var RINGS = new[] { new[] { 0, 72, 4.0 }, new[] { 0.08, 46, 2.5 } };
            void Rings(Painter p, Func<double, bool> keep)
            {
                if (t < REL)
                {
                    double k = Seg(t, 0.02, REL);
                    Sim.Band(p, 0, 0, 4 + 52 * (1 - Ease.InQuad(k)), 0.2, 1.5, k * 1.1, C, keep);
                }
                foreach (var rg in RINGS)
                {
                    double d = rg[0], r1 = rg[1], th = rg[2], k = (t - REL - d) / 0.55;
                    if (k > 0 && k < 1) Sim.Band(p, 0, 0, 5 + r1 * Ease.OutCubic(k), 0.2, Math.Max(1, th * (1 - k)), 1.15 - k, C, keep, k < 0.15);
                }
                foreach (double h0 in halos)
                {
                    double k = (t - h0) / 0.6;
                    if (k > 0 && k < 1) Sim.Band(p, 0, -2 - 72 * Ease.OutQuad(k), (WidthAt(t) * 1.45 + 4) * (1 - 0.4 * k), 0.3, 1.5, (1 - k) * 1.4, C, keep, k < 0.12);
                }
            }

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    // 聚光：光線沿地面衝到腳下、從四周衝進身體，最後一拍從腳往上跑；晚到的被爆發吞掉
                    for (gather += t < REL ? dt * 420 : 0; gather >= 1; gather--)
                    {
                        double kind = R.Next(), sp = R.Range(140, 250) * (1 + t * 2);
                        double x, y, tx, ty;
                        if (kind < 0.42)
                        {
                            double an = R.Range(0, TAU), D = R.Range(22, 70);
                            x = Cos(an) * D; y = -1 - Math.Abs(Sin(an)) * D * 0.1; tx = Cos(an) * 3; ty = -1;
                        }
                        else if (kind < 0.84)
                        {
                            double an = R.Range(0, TAU), D = R.Range(34, 64);
                            x = Cos(an) * D; y = Math.Min(-3, -20 + Sin(an) * D * 0.85); tx = Cos(an) * 11; ty = -20 + Sin(an) * 14;
                        }
                        else
                        {
                            if (t < REL * 0.4) continue;
                            x = R.Range(-9, 9); y = -1; tx = x * 0.7; ty = -R.Range(26, 44);
                        }
                        double dx = tx - x, dy = ty - y, l = Hypot(dx, dy); if (l == 0 || double.IsNaN(l)) l = 1;
                        var m = new Rush { x = x, y = y, vx = (dx / l) * sp, vy = (dy / l) * sp, life = Math.Min(l / sp, REL + 0.06 - t) };
                        m.len = R.Range(5, 9); m.c = R.Chance(0.45) ? C[6] : C[5]; m.back = kind > 0.84 && R.Chance(0.5);
                        rush.Add(m);
                    }
                    for (int i = rush.Count - 1; i >= 0; i--)
                    {
                        var m = rush[i];
                        if ((m.life -= dt) <= 0) rush.RemoveAt(i);
                        else { m.x += m.vx * dt; m.y += m.vy * dt; }
                    }
                    if (t < REL && R.Chance(0.12)) Spawn(P.STAR, R.Range(-30, 30), -R.Range(0, 3), 0, -R.Range(10, 30), R.Range(0.3, 0.5), C[6], 0.6);
                    if (!released && t >= REL)
                    {
                        released = true;
                        lights.Add(0, -24, 90, C[5], 0.6, 0.7);
                        lights.Add(0, -8, 40, WHITE, 0.6, 0.12);
                        // 從主角甩出去的速度線
                        for (int i = 0; i < 22; i++)
                        {
                            double an = ((double)i / 22) * TAU + R.Range(-0.12, 0.12), sp = R.Range(260, 460);
                            double y0 = -18 + Sin(an) * 8, vy = Sin(an) * sp * 0.8, life = Math.Min(Math.Min(R.Range(0.1, 0.2), vy > 0 ? -y0 / vy : vy < 0 ? (y0 + 104) / -vy : 1), 78 / Math.Abs(Cos(an) * sp));
                            Spawn(P.MOTE, Cos(an) * 6, y0, Cos(an) * sp, vy, life, R.Chance(0.4) ? C[7] : C[6], 1, 0, an > 0.3 && an < Math.PI - 0.3 ? PFlag.BACK : 0);
                        }
                        for (int i = 0; i < 26; i++)
                        {
                            double an = -Math.PI / 2 + R.Range(-1.3, 1.3), sp = R.Range(120, 290);
                            Spawn(P.SPARK, R.Range(-5, 5), -2, Cos(an) * sp, Sin(an) * sp, R.Range(0.35, 0.8));
                        }
                        for (int i = 0; i < 16; i++)
                            Spawn(P.STAR, R.Range(-10, 10), R.Range(-36, -4), R.Range(-30, 30), -R.Range(15, 60), R.Range(0.6, 1.3), R.Pick(new[] { C[7], C[6], C[5] }), R.Chance(0.35) ? R.Range(1.5, 2.6) : R.Range(0.4, 0.9), 0, R.Chance(0.4) ? PFlag.BACK : 0);
                    }
                    double W = WidthAt(t);
                    if (t >= nextHalo && t < RET - 0.1) { halos.Add(t); nextHalo += 0.16; }
                    // 光柱旁邊往上衝的線
                    if (t > REL && t < RET + 0.1 && R.Chance(0.5))
                    {
                        int s = R.Sign();
                        double y = R.Range(-4, -60), vy = -R.Range(140, 260);
                        Spawn(P.MOTE, s * R.Range(0.75, 1.6) * W, y, 0, vy, Math.Min(R.Range(0.16, 0.32), (y + 96) / -vy), R.Chance(0.5) ? C[7] : C[6], R.Range(0.6, 1), 0, R.Chance(0.5) ? PFlag.BACK : 0);
                    }
                    // 光還在的時候地上飄起光點
                    if (t > REL && t < 2.4 && R.Chance(0.14 * (1 - Seg(t, 1.6, 2.4))))
                        Spawn(P.EMBER, R.Range(-20, 20), -R.Range(1, 30), R.Range(-15, 15), -R.Range(20, 55), R.Range(0.8, 1.6), C[5], R.Range(1, 2), 0, R.Chance(0.4) ? PFlag.BACK : 0);
                    // 主角身上飄起金色光點
                    if (A != null && t > REL + 0.1 && t < 2.2 && R.Chance(0.09))
                    {
                        for (int n = 0; n < 12; n++)
                        {
                            int i = R.Int(0, A.MW - 1), j = R.Int(0, A.MH - 1);
                            if (A.Mask[j * A.MW + i] == 0) continue;
                            Spawn(P.STAR, A.X + i + 0.5, A.Y + j + 0.5, R.Range(-8, 8), -R.Range(14, 34), R.Range(0.6, 1.1), R.Pick(new[] { C[7], C[6], C[5] }), R.Chance(0.2) ? 1.5 : 0.6, 0, R.Chance(0.5) ? PFlag.BACK : 0);
                            break;
                        }
                    }
                    // 停住的時候字和主角周圍閃爍
                    if (t > 1.0 && t < 2.5 && R.Chance(0.13))
                    {
                        bool up = R.Chance(0.6); double x = up ? R.Range(-58, 58) : R.Range(-20, 20), y = up ? TY + 7 + R.Range(-16, 16) : R.Range(-44, -6);
                        Spawn(P.STAR, x, y, R.Range(-6, 6), -R.Range(4, 14), R.Range(0.4, 0.8), R.Pick(new[] { C[7], C[6], C[6], C[5] }), R.Chance(0.3) ? R.Range(1.5, 2.4) : 0.6, 0, R.Chance(0.3) ? PFlag.BACK : 0);
                    }
                    // 字掉下來、彈一下、停住；之後一個一個跳走
                    foreach (var L in lets)
                    {
                        if (t < L.born) continue;
                        L.on = true;
                        if (!L.rest)
                        {
                            L.v += 1700 * dt;
                            L.off += L.v * dt;
                            if (L.off >= 0 && L.v > 0)
                            {
                                L.off = 0;
                                if (L.v > 110)
                                {
                                    L.sq = 1;
                                    if (!L.landed)
                                    {
                                        L.landed = true;
                                        L.flash = 1;
                                        lights.Add(L.cx, BASE - 7, 18, C[5], 0.55, 0.25);
                                        foreach (double s in new[] { -1.0, 1.0 }) Spawn(P.STAR, L.cx + s * L.w, BASE - R.Range(0, 3), s * R.Range(15, 40), -R.Range(5, 25), R.Range(0.25, 0.45), C[6], R.Range(0.5, 1.2));
                                    }
                                    L.v = -L.v * 0.3;
                                }
                                else { L.v = 0; L.rest = true; }
                            }
                        }
                        L.sq = Math.Max(0, L.sq - dt / 0.1);
                        L.flash = Math.Max(0, L.flash - dt / 0.12);
                        if (!L.burst && t >= L.pop + 0.06)
                        {
                            L.burst = true;
                            for (int i = 0; i < 3; i++)
                            {
                                double an = R.Range(0, TAU), sp = R.Range(20, 55);
                                Spawn(P.STAR, L.cx + R.Range(-3, 3), BASE - 7 + R.Range(-4, 4), Cos(an) * sp, Sin(an) * sp - 15, R.Range(0.3, 0.6), R.Pick(new[] { C[7], C[6] }), i != 0 ? 0.6 : R.Range(1.2, 2));
                            }
                        }
                    }
                    ps.Update(dt);
                    lights.Update(dt);
                },

                DrawBack = (p, _, __) =>
                {
                    Rays(p, C, t, Ease.OutExpo(Seg(t, LANDED, LANDED + 0.2)) * (1 - Ease.InQuad(Seg(t, EXIT - 0.15, EXIT + 0.1))), 0, TY + 7);
                    Rings(p, far);
                    Column(p, C, t);
                    Plate(p, C, t, t < REL ? 0.55 * Seg(t, 0.05, REL) : 1 - Smooth(RET - 0.1, GONE + 0.2, t));
                    ps.Draw(p, "back");
                    DrawRush(p, true);
                },

                Draw = (p, _, __) =>
                {
                    // 光環的近半邊，在主角前面
                    Rings(p, near);
                    // 主角：聚光時變暖，釋放時閃白，之後被金光照亮、邊緣發光
                    double lit = Smooth(REL - 0.02, REL + 0.04, t) * (1 - Smooth(RET, 2.5, t));
                    UiLib.TintActor(p, A, t < REL ? 0 : t < REL + 0.06 ? 1 : Exp(-(t - REL - 0.06) / 0.07), new[] { C[4], C[5], C[6] });
                    UiLib.LightActor(p, A, C[5], 0.1 * Seg(t, 0.05, REL) * (1 - lit) + 0.06 * lit, 0.6 * lit, t);
                    UiLib.HaloActor(p, A, C[5], 0.85 * lit * (1 - Smooth(RET, GONE + 0.3, t)) + 0.3 * lit, t);
                    // 腳下聚起的星光，然後釋放的閃光
                    if (t < REL)
                    {
                        double k = Seg(t, 0.05, REL), beat = 1 + 0.4 * Exp(-Pow(t - REL * 0.6, 2) / 0.001);
                        Sim.Sparkle(p, 0, -2, (1 + 4 * k * k) * beat, C[6], C[5], 0.3 + 0.4 * k);
                    }
                    else if (t < REL + 0.22)
                    {
                        double a = (t - REL) / 0.22;
                        Sim.Flare(p, 0, -4, 28 * Pow(1 - a, 1.5), 1 - a, C);
                        p.Glow(0, -16, 48, WHITE, 0.3 * (1 - a));
                    }
                    ps.Draw(p, "front");
                    DrawRush(p, false);
                    // 標題
                    var items = new List<UiLib.WordItem>(); double done = (t - LANDED) / 0.12;
                    foreach (var L in lets)
                    {
                        if (!L.on) continue;
                        double sx = 2, sy = 2, flash = L.flash;
                        if (!L.landed && L.v > 150) { sx = 1.8; sy = 2.3; }
                        if (L.sq > 0) { sx = 2 * (1 + 0.22 * L.sq); sy = 2 * (1 - 0.22 * L.sq); }
                        double pu = (t - L.pop) / 0.07, hop = Seg(t, L.pop - 0.1, L.pop);
                        if (pu >= 1) continue;
                        if (hop > 0 && pu <= 0) { sx = 2 * (1 - 0.1 * hop); sy = 2 * (1 + 0.15 * hop); }
                        if (pu > 0) { sx = sy = 2 * (1 + 0.3 * pu); flash = 1; }
                        flash = Math.Max(flash, done > 0 && done < 1 ? 1 - done : 0);
                        double h = 7 * sy, w = L.w * sx;
                        items.Add(new UiLib.WordItem { g = L.g, x = L.cx - w / 2, y = BASE + L.off - h - 3 * Ease.OutQuad(hop), sx = sx, sy = sy, a = Clamp((t - L.born) / 0.05), flash = flash });
                    }
                    double sh = Seg(t, SHINE, SHINE + 0.34); double? shine = sh > 0 && sh < 1 ? X0 - 14 + (right - X0 + 30) * Ease.InOutSine(sh) : (double?)null;
                    UiLib.DrawWord(p, items, new UiLib.WordStyle { fill = new[] { C[3], C[4], C[5], C[6] }, edge = WHITE, under = C[2], outline = C[0], shadow = SHADOW, shine = shine, shineY = TY, glint = C[6] });
                    if (shine.HasValue && shine.Value > X0 && shine.Value < right) p.GlowLine(shine.Value, TY, shine.Value + 8.4, BASE, 9, C[6], 0.3);
                    double hold = Smooth(0.9, 1.2, t) * (1 - Smooth(EXIT, EXIT + 0.4, t));
                    if (hold > 0) p.Glow(0, TY + 7, 50, C[5], 0.22 * hold + (done > 0 && done < 1 ? 0.3 * (1 - done) : 0));
                    // 每個字跳走的地方閃一下
                    foreach (var L in lets)
                    {
                        double u = (t - L.pop - 0.07) / 0.16;
                        if (u > 0 && u < 1) Sim.Sparkle(p, L.cx, BASE - 7, 6 * (1 - u) * (1 - u), C[6], C[5], 0.5);
                    }
                    // 亮光離開字的地方一道閃光，周圍冒出星光
                    double gg = (t - SHINE - 0.3) / 0.26;
                    if (gg > 0 && gg < 1) Sim.Sparkle(p, right - 2, TY + 1, 7 * Sin(gg * Math.PI), C[6], C[5], 0.6);
                    foreach (var s in sats)
                    {
                        double u = (t - s.t0) / s.dur;
                        if (u > 0 && u < 1) Sim.Sparkle(p, s.x, s.y, s.L * Pow(Sin(u * Math.PI), 0.7), C[6], C[5], 0.5);
                    }
                    lights.Draw(p);
                },
            };
        }
    }
}
