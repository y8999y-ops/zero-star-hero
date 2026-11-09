// title.js：主畫面。遊戲解析度（高 216）的像素場景，放大蓋滿全螢幕：
//   流星夜空（慢慢往左飄）→ 遠景的山與墜落的巨大星星（柔和的星光呼吸）→ 中景碎星鎮 → 前景草地，主角站在右下方。
//   星屑往上飄、四周壓暗；標題字在上方中間輕輕浮動，後面一圈慢慢轉的金色光芒，每 4 秒一道斜光掃過字，邊上十字星光輪流閃。
//   選單（UI，字要清楚）在標題下面置中：開始冒險（金色主按鈕）、操作說明、設定；左下「第一章 試玩版」、右下版本。
using System;
using System.Collections.Generic;
using PixelFX;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class Title
    {
        const int H = 216;
        readonly VisualElement root, cv, menu, help; readonly Label startLabel; readonly VisualElement startStar;
        Pix2D g; Img far, mid, ground, fg, logo, white, skyImg; readonly Dictionary<int, Img> heroCache = new Dictionary<int, Img>();
        (int ax, int ay) heroAnchor;
        public Action OnStart, OnSettings; public Action<string> Sfx;
        public string Form = "star";
        public bool Open { get; private set; }
        float t, last = -1, skyLast;
        // 天空（starsky.js：shooting-stars 疊在漸層上）
        NightSky sky;
        // 天上的星星、往上飄的星屑（固定亂數）
        readonly (double x, double y, double v, double p)[] dust = new (double, double, double, double)[26];

        public Title(VisualElement parent)
        {
            root = Box(parent, "start"); Abs(root, 0, 0, 0, 0); root.style.backgroundColor = C("#08060e"); root.style.overflow = Overflow.Hidden; root.style.display = DisplayStyle.None;
            root.pickingMode = PickingMode.Position;
            cv = Box(root, "titleCv"); Abs(cv); cv.style.left = Length.Percent(50); cv.style.top = Length.Percent(50);
            // 選單
            menu = Box(root, "tmenu"); Abs(menu); menu.style.left = Length.Percent(50); menu.style.top = Length.Percent(47); menu.style.translate = new Translate(Length.Percent(-50), 0); menu.style.alignItems = Align.Center;
            var sb = Plate(menu, true); startLabel = sb.Q<Label>();
            startStar = Box(sb); Abs(startStar, 16 + 6, null); startStar.style.top = Length.Percent(50); startStar.style.marginTop = -16; Size(startStar, 32, 32); Img(startStar, "ic-star");
            sb.AddManipulator(new Clickable(() => { Sfx?.Invoke("ui"); OnStart?.Invoke(); }));
            var hb = Plate(menu, false, "操作說明"); hb.AddManipulator(new Clickable(() => { Sfx?.Invoke("ui"); help.style.display = DisplayStyle.Flex; }));
            var setb = Plate(menu, false, "設定"); setb.AddManipulator(new Clickable(() => { Sfx?.Invoke("ui"); OnSettings?.Invoke(); }));
            // 左下、右下
            var foot = Box(root); Abs(foot, 14, null, 14, 8); foot.style.flexDirection = FlexDirection.Row; foot.style.justifyContent = Justify.SpaceBetween;
            foreach (var s in new[] { "第一章 試玩版", "v0.8" }) { var l = Text(foot, s, 12, null, false, 1); l.style.color = C("#dcd2ff", 0.55f); l.style.letterSpacing = 2; }
            // 操作說明
            help = Box(root, "helpPanel"); Abs(help); help.style.left = Length.Percent(50); help.style.top = Length.Percent(50); help.style.translate = new Translate(Length.Percent(-50), Length.Percent(-50));
            help.style.width = 560; help.style.maxWidth = Length.Percent(92); Nine(help, "panel", 12, 12); help.style.paddingLeft = help.style.paddingRight = 12 + 16; help.style.paddingTop = 12 + 10; help.style.paddingBottom = 12 + 12;
            help.style.display = DisplayStyle.None; help.pickingMode = PickingMode.Position;
            var ht = Text(help, "操作說明", 14, "#ffd24a", true); ht.style.letterSpacing = 6; ht.style.unityTextAlign = TextAnchor.MiddleCenter; ht.style.marginBottom = 4;
            var cols = Box(help); cols.style.flexDirection = FlexDirection.Row;
            Col(cols, "手機", "左半邊左右拖動＝移動", "往上快滑＝跳（空中點一下＝二段跳）", "往下快滑＝穿過平台", "右下：攻擊（按住連段）、閃避、技能、大招", "右邊直排：切換形態");
            Col(cols, "電腦", "A / D 移動　空白鍵、↑ 跳", "S＋跳 穿過平台", "滑鼠左鍵 攻擊（按住連段）　右鍵 衝刺", "E 技能　Q 大招　1 / 2 / 3 切換形態", "F 互動、對話（按住＝吸收靈核）　Alt 叫出滑鼠", "I 背包　T 技能樹　M 地圖　H 回城鎮");
            var ok = Box(help); ok.style.alignSelf = Align.Center; ok.style.height = 30; Nine(ok, "b-go-n", 8, 8); ok.style.paddingLeft = ok.style.paddingRight = 8 + 8; ok.style.marginTop = 6; ok.pickingMode = PickingMode.Position;
            Text(ok, "知道了", 12, "#3a1c04", true); ok.AddManipulator(new Clickable(() => { Sfx?.Invoke("ui"); help.style.display = DisplayStyle.None; }));
        }
        static void Col(VisualElement p, string head, params string[] lines)
        {
            var c = Box(p); c.style.flexGrow = 1; c.style.flexBasis = 0; c.style.marginRight = 18;
            Text(c, head, 14, "#a8f0ff", true).style.marginBottom = 2;
            foreach (var s in lines) { var l = Text(c, s, 14, "#f2eefc"); l.style.whiteSpace = WhiteSpace.Normal; l.style.marginTop = l.style.marginBottom = 2; }
        }
        /// 像素牌子按鈕（ui-art.js menuPlate）：主按鈕金框、金色字、左邊一顆會轉的星星；次按鈕平常低調，移上去才亮
        VisualElement Plate(VisualElement p, bool main, string label = "開始冒險")
        {
            var b = Box(p); Size(b, 232, 56); b.style.marginBottom = 8; b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center; b.pickingMode = PickingMode.Position;
            void Skin(bool hot) { if (main || hot) Nine(b, "plate-main", 16, 16); else Nine(b, "plate", 12, 16); if (main) b.style.paddingLeft = 16 + 24; }
            Skin(false);
            var l = Text(b, label, 19, main ? "#ffd04a" : "#d8cbe8", true, 2, main ? "#2a0e10" : "#000000"); l.style.letterSpacing = 4; l.style.whiteSpace = WhiteSpace.NoWrap;
            if (!main) b.style.opacity = 0.88f;
            b.RegisterCallback<PointerEnterEvent>(e => { Skin(true); if (!main) { l.style.color = C("#ffe7a0"); b.style.opacity = 1; } });
            b.RegisterCallback<PointerLeaveEvent>(e => { Skin(false); if (!main) { l.style.color = C("#d8cbe8"); b.style.opacity = 0.88f; } });
            return b;
        }

        public void Show(string startText)
        {
            startLabel.text = startText; Open = true; root.style.display = DisplayStyle.Flex; help.style.display = DisplayStyle.None; t = 0; last = -1;
            if (far == null) Load();
        }
        /// 操作說明（開發用截圖也會叫）
        public void Help(bool on) => help.style.display = on ? DisplayStyle.Flex : DisplayStyle.None;
        public void Hide() { Open = false; root.style.display = DisplayStyle.None; }
        /// 選單收起來（播開場時，畫面交給開場）
        public bool MenuVisible { set => menu.style.display = value ? DisplayStyle.Flex : DisplayStyle.None; }

        void Load()
        {
            far = Img.Load("Art/town/far"); mid = Img.Load("Art/town/mid"); ground = Img.Load("Art/town/ground"); fg = Img.Load("Art/town/fg"); logo = Img.Load("Art/ui/logo");
            if (logo != null) { white = new Img(logo.W, logo.H); for (int i = 0; i < logo.Px.Length; i++) { var c = Pix2D.Hex("#fffbe8"); c.a = logo.Px[i].a; white.Px[i] = c; } }
            sky = new NightSky(); skyImg = new Img(NightSky.W, NightSky.H);   // 夜空（共用 NightSky）
            // 固定亂數（seed 7）：先抽 70 顆星星（標題畫面沒用到，照順序抽掉）再抽星屑
            double seed = 7; double Rnd() => (seed = (seed * 16807) % 2147483647) / 2147483647;
            for (int i = 0; i < 70; i++) { Rnd(); Rnd(); Rnd(); Rnd(); Rnd(); }
            for (int i = 0; i < dust.Length; i++) dust[i] = (Rnd() * 520, 120 + Rnd() * 100, 4 + Rnd() * 8, Rnd() * 6.28);
        }
        Img Hero(int f)
        {
            if (heroCache.TryGetValue(f, out var im)) return im;
            var s = HeroArt.Pose(Form, "title#" + f); var fr = new Frame(s.W, s.H);
            HeroArt.Paint(fr, s.Ax, s.Ay, s, false, 0, 0);
            var rgba = fr.Composite(null, null); im = Img.FromFrame(fr, rgba); heroAnchor = (s.Ax, s.Ay);
            return heroCache[f] = im;
        }

        public void Update(float dt)
        {
            if (!Open) return;
            t += dt;
            // 大小：寬 = 216 × 螢幕比例（320～520，偶數），放大蓋滿整個畫面（多的切掉一點點）
            float pw = root.layout.width > 0 ? root.layout.width : 1280, ph = root.layout.height > 0 ? root.layout.height : 720;
            int W = Mathf.Clamp(Mathf.RoundToInt(H * pw / ph / 2) * 2, 320, 520);
            if (g == null || g.W != W) { if (g == null) g = new Pix2D(W, H); else g.Resize(W); }
            float k = Mathf.Max(pw / W, ph / H);
            Size(cv, Mathf.Ceil(W * k), Mathf.Ceil(H * k)); cv.style.marginLeft = -Mathf.Ceil(W * k) / 2; cv.style.marginTop = -Mathf.Ceil(H * k) / 2;
            // 主按鈕的星星輕輕轉（3 秒）
            float st = Mathf.Sin(t / 3f * Mathf.PI * 2); startStar.style.rotate = new Rotate(-8 * Mathf.Cos(t / 3f * Mathf.PI * 2)); startStar.style.scale = new Scale(Vector2.one * (1 + 0.04f * (1 - Mathf.Cos(t / 3f * Mathf.PI * 2))));
            if (t - last < 1 / 30f) return;   // 30 fps 就夠
            last = t;
            Draw(W);
            cv.style.backgroundImage = g.Upload(); cv.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            cv.MarkDirtyRepaint();
        }

        void Draw(int W)
        {
            g.Clear(); g.Lighter = false; g.Alpha = 1;
            // 1. 天空（慢慢飄）
            sky.Update(Math.Min(0.1, t - skyLast)); skyLast = t;
            sky.CopyTo(skyImg);
            g.Fill(Pix2D.Hex("#2c1a48"));
            g.Tile(skyImg, -t * 2, 0);
            // 2. 遠景＋墜落的巨星：固定在左邊三分之一，星光柔和地呼吸
            int farX = Mathf.RoundToInt(W * 0.2f) - 100, farY = H - (far?.H ?? 216) + 30, sw = far?.W ?? 640;
            g.Lighter = true;
            for (int kk = -1; kk <= 1; kk++) { int sx = ((farX % sw) + sw) % sw - sw + kk * sw + 100; if (sx > -60 && sx < W + 60) g.Glow(sx, farY + 110, 70, Pix2D.Rgba(255, 200, 90, 1), 0.22f + 0.08f * Mathf.Sin(t * 1.3f)); }
            g.Lighter = false;
            g.Tile(far, farX, farY);
            // 3. 中景碎星鎮
            g.Tile(mid, -t * 5, H - (mid?.H ?? 216) + 40);
            // 4. 前景草地＋主角
            int gy = H - 30;
            g.Tile(ground, -t * 14, gy);
            int hx = Mathf.RoundToInt(W * 0.8f), f = Mathf.FloorToInt(t * 6.6f) % 8; var hf = Hero(f);
            g.Lighter = true; g.Glow(hx, gy - 12, 34, Pix2D.Rgba(255, 220, 120, 1), 0.28f + 0.1f * Mathf.Sin(t * 3)); g.Lighter = false;
            g.DrawImage(hf, hx - heroAnchor.ax, gy + 9 - heroAnchor.ay);
            g.Tile(fg, -t * 22, H - 26);
            // 5. 星屑往上飄
            foreach (var d in dust)
            {
                double y = ((d.y - t * d.v) % 120 + 120) % 120 + 96, x = Math.Round(((d.x + Math.Sin(t + d.p) * 6 - t * 6) % 520 + 520) % 520);
                if (x >= W) continue;
                float a = (float)(Math.Min(1, (y - 96) / 30) * (0.5 + 0.5 * Math.Sin(t * 3 + d.p)));
                g.FillRect(x, Math.Round(y), 1, 1, Pix2D.Rgba(255, 230, 140, a));
            }
            // 6. 四周壓暗；選單後面一塊淡淡的暗區
            g.Radial(W / 2.0, H * 0.42, H * 0.3, W * 0.7, new[] { (0f, Pix2D.Rgba(6, 4, 16, 0)), (1f, Pix2D.Rgba(6, 4, 16, 0.55f)) }, 0, 0, W, H);
            g.Radial(W / 2.0, H * 0.6, 8, 90, new[] { (0f, Pix2D.Rgba(8, 6, 20, 0.45f)), (1f, Pix2D.Rgba(8, 6, 20, 0)) }, 0, 0, W, H);
            // 7. 標題字：浮動、後面的光芒、斜光掃過、十字星光
            var L = logo; if (L == null) return;
            int lx = (W - L.W) / 2, ly = 16 + Mathf.RoundToInt(Mathf.Sin(t * 1.4f) * 1.5f);
            g.Lighter = true;
            g.Glow(W / 2.0, ly + L.H / 2.0, 110, Pix2D.Rgba(120, 90, 255, 1), 0.12f);
            g.Glow(W / 2.0, ly + L.H * 0.55, 80, Pix2D.Rgba(255, 200, 90, 1), 0.16f + 0.04f * Mathf.Sin(t * 2));
            for (int i = 0; i < 14; i++)
            {
                double a = t * 0.15 + i / 14.0 * Math.PI * 2, len = 70 + 20 * Math.Sin(t * 1.3 + i * 1.7), cx = W / 2.0, cy = ly + L.H * 0.55;
                g.GradLine(cx, cy, cx + Math.Cos(a) * len, cy + Math.Sin(a) * len * 0.6, i % 2 == 1 ? 1 : 2, Pix2D.Rgba(255, 220, 140, 0.16f), Pix2D.Rgba(255, 220, 140, 0));
            }
            g.Lighter = false;
            g.DrawImage(L, lx, ly);
            // 斜光：每 4 秒掃一次，只亮在字上（兩條斜線）
            float sweep = (t % 4) / 1.1f;
            if (sweep < 1)
            {
                double sx = lx - 20 + sweep * (L.W + 40);
                g.Alpha = 0.75f;
                g.DrawImage(white, lx, ly, false, (x, y) =>
                {
                    double fy = (y + 0.5 - ly) / L.H;
                    foreach (var (o, w) in new[] { (0, 3), (6, 1) }) { double left = sx + o - 14 * fy; if (x + 0.5 >= left && x + 0.5 < left + w) return true; }
                    return false;
                });
                g.Alpha = 1;
            }
            foreach (var (i, px, py) in new[] { (0, 0.04, 0.12), (1, 0.97, 0.05), (2, 0.62, 0.02) })
            {
                double ph = (t * 0.9 + i * 0.33) % 1; float a = ph < 0.25 ? (float)Math.Sin(ph / 0.25 * Math.PI) : 0;
                if (a <= 0) continue;
                int x = (int)Math.Round(lx + L.W * px), y = (int)Math.Round(ly + L.H * py), r = (int)Math.Round(1 + a * 3);
                g.FillRect(x - r, y, r * 2 + 1, 1, Pix2D.Rgba(255, 255, 255, a)); g.FillRect(x, y - r, 1, r * 2 + 1, Pix2D.Rgba(255, 255, 255, a));
                g.FillRect(x - 1, y - 1, 3, 3, Pix2D.Rgba(255, 240, 180, a));
            }
        }
    }
}
