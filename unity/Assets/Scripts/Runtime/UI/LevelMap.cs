// mapview.js：關卡裡的地圖（M 鍵、左上的地圖圖示）。走過的地方才顯示（每格 32×32，畫面看得到的範圍算走過），
// 標記：主角、祭壇（亮／暗）、出口（1-4 是王房）、一次性資源（拿過變灰）、形態機關。地圖 1 格＝世界 8 格，放大 2 倍。
// 視窗用共用的外框（青色主題、全息轉場），下面一排圖例。
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public static class LevelMap
    {
        const int CELL = 32, K = 8;
        static readonly Dictionary<string, (string solid, string top, string edge)> THEME = new Dictionary<string, (string, string, string)>
        {
            ["abyss"] = ("#3c4466", "#a8d42a", "#7480a4"), ["junk"] = ("#7a4434", "#e4b072", "#a06446"), ["cave"] = ("#24405a", "#5ac0a0", "#5a86a0"), ["lair"] = ("#7a4434", "#e4b072", "#a06446"),
        };
        static readonly Dictionary<string, string> STAGE_THEME = new Dictionary<string, string> { ["1-1"] = "abyss", ["1-2"] = "junk", ["1-3"] = "cave", ["1-4"] = "lair" };
        const string AIR = "#100e1c", FOG = "#06050c", FOG2 = "#0c0a16", PLAT = "#c8a040";
        static readonly Dictionary<string, (string[] rows, Dictionary<char, string> col)> ICON = new Dictionary<string, (string[], Dictionary<char, string>)>
        {
            ["player"] = (new[] { "...a...", "..aba..", "aabbbaa", ".abcba.", "..bbb..", ".bb.bb.", "b.....b" }, new Dictionary<char, string> { ['a'] = "#ffe066", ['b'] = "#f0b424", ['c'] = "#ffffff" }),
            ["altarOn"] = (new[] { "...a...", "..aba..", "..aba..", "..aba..", "..aba..", ".ccccc.", "ccccccc" }, new Dictionary<char, string> { ['a'] = "#ffe066", ['b'] = "#fff6c4", ['c'] = "#7c7a98" }),
            ["altarOff"] = (new[] { "...a...", "..aba..", "..aba..", "..aba..", "..aba..", ".ccccc.", "ccccccc" }, new Dictionary<char, string> { ['a'] = "#34405e", ['b'] = "#7488aa", ['c'] = "#3a3850" }),
            ["exit"] = (new[] { "..aaa..", ".abbba.", "ab...ba", "ab.c.ba", "ab...ba", ".abbba.", "..aaa.." }, new Dictionary<char, string> { ['a'] = "#1a7aa8", ['b'] = "#4cd8ec", ['c'] = "#ffffff" }),
            ["ember"] = (new[] { "...a...", "..aba..", ".abcba.", ".abcba.", "..bcb..", "...b...", "......." }, new Dictionary<char, string> { ['a'] = "#c48412", ['b'] = "#ffe066", ['c'] = "#ffffff" }),
            ["vein"] = (new[] { "..a....", ".ab.a..", ".ab.ab.", "aab.ab.", "abbaab.", "ccccccc", "......." }, new Dictionary<char, string> { ['a'] = "#28aed0", ['b'] = "#a0f2fa", ['c'] = "#3c4466" }),
            ["fossil"] = (new[] { "..aaa..", ".abbba.", "abcccba", "abc.cba", "abcccba", ".abbba.", "..aaa.." }, new Dictionary<char, string> { ['a'] = "#7a6a54", ['b'] = "#a8987a", ['c'] = "#b878ff" }),
            ["safe"] = (new[] { "aaaaaaa", "abbbbba", "abbcbba", "abcccba", "abbcbba", "abbbbba", "aaaaaaa" }, new Dictionary<char, string> { ['a'] = "#5c5868", ['b'] = "#9a968c", ['c'] = "#f0b424" }),
            ["stele"] = (new[] { "..aaa..", ".abbba.", ".bcbcb.", ".bbbbb.", ".bcbcb.", ".bbbbb.", "aaaaaaa" }, new Dictionary<char, string> { ['a'] = "#7480a4", ['b'] = "#545e84", ['c'] = "#ffe066" }),
            ["crack"] = (new[] { "aaaaaaa", "abbcbba", "abcbbba", "abbcbba", "abbbcba", "abbcbba", "aaaaaaa" }, new Dictionary<char, string> { ['a'] = "#5a2a20", ['b'] = "#b05a2a", ['c'] = "#140a18" }),
            ["seal"] = (new[] { "aaaaaaa", "abbcbba", "abcccba", "accccca", "abcbcba", "abbbbba", "aaaaaaa" }, new Dictionary<char, string> { ['a'] = "#2a2e48", ['b'] = "#3c4466", ['c'] = "#ffe066" }),
            ["shroom"] = (new[] { ".aaaaa.", "abcbbba", "abbbcba", "aaaaaaa", "..ddd..", "..ddd..", "......." }, new Dictionary<char, string> { ['a'] = "#2a6a2a", ['b'] = "#5ac84a", ['c'] = "#e8ffd8", ['d'] = "#c8b08a" }),
            ["wind"] = (new[] { "...a...", "..aaa..", ".a.a.a.", "...a...", "...a...", "...a...", "...b..." }, new Dictionary<char, string> { ['a'] = "#7ac8f0", ['b'] = "#3a7aa8" }),
            ["boss"] = (new[] { ".a.a.a.", ".aaaaa.", "..bbb..", ".bbbbb.", "bcbbbcb", "bbbbbbb", "ddddddd" }, new Dictionary<char, string> { ['a'] = "#ffd84a", ['b'] = "#5ac84a", ['c'] = "#ff4a5a", ['d'] = "#2a6a2a" }),
            ["done"] = (new[] { "......", ".a..a.", "..aa..", "..aa..", ".a..a.", "......" }, new Dictionary<char, string> { ['a'] = "#5a5274" }),
        };
        static readonly Dictionary<string, Color32> cc = new Dictionary<string, Color32>();
        static Color32 H(string h) { if (!cc.TryGetValue(h, out var c)) { ColorUtility.TryParseHtmlString(h, out var f); cc[h] = c = f; } return c; }

        // ---- 走過的格子（存檔的 profile.mapSeen[關卡]）：每 0.25 秒把鏡頭看得到的範圍記下來
        static float acc;
        public static void UpdateSeen(Game g, float dt)
        {
            if (g.Town || (acc += dt) < 0.25f) return;
            acc = 0;
            var s = Seen(g); int cw = (int)Math.Ceiling(g.Data.W / (double)CELL), ch = (int)Math.Ceiling(g.Data.H / (double)CELL);
            var v = Game.ViewRect(); double camX = g.CamX + v.x0, camY = g.CamY + v.y0;
            for (int y = (int)Math.Floor(camY / CELL); y <= (int)Math.Floor((camY + v.h) / CELL); y++)
                for (int x = (int)Math.Floor(camX / CELL); x <= (int)Math.Floor((camX + v.w) / CELL); x++)
                    if (x >= 0 && y >= 0 && x < cw && y < ch) s[y * cw + x] = true;
        }
        static bool[] Seen(Game g)
        {
            int cw = (int)Math.Ceiling(g.Data.W / (double)CELL), ch = (int)Math.Ceiling(g.Data.H / (double)CELL);
            if (!g.MapSeen.TryGetValue(g.StageId, out var s) || s.Length != cw * ch) g.MapSeen[g.StageId] = s = new bool[cw * ch];
            return s;
        }

        /// 畫地圖（renderMap＋stampIcon），回傳放大 2 倍的貼圖
        static Texture2D Render(Game g, out int pct)
        {
            double W = g.Data.W, Hh = g.Data.H; int mw = (int)Math.Ceiling(W / K), mh = (int)Math.Ceiling(Hh / K), cw = (int)Math.Ceiling(W / CELL);
            var seen = Seen(g); var T = THEME[STAGE_THEME.TryGetValue(g.StageId, out var th) ? th : "abyss"];
            bool IsSeen(int mx, int my) => mx >= 0 && my >= 0 && mx < mw && my < mh && seen[(my * K) / CELL * cw + (mx * K) / CELL];
            var px = new string[mw * mh];
            for (int my = 0; my < mh; my++) for (int mx = 0; mx < mw; mx++)
            {
                int i = my * mw + mx;
                if (!IsSeen(mx, my)) { bool rim = IsSeen(mx - 1, my) || IsSeen(mx + 1, my) || IsSeen(mx, my - 1) || IsSeen(mx, my + 1); px[i] = rim ? "#2a7a94" : (mx + my) % 4 == 0 ? FOG2 : FOG; continue; }
                if (!g.Map.SolidAt(mx * K + 4, my * K + 4)) { px[i] = AIR; continue; }
                bool up = !g.Map.SolidAt(mx * K + 4, my * K - 4), side = !g.Map.SolidAt(mx * K - 4, my * K + 4) || !g.Map.SolidAt(mx * K + 12, my * K + 4);
                px[i] = up ? T.top : side ? T.edge : T.solid;
            }
            foreach (var p in g.Map.Platforms)
                for (int x = (int)Math.Floor(p.X / K); x < (int)Math.Ceiling((p.X + p.W) / K); x++) { int y = (int)Math.Floor(p.Y / K); if (IsSeen(x, y)) px[y * mw + x] = PLAT; }
            const int S = 2; int tw = mw * S, thh = mh * S;
            var buf = new Color32[tw * thh];
            void Put(int x, int y, string hex) { if (x < 0 || y < 0 || x >= tw || y >= thh) return; buf[(thh - 1 - y) * tw + x] = H(hex); }
            for (int y = 0; y < mh; y++) for (int x = 0; x < mw; x++) { var c = px[y * mw + x]; for (int b = 0; b < S; b++) for (int a = 0; a < S; a++) Put(x * S + a, y * S + b, c); }
            var marks = Marks(g).Where(m => m.always || IsSeen((int)Math.Floor(m.x / K), (int)Math.Floor(m.y / K))).OrderBy(m => m.icon == "player" ? 1 : 0).ToList();
            foreach (var m in marks) Stamp(Put, m.dim ? "done" : m.icon, m.x / K * S, m.y / K * S, m.icon == "player" ? 2 : 1);
            if (last != null && (last.width != tw || last.height != thh)) { UnityEngine.Object.Destroy(last); last = null; }   // 每次打開重畫在同一張圖上，不會越開越多張
            var tex = last ??= new Texture2D(tw, thh, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point }; tex.SetPixels32(buf); tex.Apply(false);
            pct = (int)Math.Round(seen.Count(b => b) * 100.0 / seen.Length, MidpointRounding.AwayFromZero);
            return tex;
        }
        static List<(string icon, double x, double y, bool dim, bool always)> Marks(Game g)
        {
            var L = new List<(string, double, double, bool, bool)> { ("player", g.Player.X, g.Player.Y, false, true) };
            foreach (var a in g.Altars) L.Add((a.Lit ? "altarOn" : "altarOff", a.X, a.Y, false, false));
            if (g.StageD.ExitX != 0) L.Add(("exit", g.StageD.ExitX + 26, g.StageD.ExitY != 0 ? g.StageD.ExitY : g.Data.Floor, false, false));
            if (g.StageD.ArenaInfo != null && !g.Cleared_.Contains(g.StageId)) L.Add(("boss", (g.StageD.ArenaInfo.L + g.StageD.ArenaInfo.R) / 2, g.StageD.ArenaInfo.Floor, false, false));
            if (g.Features != null) foreach (var f in g.Features.Items) { if ((f.t == "crack" || f.t == "seal") && f.done) continue; L.Add((f.t, f.x, f.y, f.done && f.t != "shroom" && f.t != "wind", false)); }
            return L;
        }
        static void Stamp(Action<int, int, string> put, string name, double cx, double cy, int s)
        {
            if (!ICON.TryGetValue(name, out var I)) return;
            int n = I.rows.Length, w = I.rows[0].Length;
            int x0 = (int)Math.Floor(cx - w * s / 2.0 + 0.5), y0 = (int)Math.Floor(cy - n * s + 0.5);
            bool At(int i, int j) => j >= 0 && j < n && i >= 0 && i < w && I.rows[j][i] != '.';
            for (int j = -1; j <= n; j++) for (int i = -1; i <= w; i++)
            {
                string c = At(i, j) ? I.col[I.rows[j][i]] : (At(i + 1, j) || At(i - 1, j) || At(i, j + 1) || At(i, j - 1)) ? "#05040a" : null;
                if (c == null) continue;
                for (int b = 0; b < s; b++) for (int a = 0; a < s; a++) put(x0 + i * s + a, y0 + j * s + b, c);
            }
        }
        static Texture2D last;
        static readonly Dictionary<string, Texture2D> icons = new Dictionary<string, Texture2D>();
        static Texture2D IconTex(string name)
        {
            if (icons.TryGetValue(name, out var had) && had != null) return had;   // 圖例的小圖示做一次就好
            var buf = new Color32[9 * 9];
            Stamp((x, y, c) => { if (x >= 0 && y >= 0 && x < 9 && y < 9) buf[(8 - y) * 9 + x] = H(c); }, name, 4.5, 8, 1);
            var t = new Texture2D(9, 9, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point }; t.SetPixels32(buf); t.Apply(false); return icons[name] = t;
        }

        public static Task Open(Game g)
        {
            string name = g.StageD.Name.StartsWith(g.StageId) ? g.StageD.Name : $"{g.StageId} {g.StageD.Name}";
            void Body(VisualElement body)
            {
                var tex = Render(g, out int pct);
                var top = Box(body); top.style.flexDirection = FlexDirection.Row; top.style.justifyContent = Justify.FlexEnd; top.style.marginBottom = 4;
                Text(top, $"探索 {pct}%", 13, "#a8f0ff");
                // 2026-11-14：關卡是很長的一條，整張塞進視窗會小到看不清楚。改成放大到高度撐滿（最多 3 倍），
                // 只露出視窗寬度的一段、一開始對準主角，按住左右拖可以看其他地方。
                float k = Mathf.Clamp(Mathf.Floor(230f / tex.height * 2) / 2f, 1, 3), mapW = tex.width * k;
                var wrap = Box(body); wrap.style.height = tex.height * k; wrap.style.overflow = Overflow.Hidden; Border(wrap, 2, C("#1a1226")); wrap.style.backgroundColor = C(FOG); wrap.pickingMode = PickingMode.Position;
                var m = Box(wrap); Abs(m, 0, 0); Size(m, mapW, tex.height * k); m.style.backgroundImage = tex; m.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
                float off = float.NaN, px0 = (float)(g.Player.X / K * 2) * k;
                void Place(float want)
                {
                    float vw = wrap.contentRect.width; if (float.IsNaN(vw) || vw <= 0) return;
                    off = mapW <= vw ? (vw - mapW) / 2 : Mathf.Clamp(want, vw - mapW, 0);
                    m.style.left = Mathf.Round(off);
                }
                wrap.RegisterCallback<GeometryChangedEvent>(e => Place(float.IsNaN(off) ? wrap.contentRect.width / 2 - px0 : off));
                int drag = -1; float dragX = 0, dragOff = 0;
                wrap.RegisterCallback<PointerDownEvent>(e => { if (float.IsNaN(off)) return; drag = e.pointerId; wrap.CapturePointer(drag); dragX = e.position.x; dragOff = off; });
                wrap.RegisterCallback<PointerMoveEvent>(e => { if (e.pointerId == drag) Place(dragOff + (e.position.x - dragX) * wrap.contentRect.width / Mathf.Max(1, wrap.worldBound.width)); });
                wrap.RegisterCallback<PointerUpEvent>(e => { if (e.pointerId == drag) { wrap.ReleasePointer(drag); drag = -1; } });
                if (mapW > 480) Text(body, "按住地圖左右拖，可以看其他地方", 11, "#8f88a8").style.alignSelf = Align.Center;
                // 圖例
                var leg = Box(body); leg.style.flexDirection = FlexDirection.Row; leg.style.flexWrap = Wrap.Wrap; leg.style.justifyContent = Justify.Center; leg.style.marginTop = 6;
                var L = new List<(string, string)> { ("player", "你"), ("altarOn", "祭壇"), g.StageId == "1-4" ? ("boss", "王房") : ("exit", "出口"), ("ember", "星之殘火"), ("vein", "礦脈"), ("fossil", "化石核"), ("safe", "寶箱"), ("stele", "碑文"), ("crack", "裂牆"), ("seal", "封印"), ("shroom", "黏液菇"), ("wind", "氣流") };
                foreach (var (ic, lb) in L)
                {
                    var s = Box(leg); s.style.flexDirection = FlexDirection.Row; s.style.alignItems = Align.Center; s.style.marginRight = 10; s.style.marginBottom = 2;
                    var i = Box(s); Size(i, 20, 20); i.style.backgroundImage = IconTex(ic); i.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100)); i.style.marginRight = 3;
                    Text(s, lb, 13, "#c8bedc");
                }
            }
            return TownWins.W.Show("地圖　" + name, "sys", "map", new List<Win.Tab> { new Win.Tab { Id = "map", Label = "地圖", Icon = "map", Render = Body } }, null, false);
        }
    }
}
