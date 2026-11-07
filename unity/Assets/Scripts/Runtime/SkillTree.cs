// skilltree.js：形態技能樹。每個形態一棵樹：三條路線（0 技能、1 普攻、2 體質）＋最終節點（三條各至少 3 點）＋形態被動（路線 4，最高 10 級、越後面越貴）。
// 點數＝那個形態的「靈核」（Game.FormsOwned[形態]＝總共拿到幾顆，花掉的從樹上算）。點下去就固定（沒有洗點）。
// forms.js 的形態說明、靈核換屬性（CORE_STAT：2 顆換一次那種魔物的屬性）也在這裡。
using System;
using System.Collections.Generic;
using System.Linq;

namespace ZeroStar
{
    public static class SkillTree
    {
        public class Node { public string Id, Icon, Name; public int Path, Max, Cost; public int[] Costs; public Func<int, string> Desc; }
        public static readonly string[] PATHS = { "技能", "普攻", "體質" };
        public const int CAP_NEED = 3, CORE_COST = 2, CARRY_MAX = 3;
        static readonly int[] PASSIVE_COSTS = { 1, 1, 1, 2, 2, 2, 3, 3, 3, 4 };
        static Node N(string id, int path, int max, int cost, string name, Func<int, string> desc) => new Node { Id = id, Path = path, Max = max, Cost = cost, Icon = "n_" + id, Name = name, Desc = desc };
        static Node P(string id, string icon, string name, Func<int, string> desc) => new Node { Id = id, Path = 4, Max = 10, Cost = 1, Costs = PASSIVE_COSTS, Icon = icon, Name = name, Desc = desc };
        public static readonly Dictionary<string, Node[]> TREES = new Dictionary<string, Node[]>
        {
            ["star"] = new[]
            {
                N("s_big", 0, 3, 1, "星屑增量", r => $"星屑彈爆炸範圍 +{15 * r}%"), N("s_pierce", 0, 1, 2, "貫穿", r => "星屑彈穿過第一隻敵人，打到第二隻才爆開"), N("s_fire", 0, 1, 2, "星火", r => "燃燒的傷害 +60%"),
                N("s_edge", 1, 3, 1, "銳角", r => $"普攻傷害 +{5 * r}%"), N("s_wave", 1, 1, 2, "星光斬", r => "連段最後一下射出一道短距離的星光斬"), N("s_light", 1, 1, 2, "收招輕盈", r => "打完一套連段後 2 秒內，移速 +20%"),
                N("s_origin", 2, 1, 2, "星之本源", r => "切換成星星時，魔力 +10（3 秒一次）"), N("s_return", 2, 1, 2, "回歸", r => "切回星星時，技能冷卻減半"),
                N("s_rain", 3, 1, 3, "星雨", r => "星屑彈爆開 1 秒後，天上落下一陣小星屑"),
                P("p_star", "st_ult", "星之光輝", r => $"（星星時）大招傷害 +{4 * r}%"),
            },
            ["slime"] = new[]
            {
                N("g_big", 0, 3, 1, "大顆黏液", r => $"黏液彈爆炸範圍 +{15 * r}%"), N("g_bounce", 0, 1, 2, "彈跳", r => "黏液彈爆開後再往前彈一次（傷害 60%）"), N("g_ground", 0, 1, 2, "黏液地面", r => "爆開的地方留下黏液 3 秒，踩到的敵人沾黏液"),
                N("g_horn", 1, 3, 1, "長角", r => $"普攻距離 +{8 * r}%"), N("g_coat", 1, 1, 2, "黏液角", r => "連段的每一下都會讓敵人沾黏液"), N("g_spring", 1, 1, 2, "彈性", r => "被打時有 20% 機率把旁邊的敵人彈開"),
                N("g_fuel", 2, 1, 2, "易燃體質", r => "大火的擴散範圍 +30%"), N("g_film", 2, 1, 2, "黏液護膜", r => "切換成黏液星後 3 秒內，受到的傷害 -25%"),
                N("g_split", 3, 1, 3, "分裂", r => "黏液彈爆開後分裂成 3 顆小黏液彈"),
                P("p_slime", "st_hp", "黏液再生", r => $"（黏液星時）每秒回復 {(0.9 + 0.1 * r):0.0}% 生命"),
            },
            ["can"] = new[]
            {
                N("c_long", 0, 3, 1, "加長", r => $"衝撞距離 +{12 * r}%"), N("c_volt", 0, 1, 2, "帶電衝撞", r => "撞到的敵人帶電時間 +1 秒，而且會麻痺"), N("c_brake", 0, 1, 2, "急停震地", r => "衝撞結束時重重踩地，震傷周圍的敵人"),
                N("c_weight", 1, 3, 1, "重量", r => $"普攻擊退距離 +{10 * r}%"), N("c_quake", 1, 1, 2, "震波", r => "連段最後一下錘地，往兩邊送出一道小震波"), N("c_iron", 1, 1, 2, "鐵皮", r => "攻擊時被打不會中斷（霸體）"),
                N("c_conduct", 2, 1, 2, "導電體", r => "感電連鎖多跳 1 隻（不潮濕的也會被電到）"), N("c_dent", 2, 1, 2, "凹痕記憶", r => "切換成鐵罐星後 3 秒內，防禦 +50%"),
                N("c_truck", 3, 1, 3, "回收車", r => "衝撞時把路上的小怪推著走，衝完一起砸出去"),
                P("p_can", "st_def", "鐵底盤", r => $"（鐵罐星時）被打時的擊退距離和硬直時間 -{5 * r}%"),
            },
            ["bat"] = new[]
            {
                N("b_far", 0, 3, 1, "遠飛", r => $"飛行距離 +{12 * r}%"), N("b_fang", 0, 1, 2, "毒牙", r => "毒的傷害 +60%"), N("b_double", 0, 1, 2, "二段飛", r => "飛完 1.2 秒內可以再飛一次（不用等冷卻）"),
                N("b_claw", 1, 3, 1, "快爪", r => $"普攻傷害 +{4 * r}%"), N("b_hover", 1, 1, 2, "懸停", r => "空中攻擊時停留更久"), N("b_blood", 1, 1, 2, "嗜血爪", r => "打中毒的敵人時，回復傷害的 3%"),
                N("b_toxic", 2, 1, 2, "劇毒", r => "毒的持續時間 +40%"), N("b_night", 2, 1, 2, "夜行", r => "切換成蝠翼星後 3 秒內，移速 +30%、衝刺冷卻 -30%"),
                N("b_swarm", 3, 1, 3, "蝙蝠群", r => "滑翔時放出 3 隻小蝙蝠，自動去咬附近的敵人"),
                P("p_bat", "st_move", "夜翼", r => $"（蝠翼星時）移動速度 +{2 * r}%、跳躍高度 +{(1.5 * r):0.0}%"),
            },
            ["spike"] = new[]
            {
                N("k_long", 0, 3, 1, "長滾", r => $"刺球衝刺距離 +{12 * r}%"), N("k_shed", 0, 1, 2, "散刺", r => "刺球衝刺結束時，往四周爆出一圈刺"), N("k_refund", 0, 1, 2, "連滾", r => "一次刺球衝刺刺中 3 隻以上，冷卻退一半"),
                N("k_tip", 1, 3, 1, "尖端", r => $"暴擊率 +{3 * r}%"), N("k_mark", 1, 1, 2, "破綻", r => "暴擊打中的敵人 3 秒內多受 10% 傷害"), N("k_sharp", 1, 1, 2, "銳利", r => "暴擊傷害 +25%"),
                N("k_thorn", 2, 1, 2, "反刺", r => "被打時，打你的怪被刺一下（攻擊力 80%）"), N("k_curl", 2, 1, 2, "縮成一團", r => "切換成尖刺星後 3 秒內，受到的傷害 -25%"),
                N("k_double", 3, 1, 3, "滾滾滾", r => "刺球衝刺完 1.2 秒內可以再滾一次（不用等冷卻、不花魔力）"),
                P("p_spike", "st_crit", "刺蝟本能", r => $"（尖刺星時）暴擊率 +{r}%"),
            },
        };
        public static readonly string[] FORM_IDS = { "star", "slime", "bat", "spike", "can" };
        public static readonly Dictionary<string, string> FORM_DESC = new Dictionary<string, string>
        {
            ["star"] = "均衡的連段。技能：星屑彈，直線射出、打中會爆開。",
            ["slime"] = "角甩出去很遠。技能：黏液彈，爆開範圍大、把怪推開。",
            ["bat"] = "快速連續抓擊，空中攻擊時停得更久、按住跳可以滑翔。技能：蝠翼飛行，往前上方飛一小段，撞到的怪都會受傷。",
            ["spike"] = "快速連續突刺，暴擊率高（+8%）。技能：刺球衝刺，縮成刺球往前滾，路上的怪每隻刺一次，滾的時候不會受傷。",
            ["can"] = "慢、重、全部擊飛。技能：蓋子衝撞，往前衝，衝的時候不會受傷。",
        };
        public static readonly Dictionary<string, (string id, double v, string label, string icon)> CORE_STAT = new Dictionary<string, (string, double, string, string)>
        {
            ["slime"] = ("hp", 2, "生命 +2", "st_hp"), ["can"] = ("def", 1, "防禦 +1", "st_def"), ["bat"] = ("critDmg", 0.5, "暴擊傷害 +0.5%", "st_crit"), ["spike"] = ("crit", 0.3, "暴擊率 +0.3%", "st_crit"),
        };

        public static int CostOf(Node n, int r) => n.Costs != null ? n.Costs[Math.Min(r, n.Costs.Length - 1)] : n.Cost;
        static int NodeSpent(Node n, int r) => n.Costs != null ? n.Costs.Take(r).Sum() : r * n.Cost;
        public static int PathSpent(Game g, string form, int path) => TREES.TryGetValue(form, out var t) ? t.Where(n => n.Path == path).Sum(n => NodeSpent(n, g.Rank(form, n.Id))) : 0;
        public static int Spent(Game g, string form) => Enumerable.Range(0, 5).Sum(p => PathSpent(g, form, p));
        public static int FreePts(Game g, string form) => (g.FormsOwned.TryGetValue(form, out var p) ? p : 0) - Spent(g, form) - (g.CoreSpent.TryGetValue(form, out var c) ? c : 0);
        public static bool CanBuy(Game g, string form, Node n)
        {
            int r = g.Rank(form, n.Id);
            if (r >= n.Max || FreePts(g, form) < CostOf(n, r)) return false;
            if (n.Path == 3 && Enumerable.Range(0, 3).Any(p => PathSpent(g, form, p) < CAP_NEED)) return false;
            return true;
        }
        public static bool Buy(Game g, string form, Node n)
        {
            if (!CanBuy(g, form, n)) return false;
            g.Tree[form + ":" + n.Id] = g.Rank(form, n.Id) + 1;
            return true;
        }
    }
}
