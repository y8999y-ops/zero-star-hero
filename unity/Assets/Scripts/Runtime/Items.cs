// game/src/items.js（裝備資料與隨機產生）與 stats.js（裝備 → 戰鬥數值）翻成 C#。
// 隨機數用 Rnd（網頁版的 Math.random），取用的順序照原本，所以同一個種子會產生一模一樣的裝備。
using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using PixelFX;

namespace ZeroStar
{
    public class Affix { public string Id; public int Tier; public double V; }
    public class Item
    {
        public string Uid, Base, Kind, Icon, Name, Unique, Myth, Set, Junk;
        public int Rarity, Ilvl, Plus;
        public Affix Main;   // 主屬性（Tier 不用）
        public List<Affix> Affixes = new List<Affix>();
        public int AwakenKills;   // 神話：穿著累積的擊殺數
        public string Form;       // 魔物核（kind＝formcore）：哪個形態
        public bool New;
    }

    public static class Items
    {
        // ---- 稀有度
        public class RarityDef { public string Id, Name, Color; public double Weight, Mult; public int Sub0, Sub1, Scrap, Coin; }
        public static readonly RarityDef[] RARITY =
        {
            new RarityDef { Id = "common", Name = "普通", Color = "#e8e6f2", Weight = 80, Sub0 = 0, Sub1 = 1, Mult = 1, Scrap = 1, Coin = 3 },
            new RarityDef { Id = "fine", Name = "精良", Color = "#5ad06a", Weight = 15, Sub0 = 1, Sub1 = 2, Mult = 1.1, Scrap = 2, Coin = 8 },
            new RarityDef { Id = "rare", Name = "稀有", Color = "#5aa6ff", Weight = 5, Sub0 = 2, Sub1 = 3, Mult = 1.2, Scrap = 4, Coin = 20 },
            new RarityDef { Id = "epic", Name = "史詩", Color = "#b878ff", Weight = 0, Sub0 = 3, Sub1 = 4, Mult = 1.3, Scrap = 8, Coin = 45 },
            new RarityDef { Id = "legend", Name = "傳說", Color = "#ff8a2a", Weight = 0, Sub0 = 4, Sub1 = 4, Mult = 1.4, Scrap = 15, Coin = 100 },
            new RarityDef { Id = "myth", Name = "神話", Color = "#fff0a0", Weight = 0, Sub0 = 4, Sub1 = 4, Mult = 1.5, Scrap = 30, Coin = 200 },
        };
        public const int COMMON = 0, FINE = 1, RARE = 2, EPIC = 3, LEGEND = 4, MYTH = 5;
        public static int RarityOf(string name) => Array.IndexOf(new[] { "common", "fine", "rare", "epic", "legend", "myth" }, name);

        // ---- 屬性（14 種，順序跟網頁版一樣：抽副屬性時照這個順序）
        public class StatDef { public string Id, Name; public bool Pct, Neg; public int Dec; public double[][] T; public double MainV; }
        static StatDef St(string id, string name, bool pct, double[][] t, double main = 0, int dec = 0, bool neg = false) => new StatDef { Id = id, Name = name, Pct = pct, T = t, MainV = main, Dec = dec, Neg = neg };
        static double[][] T(params double[] v) { var r = new double[5][]; for (int i = 0; i < 5; i++) r[i] = new[] { v[i * 2], v[i * 2 + 1] }; return r; }
        public static readonly StatDef[] STATS =
        {
            St("atk", "攻擊", false, T(6, 9, 5, 7, 4, 5, 2, 4, 1, 3)),
            St("atkPct", "攻擊", true, T(8, 10, 7, 8, 5, 7, 4, 5, 2, 4), 6),
            St("hp", "生命", false, T(30, 40, 24, 33, 18, 26, 12, 19, 6, 12)),
            St("hpPct", "生命", true, T(8, 10, 7, 8, 5, 7, 4, 5, 2, 4), 6),
            St("def", "防禦", false, T(10, 12, 8, 10, 6, 8, 4, 6, 2, 4)),
            St("crit", "暴擊率", true, T(5, 6, 4, 5, 3, 4, 2, 3, 1, 2), 4),
            St("critDmg", "暴擊傷害", true, T(10, 12, 8, 10, 6, 8, 4, 6, 2, 4), 8),
            St("skill", "技能傷害", true, T(14, 18, 12, 15, 9, 12, 7, 9, 4, 6), 10),
            St("ult", "大招傷害", true, T(18, 22, 15, 18, 11, 15, 8, 11, 5, 8), 12),
            St("charge", "魔力回復", true, T(12, 15, 10, 12, 8, 10, 5, 7, 3, 5), 8),
            St("cdr", "技能冷卻", true, T(7, 8, 6, 7, 4, 6, 3, 4, 2, 3), 0, 0, true),
            St("leech", "吸血", true, T(2.5, 3, 2, 2.5, 1.5, 2, 1, 1.5, 0.5, 0.5), 1.5, 1),
            St("move", "移速", true, T(6, 7, 5, 6, 4, 5, 3, 4, 2, 3), 5),
            St("mf", "掉寶率", true, T(15, 18, 12, 15, 9, 12, 6, 9, 4, 6)),
        };
        public static StatDef Stat(string id) => STATS.First(s => s.Id == id);
        static readonly string[] STAT_IDS = STATS.Select(s => s.Id).ToArray();

        static readonly Dictionary<string, (string id, double w)[]> MAIN_POOL = new Dictionary<string, (string, double)[]>
        {
            ["head"] = new[] { ("atkPct", 3.0), ("hpPct", 3.0), ("crit", 2.0), ("critDmg", 2.0) },
            ["feet"] = new[] { ("atkPct", 3.0), ("hpPct", 3.0), ("charge", 2.0), ("move", 2.0) },
            ["acc"] = new[] { ("atkPct", 3.0), ("hpPct", 3.0), ("skill", 2.0), ("ult", 2.0), ("charge", 2.0), ("leech", 1.0) },
        };

        public class BaseDef { public string Id, Kind, Name, Short, Icon, Sub; public double Atk, Hp; public int Lv; }
        static BaseDef B(string id, string kind, string name, string sh, string icon, int lv, double atk = 0, double hp = 0, string sub = null) => new BaseDef { Id = id, Kind = kind, Name = name, Short = sh, Icon = icon, Lv = lv, Atk = atk, Hp = hp, Sub = sub };
        public static readonly BaseDef[] BASES =
        {
            B("sword1", "weapon", "鏽色星核", "鏽核", "core_rust", 1, 12), B("sword2", "weapon", "晨光星核", "晨核", "core_dawn", 6, 15),
            B("great1", "weapon", "沉重星核", "重核", "core_heavy", 1, 17), B("great2", "weapon", "隕鐵星核", "隕核", "core_meteor", 8, 22),
            B("dagger1", "weapon", "尖銳星核", "尖核", "core_sharp", 1, 10, 0, "crit"), B("dagger2", "weapon", "暗影星核", "影核", "core_shadow", 7, 13, 0, "crit"),
            B("spear1", "weapon", "細長星核", "長核", "core_long", 1, 12), B("spear2", "weapon", "彗尾星核", "彗核", "core_comet", 7, 16),
            B("hammer1", "weapon", "鈍光星核", "鈍核", "core_dull", 1, 16), B("hammer2", "weapon", "巨岩星核", "岩核", "core_rock", 8, 21),
            B("head1", "head", "破水桶", "水桶", "bucket", 1), B("head2", "head", "皮帽", "皮帽", "cap", 4), B("head3", "head", "鐵頭盔", "頭盔", "helm", 10),
            B("body1", "body", "麻布衣", "布衣", "shirt", 1, 0, 30), B("body2", "body", "皮甲", "皮甲", "vest", 4, 0, 38), B("body3", "body", "鎖子甲", "鎖甲", "mail", 10, 0, 48),
            B("hands1", "hands", "工作手套", "手套", "glove", 1, 3), B("hands2", "hands", "皮護手", "護手", "gauntlet", 5, 5),
            B("feet1", "feet", "草編涼鞋", "涼鞋", "slipper", 1), B("feet2", "feet", "皮靴", "皮靴", "boot", 4), B("feet3", "feet", "鐵靴", "鐵靴", "ironboot", 10),
            B("acc1", "acc", "生鏽的鐵環", "鐵環", "pulltab", 1), B("acc2", "acc", "銅戒指", "戒指", "ring", 3), B("acc3", "acc", "舊護身符", "護身符", "amulet", 6),
        };
        public static BaseDef Base(string id) => BASES.First(b => b.Id == id);

        public static readonly (string id, string name, string icon, string say)[] JUNK =
        {
            ("fishbone", "魚骨頭", "fishbone", "系統：一根魚骨頭。你的收集魂在燃燒呢。"),
            ("bottle", "空藥水瓶", "bottle", "系統：空的藥水瓶。記得回收，冒險者也要做環保。"),
            ("sock", "破襪子", "sock", "系統：破襪子……只有一隻。另一隻呢？"),
            ("chopsticks", "斷掉的練習魔杖", "chopsticks", "系統：魔杖，斷的。……練習用的那種。完美的垃圾。"),
            ("bento", "發霉的乾糧", "bento", "系統：過期三天的乾糧。不准吃。"),
        };
        public const double JUNK_CHANCE = 0.35;

        public class UniqueDef { public string Id, Kind, Name, Icon; public double Atk; }
        public static readonly UniqueDef[] UNIQUES =
        {
            new UniqueDef { Id = "slipper", Kind = "feet", Name = "前任冒險者的草鞋", Icon = "leg_slipper" },
            new UniqueDef { Id = "overtime", Kind = "acc", Name = "通宵委託單", Icon = "leg_overtime" },
            new UniqueDef { Id = "noisy", Kind = "weapon", Name = "很吵的星核", Icon = "leg_noisy", Atk = 18 },
            new UniqueDef { Id = "hardhat", Kind = "head", Name = "爆炸頭礦工帽", Icon = "leg_hardhat" },
        };
        public static readonly (string id, string kind, string name, string icon)[] MYTHS =
        {
            ("starking", "head", "星王之冠", "myth_crown"),
            ("fallheart", "acc", "墜落之心", "myth_heart"),
        };
        public static readonly int[] AWAKEN = { 0, 300, 1000 };
        public static int AwakenStage(Item it) => it.AwakenKills >= AWAKEN[2] ? 3 : it.AwakenKills >= AWAKEN[1] ? 2 : 1;
        public static readonly (string id, string name)[] SETS = { ("meteor", "流星獵手"), ("reson", "星辰共鳴"), ("feast", "夜宴") };
        static readonly Dictionary<string, string> SET_KIND_NAME = new Dictionary<string, string> { ["weapon"] = "核", ["head"] = "冠", ["body"] = "殼", ["hands"] = "爪", ["feet"] = "靴", ["acc"] = "碎片" };
        static readonly string[] RARE_NAMES = { "苦工哥布林", "夜班守衛", "送信鳥人", "失眠貓頭鷹", "禿頭魔像", "谷底", "午夜", "墜星", "見習生", "流星", "被甩的骷髏", "收租蘑菇", "末班馬車", "路邊雜貨攤" };

        // ---- 星核的核心效果
        public class CoreDef { public string Id, Name; public double V, W; public bool Inv; public int Dec; }
        static readonly double[] CORE_RMUL = { 1, 1.1, 1.2, 1.35, 1.5, 1.5 };
        public static readonly Dictionary<string, CoreDef> CORES = new[]
        {
            new CoreDef { Id = "rust", Name = "鏽蝕終擊", V = 20, W = 60 }, new CoreDef { Id = "dawn", Name = "晨光", V = 8, W = 24 },
            new CoreDef { Id = "heavy", Name = "沉重", V = 20, W = 60 }, new CoreDef { Id = "meteor", Name = "隕鐵", V = 12, W = 7, Inv = true, Dec = 1 },
            new CoreDef { Id = "sharp", Name = "尖銳", V = 10, W = 30 }, new CoreDef { Id = "shadow", Name = "暗影", V = 10, W = 30 },
            new CoreDef { Id = "long", Name = "細長", V = 10, W = 30 }, new CoreDef { Id = "comet", Name = "彗尾", V = 20, W = 60 },
            new CoreDef { Id = "dull", Name = "鈍光", V = 8, W = 20 }, new CoreDef { Id = "rock", Name = "巨岩", V = 20, W = 60 },
            new CoreDef { Id = "noisy", Name = "吐槽", V = 5, W = 10, Dec = 0 },
        }.ToDictionary(c => c.Id);
        static readonly Dictionary<string, string> CORE_OF = new Dictionary<string, string> { ["sword1"] = "rust", ["sword2"] = "dawn", ["great1"] = "heavy", ["great2"] = "meteor", ["dagger1"] = "sharp", ["dagger2"] = "shadow", ["spear1"] = "long", ["spear2"] = "comet", ["hammer1"] = "dull", ["hammer2"] = "rock" };
        // ---- 強化（items.js）：上限看稀有度、每 +5 開副屬性（星核上限兩倍、每 +10），+11 以後可能失敗（失敗只扣材料）
        public static readonly int[] MAX_PLUS = { 5, 10, 15, 20, 25, 25 };
        public static int MaxPlus(Item it) => (it.Rarity < MAX_PLUS.Length ? MAX_PLUS[it.Rarity] : 5) * (IsCore(it) ? 2 : 1);
        public static int SubStep(Item it) => IsCore(it) ? 10 : 5;
        /// 從 +p 強化到 +p+1 的成功率（%）
        public static int EnhanceRate(int p)
        {
            int t = p + 1;
            if (t <= 10) return 100;
            if (t >= 40) return 10;
            if (t >= 30) return 15;
            if (t >= 26) return 20;
            return new[] { 90, 80, 70, 60, 50, 40, 30, 25 }[Math.Min(7, (t - 11) / 2)];
        }
        public static (int scrap, int coins) EnhanceCost(int p, Item it) => (2 + p * 2 + it.Rarity * 2, 15 + p * 12);
        public class Up { public string Kind, Id; public double Before, After; }
        /// 強化成功：+1。到 +5 的倍數時開副屬性（還沒 4 條＝新增一條，滿了＝隨機提升一條）
        public static Up EnhanceUp(Item it)
        {
            it.Plus++;
            if (it.Plus % SubStep(it) != 0 || it.Kind == "junk") return null;
            if (it.Affixes.Count < 4)
            {
                var have = new HashSet<string>(it.Affixes.Select(x => x.Id)); if (it.Main != null) have.Add(it.Main.Id);
                var n = RollSub(Pick(STAT_IDS.Where(id => !have.Contains(id)).ToList()), it.Ilvl);
                it.Affixes.Add(n);
                return new Up { Kind = "add", Id = n.Id, Before = 0, After = n.V };
            }
            var a = Pick(it.Affixes); var S = Stat(a.Id); double add = RollSub(a.Id, it.Ilvl).V, before = a.V;
            a.V = ToFixed(a.V + add, S.Dec);
            return new Up { Kind = "up", Id = a.Id, Before = before, After = a.V };
        }
        /// 工坊的重鑄：第 i 條副屬性換成另一種（不跟主屬性、其他條重複）
        public static Affix RerollAffix(Item it, int i)
        {
            var have = new HashSet<string>(it.Affixes.Select(x => x.Id)); if (it.Main != null) have.Add(it.Main.Id);
            var pool = STAT_IDS.Where(id => !have.Contains(id)).ToList();
            var a = RollSub(pool.Count > 0 ? Pick(pool) : it.Affixes[i].Id, it.Ilvl);
            it.Affixes[i] = a;
            return a;
        }
        public static (int scrap, int coins) RerollCost(Item it) => (6 + it.Rarity * 3, 40 + it.Rarity * 40);
        /// 一條屬性的文字：「攻擊 +12%」「技能冷卻 -5%」
        public static string FmtStat(string id, double v)
        {
            var S = Stat(id); double n = ToFixed(v, S.Dec);
            return $"{S.Name} {(S.Neg ? "-" : "+")}{n.ToString(S.Dec > 0 ? "0.#" : "0")}{(S.Pct ? "%" : "")}";
        }
        public static readonly Dictionary<string, Func<double, string>> CORE_TEXT = new Dictionary<string, Func<double, string>>
        {
            ["rust"] = x => $"連段最後一下傷害 +{x}%", ["dawn"] = x => $"生命 80% 以上時，傷害 +{x}%", ["heavy"] = x => $"普攻擊退 +{x}%；被打飛的敵人撞到別的敵人時，對方也會受傷",
            ["meteor"] = x => $"每 {x} 秒，下一次技能多叫一顆小隕石", ["sharp"] = x => $"暴擊時多打一次 {x}% 的星光傷害", ["shadow"] = x => $"閃避後 2 秒內，傷害 +{x}%",
            ["long"] = x => $"普攻距離 +{x}%", ["comet"] = x => $"衝刺留下一道星光尾巴，敵人碰到受到攻擊力 {x}% 的傷害", ["dull"] = x => $"被打時 {x}% 機率讓攻擊你的敵人暈 1 秒",
            ["rock"] = x => $"生命低於 40% 時，防禦 +{x}%", ["noisy"] = x => $"每 10 秒吐槽你一次，並給予隨機增益 {x} 秒",
        };

        public static bool IsCore(Item it) => it?.Kind == "weapon";
        public static int CoreTier(Item it) => Math.Min(6, 1 + it.Plus / 10);
        /// 這顆星核的核心效果（id、數值）；不是星核回傳 null
        public static (string id, int tier, double x)? CoreOf(Item it)
        {
            if (!IsCore(it)) return null;
            string id = it.Unique == "noisy" ? "noisy" : (it.Base != null && CORE_OF.TryGetValue(it.Base, out var c) ? c : null);
            if (id == null || !CORES.TryGetValue(id, out var C)) return null;
            int tier = CoreTier(it); double raw = C.V + ((C.W - C.V) * (tier - 1)) / 5, m = id == "noisy" ? 1 : (it.Rarity < CORE_RMUL.Length ? CORE_RMUL[it.Rarity] : 1);
            double x = C.Inv ? raw / m : raw * m;
            return (id, tier, ToFixed(x, C.Dec));
        }

        // ---- JS 的 Number(x.toFixed(d))：照 double 的精確值四捨五入（剛好一半取大的），再轉回 double
        public static double ToFixed(double x, int d)
        {
            if (double.IsNaN(x) || double.IsInfinity(x) || Math.Abs(x) >= 1e21) return x;
            long bits = BitConverter.DoubleToInt64Bits(x);
            bool neg = bits < 0; int exp = (int)((bits >> 52) & 0x7ff); long man = bits & 0xfffffffffffffL;
            if (exp == 0) exp++; else man |= 1L << 52;
            exp -= 1075;   // x = man × 2^exp
            BigInteger num = new BigInteger(man) * BigInteger.Pow(10, d), den = BigInteger.One;
            if (exp > 0) num <<= exp; else den <<= -exp;
            BigInteger q = BigInteger.DivRem(num, den, out var rem);
            if (rem * 2 >= den) q += 1;   // toFixed：一半時取絕對值大的
            string s = q.ToString().PadLeft(d + 1, '0');
            if (d > 0) s = s.Substring(0, s.Length - d) + "." + s.Substring(s.Length - d);
            double v = double.Parse(s, System.Globalization.CultureInfo.InvariantCulture);
            return neg ? -v : v;
        }

        // ---- 隨機（照 items.js 的取用順序）
        static T Pick<T>(IList<T> a) => a[(int)Math.Floor(Rnd.Next() * a.Count)];
        static double RandIn(double a, double b, int dec = 0) { double k = Pf.Pow(10, dec); return Pf.Round((a + Rnd.Next() * (b - a)) * k) / k; }
        static int uidN;
        static string NewUid() => "u" + (uidN++).ToString("x");
        static string Weighted((string id, double w)[] w)
        {
            double x = Rnd.Next() * w.Sum(e => e.w);
            foreach (var (id, ww) in w) if ((x -= ww) < 0) return id;
            return w[0].id;
        }
        public static int TiersFor(int ilvl) => ilvl >= 80 ? 5 : ilvl >= 60 ? 4 : ilvl >= 40 ? 3 : ilvl >= 20 ? 2 : 1;
        public static double Growth(int ilvl) => 1 + 0.02 * (ilvl - 1);
        public static double PlusMul(int p) => 1 + 0.05 * p;

        /// 抽稀有度。mf＝掉寶率加成（%），minR＝保底
        public static int RollRarity(double mf = 0, int minR = 0)
        {
            var w = RARITY.Select((r, i) => i < minR ? 0 : r.Weight * (i >= FINE ? 1 + mf / 100 : 1)).ToArray();
            if (w.All(v => v == 0)) return minR;
            double x = Rnd.Next() * w.Sum();
            for (int i = 0; i < w.Length; i++) if ((x -= w[i]) < 0) return i;
            return minR;
        }
        static Affix RollSub(string id, int ilvl)
        {
            var S = Stat(id); int n = TiersFor(ilvl);
            var w = new[] { 1, 0.55, 0.3, 0.16, 0.08 }.Take(n).ToArray();
            double x = Rnd.Next() * w.Sum(); int k = 0;
            while ((x -= w[k]) >= 0 && k < n - 1) k++;
            int tier = 5 - k; var ab = S.T[tier - 1];
            return new Affix { Id = id, Tier = tier, V = RandIn(ab[0], ab[1], S.Dec) };
        }
        static List<Affix> RollSubs(int count, int ilvl, string mainId, string must)
        {
            var pool = STAT_IDS.Where(id => id != mainId && id != must).ToList();
            var outp = must != null ? new List<Affix> { RollSub(must, ilvl) } : new List<Affix>();
            while (outp.Count < count && pool.Count > 0)
            {
                int i = (int)Math.Floor(Rnd.Next() * pool.Count); string id = pool[i]; pool.RemoveAt(i);
                outp.Add(RollSub(id, ilvl));
            }
            return outp;
        }
        static Affix RollMain(double atk, double hp, string kind, int ilvl, int rarity)
        {
            double g = Growth(ilvl) * RARITY[rarity].Mult;
            if (atk != 0) return new Affix { Id = "atk", V = Pf.Round(atk * g) };
            if (hp != 0) return new Affix { Id = "hp", V = Pf.Round(hp * g) };
            string id = Weighted(MAIN_POOL[kind]); var S = Stat(id);
            return new Affix { Id = id, V = ToFixed(S.MainV * g, S.Dec) };
        }

        /// 產生一件物品（items.js 的 makeItem）
        public static Item MakeItem(double ilvlIn, int rarity, string kind = null, string baseId = null, bool noJunk = false, string set = null, string unique = null, string myth = null)
        {
            int ilvl = (int)Math.Max(1, Pf.Round(ilvlIn));
            if (rarity == MYTH) return MakeMyth(myth ?? Pick(MYTHS.Select(m => m.id).ToList()), ilvl);
            if (rarity == LEGEND && baseId == null)
            {
                var ids = UNIQUES.Where(u => kind == null || u.Kind == kind).Select(u => u.Id).ToList();
                if (ids.Count > 0) return MakeUnique(unique ?? Pick(ids), ilvl);
            }
            if (rarity == COMMON && kind == null && baseId == null && !noJunk && Rnd.Next() < JUNK_CHANCE)
            {
                var j = Pick(JUNK);
                return new Item { Uid = NewUid(), Junk = j.id, Kind = "junk", Name = j.name, Icon = j.icon, Rarity = rarity, Ilvl = ilvl };
            }
            if (baseId == null)
            {
                var ids = BASES.Where(b => b.Lv <= ilvl && (kind == null || b.Kind == kind)).Select(b => b.Id).ToList();
                baseId = Pick(ids);
                var bk = Base(baseId);
                var better = ids.Where(id => Base(id).Kind == bk.Kind && Base(id).Lv > bk.Lv).ToList();
                if (better.Count > 0 && Rnd.Next() < 0.5) baseId = Pick(better);
            }
            var b = Base(baseId); var rr = RARITY[rarity];
            var main = RollMain(b.Atk, b.Hp, b.Kind, ilvl, rarity);
            var affixes = RollSubs(rr.Sub0 + (int)Math.Floor(Rnd.Next() * (rr.Sub1 - rr.Sub0 + 1)), ilvl, main.Id, b.Sub);
            var item = new Item { Uid = NewUid(), Base = baseId, Kind = b.Kind, Icon = b.Icon, Rarity = rarity, Ilvl = ilvl, Main = main, Affixes = affixes, Plus = 0 };
            if (rarity == EPIC && b.Kind != "weapon")
            {
                item.Set = set ?? Pick(SETS.Select(s => s.id).ToList());
                item.Icon = $"set_{item.Set}_{b.Kind}";
                item.Name = $"{SETS.First(s => s.id == item.Set).name}之{SET_KIND_NAME[b.Kind]}";
                return item;
            }
            item.Name = NameFor(item, rarity >= RARE ? Pick(RARE_NAMES) : null);
            return item;
        }
        public static Item MakeUnique(string id, int ilvl)
        {
            var u = UNIQUES.First(x => x.Id == id);
            var main = RollMain(u.Atk, 0, u.Kind, ilvl, LEGEND);
            return new Item { Uid = NewUid(), Unique = id, Kind = u.Kind, Icon = u.Icon, Rarity = LEGEND, Ilvl = ilvl, Main = main, Affixes = RollSubs(4, ilvl, main.Id, null), Name = u.Name };
        }
        public static Item MakeMyth(string id, int ilvl)
        {
            var m = MYTHS.First(x => x.id == id);
            var main = RollMain(0, 0, m.kind, ilvl, MYTH);
            return new Item { Uid = NewUid(), Myth = id, Kind = m.kind, Icon = m.icon, Rarity = MYTH, Ilvl = ilvl, Main = main, Affixes = RollSubs(4, ilvl, main.Id, null), Name = m.name };
        }
        static readonly Dictionary<string, string> MAIN_ADJ = new Dictionary<string, string> { ["atk"] = "鋒利", ["atkPct"] = "鋒利", ["hp"] = "結實", ["hpPct"] = "結實", ["crit"] = "精準", ["critDmg"] = "殘暴", ["skill"] = "魔力", ["ult"] = "星爆", ["charge"] = "泉湧", ["leech"] = "嗜血", ["move"] = "疾風" };
        public static string NameFor(Item it, string rareName)
        {
            if (it.Unique != null) return UNIQUES.First(u => u.Id == it.Unique).Name;
            var b = Base(it.Base);
            if (it.Rarity == FINE) return (MAIN_ADJ.TryGetValue(it.Main.Id, out var a) ? a : it.Affixes.Count > 0 && MAIN_ADJ.TryGetValue(it.Affixes[0].Id, out var a2) ? a2 : "精良") + "的" + b.Short;
            if (it.Rarity >= RARE) return (rareName ?? "墜星") + "之" + b.Short;
            return b.Name;
        }
        /// 主屬性目前的數值（含強化）
        public static double MainValue(Item it)
        {
            if (it.Main == null) return 0;
            var S = Stat(it.Main.Id); double v = it.Main.V * PlusMul(it.Plus);
            return S.Pct ? ToFixed(v, 1) : Pf.Round(v);   // JS：S.dec ?? 1（百分比屬性都是 1 位小數）
        }
        public static Dictionary<string, int> SetCounts(Dictionary<string, Item> equip)
        {
            var n = new Dictionary<string, int>();
            foreach (var it in equip.Values) if (it?.Set != null && it.Kind != "weapon") n[it.Set] = (n.TryGetValue(it.Set, out var c) ? c : 0) + 1;
            return n;
        }

        /// 一開始身上的裝備：鏽色星核＋麻布衣，沒有副屬性（items.js 的 starterGear）
        public static (Item core, Item shell) StarterGear()
        {
            var core = MakeItem(1, COMMON, null, "sword1"); core.Affixes.Clear();
            var shell = MakeItem(1, COMMON, null, "body1"); shell.Affixes.Clear();
            return (core, shell);
        }
        /// 魔物核（forms.js 的 makeCore）
        static readonly Dictionary<string, string> FORM_NAME = new Dictionary<string, string> { ["star"] = "星星", ["slime"] = "黏液星", ["bat"] = "蝠翼星", ["spike"] = "尖刺星", ["can"] = "鐵罐星" };
        public static Item MakeCore(string id) => new Item { Uid = NewUid(), Kind = "formcore", Form = id, Name = FORM_NAME[id] + "的靈核", Icon = "core_" + id, Rarity = 3, Ilvl = 1 };
        /// 綜合戰力（stats.js 的 power）：判斷「這件比身上的好嗎」
        public static double Power(Stats s)
        {
            double crit = 1 + (Math.Min(100, s.Crit) / 100) * (s.CritDmg / 100);
            double off = s.Atk * crit * (1 + s.Skill / 300 + s.Ult / 500 + s.Charge / 400 + s.Cdr / 150);
            double surv = s.MaxHp / (1 - s.Def / (s.Def + 60)) * (1 + s.Leech / 25);
            double util = 1 + (s.Move + s.Mf / 3) / 400;
            int four = s.Sets.Values.Count(n => n >= 4);
            return Math.Sqrt(off) * Pf.Pow(surv, 0.35) * util * (1 + 0.12 * s.Uniques.Count) * (1 + 0.15 * four) * (1 + 0.03 * s.CoreTier);
        }
        static string TargetSlot(Item item, Dictionary<string, Item> equip, int lv)
        {
            if (item.Kind == "junk") return null;
            if (item.Kind != "acc") return item.Kind;
            if (equip["acc1"] == null) return "acc1";
            if (equip["acc2"] == null) return "acc2";
            var e1 = new Dictionary<string, Item>(equip) { ["acc1"] = item }; var e2 = new Dictionary<string, Item>(equip) { ["acc2"] = item };
            return Power(ComputeStats(e1, lv)) >= Power(ComputeStats(e2, lv)) ? "acc1" : "acc2";
        }
        /// 穿上 item 之後比較好嗎（stats.js 的 compare）。null＝不能穿
        public static (string slot, bool better)? Compare(Item item, Dictionary<string, Item> equip, int lv)
        {
            var slot = TargetSlot(item, equip, lv);
            if (slot == null) return null;
            var after = new Dictionary<string, Item>(equip) { [slot] = item };
            return (slot, Power(ComputeStats(after, lv)) > Power(ComputeStats(equip, lv)) * 1.005);
        }
        public static double XpNeed(int lv) => Pf.Round(24 + lv * 16 + lv * lv * 1.2);
        public const int MAX_LV = 100, BAG_SIZE = 100;

        /// stats.js 的 computeStats：等級＋身上裝備 → 戰鬥數值。bonus＝靈核換來的基礎屬性
        public static Stats ComputeStats(Dictionary<string, Item> equip, int lv, Dictionary<string, double> bonus = null)
        {
            var sum = new Dictionary<string, double>(); var uniques = new HashSet<string>();
            void Add(string id, double v) => sum[id] = (sum.TryGetValue(id, out var o) ? o : 0) + v;
            foreach (var it in equip.Values)
            {
                if (it == null) continue;
                if (it.Main != null) Add(it.Main.Id, MainValue(it));
                foreach (var a in it.Affixes) Add(a.Id, a.V);
                if (it.Unique != null) uniques.Add(it.Unique);
            }
            var sets = SetCounts(equip);
            if (sets.TryGetValue("meteor", out var m1) && m1 >= 2) sum["crit"] = (sum.TryGetValue("crit", out var c1) ? c1 : 0) + 8;
            if (sets.TryGetValue("reson", out var m2) && m2 >= 2) sum["charge"] = (sum.TryGetValue("charge", out var c2) ? c2 : 0) + 15;
            if (sets.TryGetValue("feast", out var m3) && m3 >= 2) sum["leech"] = (sum.TryGetValue("leech", out var c3) ? c3 : 0) + 2;
            double G(string k) => sum.TryGetValue(k, out var v) ? v : 0;
            double Bn(string k) => bonus != null && bonus.TryGetValue(k, out var v) ? v : 0;
            equip.TryGetValue("weapon", out var w);
            var core = CoreOf(w);
            return new Stats
            {
                Uniques = uniques, Sets = sets, CoreId = core?.id, CoreX = core?.x ?? 0, CoreTier = core?.tier ?? 0,
                Atk = Pf.Round((0.3 * (lv - 1) + G("atk") + Bn("atk")) * (1 + G("atkPct") / 100)),
                MaxHp = Pf.Round((100 + 3 * (lv - 1) + G("hp") + Bn("hp")) * (1 + G("hpPct") / 100)),
                Def = G("def") + Bn("def"),
                Crit = G("crit"),
                CritDmg = ToFixed(10 + G("critDmg") + Bn("critDmg"), 1),
                Skill = G("skill"), Ult = G("ult"),
                Charge = ToFixed(G("charge") + Bn("charge"), 1),
                Cdr = Math.Min(40, G("cdr")),
                Leech = ToFixed(G("leech"), 1),
                Move = G("move"), Mf = G("mf"),
            };
        }
    }
}
