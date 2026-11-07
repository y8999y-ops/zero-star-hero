// game/src/status.js 翻成 C#：元素狀態與反應（只作用在敵人身上）。
// 狀態：燃燒 burn、黏液 slime、帶電 shock、毒 poison、潮濕 wet、油汙 oil
// 反應：黏液／油汙＋燃燒＝大火、潮濕＋帶電＝感電連鎖、潮濕＋燃燒＝蒸氣、毒＋燃燒＝毒氣爆炸、黏液＋帶電＝麻痺黏住
// 網頁版用 setTimeout 延後的事，這裡排進遊戲時間的計時器（Game.After）。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    /// 一隻敵人身上的狀態（網頁版的 e.st）
    public class StatusSet
    {
        public double Burn, Slime, Shock, Poison, Wet, Oil, Stuck, BurnDps, PoisonDps; public bool Big;
        public double Get(string id) { switch (id) { case "burn": return Burn; case "slime": return Slime; case "shock": return Shock; case "poison": return Poison; case "wet": return Wet; case "oil": return Oil; case "stuck": return Stuck; } return 0; }
        public void Set(string id, double v) { switch (id) { case "burn": Burn = v; break; case "slime": Slime = v; break; case "shock": Shock = v; break; case "poison": Poison = v; break; case "wet": Wet = v; break; case "oil": Oil = v; break; case "stuck": Stuck = v; break; } }
        public bool Any => Burn > 0 || Poison > 0 || Slime > 0 || Stuck > 0 || Shock > 0 || Wet > 0 || Oil > 0;
    }

    public class Status
    {
        static readonly Dictionary<string, double> DUR = new Dictionary<string, double> { ["burn"] = 3, ["slime"] = 4, ["shock"] = 1.5, ["poison"] = 5, ["wet"] = 6, ["oil"] = 8 };
        static readonly string[] FIRE = { "#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff" };
        static readonly string[] STEAM = { "#2a3040", "#4a5468", "#7a8498", "#a8b2c4", "#d0d8e6", "#eef2fa", "#ffffff", "#ffffff" };
        static readonly string[] TOXIC = { "#0e1d14", "#173320", "#23552e", "#318232", "#55b92f", "#8eea3f", "#cfff63", "#f6ffc2" };
        static readonly string[] GOO = { "#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff" };

        readonly Game G;
        public HashSet<string> Allow;   // null＝全部；1-1 只有燃燒和黏液
        public Status(Game g) { G = g; }

        double Atk => G.Player.Atk;
        // 技能樹（main.js 的 setStatusContext）
        double BurnMul => 1 + 0.6 * G.Rank("star", "s_fire");
        double PoisonMul => 1 + 0.6 * G.Rank("bat", "b_fang");
        double PoisonDur => 1 + 0.4 * G.Rank("bat", "b_toxic");
        bool ShockBonus => G.Player.Form == "can" && G.Rank("can", "c_volt") > 0;
        bool ChainExtra => G.Rank("can", "c_conduct") > 0;
        double WildR => 1 + 0.3 * G.Rank("slime", "g_fuel");
        static bool Has(Enemy e, string id) => e.St != null && e.St.Get(id) > 0;
        static (double x, double y, (double x0, double x1, double y0, double y1) b) Center(Enemy e) { var b = e.Box(); return (e.X, (b.y0 + b.y1) / 2, b); }
        List<Enemy> Near(Enemy e, double r) => G.Enemies.Where(o => o != e && !o.Dead && Math.Abs(o.X - e.X) < r && Math.Abs(o.Y - e.Y) < r * 0.8).ToList();

        /// 沾上一個狀態（會先檢查反應）。depth：連鎖深度
        public void Apply(Enemy e, string id, int depth = 0)
        {
            if (e == null || e.Dead || e.IsBoss) return;   // 王先不吃狀態
            if (Allow != null && !Allow.Contains(id == "fire" ? "burn" : id)) return;
            var S = e.St ??= new StatusSet();
            if (id == "burn" || id == "fire")
            {
                if (Has(e, "wet")) { React(e, "steam", depth); return; }
                if (Has(e, "slime") || Has(e, "oil")) { React(e, "wildfire", depth); return; }
                if (Has(e, "poison")) { React(e, "toxic", depth); return; }
            }
            if (id == "shock")
            {
                if (Has(e, "wet")) { React(e, "chain", depth); return; }
                if (Has(e, "slime")) { React(e, "stuck", depth); return; }
            }
            if ((id == "slime" || id == "oil") && Has(e, "burn")) { React(e, "wildfire", depth); return; }
            if (id == "wet" && Has(e, "burn")) { React(e, "steam", depth); return; }
            if (id == "wet" && Has(e, "shock")) { React(e, "chain", depth); return; }
            if (id == "poison" && Has(e, "burn")) { React(e, "toxic", depth); return; }
            S.Set(id, Math.Max(S.Get(id), DUR[id] * (id == "poison" ? PoisonDur : 1)));
            if (id == "burn") S.BurnDps = Atk * 0.3 * BurnMul;
            if (id == "poison") S.PoisonDps = Atk * 0.2 * PoisonMul;
            if (id == "shock") { e.Stun = Math.Max(e.Stun, 0.45); if (ShockBonus) { S.Shock += 1; e.Stun = Math.Max(e.Stun, 1); } }
        }

        public Action<string, Enemy> OnReaction;   // 第一次觸發某種反應時系統解釋（main.js 的 onReaction）
        void React(Enemy e, string kind, int depth)
        {
            var S = e.St; var (x, y, b) = Center(e); double atk = Atk;
            OnReaction?.Invoke(kind, e);
            switch (kind)
            {
                case "wildfire":
                    // 大火：燒得更久更痛，往旁邊 40px 擴散（只連 2 層）
                    S.Slime = 0; S.Oil = 0;
                    S.Burn = DUR["burn"] * 2; S.BurnDps = atk * 0.6 * BurnMul; S.Big = true;
                    e.Tick(atk * 0.8, G);
                    G.SpawnLive("plasma-explosion", Pf.Round(x), Pf.Round(b.y1), new FxOptions { Palette = FIRE, Light = 0.6, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.6);
                    SceneLight.AddFlash(x, y, 70, 3, 0.35, "#ff8a30");
                    G.Fx.Shake(0.18, 2);
                    G.Sfx("hitH");
                    if (depth < 2) foreach (var o in Near(e, 46 * WildR)) { var oo = o; G.After(120 + Rnd.Next() * 120, () => Apply(oo, "burn", depth + 1)); }
                    break;
                case "chain":
                {
                    // 感電連鎖：電流跳到附近所有潮濕的敵人（和牠自己）
                    S.Wet = 0;
                    var list = new List<Enemy> { e }; list.AddRange(Near(e, 90).Where(o => Has(o, "wet")));
                    if (ChainExtra) { var extra = Near(e, 90).FirstOrDefault(o => !list.Contains(o)); if (extra != null) list.Add(extra); }   // 導電體：多跳一隻
                    Enemy prev = e;
                    for (int i = 0; i < list.Count; i++)
                    {
                        var o = list[i]; int ii = i;
                        G.After(ii * 70, () =>
                        {
                            if (o.Dead) return;
                            var (ox, oy, _) = Center(o);
                            bolts.Add(new BoltLine { X0 = prev.X, Y0 = Center(prev).y, X1 = ox, Y1 = oy });
                            prev = o;
                            if (o.St != null) o.St.Wet = 0;
                            o.Stun = Math.Max(o.Stun, 0.8);
                            o.Tick(atk * 1.1, G);
                            G.SpawnLive("zap-hit", Pf.Round(ox), Pf.Round(oy), new FxOptions { Light = 0.5, Seed = ii + 3 }, 1);
                            SceneLight.AddFlash(ox, oy, 46, 2.5, 0.2, "#9af0ff");
                        });
                    }
                    G.Sfx("crit");
                    break;
                }
                case "steam":
                {
                    // 蒸氣：火熄掉、潮濕蒸發，冒出一團白霧，霧裡的敵人持續受傷 1.5 秒
                    S.Burn = 0; S.Wet = 0;
                    var fx = G.SpawnLive("poison-cloud", Pf.Round(x), Pf.Round(b.y1), new FxOptions { Palette = STEAM, Light = 0.1, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.4);
                    G.After(1300, () => fx?.Stop());
                    clouds.Add(new Cloud { X = x, Y = b.y1, T = 1.5, Dps = atk * 0.5 });
                    G.Sfx("hitL");
                    break;
                }
                case "toxic":
                    // 毒氣爆炸：範圍爆炸，毒用掉
                    S.Poison = 0;
                    G.SpawnLive("acid-splash", Pf.Round(x), Pf.Round(b.y1), new FxOptions { Palette = TOXIC, Light = 0.4, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.5);
                    SceneLight.AddFlash(x, y, 64, 2.5, 0.3, "#8ae060");
                    G.Fx.Shake(0.2, 2);
                    G.Sfx("hitH");
                    { var all = new List<Enemy> { e }; all.AddRange(Near(e, 44)); foreach (var o in all) o.Tick(atk * (o == e ? 1.6 : 1.2), G); }
                    break;
                case "stuck":
                    // 麻痺黏住：黏液導電，長時間定身
                    S.Slime = 0; S.Shock = 0; S.Stuck = 2.5;
                    e.Stun = Math.Max(e.Stun, 2.5);
                    e.Tick(atk * 0.6, G);
                    G.SpawnLive("zap-hit", Pf.Round(x), Pf.Round(y), new FxOptions { Palette = GOO, Light = 0.4, Seed = 7 }, 1);
                    SceneLight.AddFlash(x, y, 40, 2, 0.25, "#b4f890");
                    G.Sfx("hitL");
                    break;
            }
        }

        class BoltLine { public double X0, Y0, X1, Y1, T; }
        class Cloud { public double X, Y, T, Dps; }
        readonly List<BoltLine> bolts = new List<BoltLine>();
        readonly List<Cloud> clouds = new List<Cloud>();
        double dotClock;
        static readonly string[] IDS = { "burn", "slime", "shock", "poison", "wet", "oil", "stuck" };

        /// 每格：持續傷害（每 0.5 秒跳一次）、倒數、蒸氣霧、電流閃線
        public void Update(double dt)
        {
            dotClock += dt;
            bool pulse = dotClock >= 0.5;
            if (pulse) dotClock -= 0.5;
            foreach (var e in G.Enemies.ToList())
            {
                var S = e.St;
                if (S == null || e.Dead) continue;
                foreach (var id in IDS) if (S.Get(id) > 0) S.Set(id, S.Get(id) - dt);
                if (S.Burn <= 0) S.Big = false;
                if (pulse)
                {
                    double d = (S.Burn > 0 ? S.BurnDps : 0) * 0.5 + (S.Poison > 0 ? S.PoisonDps : 0) * 0.5;
                    if (d > 0) e.Tick(d, G, true);
                }
            }
            foreach (var c in clouds)
            {
                c.T -= dt;
                if (pulse) foreach (var e in G.Enemies.ToList()) if (!e.Dead && Math.Abs(e.X - c.X) < 34 && Math.Abs(e.Y - c.Y) < 40) e.Tick(c.Dps * 0.5, G, true);
            }
            clouds.RemoveAll(c => c.T <= 0);
            foreach (var b in bolts) b.T += dt;
            bolts.RemoveAll(b => b.T > 0.22);
        }

        // ================= 畫 =================
        static uint P(string c) => Col.Hex(c);
        static readonly uint[] FIRE_P = new[] { "#8a1f17", "#f2561d", "#ffc23d", "#fff3a6" }.Select(P).ToArray();
        static readonly uint[] GOO_P = new[] { "#5a8a10", "#c8f048", "#f0ffa0", "#ffffff" }.Select(P).ToArray();
        static readonly uint[] VOLT_P = new[] { "#1e64b0", "#3ab8f0", "#9af0ff", "#ffffff" }.Select(P).ToArray();
        static readonly uint[] TOX_P = new[] { "#1a3a1a", "#8ae040", "#e8ff70", "#7a2a9a", "#ffffff" }.Select(P).ToArray();
        static readonly uint[] WET_P = new[] { "#1e64b0", "#3a8cf0", "#9ad8ff", "#ffffff" }.Select(P).ToArray();
        static readonly uint[] OIL_P = new[] { "#0a060c", "#2a1a2a", "#3a2a48", "#5af0d0", "#e080ff" }.Select(P).ToArray();
        static readonly uint SMOKE = P("#4a4250"), DRIP_EDGE = P("#0c0a14"), DRIP_HI = P("#ffffff");
        static double Hash(double a, double b) { double s = Pf.Sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.Floor(s); }

        static void Put(Frame f, double x, double y, uint c, bool glow = false)
        {
            int X = (int)Pf.Round(x) - f.Ox, Y = (int)Pf.Round(y) - f.Oy;
            if (X < 0 || Y < 0 || X >= f.W || Y >= f.H) return;
            int i = Y * f.W + X;
            f.Color[i] = c;
            if (glow) f.Light[i] = c;
        }

        public class Snap { public int X0, Y0, W, H; public uint[] Px; }
        const int MARGIN = 12;
        /// 敵人畫上去之前先記下那一塊畫面（畫完比對出身體的形狀）
        public static Snap TakeSnap(Frame frame, Enemy e)
        {
            var S = e.St;
            if (S == null || e.Dead || !S.Any) return null;
            var b = e.Box();
            int x0 = (int)Math.Max(0, Pf.Round(b.x0 - MARGIN) - frame.Ox), y0 = (int)Math.Max(0, Pf.Round(b.y0 - MARGIN) - frame.Oy);
            int x1 = (int)Math.Min(frame.W, Pf.Round(b.x1 + MARGIN) - frame.Ox), y1 = (int)Math.Min(frame.H, Pf.Round(b.y1 + 3) - frame.Oy);
            if (x1 <= x0 || y1 <= y0) return null;
            int w = x1 - x0, h = y1 - y0; var px = new uint[w * h];
            for (int y = 0; y < h; y++) Array.Copy(frame.Color, (y0 + y) * frame.W + x0, px, y * w, w);
            return new Snap { X0 = x0, Y0 = y0, W = w, H = h, Px = px };
        }

        struct Pt { public int X, Y; public bool Front; public Pt(int x, int y, bool f = false) { X = x; Y = y; Front = f; } }

        /// 畫一隻敵人身上的狀態（在敵人之後呼叫）
        public static void DrawOn(Frame frame, Enemy e, Snap snap)
        {
            var S = e.St;
            if (S == null || e.Dead || snap == null) return;
            int x0 = snap.X0, y0 = snap.Y0, w = snap.W, h = snap.H; var px = snap.Px;
            int W = frame.W; uint[] Cc = frame.Color; double t = e.Clock; double sd = Pf.Round(e.X * 0.37);
            var m = new byte[w * h];
            int top = h, bot = -1;
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (Cc[(y0 + y) * W + x0 + x] != px[y * w + x]) { m[y * w + x] = 1; if (y < top) top = y; if (y > bot) bot = y; }
            if (bot < 0) return;
            bool At(int x, int y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] == 1;
            var tops = new List<Pt>(); var sides = new List<Pt>(); var edges = new List<Pt>();
            for (int y = top; y <= bot; y++) for (int x = 0; x < w; x++)
            {
                if (!At(x, y)) continue;
                bool up = !At(x, y - 1), dn = !At(x, y + 1), side = !At(x - 1, y) || !At(x + 1, y);
                if (up) tops.Add(new Pt(x, y));
                if (side && !up) sides.Add(new Pt(x, y));
                if (up || dn || side) edges.Add(new Pt(x, y));
            }
            int hgt = Math.Max(1, bot - top + 1);
            void P2(double x, double y, uint c, bool glow = false) => Put(frame, x + x0 + frame.Ox, y + y0 + frame.Oy, c, glow);
            Pt? Pick(List<Pt> list, double k, double salt) => list.Count > 0 ? list[(int)(Math.Floor(Hash(k, salt + sd) * list.Count) % list.Count)] : (Pt?)null;

            void Drip(List<Pt> list, int k, double salt, double life, double len, uint[] cols, bool glowIt = false)
            {
                double cyc = Math.Floor((t + k * life * 0.37) / life), p = ((t + k * life * 0.37) % life) / life; var qq = Pick(list, k + cyc * 5, salt);
                if (qq == null) return; var q = qq.Value;
                int outd = q.X < w / 2.0 ? -1 : 1; int x = q.Front ? q.X : q.X + outd, yy0 = q.Y;
                void Bead(double bx, double by)
                {
                    foreach (var (dx, dy) in new[] { (0, -2), (-1, -1), (2, -1), (-1, 0), (2, 0), (-1, 1), (2, 1), (0, 2), (1, 2) }) P2(bx + dx, by + dy, DRIP_EDGE);
                    P2(bx, by - 1, cols[1]); P2(bx + 1, by - 1, cols[0], glowIt); P2(bx, by, cols[0], glowIt); P2(bx + 1, by, cols[1]); P2(bx, by + 1, cols[1]); P2(bx + 1, by + 1, cols[2]);
                    P2(bx, by - 1, DRIP_HI);
                }
                if (p < 0.4)
                {
                    double L = Math.Max(1, Pf.Round((p / 0.4) * len));
                    for (int j = 0; j < L; j++) P2(x, yy0 + j, cols[1]);
                    Bead(x, yy0 + L);
                }
                else
                {
                    double f = (p - 0.4) / 0.6, fy = Math.Min(bot, yy0 + len + f * f * (bot - yy0 + 6));
                    if (fy < bot - 1) Bead(x, fy);
                    else { P2(x - 1, bot, cols[0]); P2(x + 1, bot, cols[0]); P2(x - 2, bot - 1, cols[1]); P2(x + 2, bot - 1, cols[1]); P2(x - 3, bot - 2, cols[2]); P2(x + 3, bot - 2, cols[2]); }
                }
            }
            var lower = sides.Where(q => (bot - q.Y) / (double)hgt < 0.75).ToList();
            var fronts = new List<Pt>();
            for (int k = 0; k < 6; k++)
            {
                int yy = (int)Pf.Round(top + hgt * (0.45 + 0.08 * k)); var xs = new List<int>();
                for (int x = 0; x < w; x++) if (At(x, yy) && At(x - 2, yy) && At(x + 3, yy)) xs.Add(x);
                if (xs.Count > 0) fronts.Add(new Pt(xs[(int)Math.Floor(Hash(k, sd + 7) * xs.Count)], yy, true));
            }
            var baseList = lower.Count > 0 ? lower : sides;
            var drips = new List<Pt>(); for (int i = 0; i < baseList.Count; i++) if (i % 3 == 0) drips.Add(baseList[i]); drips.AddRange(fronts);
            if (S.Oil > 0)
            {
                for (int k = 0; k < 4; k++) Drip(drips, k, 51, 1.6, 4, new[] { OIL_P[k % 2 != 0 ? 3 : 4], OIL_P[2], OIL_P[1] });
                for (int x = -4; x <= 4; x++) Put(frame, e.X + x, e.Box().y1, Math.Abs(x) == 4 ? OIL_P[1] : x == -1 ? OIL_P[4] : OIL_P[0]);
            }
            if (S.Wet > 0) for (int k = 0; k < 5; k++) Drip(drips, k, 61, 0.9, 2, new[] { WET_P[3], WET_P[2], WET_P[1] });
            if (S.Slime > 0 || S.Stuck > 0)
            {
                for (int k = 0; k < 5; k++) Drip(drips, k, 71, 1.4, 5, new[] { GOO_P[2], GOO_P[1], GOO_P[0] }, true);
                if (S.Stuck > 0) for (int k = 0; k < 3; k++) { var q = Pick(edges, Math.Floor(t * 14) + k * 7, 81); if (q != null) P2(q.Value.X, q.Value.Y, VOLT_P[3], true); }
            }
            if (S.Poison > 0)
            {
                for (int k = 0; k < 4; k++) Drip(drips, k, 95, 1.2, 3, new[] { TOX_P[2], TOX_P[1], TOX_P[3] }, true);
                for (int k = 0; k < 3; k++)
                {
                    double life = 1.1, cyc = Math.Floor((t + k * 0.37) / life), p = ((t + k * 0.37) % life) / life; var qq = Pick(tops, k + cyc * 3, 91); if (qq == null) continue;
                    double bx = qq.Value.X, by = qq.Value.Y - 1 - p * 9;
                    if (p < 0.8) { P2(bx, by, TOX_P[2], true); P2(bx + 1, by, TOX_P[1]); P2(bx, by - 1, TOX_P[1]); P2(bx + 1, by - 1, TOX_P[3]); }
                    else { P2(bx - 1, by, TOX_P[2], true); P2(bx + 2, by, TOX_P[2], true); P2(bx, by - 2, TOX_P[1]); }
                }
                for (int k = 0; k < 3; k++) { double p = (t * 0.5 + k * 0.33) % 1; var q = Pick(edges, k, 96 + Math.Floor(t * 0.5 + k * 0.33)); if (q != null) P2(q.Value.X + Pf.Sin(p * 6 + k) * 4, q.Value.Y - p * 10, p < 0.5 ? TOX_P[3] : TOX_P[1]); }
            }
            if (S.Burn > 0)
            {
                bool big = S.Big; double slot = Math.Floor(t * 3);
                var roots = tops.Where(q => Hash(q.X + slot * 7, sd) < (big ? 0.5 : 0.32)).Concat(sides.Where(q => (bot - q.Y) / (double)hgt > 0.3 && Hash(q.Y + slot * 5, q.X + sd) < (big ? 0.25 : 0.12))).ToList();
                foreach (var r in roots)
                {
                    int x = r.X, y = r.Y;
                    double flick = Math.Floor(t * 14 + Hash(x, y) * 9) % 4, hh = 3 + flick + (big ? 4 : 0) + Pf.Round(Hash(y, x + sd) * 2);
                    double sway = Pf.Round(Pf.Sin(t * 9 + x * 1.3));
                    for (int j = 0; j < hh; j++)
                    {
                        double q = j / hh; uint c = q < 0.3 ? FIRE_P[1] : q < 0.7 ? FIRE_P[2] : FIRE_P[3]; double X = x + (q > 0.5 ? sway : 0);
                        P2(X, y - j, c, true);
                        if (j < (big ? 3 : 2)) P2(X + 1, y - j, j == 0 ? FIRE_P[0] : FIRE_P[1], true);
                    }
                }
                for (int k = 0; k < 6; k++)
                {
                    double life = 0.9, cyc = Math.Floor((t + k * 0.19) / life), p = ((t + k * 0.19) % life) / life; var qq = Pick(tops, k + cyc * 5, 31); if (qq == null) continue;
                    double x = qq.Value.X + Pf.Sin(p * 7 + k) * 2, y = qq.Value.Y - 4 - p * 16;
                    if (k < 4) P2(x, y, p < 0.5 ? FIRE_P[3] : FIRE_P[2], true);
                    else if (p > 0.3) P2(x, y - 4, SMOKE);
                }
            }
            if (S.Shock > 0)
            {
                double f = Math.Floor(t * 14);
                foreach (var q in edges)
                {
                    double r = Hash(q.X * 7 + f, q.Y * 3 + sd);
                    if (r < 0.12) P2(q.X, q.Y, VOLT_P[3], true);
                    else if (r < 0.22) P2(q.X, q.Y, VOLT_P[1], true);
                }
                void Bolt(double ax, double ay, double zx, double zy, int n, double jag)
                {
                    double lx = ax, ly = ay;
                    for (int s2 = 1; s2 <= n; s2++)
                    {
                        double q = s2 / (double)n, x = ax + (zx - ax) * q + (s2 < n ? (Hash(f + s2, 9) - 0.5) * jag : 0), y = ay + (zy - ay) * q + (s2 < n ? (Hash(f + s2, 3) - 0.5) * jag : 0), st2 = Math.Max(1, Math.Max(Math.Abs(x - lx), Math.Abs(y - ly)));
                        for (int k = 0; k <= st2; k++) { double X = lx + ((x - lx) * k) / st2, Y = ly + ((y - ly) * k) / st2; P2(X, Y, VOLT_P[3], true); P2(X, Y - 1, VOLT_P[1], true); }
                        lx = x; ly = y;
                    }
                }
                if (edges.Count > 4) { var a = edges[(int)Math.Floor(Hash(f, sd) * edges.Count)]; var z = edges[(int)Math.Floor(Hash(sd, f) * edges.Count)]; Bolt(a.X, a.Y, z.X, z.Y, 6, 6); }
                if (edges.Count > 4 && f % 3 == 0)
                {
                    var a = edges[(int)Math.Floor(Hash(f, sd + 5) * edges.Count)]; double cx0 = w / 2.0, cy0 = (top + bot) / 2.0, dx = a.X - cx0, dy = a.Y - cy0, d = Pf.Hypot(dx, dy); if (d == 0) d = 1;
                    Bolt(a.X, a.Y, a.X + (dx / d) * 9, a.Y + (dy / d) * 9, 3, 4);
                }
                for (int k = 0; k < 3; k++) { var q = Pick(edges, f + k * 11, 41); double p = (t * 5 + k * 0.33) % 1; if (q != null) P2(q.Value.X + (k != 0 ? 1 : -1) * p * 7, q.Value.Y - p * 5 + p * p * 8, VOLT_P[2], true); }
            }
        }

        /// 電流連鎖的閃線（折線，0.22 秒）
        public void DrawBolts(Frame frame)
        {
            foreach (var bl in bolts)
            {
                int n = 7; double f = Math.Floor(bl.T * 30);
                double px = bl.X0, py = bl.Y0;
                for (int s = 1; s <= n; s++)
                {
                    double q = s / (double)n, x = bl.X0 + (bl.X1 - bl.X0) * q, y = bl.Y0 + (bl.Y1 - bl.Y0) * q + (s < n ? (Hash(f + s, bl.X0) - 0.5) * 10 : 0);
                    double steps = Math.Max(Math.Abs(x - px), Math.Abs(y - py));
                    for (int k = 0; k <= steps; k++) Put(frame, px + ((x - px) * k) / steps, py + ((y - py) * k) / steps, bl.T < 0.08 ? VOLT_P[3] : VOLT_P[2], true);
                    px = x; py = y;
                }
            }
        }
    }
}
