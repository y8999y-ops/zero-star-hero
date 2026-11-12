// game/src/features.js 一行一行翻成 C#：形態機關＋一次性資源。資料是每一關的 features：
//   crack 裂開的垃圾牆（鐵罐星衝撞撞破）、wind 深淵氣流（蝠翼星滑翔往上）、shroom 黏液菇（黏液星彈很高）、seal 星光封印（星屑彈打亮）
//   ember 星之殘火（最大魔力 +10）、vein 星塵礦脈（打三下）、fossil 魔物化石核（技能點）、safe 被丟下來的寶箱、stele 星王的碑文
// 拿過、打開過的記在 found（profile.found[關卡]），重進關卡不會再出現。畫在 FeatureArt.cs。
// 存檔、提示、橫幅這些用 Api 的回呼（main.js 傳進來的 api 和 profile 的修改）。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public class Features
    {
        // 碑文的故事（接神話「星王之冠」）
        public static readonly string[] STELE_LORE =
        {
            "碑文：「很久很久以前，天上有九顆最亮的星星。祂們之中最亮的那一顆，被稱為星王。」",
            "碑文：「星王為了照亮這片大地，自己墜落了下來。祂碎成了很多很多片，散落在這片土地上。」",
            "碑文：「每一片碎片都記得自己曾經是星王的一部分。……總有一天，它們會再聚在一起。」",
            "碑文：「如果你讀得懂這些字，那你也是那些碎片之一。歡迎回來。」",
        };
        static readonly Dictionary<string, string> GLOW_OF = new Dictionary<string, string> { ["ember"] = "ember", ["fossil"] = "fossil", ["safe"] = "chest", ["stele"] = "stele" };
        static readonly Dictionary<string, string> HINT = new Dictionary<string, string>
        {
            ["crack"] = "系統：這面牆裂開了……需要很硬、很重的東西撞過去。鐵罐星的衝撞應該可以。",
            ["wind"] = "系統：底下有風往上吹。用蝠翼星滑翔（在空中按住跳）的話，應該會被吹上去。",
            ["shroom"] = "系統：黏糊糊的菇。黏液星踩上去說不定會彈很高——同類嘛。",
            ["seal"] = "系統：門上刻著一顆星。……星星的光，星屑彈打打看？",
        };

        /// stage.js 的 features 一筆（t、x、y、h、w、i、form；沒有的用 null）
        public class Def { public string t; public double x, y; public double? h, w; public int? i; public string form; }

        /// main.js 傳進來的 api，加上原本直接改 profile 的地方
        public class Api
        {
            public Action<string, double> Say;
            public Action<string, double, string> Toast;                  // (訊息, 秒, 圖示)
            public Action<string, string, string, string> Banner;         // (圖示, 標題, 效果, 說明)
            public Action Save, Refresh;
            public Action<double, double, string> Burst;                  // (x, y, 種類)
            public Action<double, double> Boing, Clink, Loot;
            public Func<int, int> AddMpBonus;                             // profile.mpBonus += n，回傳新的值
            public Func<string, string> FossilForm;                       // profile.forms.owned[form] ? form : profile.forms.cur
            public Action<string> AddFormPt;                              // profile.forms.owned[form].pts += 1
            public Action AddLore;                                        // profile.lore += 1
            public Action<int> AddScrap;                                  // profile.scrap += n
            public Func<string, string> FormName, FormColor;              // FORMS[form]?.name / ?.color（沒有就 null）
        }

        public class Item
        {
            public string t, id, form; public double x, y, hp = 3, t0, open, lit, squash, cd; public double? h, w; public int? i; public bool done;
            public Platform plat; public bool hasPlat; public List<FeatureArt.Debris> debris;
        }

        public readonly List<Item> Items;
        readonly Dictionary<string, int> found; readonly HashSet<string> hinted = new HashSet<string>();
        readonly Player player; readonly GameMap map; readonly Api api; readonly Func<bool> jumpHeld;

        /// found＝profile.found[stageId]（會被寫入）；jumpHeld＝input.jumpHeld
        public Features(List<Def> list, Dictionary<string, int> found, Player player, GameMap map, Api api, Func<bool> jumpHeld)
        {
            this.found = found; this.player = player; this.map = map; this.api = api; this.jumpHeld = jumpHeld;
            Items = new List<Item>();
            for (int i = 0; i < list.Count; i++)
            {
                var f = list[i]; string id = f.t + i;
                var it = new Item { t = f.t, x = f.x, y = f.y, h = f.h, w = f.w, i = f.i, form = f.form, id = id, hp = 3 };
                it.t0 = Rnd.Next() * 9; it.open = 0; it.lit = 0; it.squash = 0; it.cd = 0; it.done = found.TryGetValue(id, out int v) && v != 0;
                Items.Add(it);
            }
            // 擋路的實心：裂牆、封印門
            foreach (var f in Items)
            {
                var b = Box(f);
                if (b.HasValue && !f.done) map.SetSolid(b.Value, true);
                if (f.t == "seal" && f.done) f.open = 1;
                if (f.t == "shroom") { f.plat = new Platform { X = f.x - 11, Y = f.y - 15, W = 22 }; f.hasPlat = true; map.Platforms.Add(f.plat); }
            }
        }
        static RectD? Box(Item f) => f.t == "crack" ? new RectD { X = f.x - 16, Y = f.y - (f.h ?? 48), W = 32, H = f.h ?? 48 } : f.t == "seal" ? new RectD { X = f.x - 12, Y = f.y - (f.h ?? 48), W = 24, H = f.h ?? 48 } : (RectD?)null;
        bool Near(Item f, double rx, double ry) => Math.Abs(player.X - f.x) < rx && player.Y > f.y - ry && player.Y < f.y + 6;
        void Hint(Item f) { if (hinted.Contains(f.t) || !HINT.ContainsKey(f.t)) return; hinted.Add(f.t); api.Say?.Invoke(HINT[f.t], 3.4); }
        void Take(Item f) { f.done = true; found[f.id] = 1; api.Save?.Invoke(); }

        public void Update(double dt)
        {
            foreach (var f in Items)
            {
                f.cd -= dt;
                if (f.debris != null) { FeatureArt.UpdateDebris(f.debris, dt); if (f.debris.All(d => d.age > d.life)) f.debris = null; }
                if (f.t == "crack" && !f.done)
                {
                    if (Near(f, 30, (f.h ?? 48) + 10))
                    {
                        if (player.Form == "can" && player.State == "charge")
                        {
                            map.SetSolid(Box(f).Value, false); Take(f);
                            f.debris = FeatureArt.CrackDebris(f.x, f.y, f.h ?? 48, player.Face);   // 牆上每一塊垃圾各自噴飛
                            api.Burst?.Invoke(f.x, f.y, "crack");
                        }
                        else if (Math.Abs(player.X - f.x) < 26) Hint(f);
                    }
                }
                else if (f.t == "wind")
                {
                    bool inside = Math.Abs(player.X - f.x) < f.w.Value / 2 && player.Y < f.y && player.Y > f.y - f.h.Value;
                    if (inside && !player.Grounded)
                    {
                        if (player.Form == "bat" && jumpHeld()) player.Vy = Math.Max(-170, player.Vy - 1500 * dt);   // 滑翔的時候被吹上去
                        else Hint(f);
                    }
                }
                else if (f.t == "shroom")
                {
                    f.squash = Math.Max(0, f.squash - dt * 4);
                    bool on = player.Grounded && Math.Abs(player.Y - f.plat.Y) < 1 && player.X >= f.plat.X - 2 && player.X <= f.plat.X + f.plat.W + 2;
                    if (on && player.Form == "slime" && f.cd <= 0) { player.Vy = -560; player.BoostT = 0.6; player.Grounded = false; player.Y -= 1; f.squash = 1; f.cd = 0.3; api.Boing?.Invoke(f.x, f.plat.Y); }
                    else if (on) Hint(f);
                }
                else if (f.t == "seal")
                {
                    if (f.lit > 0 && f.open < 1) { f.lit = Math.Min(1, f.lit + dt * 2); if (f.lit >= 1) f.open = Math.Min(1, f.open + dt * 1.2); if (f.open >= 1) { map.SetSolid(Box(f).Value, false); Take(f); } }
                    else if (!f.done && f.lit == 0 && Math.Abs(player.X - f.x) < 30 && Math.Abs(player.Y - f.y) < 40) Hint(f);
                }
            }
        }

        /// 互動鍵：站在旁邊可以用的東西，top＝頭上「！」的高度
        static readonly Dictionary<string, double[]> USE = new Dictionary<string, double[]> { ["ember"] = new double[] { 14, 22, 24 }, ["fossil"] = new double[] { 16, 16, 20 }, ["safe"] = new double[] { 22, 26, 31 }, ["stele"] = new double[] { 16, 34, 40 } };
        public class Usable { public Item f; public string t; public double x, y, top; }
        public List<Usable> UsableNow()
        {
            var o = new List<Usable>();
            foreach (var f in Items) { if (USE.TryGetValue(f.t, out var u) && !f.done && Near(f, u[0], u[1])) o.Add(new Usable { f = f, t = f.t, x = f.x, y = f.y, top = f.y - u[2] }); }
            return o;
        }
        public void Use(Usable u)
        {
            var f = u.f;
            if (f.done) return;
            if (f.t == "ember")
            {
                Take(f); int bonus = api.AddMpBonus != null ? api.AddMpBonus(10) : 10; api.Refresh?.Invoke();
                api.Burst?.Invoke(f.x, f.y - 10, "ember"); api.Banner?.Invoke("res_ember", "星之殘火", $"最大魔力 +10（{100 + bonus}）", "你墜落時散掉的一小塊自己，撿回來了。");
            }
            else if (f.t == "fossil")
            {
                string form = api.FossilForm != null ? api.FossilForm(f.form) : f.form;
                api.AddFormPt?.Invoke(form);
                Take(f); api.Burst?.Invoke(f.x, f.y - 8, "fossil"); api.Banner?.Invoke("res_fossil", "魔物化石核", $"{api.FormName?.Invoke(form)} 靈核 +1", "很久以前的魔物靈核，變成化石了還吸收得到。");
            }
            else if (f.t == "safe")
            {
                Take(f); api.Loot?.Invoke(f.x, f.y - 12); api.Burst?.Invoke(f.x, f.y - 10, "safe"); api.Toast?.Invoke("被丟下來的寶箱：上面的世界丟了一個保險箱下來……沒鎖。", 2.8, "res_safe");
            }
            else if (f.t == "stele")
            {
                Take(f); api.AddLore?.Invoke();
                api.Say?.Invoke(STELE_LORE[(f.i ?? 0) % STELE_LORE.Length], 5); api.Burst?.Invoke(f.x, f.y - 20, "stele");
            }
        }
        /// 攻擊範圍打到礦脈：每下間隔 0.25 秒，3 下碎掉
        public void Hit((double x0, double x1, double y0, double y1) b)
        {
            foreach (var f in Items)
            {
                if (f.t != "vein" || f.done || f.cd > 0) continue;
                if (b.x1 < f.x - 14 || b.x0 > f.x + 14 || b.y1 < f.y - 18 || b.y0 > f.y) continue;
                f.cd = 0.25; f.hp--; api.Clink?.Invoke(f.x, f.y - 8);
                if (f.hp <= 0) { Take(f); int n = 60 + (int)Math.Floor(Rnd.Next() * 61); api.AddScrap?.Invoke(n); api.Burst?.Invoke(f.x, f.y - 8, "vein"); api.Toast?.Invoke($"星塵礦脈：星塵 +{n}", 2.4, "res_vein"); }
            }
        }
        /// 技能彈飛到封印門：星星的星屑彈會點亮；回傳 true＝彈打到門了（要爆開）
        public bool ShotAt(double x, double y, string form)
        {
            foreach (var f in Items)
            {
                if (f.t != "seal" || f.open >= 1) continue;
                var b = Box(f).Value;
                if (x < b.X - 2 || x > b.X + b.W + 2 || y < b.Y || y > b.Y + b.H) continue;
                if (form == "star" && f.lit == 0) { f.lit = 0.01; api.Burst?.Invoke(f.x, f.y - (f.h ?? 48) / 2, "seal"); }
                else if (form != "star") Hint(f);
                return true;
            }
            return false;
        }
        /// part：-1 全部、0 氣流和碎片、1 物件本體、2 發光粒子（分開畫，本體才能單獨描外框）
        public void Draw(Frame frame, double t, int part = -1)
        {
            foreach (var f in Items)
            {
                double tt = t + f.t0;
                if (part <= 0)
                {
                    if (f.debris != null) FeatureArt.DrawDebris(frame, f.debris);
                    if (f.t == "wind") FeatureArt.DrawWind(frame, f.x, f.y, f.w.Value, f.h.Value, tt);
                }
                if (part == 0) continue;
                if (part == 2) { if (!f.done && GLOW_OF.TryGetValue(f.t, out var g2)) ObjGlow.Draw(frame, g2, f.x, f.y, tt, f.t == "fossil" ? api.FormColor?.Invoke(f.form) : null); continue; }
                if (f.t == "crack" && !f.done) FeatureArt.DrawCrack(frame, f.x, f.y, f.hp >= 3 ? 1 : 0.4, tt, f.h ?? 48);
                else if (f.t == "shroom") FeatureArt.DrawShroom(frame, f.x, f.y, f.squash, tt);
                else if (f.t == "seal" && f.open < 1) FeatureArt.DrawSeal(frame, f.x, f.y, f.lit, Math.Max(0, f.open), tt, f.h ?? 48);
                else if (f.t == "ember" && !f.done) FeatureArt.DrawEmber(frame, f.x, f.y, tt);
                else if (f.t == "vein" && !f.done) FeatureArt.DrawVein(frame, f.x, f.y, (int)(3 - f.hp), tt);
                else if (f.t == "fossil" && !f.done) FeatureArt.DrawFossil(frame, f.x, f.y, tt, api.FormColor?.Invoke(f.form));
                else if (f.t == "safe") FeatureArt.DrawSafe(frame, f.x, f.y, f.done, tt);
                else if (f.t == "stele") FeatureArt.DrawStele(frame, f.x, f.y, f.done, tt);
                // 還沒拿的重要東西身上有發光粒子
                if (part < 0 && !f.done && GLOW_OF.TryGetValue(f.t, out var g)) ObjGlow.Draw(frame, g, f.x, f.y, tt, f.t == "fossil" ? api.FormColor?.Invoke(f.form) : null);
            }
        }
        public void Lights(List<LightSrc> list)
        {
            foreach (var f in Items)
            {
                if (f.t == "ember" && !f.done) list.Add(new LightSrc(f.x, f.y - 10, 40, 1.8, "#ffd060"));
                else if (f.t == "seal" && f.lit > 0 && f.open < 1) list.Add(new LightSrc(f.x, f.y - 24, 60 * f.lit, 2, "#ffe066"));
                else if (f.t == "fossil" && !f.done) list.Add(new LightSrc(f.x, f.y - 8, 24, 1, api.FormColor?.Invoke(f.form) ?? "#b878ff"));
                else if (f.t == "vein" && !f.done) list.Add(new LightSrc(f.x, f.y - 10, 28, 1.2, "#4cd8ec"));
                else if (f.t == "stele" && f.done) list.Add(new LightSrc(f.x, f.y - 18, 30, 1, "#ffe066"));
            }
        }
    }
}
