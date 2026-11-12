// 場景物件接到遊戲上（main.js 建立 scenery、hazards、props、features 的那一段，以及它們每一步的更新、畫法、光）。
// 物件本身在 Runtime/Stage/（props.js、scenery.js、hazards.js、features.js、altar-art.js、objglow.js、deathfx.js、lowhpfx.js 翻過來的）。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public partial class Game
    {
        public Props Props; public Scenery Scenery; public Hazards Hazards; public Features Features;
        public readonly DeathFx DeathFx = new DeathFx();
        public readonly Dictionary<string, Dictionary<string, int>> Found = new Dictionary<string, Dictionary<string, int>>();   // profile.found
        public int MpBonus, Lore;
        FxRun chestFx;
        static readonly Dictionary<string, string> REACT_TIP = new Dictionary<string, string>
        {
            ["wildfire"] = "系統：大火！黏液和油遇到火會燒得更兇，還會傳給旁邊的。",
            ["chain"] = "系統：感電連鎖！潮濕的傢伙會導電，旁邊濕的一起被電。",
            ["steam"] = "系統：蒸氣。水把火澆熄了，冒出來的熱霧還是會燙。",
            ["toxic"] = "系統：毒氣爆炸！中毒的再點火，砰。",
            ["stuck"] = "系統：麻痺黏住。黏液導電，牠會黏在原地動不了。",
        };

        partial void InitStageObjects()
        {
            bool bare = !Town && !Endless;   // main.js 的 BARE：有 solids 的大地圖（無限討伐是舊的平地）
            var runs = bare ? StageRuns.MainRuns(Map) : null;   // main.js 的 RUNS：只有大地圖（BARE）才算地面的區段，城鎮是 null
            var torches = Data.Torches.ToList();
            Scenery = new Scenery(new Scenery.Opts { Floor = Data.Floor, W = Data.W, Platforms = Data.Platforms, Town = Town, NoPuddles = StageId == "1-1", Runs = runs, Fx = Fx, Sfx = Sfx, NowMs = () => SimMs });
            Hazards = new Hazards(Endless ? "" : StageId, Data.Floor, torches, Scenery.Puddles, bare ? StageD.Hazards.Select(h => (h.kind, h.x, (double?)h.y)).ToList() : null, (e, el) => Status.Apply(e, el));
            // 水窪不要疊在元素物件、祭壇、機關上
            {
                var busy = Hazards.List.Select(h => (h.x, h.y)).Concat(Altars.Select(a => (a.X, a.Y))).Concat(StageD.Features.Select(f => (f.X, f.Y))).ToList();
                for (int i = Scenery.Puddles.Count - 1; i >= 0; i--) { var p = Scenery.Puddles[i]; if (busy.Any(b => Math.Abs(b.Item1 - p.x) < 40 && Math.Abs(b.Item2 - p.y) < 8)) Scenery.Puddles.RemoveAt(i); }
            }
            var avoid = new List<double>();
            avoid.AddRange(Data.Torches.Select(t => t.x));
            avoid.AddRange(Altars.Select(a => a.X));
            avoid.AddRange(StageD.Features.Select(f => f.X));
            foreach (var h in Hazards.List) { avoid.Add(h.x - 14); avoid.Add(h.x); avoid.Add(h.x + 14); }
            avoid.Add(StageD.ExitX - 120); avoid.Add(StageD.ExitX + 26); avoid.Add(StageD.StartX);
            foreach (var p in Scenery.Puddles) { avoid.Add(p.x - p.w / 4); avoid.Add(p.x); avoid.Add(p.x + p.w / 4); }
            if (Town) { avoid.Clear(); avoid.AddRange(TownArt.NPCS.Select(n => n.x)); avoid.Add(TownArt.SIGNPOST_X); }   // 城鎮：居民、路標前面不要擺東西
            Props = new Props(new Props.Opts { Floor = Data.Floor, W = Data.W, Platforms = Data.Platforms, Town = Town, Runs = runs, FloorFn = bare ? (Func<double, double, double>)Map.FloorAt : null, BigCrystals = Data.BigCrystals, Avoid = avoid, Fx = Fx, Sfx = Sfx, Blip = (f, t, ms) => Synth.Blip(f, t, ms / 1000.0), HitFx = (x, y, d, h) => Combat.Hit(x, y, d, h) });
            // 藍水晶打一下＝補魔力（最大魔力的 25%，大水晶 35%）
            Props.OnMana = c =>
            {
                double n = Pf.Round(Player.MaxMp * (c.art != null ? 0.35 : 0.25)), before = Player.Mp;
                Player.Mp = Math.Min(Player.MaxMp, Player.Mp + n);
                Sfx("pickup");
                SceneLight.AddFlash(Player.X, Player.Y - 12, 60, 2, 0.4, "#46d4e8");
                OnFeed?.Invoke(new FeedRow { Icon = "mana", Name = "藍水晶", Color = Items.RARITY[1].Color, Note = $"魔力 +{Pf.Round(Player.Mp - before)}" });
            };
            Props.OnBreakCrystal = c =>
            {
                // 黃水晶碎掉掉比較多錢（大水晶 8～12 枚、小的 4～7 枚）
                if (c.col == "gold") { DropCoins(c.x, c.y - (c.hgt ?? 10) / 2, c.art != null ? 8 + (int)Math.Floor(Rnd.Next() * 5) : 4 + (int)Math.Floor(Rnd.Next() * 4)); return; }
                DropCoins(c.x, c.y - 10, 1 + (int)Math.Floor(Rnd.Next() * 3));
            };
            Props.OnBreakBox = b =>
            {
                DropCoins(b.x, b.y - 10, b.type != null ? 2 + (int)Math.Floor(Rnd.Next() * 3) : 1 + (int)Math.Floor(Rnd.Next() * 3));
                if (b.type == "crate" && Rnd.Next() < 0.12) { int il = IlvlNow(0); DropItem(b.x, b.y - 10, Items.COMMON, il); }
            };
            // 形態機關＋一次性資源
            if (!Found.TryGetValue(StageId, out var found)) Found[StageId] = found = new Dictionary<string, int>();
            var FX_PAL = new Dictionary<string, string[]>
            {
                ["crack"] = new[] { "#140a18", "#5a2a20", "#8a3e24", "#b05a2a", "#d27c3c", "#e4b072", "#fff6c4", "#ffffff" },
                ["ember"] = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" },
                ["seal"] = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" },
                ["vein"] = new[] { "#0c2a40", "#1a7aa8", "#28aed0", "#4cd8ec", "#a0f2fa", "#e4ffff", "#ffffff", "#ffffff" },
                ["fossil"] = new[] { "#1a1030", "#3a2468", "#5a3c94", "#7a5cb8", "#9a80d0", "#c8b8f0", "#ffffff", "#ffffff" },
                ["safe"] = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" },
                ["stele"] = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" },
            };
            var api = new Features.Api
            {
                Say = (m, sec) => Say.Push(m, sec),
                Toast = (m, sec, icon) => Say.Show(m, sec),
                Banner = (icon, title, eff, flavor) => { OnResBanner?.Invoke(icon, title, eff, flavor); Sfx("rare"); },
                Save = () => { },
                Refresh = () => ApplyStats(),
                Burst = (x, y, kind) =>
                {
                    if (kind == "crack") { Dust(x, y, 12); SceneLight.AddFlash(x, y - 24, 90, 3, 0.5, FX_PAL["crack"][5]); Sfx("hitH"); Fx.Shake(0.35, 4); Fx.HitStop(0.06); return; }
                    SpawnLive("collect-burst", Pf.Round(x), Pf.Round(y), new FxOptions { Palette = FX_PAL[kind], Light = 0.6 }); SceneLight.AddFlash(x, y, 90, 3, 0.6, FX_PAL[kind][5]); Sfx("levelup");
                },
                Boing = (x, y) => { Sfx("jump2"); Dust(x, y, 6); },
                Clink = (x, y) => { Sfx("clank"); SceneLight.AddFlash(x, y, 30, 1.5, 0.2, "#4cd8ec"); Fx.Shake(0.08, 1); },
                Loot = (x, y) => { DropCoins(x, y, 14); int a = IlvlNow(1); DropItem(x, y, Items.RARE, a, Items.RARE, -1); int b = IlvlNow(1); DropItem(x, y, Items.EPIC, b, Items.EPIC, 1); },
                AddMpBonus = n => { MpBonus += n; return MpBonus; },
                FossilForm = form => FormsOwned.ContainsKey(form) ? form : Player.Form,
                AddFormPt = form => { if (FormsOwned.ContainsKey(form)) FormsOwned[form]++; },
                AddLore = () => Lore++,
                AddScrap = n => Scrap += n,
                FormName = form => FORM_NAME.TryGetValue(form, out var nm) ? nm : null,
                FormColor = form => FORM_COLOR.TryGetValue(form, out var c) ? c : null,
            };
            var defs = StageD.Features.Select(f => new Features.Def { t = f.T, x = f.X, y = f.Y, h = f.Raw.ContainsKey("h") ? f.H : (double?)null, w = f.Raw.ContainsKey("w") ? f.W : (double?)null, i = f.Raw.ContainsKey("i") ? f.I : (int?)null, form = f.Form }).ToList();
            Features = new Features(defs, found, Player, Map, api, () => Input.JumpHeld);
            FeatureUsables = () => Features.UsableNow().Select(u => new Use { Kind = u.t == "safe" ? "chest" : "hand", X = u.x, Top = u.top, Go = () => Features.Use(u) });
            if (Chest != null) { var o = ChestTiers.Opts(Chest.Tier); o.X = Chest.X; o.Y = Chest.Y; chestFx = new FxRun(PixelFX.Fx.TreasureChest.Def, o); }
            Status.OnReaction = (kind, e) => { if (Reacted.Add(kind) && REACT_TIP.TryGetValue(kind, out var tip)) Say.Push(tip, 3); };
            OnShatter = (x, y, c) => DeathFx.Shatter(x, y, c);
            OnRegather = (x, y, c) => DeathFx.Regather(x, y, c);
        }

        partial void UpdateStageObjectsEarly(double dt)
        {
            Hazards.Update(dt, Enemies);
            DeathFx.Update(dt);
        }
        partial void UpdateStageObjectsPlayer(double dt)
        {
            var movers = new List<(double x, double y, double vx, bool dash)> { (Player.X, Player.Y, Player.Vx, Player.State == "dash") };
            foreach (var e in Enemies) if (!e.Dead && !e.K.Fly) movers.Add((e.X, e.Y, e.Vx, false));
            Props.Update(dt, movers, (CamX, CamX + W));
            Scenery.Update(dt, Player, (CamX, CamX + W));
        }
        partial void UpdateStageObjectsLate(double dt) { Features.Update(dt); }

        partial void StageLights(List<LightSrc> lights)
        {
            Props.Lights(lights);
            Scenery.Lights(lights);
            Features.Lights(lights);
        }
        partial void DrawAltar(Frame frame, Altar a)
        {
            if (!Town) TownArt.SnapPeople(frame);
            ZeroStar.Altar.Draw(frame, a.X, a.Y, a.Lit, sceneClock, a.Pulse);
            if (!Town) TownArt.OutlineActors(frame, OBJ_RIM, OBJ_OUTLINE, OBJ_LIFT);
            ObjGlow.Draw(frame, a.Lit ? "altarOn" : "altarOff", a.X, a.Y, sceneClock + a.X * 0.01);
        }
        // 2026-11-12：可以互動的東西（機關、木箱、水晶、祭壇）不能暗或不明顯——暗處提亮、描深色外框、左上加邊緣光
        const double OBJ_RIM = 0.3, OBJ_LIFT = 0.7; const uint OBJ_OUTLINE = 0xff200c0e;
        partial void DrawStageObjects(Frame frame, float[] lv)
        {
            Prof.Mark("S:前");
            if (Town) { Features.Draw(frame, sceneClock); Props.Draw(frame, lv); }
            else
            {
                Features.Draw(frame, sceneClock, 0); Props.Draw(frame, lv, 0);
                TownArt.SnapPeople(frame);
                Features.Draw(frame, sceneClock, 1); Props.Draw(frame, lv, 1);
                TownArt.OutlineActors(frame, OBJ_RIM, OBJ_OUTLINE, OBJ_LIFT);
                Features.Draw(frame, sceneClock, 2); Props.Draw(frame, lv, 2);
            }
            Prof.Mark("S:草叢木箱");
            Scenery.Draw(frame, lv, sceneClock); Prof.Mark("S:小生物裝飾");
            Hazards.Draw(frame); Prof.Mark("S:地面元素");
        }
        uint[] chestSnap = new uint[0];
        /// 還沒開的寶箱：寶箱自己的柔光不要把箱子本體照成一片（畫完之後本體的光壓到 2 成）
        partial void DrawChestSolid(Frame frame)
        {
            int Wf = frame.W, Hf = frame.H; uint[] C = frame.Color, L = frame.Light;
            int x0 = Math.Max(0, (int)Pf.Round(Chest.X - frame.Ox) - 40), x1 = Math.Min(Wf, x0 + 80), y1 = Math.Min(Hf, (int)Pf.Round(Chest.Y - frame.Oy) + 4), y0 = Math.Max(0, y1 - 70);
            int bw = Math.Max(0, x1 - x0), n = bw * Math.Max(0, y1 - y0);
            if (chestSnap.Length < n) chestSnap = new uint[n];
            for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) chestSnap[(y - y0) * bw + x - x0] = C[y * Wf + x];
            chestFx.Draw(frame);
            ObjGlow.Draw(frame, "chest", Chest.X, Chest.Y, sceneClock);
            for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++)
            {
                int i = y * Wf + x;
                if (C[i] == chestSnap[(y - y0) * bw + x - x0] || L[i] == 0) continue;
                uint d = L[i];
                L[i] = 0xff000000u | ((uint)Pf.ToInt32(((d >> 16) & 255) * 0.2) << 16) | ((uint)Pf.ToInt32(((d >> 8) & 255) * 0.2) << 8) | (uint)Pf.ToInt32((d & 255) * 0.2);
            }
        }
        partial void DrawDeathFx(Frame frame) { DeathFx.Draw(frame); }
        partial void DrawLowHp(Frame frame)
        {
            var v = ViewRect();
            LowHp.Draw(frame, LowHpK, LowHpPulse, Zoom, v.y0 - (H - H / Zoom) / 2);
        }
    }
}
