// 網頁版標題畫面、開場動畫用的 2D 畫布（canvas 2d）在 C# 的小版本：只做那兩個檔案用到的功能。
//   畫布：寬 W×高 216（遊戲解析度），存 Color（0～1，上到下），最後貼成 Texture2D 放大到全螢幕。
//   fillRect（半透明疊上去）、drawImage（整數位置、可以左右翻、透明度、遮罩）、圓形漸層光暈（一般／lighter 疊加）、
//   漸層線、把幾條橫切片左右錯開（雜訊）、平移（translate）。文字不在畫布上畫，交給 UI 疊在上面（字要清楚）。
using System;
using System.Collections.Generic;
using UnityEngine;

namespace ZeroStar.UI
{
    /// 一張圖（像素，上到下）
    public class Img
    {
        public readonly int W, H; public readonly Color[] Px;
        public Img(int w, int h) { W = w; H = h; Px = new Color[w * h]; }
        /// 從 Resources 讀 PNG（Texture2D 要可讀；UiImport 會設）
        public static Img Load(string res)
        {
            var t = Resources.Load<Texture2D>(res); if (t == null) return null;
            var src = t.GetPixels(); var im = new Img(t.width, t.height);
            for (int y = 0; y < t.height; y++) Array.Copy(src, (t.height - 1 - y) * t.width, im.Px, y * t.width, t.width);
            return im;
        }
        public static Img FromFrame(PixelFX.Frame f, byte[] rgba)
        {
            var im = new Img(f.W, f.H);
            for (int i = 0; i < im.Px.Length; i++) im.Px[i] = new Color(rgba[i * 4] / 255f, rgba[i * 4 + 1] / 255f, rgba[i * 4 + 2] / 255f, rgba[i * 4 + 3] / 255f);
            return im;
        }
    }

    public class Pix2D
    {
        public int W { get; private set; }
        public readonly int H;
        public Color[] Px;
        public bool Lighter;                 // globalCompositeOperation = "lighter"
        public float Alpha = 1;              // globalAlpha
        public int Tx, Ty;                   // translate
        Texture2D tex; Color32[] up;

        public Pix2D(int w, int h) { H = h; Resize(w); }
        public void Resize(int w)
        {
            W = w; Px = new Color[w * H]; up = new Color32[w * H];
            if (tex != null) UnityEngine.Object.Destroy(tex);
            tex = new Texture2D(w, H, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
        }
        public Texture2D Texture => tex;
        /// 畫完了：貼到貼圖（下到上）
        public Texture2D Upload()
        {
            for (int y = 0; y < H; y++) { int s = y * W, d = (H - 1 - y) * W; for (int x = 0; x < W; x++) up[d + x] = Px[s + x]; }
            tex.SetPixels32(up); tex.Apply(false);
            return tex;
        }

        void Blend(int x, int y, Color c, float a)
        {
            x += Tx; y += Ty;
            if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
            int i = y * W + x; var d = Px[i];
            if (Lighter) { d.r = Mathf.Min(1, d.r + c.r * a); d.g = Mathf.Min(1, d.g + c.g * a); d.b = Mathf.Min(1, d.b + c.b * a); d.a = Mathf.Min(1, d.a + a); }
            else { float ia = 1 - a, oa = a + d.a * ia; if (oa <= 0) return; d.r = (c.r * a + d.r * d.a * ia) / oa; d.g = (c.g * a + d.g * d.a * ia) / oa; d.b = (c.b * a + d.b * d.a * ia) / oa; d.a = oa; }
            Px[i] = d;
        }
        public void Clear() { Array.Clear(Px, 0, Px.Length); }
        public void FillRect(double x, double y, double w, double h, Color c)
        {
            int x0 = (int)Math.Round(x), y0 = (int)Math.Round(y), x1 = (int)Math.Round(x + w), y1 = (int)Math.Round(y + h);
            float a = c.a * Alpha;
            for (int yy = Math.Max(y0, -Ty); yy < Math.Min(y1, H - Ty); yy++) for (int xx = Math.Max(x0, -Tx); xx < Math.Min(x1, W - Tx); xx++) Blend(xx, yy, c, a);
        }
        public void Fill(Color c) { int tx = Tx, ty = Ty; Tx = Ty = 0; FillRect(0, 0, W, H, c); Tx = tx; Ty = ty; }
        /// drawImage(im, x, y)：整數位置；flip＝左右翻；mask(x, y)＝畫布座標這一格要不要畫（clip）
        public void DrawImage(Img im, double x, double y, bool flip = false, Func<int, int, bool> mask = null)
        {
            if (im == null) return;
            int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y);
            for (int j = 0; j < im.H; j++)
            {
                int yy = y0 + j; if (yy + Ty < 0 || yy + Ty >= H) continue;
                for (int i = 0; i < im.W; i++)
                {
                    int xx = x0 + i; if (xx + Tx < 0 || xx + Tx >= W) continue;
                    var c = im.Px[j * im.W + (flip ? im.W - 1 - i : i)]; if (c.a <= 0) continue;
                    if (mask != null && !mask(xx, yy)) continue;
                    Blend(xx, yy, c, c.a * Alpha);
                }
            }
        }
        /// drawImage 縮放版（最近點取樣）：把 im 畫成 dw×dh
        public void DrawImageScaled(Img im, double x, double y, double dw, double dh)
        {
            if (im == null || dw <= 0 || dh <= 0) return;
            int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y), w = (int)Math.Round(dw), h = (int)Math.Round(dh);
            for (int j = 0; j < h; j++) for (int i = 0; i < w; i++)
            {
                var c = im.Px[Math.Min(im.H - 1, j * im.H / h) * im.W + Math.Min(im.W - 1, i * im.W / w)]; if (c.a <= 0) continue;
                Blend(x0 + i, y0 + j, c, c.a * Alpha);
            }
        }
        /// 橫向重複貼（城鎮的遠景、中景、地面）：x 是偏移
        public void Tile(Img im, double x, double y)
        {
            if (im == null) return;
            int w = im.W; int sx = (int)Math.Floor(x % w); if (sx > 0) sx -= w;
            for (int xx = sx; xx < W; xx += w) DrawImage(im, xx, Math.Round(y));
        }
        /// createRadialGradient(cx, cy, r0, cx, cy, r1)：stops＝(位置, 顏色含透明度)；畫在 (rx, ry, rw, rh) 這塊
        public void Radial(double cx, double cy, double r0, double r1, (float t, Color c)[] stops, double rx, double ry, double rw, double rh)
        {
            int x0 = (int)Math.Floor(rx), y0 = (int)Math.Floor(ry), x1 = (int)Math.Ceiling(rx + rw), y1 = (int)Math.Ceiling(ry + rh);
            for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++)
            {
                double d = Math.Sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy));
                float t = (float)Math.Max(0, Math.Min(1, (d - r0) / Math.Max(1e-6, r1 - r0)));
                var c = Stop(stops, t); Blend(x, y, c, c.a * Alpha);
            }
        }
        static Color Stop((float t, Color c)[] s, float t)
        {
            if (t <= s[0].t) return s[0].c;
            for (int i = 1; i < s.Length; i++) if (t <= s[i].t) { float k = (t - s[i - 1].t) / Math.Max(1e-6f, s[i].t - s[i - 1].t); return Color.Lerp(s[i - 1].c, s[i].c, k); }
            return s[s.Length - 1].c;
        }
        /// 一團光：中心 (x, y) 半徑 r，顏色 col，中心透明度 a 往外淡到 0（網頁版的 glow）
        public void Glow(double x, double y, double r, Color col, float a)
        {
            if (r <= 0 || a <= 0) return;
            var c0 = col; c0.a = a; var c1 = col; c1.a = 0;
            Radial(x, y, 0, r, new[] { (0f, c0), (1f, c1) }, x - r, y - r, r * 2, r * 2);
        }
        /// 漸層線（stroke）：從 (x0,y0) 到 (x1,y1)，寬 w，顏色從 c0 漸到 c1
        public void GradLine(double x0, double y0, double x1, double y1, float w, Color c0, Color c1)
        {
            double dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy; if (len2 <= 0) return;
            int bx0 = (int)Math.Floor(Math.Min(x0, x1) - w), bx1 = (int)Math.Ceiling(Math.Max(x0, x1) + w), by0 = (int)Math.Floor(Math.Min(y0, y1) - w), by1 = (int)Math.Ceiling(Math.Max(y0, y1) + w);
            for (int y = by0; y <= by1; y++) for (int x = bx0; x <= bx1; x++)
            {
                double px = x + 0.5 - x0, py = y + 0.5 - y0, t = (px * dx + py * dy) / len2; if (t < 0 || t > 1) continue;
                double ex = px - t * dx, ey = py - t * dy, dist = Math.Sqrt(ex * ex + ey * ey);
                float cov = Mathf.Clamp01((float)(w / 2 + 0.5 - dist)); if (cov <= 0) continue;
                var c = Color.Lerp(c0, c1, (float)t); Blend(x, y, c, c.a * cov * Alpha);
            }
        }
        /// 雜訊：把第 y 列開始 h 列整條往旁邊錯開 dx（drawImage(canvas, 0, y, W, h, dx, y, W, h)）
        public void ShiftRows(int y, int h, int dx)
        {
            if (dx == 0) return;
            var row = new Color[W];
            for (int yy = Math.Max(0, y); yy < Math.Min(H, y + h); yy++)
            {
                Array.Copy(Px, yy * W, row, 0, W);
                for (int x = 0; x < W; x++) { int sx = x - dx; if (sx < 0 || sx >= W) continue; var c = row[sx]; if (c.a > 0) Px[yy * W + x] = c.a >= 1 ? c : Color.Lerp(Px[yy * W + x], c, c.a); }
            }
        }
        /// 一個 PixelFX 畫面（composite 完的 rgba，bg 透明）疊上來
        public void DrawRgba(byte[] rgba, int w, int h)
        {
            for (int y = 0; y < Math.Min(h, H); y++) for (int x = 0; x < Math.Min(w, W); x++)
            {
                int i = (y * w + x) * 4; float a = rgba[i + 3] / 255f; if (a <= 0) continue;
                var c = new Color(rgba[i] / 255f, rgba[i + 1] / 255f, rgba[i + 2] / 255f); int tx = Tx, ty = Ty; Tx = Ty = 0; Blend(x, y, c, a * Alpha); Tx = tx; Ty = ty;
            }
        }
        public static Color Rgba(int r, int g, int b, float a) => new Color(r / 255f, g / 255f, b / 255f, a);
        public static Color Hex(string h, float a = 1) { ColorUtility.TryParseHtmlString(h, out var c); c.a = a; return c; }
    }

    /// 畫面上疊的字（畫布不畫字，交給 UI）：這一格要顯示哪些字
    public struct OverText { public string S; public double X, Y; public string Col; public float Size; public int Align; public float Alpha; }   // Align：0 左、1 中、2 右；位置是畫布座標
}
